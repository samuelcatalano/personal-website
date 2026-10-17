import { hairShape } from './crowd.js';
// Walking-emoji people drawn with canvas 2D: smooth outline-free shapes, soft gradients, 6 walk frames per look, side view facing right.
// Unit space while drawing: x forward, y up, 1 = body height, origin = feet centre.
// Atlas 4096 x 2464: left, 16 x 14 side cells (28 looks x 8 frames); right, 32 x 14 narrow cells for front and back (28 looks x 2 views x 8 frames).
export const CELL_W = 120, CELL_H = 176, COLS = 16, ROWS = 14, FRAMES = 8, GROUND = 172, S = 164; // S = px per body height; the stride fits the cell width
export const FB_W = 68, FB_COLS = 32, FB_X = COLS * CELL_W, ATLAS_W = 4096, ATLAS_H = ROWS * CELL_H;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const tone = (c, a) => `rgb(${hex(c).map((v) => Math.round(v + ((a < 0 ? 0 : 255) - v) * Math.abs(a))).join(',')})`; // a > 0 lighter, < 0 darker
const EYE = '#1a1512', IRIS = '#5a3d28', BAND = '#c0392b';
// Hair shapes in head units (origin = head centre, y up).
const CAP = [[0.47, 0.12], [0.54, 0.34], [0.4, 0.6], [0.12, 0.68], [-0.22, 0.62], [-0.5, 0.38], [-0.58, 0.02], [-0.52, -0.28], [-0.38, -0.3], [-0.3, -0.04], [-0.22, 0.16], [0.05, 0.26], [0.3, 0.26]];
const SOFT = [[0.45, 0.2], [0.5, 0.38], [0.32, 0.58], [0.02, 0.64], [-0.3, 0.56], [-0.52, 0.3], [-0.56, -0.05], [-0.5, -0.3], [-0.36, -0.3], [-0.32, -0.02], [-0.2, 0.18], [0.05, 0.3], [0.3, 0.3]];
const LONG = [[-0.1, 0.62], [-0.5, 0.45], [-0.72, 0.0], [-0.78, -0.6], [-0.66, -1.2], [-0.36, -1.35], [-0.2, -0.9], [-0.12, -0.3], [0, 0.05]];
const TAIL = [[-0.4, 0.42], [-0.6, 0.8], [-0.95, 0.88], [-1.25, 0.6], [-1.22, 0.1], [-1.02, -0.45], [-0.98, 0.12], [-0.8, 0.38], [-0.55, 0.3]]; // swoops up and back, pointed tip
const PIG = [[-0.4, 0.1], [-0.62, 0.3], [-0.9, 0.22], [-1.0, -0.1], [-0.88, -0.5], [-0.8, -0.1], [-0.68, 0.0], [-0.5, -0.05]];
const QUIFF = [[0.47, 0.12], [0.58, 0.34], [0.7, 0.62], [0.5, 0.9], [0.18, 0.86], [-0.02, 0.72], [-0.25, 0.64], [-0.5, 0.4], [-0.58, 0.02], [-0.52, -0.28], [-0.38, -0.3], [-0.3, -0.04], [-0.22, 0.16], [0.05, 0.28], [0.3, 0.3]];
const CURLY = [[0.47, 0.1], ...Array.from({ length: 11 }, (_, i) => { const a = 0.5 + i * 0.34, r = i % 2 ? 0.6 : 0.72; return [-0.04 + r * Math.cos(a), 0.12 + r * Math.sin(a)]; }), [-0.3, -0.04], [-0.2, 0.16], [0.05, 0.28], [0.3, 0.3]];
const TUFTS = [[[-0.14, 0.58], [-0.08, 0.8], [0.08, 0.88], [0.2, 0.72], [0.1, 0.58]], [[0.14, 0.58], [0.26, 0.8], [0.44, 0.76], [0.46, 0.54]]];
const RES = { afro: 1.04, quiff: 0.9, curly: 0.9, tousled: 0.92, bun: 1, ponytail: 0.92, pigtails: 0.8 }; // head units above the head centre that the hair needs (rest: 0.7)
const BANDS = ['#c0392b', '#e8b930', '#2e6fb7', '#d96a8c'];
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

