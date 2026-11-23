import * as THREE from 'three';
import { SURFACE as S } from './building-atlas.js';

// Facade articulation fitted to the real outer wall leaf and its openings: crowning cornice with dentils,
// stone quoins, banded rustication on the ground floor and tower fins/floor plates. Runs inside
// finishArchitecture before chunk merging; `place` is its envelope-clipped bevelled profile.
// LOD1 (level>0) keeps only the few long pieces that read at distance: cornice and tower fins/plates.
const SIDES = { front: ['west', 'east'], back: ['east', 'west'], east: ['front', 'back'], west: ['back', 'front'] };
const NORMALS = { front: [0, 1], back: [0, -1], east: [1, 0], west: [-1, 0] };
const WALLS = new Set([S.plaster, S.brick, S.stone]);
const EMBED = .04; // every piece starts this far inside its wall/glass plane
const CORNICE_STONE = [1.22, 1.19, 1.12], QUOIN_STONE = [1.14, 1.11, 1.04], RUSTIC_STONE = [.9, .89, .86];
const FIN_METAL = [.88, .96, 1.10], PLATE_STONE = [.96, .97, .98];

const dirOf = (nx, nz) => nx > .99 ? 'east' : nx < -.99 ? 'west' : nz > .99 ? 'front' : nz < -.99 ? 'back' : null;

// Axis-aligned vertical quads of one bucket, in face coordinates (u along the facade, plane along its normal).
function quads(geometry, accept) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, s = geometry.attributes.aSurface, out = [];
  if (geometry.index || !s) return out;
  for (let q = 0; q + 5 < p.count; q += 6) {
    const nx = n.getX(q), nz = n.getZ(q), dir = dirOf(nx, nz);
    if (!dir || !accept(s.getX(q))) continue;
    let lo = Infinity, hi = -Infinity, y0 = Infinity, y1 = -Infinity, plane = 0;
    for (let j = q; j < q + 6; j++) {
      const x = p.getX(j), z = p.getZ(j), u = nz * x - nx * z;
      lo = Math.min(lo, u); hi = Math.max(hi, u); y0 = Math.min(y0, p.getY(j)); y1 = Math.max(y1, p.getY(j)); plane += (nx * x + nz * z) / 6;
    }
    out.push({ dir, lo, hi, y0, y1, plane, area: (hi - lo) * (y1 - y0) });
  }
  return out;
}

// The facade of each direction is its dominant wall plane by area (a projecting bay is not the main wall).
function wallFaces(mass) {
  const byDir = {};
  for (const q of quads(mass, s => WALLS.has(s))) (byDir[q.dir] ??= []).push(q);
  const faces = {};
  for (const [dir, list] of Object.entries(byDir)) {
    const area = new Map();
    for (const q of list) { const k = q.plane.toFixed(2); area.set(k, (area.get(k) ?? 0) + q.area); }
    const plane = +[...area].sort((a, b) => b[1] - a[1])[0][0], leaf = list.filter(q => Math.abs(q.plane - plane) < .03);
    faces[dir] = { dir, plane, lo: Math.min(...leaf.map(q => q.lo)), hi: Math.max(...leaf.map(q => q.hi)), y0: Math.min(...leaf.map(q => q.y0)), y1: Math.max(...leaf.map(q => q.y1)) };
  }
  return faces;
}

// u-intervals of [a,b] not blocked by an opening within the padded y band.
function clearRuns(a, b, y0, y1, holes, padU, padY) {
  let runs = [[a, b]];
  for (const o of holes) {
    if (o.y1 + padY <= y0 || o.y0 - padY >= y1) continue;
    runs = runs.flatMap(([c, d]) => o.hi + padU <= c || o.lo - padU >= d ? [[c, d]] : [[c, o.lo - padU], [o.hi + padU, d]].filter(([e, f]) => f - e > .05));
  }
  return runs;
}

// True when no opening touches [a,b] in the padded band.
const isClear = (a, b, y0, y1, holes, padU, padY) => { const r = clearRuns(a, b, y0, y1, holes, padU, padY); return r.length === 1 && r[0][0] === a && r[0][1] === b; };

