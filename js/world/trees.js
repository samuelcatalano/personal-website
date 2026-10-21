import * as THREE from 'three';

const ATLAS_URL = new URL('../../assets/trees/park-atlas.png', import.meta.url);
const SPRITES = [[74, 647, 570, 585], [746, 646, 422, 586]];

function useAtlasRect(material, key) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aRect.xy + vMapUv * aRect.zw;');
  };
  material.customProgramCacheKey = () => key;
}

export async function createTrees(placements) {
  const indexed = placements.map((tree, index) => ({ ...tree, sourceIndex: index }));
  const billboards = indexed;
  const group = new THREE.Group(); group.name = 'trees';
  const texture = await new THREE.TextureLoader().loadAsync(ATLAS_URL.href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.35, side: THREE.DoubleSide });
  const depthMaterial = new THREE.MeshDepthMaterial({ map: texture, alphaTest: 0.35, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  useAtlasRect(material, 'tree-atlas-lambert-v1');
  useAtlasRect(depthMaterial, 'tree-atlas-depth-v1');

  const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const rects = new THREE.InstancedBufferAttribute(new Float32Array(billboards.length * 4), 4);
  geometry.setAttribute('aRect', rects);
  let trees;
  if (billboards.length) {
    trees = new THREE.InstancedMesh(geometry, material, billboards.length);
    trees.name = 'trees-billboards';
    trees.castShadow = trees.receiveShadow = true;
    trees.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trees.customDepthMaterial = depthMaterial;
    trees.frustumCulled = false;
    group.add(trees);
  }

  const transforms = billboards.map(({ x, z, h, crown, base = 0.1, sourceIndex }, i) => {
    const [sx, sy, sw, sh] = SPRITES[Math.floor((Math.sin(x*12.9898+z*78.233)*43758.5453%1+1)%1*SPRITES.length)];
    rects.setXYZW(i, sx / texture.image.width, 1 - (sy + sh) / texture.image.height, sw / texture.image.width, sh / texture.image.height);
    const variation = 0.74 + (Math.sin(x * 12.9898 + z * 78.233) * 0.5 + 0.5) * 0.26;
    const visibleHeight = Math.min(4.2, h + .65) * variation;
    const height = visibleHeight * sh / (sh - 16);
    return { x, z, y: base + 0.02 - height * 8 / sh, width: crown*(.88+.12*variation), height };
  });

  const colors=[0xffffff,0xe5f3e5,0xffead1,0xd6e4c2];
  transforms.forEach(({x,z},i)=>trees?.setColorAt(i,new THREE.Color(colors[Math.abs(Math.round(x*13+z*7))%colors.length])));
  // Understory stays inside existing canopy footprints; no new obstacle/path placement.
  const low=placements.flatMap((p,i)=>i%3===0&&(p.base??.1)<.3?[{p,i,side:-1},{p,i,side:1}]:[]);
  if(low.length){
    const shrubs=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,4),new THREE.MeshLambertMaterial({color:0xffffff}),low.length),o=new THREE.Object3D();
    shrubs.name='tree-understory';shrubs.receiveShadow=true;
    low.forEach(({p,i,side},k)=>{const radius=p.crown*.16; o.position.set(p.x+side*p.crown*.17,(p.base??.1)+.24,p.z+Math.sin(i)*p.crown*.05);o.scale.set(radius,.22,radius*.83);o.updateMatrix();shrubs.setMatrixAt(k,o.matrix);shrubs.setColorAt(k,new THREE.Color([0x527047,0x718446,0x87985a][Math.floor(i/3)%3]));});
    shrubs.userData.sourceIndices=low.map(o=>o.i);shrubs.computeBoundingBox();shrubs.computeBoundingSphere();group.add(shrubs);
  }
  const object = new THREE.Object3D();
  const setTree = (i, yaw = 0) => {
    const { x, z, y, width, height } = transforms[i];
    object.position.set(x, y, z);
    object.rotation.set(0, yaw, 0);
    object.scale.set(width, height, 1);
    object.updateMatrix();
    trees.setMatrixAt(i, object.matrix);
  };
  if (trees) {
    transforms.forEach((_, i) => setTree(i));
    rects.needsUpdate = true;
    trees.instanceMatrix.needsUpdate = true;
    trees.userData.update = (camera) => {
      transforms.forEach(({ x, z }, i) => setTree(i, Math.atan2(camera.position.x - x, camera.position.z - z)));
      trees.instanceMatrix.needsUpdate = true;
    };
  }
  group.userData.update = camera => trees?.userData.update?.(camera);
  let disposed=false;
  group.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    group.children.filter(m=>m!==trees).forEach(m=>{m.geometry.dispose();m.material.dispose();});
    geometry.dispose();material.dispose();depthMaterial.dispose();texture.dispose();
  };
  return group;
}
