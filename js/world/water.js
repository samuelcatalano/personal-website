import * as THREE from 'three';

const DAY_SKY = new THREE.Color(0x9dbcd6), NIGHT_SKY = new THREE.Color(0x2a3140);

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
uniform float uTime;
uniform float uNight;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uGlint;
uniform vec3 uNightTint;
uniform vec3 uSky;
varying vec3 vPos;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 cell = floor(vPos.xz / 2.0);
  float w = sin(cell.x * 0.7 + uTime * 2.0) * sin(cell.y * 1.3 - uTime * 1.5);
  vec3 c = mix(uDeep, uShallow, step(0.3, w));
  c = mix(c, uGlint, step(0.985, hash(cell + floor(uTime * 2.0))));
  c = mix(c, uNightTint, uNight * 0.75);
  // two scrolling sine layers -> animated normal -> fresnel mix toward the sky
  vec2 q = vPos.xz;
  vec2 g = vec2(cos(q.x * 0.35 + uTime * 0.9) * 0.5 + cos(q.x * 0.9 - q.y * 0.6 - uTime * 1.3) * 0.25,
                cos(q.y * 0.4 - uTime * 0.7) * 0.5 + cos(q.y * 1.1 + q.x * 0.5 + uTime * 1.1) * 0.25) * 0.12;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vPos);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  c = mix(c, uSky, fres * 0.8);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createWater({ span, z, width }) {
  const geo = new THREE.PlaneGeometry(span, width).rotateX(-Math.PI / 2);
  let mat, shader = true;
  try {
    mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uNight: { value: 0 },
        uDeep: { value: new THREE.Color(0x71838c) }, uShallow: { value: new THREE.Color(0x96a3a4) },
        uGlint: { value: new THREE.Color(0xc4cbc5) }, uNightTint: { value: new THREE.Color(0x20252c) }, uSky: { value: new THREE.Color(0x9dbcd6) },
      }]),
      vertexShader, fragmentShader, fog: true,
    });
  } catch {
    shader = false;
    mat = new THREE.MeshLambertMaterial({ color: 0x71838c }); // flat fallback
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.1, z);
  return {
    mesh,
    update(time, night) {
      if (!shader) return;
      mat.uniforms.uTime.value = time; // smooth: normals scroll every frame
      mat.uniforms.uNight.value = night;
      mat.uniforms.uSky.value.lerpColors(DAY_SKY, NIGHT_SKY, night);
    },
  };
}
