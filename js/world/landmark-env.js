import * as THREE from 'three';
import { DAY, NIGHT, SUN_DIR } from './sky.js';
// Procedural stylised sky environment (no texture download) lit by the same colours as sky.js: gradient dome, soft sun/moon disc
// in SUN_DIR, warm ground bounce. Two prefiltered PMREM maps (day, night) are built ONCE (three@0.169 fixes the cube at 256);
// update() only swaps the map and ramps envMapIntensity per material (never a per-frame PMREM), like updateVehicleEnv.
// Only registered landmark materials use it, so the rest of the scene keeps its approved look.
const mute = (c) => c.clone().lerp(new THREE.Color(0xd9cfbf), 0.55).multiplyScalar(0.8); // stylised, low-saturation sky: a pure blue dome tints stone and slate cold
const SETS = {
  day: { zen: mute(DAY.zen), hor: mute(DAY.hor), ground: new THREE.Color(0xb59a74).multiplyScalar(0.55), disc: new THREE.Color(0xfff0d0).multiplyScalar(5), tight: 40 },
  night: { zen: mute(NIGHT.zen), hor: mute(NIGHT.hor), ground: new THREE.Color(0x1c2230).multiplyScalar(0.5), disc: new THREE.Color(0xaec4ff).multiplyScalar(1.4), tight: 90 },
};
function envScene(p) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { zen: { value: p.zen }, hor: { value: p.hor }, ground: { value: p.ground }, disc: { value: p.disc }, sunDir: { value: SUN_DIR }, tight: { value: p.tight } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 zen, hor, ground, disc, sunDir; uniform float tight; varying vec3 d;
      void main(){ float h = d.y;
        vec3 c = mix(hor, zen, smoothstep(0.0, 0.6, h));
        c = mix(c, mix(hor, ground, 0.8), smoothstep(0.0, -0.15, h)); // warm ground bounce below the horizon
        c += disc * pow(max(dot(d, sunDir), 0.0), tight);
        gl_FragColor = vec4(c, 1.0); }`,
  })));
  return s;
}
export function createLandmarkEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const day = pm.fromScene(envScene(SETS.day), 0.03).texture, night = pm.fromScene(envScene(SETS.night), 0.03).texture;
  pm.dispose();
  const mats = []; let wd = 1, wn = 0;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const apply = (m) => {
    m.envMap = wn > wd ? night : day;
    m.envMapIntensity = m.userData.envK * Math.max(wd, 0.6 * wn);
    if (m.userData.envMetal != null) m.metalness = m.userData.envMetal * (1 - 0.8 * (1 - Math.max(wd, wn))); // dusk dip: env is faded out, so pull gold back toward a lit dielectric instead of black
  };
  return {
    day, night,
    // k = envMapIntensity at full day; metal = authored metalness restored while an env is active
    register(m, { k = 1, metal = null } = {}) { m.userData.envK = k; m.userData.envMetal = metal; mats.push(m); apply(m); m.needsUpdate = true; },
    update(n) { wd = smooth(0.5, 0.15, n); wn = smooth(0.5, 0.85, n); for (const m of mats) apply(m); },
  };
}
