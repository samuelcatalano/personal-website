import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { untone } from './sky.js';

const registrations = new WeakMap();
const sceneRegistrations = new WeakMap();
const colors = new Set([P.road, P.pave, P.roof, P.stone, P.gravel, P.concrete, P.slate, P.concreteDark, P.concreteMid]);
const nightZenith = new THREE.Color('#0b1530'), nightHorizon = new THREE.Color('#1d2b4f');
const defaultZenith = [0.435, 0.694, 0.91], defaultHorizon = [0.725, 0.863, 0.961];
const clamp = n => Math.max(0, Math.min(1, n));
function uniforms() {
  return {
    uWet: { value: 0 }, uWeatherTime: { value: 0 }, uWetRain: { value: 0 }, uWetNight: { value: 0 },
    uWetAnimate: { value: 1 }, uWetHigh: { value: 1 },
    uWetSky: { value: new THREE.Color('#6fb1e8') }, uWetHorizon: { value: new THREE.Color('#b9dcf5') },
    uWetLamps: { value: Array.from({ length: 4 }, () => new THREE.Vector3(0, -10000, 0)) },
    uWetBus: { value: new THREE.Vector3(0, -10000, 0) }, uWetHeading: { value: new THREE.Vector2(1, 0) },
  };
}

const fragment = `
uniform float uWet, uWeatherTime, uWetRain, uWetNight, uWetAnimate, uWetHigh;
uniform vec3 uWetSky, uWetHorizon, uWetLamps[4], uWetBus;
uniform vec2 uWetHeading;
varying vec3 vWetWorld;
float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wetNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + 1.0), f.x), f.y);
}
float wetStreak(vec3 source, float width, float reach) {
  vec2 towardCamera = cameraPosition.xz - source.xz;
  vec2 axis = towardCamera / max(length(towardCamera), 0.001), delta = vWetWorld.xz - source.xz;
  float along = dot(delta, axis), across = dot(delta, vec2(-axis.y, axis.x));
  float spread = width + max(0.0, along) * 0.022;
  return exp(-across * across / (spread * spread)) * exp(-max(0.0, along) / reach) * smoothstep(-0.35, 0.1, along);
}
`;
const surface = `
// Compute exposure before rain perturbs the shading normal: walls stay dry.
vec3 wetWorldNormal = inverseTransformDirection(normal, viewMatrix);
float wetMask = uWet * smoothstep(0.45, 0.85, wetWorldNormal.y);
float wetPuddle = 0.0;
// ponytail: ground-level puddles stay off shared roof faces; add surface tags if elevated decks need puddles.
if (wetMask > 0.001 && vWetWorld.y < 0.4) wetPuddle = wetMask * smoothstep(0.40, 0.68, wetNoise(vWetWorld.xz * 0.42));
diffuseColor.rgb *= 1.0 - 0.24 * wetMask;
roughnessFactor = mix(roughnessFactor, max(0.13, roughnessFactor * 0.53), wetMask);
roughnessFactor = mix(roughnessFactor, 0.12, wetPuddle);
float wetGlint = 0.0;
if (uWetHigh > 0.5 && uWetAnimate > 0.5 && uWetRain > 0.01 && wetPuddle > 0.001) {
  vec2 cell = floor(vWetWorld.xz * 1.3), local = fract(vWetWorld.xz * 1.3) - 0.5;
  float seed = wetHash(cell), age = fract(uWeatherTime * 0.72 + seed);
  float radius = length(local), ring = exp(-abs(radius - age * 0.62) * 38.0) * (1.0 - age);
  float wave = sin(radius * 56.0 - age * 34.0) * ring;
  vec2 ripple = local / max(radius, 0.02) * wave * 0.035 * wetPuddle * uWetRain;
  normal = normalize(normal + mat3(viewMatrix) * vec3(ripple.x, 0.0, ripple.y));
  wetGlint = ring * pow(max(0.0, wave), 6.0) * step(0.78, seed) * uWetRain * 0.08;
}
`;
const reflection = `
if (wetPuddle > 0.001) {
  vec3 wetView = normalize(vViewPosition);
  vec3 wetRay = inverseTransformDirection(reflect(-wetView, normal), viewMatrix);
  float wetFresnel = pow(1.0 - clamp(dot(normal, wetView), 0.0, 1.0), 3.0);
  vec3 wetSky = mix(uWetHorizon, uWetSky, smoothstep(0.0, 0.7, wetRay.y));
  outgoingLight = mix(outgoingLight, wetSky, wetPuddle * (0.25 + 0.55 * wetFresnel));
  if (uWetNight > 0.01) {
    float wetLights = 0.0;
    // ponytail: four nearby lamps (two below high) bound fragment cost; expand only after measured reflection gaps.
    for (int i = 0; i < 4; i++) {
      if (uWetHigh < 0.5 && i >= 2) break;
      if (uWetLamps[i].y > 0.0) wetLights += wetStreak(uWetLamps[i], 0.17, 3.2);
    }
    outgoingLight += vec3(1.0, 0.54, 0.2) * min(wetLights, 1.5) * wetPuddle * uWetNight * 0.38;
    if (uWetBus.y > -1000.0) {
      vec2 side = vec2(-uWetHeading.y, uWetHeading.x) * 0.66;
      vec3 front = uWetBus + vec3(uWetHeading.x, 0.0, uWetHeading.y) * 4.0;
      float headlights = wetStreak(front + vec3(side.x, 0.0, side.y), 0.11, 2.0) + wetStreak(front - vec3(side.x, 0.0, side.y), 0.11, 2.0);
      outgoingLight += vec3(1.0, 0.89, 0.66) * headlights * wetPuddle * uWetNight * 0.22;
    }
  }
  outgoingLight += wetGlint * wetPuddle;
}
`;

