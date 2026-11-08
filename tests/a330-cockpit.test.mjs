import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the authored A330 cockpit glazing sits lower on the nose', () => {
  const glb = readFileSync(new URL('../assets/vehicles/a330.glb', import.meta.url));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  let json, binary;
  for (let offset = 12; offset < glb.length;) {
    const length = glb.readUInt32LE(offset), type = glb.readUInt32LE(offset + 4), chunk = glb.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString());
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  assert.ok(json && binary, 'A330 GLB has JSON and binary chunks');

  const dark = json.materials.findIndex(({ name }) => name === 'Dark'), heights = [];
  for (const mesh of json.meshes) if (mesh.name === 'Fuselage') for (const primitive of mesh.primitives) {
    if (primitive.material !== dark) continue;
    const accessor = json.accessors[primitive.attributes.POSITION], view = json.bufferViews[accessor.bufferView];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (let i = 0; i < accessor.count; i++) {
      const x = binary.readFloatLE(start + i * stride), y = binary.readFloatLE(start + i * stride + 4);
      if (x > 27.5) heights.push(y); // front glazing only; cabin windows start behind this nose section
    }
  }
  assert.ok(heights.length, 'the A330 has forward cockpit glazing');
  assert.ok(Math.max(...heights) < 1.95, `cockpit glazing top should sit below 1.95 m on the nose (got ${Math.max(...heights).toFixed(2)} m)`);
});
