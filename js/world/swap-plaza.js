import * as THREE from 'three';
import { i18n } from '../content.js';
import { createPlantGeometry } from './plant-mesh.js';
// The plaza on the lid of the SP -> London tunnel (swap-tunnel.js): grey York stone flags kerb to kerb, a fingerpost in the middle (São Paulo one way,
// London the other; copy from content.js, redrawn when the language changes) and a street lamp beside it (city.js registers it with street-lamp.js).
// Local frame as swap-tunnel.js: x along the road (+ towards London), z across, y up.
const PX = 64; // canvas pixels per metre
function paving(half, kerb) {
  const W = Math.round(2 * half * PX), H = Math.round(2 * kerb * PX), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // York stone flags in courses of 0.6 m, random lengths, dark joints, over the whole plaza
  g.fillStyle = '#777269'; g.fillRect(0, 0, W, H);
  const tones = ['#b5ad9e', '#a9a294', '#bdb6a8', '#9e978a', '#b0a898'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y += 0.6 * PX) for (let x = -rnd() * 0.6 * PX; x < W;) {
    const l = (0.6 + rnd() * 0.6) * PX; g.fillStyle = tones[(rnd() * tones.length) | 0]; g.fillRect(x + 2, y + 2, l - 4, 0.6 * PX - 4); x += l;
  }
  for (const side of [-1, 1]) {
    const bx = W / 2 + side * (half - 1.15) * PX, by = H / 2;
    g.fillStyle = 'rgba(125,106,81,0.10)'; g.fillRect(bx - 0.9 * PX, by - 1.6 * PX, 1.8 * PX, 3.2 * PX);
    g.strokeStyle = '#c3b79f'; g.lineWidth = 0.055 * PX; g.strokeRect(bx - 0.9 * PX, by - 1.6 * PX, 1.8 * PX, 3.2 * PX);
    const px = W / 2 + side * (half - 1.05) * PX, pz = H / 2 + side * (kerb - 2.4) * PX;
    g.strokeRect(px - 0.68 * PX, pz - 1.08 * PX, 1.36 * PX, 2.16 * PX);
  }
  for (const side of [-1, 1]) {
    const x = W / 2 + side * 1.2 * PX, band = 0.36 * PX;
    g.fillStyle = '#91887d'; g.fillRect(x - band / 2, 0, band, H);
    g.fillStyle = '#777269';
    for (let y = 0.6 * PX; y < H; y += 0.6 * PX) g.fillRect(x - band / 2, y - 1, band, 2);
  }
  const routeY = H / 2, routeH = 0.11 * PX, routeX = 0.34 * PX;
  g.fillStyle = '#63778c'; g.fillRect(routeX, routeY - routeH / 2, W / 2 - routeX, routeH);
  g.fillStyle = '#a66c61'; g.fillRect(W / 2, routeY - routeH / 2, W / 2 - routeX, routeH);
  g.fillStyle = '#d8cbb5'; g.fillRect(W / 2 - 1.5, routeY - routeH / 2, 3, routeH);
  const cx = W / 2, cy = H / 2, medallion = 0.72 * PX, inlay = 0.5 * PX;
  g.fillStyle = '#b5ad9e'; g.beginPath(); g.arc(cx, cy, medallion, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#91887d'; g.lineWidth = 0.045 * PX; g.stroke();
  for (const [start, end, color] of [[Math.PI / 2, Math.PI * 1.5, '#63778c'], [-Math.PI / 2, Math.PI / 2, '#a66c61']]) {
    g.fillStyle = color; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, inlay, start, end); g.closePath(); g.fill();
  }
  g.strokeStyle = '#d8cbb5'; g.lineWidth = 0.025 * PX; g.beginPath(); g.arc(cx, cy, inlay, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e2dacb';
  for (const direction of [-1, 1]) {
    g.beginPath(); g.moveTo(cx + direction * 0.43 * PX, cy); g.lineTo(cx + direction * 0.29 * PX, cy - 0.09 * PX); g.lineTo(cx + direction * 0.29 * PX, cy + 0.09 * PX); g.closePath(); g.fill();
  }
  g.strokeStyle = '#c3b79f'; g.lineWidth = 0.07 * PX; g.strokeRect(0.36 * PX, 0.36 * PX, W - 0.72 * PX, H - 0.72 * PX);
  g.strokeStyle = '#91887d'; g.lineWidth = 0.24 * PX; g.strokeRect(0.14 * PX, 0.14 * PX, W - 0.28 * PX, H - 0.28 * PX);
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
  const iron = new THREE.MeshStandardMaterial({ color: '#34383d', roughness: 0.58, metalness: 0.45 }); mats.push(iron);
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
  const wood=new THREE.MeshStandardMaterial({color:'#80522f',roughness:.88});
  const stone=new THREE.MeshStandardMaterial({color:'#aaa392',roughness:.95});
  const leaf=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95});mats.push(wood,stone,leaf);
  const seats=[],legs=[],containers=[],soil=[],plants=[],batches=[],obstacles=[];
  for(const side of [-1,1]){
    const x=side*(half-1.15),z=side*(kerb-2.4),px=side*(half-1.05);
    for(let i=0;i<5;i++)seats.push([x+(i-2)*.12,.46,0,.095,.08,2.4]);
    for(let i=0;i<3;i++)seats.push([x+side*.32,.68+i*.13,0,.08,.085,2.4]);
    for(const end of [-.95,.95]){legs.push([x,.25,end,.5,.42,.08]);legs.push([x+side*.32,.70,end,.075,.55,.075]);legs.push([x+side*.16,.69,end,.32,.065,.08]);}
    containers.push([px,.05,z,1,.1,1.8]);
    for(const end of [-1,1]){containers.push([px+end*.44,.32,z,.12,.5,1.8]);containers.push([px,.32,z+end*.84,.76,.5,.12]);}
    soil.push([px,.52,z,.76,.04,1.56]);
    plants.push([px,.55,z,side<0?.84:.88,.68,side<0?1.35:1.28],[px+side*.04,.55,z-side*.38,.55,.54,.76]);
    obstacles.push({kind:'bench',rect:{x0:x-.4,x1:x+.4,z0:-1.25,z1:1.25}});
    obstacles.push({kind:'planter',rect:{x0:px-.5,x1:px+.5,z0:z-.9,z1:z+.9}});
  }
  const batch=(name,material,records,geometry=railGeo)=>{
    const mesh=new THREE.InstancedMesh(geometry,material,records.length);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
    records.forEach(([x,h,z,w,height,d],i)=>{member.position.set(x,y+h,z);member.scale.set(w,height,d);member.updateMatrix();mesh.setMatrixAt(i,member.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);batches.push(mesh);return mesh;
  };
  const woodBatch=batch('swap-plaza-benches-wood',wood,[...seats,...soil]);
  const plankColors=['#fff8ef','#f8ebd9','#fffdf9'].map(color=>new THREE.Color(color));
  seats.forEach((_,i)=>woodBatch.setColorAt(i,plankColors[i%plankColors.length]));
  soil.forEach((_,i)=>woodBatch.setColorAt(seats.length+i,new THREE.Color(.35,.3,.25)));
  woodBatch.instanceColor.needsUpdate=true;
  batch('swap-plaza-benches-iron',iron,legs);batch('swap-plaza-planters',stone,containers);
  const grass=createPlantGeometry('grass');geos.push(grass);batch('swap-plaza-planting',leaf,plants,grass);
  group.userData.obstacles=obstacles;
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
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 160;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texs.push(t);
      const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); mats.push(mat);
      return { right, ctx: cv.getContext('2d'), t, mat };
    });
    const edge = new THREE.MeshStandardMaterial({ color: b.rim, roughness: 0.6 }); mats.push(edge);
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z; text on +-z (across the road), the blade's +x end points at its city (turned round for the west blade)
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.54, 0.05), [edge, edge, edge, edge, faces[0].mat, faces[1].mat]);
    m.position.set(b.dir * 1.17, y + b.h, 0); if (b.dir < 0) m.rotation.y = Math.PI; m.castShadow = true; group.add(m); geos.push(m.geometry);
    return { ...b, faces };
  });
  const paint = () => {
    const s = i18n[lang()].ui.signpost;
    for (const b of blades) for (const f of b.faces) { blade(f.ctx, s[b.key], s.km, b.bg, b.fg, b.rim, f.right); f.t.needsUpdate = true; }
  };
  paint();
  const watch = new MutationObserver(paint); watch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return { group, dispose() { watch.disconnect(); rails.dispose(); batches.forEach(m=>m.dispose()); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose()); } };
}
