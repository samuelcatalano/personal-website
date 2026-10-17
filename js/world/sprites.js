// Walking-emoji people drawn with canvas 2D: smooth outline-free shapes, soft gradients, 6 walk frames per look, side view facing right.
// Unit space while drawing: x forward, y up, 1 = body height, origin = feet centre.
export const CELL_W = 144, CELL_H = 208, COLS = 14, FRAMES = 6, GROUND = 204, S = 200; // S = px per body height; the stride fits the cell width
export const ROWS = 14; // 14 x 14 cells >= 192 = 32 looks x 6 frames -> 2016 x 2912 px
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const tone = (c, a) => `rgb(${hex(c).map((v) => Math.round(v + ((a < 0 ? 0 : 255) - v) * Math.abs(a))).join(',')})`; // a > 0 lighter, < 0 darker
const EYE = '#1a1512', IRIS = '#5a3d28', BAND = '#c0392b';
// Hair shapes in head units (origin = head centre, y up).
const CAP = [[0.47, 0.12], [0.54, 0.34], [0.4, 0.6], [0.12, 0.68], [-0.22, 0.62], [-0.5, 0.38], [-0.58, 0.02], [-0.52, -0.28], [-0.38, -0.3], [-0.3, -0.04], [-0.22, 0.16], [0.05, 0.26], [0.3, 0.26]];
const SOFT = [[0.45, 0.2], [0.5, 0.38], [0.32, 0.58], [0.02, 0.64], [-0.3, 0.56], [-0.52, 0.3], [-0.56, -0.05], [-0.5, -0.3], [-0.36, -0.3], [-0.32, -0.02], [-0.2, 0.18], [0.05, 0.3], [0.3, 0.3]];
const LONG = [[-0.1, 0.6], [-0.48, 0.4], [-0.62, -0.1], [-0.62, -0.7], [-0.55, -1.15], [-0.3, -1.2], [-0.2, -0.7], [-0.1, -0.2], [0, 0.1]];
const TAIL = [[-0.45, 0.35], [-0.7, 0.55], [-1, 0.45], [-1.15, 0.1], [-1, -0.45], [-0.85, -0.05], [-0.75, 0.2], [-0.5, 0.15]];
const HEAD = [[0.02, 0.5], [0.34, 0.42], [0.46, 0.18], [0.47, -0.05], [0.56, -0.1], [0.48, -0.17], [0.45, -0.3], [0.33, -0.46], [0.1, -0.5], [-0.2, -0.42], [-0.42, -0.15], [-0.46, 0.15], [-0.3, 0.4]];
const BEARD = [[0.42, -0.12], [0.46, -0.3], [0.3, -0.5], [0, -0.5], [-0.3, -0.35], [-0.35, -0.2], [-0.1, -0.28], [0.2, -0.3]];
const AFRO = Array.from({ length: 14 }, (_, i) => [-0.12 + 0.8 * Math.cos(i / 14 * 6.2832) * (i % 2 ? 0.94 : 1), 0.2 + 0.8 * Math.sin(i / 14 * 6.2832) * (i % 2 ? 0.94 : 1)]);

function blob(ctx, p) { // closed Catmull-Rom spline through the points
  const n = p.length; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n], d = p[(i + 2) % n];
    ctx.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  ctx.closePath();
}
function tube(ctx, a, ra, b, rb) { // tapered capsule
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l; // same winding as the arcs
  ctx.beginPath(); ctx.arc(a[0], a[1], ra, 0, 7); ctx.moveTo(b[0] + rb, b[1]); ctx.arc(b[0], b[1], rb, 0, 7);
  ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra); ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb); ctx.lineTo(b[0] - nx * rb, b[1] - ny * rb); ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra); ctx.closePath();
}

