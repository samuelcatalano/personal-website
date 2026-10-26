# Original VW T-Cross (1st gen, Brazilian long-wheelbase MY2020) for the Three.js city.
# Run: blender -b --factory-startup -P build_vw_t_cross.py   -> assets/vehicles/vw-t-cross.glb + record.json
# Method (as the player Mini): numbers traced pixel-by-pixel from the getoutlines blueprint (stored in
# ../regional-fleet/profiles/vw-t-cross.json, metres, EU short wheelbase remapped to the BR axles), a dense lofted
# hull (x-stations x section ring, tumblehome, real wheel-arch cavities, stepped sill cladding), then per-part details
# projected onto the hull surface (windows, lamps, grille, flares, rails, handles...).  Reference is visual only.
# Authoring axes: nose +X, up +Z, symmetric in Y.  glTF export_yup -> +X forward / +Y up.
import bpy, bmesh, math, json, sys, hashlib, struct, bisect
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'assets/vehicles/vw-t-cross.glb'
PROF = json.loads((ROOT / 'tools/vehicles/regional-fleet/profiles/vw-t-cross.json').read_text())
SEMS = ['FleetBody', 'FleetGlass', 'FleetTrim', 'FleetRubber', 'FleetLights', 'FleetInterior']
BLACK = (.025, .031, .035, 1); RUBBER = (.019, .022, .025, 1); SILVER = (.48, .51, .54, 1); CHROME = (.80, .82, .85, 1)
WHITE = (1, 1, 1, 1); GLASS = (.055, .11, .15, 1); INT = (.033, .04, .048, 1)
LAMPW = (.93, .96, 1, 1); RED = (.65, .012, .018, 1); DRED = (.22, .01, .012, 1); AMBER = (1, .29, .02, 1); PLATE = (.9, .9, .86, 1)
ALLOY = (.5, .52, .55, 1); DARKALLOY = (.09, .1, .11, 1)

# ---------------------------------------------------------------- numbers
XF, XR, WR = 1.2525, -1.3985, 0.325792            # axles (BR long wheelbase 2.651), wheel radius
HALFTRACK, TYREW = 0.77, 0.215
ARCH_R = 0.385; Y_IN = 0.56                       # arch opening radius, cavity back wall
LEN_HALF = 2.0995
RLY = .945                                       # tail-lamp y scale (rear view width vs plan taper)
DCL = 0.010                                       # sill cladding stands proud of the body
ROOFLOW = 0.020                                   # roof body sits this far under the silhouette (rails add it back)

def spline(pts):                                  # monotone cubic through (x,y): no overshoot
    q = []
    for p in sorted(pts):
        if not q or p[0] - q[-1][0] > 1e-5: q.append(p)
    xs = [p[0] for p in q]; ys = [p[1] for p in q]; n = len(q)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]; dl = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [dl[0]] + [0 if dl[i - 1] * dl[i] <= 0 else 2 * dl[i - 1] * dl[i] / (dl[i - 1] + dl[i]) for i in range(1, n - 1)] + [dl[-1]]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = bisect.bisect_right(xs, x) - 1; t = (x - xs[i]) / h[i]
        return (2 * t**3 - 3 * t * t + 1) * ys[i] + (t**3 - 2 * t * t + t) * h[i] * m[i] + (-2 * t**3 + 3 * t * t) * ys[i + 1] + (t**3 - t * t) * h[i] * m[i + 1]
    return f
clamp = lambda v, a, b: max(a, min(b, v))
sstep = lambda t: (lambda u: u * u * (3 - 2 * u))(clamp(t, 0, 1))

# top silhouette (centre line), ascending x.  Rear bumper step smoothed, spoiler as a short vertical step at x=-1.80.
ZT_PTS = [(-2.0995, .50), (-2.095, .56), (-2.085, .605), (-2.065, .65), (-2.05, .70), (-2.04, .78), (-2.034, .934), (-2.002, 1.056), (-1.95, 1.147),
          (-1.90, 1.200), (-1.836, 1.262), (-1.79, 1.31), (-1.745, 1.36), (-1.742, 1.452), (-1.725, 1.465), (-1.70, 1.478), (-1.564, 1.498), (-1.428, 1.515), (-1.308, 1.529),
          (-1.209, 1.534), (-1.062, 1.544), (-.915, 1.554), (-.768, 1.561), (-.62, 1.566), (-.473, 1.569), (-.399, 1.566), (-.252, 1.561), (-.105, 1.554),
          (.042, 1.542), (.116, 1.529), (.19, 1.515), (.263, 1.488), (.411, 1.422), (.558, 1.346), (.705, 1.267), (.852, 1.184), (1.0, 1.091), (1.04, 1.062),
          (1.147, 1.064), (1.294, 1.051), (1.439, 1.032), (1.585, 1.007), (1.731, .973), (1.876, .919), (1.942, .873), (1.966, .846), (2.005, .804), (2.039, .743),
          (2.052, .66), (2.095, .576), (2.0985, .52), (2.1015, .38)]
_zt = spline(ZT_PTS)
def ZT(x):
    f = sstep((x + 1.88) / .1) * (1 - sstep((x - .10) / .16))      # roof stretch only
    return _zt(x) - ROOFLOW * f
ZB = spline([(-2.0995, .46), (-2.093, .436), (-2.063, .346), (-2.03, .29), (-1.995, .257), (-1.768, .233), (-1.006, .199), (-.939, .191), (-.694, .213), (.411, .211),
             (.656, .199), (.86, .186), (1.634, .186), (1.714, .199), (1.859, .199), (2.053, .213), (2.095, .24), (2.1015, .27)])
