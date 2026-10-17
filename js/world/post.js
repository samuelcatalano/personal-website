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
acc += smoothstep(0.8, 1.2, dot(c, vec3(0.333))) * c * w;
w *= 0.96;
}
gl_FragColor = vec4(base.rgb + acc / 40.0 * uStrength, base.a);
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
  composer.addPass(new OutputPass());
  const v = new THREE.Vector3();
  const post = {
    tier,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    setTier(t) {
      post.tier = t;
      heavy.forEach((p) => { p.enabled = t === 'high'; });
    },
    render(dt) {
      if (rays && post.tier === 'high' && sun) {
        v.copy(sun.position).sub(sun.target.position).normalize().multiplyScalar(500).add(camera.position).project(camera);
        rays.uniforms.uSun.value.set(v.x / 2 + 0.5, v.y / 2 + 0.5);
        rays.uniforms.uStrength.value = v.z < 1 ? 0.5 * Math.min(1, sun.intensity / 2.4) : 0;
      }
      composer.render(dt);
    },
  };
  return post;
}
