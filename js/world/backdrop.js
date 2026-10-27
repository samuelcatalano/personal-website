import { glasgowSites, rng } from './layout.js';
import { PALETTE as P } from './palette.js';

export function buildBackdrop(add, stops, pts) {
  const r = rng(90817), { museum } = glasgowSites(stops, pts);
  let nearBuildings = 0;
  const x0 = pts[0].x - 230, x1 = pts.at(-1).x + 230, rows = [-130, -170, -220, -280, -350, -440];
  const colors = [P.cream, P.stone, P.taupe, P.roof, P.brick, P.redBrown, P.londonStock, P.concreteMid, P.steel, P.londonStock, P.stone];
  const distantColors = [P.stone, P.concreteMid, P.taupe, P.steel];
  const museumL = museum.x - museum.w / 2 - 12, museumR = museum.x + museum.w / 2 + 12;
  const facade = (x, y, z, w, h, depth, seed, coverage, wall) => {
    // ponytail: distance bands approximate atmospheric contrast, not true scattering.
    const near = z > -145, far = z < -200;
    const recess = near ? P.ink : far ? wall : P.steel, frame = near ? P.offWhite : wall, window = far ? P.steel : P.glass;
    const detail = rng(seed), floors = Math.max(1, Math.floor(h / 2.8));
    const face = (span, center, axis, surface, outward) => {
      const bays = Math.max(1, Math.min(5, Math.floor(span / 2.1))), cell = span / bays;
      for (let floor = 0; floor < floors; floor++) for (let bay = 0; bay < bays; bay++) {
        if (detail() > coverage) continue;
        const bw = cell * 0.58, bh = Math.min(1.3, h / floors * 0.48);
        const along = center + (bay + 0.5 - bays / 2) * cell, by = y + (floor + 0.52) * h / floors;
        const pane = (alongPos, yPos, facePos, aw, ah, ad, color) => axis === 'z'
          ? add(alongPos, yPos, facePos, aw, ah, ad, color)
          : add(facePos, yPos, alongPos, ad, ah, aw, color);
        const paneW = bw - 0.12, paneH = bh - 0.12;
        pane(along, by, surface + outward * 0.015, paneW, paneH, 0.04, recess);
        // Four narrow rails frame a recessed pane without covering its face.
        pane(along - paneW / 2 + 0.035, by, surface + outward * 0.075, 0.07, bh, 0.08, frame);
        pane(along + paneW / 2 - 0.035, by, surface + outward * 0.075, 0.07, bh, 0.08, frame);
        pane(along, by - paneH / 2 + 0.035, surface + outward * 0.075, paneW, 0.07, 0.08, frame);
        pane(along, by + paneH / 2 - 0.035, surface + outward * 0.075, paneW, 0.07, 0.08, frame);
        pane(along, by, surface + outward * 0.015, paneW - 0.1, paneH - 0.1, 0.03, window);
      }
    };
    face(w, x, 'z', z + depth / 2, 1);
    face(depth, z, 'x', x - w / 2, -1);
    face(depth, z, 'x', x + w / 2, 1);
  };
  const body = (x, y, z, w, h, d, color, seed, trim = false, coverage = 0.78) => {
    if (y === 0) add(x, -0.1, z, w, 0.08, d, P.concreteMid);
    add(x, y, z, w, h, d, color);
    facade(x, y, z, w, h, d, seed, coverage, color);
    if (trim) {
      const bandY = y + Math.min(2.85, h * 0.28);
      add(x, bandY, z, w + 0.08, 0.14, d + 0.08, z > -145 ? P.offWhite : color);
      add(x, y + 0.35, z, w + 0.12, 0.18, d + 0.12, z > -145 ? P.roof : color);
    }
  };
  for (let row = 0; row < rows.length; row++) {
    for (let x = x0; x < x1;) {
      const z = rows[row] + (r() - 0.5) * 10, w = 9 + r() * 4, gap = 2 + r() * 2, xc = x + w / 2;
      const museumClear = xc - w / 2 < museumR && xc + w / 2 > museumL;
      const depth = row === 0 ? 8 : 11;
      const rearFill = museumClear && x >= museumL + 1 && x + w <= museumR - 1 && z + depth / 2 + 0.4 <= -122;
      const rowRandom = rearFill ? rng((Math.round(xc * 73) ^ (row * 761) ^ 90820) | 0) : r;
      if (!museumClear || rearFill) {
        const near = row === 0 ? -110 : (rows[row - 1] + rows[row]) / 2;
        const far = row === rows.length - 1 ? -475 : (rows[row] + rows[row + 1]) / 2;
        if (!rearFill) add(xc + gap / 2, -0.08, (near + far) / 2, w + gap, 0.08, near - far, P.pave);
        const floors = rearFill ? row < 2 ? 2 + (rowRandom() * 3 | 0) : 2 + (rowRandom() * 6 | 0) : row < 2 ? 2 + (r() * 3 | 0) : 2 + (r() * 6 | 0);
        const wall = (row < 2 ? colors : distantColors)[(rearFill ? rowRandom() : r()) * (row < 2 ? colors : distantColors).length | 0];
        const roof = row === 0 ? [P.roof, P.brick, P.ink][(rearFill ? rowRandom() : r()) * 3 | 0] : wall, h = floors * 2.8;
        // Four low-cost mass profiles; existing RNG/positions and fog remain the source of depth.
        const family=(Math.abs(Math.round(xc*17))+row)%4;
        let topX=xc,topW=w;
        const coverage = row < 2 ? .78 : row < 4 ? .42 : .22;
        if(family===0)body(xc,0,z,w,h,depth,wall,(Math.round(xc*91)^row*761)|0,row<2,coverage);
        else if(family===1){body(xc,0,z,w,h*.62,depth,wall,(Math.round(xc*91)^row*761)|0,row<2,coverage);topX=xc+w*.12;topW=w*.70;body(topX,h*.62,z,topW,h*.38,depth*.82,wall,(Math.round(xc*97)^row*787)|0,row<2,coverage);}
        else if(family===2){body(xc-w*.25,0,z,w*.5,h*.78,depth,wall,(Math.round(xc*101)^row*809)|0,row<2,coverage);add(xc-w*.25,h*.78,z,w*.5+.1,.25,depth+.2,roof);topX=xc+w*.25;topW=w*.5;body(topX,0,z,topW,h,depth,wall,(Math.round(xc*103)^row*811)|0,row<2,coverage);}
        else {body(xc,0,z,w,h*.85,depth,wall,(Math.round(xc*107)^row*821)|0,row<2,coverage);topW=w*.34;body(xc,h*.85,z,topW,h*.15,depth*.65,roof,(Math.round(xc*109)^row*823)|0,false,coverage);}
        add(topX,h,z,topW+.3,.35,depth*(family===1?.82:family===3?.65:1)+.4,roof);
        if (row === 0 && !rearFill) {
          if(family===0)add(xc, h + 0.35, z, w * 0.62, 0.75, depth * 0.62, roof);
          if (nearBuildings++ % 3 === 0 && family===0) add(xc, h + 1.1, z, w * 0.38, 0.28, depth * 0.45, roof);
          for (let f = 0; f < floors; f += 2) { r(); r(); } // Keep roof variation on its original seeded sequence.

        }
      }
      x += w + gap;
    }
  }
  // West cap: own rng, appended so no existing row shifts. Rows run 160 m past the old west end, so the hero's upper-left shows city, not bare ground.
  // ponytail: plain boxes with the shared facade pass, no massing families; add them if the west end is ever the focal frame.
  const wc = rng(90821);
  for (const [row, z0] of rows.slice(0, 4).entries()) {
    for (let x = x0 - 160; x < x0 - 14;) {
      const w = 9 + wc() * 4, gap = 2 + wc() * 2, xc = x + w / 2, z = z0 + (wc() - 0.5) * 10, floors = 2 + (wc() * (row < 2 ? 3 : 6) | 0), h = floors * 2.8;
      const wall = (row < 2 ? colors : distantColors)[wc() * (row < 2 ? colors : distantColors).length | 0];
      body(xc, 0, z, w, h, 11, wall, (Math.round(xc * 91) ^ row * 761) | 0, row < 2, row < 2 ? .78 : .42);
      add(xc, h, z, w + .3, .35, 11.4, row === 0 ? P.roof : wall);
      x += w + gap;
    }
  }
  // Mid band between the back-lot infill (z -120) and the far rows: own rng, so every existing row keeps its place.
  // Taller than the rows beside it, with stepped crowns, rooftop plant and the odd mast to break the box skyline.
  const m = rng(90818);
  for (const [mz, lo, hi, pal] of [[-150, 4, 9, colors], [-198, 4, 8, distantColors]]) {
    for (let x = x0; x < x1;) {
      const w = 9 + m() * 5, gap = 2 + m() * 2.5, xc = x + w / 2, z = mz + (m() - 0.5) * 6, depth = 10;
      const skip = xc - w / 2 < museumR && xc + w / 2 > museumL;
      const floors = lo + (m() * (hi - lo + 1) | 0), h = floors * 2.8, wall = pal[m() * pal.length | 0], roof = m() < 0.5 && mz > -190 ? P.roof : wall, kind = m(), plant = m(), crown = Math.abs(Math.round(xc * 13) + floors) % 3;
      if (!skip) {
        if (crown === 0) body(xc, 0, z, w, h, depth, wall, (Math.round(xc * 73) ^ Math.round(mz * 19)) | 0, true, .55);
        else if (crown === 1) { body(xc, 0, z, w, h * 0.72, depth, wall, (Math.round(xc * 73) ^ Math.round(mz * 19)) | 0, true, .55); body(xc + w * 0.1, h * 0.72, z, w * 0.72, h * 0.28, depth * 0.8, wall, (Math.round(xc * 79) ^ Math.round(mz * 23)) | 0, false, .55); }
        else { body(xc - w * 0.2, 0, z, w * 0.6, h, depth, wall, (Math.round(xc * 83) ^ Math.round(mz * 29)) | 0, true, .55); body(xc + w * 0.3 + 0.02, 0, z, w * 0.4 - 0.04, h * 0.66, depth, wall, (Math.round(xc * 89) ^ Math.round(mz * 31)) | 0, false, .55); }
        add(xc, h, z, w + 0.3, 0.35, depth + 0.3, roof);
        if (plant < 0.45) add(xc + (kind - 0.5) * w * 0.3, h + 0.35, z - 1, w * 0.36, 1 + plant * 2, depth * 0.4, roof);
        if (kind < 0.12 && h > 18) add(xc, h + 0.35, z, 0.3, 4 + kind * 20, 0.3, P.steel);
      }
      x += w + gap;
    }
  }
  // Infill rows between the far rows (own rng, so nothing above moves): no open ground shows between skyline bands.
  const f = rng(90819);
  for (const fz of [-245, -318, -395]) {
    for (let x = x0; x < x1;) {
      const w = 8 + f() * 5, gap = 1.5 + f() * 2, xc = x + w / 2, z = fz + (f() - 0.5) * 8, h = (2 + (f() * 7 | 0)) * 2.8, wall = distantColors[f() * distantColors.length | 0];
      if (!(xc - w / 2 < museumR && xc + w / 2 > museumL)) {
        body(xc, 0, z, w, h, 12, wall, (Math.round(xc * 53) ^ Math.round(fz * 11)) | 0, false, .2);
        add(xc, h, z, w + 0.3, 0.35, 12.3, wall);
      }
      x += w + gap;
    }
  }
}
