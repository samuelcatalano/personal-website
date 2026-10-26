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
// Display-space grade after tone mapping: ACES flattens colour, the North Star look is saturated and warm.
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
  const pr = renderer.getPixelRatio(), msaa = (t) => (t === 'high' ? 4 : 0); // the default composer target drops the canvas antialias, so thin detail (A330 windows, railings) stair-steps; MSAA rides the high tier (desktop p95 9 -> 17 ms at 120 Hz, the fps governor demotes it)
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: msaa(tier) }));
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
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade); composer.addPass(grade);
  const v = new THREE.Vector3();
  const post = {
    tier,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
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
      grade.uniforms.uContrast.value = 1.025 + 0.045 * day;
      grade.uniforms.uSat.value = 1 + 0.14 * day; grade.uniforms.uWarm.value.set(1 + 0.02 * day, 1, 1 - 0.03 * day);
      composer.render(dt);
    },
  };
  return post;
}