export function articulateFacades({ geometries, plot, kind, recipe = {}, level = 0, exposure, place, details }) {
  Object.assign(details, { cornice: 0, dentils: 0, quoins: 0, rustication: 0, fins: 0, floorPlates: 0 });
  if (geometries.some(g => g.index)) return details;
  const half = dir => dir === 'front' || dir === 'back' ? plot.depth / 2 : plot.width / 2;
  const basis = {};
  for (const [dir, [nx, nz]] of Object.entries(NORMALS)) basis[dir] = new THREE.Matrix3().set(nz, 0, nx, 0, 1, 0, -nx, 0, nz);
  // One piece on face f: u along the facade, `out` metres proud of the plane, embedded EMBED behind it.
  const piece = (f, u, y, w, h, out, surface, color, plain = false) => {
    const [nx, nz] = NORMALS[f.dir], off = f.plane + (out - EMBED) / 2;
    return place(nz * u + nx * off, y, -nx * u + nz * off, w, h, out + EMBED, surface, color, basis[f.dir], plain);
  };
  if (kind === 'tower') return towerArticulation(geometries[2], half, piece, details);
  if (kind === 'office') return details;

  const legacy = !Object.keys(recipe).length, faces = wallFaces(geometries[0]);
  const live = Object.values(faces).filter(f => exposure[f.dir] && f.hi - f.lo > 1.5);
  if (!live.length) return details;
  const corner = (f, end) => exposure[SIDES[f.dir][end]] && !!faces[SIDES[f.dir][end]];
  // Projection is per face: terraced side walls sit almost on the lot line, fronts have room to step out.
  const proud = (f, want) => Math.min(want, half(f.dir) - f.plane - .006);
  // Front/back runs wrap exposed corners by the side's projection; side runs stop just behind them, so no faces coincide.
  const span = (f, want) => {
    const wraps = f.dir === 'front' || f.dir === 'back';
    const ends = [0, 1].map(end => !corner(f, end) ? -.002 : wraps ? Math.max(0, proud(faces[SIDES[f.dir][end]], want)) : -(EMBED + .002));
    return [f.lo - ends[0], f.hi + ends[1]];
  };
  const holes = {};
  for (const q of [...quads(geometries[2], () => true), ...quads(geometries[0], s => s === S.door)]) {
    const f = faces[q.dir];
    if (f && q.plane > f.plane - .8 && q.plane < f.plane + .1) (holes[q.dir] ??= []).push(q);
  }

  // Crowning cornice: bed mould, dentil course and corona under the parapet (midrise) or at the wall head (legacy).
  const crown = kind === 'midrise' && recipe.floors ? plot.height - 1.1 : legacy && kind !== 'office' ? null : undefined;
  if (crown !== undefined) {
    for (const f of live) {
      const corona = proud(f, .24), dentil = Math.min(.16, corona - .05), bed = Math.min(.10, dentil - .04);
      const y = crown ?? f.y1 - .25, h = holes[f.dir] ?? [];
      if (corona < .05 || y < 2 || y + .25 > plot.height) continue;
      for (const [out, y0, y1, ok] of [[bed, y - .24, y - .10, bed > .02], [corona, y + .02, y + .24, true]]) {
        if (!ok) continue;
        const [a, b] = span(f, out);
        for (const [c, d] of clearRuns(a, b, y0, y1, h, .08, .06)) if (piece(f, (c + d) / 2, (y0 + y1) / 2, d - c, y1 - y0, out, S.stone, CORNICE_STONE)) details.cornice++;
      }
      if (level || dentil < .06) continue;
      const [a, b] = span(f, -EMBED), count = Math.floor((b - a - .2) / .26);
      for (let i = 0; i < count; i++) {
        const u = a + .1 + .13 + i * (b - a - .2) / count;
        if (isClear(u - .06, u + .06, y - .12, y + .03, h, .04, .04) && piece(f, u, y - .045, .11, .15, dentil, S.stone, CORNICE_STONE, true)) details.dentils++;
      }
    }
  }
  if (level) return details;

  // Quoins: alternating long/short stones up every exposed corner of masonry and rendered walls.
  const quoinKinds = kind === 'townhouse' || kind === 'midrise' && !recipe.brise || kind === 'shop';
  if (quoinKinds) {
    const course = .34;
    for (const f of live) for (const end of [0, 1]) {
      const out = proud(f, .05);
      if (!corner(f, end) || out < .01) continue;
      const wraps = f.dir === 'front' || f.dir === 'back', edge = end ? f.hi : f.lo, inward = end ? -1 : 1;
      const wrap = wraps ? Math.max(0, proud(faces[SIDES[f.dir][end]], .05)) : 0;
      const top = Math.min(f.y1, recipe.eaves ?? Infinity, kind === 'midrise' && recipe.floors ? plot.height - 1.42 : kind === 'shop' ? f.y1 - .6 : Infinity) - .02;
      const bottom = kind === 'midrise' && recipe.ground ? recipe.ground + .05 : kind === 'shop' ? (recipe.ground ?? 3) + .2 : f.y0 + .32;
      for (let k = 0, y = bottom; y + course <= top; k++, y += course) {
        const long = quoinWidth(k, wraps);
        const outer = wraps ? edge - inward * wrap : edge + inward * (EMBED + .002), inner = outer + inward * (long + (wraps ? wrap : 0));
        const a = Math.min(outer, inner), b = Math.max(outer, inner);
        if (!isClear(a, b, y, y + course, holes[f.dir] ?? [], .06, .04)) continue;
        // A 2.5 cm bed joint replaces the bevel so stacked stones still read separately.
        if (piece(f, (a + b) / 2, y + course / 2, b - a, course - .025, out, S.stone, QUOIN_STONE, true)) details.quoins++;
      }
    }
  }

  // Banded rustication: chamfered stone courses (the profile bevel reads as the joint) across the ground storey.
  if (kind === 'midrise' && recipe.ground && !recipe.brise) {
    const top = recipe.ground - .13, rows = Math.max(3, Math.round((top - .32) / .44)), course = (top - .32) / rows;
    for (const f of live) {
      const out = proud(f, .035);
      if (out < .015) continue;
      const [a, b] = span(f, out);
      for (let r = 0; r < rows; r++) {
        const y0 = .32 + r * course;
        for (const [c, d] of clearRuns(a, b, y0, y0 + course, holes[f.dir] ?? [], .18, .4)) if (piece(f, (c + d) / 2, y0 + course / 2, d - c, course - .03, out, S.stone, RUSTIC_STONE, true)) details.rustication++;
      }
    }
  }
  return details;
}

