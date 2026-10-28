// Smooth appear/vanish for a vehicle (ambient.js): while 0 < f < 1 its materials are swapped for per-vehicle transparent clones, then the shared originals go back.
// Clones are made once per vehicle and reused (no per-frame allocation); the shared beam materials/uniforms are re-read each frame so night glow keeps its level.
const each = (m) => (Array.isArray(m) ? m : [m]);
export function fadeVehicle(root, f) {
  const st = root.userData.fade ??= { on: false, list: [], clones: new Map() };
  if (f >= 1 || f <= 0) { if (st.on) { for (const e of st.list) e.o.material = e.orig; st.on = false; } return; }
  if (!st.on) { // (re)collect: the GLB upgrade can replace meshes after construction
    st.list.length = 0;
    root.traverse((o) => {
      if (!o.material) return;
      const cl = each(o.material).map((m) => { let c = st.clones.get(m); if (!c) { c = m.clone(); c.transparent = true; st.clones.set(m, c); } return c; });
      st.list.push({ o, orig: o.material, cl: Array.isArray(o.material) ? cl : cl[0] });
    });
    for (const e of st.list) e.o.material = e.cl;
    st.on = true;
  }
  for (const e of st.list) each(e.orig).forEach((m, i) => {
    const c = each(e.cl)[i]; c.opacity = m.opacity * f; c.visible = m.visible;
    if (m.uniforms?.uOp) { c.uniforms.uOp.value = m.uniforms.uOp.value * f; c.uniforms.uPx.value = m.uniforms.uPx.value; } // beams.js glow points (ShaderMaterial)
  });
}
export const disposeFade = (root) => { const st = root.userData.fade; if (st) for (const c of st.clones.values()) c.dispose(); };
