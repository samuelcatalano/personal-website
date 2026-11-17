import * as THREE from 'three';
import { untone } from './sky.js';
// Three unfogged silhouette batches; a local height fade joins their bases to the live horizon without a second fog application.
const DAY = ['#647c96', '#7690a8', '#8aa2b9'].map((c) => new THREE.Color(c)), NIGHT = ['#0a1226', '#0e1832', '#142040'].map((c) => new THREE.Color(c));
export function createSkyline(list) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), m = new THREE.Matrix4(), s = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  const tones = [new THREE.Color(0.9, 0.92, 0.94), new THREE.Color(1, 1, 1)];
  const skyNight = { value: 0 }; // shared night strength for the lit windows
  const rows = [0, 1, 2].map((r) => {
    const boxes = list.filter((b) => b.color[3] === String(r)), mat = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false });
    const horizon = mat.userData.horizon = { value: new THREE.Color() };
    mat.onBeforeCompile = shader => {
      shader.uniforms.uHorizon = horizon;
      shader.uniforms.uSilhouette = { value: 0.86 - r * 0.16 }; // stays darker than the sky so far towers never read as pale cloud blocks
      shader.uniforms.uSkyNight = skyNight; shader.uniforms.uHaze = { value: r * 0.5 }; // 0, .5, 1
      shader.vertexShader = 'varying float vSkyHeight;\nvarying vec3 vSkyWorld;\nvarying float vSkyDist;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkyHeight = position.y;\nvSkyWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;\nvSkyDist = distance(cameraPosition, vSkyWorld);');
      shader.fragmentShader = 'uniform vec3 uHorizon; uniform float uSilhouette; uniform float uHaze; uniform float uSkyNight; varying float vSkyHeight; varying vec3 vSkyWorld; varying float vSkyDist;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
// Aerial perspective: farther rows pull base/top tones together (less contrast) and sit closer to the horizon colour.
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb / max(vColor, vec3(0.01)) * 0.95, uHaze * 0.7); // flatten base/top instance tones
// World height, not per-box height: stacked tiers and crowns must not each restart at the horizon colour (that striped them into pale cloud-like blocks).
diffuseColor.rgb = mix(uHorizon, diffuseColor.rgb, smoothstep(0.0, 16.0, vSkyWorld.y) * uSilhouette);
// Lit windows at night: 4.2 m bays and 3.4 m floors; per-building lit ratio (10-60%), dark floors and two tints from stable hashes of position; faded out past ~800 m.
float skyU = (vSkyWorld.x + vSkyWorld.z) / 4.2, skyV = vSkyWorld.y / 3.4;
vec2 skyCell = floor(vec2(skyU, skyV)), skyF = fract(vec2(skyU, skyV));
float skyHash = fract(sin(dot(skyCell, vec2(127.1, 311.7))) * 43758.5453);
float skyBld = fract(sin(floor((vSkyWorld.x + vSkyWorld.z) / 13.0) * 12.9898 + 4.1) * 43758.5453); // ponytail: ~13 m column approximates one building, no per-instance id
float skyFloor = fract(sin(dot(vec2(skyBld * 91.0, skyCell.y), vec2(269.5, 183.3))) * 43758.5453);
float skyTint = fract(skyHash * 7.13 + skyBld);
float skyRatio = 0.1 + 0.5 * skyBld;
float skyWin = step(0.3, skyF.x) * step(skyF.x, 0.7) * step(0.3, skyF.y) * step(skyF.y, 0.75) * step(skyHash, skyRatio) * step(0.22, skyFloor);
float skyFade = 1.0 - smoothstep(700.0, 1100.0, vSkyDist); // at 500 m a 4.2 m bay is ~20 px, so the windows survive well past the first fade range
vec3 skyLit = mix(vec3(1.0, 0.82, 0.45), vec3(0.8, 0.9, 1.0), step(0.7, skyTint));
diffuseColor.rgb += skyLit * skyWin * skyFade * uSkyNight * (0.6 + 0.4 * skyHash) * 0.5;`);    };
    mat.customProgramCacheKey = () => 'skyline-haze-v4';
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => { mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d))); mesh.setColorAt(i, tones[b.color.endsWith('t') ? 1 : 0]); });
    mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
    g.add(mesh); return mat;
  });
  g.name = 'distant-skyline';
  g.userData.update = (night, horizon) => rows.forEach((mat, r) => {
    untone(mat.color.lerpColors(DAY[r], NIGHT[r], night)); skyNight.value = night;
    mat.userData.horizon.value.copy(horizon ?? mat.color);
  });
  g.userData.update(0);
  return g;
}