PLAN = spline([(-2.0995, .225), (-2.099, .236), (-2.086, .26), (-2.05, .458), (-1.995, .559), (-1.836, .783), (-1.7, .845), (-1.564, .859), (-1.136, .868), (.042, .88),
               (.484, .875), (.926, .866), (1.512, .861), (1.658, .849), (1.803, .814), (1.949, .731), (2.083, .441), (2.095, .349), (2.1015, .30)])
# section (half width vs height) from the front-view silhouette, normalised by the 0.885 maximum; ridge = shoulder crease
_sec = spline([(.19, .745), (.24, .775), (.30, .805), (.45, .88), (.75, .885), (1.0, .86), (1.25, .80), (1.45, .70), (1.54, .60)])
def SEC(z): return _sec(z) + .009 * max(0, 1 - abs(z - .905) / .028)
ZCL = spline([(-2.0, .28), (-1.8, .31), (-1.3, .33), (1.3, .33), (1.7, .31), (2.0, .28)])      # sill cladding top
RC, CROWN = 0.085, 0.012
ARCHES = [(XF, WR), (XR, WR)]

def ws(x, z): return SEC(z) * PLAN(x) / .885
def arch_top(x):
    t = -9
    for xc, zc in ARCHES:
        d = x - xc
        if abs(d) < ARCH_R: t = max(t, zc + math.sqrt(ARCH_R**2 - d * d))
    return t
def params(x):
    zb, zt = ZB(x), ZT(x); h = zt - zb
    rc = min(RC, .35 * h); crown = min(CROWN, .08 * h)
    zsh = zt - crown - rc
    cy = ws(x, zsh) - rc
    if cy < .02: rc = max(.005, ws(x, zsh) - .02); zsh = zt - crown - rc; cy = ws(x, zsh) - rc
    return zb, zt, rc, crown, zsh, max(cy, .01)
def halfw(x, z):                                   # outer half-width at height z (outer wall, ignoring arch cut); -1 outside
    zb, zt, rc, crown, zsh, cy = params(x)
    if z < zb or z > zt - crown: return -1
    if z <= zsh: return ws(x, z) + (DCL if z <= ZCL(x) else 0)
    return cy + math.sqrt(max(0, rc * rc - (z - zsh) ** 2))
def top_z(x, y):
    zb, zt, rc, crown, zsh, cy = params(x); y = abs(y)
    if y <= cy: return zt - crown * (y / cy) ** 2
    return zsh + math.sqrt(max(0, rc * rc - (y - cy) ** 2))

# ---------------------------------------------------------------- buffers
BM = {s: bmesh.new() for s in SEMS}
LAY = {s: BM[s].loops.layers.color.new('Color') for s in SEMS}
def mk(sem, pts, col=None):
    bm = BM[sem]; vs = [bm.verts.new(p) for p in pts]
    try: f = bm.faces.new(vs)
    except ValueError: return None
    for l in f.loops: l[LAY[sem]] = col or WHITE
    return f
def mkv(sem, vs, col):                             # face from existing verts
    bm = BM[sem]
    try: f = bm.faces.new(vs)
    except ValueError: return None
    for l in f.loops: l[LAY[sem]] = col
    return f
def orient(pts, out):                               # reverse winding so the face normal points along `out`
    n = Vector((0, 0, 0))
    for i in range(len(pts)): n += pts[i].cross(pts[(i + 1) % len(pts)])
    return pts if n.dot(out) >= 0 else pts[::-1]

# ---------------------------------------------------------------- hull loft
ANCH = [.25, 'c0', 'c1', .5, .7, .84, .905, .96, 1.06, 1.18, 1.3, 1.4, 1.46]
NA, NT = 4, 3
def half_ring(x):
    zb, zt, rc, crown, zsh, cy = params(x)
    y_in = min(Y_IN, ws(x, zb) - .06); za = max(zb, arch_top(x)); zcl = ZCL(x)
    P = [(0, zb, 'x'), (y_in, zb, 'under'), (y_in, za, 'liner'), (ws(x, za) + (DCL if za <= zcl else 0), za, 'ceil')]
    for a in ANCH:
        zz = zcl if a == 'c0' else zcl + .004 if a == 'c1' else a
        z = clamp(zz, za, zsh)
        w = ws(x, z) + (DCL if (z <= zcl + 1e-9 and a != 'c1') else 0)
        P.append((w, z, 'clad' if z <= zcl + .0045 else 'wall'))
    P.append((ws(x, zsh), zsh, 'wall')) if abs(P[-1][1] - zsh) > 1e-6 else None
    for k in range(1, NA + 1):
        a = k / NA * math.pi / 2; P.append((cy + rc * math.cos(a), zsh + rc * math.sin(a), 'top'))
    for j in range(1, NT + 1):
        y = cy * (1 - j / NT); P.append((y, zt - crown * (y / cy) ** 2, 'top'))
    return P

