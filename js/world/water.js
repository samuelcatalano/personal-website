import * as THREE from 'three';
import { SUN_DIR, untone } from './sky.js';
const DAY_SKY = new THREE.Color(0x8fc0e4), NIGHT_SKY = new THREE.Color(0x18203a);
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
uniform float uTime, uNight, uRiverCenter, uHalfWidth, uRainMotion, uKey;
uniform vec3 uSun;
uniform vec3 uDeep, uShallow, uGlint, uNightTint, uSky, uZen;
varying vec3 vPos;
#include <fog_pars_fragment>
// Sum of travelling sine waves (several directions/scales, no cells): slope -> normal; a cheap stand-in for a normal map.
vec2 waveSlope(vec2 p, float t, float dist) {
  vec2 s = vec2(0.0);
  p += 1.4 * vec2(sin(p.y * 0.37 + t * 0.13 + sin(p.x * 0.11)), sin(p.x * 0.29 - t * 0.11 + sin(p.y * 0.17))); // domain warp: breaks the regular sine lattice
  const int N = 8;
  for (int i = 0; i < N; i++) {
    float fi = float(i), a = fi * 2.399 + 0.6, k = 0.32 * pow(1.4, fi), w = sqrt(9.8 * k) * 0.5;
    vec2 d = vec2(cos(a), sin(a));
    float amp = 0.085 / (1.0 + fi * 0.6) / (1.0 + dist * k * 0.02); // short waves fade first with distance: no moire
    s += d * amp * k * cos(dot(d, p) * k - t * w + fi * 1.7 + sin(dot(p, d.yx) * 0.21 + fi));
  }
  return s;
}
void main() {
float across = (vPos.z - uRiverCenter) / uHalfWidth, shore = clamp(1.0 - abs(across), 0.0, 1.0);
float depth = smoothstep(0.0, 0.6, shore);
vec3 v = normalize(cameraPosition - vPos);
float dist = length(cameraPosition - vPos), fade = 1.0 / (1.0 + dist * 0.012); // calm the waves with distance (no shimmer aliasing)
vec2 g = waveSlope(vPos.xz, uTime, dist);
// Rain impacts are local expanding rings, faded before their cell boundary and at distance.
if(uRainMotion>0.001){
  vec2 cell=floor(vPos.xz*.65),local=fract(vPos.xz*.65)-.5;
  float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  float age=fract(uTime*.9+seed),radius=length(local);
  float delta=(radius-age*.6)*38.0;
  float ring=exp(-delta*delta)*(1.0-age)*(1.0-smoothstep(.36,.5,radius));
  g+=local/max(radius,.02)*sin(radius*54.0-age*32.0)*ring*uRainMotion*.09*fade;
}
vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
// Body: deep green-blue in the channel, lighter and murkier at the banks.
vec3 body = mix(uShallow, uDeep, 0.2 + depth * 0.8);
body = mix(body, uNightTint, uNight * 0.85);
// Reflection: sky gradient (pale horizon -> deeper zenith), embankments/buildings reflected dark along both banks.
vec3 r = reflect(-v, n);
vec3 zenith = uZen;
vec3 sky = mix(uSky * 1.08, zenith, smoothstep(0.02, 0.6, r.y));
float bankRefl = smoothstep(0.55, 1.0, abs(across + g.y * 0.6)) * (1.0 - uNight * 0.4);
sky = mix(sky, sky * 0.42, bankRefl);
sky = mix(sky, vec3(dot(sky, vec3(0.3, 0.45, 0.25))), 0.35); // river reflections read greyer than the sky itself
float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
vec3 c = mix(body, sky, clamp(fres * 1.1 + 0.05, 0.0, 0.85));
// Sun: broad sheen + tight sparkles on the steeper facets.
float sd = max(dot(r, uSun), 0.0);
c += uGlint * (pow(sd, 40.0) * 0.45 + pow(sd, 380.0) * 2.4) * (1.0 - uNight) * uKey;
// Night: warm streaks of the city's lights stretched across the water from both banks.
// Irregular columns (three incommensurate sines), wobbling with the waves, fading from the banks towards the channel.
float wx = vPos.x + g.x * 9.0 + g.y * 4.0;
float cols = max(0.0, sin(wx * 1.31) * sin(wx * 0.377 + 1.3) * sin(wx * 0.161 + 4.1));
float streak = pow(cols, 5.0) * smoothstep(0.1, 0.95, abs(across)) * (0.7 + 0.3 * sin(vPos.z * 0.8 + g.x * 8.0 + uTime * 0.5));
c += vec3(1.0, 0.74, 0.42) * streak * uNight * (0.35 + 0.65 * fade) * 1.1;
// Soft foam/wet line where the water meets the embankment.
float foam = smoothstep(0.9, 0.985, abs(across)) * (0.55 + 0.45 * sin(vPos.x * 2.1 + uTime * 0.8 + g.x * 9.0));
c = mix(c, vec3(0.86, 0.9, 0.9) * (1.0 - uNight * 0.75), foam * 0.28);
gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
export function createWater({ x0, x1, z, width, reducedMotion = false }) {
  const geo = new THREE.PlaneGeometry(x1 - x0, width).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uRiverCenter:{value:z},uHalfWidth:{value:width/2}, uSun: { value: SUN_DIR }, uNight: { value: 0 },
      uRainMotion: { value: 0 }, uKey: { value: 1 },
      uDeep: { value: new THREE.Color(0x214a52) }, uShallow: { value: new THREE.Color(0x4d706c) },
      uGlint: { value: new THREE.Color(0xfff0c8) }, uNightTint: { value: new THREE.Color(0x0a1330) }, uSky: { value: new THREE.Color(0xacc9d8) },
      uZen: { value: new THREE.Color(0x4a8fd2) },
    }]),
    vertexShader, fragmentShader, fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, 0.1, z);
  return {
    mesh,
    update(time, night, mood, tier = 'high', skyColors) {
      mat.uniforms.uTime.value = reducedMotion ? 0 : time;
      mat.uniforms.uNight.value = night;
      mat.uniforms.uSky.value.lerpColors(DAY_SKY, NIGHT_SKY, night);
      if(mood){
        mat.uniforms.uSky.value.setRGB(...mood.hor,THREE.SRGBColorSpace).lerp(NIGHT_SKY,night);
        mat.uniforms.uKey.value=(1-THREE.MathUtils.smoothstep(mood.cover??0,.48,.98))*(1-Math.min(1,mood.rain*2));
      }
      mat.uniforms.uRainMotion.value=reducedMotion||tier!=='high'?0:mood?.rain??0;
      untone(mat.uniforms.uSky.value);
      mat.uniforms.uZen.value.copy(mat.uniforms.uSky.value).multiplyScalar(.65);
      if(skyColors){mat.uniforms.uSky.value.copy(skyColors.hor);mat.uniforms.uZen.value.copy(skyColors.zen);}
    },
  };
}
