import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AOPass } from './ao-pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const SunRays = {
  uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; varying vec2 vUv;
void main(){
vec4 base = texture2D(tDiffuse, vUv);
vec2 step = (uSun - vUv) / 40.0 * 0.6;
vec2 p = vUv; vec3 acc = vec3(0.0); float w = 1.0;
for (int i = 0; i < 40; i++) {
p += step;
vec3 c = texture2D(tDiffuse, p).rgb;
acc += smoothstep(2.2, 3.5, dot(c, vec3(0.333))) * c * w;
w *= 0.96;
}
gl_FragColor = vec4(base.rgb + acc / 40.0 * uStrength, base.a);
}`,
};
// Sun rays at half resolution: the 40-tap radial blur is low-frequency, so it runs into a half-size target and is added back at full size.
const RAYS_ONLY = `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; varying vec2 vUv;
void main(){
vec2 step = (uSun - vUv) / 40.0 * 0.6;
vec2 p = vUv; vec3 acc = vec3(0.0); float w = 1.0;
for (int i = 0; i < 40; i++) {
p += step;
vec3 c = texture2D(tDiffuse, p).rgb;
acc += smoothstep(2.2, 3.5, dot(c, vec3(0.333))) * c * w;
w *= 0.96;
}
gl_FragColor = vec4(acc / 40.0 * uStrength, 1.0);
}`;
const RAYS_ADD = `uniform sampler2D tDiffuse; uniform sampler2D tRays; varying vec2 vUv;
void main(){ vec4 base = texture2D(tDiffuse, vUv); gl_FragColor = vec4(base.rgb + texture2D(tRays, vUv).rgb, base.a); }`;
class SunRaysHalf extends Pass {
  constructor() {
    super();
    this.uniforms = { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 } };
    this.rays = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.raysQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SunRays.vertexShader, fragmentShader: RAYS_ONLY }));
    this.addQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tRays: { value: this.rays.texture } }, vertexShader: SunRays.vertexShader, fragmentShader: RAYS_ADD }));
    this.clearColor = new THREE.Color(); // not `clear`: Pass uses that flag
  }
  render(renderer, writeBuffer, readBuffer) {
    const w = Math.max(1, readBuffer.width >> 1), h = Math.max(1, readBuffer.height >> 1);
    if (this.rays.width !== w || this.rays.height !== h) this.rays.setSize(w, h);
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.rays);
    if (this.uniforms.uStrength.value > 0) { renderer.clear(); this.raysQuad.render(renderer); } // sun behind the camera: skip the 40 taps, add black
    else { renderer.getClearColor(this.clearColor); const alpha = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.setClearColor(this.clearColor, alpha); }
    this.addQuad.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.addQuad.render(renderer);
  }
  dispose() { super.dispose(); this.rays.dispose(); this.raysQuad.dispose(); this.addQuad.dispose(); }
}
// Restrained display-space grade keeps facade detail without pushing the distant city forward.
const Grade = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.18 }, uContrast: { value: 1.07 }, uWarm: { value: new THREE.Vector3(1.03, 1.0, 0.95) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uContrast; uniform vec3 uWarm; varying vec2 vUv;
void main(){
vec4 c = texture2D(tDiffuse, vUv);
float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3 g = mix(vec3(l), c.rgb, uSat);
g = (g - 0.5) * uContrast + 0.5;
gl_FragColor = vec4(clamp(g * uWarm, 0.0, 1.0), c.a);
}`,
};
export function createPost(renderer, scene, camera, { tier = 'high', sun } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  // The composer bypasses canvas AA; retain two samples on desktop medium for thin wheel spokes and facade edges.
  const pr = renderer.getPixelRatio(), msaa = t => t === 'high' ? 4 : globalThis.matchMedia?.('(min-width: 768px)').matches ? 2 : 0;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: msaa(tier), depthTexture: tier === 'high' ? new THREE.DepthTexture(size.x * pr, size.y * pr) : null }));
  composer.addPass(new RenderPass(scene, camera));
  const heavy = [];
  let rays = null;
  if (tier === 'high') { // ponytail: medium never builds heavy passes
    rays = new SunRaysHalf();
    if (typeof location === 'undefined' || new URLSearchParams(location.search).get('ao') !== '0') heavy.push(new AOPass(camera)); // ?ao=0 kill switch
    heavy.push(rays);
    heavy.forEach((p) => composer.addPass(p));
  }
  const bloom = new UnrealBloomPass(size, 0.10, 0.2, 0.95); // strength 0.10 (was 0.15): threshold 0.95 kept, so only emissive above it blooms
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade); composer.addPass(grade);
  const v = new THREE.Vector3();
  let disposed = false;
  const post = {
    tier,
    dispose() { if (disposed) return; disposed = true; composer.passes.forEach((pass) => pass.dispose()); composer.dispose(); },
    passes: { ao: heavy.find((p) => p instanceof AOPass) ?? null, rays, bloom, grade }, // read by the QA probes (?qa)
    setSize(w, h) { post.setTier(post.tier); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    setFocus(d) { post.passes.ao?.setFocus(d); },
    setTier(t) {
      post.tier = t;
      heavy.forEach((p) => { p.enabled = t === 'high'; });
      for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== msaa(t)) { rt.samples = msaa(t); rt.dispose(); }
    },
    render(dt) {
      if (rays && post.tier === 'high' && sun) {
        v.copy(sun.position).sub(sun.target.position).normalize().multiplyScalar(500).add(camera.position).project(camera);
        rays.uniforms.uSun.value.set(v.x / 2 + 0.5, v.y / 2 + 0.5);
        rays.uniforms.uStrength.value = v.z < 1 ? 0.2 * Math.min(1, sun.intensity / 2.4) : 0;
      }
      const day = sun ? Math.min(1, sun.intensity / 2.4) : 1; // night keeps its own cool palette
      // ponytail: key intensity approximates time of day; no additional exposure pass.
      grade.uniforms.uContrast.value = 1.015 + 0.025 * day;
      grade.uniforms.uSat.value = 1 + 0.08 * day; grade.uniforms.uWarm.value.set(1 + 0.015 * day, 1, 1 - 0.02 * day);
      composer.render(dt);
    },
  };
  return post;
}
