import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { untone } from './sky.js';
import { coverShader, coverUniforms } from './weather-cover.js';
import { weatherGust } from './weather.js';

const registrations = new WeakMap();
const sceneRegistrations = new WeakMap();
const colors = new Set([P.road, P.pave, P.roof, P.stone, P.gravel, P.concrete, P.slate, P.concreteDark, P.concreteMid]);
const nightZenith = new THREE.Color('#0b1530'), nightHorizon = new THREE.Color('#1d2b4f');
const defaultZenith = [0.435, 0.694, 0.91], defaultHorizon = [0.725, 0.863, 0.961];
const clamp = n => Math.max(0, Math.min(1, n));
function uniforms() {
  return {
    ...coverUniforms(),
    uWet: { value: 0 }, uWeatherTime: { value: 0 }, uWetRain: { value: 0 }, uWetNight: { value: 0 },
    uWetAnimate: { value: 1 }, uWetHigh: { value: 1 }, uWetWind: { value: new THREE.Vector2() },
    uWetSky: { value: new THREE.Color('#6fb1e8') }, uWetHorizon: { value: new THREE.Color('#b9dcf5') },
    uWetLamps: { value: Array.from({ length: 4 }, () => new THREE.Vector3(0, -10000, 0)) },
    uWetKerbs: { value: Array.from({ length: 4 }, () => new THREE.Vector4(1e6, 1e6, 1e6, 1e6)) },
    uWetKerbWeights: { value: new THREE.Vector4() },
    uWetBus: { value: new THREE.Vector3(0, -10000, 0) }, uWetHeading: { value: new THREE.Vector2(1, 0) },
    uWetReflection: { value: null }, uWetProjection: { value: new THREE.Matrix4() }, uWetReflect: { value: 0 },
  };
}

