import * as THREE from 'three';
import { SUN_DIR } from './sky.js';
const DAY_SKY = new THREE.Color(0xacc9d8), NIGHT_SKY = new THREE.Color(0x18203a);
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
uniform float uTime, uNight, uRiverCenter, uHalfWidth;
uniform vec3 uSun;
uniform vec3 uDeep, uShallow, uGlint, uNightTint, uSky;
varying vec3 vPos;
#include <fog_pars_fragment>
void main() {
float shore=clamp(1.0-abs(vPos.z-uRiverCenter)/uHalfWidth,0.0,1.0);
float depth=smoothstep(0.0,0.55,shore);
float ripple=sin(vPos.x*0.65+vPos.z*1.4+uTime*0.48)*sin(vPos.z*0.9-uTime*0.32);
vec3 c=mix(uShallow,uDeep,0.24+depth*0.76)*(1.0+ripple*0.045);
c=mix(c,uNightTint,uNight*0.82);
vec2 q = vPos.xz;
vec2 g = vec2(cos(q.x * 0.35 + uTime * 0.9) * 0.5 + cos(q.x * 0.9 - q.y * 0.6 - uTime * 1.3) * 0.25,
cos(q.y * 0.4 - uTime * 0.7) * 0.5 + cos(q.y * 1.1 + q.x * 0.5 + uTime * 1.1) * 0.25) * 0.12;
vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
vec3 v = normalize(cameraPosition - vPos);
float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
c = mix(c, uSky, fres * 0.9);
vec3 r = reflect(-v, n); // Continuous sun highlight follows the existing small wave normals.
float sp=pow(max(dot(r,uSun),0.0),72.0)*(0.7+0.3*ripple);
c+=uGlint*sp*0.8*(1.0-uNight);
// A restrained edge sheen joins the shallow tint to existing embankments.
c=mix(c,uShallow,0.10*(1.0-depth)*(1.0-uNight));
gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
export function createWater({ x0, x1, z, width }) {
  const geo = new THREE.PlaneGeometry(x1 - x0, width).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uRiverCenter:{value:z},uHalfWidth:{value:width/2}, uSun: { value: SUN_DIR }, uNight: { value: 0 },
      uDeep: { value: new THREE.Color(0x214c52) }, uShallow: { value: new THREE.Color(0x4d7b78) },
      uGlint: { value: new THREE.Color(0xefd7ad) }, uNightTint: { value: new THREE.Color(0x0a1330) }, uSky: { value: new THREE.Color(0xacc9d8) },
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
