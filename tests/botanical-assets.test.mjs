import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../assets/processed/vegetation/',import.meta.url);
const data=readFileSync(new URL('botanical-trees.glb',dir));
assert.equal(data.toString('latin1',0,4),'glTF');
const model=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));

test('five botanical families contain both connected mesh levels',()=>{
 for(const kind of ['oak','plane','birch','spruce','ipe'])for(const level of [0,1]){
  const node=model.nodes.find(n=>n.name===`botanical-${kind}-LOD${level}`);
  assert.ok(node,`missing ${kind} LOD${level}`);
  const meshes=node.mesh!==undefined?[model.meshes[node.mesh]]:(node.children??[]).map(i=>model.meshes[model.nodes[i].mesh]).filter(Boolean);
  assert.ok(meshes.length,`${kind} mesh missing`);
  for(const mesh of meshes)for(const p of mesh.primitives){
   for(const key of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0'])assert.notEqual(p.attributes[key],undefined,`${kind} ${key}`);
   assert.ok(model.accessors[p.attributes.POSITION].count>100,`${kind} remains a coarse primitive`);
  }
 }
});
test('original foliage retains cutout detail and physically rough nonmetal materials',()=>{
 const leaves=model.materials.filter(m=>/leaves/i.test(m.name));assert.ok(leaves.length);
 for(const m of leaves){assert.equal(m.alphaMode,'MASK');assert.ok(Math.abs(m.alphaCutoff-.42)<.001);assert.equal(m.doubleSided,true);assert.equal(m.pbrMetallicRoughness.metallicFactor,0);assert.ok(m.pbrMetallicRoughness.roughnessFactor>=.65);assert.ok(m.pbrMetallicRoughness.baseColorTexture);}
 assert.ok(model.materials.some(m=>/bark/i.test(m.name)&&m.normalTexture),'bark surface relief missing');
 assert.ok(model.images.every(i=>i.bufferView!==undefined&&!i.uri),'source maps must be embedded');
});
test('offline silhouette diagnostic retains 512px detail for every botanical family',()=>{
 const png=readFileSync(new URL('botanical-impostors.png',dir));
 assert.equal(png.toString('latin1',1,4),'PNG');assert.equal(png.readUInt32BE(16),512*5);assert.equal(png.readUInt32BE(20),512);
});
