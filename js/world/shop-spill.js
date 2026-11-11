import * as THREE from 'three';
// Soft storefront light on existing paving; one draw, no dynamic lights or shadow maps.
export function createShopSpill(scene, frontages, floors) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSpill;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpill = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSpill;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        float across = 1.0 - smoothstep(0.20, 0.5, abs(vSpill.x - 0.5));
        float depth = smoothstep(0.0, 0.18, vSpill.y) * (1.0 - smoothstep(0.35, 1.0, vSpill.y));
        diffuseColor.a *= across * depth;`);
  };
  material.customProgramCacheKey = () => 'shop-spill-1';
  const mesh = new THREE.InstancedMesh(geometry, material, frontages.length), matrix = new THREE.Matrix4();
  frontages.forEach((p, i) => {
    let y = .07;
    for (const b of floors) {
      if (b.plant || b.y + b.h > .23 || b.y + b.h < y) continue;
      const dx = p.x - b.x, dz = p.z + .9 - b.z, c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
      if (Math.abs(c * dx - s * dz) < b.w / 2 && Math.abs(s * dx + c * dz) < b.d / 2) y = b.y + b.h;
    }
    mesh.setMatrixAt(i, matrix.makeScale(p.width, 1, 1.8).setPosition(p.x, y + .008, p.z + .9));
  });
  mesh.name = 'shop-pavement-spill'; mesh.visible = false; mesh.computeBoundingSphere(); scene.add(mesh);
  return { update(night, wet) { material.opacity = .26 * THREE.MathUtils.smoothstep(night, .25, .85) / (1 + wet * .25); mesh.visible = material.opacity > .001; },
    dispose() { scene.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); } };
}