function dims(look) { // body proportions shared by the side, front and back drawings
  const kid = /boy|girl/.test(look.kind), girl = look.kind === 'woman' || look.kind === 'girl', woman = look.kind === 'woman', shape = hairShape(look);
  const hd = kid ? 0.21 : 0.15, hy = 1 - (shape === 'afro' && kid ? 0.84 : RES[shape] || 0.7) * hd - 0.005, hip = kid ? 0.43 : girl ? 0.49 : 0.5;
  return { kid, girl, woman, ks: kid ? 0.84 : 1, shape, hd, hy, hip, sh: hy - 0.5 * hd - (kid ? 0.04 : 0.035), tw: kid ? 0.078 : woman ? 0.08 : 0.095, thigh: (hip - 0.05) / 2, afroS: kid ? 0.72 : 1, band: BANDS[Math.floor(look.height * 1000) % 4] };
}
// Gait: 60% stance (the planted foot moves back relative to the hip at a constant rate, so it stays put on the ground when the sprite advances by CYCLE per walk cycle), 40% swing.
const DUTY = 0.6, smooth = (k) => k * k * (3 - 2 * k);
const stepX = (look) => { const { kid, thigh } = dims(look); return thigh * (kid ? 1.25 : 1.07); }; // half the planted foot's travel relative to the hip
export const strideOf = (look) => 2 * stepX(look) / DUTY; // body heights travelled per walk cycle (2 steps)
export function gait(look, f) { // sagittal pose (x forward, y up): ankles, knees, foot pitch and hip height for frame f
  const { ks, hip, thigh } = dims(look), X = stepX(look), c = f / FRAMES;
  const legs = [c, (c + 0.5) % 1].map((u) => {
    let x, lift = 0, fa;
    if (u < DUTY) { const k = u / DUTY; x = X - 2 * X * k; fa = -0.25 + 0.35 * k + 0.6 * smooth(Math.max(0, (k - 0.75) / 0.25)); }
    else { const k = (u - DUTY) / (1 - DUTY); x = -X + 2 * X * smooth(k); lift = 0.06 * Math.sin(Math.PI * k); fa = 0.7 - 0.95 * smooth(k); }
    const sf = Math.sin(fa), cf = Math.cos(fa);
    return { x, fa, ay: lift - ks * Math.min(0.03 * sf - 0.06 * cf, -0.115 * sf - 0.06 * cf), lift }; // ankle height puts the lowest sole corner on the ground
  });
  const hipY = hip - 0.012 - 0.018 * Math.cos(4 * Math.PI * c); // up at mid-stance, down at double support: about 3.6% of height
  legs.forEach((L) => {
    const dx = L.x, dy = L.ay - hipY, d = Math.hypot(dx, dy), h = Math.sqrt(Math.max(0, thigh * thigh - (d / 2) ** 2)), ux = dx / d, uy = dy / d;
    L.K = [dx / 2 - uy * h, hipY + dy / 2 + ux * h]; L.A = [dx, L.ay]; // knee bends forward
  });
  return { legs, hipY, X };
}
export function drawFigure(ctx, look, frame) {
  const { kid, girl, woman, ks, shape, hd, hy, sh, hip, tw, thigh, afroS, band } = dims(look), lean = 0.05, hx = 0.02;
  const beard = look.kind === 'man' && Math.floor(look.height * 1000) % 3 === 0;
  const skin = look.skin, p = frame / FRAMES * 2 * Math.PI;
  const grad = (c, x0, y0, x1, y1, hi = 0.16, lo = -0.22) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, tone(c, hi)); g.addColorStop(1, tone(c, lo)); return g; };
  const fill = (c, x0, y0, x1, y1, shade = 0, hi = 0.16, lo = -0.22) => { ctx.fillStyle = grad(c, x0, y0, x1, y1, hi + shade, lo + shade); ctx.fill(); };
  ctx.save();
  const G = gait(look, frame), legs = G.legs, hipY = G.hipY, dh = hipY - hip;
  const leg = (L, shade) => {
    const H = [0, hipY], pc = look.bottom, r = ks;
    tube(ctx, H, 0.058 * r, L.K, 0.044 * r); fill(pc, -0.05, hipY, 0.05, L.A[1], shade, 0.03, -0.2); tube(ctx, L.K, 0.044 * r, L.A, 0.037 * r); fill(pc, -0.05, hipY, 0.05, L.A[1], shade, 0.03, -0.2);
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
    ctx.beginPath(); ctx.moveTo(0.01, hipY - 0.02); ctx.lineTo(L.K[0] + 0.012, L.K[1]); ctx.lineTo(L.A[0] + 0.01, L.A[1] + 0.05 * ks); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L.A[0] - 0.035 * ks, L.A[1] + 0.045 * ks); ctx.lineTo(L.A[0] + 0.033 * ks, L.A[1] + 0.05 * ks); ctx.stroke(); ctx.restore();
  };
  const upper = (fn) => { ctx.save(); ctx.translate(0, dh); ctx.translate(0, hip); ctx.rotate(-lean); ctx.translate(0, -hip); fn(); ctx.restore(); };
  const arm = (L, shade) => { // shoulder, elbow, fist + sleeve; swings opposite to the leg on this side
    const a = -0.7 * L.x / G.X, flex = 0.2 + 0.55 * Math.max(0, a / 0.7), l1 = (kid ? 0.12 : 0.17), l2 = (kid ? 0.1 : 0.15);
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
    arm(far, -0.2);
    // hair behind head
    const H = (pts, sx = 1) => pts.map(([x, y]) => [hx + x * hd * sx, hy + y * hd]);
    const hg = (a, b) => fill(look.hair, 0, hy + a * hd, 0, hy + b * hd, 0);
    const sway = Math.sin(p + 1);
    const tail = (px, py, pts, ang) => { // a tail hanging from a band, swinging with the walk
      ctx.save(); ctx.translate(hx + px * hd, hy + py * hd); ctx.rotate(ang); ctx.translate(-(hx + px * hd), -(hy + py * hd));
      blob(ctx, H(pts)); fill(look.hair, 0, hy + 0.8 * hd, 0, hy - 0.5 * hd, 0); ctx.restore();
    };
    if (shape === 'afro') { blob(ctx, H(AFRO.map(([x, y]) => [x * afroS, y * afroS]))); hg(1, -0.6); }
    if (shape === 'long') { ctx.save(); ctx.translate(0.012 * sway, 0); blob(ctx, H(LONG)); fill(look.hair, 0, hy + 0.6 * hd, 0, hy - 1.3 * hd); ctx.restore(); }
    if (shape === 'ponytail') tail(-0.45, 0.4, TAIL, 0.14 * sway);
    if (shape === 'pigtails') { tail(-0.45, 0.05, PIG, 0.2 * sway); tail(-0.45, 0.05, PIG, 0.2 * -sway + 0.35); }
    // neck, torso
    tube(ctx, [hx - 0.01, hy - 0.3 * hd], 0.036 * ks, [0, sh], 0.04 * ks); fill(skin, 0, hy, 0, sh, -0.1);
    const t = tw;
    blob(ctx, woman ? [[-0.7 * t, sh], [0, sh + 0.012], [0.72 * t, sh - 0.01], [1.14 * t, sh - 0.085], [0.98 * t, sh - 0.165], [0.8 * t, hip + 0.1], [0.98 * t, hip - 0.01], [-0.98 * t, hip - 0.012], [-0.86 * t, hip + 0.1], [-0.92 * t, sh - 0.1]]
      : [[-0.75 * t, sh], [0, sh + 0.012], [0.8 * t, sh - 0.008], [t, sh - 0.08], [0.9 * t, hip + 0.12], [0.95 * t, hip - 0.01], [-0.95 * t, hip - 0.012], [-t, hip + 0.12], [-0.95 * t, sh - 0.08]]);
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
    ctx.lineCap = 'round';
    if (girl) { ctx.strokeStyle = EYE; ctx.lineWidth = 0.03 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.12 * hd, hy + 0.1 * hd); ctx.quadraticCurveTo(hx + 0.24 * hd, hy + 0.15 * hd, hx + 0.34 * hd, hy + 0.1 * hd); ctx.moveTo(hx + 0.12 * hd, hy + 0.1 * hd); ctx.lineTo(hx + 0.07 * hd, hy + 0.13 * hd); ctx.stroke(); }
    ctx.strokeStyle = tone(look.hair, -0.1); ctx.lineWidth = 0.04 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.1 * hd, hy + 0.17 * hd); ctx.quadraticCurveTo(hx + 0.24 * hd, hy + 0.23 * hd, hx + 0.37 * hd, hy + 0.19 * hd); ctx.stroke();
    ctx.strokeStyle = girl ? tone('#c0504d', -0.1) : tone(skin, -0.5); ctx.lineWidth = (girl ? 0.036 : 0.028) * hd; ctx.beginPath(); ctx.moveTo(hx + 0.2 * hd, hy - 0.27 * hd); ctx.quadraticCurveTo(hx + 0.32 * hd, hy - 0.31 * hd, hx + 0.43 * hd, hy - 0.22 * hd); ctx.stroke();
    ctx.strokeStyle = tone(skin, -0.2); ctx.lineWidth = 0.025 * hd; ctx.beginPath(); ctx.moveTo(hx + 0.42 * hd, hy - 0.15 * hd); ctx.quadraticCurveTo(hx + 0.5 * hd, hy - 0.17 * hd, hx + 0.46 * hd, hy - 0.22 * hd); ctx.stroke();
    // hair on top
    if (shape !== 'bald') { blob(ctx, H({ quiff: QUIFF, curly: CURLY, tousled: CAP, afro: CAP, short: CAP }[shape] || SOFT)); hg(0.8, -0.3); }
    if (shape === 'tousled') for (const t of TUFTS) { blob(ctx, H(t)); hg(0.9, 0.5); }
    if (shape === 'bun') { ctx.beginPath(); ctx.arc(hx - 0.4 * hd, hy + 0.68 * hd, 0.3 * hd, 0, 7); hg(1, 0.4); }
    if (shape === 'ponytail' || shape === 'pigtails' || shape === 'bun') for (const [bx, by] of shape === 'pigtails' ? [[-0.45, 0.05]] : shape === 'bun' ? [[-0.36, 0.5]] : [[-0.45, 0.4]]) { ctx.beginPath(); ctx.arc(hx + bx * hd, hy + by * hd, 0.075 * hd, 0, 7); ctx.fillStyle = band; ctx.fill(); }
  });
  ctx.beginPath(); ctx.arc(-0.04, hipY - 0.004, (woman ? 0.06 : kid ? 0.048 : 0.056), 0, 7); fill(look.bottom, -0.05, hipY + 0.06, 0.03, hipY - 0.06, 0, 0.0, -0.2);
  leg(near, 0); seam(near); foot(near, 0);
  upper(() => arm(near, 0));
  ctx.restore();
}