export function drawFigure(ctx, look, frame) {
  const kid = /boy|girl/.test(look.kind), girl = look.kind === 'woman' || look.kind === 'girl', ks = kid ? 0.84 : 1;
  const afro0 = look.hairStyle === 'short' && ['#8a5a35', '#5e3a22', '#3d2517'].includes(look.skin), hd = kid ? 0.2 : 0.15, hy = 1 - (afro0 ? 1.04 : 0.7) * hd - 0.005, sh = hy - 0.5 * hd - (kid ? 0.04 : 0.035), hip = kid ? 0.45 : girl ? 0.49 : 0.5;
  const tw = kid ? 0.078 : girl ? 0.085 : 0.095, thigh = (hip - 0.05) / 2, lean = 0.05, hx = 0.02;
  const afro = look.hairStyle === 'short' && ['#8a5a35', '#5e3a22', '#3d2517'].includes(look.skin);
  const beard = look.kind === 'man' && Math.floor(look.height * 1000) % 3 === 0;
  const skin = look.skin, p = frame / FRAMES * 2 * Math.PI;
  const grad = (c, x0, y0, x1, y1, hi = 0.16, lo = -0.22) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, tone(c, hi)); g.addColorStop(1, tone(c, lo)); return g; };
  const fill = (c, x0, y0, x1, y1, shade = 0, hi = 0.16, lo = -0.22) => { ctx.fillStyle = grad(c, x0, y0, x1, y1, hi + shade, lo + shade); ctx.fill(); };
  const walk = (ph) => { // leg pose for a phase: thigh angle, knee flexion
    const t = 0.5 * Math.sin(ph), flex = 0.08 + 0.9 * Math.max(0, Math.cos(ph - 0.3)) ** 1.5;
    return { t, s: t - flex };
  };
  // Legs: hip pivot, knee, ankle; ground the lower foot so the figure bobs with the stride.
  const legs = [p, p + Math.PI].map((ph) => {
    const { t, s } = walk(ph), K = [Math.sin(t) * thigh, hip - Math.cos(t) * thigh], A = [K[0] + Math.sin(s) * thigh, K[1] - Math.cos(s) * thigh];
    const fa = s > 0 ? -s * 0.5 : -s, sf = Math.sin(fa), cf = Math.cos(fa); // toes-down angle; lowest sole corner (heel / toe)
    return { K, A, s, fa, low: A[1] + ks * Math.min(0.03 * sf - 0.06 * cf, -0.115 * sf - 0.06 * cf) };
  });
  const dy = -Math.min(legs[0].low, legs[1].low);
  ctx.save(); ctx.translate(0, dy);
  const leg = (L, shade) => {
    const H = [0, hip], pc = look.bottom, r = ks;
    ctx.save();
    tube(ctx, H, 0.058 * r, L.K, 0.044 * r); fill(pc, -0.05, hip, 0.05, L.A[1], shade, 0.03, -0.2); tube(ctx, L.K, 0.044 * r, L.A, 0.037 * r); fill(pc, -0.05, hip, 0.05, L.A[1], shade, 0.03, -0.2);
    ctx.restore();
  };
  const foot = (L, shade) => {
    ctx.save(); ctx.translate(L.A[0], L.A[1]); ctx.rotate(-L.fa); ctx.scale(ks, ks);
    const sole = look.shoes === '#f2f2ee' ? '#a8a8a2' : '#ecece6';
    ctx.lineCap = 'round'; ctx.strokeStyle = shade ? tone(sole, shade) : sole; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.03, -0.047); ctx.lineTo(0.1, -0.047); ctx.stroke();
    blob(ctx, [[-0.04, -0.035], [-0.035, 0.03], [0.0, 0.05], [0.04, 0.035], [0.075, 0.0], [0.115, -0.02], [0.115, -0.04], [0.06, -0.05], [-0.03, -0.05]]);
    fill(look.shoes, 0, 0.05, 0, -0.05, shade);
    ctx.restore();
  };
  const seam = (L) => {
    ctx.save(); ctx.strokeStyle = tone(look.bottom, -0.55); ctx.globalAlpha = 0.55; ctx.lineWidth = 0.004; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.01, hip - 0.02); ctx.lineTo(L.K[0] + 0.012, L.K[1]); ctx.lineTo(L.A[0] + 0.01, L.A[1] + 0.05 * ks); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L.A[0] - 0.035 * ks, L.A[1] + 0.045 * ks); ctx.lineTo(L.A[0] + 0.033 * ks, L.A[1] + 0.05 * ks); ctx.stroke(); ctx.restore();
  };
  const upper = (fn) => { ctx.save(); ctx.translate(0, hip); ctx.rotate(-lean); ctx.translate(0, -hip); fn(); ctx.restore(); };
  const arm = (ph, shade) => { // shoulder, elbow, fist + sleeve
    const a = -0.65 * Math.sin(ph), flex = 0.2 + 0.55 * Math.max(0, a / 0.65), l1 = (kid ? 0.13 : 0.17), l2 = (kid ? 0.115 : 0.15);
    const Sh = [-0.005, sh - 0.035], E = [Sh[0] + Math.sin(a) * l1, Sh[1] - Math.cos(a) * l1], W = [E[0] + Math.sin(a + flex) * l2, E[1] - Math.cos(a + flex) * l2];
    tube(ctx, Sh, 0.034 * ks, E, 0.029 * ks); fill(skin, -0.05, sh, 0.05, W[1], shade);
    tube(ctx, E, 0.029 * ks, W, 0.022 * ks); fill(skin, -0.05, sh, 0.05, W[1], shade);
    ctx.beginPath(); ctx.arc(W[0] + Math.sin(a + flex) * 0.012, W[1] - Math.cos(a + flex) * 0.012, 0.027 * ks, 0, 7); fill(skin, 0, W[1] + 0.03, 0, W[1] - 0.03, shade ? shade : 0);
    const M = [Sh[0] + (E[0] - Sh[0]) * 0.5, Sh[1] + (E[1] - Sh[1]) * 0.5];
    tube(ctx, [Sh[0], Sh[1] + 0.012], 0.047 * ks, M, 0.042 * ks); fill(look.top, -0.05, sh, 0.05, M[1], shade);
  };
  const [near, far] = [legs[0], legs[1]];
  leg(far, -0.2); foot(far, -0.2);
  upper(() => {
    arm(p + Math.PI, -0.2);
    // hair behind head
    const H = (pts, sx = 1) => pts.map(([x, y]) => [hx + x * hd * sx, hy + y * hd]);
    const hg = (a, b) => fill(look.hair, 0, hy + a * hd, 0, hy + b * hd, 0);
    if (afro) { blob(ctx, H(AFRO)); hg(1, -0.6); }
    if (look.hairStyle === 'long') { blob(ctx, H(LONG)); fill(look.hair, 0, hy + 0.6 * hd, 0, hy - 1.2 * hd); }
    if (look.hairStyle === 'ponytail') {
      ctx.save(); ctx.translate(hx - 0.5 * hd, hy + 0.3 * hd); ctx.rotate(0.12 * Math.sin(p + 1)); ctx.translate(-(hx - 0.5 * hd), -(hy + 0.3 * hd));
      blob(ctx, H(TAIL)); fill(look.hair, 0, hy + 0.55 * hd, 0, hy - 0.45 * hd, 0); ctx.restore();
    }
    // neck, torso
    tube(ctx, [hx - 0.01, hy - 0.3 * hd], 0.036 * ks, [0, sh], 0.04 * ks); fill(skin, 0, hy, 0, sh, -0.1);
    const t = tw, bump = girl && !kid ? 1.18 : 1;
    blob(ctx, [[-0.75 * t, sh], [0, sh + 0.012], [0.8 * t, sh - 0.008], [t * bump, sh - 0.08], [0.9 * t, hip + 0.12], [0.95 * t, hip - 0.01], [-0.95 * t, hip - 0.012], [-t, hip + 0.12], [-0.95 * t, sh - 0.08]]);
    fill(look.top, -t, sh, t, hip, 0, 0.12, -0.2);
    // head
    blob(ctx, H(HEAD)); fill(skin, hx - 0.4 * hd, hy + 0.5 * hd, hx + 0.4 * hd, hy - 0.5 * hd, 0, 0.1, -0.16);
    if (beard) { ctx.globalAlpha = 0.8; blob(ctx, H(BEARD)); fill(look.hair, 0, hy, 0, hy - 0.5 * hd, 0); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.ellipse(hx - 0.2 * hd, hy - 0.08 * hd, 0.1 * hd, 0.14 * hd, 0.1, 0, 7); fill(skin, 0, hy + 0.1 * hd, 0, hy - 0.2 * hd, 0, -0.08, -0.22);
    ctx.beginPath(); ctx.ellipse(hx - 0.2 * hd, hy - 0.08 * hd, 0.05 * hd, 0.08 * hd, 0.1, 0, 7); ctx.fillStyle = tone(skin, -0.28); ctx.fill();
    // face
    ctx.beginPath(); ctx.ellipse(hx + 0.22 * hd, hy + 0.05 * hd, 0.11 * hd, 0.08 * hd, 0, 0, 7); ctx.fillStyle = '#fbfbf8'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 0.27 * hd, hy + 0.05 * hd, 0.062 * hd, 0, 7); ctx.fillStyle = IRIS; ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 0.28 * hd, hy + 0.05 * hd, 0.034 * hd, 0, 7); ctx.fillStyle = EYE; ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = tone(look.hair, -0.1); ctx.lineWidth = 0.04 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.1 * hd, hy + 0.17 * hd); ctx.quadraticCurveTo(hx + 0.24 * hd, hy + 0.23 * hd, hx + 0.37 * hd, hy + 0.19 * hd); ctx.stroke();
    ctx.strokeStyle = tone(skin, -0.5); ctx.lineWidth = 0.028 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.2 * hd, hy - 0.27 * hd); ctx.quadraticCurveTo(hx + 0.32 * hd, hy - 0.31 * hd, hx + 0.43 * hd, hy - 0.22 * hd); ctx.stroke();
    ctx.strokeStyle = tone(skin, -0.2); ctx.lineWidth = 0.025 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.42 * hd, hy - 0.15 * hd); ctx.quadraticCurveTo(hx + 0.5 * hd, hy - 0.17 * hd, hx + 0.46 * hd, hy - 0.22 * hd); ctx.stroke();
    // hair on top
    if (look.hairStyle !== 'bald') { blob(ctx, H(look.hairStyle === 'short' ? CAP : SOFT)); hg(0.68, -0.3); }
    if (look.hairStyle === 'bun') { ctx.beginPath(); ctx.arc(hx - 0.32 * hd, hy + 0.66 * hd, 0.25 * hd, 0, 7); hg(0.9, 0.4); }
    if (look.hairStyle === 'ponytail') { ctx.beginPath(); ctx.arc(hx - 0.5 * hd, hy + 0.3 * hd, 0.07 * hd, 0, 7); ctx.fillStyle = BAND; ctx.fill(); }
  });
  leg(near, 0); seam(near); foot(near, 0);
  upper(() => arm(p, 0));
  ctx.restore();
}

// One atlas canvas: look v frame f lives in cell v * FRAMES + f.
export function buildAtlas(variants) {
  const canvas = Object.assign(document.createElement('canvas'), { width: COLS * CELL_W, height: ROWS * CELL_H }), ctx = canvas.getContext('2d');
  variants.forEach((look, v) => {
    for (let f = 0; f < FRAMES; f++) {
      const cell = v * FRAMES + f;
      ctx.save(); ctx.translate((cell % COLS) * CELL_W + CELL_W / 2, Math.floor(cell / COLS) * CELL_H + GROUND); ctx.scale(S, -S);
      drawFigure(ctx, look, f); ctx.restore();
    }
  });
  return canvas;
}
