import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const bytes = readFileSync(process.env.NPC_SHIRT_ASSET || new URL('../assets/npc/reference/npc_lod0.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12), model = JSON.parse(bytes.subarray(20, 20 + jsonLength)), binary = bytes.subarray(28 + jsonLength);
function attribute(node, name) {
  const primitive = model.meshes[node.mesh].primitives[0], a = model.accessors[primitive.attributes[name]], v = model.bufferViews[a.bufferView];
  const components = { VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], width = { 5121: 1, 5123: 2, 5126: 4 }[a.componentType];
  const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5126: 'readFloatLE' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: components }, (_, k) => binary[read]((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || width * components) + k * width)));
}

test('shirt fit keeps a valid normalized four-influence skin on the original rig', () => {
  assert.equal(model.skins[0].joints.length, 53);
  assert.deepEqual(model.animations.map(a => a.name).sort(), ['Idle', 'Walk', 'Wave']);
  for (const node of model.nodes.filter(n => n.mesh !== undefined)) {
    const joints = attribute(node, 'JOINTS_0'), weights = attribute(node, 'WEIGHTS_0');
    weights.forEach((row, i) => {
      assert.ok(row.every(w => Number.isFinite(w) && w >= 0));
      assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-5);
      assert.ok(joints[i].every(j => j < model.skins[node.skin].joints.length));
    });
  }
});

test('collar points that followed only the head now stay anchored to the shirt', () => {
  const body = model.nodes.find(n => n.name === 'Body'), names = model.skins[body.skin].joints.map(i => model.nodes[i].name);
  const joints = attribute(body, 'JOINTS_0'), weights = attribute(body, 'WEIGHTS_0');
  for (const vertex of [11522, 11586, 11587, 11588]) {
    const influence = name => weights[vertex].reduce((sum, w, k) => sum + (names[joints[vertex][k]] === name ? w : 0), 0);
    assert.ok(influence('head') < .001, `collar vertex ${vertex} follows the head`);
    assert.ok(influence('spine_03') > .65, `collar vertex ${vertex} lost its torso anchor`);
  }
});

test('shirt fit preserves every original animation and texture payload', () => {
  const views = new Set(model.images.map(image => image.bufferView));
  for (const animation of model.animations) for (const sampler of animation.samplers) {
    views.add(model.accessors[sampler.input].bufferView);
    views.add(model.accessors[sampler.output].bufferView);
  }
  const hash = createHash('sha256');
  for (const index of [...views].sort((a, b) => a - b)) {
    const view = model.bufferViews[index], start = view.byteOffset || 0;
    hash.update(binary.subarray(start, start + view.byteLength));
  }
  assert.equal(hash.digest('hex'), '9fb3b8f415af5a3e883c79ffb9f7b1f5d7ac19685f2a2c83effc7d00bd13c63d');
});