// Front (back = true: from behind) view: arms and legs alternate with foreshortening, hips sway, the lowest foot grounds the figure.
export function drawFront(ctx, look, frame, back) {
  const { kid, girl, woman, ks, shape, hd, hy, sh, hip, tw, thigh, afroS, band } = dims(look), skin = look.skin, p = frame / FRAMES * 2 * Math.PI, wk = kid ? 0.78 : 1, r = ks * wk;
  const sw = (woman ? 0.1 : 0.115) * wk, side = [-1, 1], sole = look.shoes === '#f2f2ee' ? '#a8a8a2' : '#ecece6', beard = look.kind === 'man' && Math.floor(look.height * 1000) % 3 === 0;
  const grad = (c, x0, y0, x1, y1, hi, lo) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, tone(c, hi)); g.addColorStop(1, tone(c, lo)); return g; };
  const fill = (c, x0, y0, x1, y1, hi = 0.16, lo = -0.22) => { ctx.fillStyle = grad(c, x0, y0, x1, y1, hi, lo); ctx.fill(); };
  const H = (pts) => pts.map(([x, y]) => [x * hd, hy + y * hd]);
  const hg = (a, b) => fill(look.hair, 0, hy + a * hd, 0, hy + b * hd);
  const line = (c, w, alpha, pts) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); };
  const G = gait(look, frame), sway = Math.sin(p + 1), swayX = 0.014 * Math.sin(p), tilt = 0.04 * Math.sin(p), TK = back ? -0.22 : 0.22; // TK: screen drop per unit of forward reach (closer to the camera = lower)
  const dh = G.hipY - hip, X = G.X;
  // Sagittal pose to screen: lateral hip offset, depth lowers (front) or raises (back) the point; nearer parts are drawn bigger.
  const P = (sd, lat, x, y) => [sd * lat, y - TK * x], big = (x) => 1 + 0.3 * x / X;
  const legs = side.map((sd, i) => { const L = G.legs[i], hx0 = sd * 0.05 * wk; return { sd, ...L, H: [hx0, G.hipY], K2: P(sd, 0.056 * wk + 0.012 * Math.abs(L.K[0]), L.K[0], L.K[1]), A2: P(sd, 0.05 * wk, L.x, L.A[1]) }; });
  ctx.save();
  const leg = (L) => {
    const rt = r * big(L.x * 0.5), rk = r * big(L.K[0]);
    tube(ctx, L.H, 0.058 * rt, L.K2, 0.046 * rk); fill(look.bottom, -0.1, G.hipY, 0.1, L.A2[1], 0.03, -0.2);
    tube(ctx, L.K2, 0.046 * rk, L.A2, 0.04 * big(L.x) * r); fill(look.bottom, -0.1, G.hipY, 0.1, L.A2[1], 0.03, -0.2);
    const o = L.sd * 0.034 * r;
    line(tone(look.bottom, -0.5), 0.004, 0.5, [[L.H[0] + o * 1.1, G.hipY - 0.01], [L.K2[0] + o, L.K2[1]], [L.A2[0] + o * 0.85, L.A2[1] + 0.03]]);
    line(tone(look.bottom, -0.45), 0.005, 0.55, [[L.A2[0] - 0.038 * r, L.A2[1] + 0.05 * r], [L.A2[0] + 0.038 * r, L.A2[1] + 0.05 * r]]);
  };
  const foot = (L) => {
    const sc = ks * big(L.x) * wk ** 0.5, up = Math.max(0, (L.fa - 0.15) / 0.55), sy = 1 - 0.3 * up; // toe-off: the foot tips away, shorter and with a thin dark sole edge
    ctx.save(); ctx.translate(L.A2[0], L.A2[1] - 0.032 * ks); ctx.scale(sc, sc * sy);
    const body = [[-0.04, 0.03], [-0.046, -0.012], [-0.03, -0.04], [0.03, -0.04], [0.046, -0.012], [0.04, 0.03], [0, 0.05]];
    ctx.lineCap = 'round'; ctx.strokeStyle = up > 0.3 ? tone(look.shoes, -0.45) : sole; ctx.lineWidth = up > 0.3 ? 0.012 : 0.02; ctx.beginPath(); ctx.moveTo(-0.034, -0.044); ctx.lineTo(0.034, -0.044); ctx.stroke();
    blob(ctx, body); fill(look.shoes, 0, 0.05, 0, -0.04, 0.12, -0.15);
    if (back) { ctx.beginPath(); ctx.ellipse(0, -0.012, 0.022, 0.028, 0, 0, 7); ctx.fillStyle = tone(look.shoes, -0.2); ctx.fill(); line(tone(sole, -0.15), 0.006, 0.8, [[-0.034, 0.02], [0, 0.026], [0.034, 0.02]]); }
    else { ctx.beginPath(); ctx.ellipse(0, -0.026, 0.03, 0.016, 0, 0, 7); ctx.fillStyle = tone(look.shoes, 0.18); ctx.fill(); for (const y of [0.006, 0.022]) line(tone(sole, -0.05), 0.004, 0.9, [[-0.016, y], [0.016, y]]); }
    ctx.restore();
  };
  [...legs].sort((a, b) => a.x - b.x).forEach((L) => { leg(L); foot(L); }); // the rear leg first
  // upper body sways with the hips and counter-rotates; bobs with the hip height
  ctx.save(); ctx.translate(swayX, dh); ctx.translate(0, hip); ctx.rotate(-tilt); ctx.translate(0, -hip);
  const arms = side.map((sd, i) => { // swings opposite to the leg on the same side, out from the body, hand up / down with the swing
    const a = -0.8 * G.legs[i].x / X, flex = 0.25 + 0.6 * Math.max(0, a / 0.8), l1 = kid ? 0.13 : 0.185, l2 = kid ? 0.11 : 0.165, out = 0.012 + 0.03 * Math.abs(Math.sin(a));
    const xs1 = Math.sin(a) * l1, ys1 = -Math.cos(a) * l1, xs2 = xs1 + Math.sin(a + flex) * l2, ys2 = ys1 - Math.cos(a + flex) * l2;
    const S0 = [sd * (sw - 0.004), sh - 0.035], E = [S0[0] + sd * out * 0.6, S0[1] + ys1 - TK * xs1], W = [S0[0] + sd * out, S0[1] + ys2 - TK * xs2];
    return { sd, S0, E, W, a, fs: big(xs2) };
  });
  const armSkin = (shade) => arms.forEach(({ sd, S0, E, W, fs }) => {
    tube(ctx, S0, 0.036 * ks, E, 0.03 * ks); fill(skin, sd * 0.1, sh, -sd * 0.04, W[1], 0.12 + shade, -0.2 + shade);
    tube(ctx, E, 0.03 * ks, W, 0.022 * ks * fs); fill(skin, sd * 0.1, sh, -sd * 0.04, W[1], 0.12 + shade, -0.2 + shade);
    ctx.beginPath(); ctx.arc(W[0], W[1] - 0.014 * ks * fs, 0.028 * ks * fs, 0, 7); fill(skin, 0, W[1] + 0.03, 0, W[1] - 0.04, 0.1, -0.25);
    line(tone(skin, -0.35), 0.004, 0.6, [[W[0] - 0.014 * ks * fs, W[1] - 0.012 * ks * fs], [W[0] + 0.012 * ks * fs, W[1] - 0.012 * ks * fs]]);
  });
  armSkin(0);
  // hair behind the body
  const hairBlob = (pts, a, b) => { blob(ctx, H(pts)); hg(a, b); };
  if (shape === 'afro') { blob(ctx, H(AFRO.map(([x, y]) => [(x + 0.12) * afroS, y * afroS]))); hg(1, -0.6); }
  if (shape === 'long') hairBlob(back ? [[-0.52, 0.3], [-0.58, -0.5], [-0.6, -1.25], [-0.25, -1.45], [0.25, -1.45], [0.6, -1.25], [0.58, -0.5], [0.52, 0.3], [0, 0.5]] : [[-0.5, 0.35], [-0.6, -0.3], [-0.62, -1.2], [-0.25, -1.38], [0.25, -1.38], [0.62, -1.2], [0.6, -0.3], [0.5, 0.35], [0, 0.6]], 0.6, -1.4);
  if (shape === 'ponytail' && !back) { ctx.save(); ctx.translate(0.5 * hd, hy + 0.1 * hd); ctx.rotate(0.1 * sway); ctx.translate(-0.5 * hd, -(hy + 0.1 * hd)); hairBlob([[0.4, 0.3], [0.68, 0.1], [0.78, -0.5], [0.64, -1.05], [0.5, -0.4], [0.4, -0.05]], 0.2, -1); ctx.restore(); } // the tail hangs behind one shoulder
  // torso + neckline
  const t = tw * 1.15 * wk, chest = woman ? 1.04 : 1, waist = woman ? 0.76 : 0.92;
  blob(ctx, [[-0.9 * sw, sh], [0, sh + 0.012], [0.9 * sw, sh], [sw, sh - 0.05], [t * chest, sh - 0.12], [t * waist, hip + 0.1], [t * 1.1, hip - 0.012], [-t * 1.1, hip - 0.012], [-t * waist, hip + 0.1], [-t * chest, sh - 0.12], [-sw, sh - 0.05]]);
  if (back) { const g = ctx.createLinearGradient(-sw, 0, sw, 0); g.addColorStop(0, tone(look.top, 0.08)); g.addColorStop(0.5, tone(look.top, -0.02)); g.addColorStop(1, tone(look.top, -0.25)); ctx.fillStyle = g; ctx.fill(); line(tone(look.top, -0.3), 0.005, 0.5, [[0, sh - 0.02], [0.004, hip + 0.04]]); }
  else fill(look.top, -sw, sh, sw, hip, 0.14, -0.2);
  ctx.beginPath(); ctx.ellipse(0, sh + 0.004, 0.047 * wk, 0.03, 0, 0, 7); fill(skin, 0, sh + 0.03, 0, sh - 0.03, -0.06, -0.3);
  ctx.save(); ctx.strokeStyle = tone(look.top, -0.35); ctx.lineWidth = 0.007; ctx.beginPath(); ctx.ellipse(0, sh + 0.004, 0.047 * wk, 0.03, 0, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.restore(); // collar
  // pelvis, fly or back pockets
  ctx.beginPath(); ctx.ellipse(0, hip - 0.012, t * 1.05, 0.05, 0, 0, 7); fill(look.bottom, 0, hip + 0.04, 0, hip - 0.06, -0.04, -0.12);
  if (back) for (const sd of side) { const x = sd * 0.045 * wk; line(tone(look.bottom, -0.5), 0.005, 0.7, [[x - 0.026, hip - 0.002], [x + 0.026, hip - 0.002], [x + 0.026, hip - 0.058], [x, hip - 0.07], [x - 0.026, hip - 0.058], [x - 0.026, hip - 0.002]]); }
  else { line(tone(look.bottom, -0.5), 0.004, 0.6, [[0.002, hip + 0.03], [0.014, hip - 0.01], [0.006, hip - 0.04]]); ctx.beginPath(); ctx.arc(0, hip + 0.036, 0.006, 0, 7); ctx.fillStyle = tone(look.bottom, 0.4); ctx.fill(); }
  // sleeves with a hem, rounded over the shoulder
  arms.forEach(({ sd, S0, E }) => {
    const M = [S0[0] + (E[0] - S0[0]) * 0.55, S0[1] + (E[1] - S0[1]) * 0.55];
    ctx.beginPath(); ctx.arc(S0[0] - sd * 0.006, S0[1] + 0.018, 0.036 * ks * wk ** 0.3, 0, 7); fill(look.top, sd * 0.1, sh, -sd * 0.04, S0[1] - 0.06, 0.16, -0.2);
    tube(ctx, [S0[0], S0[1] + 0.012], 0.036 * ks, M, 0.033 * ks); fill(look.top, sd * 0.1, sh, -sd * 0.04, M[1], 0.14, -0.22);
    line(tone(look.top, -0.35), 0.006, 0.7, [[M[0] - 0.038 * ks, M[1]], [M[0] + 0.038 * ks, M[1]]]);
  });
  // neck, head
  tube(ctx, [0, hy - 0.3 * hd], 0.036 * ks, [0, sh + 0.01], 0.04 * ks); fill(skin, 0, hy, 0, sh, -0.08, -0.32);
  blob(ctx, H([[0, 0.5], [0.3, 0.44], [0.44, 0.2], [0.44, -0.1], [0.36, -0.34], [0.16, -0.5], [0, -0.52], [-0.16, -0.5], [-0.36, -0.34], [-0.44, -0.1], [-0.44, 0.2], [-0.3, 0.44]]));
  fill(skin, -0.4 * hd, hy + 0.5 * hd, 0.4 * hd, hy - 0.5 * hd, 0.1, -0.16);
  for (const sd of side) { ctx.beginPath(); ctx.ellipse(sd * 0.46 * hd, hy - 0.05 * hd, 0.075 * hd, 0.13 * hd, 0, 0, 7); fill(skin, 0, hy + 0.1 * hd, 0, hy - 0.2 * hd, -0.05, -0.22); ctx.beginPath(); ctx.ellipse(sd * 0.47 * hd, hy - 0.05 * hd, 0.03 * hd, 0.07 * hd, 0, 0, 7); ctx.fillStyle = tone(skin, -0.28); ctx.fill(); }
  if (!back) {
    if (beard) { ctx.globalAlpha = 0.85; blob(ctx, H([[-0.43, -0.08], [-0.42, -0.36], [0, -0.55], [0.42, -0.36], [0.43, -0.08], [0.3, -0.2], [0.18, -0.2], [0, -0.14], [-0.18, -0.2], [-0.3, -0.2]])); hg(-0.1, -0.55); ctx.globalAlpha = 1; }
    for (const sd of side) {
      ctx.beginPath(); ctx.ellipse(sd * 0.18 * hd, hy + 0.02 * hd, 0.105 * hd, 0.075 * hd, 0, 0, 7); ctx.fillStyle = '#fbfbf8'; ctx.fill();
      ctx.beginPath(); ctx.arc(sd * 0.18 * hd, hy + 0.02 * hd, 0.058 * hd, 0, 7); ctx.fillStyle = IRIS; ctx.fill();
      ctx.beginPath(); ctx.arc(sd * 0.18 * hd, hy + 0.02 * hd, 0.032 * hd, 0, 7); ctx.fillStyle = EYE; ctx.fill();
      ctx.beginPath(); ctx.arc(sd * 0.18 * hd + 0.012 * hd, hy + 0.04 * hd, 0.012 * hd, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      line(tone(look.hair, -0.1), 0.04 * hd, 1, [[sd * 0.07 * hd, hy + 0.14 * hd], [sd * 0.19 * hd, hy + 0.19 * hd], [sd * 0.31 * hd, hy + 0.15 * hd]]);
      if (girl) line(EYE, 0.026 * hd, 1, [[sd * 0.08 * hd, hy + 0.08 * hd], [sd * 0.19 * hd, hy + 0.115 * hd], [sd * 0.3 * hd, hy + 0.08 * hd]]);
    }
    line(tone(skin, -0.25), 0.028 * hd, 0.9, [[-0.05 * hd, hy - 0.04 * hd], [-0.06 * hd, hy - 0.11 * hd], [0, hy - 0.14 * hd], [0.06 * hd, hy - 0.11 * hd], [0.05 * hd, hy - 0.04 * hd]]);
    ctx.beginPath(); ctx.ellipse(0, hy - 0.12 * hd, 0.07 * hd, 0.04 * hd, 0, 0, 7); ctx.fillStyle = tone(skin, 0.08); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
    line(girl ? tone('#c0504d', -0.1) : tone(skin, -0.5), (girl ? 0.04 : 0.03) * hd, 1, [[-0.14 * hd, hy - 0.26 * hd], [0, hy - 0.33 * hd], [0.14 * hd, hy - 0.26 * hd]]);
  }
  // hair on top
  if (back) {
    if (shape !== 'bald') { blob(ctx, H([[0, 0.62], [0.36, 0.52], [0.52, 0.2], [0.5, -0.12], [0.36, -0.32], [0, -0.4], [-0.36, -0.32], [-0.5, -0.12], [-0.52, 0.2], [-0.36, 0.52]])); hg(0.62, -0.4); }
    if (shape === 'long') hairBlob([[-0.5, 0.2], [-0.56, -0.5], [-0.58, -1.2], [-0.25, -1.4], [0.25, -1.4], [0.58, -1.2], [0.56, -0.5], [0.5, 0.2], [0, 0.1]], 0.2, -1.3);
    if (shape === 'ponytail') { ctx.save(); ctx.translate(0.06 * sway * hd, 0); hairBlob([[-0.16, 0.38], [-0.3, 0.0], [-0.3, -0.9], [0, -1.25], [0.3, -0.9], [0.3, 0.0], [0.16, 0.38]], 0.3, -1.1); ctx.restore(); }
    if (shape === 'curly') for (const [x, y] of [[-0.3, 0.5], [0, 0.62], [0.3, 0.5], [-0.46, 0.1], [0.46, 0.1]]) { ctx.beginPath(); ctx.arc(x * hd, hy + y * hd, 0.12 * hd, 0, 7); hg(0.7, 0); }
  } else {
    if (shape !== 'bald') { blob(ctx, H([[-0.5, 0.0], [-0.52, 0.3], [-0.36, 0.56], [0, 0.66], [0.36, 0.56], [0.52, 0.3], [0.5, 0.0], [0.42, 0.18], [0.2, 0.3], [0, 0.34], [-0.2, 0.3], [-0.42, 0.18]])); hg(0.66, 0.1); }
    if (shape === 'quiff' || shape === 'tousled') hairBlob([[-0.3, 0.5], [-0.2, 0.8], [0.08, 0.9], [0.38, 0.76], [0.4, 0.5]], 0.9, 0.5);
    if (shape === 'curly') for (const [x, y] of [[-0.34, 0.5], [-0.12, 0.64], [0.14, 0.64], [0.36, 0.5], [-0.5, 0.2], [0.5, 0.2]]) { ctx.beginPath(); ctx.arc(x * hd, hy + y * hd, 0.13 * hd, 0, 7); hg(0.8, 0.3); }
    if (shape === 'long') for (const sd of side) hairBlob([[sd * 0.46, 0.15], [sd * 0.56, -0.4], [sd * 0.6, -1.05], [sd * 0.42, -1.15], [sd * 0.38, -0.4]], 0.1, -1);
  }
  if (shape === 'bun') { ctx.beginPath(); ctx.arc(0, hy + 0.78 * hd, 0.28 * hd, 0, 7); hg(1, 0.4); ctx.beginPath(); ctx.arc(0, hy + 0.55 * hd, 0.07 * hd, 0, 7); ctx.fillStyle = band; ctx.fill(); }
  if (shape === 'ponytail' && back) { ctx.beginPath(); ctx.arc(0, hy + 0.38 * hd, 0.08 * hd, 0, 7); ctx.fillStyle = band; ctx.fill(); }
  if (shape === 'pigtails') for (const sd of side) {
    ctx.save(); ctx.translate(sd * 0.55 * hd, hy + 0.05 * hd); ctx.rotate(sd * 0.15 * sway);
    blob(ctx, [[0, 0.08], [sd * 0.28, 0.0], [sd * 0.4, -0.4], [sd * 0.2, -0.85], [0, -0.45]].map(([x, y]) => [x * hd, y * hd])); hg(0.1, -0.9); ctx.restore();
    ctx.beginPath(); ctx.arc(sd * 0.55 * hd, hy + 0.05 * hd, 0.075 * hd, 0, 7); ctx.fillStyle = band; ctx.fill();
  }
  ctx.restore(); // upper body
  ctx.restore();
}

// Edge bleed: transparent / half-transparent pixels take the colour of the nearest solid neighbour (a few px), so filtering and mips never blend in black or white fringes.
function bleed({ data: d, width: w, height: h }, passes = 4) {
  let solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i++) solid[i] = d[4 * i + 3] >= 200;
  for (let k = 0; k < passes; k++) {
    const next = solid.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (solid[i]) continue;
      const n = x > 0 && solid[i - 1] ? i - 1 : x < w - 1 && solid[i + 1] ? i + 1 : y > 0 && solid[i - w] ? i - w : y < h - 1 && solid[i + w] ? i + w : -1;
      if (n < 0) continue;
      d[4 * i] = d[4 * n]; d[4 * i + 1] = d[4 * n + 1]; d[4 * i + 2] = d[4 * n + 2]; next[i] = 1;
    }
    solid = next;
  }
}
// One atlas (un-premultiplied RGBA, row 0 = top). Side look v frame f: cell v * FRAMES + f; front / back: cell (v * 2 + view) * FRAMES + f in the narrow block.
export function buildAtlas(variants) {
  const canvas = Object.assign(document.createElement('canvas'), { width: ATLAS_W, height: ATLAS_H }), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cell = (x, y, w, fn) => { ctx.save(); ctx.translate(x + w / 2, y + GROUND); ctx.scale(S, -S); fn(); ctx.restore(); };
  variants.forEach((look, v) => {
    for (let f = 0; f < FRAMES; f++) {
      const c = v * FRAMES + f;
      cell((c % COLS) * CELL_W, Math.floor(c / COLS) * CELL_H, CELL_W, () => drawFigure(ctx, look, f));
      for (let view = 0; view < 2; view++) {
        const n = (v * 2 + view) * FRAMES + f;
        cell(FB_X + (n % FB_COLS) * FB_W, Math.floor(n / FB_COLS) * CELL_H, FB_W, () => drawFront(ctx, look, f, view === 1));
      }
    }
  });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bleed(img);
  return img;
}