// Quoin rhythm: course k's stone width along a face; corners alternate so the long stone swaps sides each course.
function quoinWidth(k, wraps) {
  // TODO(human)
  return .45;
}

// Glass towers: aluminium fins on the mullion joints and stone floor plates in the spandrel band, per glazed plane.
function towerArticulation(glass, half, piece, details) {
  const groups = new Map();
  for (const q of quads(glass, () => true)) {
    const key = `${q.dir}:${q.plane.toFixed(1)}`;
    if (!groups.has(key)) groups.set(key, { dir: q.dir, plane: q.plane, panes: [] });
    groups.get(key).panes.push(q);
  }
  for (const g of groups.values()) {
    const room = half(g.dir) - g.plane - .006;
    if (room < .1) continue;
    const lo = Math.min(...g.panes.map(p => p.lo)), hi = Math.max(...g.panes.map(p => p.hi));
    const y0 = Math.min(...g.panes.map(p => p.y0)), y1 = Math.max(...g.panes.map(p => p.y1)), fin = Math.min(.42, room);
    // Fins centre on the joints between neighbouring panes (never over glazing).
    const edges = [...new Set(g.panes.flatMap(p => [+p.lo.toFixed(2), +p.hi.toFixed(2)]))].sort((a, b) => a - b);
    for (let i = 1; i + 1 < edges.length; i += 2) {
      const gap = edges[i + 1] - edges[i];
      if (gap < .04 || gap > .8) continue;
      if (piece(g, (edges[i] + edges[i + 1]) / 2, (y0 + y1) / 2, Math.min(.18, gap + .03), y1 - y0, fin, S.stone, FIN_METAL)) details.fins++;
    }
    // Floor plates sit in each spandrel gap between stacked panes.
    const levels = [...new Set(g.panes.flatMap(p => [+p.y0.toFixed(2), +p.y1.toFixed(2)]))].sort((a, b) => a - b);
    for (let i = 1; i + 1 < levels.length; i += 2) {
      const gap = levels[i + 1] - levels[i];
      if (gap < .2 || gap > 1.5) continue;
      if (piece(g, (lo + hi) / 2, (levels[i] + levels[i + 1]) / 2, hi - lo - .12, Math.min(.16, gap * .5), Math.min(.16, fin * .45), S.stone, PLATE_STONE)) details.floorPlates++;
    }
  }
  return details;
}
