import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
// tilt-shift: sharp horizontal band, disc blur grows with |uv.y - FOCUS_Y| (uv, 0 = bottom)
const FOCUS_Y = 0.3, HALF_BAND = 0.22, FALLOFF = 0.45, MAX_R = 3.5; // MAX_R in CSS px
const TiltShift = {
  uniforms: { tDiffuse: { value: null }, uInv: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, uFocus: { value: new THREE.Vector3(FOCUS_Y, HALF_BAND, FALLOFF) }, uMax: { value: MAX_R } },
  vertexShader: SunRays.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uInv; uniform vec3 uFocus; uniform float uMax; varying vec2 vUv;
void main(){
float k = smoothstep(uFocus.y, uFocus.y + uFocus.z, abs(vUv.y - uFocus.x));
vec3 acc = texture2D(tDiffuse, vUv).rgb; float w = 1.0;
if (k > 0.002) {
vec2 r = uInv * uMax * k;
for (int i = 1; i <= 12; i++) {
float a = float(i) * 2.39996, d = sqrt(float(i) / 12.0);
acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * d * r).rgb; w += 1.0;
}
}
vec3 c = acc / w;
c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.04); // tiny toy-model saturation lift
gl_FragColor = vec4(c, 1.0);
}`,
};
export function createPost(renderer, scene, camera, { tier = 'high', sun } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const heavy = [];
  let rays = null;
  if (tier === 'high') { // ponytail: medium never builds heavy passes
    const ao = new GTAOPass(scene, camera, size.x, size.y);
    const hide = ao.overrideVisibility;
    ao.overrideVisibility = function () { hide.call(this); this.scene.traverse((o) => { if (o.isSprite || o.name === 'crowd' || o.material?.transparent) o.visible = false; }); };
    rays = new ShaderPass(SunRays);
    heavy.push(ao, rays);
    heavy.forEach((p) => composer.addPass(p));
  }
  composer.addPass(new UnrealBloomPass(size, 0.15, 0.2, 0.95));
  let tilt = null;
  if (tier === 'high') { tilt = new ShaderPass(TiltShift); heavy.push(tilt); composer.addPass(tilt); }
  composer.addPass(new OutputPass());
  const v = new THREE.Vector3();
  const post = {
    tier,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); tilt?.uniforms.uInv.value.set(1 / w, 1 / h); },
    setTier(t) {
      post.tier = t;
      heavy.forEach((p) => { p.enabled = t === 'high'; });
    },
    render(dt) {
      if (rays && post.tier === 'high' && sun) {
        v.copy(sun.position).sub(sun.target.position).normalize().multiplyScalar(500).add(camera.position).project(camera);
        rays.uniforms.uSun.value.set(v.x / 2 + 0.5, v.y / 2 + 0.5);
        rays.uniforms.uStrength.value = v.z < 1 ? 0.2 * Math.min(1, sun.intensity / 2.4) : 0;
      }
      composer.render(dt);
    },
  };
  return post;
}
