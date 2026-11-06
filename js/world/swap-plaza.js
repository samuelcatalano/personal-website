import * as THREE from 'three';
import { i18n } from '../content.js';
// The plaza on the lid of the SP -> London tunnel (swap-tunnel.js): grey York stone flags kerb to kerb, a fingerpost in the middle (São Paulo one way,
// London the other; copy from content.js, redrawn when the language changes) and a street lamp beside it (city.js registers it with street-lamp.js).
// Local frame as swap-tunnel.js: x along the road (+ towards London), z across, y up.
const PX = 64; // canvas pixels per metre
function paving(half, kerb) {
  const W = Math.round(2 * half * PX), H = Math.round(2 * kerb * PX), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // York stone flags in courses of 0.6 m, random lengths, dark joints, over the whole plaza
  g.fillStyle = '#6d675e'; g.fillRect(0, 0, W, H);
  const tones = ['#b5ad9e', '#a9a294', '#bdb6a8', '#9e978a', '#b0a898'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y += 0.6 * PX) for (let x = -rnd() * 0.6 * PX; x < W;) {
    const l = (0.6 + rnd() * 0.6) * PX; g.fillStyle = tones[(rnd() * tones.length) | 0]; g.fillRect(x + 2, y + 2, l - 4, 0.6 * PX - 4); x += l;
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
// One face of a fingerpost blade: the city on a coloured plate with an arrow at the pointing end (canvas right, or left for the back face, which is
// seen mirrored along the blade: text still reads left to right, the arrow still points at the city)
function blade(ctx, text, km, bg, fg, rim, right) {
  const { width: W, height: H } = ctx.canvas, a = H / 2, x0 = right ? 8 : a, x1 = right ? W - a : W - 8, tip = right ? W - 8 : 8;
  ctx.fillStyle = rim; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x0, 8); ctx.lineTo(x1, 8);
  if (right) { ctx.lineTo(tip, H / 2); ctx.lineTo(x1, H - 8); ctx.lineTo(x0, H - 8); } else { ctx.lineTo(x1, H - 8); ctx.lineTo(x0, H - 8); ctx.lineTo(tip, H / 2); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle';
  const left = right ? 26 : a + 10;
  ctx.font = `700 ${Math.round(H * 0.42)}px "Helvetica Neue", Arial, sans-serif`; ctx.fillText(text.toUpperCase(), left, H * 0.4);
  ctx.font = `500 ${Math.round(H * 0.26)}px "Helvetica Neue", Arial, sans-serif`; ctx.fillText(km, left + 2, H * 0.76);
}
const lang = () => (document.documentElement.lang || 'en').startsWith('pt') ? 'pt' : 'en';
export function buildSwapPlaza({ half, kerb, y }) {
  const group = new THREE.Group(); group.name = 'swap-plaza';
  const tex = paving(half, kerb), geos = [], mats = [], texs = [tex];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * kerb).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  floor.position.y = y; floor.receiveShadow = true; group.add(floor); geos.push(floor.geometry); mats.push(floor.material);
  // fingerpost in the middle: iron post crowned by a heritage lantern (its glass glows at night through sky.js's glow loop; the light pool is
  // registered by city.js), two blades (west: São Paulo, east: London)
  const iron = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.5, metalness: 0.6 }); mats.push(iron);
  // One batch for both portal edges; inset onto the coping so the sidewalk approaches stay open.
  const railLength = 2 * kerb - 0.1, barGaps = Math.ceil(railLength / 0.135), postGaps = Math.ceil(railLength / 2);
  const railGeo = new THREE.BoxGeometry(1, 1, 1), railCount = 2 * (barGaps + postGaps + 2);
  const rails = new THREE.InstancedMesh(railGeo, iron, railCount), member = new THREE.Object3D();
  rails.name = 'swap-plaza-guardrails'; rails.castShadow = true; rails.receiveShadow = true;
  let railIndex = 0;
  const addRailMember = (x, h, z, w, height, depth) => {
    member.position.set(x, y + h, z); member.scale.set(w, height, depth); member.updateMatrix();
    rails.setMatrixAt(railIndex++, member.matrix);
  };
  for (const side of [-1, 1]) {
    const x = side * (half - 0.1);
    addRailMember(x, 1.065, 0, 0.08, 0.07, 2 * kerb);
    addRailMember(x, 0.13, 0, 0.06, 0.05, railLength);
    for (let i = 0; i <= postGaps; i++) addRailMember(x, 0.55, -railLength / 2 + i * railLength / postGaps, 0.08, 1.1, 0.1);
    for (let i = 1; i < barGaps; i++) addRailMember(x, 0.5825, -railLength / 2 + i * railLength / barGaps, 0.035, 0.895, 0.035);
  }
  rails.instanceMatrix.needsUpdate = true; rails.computeBoundingBox(); rails.computeBoundingSphere();
  group.add(rails); geos.push(railGeo);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.3, 12).translate(0, 1.65, 0), iron);
  const glass = new THREE.MeshStandardMaterial({ color: '#fff1c8', roughness: 0.25 }); mats.push(glass);
  Object.assign(glass.userData, { glow: true, glowColor: new THREE.Color('#ffcf7a'), glowK: 2.4 });
  const lantern = [ // collar, glass body, iron corner posts, roof and finial, all on top of the post (3.3 m)
    new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.12, 12).translate(0, 3.36, 0), iron),
    new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.5, 4, 1).rotateY(Math.PI / 4).translate(0, 3.67, 0), glass),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.03).translate(0.13 * a, 3.67, 0.13 * b), iron)),
    new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.22, 4).rotateY(Math.PI / 4).translate(0, 4.03, 0), iron),
    new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).translate(0, 4.17, 0), iron),
  ];
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 16).translate(0, 0.1, 0), iron);
  for (const m of [post, base, ...lantern]) { m.position.y = y; m.castShadow = true; group.add(m); geos.push(m.geometry); }
  const blades = [
    { key: 'saoPaulo', dir: -1, h: 2.85, bg: '#1f4e8c', fg: '#ffffff', rim: '#f4f1ea' }, // São Paulo street-plate blue
    { key: 'london', dir: 1, h: 2.45, bg: '#f4f1ea', fg: '#1a1a1a', rim: '#c8102e' }, // London street-name white, red rim
  ].map((b) => {
    const faces = [true, false].map((right) => { // front (+z, arrow right) and back (-z, arrow left)
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texs.push(t);
      const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); mats.push(mat);
      return { right, ctx: cv.getContext('2d'), t, mat };
    });
    const edge = new THREE.MeshStandardMaterial({ color: b.rim, roughness: 0.6 }); mats.push(edge);
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z; text on +-z (across the road), the blade's +x end points at its city (turned round for the west blade)
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.05), [edge, edge, edge, edge, faces[0].mat, faces[1].mat]);
    m.position.set(b.dir * 0.88, y + b.h, 0); if (b.dir < 0) m.rotation.y = Math.PI; m.castShadow = true; group.add(m); geos.push(m.geometry);
    return { ...b, faces };
  });
  const paint = () => {
    const s = i18n[lang()].ui.signpost;
    for (const b of blades) for (const f of b.faces) { blade(f.ctx, s[b.key], s.km, b.bg, b.fg, b.rim, f.right); f.t.needsUpdate = true; }
  };
  paint();
  const watch = new MutationObserver(paint); watch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return { group, dispose() { watch.disconnect(); rails.dispose(); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose()); } };
}
