import { loadGlb } from './glb-loader.js';

// Loads a project-authored facade kit GLB (root -> module{category,anchor} -> <module>__mass|trim|glass -> meshes).
// Returns Map(name -> {category, anchor, roles:{mass,trim,glass}}) where each role is {pos, nor} flat Float32Arrays
// (non-indexed, module space, +Z outward). Callers transform these straight into chunk buckets.
export const loadKit = (url) => loadGlb(url).then((scene) => {
  const modules = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    const category = node.userData?.category;
    if (!category) return;
    const roles = {};
    for (const role of node.children) {
      const name = role.userData?.semantic_role;
      if (!['mass', 'trim', 'glass'].includes(name)) continue;
      const pos = [], nor = [];
      role.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).toNonIndexed();
        if (!g.attributes.normal) g.computeVertexNormals();
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
        g.dispose();
      });
      if (pos.length) roles[name] = { pos: Float32Array.from(pos), nor: Float32Array.from(nor) };
    }
    modules.set(node.name, { category, anchor: node.userData.anchor, roles });
  });
  return modules;
});