const fragment = `
${coverShader}
uniform float uWet, uWeatherTime, uWetRain, uWetNight, uWetAnimate, uWetHigh;
uniform vec3 uWetSky, uWetHorizon, uWetLamps[4], uWetBus;
uniform vec2 uWetHeading, uWetWind;
uniform vec4 uWetKerbs[4];
uniform vec4 uWetKerbWeights;
uniform sampler2D uWetReflection;
uniform mat4 uWetProjection;
uniform float uWetReflect;
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
float wetExposed = 1.0;
float wetPuddle = 0.0, wetRoad = 0.0;
// ponytail: ground-level puddles stay off shared roof faces; add surface tags if elevated decks need puddles.
if (wetMask > 0.001 && vWetWorld.y < 0.4) {
  wetExposed = 1.0 - step(vWetWorld.y + .6, weatherRoof(vWetWorld.xz));
  float wetPatch = smoothstep(.18, .82, wetNoise(vWetWorld.xz * .19) + wetNoise(vWetWorld.xz * .73) * .22);
  wetMask *= mix(.28, 1.0, wetPatch) * mix(.15, 1.0, wetExposed);
  // Dark base colour = asphalt; light = pavement. Pools cluster in low-frequency basins and stay small with feathered edges.
  wetRoad = 1.0 - smoothstep(0.16, 0.30, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
  float basin = wetNoise(vWetWorld.xz * 0.09 + 7.0);
  // shortcut: procedural basins approximate uneven paving; authored drainage masks are needed for exact water flow.
  vec2 basinWarp = vec2(basin, wetNoise(vWetWorld.zx * .13 + 19.0)) - .5;
  vec2 poolPosition = vWetWorld.xz + basinWarp * 1.4;
  float pool = wetNoise(poolPosition * .42) * .72 + wetNoise(poolPosition * 1.1) * .20 + wetNoise(poolPosition * 3.7) * .08;
  float edge = mix(.86, .74, wetRoad) + .10 * (1.0 - uWet) - .08 * smoothstep(.45, .8, basin);
  float kerbInfluence = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 segment = uWetKerbs[i].zw - uWetKerbs[i].xy, delta = vWetWorld.xz - uWetKerbs[i].xy;
    float along = clamp(dot(delta, segment) / max(dot(segment, segment), .001), 0.0, 1.0);
    kerbInfluence = max(kerbInfluence, (1.0 - smoothstep(.12, .65, length(delta - segment * along))) * uWetKerbWeights[i]);
  }
  edge -= .10 * kerbInfluence * (.35 + .65 * wetNoise(poolPosition * .9));
  wetPuddle = wetMask * smoothstep(edge, edge + .16, pool) * (.3 + .7 * wetRoad) * wetExposed;
}
diffuseColor.rgb *= 1.0 - 0.30 * wetMask * (0.5 + 0.5 * mix(0.4, 1.0, wetNoise(vWetWorld.xz * 0.3)));
float wetRoughness = mix(max(.42, roughnessFactor * .75), max(.34, roughnessFactor * .58), wetRoad);
roughnessFactor = mix(roughnessFactor, wetRoughness, wetMask);
roughnessFactor = mix(roughnessFactor, .16, wetPuddle);
float wetGlint = 0.0;
vec2 wetRipple = vec2(0.0);
if (uWetHigh > 0.5 && uWetAnimate > 0.5 && uWetRain > 0.01 && wetMask > 0.001 && vWetWorld.y < .4 && wetExposed > .5) {
  vec2 cell = floor(vWetWorld.xz * 1.3);
  float seed = wetHash(cell), clock = uWeatherTime * (.65 + seed * .55) + seed, eventIndex = floor(clock), age = fract(clock);
  vec2 center = .25 + .5 * vec2(wetHash(cell + eventIndex * 7.1), wetHash(cell.yx + eventIndex * 3.7 + 21.0));
  vec2 cellUv = fract(vWetWorld.xz * 1.3);
  float cellFade = smoothstep(0.0, .05, min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y)));
  vec2 local = cellUv - center - uWetWind * age * .025;
  float radius = length(local), impactActive = step(1.0 - uWetRain * .65, wetHash(cell + eventIndex + 43.0));
  float ring = exp(-abs(radius - age * .24) * 75.0) * (1.0 - age) * impactActive * cellFade;
  float wave = sin(radius * 70.0 - age * 24.0) * ring;
  vec2 ripple = local / max(radius, .02) * wave * .025 * wetPuddle;
  normal = normalize(normal + mat3(viewMatrix) * vec3(ripple.x, 0.0, ripple.y));
  wetRipple = ripple;
  float contact = exp(-radius * radius * 380.0) * exp(-age * 24.0) * impactActive * cellFade;
  wetGlint = (contact * .035 + ring * wetPuddle * .016) * wetMask * uWetRain;
}
`;
const reflection = `
if (wetMask > 0.001 && (wetPuddle > 0.001 || wetRoad > 0.001)) {
  vec3 wetView = normalize(vViewPosition);
  vec3 wetRay = inverseTransformDirection(reflect(-wetView, normal), viewMatrix);
  float wetFresnel = pow(1.0 - clamp(dot(normal, wetView), 0.0, 1.0), 3.0);
  vec3 wetSky = mix(uWetHorizon, uWetSky, smoothstep(0.0, 0.7, wetRay.y));
  vec4 wetCoord = uWetProjection * vec4(vWetWorld, 1.0);
  vec2 wetUv = wetCoord.xy / max(wetCoord.w, 0.001) + wetRipple * .025;
  if (uWetReflect > 0.5 && wetCoord.w > 0.0 && all(greaterThanEqual(wetUv, vec2(0.0))) && all(lessThanEqual(wetUv, vec2(1.0)))) {
    vec4 reflected = texture2D(uWetReflection, wetUv);
    wetSky = mix(wetSky, reflected.rgb, reflected.a * smoothstep(.08, .65, wetPuddle));
  }
  float reflectionAmount = wetMask * wetRoad * (.015 + .035 * wetFresnel) + wetPuddle * (.10 + .18 * wetFresnel); // broad sheen subdued (doc 2026-11-16); pools keep their sharper reflection
  outgoingLight = mix(outgoingLight, wetSky, clamp(reflectionAmount, 0.0, 0.5));
  if (uWetNight > 0.01) {
    float wetLights = 0.0;
    // ponytail: four nearby lamps (two below high) bound fragment cost; expand only after measured reflection gaps.
    for (int i = 0; i < 4; i++) {
      if (uWetHigh < 0.5 && i >= 2) break;
      if (uWetLamps[i].y > 0.0) wetLights += wetStreak(uWetLamps[i], mix(.42, .17, wetPuddle), 3.2);
    }
    outgoingLight += vec3(1.0, 0.64, 0.35) * min(wetLights, 1.5) * (wetPuddle + wetMask * wetRoad * .06) * uWetNight * .30;
    if (uWetBus.y > -1000.0) {
      vec2 side = vec2(-uWetHeading.y, uWetHeading.x) * 0.66;
      vec3 front = uWetBus + vec3(uWetHeading.x, 0.0, uWetHeading.y) * 4.0;
      float headlights = wetStreak(front + vec3(side.x, 0.0, side.y), 0.11, 2.0) + wetStreak(front - vec3(side.x, 0.0, side.y), 0.11, 2.0);
      outgoingLight += vec3(1.0, 0.89, 0.66) * headlights * wetPuddle * uWetNight * 0.22;
    }
  }
}
outgoingLight += wetGlint;
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
  material.customProgramCacheKey = function() { return (defaultKey ?? key.call(this)) + '-wet-surfaces-v5'; };
  material.needsUpdate = true;
  registrations.set(material, entry);
  return entry;
}

// ponytail: a layer of its own, so puddles never pick up layer 5, which water.js switches on for the river landmarks.
export const WET_REFLECT_LAYER = 6;

export function createWetSurfaces(scene, { lamps = [], kerbs = [], reducedMotion = false, cover, reflectRoots = [] } = {}) {
  const state = uniforms(), materials = new Set(), entries = [];
  Object.assign(state, coverUniforms(cover));
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const mirror = new THREE.PerspectiveCamera(), rotation = new THREE.Matrix4(), size = new THREE.Vector2();
  const normal = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3(), look = new THREE.Vector3(), reflectedLook = new THREE.Vector3();
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4(), clear = new THREE.Color();
  const bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
  state.uWetReflection.value = target.texture;
  let tagFrame = 0;
  // Puddles mirror only the hero vehicles and the scene's lights: the rest of the city, which the old whole-scene pass drew, is left out.
  const tag = () => {
    for (const root of reflectRoots) root?.traverse(o => o.layers.enable(WET_REFLECT_LAYER));
    for (const light of scene.children) if (light.isLight) light.layers.enable(WET_REFLECT_LAYER);
  };
  scene.traverse(object => {
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material?.isMeshStandardMaterial || material.emissiveMap || material.transparent) continue;
      const hex = '#' + material.color.getHexString(), road = hex === P.road; // road materials carry the night glow path: they still get puddles and the vehicle reflection
      if (!road && (material.userData.glow || material.emissive?.getHex())) continue;
      if (material.name === 'slice-architecture' || colors.has(hex)) materials.add(material);
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
    reflect(renderer, camera, tier, skyObjects = []) {
      // WebGL rejects framebuffer feedback even behind a uniform-disabled shader branch.
      state.uWetReflection.value = null; state.uWetReflect.value = 0; activate();
      if (disposed || state.uWet.value < 0.01 || camera.position.y <= 0.1) return;
      renderer.getDrawingBufferSize(size);
      const scale = tier === 'high' ? 0.5 : 0.25;
      const width = Math.max(1, Math.round(size.x * scale)), height = Math.max(1, Math.round(size.y * scale));
      if (target.width !== width || target.height !== height) target.setSize(width, height);
      const y = 0.07;
      rotation.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rotation).add(camera.position);
      mirror.position.set(camera.position.x, 2 * y - camera.position.y, camera.position.z);
      reflectedLook.set(look.x, 2 * y - look.y, look.z);
      mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
      mirror.lookAt(reflectedLook); mirror.far = camera.far; mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      mirror.projectionMatrix.elements[8] *= -1;
      state.uWetProjection.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      plane.setFromNormalAndCoplanarPoint(normal, origin.set(0, y, 0)).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const e = mirror.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
      if (tagFrame++ % 120 === 0) tag(); // hero models finish loading late: re-tag every ~2 s, as water.js does for the river
      mirror.layers.set(WET_REFLECT_LAYER);
      const previous = renderer.getRenderTarget(), alpha = renderer.getClearAlpha(), background = scene.background, auto = renderer.shadowMap.autoUpdate;
      renderer.getClearColor(clear);
      const visible = skyObjects.map(o => o.visible);
      try {
        skyObjects.forEach(o => { o.visible = false; });
        scene.background = null; renderer.shadowMap.autoUpdate = false;
        renderer.setClearColor(0, 0); renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, mirror);
      } finally {
        renderer.setRenderTarget(previous); renderer.setClearColor(clear, alpha);
        state.uWetReflection.value = target.texture;
        renderer.shadowMap.autoUpdate = auto; scene.background = background;
        skyObjects.forEach((o, i) => { o.visible = visible[i]; });
      }
      state.uWetReflect.value = 1; activate();
    },
    update(time, wet, rain, night, cameraPosition, mood, busPosition, heading, tier = 'high', wind = 1) {
      if (disposed) return;
      state.uWet.value = clamp(wet); state.uWetRain.value = clamp(rain); state.uWetNight.value = clamp(night);
      state.uWeatherTime.value = reducedMotion ? 0 : time; state.uWetHigh.value = tier === 'high' ? 1 : 0;
      const gust = weatherGust(time, wind);
      state.uWetWind.value.set(reducedMotion ? 0 : gust.x, reducedMotion ? 0 : gust.z);
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
      distance.fill(Infinity);
      const nearestKerbs = state.uWetKerbs.value;
      for (const segment of nearestKerbs) segment.set(1e6, 1e6, 1e6, 1e6);
      for (const [x0, z0, x1, z1] of kerbs) {
        const dx = x1 - x0, dz = z1 - z0;
        const along = clamp(((cx - x0) * dx + (cz - z0) * dz) / Math.max(dx * dx + dz * dz, .001));
        const d = (x0 + along * dx - cx) ** 2 + (z0 + along * dz - cz) ** 2;
        let i = 3;
        if (d >= distance[i]) continue;
        while (i > 0 && d < distance[i - 1]) { distance[i] = distance[i - 1]; nearestKerbs[i].copy(nearestKerbs[i - 1]); i--; }
        distance[i] = d; nearestKerbs[i].set(x0, z0, x1, z1);
      }
      // Fade the outer candidate to zero so replacing it cannot pop distant pools.
      const cutoff = Math.max(.001, Math.sqrt(distance[3]));
      for (let i = 0; i < 4; i++) {
        const fade = kerbs.length > 4 ? clamp((Math.sqrt(distance[i]) - .85 * cutoff) / (.15 * cutoff)) : 0;
        state.uWetKerbWeights.value.setComponent(i, Number.isFinite(distance[i]) ? 1 - fade * fade * (3 - 2 * fade) : 0);
      }
      activate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
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