def stations():
    xs = {-LEN_HALF, LEN_HALF + .0015}
    for x in (-2.095, -2.08, -2.06, -2.04, -2.02, -1.995, -1.95, -1.92, -1.88, -1.85, -1.81, -1.775, -1.762, -1.759, -1.74, -1.7, -1.6, -1.5, -.9, -.7, -.5, -.3, -.1,
              .1, .2, .3, .4, .5, .6, .7, .8, .9, .97, 1.04, 1.1, 1.75, 1.85, 1.95, 2.0, 2.04, 2.07, 2.095, 2.0985): xs.add(x)
    for xc, zc in ARCHES:
        t0 = math.asin((.2 - zc) / ARCH_R)
        for k in range(0, 9):
            t = t0 + (math.pi / 2 - t0) * k / 8
            for s in (-1, 1): xs.add(round(xc + s * ARCH_R * math.cos(t), 4))
    xs = sorted(xs); out = []
    for x in xs:
        if not out or x - out[-1] > .0009: out.append(x)
    return out

# regions (point-in-polygon) used to turn hull paint under windows into dark interior (so see-through glass shows a cabin, not paint)
def pip(poly, p):
    c = False; n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c
def clip_x(poly, x0, x1):                           # Sutherland-Hodgman on x
    def cut(pl, keep, k):
        o = []
        for i in range(len(pl)):
            a, b = pl[i], pl[(i + 1) % len(pl)]; ia, ib = keep(a), keep(b)
            if ia: o.append(a)
            if ia != ib:
                t = (k - a[0]) / (b[0] - a[0]); o.append((k, a[1] + (b[1] - a[1]) * t))
        return o
    return cut(cut(poly, lambda p: p[0] >= x0, x0), lambda p: p[0] <= x1, x1)
def inflate(poly, d):                               # miter offset of a (counter)clockwise polygon outward by d
    n = len(poly); a2 = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n)); sg = 1 if a2 > 0 else -1
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % n])
        e1 = (p1 - p0).normalized(); e2 = (p2 - p1).normalized()
        n1 = Vector((e1.y, -e1.x)) * sg; n2 = Vector((e2.y, -e2.x)) * sg; m = (n1 + n2)
        m = m / max(.3, 1 + n1.dot(n2)) if m.length > 1e-6 else n1
        q = p1 + m * d; out.append((q.x, q.y))
    return out
DLO = [tuple(p) for p in PROF['dlo']]
GL_FRONT = clip_x(DLO, -.27, 2); GL_REAR = clip_x(DLO, -1.0, -.42); GL_QUART = clip_x(DLO, -1.4, -1.07)
SIDE_GLASS = [GL_FRONT, GL_REAR, GL_QUART]
SCREEN = [(1.04, .66), (1.04, -.66), (.275, -.585), (.275, .585)]          # (x,y) windscreen on the top skin
RSCREEN = [(-1.915, .50), (-1.915, -.50), (-1.755, -.55), (-1.755, .55)]   # rear glass

def build_hull():
    xs = stations(); rings = []
    for x in xs:
        h = half_ring(x); n = len(h)
        pts = [(h[i][0], h[i][1]) for i in range(n)]; tags = [h[i][2] for i in range(n)]
        full = [(y, z) for y, z in pts] + [(-y, z) for y, z in pts[-2:0:-1]]
        ftag = tags[1:] + ['top'] * 0
        # tags[i] describes segment i-1 -> i on the +y side; mirrored side reuses them reversed
        seg = tags[1:n] + tags[n - 1:1:-1] + [tags[1]]
        rings.append((x, full, seg))
    keyed = {}
    def V(sem, k, p):
        if (sem, k) not in keyed: keyed[(sem, k)] = BM[sem].verts.new(p)
        return keyed[(sem, k)]
    N = len(rings[0][1])
    for si in range(len(rings) - 1):
        xa, ra, _ = rings[si]; xb, rb, tg = rings[si + 1]
        for i in range(N):
            j = (i + 1) % N; tag = tg[i] if i < len(tg) else 'wall'
            qa = [Vector((xa, *ra[i])), Vector((xa, *ra[j])), Vector((xb, *rb[j])), Vector((xb, *rb[i]))]
            c = sum(qa, Vector()) / 4; xm, ym, zm = c
            allin = lambda poly, ax: all(pip(poly, (q.x, q.z if ax == 'z' else q.y)) for q in qa)
            if tag in ('under', 'liner', 'ceil', 'clad'):
                sem, col = 'FleetTrim', BLACK if tag != 'under' else RUBBER
            else:
                sem, col = 'FleetBody', WHITE
                if tag == 'top' and (allin(SCREEN, 'y') or allin(RSCREEN, 'y')): sem, col = 'FleetInterior', INT
                if tag in ('wall', 'top') and abs(ym) > .45 and any(allin([(a, b) for a, b in g], 'z') for g in SIDE_GLASS): sem, col = 'FleetInterior', INT
            ids = [(si, i), (si, j), (si + 1, j), (si + 1, i)]
            vs = [V(sem, k, qa[m_]) for m_, k in enumerate(ids)]
            if len(set(id(v) for v in vs)) < 4 or (qa[0] - qa[3]).length < 1e-7 and (qa[1] - qa[2]).length < 1e-7: continue
            f = mkv(sem, vs, col)
    for end, (idx, sign) in ((0, (0, -1)), (1, (len(rings) - 1, 1))):
        x, ring, _ = rings[idx]; c = Vector((x, 0, sum(p[1] for p in ring) / len(ring)))
        for i in range(N):
            a, b = Vector((x, *ring[i])), Vector((x, *ring[(i + 1) % N]))
            pts = [c, a, b] if sign > 0 else [c, b, a]
            mk('FleetBody', pts, WHITE)
    return rings

