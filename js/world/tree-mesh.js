import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Tree family. Unit conventions (scaled per instance in trees.js):
//  canopy: horizontal radius <= 1, y in [-1, 1] (centre 0); trunk: y in [0, 1] (1 = canopy centre), radii in canopy-radius units.
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// Leaf atlas (procedural, no external asset): 4 tiles of 128 px (square, so cards are not stretched). Tiles 0-2 = a dense disc of
// overlapping leaves (round clump, soft edge: cards read as foliage lumps, never as rectangular shards); tile 3 = solid (inner masses).
// Grey values are shade only; hue comes from the instance tint.
export function leafTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#d2d2d2'; g.fillRect(384, 0, 128, 128);
  for (let t = 0; t < 3; t++) {
    const cx = t * 128 + 64, cy = 64; g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill(); // dark core: no holes inside the clump
    for (let i = 0; i < 110; i++) { // back leaves first (darker, central), front leaves last (lighter, towards the rim): depth inside each card
      const f = i / 110, ang = hash(i, t, 2) * Math.PI * 2, rad = (0.2 + 0.8 * Math.sqrt(hash(i, t, 3))) * (46 + 12 * f), a = hash(i, t, 6) * Math.PI * 2, l = 12 + hash(i, t, 8) * 7, k = 150 + f * 85 + hash(i, t, 9) * 20;
      const w = hash(i, t, 5) - 0.5; // slight warm/cool shift per leaf
      g.save(); g.translate(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.92); g.rotate(a);
      g.fillStyle = `rgb(${k + w * 18 | 0},${k | 0},${k - w * 22 | 0})`; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * 0.7, l, 0); g.quadraticCurveTo(0, l * 0.7, -l, 0); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 1; g.stroke(); g.restore();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function impostorTexture() {
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;
  const g=cv.getContext('2d');
  for(let type=0;type<3;type++){
    const ox=type*128,cx=ox+64,green=['#547a3e','#607f43','#718b4c'][type];
    const bark=g.createLinearGradient(cx-4,0,cx+4,0);bark.addColorStop(0,'#30251e');bark.addColorStop(.5,'#74523a');bark.addColorStop(1,'#392a22');
    g.fillStyle=bark;g.beginPath();g.moveTo(cx-3,126);g.lineTo(cx-2,66);g.lineTo(cx+2,66);g.lineTo(cx+3,126);g.fill();
    for(let i=0;i<19;i++){
      const a=i*2.399963,rad=(i%4)*5.5+3,x=cx+Math.cos(a)*rad,y=48+Math.sin(a)*rad*.78;
      const shade=green;
      const grad=g.createRadialGradient(x-4,y-5,1,x,y,20);grad.addColorStop(0,['#91a962','#9bab67','#a4b16e'][type]);grad.addColorStop(.55,shade);grad.addColorStop(1,['#38572d','#405d32','#4a6638'][type]);
      g.fillStyle=grad;g.beginPath();g.ellipse(x,y,16+(i%3)*2,14+(i%4)*2,a*.15,0,Math.PI*2);g.fill();
    }
    for(let i=0;i<84;i++){
      const a=hash(i,type,22)*Math.PI*2,r=Math.sqrt(hash(i,type,23))*31,x=cx+Math.cos(a)*r,y=48+Math.sin(a)*r*.78;
      g.fillStyle=i%3===0?'rgba(181,194,119,.5)':'rgba(28,50,24,.22)';g.beginPath();g.arc(x,y,1+hash(i,type,24)*1.8,0,Math.PI*2);g.fill();
    }
  }
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function impostorGeometry(type) {
  const index={small:0,medium:1,large:2}[type],inset=2/512,u0=index*.25+inset,span=.25-inset*2,g=new THREE.PlaneGeometry(1,1),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,u0+uv.getX(i)*span);
  g.attributes.uv.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Per type: inner masses [count, seed] + leaf cards per tree. Shape variants come from per-instance aspect in trees.js.
const CROWN = { small: [4, 1, 60], medium: [5, 2, 80], large: [6, 3, 104] };

// Crown = a few solid inner masses (shade + volume) covered with alpha-tested leaf cards (fringed silhouette, small-leaf detail).
// Normals point out of the crown ("foliage normals") so light wraps it softly; colour darkens towards the inside/underside.
export function canopyGeometry(type, lod = 0) {
  const [count, seed, fullCards] = CROWN[type], cards=lod?Math.ceil(fullCards*.48):fullCards, masses = [], pos = [], uv = [], jit = [], ctr = [];
  for (let k = 0; k < count; k++) {
    const th = (k + hash(k, seed, 1) * 0.6) / count * Math.PI * 2, ph = Math.acos(1 - 2 * (0.15 + hash(seed, k, 2) * 0.7)), shell = k ? 0.4 + 0.16 * hash(k, k, seed) : 0;
    masses.push([Math.sin(ph) * Math.cos(th) * shell, Math.cos(ph) * shell * 0.8 + (k ? 0 : 0.05), Math.sin(ph) * Math.sin(th) * shell, k ? 0.5 + hash(k, 3, seed) * 0.12 : 0.62]);
  }
  for (const [cx, cy, cz, r] of masses) { // inner masses: low-poly, solid texel
    const g = new THREE.IcosahedronGeometry(r * 0.92, 1).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { pos.push(cx + p.getX(i), cy + p.getY(i) * (p.getY(i) < 0 ? 0.75 : 1), cz + p.getZ(i)); uv.push(0.88, 0.5); jit.push(0.8 + 0.2 * (p.getY(i) / r * 0.5 + 0.5)); ctr.push(cx, cy, cz); }
    g.dispose();
  }
  const d = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let c = 0; c < cards; c++) { // leaf cards on the mass surfaces, biased upward and outward, random roll and tilt
    const [cx, cy, cz, r] = masses[Math.floor(hash(c, seed, 11) * masses.length)], th = hash(c, 12, seed) * Math.PI * 2, y = -0.55 + hash(seed, c, 13) * 1.5;
    d.set(Math.cos(th) * Math.sqrt(1 - Math.min(1, y * y)), Math.min(1, y), Math.sin(th) * Math.sqrt(1 - Math.min(1, y * y))).normalize();
    const o = new THREE.Vector3(cx, cy, cz).addScaledVector(d, r * (0.8 + hash(c, 14, seed) * 0.3)), size = 0.5 + hash(c, seed, 15) * 0.16;
    const n = d.clone().add(new THREE.Vector3(hash(c, 1, 16) - 0.5, hash(c, 2, 16) - 0.5, hash(c, 3, 16) - 0.5).multiplyScalar(0.35)).normalize(); // cards lie nearly flat on the crown surface: tiles of leaf clumps, no spikes
    t1.crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up, n).normalize(); t2.crossVectors(n, t1);
    const roll = hash(c, 17, seed) * Math.PI * 2, a = t1.clone().multiplyScalar(Math.cos(roll)).addScaledVector(t2, Math.sin(roll)).multiplyScalar(size), b = n.clone().cross(a);
    const u0 = Math.floor(hash(c, 18, seed) * 3) * 0.25; // one of three clump tiles 
    const q = [o.clone().sub(a).sub(b), o.clone().add(a).sub(b), o.clone().add(a).add(b), o.clone().sub(a).add(b)], quv = [[u0, 0], [u0 + 0.25, 0], [u0 + 0.25, 1], [u0, 1]];
    const j = (0.92 + hash(c, 19, seed) * 0.22) * (0.8 + 0.2 * (d.y * 0.5 + 0.5)); // per-card jitter x mild clump shade
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(q[i].x, q[i].y, q[i].z); uv.push(...quv[i]); jit.push(j); ctr.push(cx, cy, cz); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const p = g.attributes.position; let rad = 0, ymin = 1e9, ymax = -1e9; // normalise: radius 1, y in [-1, 1]
  for (let i = 0; i < p.count; i++) { rad = Math.max(rad, Math.hypot(p.getX(i), p.getZ(i))); ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const yc = (ymin + ymax) / 2, ys = 2 / (ymax - ymin);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / rad, (p.getY(i) - yc) * ys, p.getZ(i) / rad);
  const nrm = new Float32Array(p.count * 3), col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const out = Math.min(1, v.length()), y = v.y;
    const m = new THREE.Vector3(ctr[i * 3] / rad, (ctr[i * 3 + 1] - yc) * ys, ctr[i * 3 + 2] / rad), cl = v.clone().sub(m).normalize(); // out of this vertex's clump
    v.normalize().multiplyScalar(0.25).addScaledVector(cl, 0.75); // clump + crown normal: the sun models each lump, the crown stays one volume
    v.set(v.x, v.y * 0.8 + 0.25, v.z).normalize().toArray(nrm, i * 3); // tilted up so tops catch the sky
    const k = 1.08 * jit[i] * (0.55 + 0.48 * out ** 2) * (0.90 + 0.24 * THREE.MathUtils.clamp((y + 1) / 2, 0, 1)); // inner/underside shade, sunlit top
    col.set([k * 0.95, k, k * (0.86 + 0.06 * (1 - out))], i * 3); // inner shade slightly cooler
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

// Trunk: flared base with surface roots, a slight lean/twist, and 3-5 branches reaching into the crown (y = 1 is the crown centre).
export function trunkGeometry(type,lod=0) {
  const bark = new THREE.Color('#4b3c33'), dark = new THREE.Color('#2f2621'), tip = new THREE.Color();
  const limb = (r0, r1, from, to, seg) => { // tapered cylinder between two points, smooth normals
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg, 2, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(...a.add(b).multiplyScalar(0.5).toArray()); const n = g.toNonIndexed(); g.dispose(); return n;
  };
  const R = { small: 0.1, medium: 0.12, large: 0.14 }[type], forks = { small: 3, medium: 4, large: 5 }[type], s = { small: 1, medium: 2, large: 3 }[type], rootCount=lod?3:5;
  const parts = [limb(R * 1.45, R * 1.05, [0, 0, 0], [0.03, 0.3, 0.02], lod?6:8), limb(R * 1.05, R * 0.8, [0.03, 0.3, 0.02], [-0.02, 0.58, 0.04], lod?6:8)];
  for (let i = 0; i < rootCount; i++) { // surface roots
    const a = i * Math.PI * 2 / 5 + hash(i, s, 1) * 0.6, l = 0.32 + hash(i, s, 2) * 0.14;
    parts.push(limb(R * 0.75, R * 0.12, [Math.cos(a) * R * 0.6, 0.14, Math.sin(a) * R * 0.6], [Math.cos(a) * l, -0.01, Math.sin(a) * l], lod?3:5));
  }
  for (let i = 0; i < forks; i++) { // branches lean outward into the crown
    const a = i * Math.PI * 2 / forks + 0.5 + hash(i, s, 3) * 0.5, out = 0.32 + hash(i, s, 4) * 0.2, top = 0.92 + hash(i, s, 5) * 0.3;
    if(!lod||i%2===0)parts.push(limb(R * 0.62, R * 0.22, [-0.02, 0.52, 0.04], [Math.cos(a) * out, top, Math.sin(a) * out], lod?4:6));
  }
  const g = mergeGeometries(parts); g.deleteAttribute('uv'); g.computeVertexNormals();
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) tip.copy(dark).lerp(bark, THREE.MathUtils.clamp(p.getY(i) * 1.6 + 0.25, 0, 1)).toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
