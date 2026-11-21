import * as THREE from 'three';

// Helper bones of the Samuel character: arm and leg twist, spine midpoints and metacarpals.
// Blender drives them with Copy Rotation constraints (local space), and glTF export drops constraints, so the runtime
// drives them here from their parents, after the mixer and the look chain. Keep these lists in step with
// the authoring rig (assets/models/source/realistic-npc-20261104/).

// [helper, parent, child, weight]: the helper takes this share of the parent's twist. Each child sits on the parent's +Y (checked in the GLB).
const TWIST = [
  ['upperarm_twist_l', 'upperarm_l', 'lowerarm_l', 0.5], ['lowerarm_twist_l', 'lowerarm_l', 'hand_l', 0.5],
  ['thigh_twist_l', 'thigh_l', 'calf_l', 0.5], ['calf_twist_l', 'calf_l', 'foot_l', 0.5],
  ['upperarm_twist_r', 'upperarm_r', 'lowerarm_r', 0.5], ['lowerarm_twist_r', 'lowerarm_r', 'hand_r', 0.5],
  ['thigh_twist_r', 'thigh_r', 'calf_r', 0.5], ['calf_twist_r', 'calf_r', 'foot_r', 0.5],
];

// [helper, source, weight]: the helper copies this share of the source's rotation.
const COPY = [
  ['spine_01_mid', 'spine_02', 0.5], ['spine_02_mid', 'spine_03', 0.5],
  ['metacarpal_index_l', 'index_01_l', 0.3], ['metacarpal_middle_l', 'middle_01_l', 0.3],
  ['metacarpal_ring_l', 'ring_01_l', 0.3], ['metacarpal_pinky_l', 'pinky_01_l', 0.3],
  ['metacarpal_index_r', 'index_01_r', 0.3], ['metacarpal_middle_r', 'middle_01_r', 0.3],
  ['metacarpal_ring_r', 'ring_01_r', 0.3], ['metacarpal_pinky_r', 'pinky_01_r', 0.3],
];

const identity = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const tDelta = new THREE.Quaternion(), tTwist = new THREE.Quaternion(), tEuler = new THREE.Euler();

export function createHelperBones(root) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const rest = {};
  for (const name in bones) rest[name] = bones[name].quaternion.clone();
  const twist = TWIST
    .filter(([h, p, c]) => bones[h] && bones[p] && bones[c] && bones[c].parent === bones[p])
    .map(([h, p, , w]) => ({ h, p, w }));
  const copy = COPY.filter(([h, s]) => bones[h] && bones[s]).map(([h, s, w]) => ({ h, s, w }));
  return {
    count: twist.length + copy.length,
    update() {
      for (const { h, p, w } of twist) {
        // Blender's Copy Rotation (Y only) copies the Y component of the parent's XYZ Euler; three's 'ZYX' Euler has the same Y.
        tDelta.copy(rest[p]).invert().multiply(bones[p].quaternion);
        const turn = tEuler.setFromQuaternion(tDelta, 'ZYX').y;
        bones[h].quaternion.copy(rest[h]).multiply(tTwist.setFromAxisAngle(UP, w * turn));
      }
      for (const { h, s, w } of copy) {
        const delta = rest[s].clone().invert().multiply(bones[s].quaternion);
        bones[h].quaternion.copy(rest[h]).multiply(identity.clone().slerp(delta, w));
      }
    },
  };
}
