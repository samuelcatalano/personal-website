import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
// Depth-only screen-space AO (high tier). Reads the depth texture of the composer's scene target, so it needs NO extra scene
// render (GTAOPass re-renders the whole city for its normal pass: +~310 draw calls and ~2x triangles). Half-resolution AO
// (10 spiral taps, per-pixel rotation) then a depth-aware 5-tap upsample/blur multiplied into the HDR frame before bloom/tone mapping.
// ponytail: no normals, so flat walls get no self-occlusion; strength stays subtle (creases and street corners only).
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const LIN = `uniform sampler2D tDepth; uniform float uNear, uFar;
float lz(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }`;
const AO_FRAG = `${LIN} uniform float uRadius, uP11, uAspect; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float zc = lz(vUv);
  if (zc > uFar * 0.5) { gl_FragColor = vec4(1.0); return; }
  float rUv = uRadius * uP11 * 0.5 / zc; // world radius -> uv height units
  float a0 = hash(gl_FragCoord.xy) * 6.2831853, occ = 0.0;
  for (int i = 0; i < 10; i++) {
    float a = a0 + float(i) * 2.3999632, r = sqrt((float(i) + 0.5) / 10.0) * rUv;
    float dz = zc - lz(vUv + vec2(cos(a) / uAspect, sin(a)) * r); // > 0: sample is nearer to the camera than this pixel
    occ += smoothstep(0.06, 0.35, dz) * (1.0 - smoothstep(uRadius, uRadius * 2.5, dz));
  }
  gl_FragColor = vec4(vec3(1.0 - occ / 10.0), 1.0);
}`;
const COMP_FRAG = `${LIN} uniform sampler2D tDiffuse, tAO; uniform vec2 uTexel; uniform float uStrength; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv); float zc = lz(vUv);
  float s = texture2D(tAO, vUv).r, w = 1.0;
  vec2 o[4]; o[0] = vec2(1.0, 0.0); o[1] = vec2(-1.0, 0.0); o[2] = vec2(0.0, 1.0); o[3] = vec2(0.0, -1.0);
  for (int i = 0; i < 4; i++) { vec2 uv = vUv + o[i] * uTexel * 1.5; float k = exp(-abs(lz(uv) - zc) / zc * 60.0); s += texture2D(tAO, uv).r * k; w += k; }
  c.rgb *= mix(1.0, s / w, uStrength);
  gl_FragColor = c;
}`;
export class AOPass extends Pass {
  constructor(camera, { strength = 0.85, radius = 1.6 } = {}) {
    super();
    this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    const base = { depthTest: false, depthWrite: false, vertexShader: VERT };
    const shared = () => ({ tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 1 } });
    this.aoMat = new THREE.ShaderMaterial({ ...base, fragmentShader: AO_FRAG, uniforms: { ...shared(), uRadius: { value: radius }, uP11: { value: 1 }, uAspect: { value: 1 } } });
    this.compMat = new THREE.ShaderMaterial({ ...base, fragmentShader: COMP_FRAG, uniforms: { ...shared(), tDiffuse: { value: null }, tAO: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: strength } } });
    this.quad = new FullScreenQuad(this.aoMat);
  }
  setSize(w, h) { this.rt.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.compMat.uniforms.uTexel.value.set(1 / this.rt.width, 1 / this.rt.height); this.aoMat.uniforms.uAspect.value = w / h; }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    for (const m of [this.aoMat, this.compMat]) { m.uniforms.tDepth.value = readBuffer.depthTexture; m.uniforms.uNear.value = cam.near; m.uniforms.uFar.value = cam.far; }
    this.aoMat.uniforms.uP11.value = cam.projectionMatrix.elements[5];
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.aoMat; renderer.setRenderTarget(this.rt); this.quad.render(renderer);
    this.quad.material = this.compMat; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.rt.dispose(); this.aoMat.dispose(); this.compMat.dispose(); this.quad.dispose(); }
}
