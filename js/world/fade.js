// Smooth opacity fade for a vehicle (ambient.js traffic, hero Mini<->bus swap in scene.js). While fading (0 < f < 1) every material is
// swapped for a per-vehicle transparent clone (depthWrite stays on, so the body does not show its own insides) and shadows are off;
// at f = 0 / 1 the shared materials come back. The clones keep the original onBeforeCompile hooks (glass fresnel, paint underbody).
const each = (m) => (Array.isArray(m) ? m : [m]);
export function fadeVehicle(root, f) {
  const st = root.userData.fade ??= { on: false, list: [], clones: new Map() };
  const k = f * f * (3 - 2 * f); // ease-in-out
  if (f >= 1 || f <= 0) {
    if (st.on) { for (const e of st.list) { e.o.material = e.orig; if (e.shadow) e.o.castShadow = true; } st.on = false; }
    return;
  }
  if (!st.on) { // cheap; also catches meshes the GLB upgrade swaps in later
    st.list.length = 0;
    root.traverse((o) => {
      if (!o.material) return;
      const cl = each(o.material).map((m) => {
        let c = st.clones.get(m);
        if (!c) {
          c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey;
          c.transparent = true; if (!m.transparent && !m.isShaderMaterial && m.blending !== 2) c.depthWrite = true;
          st.clones.set(m, c);
        }
        return c;
      });
      st.list.push({ o, orig: o.material, cl: Array.isArray(o.material) ? cl : cl[0], shadow: o.castShadow });
    });
    for (const e of st.list) { e.o.material = e.cl; e.o.castShadow = false; }
    st.on = true;
  }
  for (const e of st.list) each(e.orig).forEach((m, i) => {
    const c = each(e.cl)[i]; c.opacity = m.opacity * k; c.visible = m.visible;
    if (m.uniforms?.uOp) { c.uniforms.uOp.value = m.uniforms.uOp.value * k; c.uniforms.uPx.value = m.uniforms.uPx.value; } // beams.js glow points (ShaderMaterial)
  });
}
export const disposeFade = (root) => { const st = root.userData.fade; if (st) for (const c of st.clones.values()) c.dispose(); };
