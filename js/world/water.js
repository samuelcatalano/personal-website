import * as THREE from 'three';
import { SUN_DIR } from './sky.js';
const DAY_SKY = new THREE.Color(0x8cc4f0), NIGHT_SKY = new THREE.Color(0x18203a);
const vertexShader = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vPos;
void main() {
vec4 wp = modelMatrix * vec4(position, 1.0);
vPos = wp.xyz;
vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const fragmentShader = /* glsl */`
uniform float uTime, uNight;
uniform vec3 uSun;
uniform vec3 uDeep, uShallow, uGlint, uNightTint, uSky;
varying vec3 vPos;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
vec2 cell = floor(vPos.xz / 2.0);
float w = sin(cell.x * 0.7 + uTime * 2.0) * sin(cell.y * 1.3 - uTime * 1.5);
vec3 c = mix(uDeep, uShallow, step(0.3, w));
c = mix(c, uGlint, step(0.985, hash(cell + floor(uTime * 2.0))));
c = mix(c, uNightTint, uNight * 0.75);
vec2 q = vPos.xz;
vec2 g = vec2(cos(q.x * 0.35 + uTime * 0.9) * 0.5 + cos(q.x * 0.9 - q.y * 0.6 - uTime * 1.3) * 0.25,
cos(q.y * 0.4 - uTime * 0.7) * 0.5 + cos(q.y * 1.1 + q.x * 0.5 + uTime * 1.1) * 0.25) * 0.12;
vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
vec3 v = normalize(cameraPosition - vPos);
float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
c = mix(c, uSky, fres * 0.9);
vec3 r = reflect(-v, n); // sun glint: sparkle cells where the reflection nears the sun
float sp = step(0.82, hash(floor(q * 3.0) + floor(uTime * 3.0))) * smoothstep(0.93, 0.99, dot(r, uSun));
c += uGlint * sp * 1.5 * (1.0 - uNight);
gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
export function createWater({ x0, x1, z, width }) {
  const geo = new THREE.PlaneGeometry(x1 - x0, width).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSun: { value: SUN_DIR }, uNight: { value: 0 },
      uDeep: { value: new THREE.Color(0x1456b0) }, uShallow: { value: new THREE.Color(0x2b8ae6) },
      uGlint: { value: new THREE.Color(0xe6f6ff) }, uNightTint: { value: new THREE.Color(0x0a1330) }, uSky: { value: new THREE.Color(0x8cc4f0) },
    }]),
    vertexShader, fragmentShader, fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, 0.1, z);
  return {
    mesh,
    update(time, night) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uNight.value = night;
      mat.uniforms.uSky.value.lerpColors(DAY_SKY, NIGHT_SKY, night);
    },
  };
}
