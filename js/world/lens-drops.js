import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Water beads on the camera lens: they bend the scene a little, shaded like glass. Runners slide down with thin tails. No fog. Only while it rains or drizzles.
// Adapted from build-lens-raindrops (mengto/skills): the bead layer only, runners removed.
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const FIELD = `uniform vec2 uFieldSize; uniform float uAspect; uniform float uIntensity; uniform float uPhase; varying vec2 vUv;
float hashCell(vec2 id){ vec3 h = fract(vec3(id.xyx) * vec3(0.1031, 0.1030, 0.0973)); h += dot(h, h.yzx + 33.33); return fract((h.x + h.y) * h.z); }
float bead(vec2 p, float density, float wet){
  vec2 grid = p * density; vec2 cell = floor(grid);
  float seed = hashCell(cell + 7.3);
  float coverage = smoothstep(seed, seed + 0.12, wet * 0.8); // scattered beads, not a grid
  float radius = mix(0.095, 0.152, hashCell(cell + 19.0));
  vec2 center = vec2(mix(0.24, 0.76, hashCell(cell + 2.6)), 0.52);
  vec2 head = (fract(grid) - center) / radius;
  return coverage * pow(max(0.0, 1.0 - dot(head, head)), 1.45);
}
// Runners slide down the glass: a round head with a thin tail above it, carried by uPhase.
float runnerLayer(vec2 p, float density, float travel, float wet){
  vec2 grid = p * density;
  float column = floor(grid.x);
  grid.y += hashCell(vec2(column, 1.0)) * 8.0;
  grid.y += travel * mix(0.65, 1.35, hashCell(vec2(column, 3.0)));
  vec2 cell = floor(grid);
  float seed = hashCell(cell + 7.3);
  float coverage = smoothstep(seed, seed + 0.12, wet * 0.5);
  float radius = mix(0.095, 0.133, hashCell(cell + 19.0));
  vec2 center = vec2(mix(0.24, 0.76, hashCell(cell + 2.6)), 0.28);
  vec2 local = fract(grid) - center;
  local.x += 0.024 * sin(8.0 * local.y + seed * 6.28);
  vec2 head = local / vec2(radius, radius * 1.23);
  float h = pow(max(0.0, 1.0 - dot(head, head)), 1.45);
  float along = clamp(local.y / 0.54, 0.0, 1.0);
  float width = radius * mix(0.34, 0.06, along);
  float thread = 1.0 - smoothstep(0.0, width, abs(local.x));
  h = max(h, 0.24 * thread * smoothstep(0.0, 0.08, local.y) * (1.0 - along));
  return coverage * h;
}
float height(vec2 p){
  float w = clamp(uIntensity, 0.0, 1.0);
  return max(0.65 * bead(p, 60.0, w), runnerLayer(p + vec2(0.13, 0.21), 26.0, uPhase * 0.52, w));
}
void main(){
  vec2 p = vUv * vec2(uAspect, 1.0);
  float s = 1.0 / max(1.0, uFieldSize.y);
  vec2 slope = vec2(height(p + vec2(s, 0.0)) - height(p - vec2(s, 0.0)), height(p + vec2(0.0, s)) - height(p - vec2(0.0, s))) / (2.0 * s);
  gl_FragColor = vec4(vec2(128.0 / 255.0) + (127.0 / 255.0) * clamp(slope / 125.0, -1.0, 1.0), height(p), 1.0);
}`;

const COMPOSITE = `uniform sampler2D tDiffuse; uniform sampler2D uField; uniform float uAspect; uniform float uAmount; uniform float uBend; varying vec2 vUv;
void main(){
  vec3 data = texture2D(uField, vUv).rgb;
  vec2 slope = (data.rg * 255.0 - 128.0) / 127.0;
  float wet = clamp(uAmount, 0.0, 1.0);
  vec2 bend = slope * vec2(1.0 / uAspect, 1.0) * uBend * wet;
  vec4 c = texture2D(tDiffuse, clamp(vUv + bend, 0.0, 1.0));
  // 3D bead: normal from the height slope, lit from the top-left. The rim darkens; a hot highlight sits on the lit side.
  vec3 n = normalize(vec3(-slope * 0.8, 1.0));
  vec3 l = normalize(vec3(-0.45, 0.6, 0.66));
  vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
  float mask = clamp(data.b * 1.6, 0.0, 1.0) * wet;
  float spec = pow(max(dot(n, hv), 0.0), 60.0) * mask;
  float rim = (1.0 - n.z) * mask;
  gl_FragColor = vec4(c.rgb * (1.0 - 0.35 * rim) + spec, c.a);
}`;

export function createLensDrops(renderer) {
  const field = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const fieldMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FIELD,
    uniforms: { uFieldSize: { value: new THREE.Vector2(1, 1) }, uAspect: { value: 1 }, uIntensity: { value: 0 }, uPhase: { value: 0 } },
  });
  const quad = new FullScreenQuad(fieldMat);
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uField: { value: null }, uAspect: { value: 1 }, uAmount: { value: 0 }, uBend: { value: 0.005 } },
    vertexShader: VERT, fragmentShader: COMPOSITE,
  });
  // ShaderPass clones its uniforms, and three drops render-target textures in the clone: assign the field after construction.
  pass.uniforms.uField.value = field.texture;
  pass.enabled = false; // dry: the pass is skipped entirely, so it costs nothing without rain
  return {
    pass,
    setSize(w, h) {
      const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
      field.setSize(W, H);
      fieldMat.uniforms.uFieldSize.value.set(W, H);
      fieldMat.uniforms.uAspect.value = W / H;
      pass.uniforms.uAspect.value = W / H;
    },
    update(rain) {
      const v = THREE.MathUtils.clamp(rain ?? 0, 0, 1);
      const desktop = globalThis.matchMedia?.('(min-width: 768px)').matches !== false; // mobile stays unchanged while it is paused
      pass.enabled = v > 0.01 && desktop;
      pass.uniforms.uAmount.value = Math.min(1, v * 5);
      if (!pass.enabled) return;
      fieldMat.uniforms.uIntensity.value = v * v; // squared: drizzle (rain ~0.3) gets far fewer beads than rain (~1)
      // the runners move every frame while it rains; reduced motion holds them still
      const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      fieldMat.uniforms.uPhase.value = reduced ? 0 : (performance.now() / 1000 * (0.9 + 2.4 * v)) % 1000;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(field); quad.render(renderer); renderer.setRenderTarget(prev);
    },
    dispose() { field.dispose(); fieldMat.dispose(); },
  };
}