# ---------------------------------------------------------------- decals / slabs projected onto the hull
def surf_x(y, z, front):
    z = max(z, .202 if front else .262)
    ins = lambda x: halfw(x, z) >= abs(y)
    if front:
        a, b = 1.0, LEN_HALF + .0015
        for _ in range(34):
            m = (a + b) / 2
            if ins(m): a = m
            else: b = m
        return a
    a, b = -LEN_HALF, -1.0
    for _ in range(34):
        m = (a + b) / 2
        if ins(m): b = m
        else: a = m
    return b
def M_front(y, z, o): return Vector((surf_x(y, z, True) + o, y, z))
def M_rear(y, z, o): return Vector((surf_x(y, z, False) - o, y, z))
def halfw_c(x, z):                                  # like halfw but z is clamped onto the hull so decals never fly off
    zb, zt, rc, crown, zsh, cy = params(x); return halfw(x, clamp(z, zb + .0005, zt - crown - .0005))
def M_side(s): return lambda x, z, o: Vector((x, s * (halfw_c(x, z) + o), z))
def M_top(x, y, o): return Vector((x, y, top_z(x, y) + o))
def OUTV(M): return lambda u, v: (M(u, v, .05) - M(u, v, 0)).normalized()

def resample(poly, step):
    out = []
    for i in range(len(poly)):
        a, b = Vector(poly[i]), Vector(poly[(i + 1) % len(poly)]); n = max(1, int(math.ceil((b - a).length / step)))
        for k in range(n): out.append(tuple(a + (b - a) * k / n))
    return out

def slab(M, poly, thick, sem, col, step=.08, cuts=0, ins=0.0, base=-.004, wall_col=None):
    """Raised (or flush when thick small) panel on the hull: poly in the mapper's (u,v) plane.  Constrained-Delaunay fill with interior
    points every `step` so the cap follows the curved hull instead of cutting through it."""
    poly = resample(poly, step); n = len(poly)
    cen = Vector((sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n)); rad = sum((Vector(p) - cen).length for p in poly) / n
    k = 1 - ins / rad if ins else 1.0
    cap2 = [tuple(cen + (Vector(p) - cen) * k) for p in poly]
    pts = [Vector(p) for p in cap2]
    us = [p[0] for p in cap2]; vs_ = [p[1] for p in cap2]
    gx = min(us) + step * .5
    while gx < max(us):
        gy = min(vs_) + step * .5
        while gy < max(vs_):
            q = (gx, gy)
            if pip(cap2, q) and min((Vector(q) - Vector(c)).length for c in cap2) > step * .55: pts.append(Vector(q))
            gy += step
        gx += step
    v, e, f, _, _, _ = delaunay_2d_cdt(pts, [], [list(range(n))], 3, 1e-6)
    for t in f:
        c3 = [v[i] for i in t]; P = [M(q.x, q.y, thick) for q in c3]
        o = OUTV(M)(sum(q.x for q in c3) / len(c3), sum(q.y for q in c3) / len(c3))
        mk(sem, orient(P, o), col)
    cen3 = M(cen.x, cen.y, thick / 2)
    for i in range(n):
        j = (i + 1) % n
        q = [M(poly[i][0], poly[i][1], base), M(poly[j][0], poly[j][1], base), M(cap2[j][0], cap2[j][1], thick), M(cap2[i][0], cap2[i][1], thick)]
        mk(sem, orient(q, sum(q, Vector()) / 4 - cen3), wall_col or col)

_SL = slab
def slab(M, poly, thick, sem, col, *a, **k):
    n0 = sum(len(f.verts) - 2 for f in BM[sem].faces); _SL(M, poly, thick, sem, col, *a, **k)
    d = sum(len(f.verts) - 2 for f in BM[sem].faces) - n0
    if d > 120: print('SLAB', sem[5:9], d, [round(c, 2) for c in poly[0]], len(poly))
def offs_path(pts, w):
    pts = [Vector(p) for p in pts]; L, R = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized(); nrm = Vector((-d.y, d.x))
        L.append(tuple(p + nrm * w / 2)); R.append(tuple(p - nrm * w / 2))
    return L + R[::-1]
def strip(M, pts, w, thick, sem, col, step=.10, **kw):
    dense = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b); n = max(1, int(math.ceil((b - a).length / step)))
        dense += [tuple(a + (b - a) * k / n) for k in range(n)]
    dense.append(tuple(pts[-1])); slab(M, offs_path(dense, w), thick, sem, col, step=step, **kw)
