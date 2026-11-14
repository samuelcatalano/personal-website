import * as THREE from 'three';
// Lamp light field: a world-space map of street-lamp reach on the ground plane. Facades that sit in it pick up lamp light at night.
// One small R8 texture, sampled by XZ in the shader: no extra lights, no extra passes (same pattern as the rain shelter field).
const CELL = 2, RANGE = 22, MAX_TEXELS = 1024;
export function lampFieldData(points) {
  if (!points.length) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= RANGE; z0 -= RANGE; x1 += RANGE; z1 += RANGE;
  const w = Math.min(MAX_TEXELS, Math.ceil((x1 - x0) / CELL)), h = Math.min(MAX_TEXELS, Math.ceil((z1 - z0) / CELL));
  const sx = w / (x1 - x0), sz = h / (z1 - z0), data = new Uint8Array(w * h); // texels per metre
  const r = Math.ceil(RANGE * Math.max(sx, sz));
  for (const [x, z] of points) {
    const cx = (x - x0) * sx, cz = (z - z0) * sz;
    for (let j = Math.max(0, Math.floor(cz) - r); j <= Math.min(h - 1, Math.floor(cz) + r); j++) {
      for (let i = Math.max(0, Math.floor(cx) - r); i <= Math.min(w - 1, Math.floor(cx) + r); i++) {
        const d = Math.hypot((i + 0.5 - cx) / sx, (j + 0.5 - cz) / sz);
        if (d >= RANGE) continue;
        const k = j * w + i, v = (1 - d / RANGE) ** 2;
        data[k] = Math.min(255, data[k] + Math.round(255 * v * 0.6)); // overlapping lamps add, capped
      }
    }
  }
  return { data, w, h, origin: [x0, z0], size: [x1 - x0, z1 - z0] };
}
export function createLampField(points) {
  const field = lampFieldData(points);
  if (!field) return null;
  const texture = new THREE.DataTexture(field.data, field.w, field.h, THREE.RedFormat);
  Object.assign(texture, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, needsUpdate: true });
  const uniforms = { uLampField: { value: texture }, uLampOrigin: { value: new THREE.Vector2(...field.origin) }, uLampSize: { value: new THREE.Vector2(...field.size) }, uLampNight: { value: 0 } };
  return { texture, uniforms };
}
// Chains onto whatever the material already compiles with (landmark env, glow), so the shared materials keep their own hooks.
export function applyLampField(material, uniforms) {
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLampWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
vLampWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vLampWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLampWorld;\nuniform sampler2D uLampField;\nuniform vec2 uLampOrigin;\nuniform vec2 uLampSize;\nuniform float uLampNight;')
      .replace('#include <opaque_fragment>', `vec2 lampUv = (vLampWorld.xz - uLampOrigin) / uLampSize;
float lampIn = step(0.0, lampUv.x) * step(lampUv.x, 1.0) * step(0.0, lampUv.y) * step(lampUv.y, 1.0);
outgoingLight += diffuseColor.rgb * texture2D(uLampField, clamp(lampUv, 0.0, 1.0)).r * lampIn * uLampNight * 0.45;
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : 'std') + '-lamp-field-v1';
}
