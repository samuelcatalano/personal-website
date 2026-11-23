import * as THREE from 'three';
import { untone } from './sky.js';
// Three unfogged silhouette batches, alpha-blended over the sky already drawn behind them (dome, clouds, deck), so the far city has aerial depth and no cut-out against the sky or the clouds.
const DAY = ['#4f6680', '#5c7590', '#6a83a0'].map((c) => new THREE.Color(c)), NIGHT = ['#0a1226', '#0e1832', '#142040'].map((c) => new THREE.Color(c));
const AIR = [0.6, 0.68, 0.76]; // share of sky per row, near to far; the band in front is darker slate (scene.js), so depth reads by tone even where its fog reaches the 0.72 cap
const SKY_KEYS = ['uZen', 'uMid', 'uHor', 'uGlow', 'uSunDir', 'uClear', 'uCover'];
export function createSkyline(list) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), m = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  const tones = [new THREE.Color(0.9, 0.92, 0.94), new THREE.Color(1, 1, 1)];
  const skyNight = { value: 0 }; // shared night strength for the lit windows
  const skyU = { uZen: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uClear: { value: 1 }, uCover: { value: 0 } };
  const rows = [0, 1, 2].map((r) => {
    const boxes = list.filter((b) => b.color[3] === String(r)), mat = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false });
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, skyU);
      shader.uniforms.uAir = { value: AIR[r] };
      shader.uniforms.uSkyNight = skyNight; shader.uniforms.uHaze = { value: r * 0.5 }; // 0, .5, 1
      shader.vertexShader = 'varying vec3 vSkyWorld;\nvarying float vSkyDist;\nvarying vec3 vSkyN;\nvarying float vSkyTone;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkyWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;\nvSkyDist = distance(cameraPosition, vSkyWorld);\nvSkyN = normalize(mat3(modelMatrix * instanceMatrix) * normal);\nvSkyTone = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);');
      shader.fragmentShader = 'uniform vec3 uSunDir; uniform float uCover, uClear;\nuniform float uAir; uniform float uHaze; uniform float uSkyNight; varying vec3 vSkyWorld; varying float vSkyDist; varying vec3 vSkyN; varying float vSkyTone;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb / max(vColor, vec3(0.01)) * 0.95, uHaze * 0.7); // farther rows flatten their base/top instance tones
diffuseColor.rgb *= 0.9 + 0.2 * vSkyTone; // per-building value spread (one hash per instance position, so no 13 m stripes) so overlapping masses separate
// Soft sun-side modelling (no flat cut-outs): faces toward the sun's azimuth lift, roofs lift a little; overcast flattens it.
vec2 skySunXZ = normalize(uSunDir.xz + vec2(1e-4));
diffuseColor.rgb *= 1.0 + (0.1 * dot(vSkyN.xz, skySunXZ) + 0.06 * vSkyN.y) * (1.0 - uCover);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.55 * uCover); // grey under a deck
// Aerial perspective toward what is really behind this pixel (dome, clouds or deck): the colour pass blends over them with alpha = 1 - air,
// so cloud edges continue through the silhouettes instead of being cut by a dome-only colour. Bases sink further into the low haze.
float skyAir = uAir + (1.0 - uAir) * max(0.55 * (1.0 - smoothstep(0.0, 45.0, vSkyWorld.y)), 0.45 * uCover); // overcast: thicker air keeps the band from reading darker than the deck
skyAir *= mix(1.0, smoothstep(0.0009, 0.0016, 1.0 - dot(normalize(vSkyWorld - cameraPosition), uSunDir)), uSkyNight * uClear); // opaque in front of a visible moon disc (~0.04 rad): no moon through the buildings; by day the sun glow through the haze is wanted
skyAir *= 1.0 - 0.4 * uSkyNight; // night: dark masses must hold against the dark sky (and keep stars and moon from showing through)
diffuseColor.rgb *= 1.0 - skyAir; diffuseColor.a = 1.0 - skyAir; // premultiplied
diffuseColor.rgb += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0; // interleaved-gradient dither against banding
// Lit windows at night: 4.2 m bays and 3.4 m floors; per-building lit ratio (10-60%), dark floors and two tints from stable hashes of position; faded out past ~800 m.
float skyU = (vSkyWorld.x + vSkyWorld.z) / 4.2, skyV = vSkyWorld.y / 3.4;
vec2 skyCell = floor(vec2(skyU, skyV)), skyF = fract(vec2(skyU, skyV));
float skyHash = fract(sin(dot(skyCell, vec2(127.1, 311.7))) * 43758.5453);
float skyBld = fract(sin(floor((vSkyWorld.x + vSkyWorld.z) / 13.0) * 12.9898 + 4.1) * 43758.5453); // ponytail: ~13 m column approximates one building, no per-instance id
float skyFloor = fract(sin(dot(vec2(skyBld * 91.0, skyCell.y), vec2(269.5, 183.3))) * 43758.5453);
float skyTint = fract(skyHash * 7.13 + skyBld);
float skyRatio = 0.05 + 0.25 * skyBld;
float skyWin = step(0.3, skyF.x) * step(skyF.x, 0.7) * step(0.3, skyF.y) * step(skyF.y, 0.75) * step(skyHash, skyRatio) * step(0.22, skyFloor);
float skyFade = 1.0 - smoothstep(700.0, 1100.0, vSkyDist); // at 500 m a 4.2 m bay is ~20 px, so the windows survive well past the first fade range
vec3 skyLit = mix(vec3(1.0, 0.82, 0.45), vec3(0.8, 0.9, 1.0), step(0.7, skyTint));
diffuseColor.rgb += skyLit * skyWin * skyFade * uSkyNight * (0.6 + 0.4 * skyHash) * 0.5;`);    };
    mat.customProgramCacheKey = () => 'skyline-haze-v8';
    // Drawn in the transparent list after the raymarched cloud volume (-7), so the dome and clouds are already in the frame behind it.
    // A depth-only prepass of the same instances (-5.5) keeps only the front face of overlapping boxes, so nothing blends twice.
    Object.assign(mat, { transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => { mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d))); mesh.setColorAt(i, tones[b.color.endsWith('t') ? 1 : 0]); });
    const depth = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }) /* pushed back a hair so the colour pass never z-fights its own prepass */, boxes.length);
    depth.instanceMatrix = mesh.instanceMatrix; depth.renderOrder = -5.5; mesh.renderOrder = -5;
    for (const o of [mesh, depth]) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; }
    mesh.add(depth); // child, so the group keeps its three row batches
    g.add(mesh); return mat;
  });
  g.name = 'distant-skyline';
  // sky: the dome uniforms from createSky (sky.uniforms). Without it (tests, first frame) the silhouettes fall back to their own colour as the sky.
  g.userData.update = (night, sky) => {
    skyNight.value = night;
    rows.forEach((mat, r) => untone(mat.color.lerpColors(DAY[r], NIGHT[r], night)));
    if (sky) for (const k of SKY_KEYS) { const v = sky[k].value; if (typeof v === 'number') skyU[k].value = v; else skyU[k].value.copy(v); }
    else for (const k of ['uZen', 'uMid', 'uHor', 'uGlow']) skyU[k].value.copy(rows[2].color);
  };
  g.userData.update(0);
  return g;
}