def sym(poly): return poly + [(-u, v) for u, v in poly[::-1]]
def rrect(u0, u1, v0, v1, r=.012, n=3):
    pts = []
    for cu, cv, a0 in ((u1 - r, v1 - r, 0), (u0 + r, v1 - r, 90), (u0 + r, v0 + r, 180), (u1 - r, v0 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((cu + r * math.cos(a), cv + r * math.sin(a)))
    return pts
def circle(cu, cv, r, n=20): return [(cu + r * math.cos(2 * math.pi * k / n), cv + r * math.sin(2 * math.pi * k / n)) for k in range(n)]

# ---------------------------------------------------------------- solids (mirrors, wheels, rails)
def ellipsoid(sem, c, rad, col, us=14, vs_=8, rot=0):
    c = Vector(c)
    P = lambda i, j: c + Vector((rad[0] * math.sin(math.pi * j / vs_) * math.cos(2 * math.pi * i / us), rad[1] * math.sin(math.pi * j / vs_) * math.sin(2 * math.pi * i / us), rad[2] * math.cos(math.pi * j / vs_)))
    for i in range(us):
        for j in range(vs_):
            q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
            if j == 0: q = [q[0], q[2], q[3]]
            elif j == vs_ - 1: q = [q[0], q[1], q[2]]
            mk(sem, orient(q, sum(q, Vector()) / len(q) - c), col)
def box(sem, c, s, col, bev=0.0):
    c = Vector(c); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    V = [c + Vector((sx * hx, sy * hy, sz * hz)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        q = [V[i] for i in idx]; mk(sem, orient(q, sum(q, Vector()) / 4 - c), col)
def tyre_wheel(xc, s):
    """Static merged wheel: tyre (revolved profile), chrome-lipped alloy with 5 forked spokes, dark dish, brake disc + caliper."""
    zc = WR; yc = s * HALFTRACK; core = .28
    prof = [(.236, .082), (.256, .099), (.292, .1075), (.314, .093), (.3258, .055), (.3258, -.055), (.314, -.093), (.292, -.1075), (.256, -.099), (.236, -.082)]
    NS = 28; ang = lambda k: 2 * math.pi * k / NS
    rows = [[Vector((xc + r * math.cos(ang(k)), yc + s * yo, zc + r * math.sin(ang(k)))) for k in range(NS)] for r, yo in prof]
    for a, b in zip(rows, rows[1:]):
        for k in range(NS):
            q = [a[k], a[(k + 1) % NS], b[(k + 1) % NS], b[k]]; mid = sum(q, Vector()) / 4
            d = Vector((mid.x - xc, 0, mid.z - zc)).normalized(); mk('FleetRubber', orient(q, mid - Vector((xc + d.x * core, yc, zc + d.z * core))), RUBBER)
    P = lambda r, yo, a: Vector((xc + r * math.cos(a), yc + s * yo, zc + r * math.sin(a)))
    out = Vector((0, s, 0)); inn = Vector((0, -s, 0))
    for k in range(NS):                                             # chrome lip, barrel, dark dish floor
        a0, a1 = ang(k), ang(k + 1)
        mk('FleetTrim', orient([P(.236, .082, a0), P(.236, .082, a1), P(.222, .076, a1), P(.222, .076, a0)], out), CHROME)
        q = [P(.222, .076, a0), P(.222, .076, a1), P(.205, .028, a1), P(.205, .028, a0)]; mk('FleetTrim', orient(q, Vector((xc, yc, zc)) - sum(q, Vector()) / 4), DARKALLOY)
        mk('FleetTrim', orient([Vector((xc, yc + s * .024, zc)), P(.205, .028, a1), P(.205, .028, a0)], out), BLACK)
        mk('FleetTrim', orient([Vector((xc, yc + s * .036, zc)), P(.18, .036, a1), P(.18, .036, a0)], out), (.07, .075, .08, 1))   # brake disc
    for i in range(5):
        for fk in (-1, 1):
            al = ang(0) + 2 * math.pi * i / 5 + math.radians(18) + fk * math.radians(13)
            d = Vector((math.cos(al), 0, math.sin(al))); nrm = Vector((-d.z, 0, d.x))
            c0 = Vector((xc, 0, zc)) + d * .045; c1 = Vector((xc, 0, zc)) + d * .222
            w0, w1 = .028, .068; y0, y1 = yc + s * .052, yc + s * .080; yf = yc + s * .030            # concave: hub end sits deeper than the rim end
            T = lambda c, w, sg, y: Vector((c.x, y, c.z)) + nrm * (w / 2 * sg)
            top = [T(c0, w0, -1, y0), T(c1, w1, -1, y1), T(c1, w1, 1, y1), T(c0, w0, 1, y0)]
            mk('FleetTrim', orient(top, out), (.66, .68, .71, 1))
            cen = sum(top, Vector()) / 4
            for A, B in ((top[0], top[1]), (top[1], top[2]), (top[2], top[3]), (top[3], top[0])):
                A2 = Vector((A.x, yf, A.z)); B2 = Vector((B.x, yf, B.z)); q = [A, B, B2, A2]
                mk('FleetTrim', orient(q, (A + B) / 2 - Vector((cen.x, (A.y + B.y) / 2, cen.z))), DARKALLOY)
    hc = Vector((xc, yc + s * .074, zc)); hb = [P(.046, .064, ang(k * 2)) for k in range(15)]
    for k in range(15): mk('FleetTrim', orient([hc, hb[k], hb[(k + 1) % 15]], out), SILVER)
    cal = [P(.10, .05, math.radians(115)), P(.19, .05, math.radians(75)), P(.19, .05, math.radians(105)), P(.10, .05, math.radians(140))]
    mk('FleetTrim', orient(cal, out), (.5, .03, .03, 1))

def part_side(s):
    M = M_side(s)
    for g in SIDE_GLASS:
        slab(M, inflate(g, .016), .003, 'FleetTrim', BLACK, step=.10, base=-.002)
        slab(M, g, .007, 'FleetGlass', GLASS, step=.10, base=-.002)
    strip(M, [(-1.04, 1.10), (-1.03, 1.44)], .034, .006, 'FleetTrim', BLACK, base=-.002)
    strip(M, [(-.40, 1.09), (-.40, 1.47)], .10, .0055, 'FleetTrim', BLACK, base=-.002, step=.06)
    strip(M, [(-1.28, .992), (-.3, .972), (.78, .925)], .004, .0015, 'FleetTrim', BLACK, base=-.002, step=.2)
    for pts in ([(.78, .99), (.785, .70), (.78, .36)], [(-.28, .99), (-.285, .70), (-.28, .36)], [(-1.265, 1.12), (-1.245, .95), (-1.205, .78), (-1.175, .66)]):
        strip(M, pts, .005, .004, 'FleetTrim', BLACK, base=-.002, step=.06)
    for hx in (-1.03, -.12):
        slab(M, rrect(hx - .075, hx + .075, .955, .985, .012), .014, 'FleetBody', WHITE, step=.03, ins=.004)
        slab(M, rrect(hx - .09, hx + .09, .935, 1.005, .02), .002, 'FleetTrim', BLACK, step=.04, base=-.002)
    strip(M, [(-.98, .335), (.82, .335)], .012, .006, 'FleetTrim', SILVER, base=-.002, step=.2)
    for xc, zc in ARCHES:
        a0 = math.asin((.19 - zc) / ARCH_R); N = 22
        ang = lambda k: a0 + (math.pi - 2 * a0) * k / N
        outer = [(xc + (ARCH_R + .07) * math.cos(ang(k)), zc + (ARCH_R + .07) * math.sin(ang(k))) for k in range(N + 1)]
        inner = [(xc + (ARCH_R + .002) * math.cos(ang(k)), zc + (ARCH_R + .002) * math.sin(ang(k))) for k in range(N + 1)]
        poly = [(x, clamp(z, .19, 2)) for x, z in outer + inner[::-1]]
        slab(M, poly, .016, 'FleetTrim', BLACK, step=.07, base=-.002)
    mx, mz = .60, 1.115
    ellipsoid('FleetBody', (mx, s * .865, mz), (.085, .075, .052), WHITE, 14, 8)
    ellipsoid('FleetTrim', (mx - .02, s * .878, mz + .004), (.062, .062, .042), BLACK, 10, 6)
    box('FleetTrim', (mx + .01, s * .80, mz - .06), (.09, .055, .018), BLACK)
    for xc in (XF, XR): tyre_wheel(xc, s)
    slab(M, rrect(1.83, 1.91, .78, .80, .005), .004, 'FleetLights', AMBER, step=.03, base=-.002)

def part_front():
    M = M_front
    lamp = [tuple(p) for p in PROF['headlamp']]
    for s in (-1, 1):
        L = [(s * y, z) for y, z in lamp]
        slab(M, L, .012, 'FleetTrim', BLACK, step=.03, ins=.003)
        slab(M, L, .016, 'FleetLights', (.82, .87, .92, 1), step=.025, ins=.014, base=.004)
        cu, cv = s * .66, .735
        slab(M, [(cu + (u - cu) * .5 + s * .02, cv + (v - cv) * .55 - .005) for u, v in L], .018, 'FleetTrim', DARKALLOY, step=.02, ins=.004, base=.004)
        strip(M, [(s * .52, .787), (s * .63, .806), (s * .74, .822), (s * .815, .81)], .010, .019, 'FleetLights', LAMPW, base=.004, step=.04)
    g = [tuple(p) for p in PROF['grille']]
    slab(M, sym(g), .010, 'FleetTrim', BLACK, step=.05, base=-.002)
    for z, h in ((.745, .60), (.703, .50), (.660, .50)):
        strip(M, [(-h, z), (h, z)], .013, .014, 'FleetTrim', CHROME, base=-.002, step=.08)
    for z in (.725, .682): strip(M, [(-.47, z), (.47, z)], .014, .011, 'FleetTrim', (.03, .035, .04, 1), base=-.002, step=.12)
    slab(M, circle(0, .70, .060), .019, 'FleetTrim', CHROME, step=.02, ins=.006, base=-.002)
    slab(M, circle(0, .70, .043), .022, 'FleetTrim', (.03, .1, .35, 1), step=.02, ins=.004, base=-.002)
    it = [tuple(p) for p in PROF['intake']]
    slab(M, sym(it), .010, 'FleetTrim', BLACK, step=.06, base=-.002)
    for z in (.40, .35, .30, .25, .20): strip(M, [(-.42 + (.4 - z) * .3, z), (.42 - (.4 - z) * .3, z)], .007, .012, 'FleetTrim', (.075, .08, .085, 1), base=-.002, step=.1)
    for s in (-1, 1):
        slab(M, [(s * u, v) for u, v in rrect(.68, .80, .385, .495, .02)], .014, 'FleetTrim', (.05, .055, .06, 1), step=.03, ins=.004, base=-.002)
        slab(M, [(s * u, v) for u, v in rrect(.70, .78, .405, .475, .014)], .017, 'FleetLights', LAMPW, step=.025, ins=.003, base=-.002)
    slab(M, sym([(0, .205), (.30, .205), (.40, .275), (0, .275)]), .014, 'FleetTrim', SILVER, step=.06, base=-.002)
    for s in (-1, 1):
        strip(M_top, [(1.06, s * .735), (1.45, s * .73), (1.85, s * .70), (1.97, s * .64)], .006, .002, 'FleetTrim', BLACK, base=-.002, step=.1)
    strip(M, [(-.66, .795), (.66, .795)], .006, .003, 'FleetTrim', BLACK, base=-.002, step=.1)
    for s in (-1, 1): strip(M_top, [(1.08, s * .60), (1.5, s * .45), (1.93, s * .30)], .005, .003, 'FleetTrim', BLACK, base=-.002, step=.12)
    strip(M_top, [(1.02, .62), (.92, .0)], .012, .004, 'FleetTrim', BLACK, base=-.002, step=.1)
    strip(M_top, [(1.02, -.02), (.92, -.62)], .012, .004, 'FleetTrim', BLACK, base=-.002, step=.1)

def part_rear():
    M = M_rear
    # wide horizontal tail lamps at the top corners, wrapping the corner, joined by a full-width black band with chrome strip and VW logo
    lamp = [(.565, .93), (.58, .99), (.62, 1.03), (.70, 1.04), (.78, 1.035), (.805, 1.0), (.805, .91), (.78, .845), (.70, .83), (.62, .835), (.57, .87)]
    for s in (-1, 1):
        L = [(s * y * RLY / .945 * .945, z) for y, z in lamp]
        slab(M, L, .012, 'FleetTrim', BLACK, step=.03, ins=.003, base=-.004)
        slab(M, L, .016, 'FleetLights', RED, step=.025, ins=.010, base=-.004)
        slab(M, [(s * u, v) for u, v in rrect(.60, .77, .915, .975, .012)], .018, 'FleetLights', (.36, .02, .02, 1), step=.02, ins=.003, base=-.004)     # dark graphic bar
        slab(M, [(s * u, v) for u, v in rrect(.62, .75, .852, .880, .008)], .018, 'FleetLights', (1, .55, .1, 1), step=.02, ins=.002, base=-.004)         # slim amber strip
    slab(M, [(-.60, .925), (.60, .925), (.60, .985), (-.60, .985)], .008, 'FleetTrim', BLACK, step=.06, base=-.004)
    slab(M, [(-.58, .948), (.58, .948), (.58, .960), (-.58, .960)], .0105, 'FleetTrim', CHROME, step=.08, base=-.004)
    slab(M, circle(0, .954, .05), .014, 'FleetTrim', CHROME, step=.02, ins=.005, base=-.004)
    slab(M, circle(0, .954, .035), .017, 'FleetTrim', (.03, .1, .35, 1), step=.02, ins=.004, base=-.004)
    slab(M, rrect(-.18, .18, .862, .902, .018), .004, 'FleetTrim', BLACK, step=.04, base=-.004)                     # handle recess
    slab(M, rrect(-.21, .21, .695, .805, .01), .005, 'FleetTrim', BLACK, step=.05, base=-.004)                      # plate recess, lower tailgate
    slab(M, rrect(-.17, .17, .715, .785, .008), .007, 'FleetTrim', PLATE, step=.04, base=-.004, ins=.002)
    strip(M, [(-.14, .64), (.14, .64)], .018, .003, 'FleetTrim', (.1, .11, .12, 1), base=-.004, step=.07)           # T-CROSS lettering stand-in
    # bumper: black lower with chamfered corners, silver trapezoid skid plate, reflector slots in the body-colour upper
    slab(M, sym([(0, .19), (.50, .19), (.64, .25), (.66, .325), (0, .325)]), .008, 'FleetTrim', BLACK, step=.06, base=-.004)
    slab(M, sym([(0, .205), (.33, .205), (.46, .305), (0, .305)]), .013, 'FleetTrim', SILVER, step=.05, base=-.004)
    for s in (-1, 1):
        slab(M, [(s * u, v) for u, v in rrect(.60, .78, .405, .475, .014)], .010, 'FleetTrim', (.05, .055, .06, 1), step=.03, ins=.003, base=-.004)
        slab(M, [(s * u, v) for u, v in rrect(.62, .76, .42, .46, .01)], .013, 'FleetLights', DRED, step=.025, ins=.002, base=-.004)
    # roof spoiler lip: thin overhang with a visible underside, stop lamp on its rear face
    LIP = [(-1.70, .60), (-1.70, -.60), (-1.78, -.60), (-1.80, -.575), (-1.80, .575), (-1.78, .60)]
    lm = lambda x, y, o: Vector((x, y, 1.454 + o))
    slab(lm, LIP, 0, 'FleetBody', WHITE, step=.07, base=-.03)
    c = Vector((-1.75, 0, 1.424))
    for i in range(len(LIP)):
        q0, q1 = LIP[i], LIP[(i + 1) % len(LIP)]
        mk('FleetTrim', orient([c, Vector((q1[0], q1[1], 1.424)), Vector((q0[0], q0[1], 1.424))], Vector((0, 0, -1))), BLACK)
    slab(lambda y, z, o: Vector((-1.80 - o, y, z)), rrect(-.20, .20, 1.428, 1.448, .004), .004, 'FleetLights', RED, step=.04)

def part_roof():
    for s in (-1, 1):
        # roof rails: silver bar on two feet
        strip(M_top, [(-1.52, s * .575), (.04, s * .565)], .036, .028, 'FleetTrim', (.55, .57, .60, 1), base=.0, step=.08, ins=.006) if True else None
        for x in (-1.50, .02): box('FleetTrim', (x, s * .570, top_z(x, .57) + .004), (.07, .045, .016), BLACK)
    # glass roof borders handled in hull paint; windscreen / rear glass with ceramic border
    slab(M_top, SCREEN, .0015, 'FleetTrim', BLACK, step=.1, cuts=0) if False else None
    scr = inflate(SCREEN[::-1], .02)
    slab(M_top, scr, .002, 'FleetTrim', BLACK, step=.1, cuts=0, base=-.003)
    slab(M_top, SCREEN[::-1], .005, 'FleetGlass', GLASS, step=.1, cuts=0, base=-.003)
    scr = inflate(RSCREEN[::-1], .014)
    slab(M_top, scr, .002, 'FleetTrim', BLACK, step=.08, cuts=0, base=-.003)
    slab(M_top, RSCREEN[::-1], .005, 'FleetGlass', GLASS, step=.08, cuts=0, base=-.003)
    # roof antenna: short fin
    box('FleetTrim', (-1.30, 0, top_z(-1.3, 0) + .02), (.10, .014, .04), BLACK)

# ---------------------------------------------------------------- export
def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Roughness'].default_value = .34 if name in ('FleetBody', 'FleetGlass') else .65
    p.inputs['Metallic'].default_value = .32 if name == 'FleetBody' else .08
    if name == 'FleetGlass': p.inputs['Roughness'].default_value = .16; p.inputs['Metallic'].default_value = .4
    c = m.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name = 'Color'; m.node_tree.links.new(c.outputs['Color'], p.inputs['Base Color'])
    m.use_backface_culling = True
    return m

def finish():
    objs = []
    for sem in SEMS:
        bm = BM[sem]
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=list(bm.edges))
        for f in list(bm.faces):
            if f.calc_area() < 1e-9: bm.faces.remove(f)
        bm.faces.ensure_lookup_table()
        for f in bm.faces: f.smooth = True
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(36): e.smooth = False
        me = bpy.data.meshes.new(sem); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(sem, me); bpy.context.collection.objects.link(ob)
        me.materials.append(material(sem)); me.color_attributes.active_color = me.color_attributes['Color']; me.color_attributes.render_color_index = 0
        if sem == 'FleetBody':
            for c in me.color_attributes['Color'].data: c.color = (1, 1, 1, 1)
        objs.append(ob)
    return objs

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global BM, LAY
    BM = {s: bmesh.new() for s in SEMS}; LAY = {s: BM[s].loops.layers.color.new('Color') for s in SEMS}
    def probe(tag):
        t = {k: sum(len(f.verts) - 2 for f in BM[k].faces) for k in SEMS}; mx = max((abs(v.co.y) for k in SEMS for v in BM[k].verts), default=0); xx = max((v.co.x for k in SEMS for v in BM[k].verts), default=0)
        print('PROBE', tag, {k[5:9]: t[k] for k in SEMS}, 'max|y|', round(mx, 3), 'maxx', round(xx, 3))
    build_hull(); probe('hull'); part_front(); probe('front'); part_rear(); probe('rear'); part_roof(); probe('roof'); part_side(1); probe('side1'); part_side(-1); probe('side2')
    objs = finish()
    bpy.context.view_layer.update()
    allv = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = [min(v[i] for v in allv) for i in range(3)]; hi = [max(v[i] for v in allv) for i in range(3)]
    print('BOUNDS', [round(a, 3) for a in lo], [round(a, 3) for a in hi])
    sh = -(lo[0] + hi[0]) / 2                           # decal offsets nudge the nose 1.3 cm; re-centre lengthwise
    for o in objs:
        for v in o.data.vertices: v.co.x += sh
        o.data.update()
    lo[0] += sh; hi[0] += sh
    root = bpy.data.objects.new('vw-t-cross', None); bpy.context.collection.objects.link(root)
    for o in objs: o.parent = root
    bpy.ops.object.select_all(action='SELECT')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_texcoords=False, export_attributes=False, export_cameras=False, export_lights=False, export_extras=False)
    tris = sum(len(o.data.polygons) and sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs); verts = sum(len(o.data.vertices) for o in objs)
    print('TRIS', tris, 'VERTS', verts, 'BYTES', OUT.stat().st_size, {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs})
    zl = .735; yl = .66; yr = .73 * RLY; zr = .97
    rec = dict(id='vw-t-cross', name='Volkswagen T-Cross', generation='First generation, MY2020 Brazilian long-wheelbase', region='br', path='assets/vehicles/vw-t-cross.glb',
               dimensions=dict(length=round(hi[0] - lo[0], 3), bodyWidth=1.76, height=round(hi[2], 3), wheelbase=round(XF - XR, 3), sourceWheelbase=2.651, widthIncludingMirrors=round(hi[1] - lo[1], 3)),
               axles=dict(front=round(XF + sh, 4), rear=round(XR + sh, 4), height=WR, halfTrack=HALFTRACK, wheelRadius=WR),
               beamAnchors=dict(front=[[round(surf_x(yl, zl, True) + sh + .01, 3), zl, yl], [round(surf_x(yl, zl, True) + sh + .01, 3), zl, -yl]],
                                rear=[[round(surf_x(yr, zr, False) + sh - .01, 3), zr, -yr], [round(surf_x(yr, zr, False) + sh - .01, 3), zr, yr]]),
               triangles=tris, vertices=verts, bytes=OUT.stat().st_size, sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(), meshes=SEMS,
               sources=['https://getoutlines.com/blueprints/car/volkswagen/volkswagen-t-cross-2018.png (visual reference only)',
                        'https://www.volkswagen.com.pe/idhub/content/dam/onehub_pkw/importers/pe/ficha_tecnica/01-2024/VWPer%C3%BA_FichaT%C3%A9cnica_%20T-CrossMY2023-2024.pdf',
                        'https://www.volkswagen-newsroom.com/en/welcome-to-the-family-the-new-t-cross-4306/the-exterior-4311'],
               author='Original Blender geometry; references visual only')
    (HERE / 'record.json').write_text(json.dumps(rec, indent=1) + '\n')
main()
