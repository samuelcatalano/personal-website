import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
// Depth-only screen-space AO (high tier). Reads the depth texture of the composer's scene target, so it needs NO extra scene
// render (GTAOPass re-renders the whole city for its normal pass: +~310 draw calls and ~2x triangles). Half-resolution AO
// (10 spiral taps, per-pixel rotation) then a depth-aware 5-tap upsample/blur multiplied into the HDR frame before bloom/tone mapping.
// Normals come from depth samples 4 texels away (smaller-difference side) with an angle bias. Screen derivatives and 1-texel
// baselines are per-row noisy at grazing angles and printed horizontal bands on sunlit ground. Flat ground gets no self-occlusion; creases still darken.
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const LIN = `uniform sampler2D tDepth; uniform float uNear, uFar;
float lz(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }`;
const AO_FRAG = `${LIN} uniform float uRadius, uAspect; uniform vec4 uProj; uniform vec2 uTexelFull; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// view-space position from linear depth; uProj = (P00, P02, P11, P12) of the camera projection (view offsets included)
vec3 vpos(vec2 uv){ float z = lz(uv); vec2 n = uv * 2.0 - 1.0; return vec3((n.x + uProj.y) * z / uProj.x, (n.y + uProj.w) * z / uProj.z, -z); }
void main(){
  float zc = lz(vUv);
  if (zc > uFar * 0.5) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv);
  vec2 sx = vec2(4.0 * uTexelFull.x, 0.0), sy = vec2(0.0, 4.0 * uTexelFull.y); // 4-texel baseline: 1 texel is noisy at grazing angles
  vec3 pr = vpos(vUv + sx) - P, pl = P - vpos(vUv - sx);
  vec3 pu = vpos(vUv + sy) - P, pd = P - vpos(vUv - sy);
  vec3 n = cross(dot(pr, pr) < dot(pl, pl) ? pr : pl, dot(pu, pu) < dot(pd, pd) ? pu : pd);
  float nl = length(n);
  n = nl > 1e-12 ? n / nl : normalize(-P);
  if (dot(n, P) > 0.0) n = -n; // face the camera (the eye sits at the origin)
  float rUv = uRadius * uProj.z * 0.5 / zc; // world radius -> uv height units
  float a0 = hash(gl_FragCoord.xy) * 6.2831853, occ = 0.0;
  for (int i = 0; i < 10; i++) {
    float a = a0 + float(i) * 2.3999632, r = sqrt((float(i) + 0.5) / 10.0) * rUv;
    vec3 v = vpos(vUv + vec2(cos(a) / uAspect, sin(a)) * r) - P;
    float lv = max(length(v), 1e-3);
    // sine of the elevation above the tangent plane: only samples that rise clearly off the surface occlude (bias ~3 deg)
    occ += smoothstep(0.05, 0.3, dot(n, v) / lv) * (1.0 - smoothstep(uRadius, uRadius * 2.5, lv));
  }
  gl_FragColor = vec4(vec3(1.0 - occ / 10.0), 1.0);
}`;
const COMP_FRAG = `${LIN} uniform sampler2D tDiffuse, tAO; uniform vec2 uTexel, uTexelFull; uniform float uStrength, uFocus, uMaxPx; varying vec2 vUv;
// depth of field: sharp around the focus distance (the hero vehicle), soft far background and very near foreground; 12 golden-angle taps, only where the blur is visible
float cocAt(float z){ return max(smoothstep(uFocus * 3.0, uFocus * 8.0, z), 0.8 * (1.0 - smoothstep(uFocus * 0.25, uFocus * 0.5, z))); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv); float zc = lz(vUv);
  float s = texture2D(tAO, vUv).r, w = 1.0;
  vec2 o[4]; o[0] = vec2(1.0, 0.0); o[1] = vec2(-1.0, 0.0); o[2] = vec2(0.0, 1.0); o[3] = vec2(0.0, -1.0);
  for (int i = 0; i < 4; i++) { vec2 uv = vUv + o[i] * uTexel * 1.5; float k = exp(-abs(lz(uv) - zc) / zc * 60.0); s += texture2D(tAO, uv).r * k; w += k; }
  float ao = mix(1.0, s / w, uStrength);
  float coc = uFocus > 0.0 ? cocAt(zc) : 0.0;
  if (coc > 0.02) {
    vec3 acc = c.rgb * ao; float wsum = 1.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i) + 0.5, r = sqrt(fi / 12.0) * coc * uMaxPx, a = fi * 2.39996323;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexelFull; float tz = lz(uv);
      float wt = max(cocAt(tz), step(zc * 0.95, tz)); // a sharp nearer tap must not bleed onto a blurred background
      acc += texture2D(tDiffuse, uv).rgb * ao * wt; wsum += wt;
    }
    c.rgb = acc / wsum;
  } else c.rgb *= ao;
  gl_FragColor = c;
}`;
export class AOPass extends Pass {
  constructor(camera, { strength = 0.85, radius = 1.6 } = {}) {
    super();
    this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    const base = { depthTest: false, depthWrite: false, vertexShader: VERT };
    const shared = () => ({ tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 1 } });
    this.aoMat = new THREE.ShaderMaterial({ ...base, fragmentShader: AO_FRAG, uniforms: { ...shared(), uRadius: { value: radius }, uProj: { value: new THREE.Vector4(1, 0, 1, 0) }, uTexelFull: { value: new THREE.Vector2(1, 1) }, uAspect: { value: 1 } } });
    this.compMat = new THREE.ShaderMaterial({ ...base, fragmentShader: COMP_FRAG, uniforms: { ...shared(), tDiffuse: { value: null }, tAO: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2() }, uTexelFull: { value: new THREE.Vector2(1, 1) }, uStrength: { value: strength }, uFocus: { value: 0 }, uMaxPx: { value: 4 } } });
    this.quad = new FullScreenQuad(this.aoMat);
  }
  setSize(w, h) { this.rt.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.compMat.uniforms.uTexel.value.set(1 / this.rt.width, 1 / this.rt.height); this.aoMat.uniforms.uAspect.value = w / h; this.aoMat.uniforms.uTexelFull.value.set(1 / w, 1 / h); this.compMat.uniforms.uTexelFull.value.set(1 / w, 1 / h); this.compMat.uniforms.uMaxPx.value = 4 * Math.max(1, h / 1080); }
  setFocus(d) { this.compMat.uniforms.uFocus.value = d; } // camera-to-subject distance in metres, 0 = off
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, e = cam.projectionMatrix.elements;
    for (const m of [this.aoMat, this.compMat]) { m.uniforms.tDepth.value = readBuffer.depthTexture; m.uniforms.uNear.value = cam.near; m.uniforms.uFar.value = cam.far; }
    this.aoMat.uniforms.uProj.value.set(e[0], e[8], e[5], e[9]);
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.aoMat; renderer.setRenderTarget(this.rt); this.quad.render(renderer);
    this.quad.material = this.compMat; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.rt.dispose(); this.aoMat.dispose(); this.compMat.dispose(); this.quad.dispose(); }
}