function register(material) {
  let entry = registrations.get(material);
  if (entry) { entry.owners++; return entry; }
  const before = material.onBeforeCompile, key = material.customProgramCacheKey;
  const defaultKey = key === THREE.Material.prototype.customProgramCacheKey ? before.toString() : null;
  entry = { material, before, key, uniforms: uniforms(), owners: 1 };
  material.onBeforeCompile = function(shader, renderer) {
    before.call(this, shader, renderer);
    Object.assign(shader.uniforms, entry.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWetWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wetPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wetPosition = instanceMatrix * wetPosition;
        #endif
        vWetWorld = (modelMatrix * wetPosition).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + fragment)
      .replace('#include <lights_physical_fragment>', surface + '\n#include <lights_physical_fragment>')
      .replace('#include <opaque_fragment>', reflection + '\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = function() { return (defaultKey ?? key.call(this)) + '-wet-surfaces-v2'; };
  material.needsUpdate = true;
  registrations.set(material, entry);
  return entry;
}

export function createWetSurfaces(scene, { lamps = [], reducedMotion = false } = {}) {
  const state = uniforms(), materials = new Set(), entries = [];
  scene.traverse(object => {
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material?.isMeshStandardMaterial || material.userData.glow || material.emissiveMap || material.emissive?.getHex() || material.transparent) continue;
      if (material.name === 'slice-architecture' || colors.has('#' + material.color.getHexString())) materials.add(material);
    }
  });
  for (const material of materials) entries.push(register(material));
  const names = Object.keys(state), distance = new Float64Array(4);
  const activate = () => { for (const entry of entries) for (const name of names) entry.uniforms[name].value = state[name].value; };
  let sceneEntry = sceneRegistrations.get(scene);
  if (!sceneEntry) {
    sceneEntry = { before: scene.onBeforeRender, activate: new Set() };
    scene.onBeforeRender = function(renderer, renderedScene, camera, target) {
      sceneEntry.before.call(this, renderer, renderedScene, camera, target);
      for (const apply of sceneEntry.activate) apply();
    };
    sceneRegistrations.set(scene, sceneEntry);
  }
  sceneEntry.activate.add(activate);
  state.uWetAnimate.value = reducedMotion ? 0 : 1;
  let disposed = false;
  return {
    update(time, wet, rain, night, cameraPosition, mood, busPosition, heading, tier = 'high') {
      if (disposed) return;
      state.uWet.value = clamp(wet); state.uWetRain.value = clamp(rain); state.uWetNight.value = clamp(night);
      state.uWeatherTime.value = reducedMotion ? 0 : time; state.uWetHigh.value = tier === 'high' ? 1 : 0;
      const zen = mood?.zen, hor = mood?.hor;
      // Live sky colours are final HDR values; arrays are the standalone authored fallback.
      if(zen?.isColor&&hor?.isColor){
        state.uWetSky.value.copy(zen);state.uWetHorizon.value.copy(hor);
      }else{
        state.uWetSky.value.setRGB(...(zen || defaultZenith), THREE.SRGBColorSpace).lerp(nightZenith, state.uWetNight.value);
        state.uWetHorizon.value.setRGB(...(hor || defaultHorizon), THREE.SRGBColorSpace).lerp(nightHorizon, state.uWetNight.value);
        untone(state.uWetSky.value);untone(state.uWetHorizon.value);
      }
      if (busPosition) state.uWetBus.value.copy(busPosition); else state.uWetBus.value.set(0, -10000, 0);
      // ponytail: headlight streaks approximate the bus front without beam occlusion; revisit only if scene reflections are introduced.
      if (typeof heading === 'number') state.uWetHeading.value.set(Math.cos(heading), -Math.sin(heading));
      else if (heading) state.uWetHeading.value.set(heading.x, heading.z ?? heading.y).normalize();
      distance.fill(Infinity);
      const nearest = state.uWetLamps.value, cx = cameraPosition?.x ?? 0, cz = cameraPosition?.z ?? 0;
      for (const position of nearest) position.set(0, -10000, 0);
      for (const lamp of lamps) {
        const x = lamp.x ?? lamp[0], z = lamp.z ?? lamp[lamp.length === 3 ? 2 : 1], y = lamp.y ?? (lamp.length === 3 ? lamp[1] : 4);
        const d = (x - cx) ** 2 + (z - cz) ** 2;
        let i = 3;
        if (d >= distance[i]) continue;
        while (i > 0 && d < distance[i - 1]) { distance[i] = distance[i - 1]; nearest[i].copy(nearest[i - 1]); i--; }
        distance[i] = d; nearest[i].set(x, y, z);
      }
      activate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sceneEntry.activate.delete(activate);
      if (!sceneEntry.activate.size) { scene.onBeforeRender = sceneEntry.before; sceneRegistrations.delete(scene); }
      for (const entry of entries) {
        if (--entry.owners) continue;
        entry.material.onBeforeCompile = entry.before;
        entry.material.customProgramCacheKey = entry.key;
        entry.material.needsUpdate = true;
        registrations.delete(entry.material);
      }
      entries.length = 0; materials.clear();
    },
  };
}
