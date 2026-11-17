import * as THREE from 'three';
// The Caio is articulated: a front body on the front and middle axles and a trailing section on the rear axles, hinged at a turntable inside the bellows.
// Two bones skin every body mesh: vertices ahead of the bellows follow the front bone (the vehicle itself), those behind it the rear bone, and the
// bellows blend between them so the concertina folds instead of tearing. Skinning is per object, so the seven Caios keep sharing geometry and materials.
// Measured on assets/models/sao-paulo-bus.glb: the body breaks from x -2.0 to -1.0 (bellows in BusMetal), turntable at its centre. The pivot sits on the
// ground line so the trailing section's tyres stay on the line rest() solves for (route-tunnel.js).
export const CAIO_JOINT = Object.freeze({ x: -1.5, front: -1.0, rear: -2.0 });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Skin weights on the shared geometry, once for every clone; `matrix` maps the mesh into the bus's own frame.
function skin(geometry, matrix) {
  if (geometry.userData.caioSkin) return;
  const p = geometry.attributes.position, n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = smooth(CAIO_JOINT.front, CAIO_JOINT.rear, v.fromBufferAttribute(p, i).applyMatrix4(matrix).x);
    index[i * 4 + 1] = 1; weight[i * 4] = 1 - w; weight[i * 4 + 1] = w;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  geometry.userData.caioSkin = true;
}

// Turns the Caio's body meshes into skinned meshes. Returns { x, bone } for rest(): bone.rotation.z is the trailing section's pitch relative to the
// front body (0 = straight). Wheels stay on the body (their pivots are audited in vehicle space); rest() swings the rear ones about the joint.
export function articulateCaio(glb, wheels) {
  glb.updateMatrixWorld(true);
  const front = new THREE.Bone(), rear = new THREE.Bone();
  front.name = 'caio-front'; rear.name = 'caio-rear';
  rear.position.set(CAIO_JOINT.x, 0, 0); front.add(rear); glb.add(front); glb.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([front, rear]), toBus = glb.matrixWorld.clone().invert(), meshes = [];
  glb.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !wheels.includes(o.parent)) meshes.push(o); });
  for (const o of meshes) {
    skin(o.geometry, new THREE.Matrix4().multiplyMatrices(toBus, o.matrixWorld));
    const s = new THREE.SkinnedMesh(o.geometry, o.material);
    Object.assign(s, { name: o.name, userData: o.userData, castShadow: o.castShadow, receiveShadow: o.receiveShadow, visible: o.visible, renderOrder: o.renderOrder });
    s.position.copy(o.position); s.quaternion.copy(o.quaternion); s.scale.copy(o.scale);
    o.parent.add(s); o.parent.remove(o); s.updateMatrixWorld(true); s.bind(skeleton);
  }
  return { x: CAIO_JOINT.x, bone: rear };
}
