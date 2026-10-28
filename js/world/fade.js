// Smooth appear/vanish for a vehicle (ambient.js): screen-door fade. The opaque materials stay (depthWrite on, no clones);
// fragments are discarded by an interleaved-gradient dither against uFade, set per object in onBeforeRender. Shadows use a dithered
// custom depth material with the same threshold. Additive beams/glows (and ShaderMaterials) still fade by opacity on per-vehicle clones.
import * as THREE from 'three';
const each = (m) => (Array.isArray(m) ? m : [m]);
const U = { value: 1 }; // shared; each draw sets it just before the program uploads
const DITHER = 'void main() {\n if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= uFade) discard;';
function patch(m) {
  if (m.userData.dither) return;
  m.userData.dither = true;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (s, r) => { prev?.(s, r); s.uniforms.uFade = U; s.fragmentShader = 'uniform float uFade;\n' + s.fragmentShader.replace('void main() {', DITHER); };
  m.customProgramCacheKey = () => 'dither' + key;
}
const DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); patch(DEPTH);
const opacityOnly = (m) => m.isShaderMaterial || m.blending === THREE.AdditiveBlending;
function hook(o, root) {
  o.userData.dither = true;
  o.onBeforeRender = (r, s, c, g, mat) => { U.value = root.userData.fadeV ?? 1; mat.uniformsNeedUpdate = true; };
  if (o.castShadow) o.customDepthMaterial = DEPTH;
}
export function fadeVehicle(root, f) {
  const st = root.userData.fade ??= { on: false, list: [], clones: new Map() };
  root.userData.fadeV = f * f * (3 - 2 * f); // ease-in-out
  root.traverse((o) => { // cheap; also catches meshes the GLB upgrade swaps in later
    if (!o.material || o.userData.dither) return;
    if (o.isMesh && each(o.material).every((m) => !opacityOnly(m))) { each(o.material).forEach(patch); hook(o, root); }
  });
  if (f >= 1 || f <= 0) { if (st.on) { for (const e of st.list) e.o.material = e.orig; st.on = false; } return; }
  if (!st.on) { // opacity-faded parts (beams, glows): swap in clones only while fading
    st.list.length = 0;
    root.traverse((o) => {
      if (!o.material || o.userData.dither) return;
      const cl = each(o.material).map((m) => { let c = st.clones.get(m); if (!c) { c = m.clone(); c.transparent = true; st.clones.set(m, c); } return c; });
      st.list.push({ o, orig: o.material, cl: Array.isArray(o.material) ? cl : cl[0] });
    });
    for (const e of st.list) e.o.material = e.cl;
    st.on = true;
  }
  const k = root.userData.fadeV;
  for (const e of st.list) each(e.orig).forEach((m, i) => {
    const c = each(e.cl)[i]; c.opacity = m.opacity * k; c.visible = m.visible;
    if (m.uniforms?.uOp) { c.uniforms.uOp.value = m.uniforms.uOp.value * k; c.uniforms.uPx.value = m.uniforms.uPx.value; } // beams.js glow points (ShaderMaterial)
  });
}
export const disposeFade = (root) => { const st = root.userData.fade; if (st) for (const c of st.clones.values()) c.dispose(); };
