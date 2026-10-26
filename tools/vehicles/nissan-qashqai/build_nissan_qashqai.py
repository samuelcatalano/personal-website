# Original Nissan Qashqai (J11 facelift, ~2017) for the Three.js city. Dedicated one-car builder (method of tools/vehicles/mini-cooper).
# Run: blender -b --factory-startup -P build_nissan_qashqai.py [-- out.glb]
# Blender axes: nose +X, up +Z, car right side = -Y  (glTF export_yup -> three.js: forward +X, up +Y, right +Z).
# Side silhouette, plan, belt and section are the px-traced numbers of the Nissan CH 2017 brochure line drawings
# (../regional-fleet/profiles/nissan-qashqai.json, vertical axis rescaled to 1.590 m).  Front/rear fascia details read off the same drawings.
# Visual reference only; no external geometry.  Export contract: tools/vehicles/regional-fleet/README.md "Contract".
import bpy, bmesh, bisect, math, sys, json, hashlib, struct
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ID = 'nissan-qashqai'
OUT_GLB = ROOT / 'assets/vehicles/nissan-qashqai.glb'
if '--' in sys.argv and sys.argv[sys.argv.index('--') + 1:]: OUT_GLB = Path(sys.argv[sys.argv.index('--') + 1])

# ---------------------------------------------------------------- numbers
LEN, WID, HGT, WB = 4.394, 1.806, 1.590, 2.646
XF, XR, WR, HALFTRACK = 1.272, -1.374, 0.343, 0.793          # axle x, wheel radius, tyre centre half track
RA, FLARE, INSET = 0.400, 0.070, 0.30                          # arch radius, black flare width, arch cavity depth
HW0 = WID / 2
RAIL_DROP = 0.033                                              # roof panel sits this far under the rail line (rail top = traced height 1.59)

def spline(pts):                                               # monotone cubic (PCHIP), clamps outside range (copied from regional-fleet/build_fleet.py)
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
        return (2 * t ** 3 - 3 * t * t + 1) * ys[i] + (t ** 3 - 2 * t * t + t) * h[i] * m[i] + (-2 * t ** 3 + 3 * t * t) * ys[i + 1] + (t ** 3 - t * t) * h[i] * m[i + 1]
    return f
def sstep(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
TAILK = lambda x: XR + (x - XR) * 1.006 if x < XR else x      # tail table x so the traced tail tip lands on -2.197 (rear overhang)
# upper silhouette (x, z): nose, hood, cowl, windscreen, roof (rail line, see RAIL_DROP), rear glass line under the spoiler, tail face
ZT_PTS = [(2.197, .62), (2.178, .71), (2.154, .822), (2.082, .912), (1.986, .979), (1.818, 1.047), (1.627, 1.087), (1.387, 1.109), (1.10, 1.116), (1.054, 1.121),
          (.912, 1.193), (.722, 1.305), (.533, 1.395), (.296, 1.484), (.107, 1.536), (-.036, 1.568), (-.178, 1.586), (-.367, 1.59), (-.604, 1.581), (-.841, 1.563),
          (-1.078, 1.541), (-1.315, 1.514), (-1.549, 1.484)] + [(TAILK(x), z) for x, z in
          [(-1.62, 1.435), (-1.75, 1.345), (-1.923, 1.226), (-2.064, 1.103), (-2.134, 1.069), (-2.15, .957), (-2.165, .78), (-2.181, .665), (-2.192, .552)]]
ZB_PTS = [(2.197, .418), (2.178, .328), (2.106, .305), (1.95, .288), (1.8, .28), (1.2, .278)] + [(-x, z) for x, z in [(1.2, .278), (1.8, .28)]] + [(TAILK(x), z) for x, z in [(-2.0, .30), (-2.157, .328), (-2.185, .418), (-2.192, .47)]]
HW_PTS = [(2.197, 0.0), (2.1962, .10), (2.194, .19), (2.188, .40), (2.17, .55), (2.1477, .652), (2.068, .734), (1.9007, .829), (1.708, .891), (1.378, .903), (-1.189, .903)] + \
         [(TAILK(x), z) for x, z in [(-1.746, .887), (-1.979, .771), (-2.118, .606), (-2.167, .346), (-2.188, .19), (-2.192, 0.0)]]
BELT_PTS = [(-1.573, .975), (-1.078, .975), (-.604, .961), (-.13, .945), (.343, .93), (.936, .905), (1.531, .934)]
_ZT, _ZB, _HW, _BELT = spline(ZT_PTS), spline(ZB_PTS), spline(HW_PTS), spline(BELT_PTS)
_RAIL = lambda x: sstep((x + 1.42) / .16) * (1 - sstep((x - 0.0) / .14))
ZT = lambda x: _ZT(x) - RAIL_DROP * _RAIL(x)
ZB = _ZB
HW = lambda x: max(0.0, _HW(x))
BELT = _BELT
F_LOW = spline([(.27, .80), (.31, .91), (.335, .965), (.385, .992), (.45, 1.0)])        # wall half width factor vs height (sill tuck)
DY = spline([(0, 0), (.12, .05), (.34, .10), (.48, .20), (.60, .296), (.8, .45)])        # greenhouse tumblehome inset vs height above the beltline
LV = [.335, .385, .45, .52, .60, .68, .76, .84]                  # lower wall levels (absolute): .385 = top of the black cladding
UF = [.2, .45, .68, .86, 1.0]; RC = 0.04; ARCA = [25, 55, 80]; RT = [.88, .68, .45, .22, 0.0]
CROWN = 0.028

def arch_z(x):
    for c in (XF, XR):
        if abs(x - c) < RA: return WR + math.sqrt(RA * RA - (x - c) ** 2)
    return None

def half(x):
    """Right-half ring (from bottom centre to top centre) at station x: [(y, z)] and wheel-cavity flags.
    Fixed rank layout so lofted faces never zig-zag: floor, 2 lower rows, an arch pair (za-3mm / za+3mm; za = wheel arch crown, WR outside the arch span), 6 wall rows, shoulder arc, crown."""
    zt, hw, bz, zbx = ZT(x), HW(x), BELT(x), ZB(x)
    ze = zt - CROWN
    zwt = min(bz, ze - RC - .03)
    za = arch_z(x); zav = za if za else WR
    pl, ph = max(zav - .003, zbx + .004), max(zav + .003, zbx + .008)
    rows = [zbx, zbx + (pl - zbx) * .5, pl, ph] + [ph + (zwt - ph) * u for u in (.2, .45, .7, .88, 1.0)]
    pts, fl = [(0.0, zbx)], [False]
    for i, z in enumerate(rows):
        ins = bool(za) and i <= 2
        y = hw * F_LOW(z)
        pts.append((max(0.0, y - INSET) if ins else y, z)); fl.append(ins)
    for u in UF:
        z = zwt + (ze - RC - zwt) * u; pts.append((max(0.0, hw - DY(z - zwt)), z)); fl.append(False)
    yw = pts[-1][0]; yt = max(0.0, yw - RC)
    for a in ARCA:
        pts.append((max(0.0, yt + RC * math.cos(math.radians(a))), ze - RC + RC * math.sin(math.radians(a)))); fl.append(False)
    for r in RT: pts.append((yt * r, zt - CROWN * r * r)); fl.append(False)
    return pts, fl

_hc = {}
def _half(x):
    k = round(x, 7)
    if k not in _hc: _hc[k] = half(x)[0]
    return _hc[k]
def wall_y(x, z):                                              # outer half width of the body at height z (None above the top)
    h = _half(x); best = None
    for (y1, z1), (y2, z2) in zip(h, h[1:]):
        if z1 == z2 or not (min(z1, z2) - 1e-9 <= z <= max(z1, z2) + 1e-9): continue
        y = y1 + (y2 - y1) * (z - z1) / (z2 - z1)
        if best is None or y > best: best = y
    return best
def top_z(x, y):                                               # body surface height at lateral y (hood / roof / glass)
    h = _half(x); best = None; y = abs(y)
    for (y1, z1), (y2, z2) in zip(h, h[1:]):
        if y1 == y2 or not (min(y1, y2) - 1e-9 <= y <= max(y1, y2) + 1e-9): continue
        z = z1 + (z2 - z1) * (y - y1) / (y2 - y1)
        if best is None or z > best: best = z
    return best if best is not None else h[-1][1]
def inside(x, y, z):
    if abs(x) > 2.1972: return False
    w = wall_y(x, z); return w is not None and w >= abs(y)
def _surf(y, z, sgn):
    """x of the outermost body surface along +x (sgn=1, nose) or -x (sgn=-1, tail) at lateral y, height z: scan in from the tip, then bisect."""
    step = .02; prev = sgn * 2.2
    for i in range(0, 130):
        x = sgn * (2.2 - step * i)
        if inside(x, y, z):
            lo, hi = x, prev
            for _ in range(22):
                m = (lo + hi) / 2
                if inside(m, y, z): lo = m
                else: hi = m
            return lo
        prev = x
    return sgn * 1.0
FX = lambda y, z, off=0.0: Vector((_surf(y, z, 1) + off, y, z))          # point on the nose surface at (y, z), pushed off along +x
RX = lambda y, z, off=0.0: Vector((_surf(y, z, -1) - off, y, z))         # ... tail surface, pushed along -x
def SIDE(x, z, off=0.0, sg=1):                                 # point on the flank (sg=+1 left/+Y, -1 right/-Y)
    return Vector((x, sg * ((wall_y(x, z) or HW0) + off), z))
def TOP(x, y, off=0.0): return Vector((x, y, top_z(x, y) + off))

# ---------------------------------------------------------------- mesh sinks: one bmesh per exported semantic
SEMS = ['FleetBody', 'FleetGlass', 'FleetTrim', 'FleetRubber', 'FleetLights', 'FleetInterior']
bpy.ops.wm.read_factory_settings(use_empty=True)
BM = {s: bmesh.new() for s in SEMS}; CL = {s: BM[s].loops.layers.float_color.new('Color') for s in SEMS}
BODY = ('FleetBody', (1, 1, 1, 1)); GLASS = ('FleetGlass', (.055, .11, .15, 1)); RUB = ('FleetRubber', (.019, .022, .025, 1))
BLK = ('FleetTrim', (.025, .031, .035, 1)); DGR = ('FleetTrim', (.06, .068, .075, 1)); CHR = ('FleetTrim', (.62, .64, .66, 1)); ALY = ('FleetTrim', (.48, .51, .54, 1))
GRY = ('FleetTrim', (.11, .118, .125, 1)); INT = ('FleetInterior', (.033, .04, .048, 1))
LHEAD = ('FleetLights', (.93, .96, 1, 1)); LTAIL = ('FleetLights', (.65, .012, .018, 1)); LAMB = ('FleetLights', (1, .29, .02, 1))
LPF = ('FleetLights', (.82, .86, .88, 1)); LPR = ('FleetLights', (.95, .68, .045, 1)); LREV = ('FleetLights', (.93, .96, 1, 1))
CEN = Vector((0, 0, .8))
def V(m, p): return BM[m[0]].verts.new(p)
def addf(m, vs, ref=CEN, sign=1):
    bm = BM[m[0]]
    try: f = bm.faces.new(vs)
    except ValueError: return None
    f.normal_update(); c = f.calc_center_median(); r = ref(c) if callable(ref) else ref
    if f.normal.dot(c - r) * sign < 0: f.normal_flip()
    for l in f.loops: l[CL[m[0]]] = m[1]
    return f
def grid(m, rows, ref=CEN, sign=1, mf=None):
    vr = [[V(m, p) for p in r] for r in rows]
    for k, (a, b) in enumerate(zip(vr, vr[1:])):
        for i in range(len(a) - 1): addf(mf(k, i) if mf else m, (a[i], a[i + 1], b[i + 1], b[i]), ref, sign)
def fill(m, poly, pt, ns, nt, scan=0, ref=CEN, sign=1, pad=1e-4, mf=None):
    """Surface-conforming patch of a 2D polygon [(a,b)]: scanline variable = a (scan 0) or b (scan 1); pt(a,b)->Vector."""
    ss = [p[scan] for p in poly]; s0, s1 = min(ss) + pad, max(ss) - pad; rows = []
    for k in range(ns + 1):
        s = s0 + (s1 - s0) * k / ns; xs = []
        for p, q in zip(poly, poly[1:] + poly[:1]):
            a, b = p[scan], q[scan]
            if a == b or not (min(a, b) <= s <= max(a, b)): continue
            xs.append(p[1 - scan] + (q[1 - scan] - p[1 - scan]) * (s - a) / (b - a))
        if len(xs) < 2: xs = [xs[0], xs[0]] if xs else [0, 0]
        t0, t1 = min(xs), max(xs)
        rows.append([pt(s, t0 + (t1 - t0) * i / nt) if scan == 0 else pt(t0 + (t1 - t0) * i / nt, s) for i in range(nt + 1)])
    grid(m, rows, ref, sign, mf)
def _uv(n):
    u = (Vector((0, 0, 1)) - n * n.z).normalized() if abs(n.z) < .99 else Vector((1, 0, 0)); return u, n.cross(u)
def disc(m, c, n, r, dome=0.0, seg=14, ref=None):
    u, v = _uv(n); ctr = V(m, c + n * dome); ring = [V(m, c + (v * math.cos(2 * math.pi * k / seg) + u * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)]
    for k in range(seg): addf(m, (ctr, ring[k], ring[(k + 1) % seg]), c - n if ref is None else ref)
def ring_disc(m, c, n, r0, r1, seg=14):
    u, v = _uv(n)
    a = [V(m, c + (v * math.cos(2 * math.pi * k / seg) + u * math.sin(2 * math.pi * k / seg)) * r0) for k in range(seg)]
    b = [V(m, c + (v * math.cos(2 * math.pi * k / seg) + u * math.sin(2 * math.pi * k / seg)) * r1) for k in range(seg)]
    for k in range(seg): addf(m, (a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]), c - n)
def tube(m, c, n, r, length, seg=14, cap=False):
    u, v = _uv(n)
    a = [V(m, c + (v * math.cos(2 * math.pi * k / seg) + u * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)]
    b = [V(m, p.co + n * length) for p in a]
    for k in range(seg): addf(m, (a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]), lambda ctr, c=c, n=n: c + n * ((ctr - c).dot(n)))
    if cap:
        t = V(m, c + n * length)
        for k in range(seg): addf(m, (b[k], b[(k + 1) % seg], t), c)
def torus(m, c, n, R, r, seg=14, sides=5):
    u, v = _uv(n); rings = []
    for k in range(seg):
        a = 2 * math.pi * k / seg; d = u * math.cos(a) + v * math.sin(a); cc = c + d * R
        rings.append([V(m, cc + (d * math.cos(b) + n * math.sin(b)) * r) for b in (2 * math.pi * s / sides for s in range(sides))])
    for k in range(seg):
        A, B = rings[k], rings[(k + 1) % seg]
        for s in range(sides): addf(m, (A[s], A[(s + 1) % sides], B[(s + 1) % sides], B[s]), lambda ctr: c + ((ctr - c) - n * (ctr - c).dot(n)).normalized() * R)
def _paint(bm, sem, col, fs):
    for f in fs:
        for l in f.loops: l[CL[sem]] = col
def box(m, c, s, rot=None):
    bm = BM[m[0]]; r = bmesh.ops.create_cube(bm, size=1.0); vs = r['verts']
    for v in vs:
        p = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
        if rot: p.rotate(rot)
        v.co = Vector(c) + p
    fs = list({f for v in vs for f in v.link_faces}); bmesh.ops.recalc_face_normals(bm, faces=fs); _paint(bm, m[0], m[1], fs)
def ellipsoid(m, c, s, us=12, vs_=8):
    bm = BM[m[0]]; r = bmesh.ops.create_uvsphere(bm, u_segments=us, v_segments=vs_, radius=1.0); vs = r['verts']
    for v in vs: v.co = Vector((c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]))
    fs = list({f for v in vs for f in v.link_faces}); bmesh.ops.recalc_face_normals(bm, faces=fs); _paint(bm, m[0], m[1], fs)
def groove(pts, nrm, w=0.0065, h=0.0016, m=BODY, mg=BLK):      # shallow panel gap: dark floor between two soft lips
    sec = [(-w, 0.0), (-w * .7, h), (-w * .43, h * .8), (-w * .25, 0.0), (w * .25, 0.0), (w * .43, h * .8), (w * .7, h), (w, 0.0)]
    mats = [m, m, m, mg, m, m, m]; n = len(pts); rows = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if i > 0 else p; b = pts[i + 1] if i < n - 1 else p
        t = (b - a).normalized(); nn = nrm(p); l = t.cross(nn).normalized(); rows.append([V(m, p + l * la + nn * hh) for la, hh in sec])
    for i in range(n - 1):
        A, B = rows[i], rows[i + 1]
        for k in range(len(sec) - 1): addf(mats[k], (A[k], A[k + 1], B[k + 1], B[k]))
def strip(m, pts, nrm, w, off=0.0, ref=CEN):                    # flat ribbon of width w following a polyline on a surface
    n = len(pts); rows = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if i > 0 else p; b = pts[i + 1] if i < n - 1 else p
        t = (b - a).normalized(); nn = nrm(p); l = t.cross(nn).normalized(); rows.append([p + l * (-w / 2) + nn * off, p + l * (w / 2) + nn * off])
    grid(m, rows, ref)
def tube_path(m, pts, nrm, r, sides, closed=True):
    n = len(pts); rows = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if (closed or i > 0) else p; b = pts[(i + 1) % n] if (closed or i < n - 1) else p
        t = (b - a).normalized(); nn = nrm(p); l = t.cross(nn).normalized(); mm = t.cross(l).normalized()
        rows.append([V(m, p + (l * math.cos(2 * math.pi * k / sides) + mm * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    for i in range(n if closed else n - 1):
        A, B = rows[i], rows[(i + 1) % n]
        for k in range(sides): addf(m, (A[k], A[(k + 1) % sides], B[(k + 1) % sides], B[k]), lambda ctr, p=pts[i]: p)
def cap_dome(m, c, n, r, h, seg, rings):
    u, v = _uv(n); rs = []
    for j in range(rings):
        ph = math.pi / 2 * j / rings; rr, hh = r * math.cos(ph), h * math.sin(ph)
        rs.append([V(m, c + (v * math.cos(2 * math.pi * k / seg) + u * math.sin(2 * math.pi * k / seg)) * rr + n * hh) for k in range(seg)])
    top = V(m, c + n * h)
    for A, B in zip(rs, rs[1:]):
        for k in range(seg): addf(m, (A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]), c - n * r)
    for k in range(seg): addf(m, (rs[-1][k], rs[-1][(k + 1) % seg], top), c - n * r)
def TRI(label): pass                                           # (debug hook: per-section triangle counts)
UP = lambda p: Vector((0, 0, 1)); OUTY = lambda p: Vector((0, 1 if p.y >= 0 else -1, 0)); XN = lambda p: Vector((1, 0, 0))
def move_faces_to_sinks(tmp, pick):
    """Copy every face of the scratch bmesh `tmp` into the semantic sinks (pick(face)->material tuple); keeps winding."""
    maps = {s: {} for s in SEMS}
    for f in tmp.faces:
        m = pick(f); vm = maps[m[0]]; vs = []
        for v in f.verts:
            if v.index not in vm: vm[v.index] = BM[m[0]].verts.new(v.co)
            vs.append(vm[v.index])
        try: nf = BM[m[0]].faces.new(vs)
        except ValueError: continue
        for l in nf.loops: l[CL[m[0]]] = m[1]

# ================================================================= BODY SHELL (lofted rings along x)
def stations():
    S = {2.197, 2.1962, 2.194, 2.188, 2.17, 2.148, 2.12, 2.068, 2.0, 1.9, 1.8, 1.6, 1.38, 1.1, 1.054, .9, .65, .4, .15, -.1, -.35, -.6, -.85, -1.1, -1.5, -1.65, -1.8, -1.95, -2.03, -2.09, -2.13, -2.16, -2.18, -2.1962, -2.197}
    for c in (XF, XR):
        for d in (0, .14, .27, .34, .385, .398, .402, .46):
            S |= {round(c + d, 4), round(c - d, 4)}
    out = []
    for x in sorted(S):
        if x < -2.197 or x > 2.197: continue
        if out and x - out[-1] < .0035: continue
        out.append(x)
    return out
ST = stations()
SH = bmesh.new(); R = []; FL = []
for x in ST:
    p, fl = half(x)
    pts = [Vector((x, -y, z)) for y, z in p] + [Vector((x, y, z)) for y, z in p[-2:0:-1]]
    R.append([SH.verts.new(q) for q in pts]); FL.append(fl + fl[-2:0:-1])
N = len(R[0]); H = (N + 2) // 2
SHELL = []
for i in range(len(R) - 1):
    for j in range(N):
        j2 = (j + 1) % N
        try: f = SH.faces.new((R[i][j], R[i + 1][j], R[i + 1][j2], R[i][j2]))
        except ValueError: continue
        row = min(j if j < H else N - j, j2 if j2 < H else N - j2)         # half-ring row index (0 = bottom centre)
        SHELL.append((f, any(FL[i][a] or FL[i + 1][a] for a in (j, j2)), row))
bmesh.ops.remove_doubles(SH, verts=list(SH.verts), dist=1e-5)
bmesh.ops.recalc_face_normals(SH, faces=list(SH.faces))
NONMAN = sum(1 for e in SH.edges if not e.is_manifold)
KIND = {f: (ins or row <= 2) for f, ins, row in SHELL if f.is_valid}
move_faces_to_sinks(SH, lambda f: BLK if KIND.get(f) else BODY)
SH.free()

# ================================================================= WHEELS (static, merged), ARCH FLARES, SILL CLADDING
TYRE = [(.213, -.085), (.236, -.097), (.28, -.097), (.322, -.08), (.341, -.04), (.343, 0), (.341, .04), (.322, .08), (.28, .097), (.236, .097), (.213, .085)]
WSEG = 24
def wheel(cx, side):
    sx = 1 if side > 0 else -1                                  # right-hand wheels are the left ones turned 180 degrees about Z (outer face outwards)
    W = lambda r, y, th: Vector((cx + sx * r * math.cos(th), side * (HALFTRACK + y), WR + r * math.sin(th)))
    axis = Vector((cx, side * HALFTRACK, WR)); radial = lambda c: Vector((cx, c.y, WR))
    ring = lambda m, r, y: [V(m, W(r, y, 2 * math.pi * k / WSEG)) for k in range(WSEG)]
    def band(m, a, b, ref, sign=1):
        for k in range(WSEG): addf(m, (a[k], a[(k + 1) % WSEG], b[(k + 1) % WSEG], b[k]), ref, sign)
    def fan(m, c, a, ref):
        h = V(m, c)
        for k in range(WSEG): addf(m, (h, a[k], a[(k + 1) % WSEG]), ref)
    rs = [ring(RUB, r, y) for r, y in TYRE]
    for a, b in zip(rs, rs[1:]): band(RUB, a, b, radial)
    out = lambda c: Vector((cx, side * (HALFTRACK - .6), WR))                     # reference far outside: faces turn their normal toward the viewer side
    lip_o, lip_i = ring(ALY, .213, .086), ring(ALY, .201, .082); band(ALY, lip_i, lip_o, out)
    bar_a, bar_b = ring(BLK, .201, .082), ring(BLK, .201, .0); band(BLK, bar_a, bar_b, radial, -1)   # rim barrel (visible through the spokes)
    dk = ring(BLK, .201, .02); fan(BLK, Vector((cx, side * (HALFTRACK + .02), WR)), dk, out)          # dark disc behind the spokes
    for s_ in range(10):                                        # ten slanted turbine spokes, concave dish
        a0 = 2 * math.pi * s_ / 10 + .10; w0, w1 = .019, .030
        P = lambda r, y, w, a0=a0: W(math.hypot(r, w), y, a0 + math.atan2(w, r))
        rr = (.06, .13, .201); yy = (.058, .068, .082)
        L = [P(r, y, -w) for r, y, w in zip(rr, yy, (w0, (w0 + w1) / 2, w1))]; R_ = [P(r, y, w) for r, y, w in zip(rr, yy, (w0, (w0 + w1) / 2, w1))]
        Lb = [Vector((p.x, p.y - side * .014, p.z)) for p in L]; Rb = [Vector((p.x, p.y - side * .014, p.z)) for p in R_]
        for k in range(2):
            addf(ALY, (V(ALY, L[k]), V(ALY, R_[k]), V(ALY, R_[k + 1]), V(ALY, L[k + 1])), out)
            addf(ALY, (V(ALY, R_[k]), V(ALY, Rb[k]), V(ALY, Rb[k + 1]), V(ALY, R_[k + 1])), lambda c, ax=axis: ax)
            addf(ALY, (V(ALY, Lb[k]), V(ALY, L[k]), V(ALY, L[k + 1]), V(ALY, Lb[k + 1])), lambda c, ax=axis: ax)
    hub = ring(ALY, .052, .06); fan(ALY, Vector((cx, side * (HALFTRACK + .074), WR)), hub, out)
    band(ALY, ring(ALY, .052, .045), hub, radial)
    brk = ring(DGR, .19, .008); fan(DGR, Vector((cx, side * (HALFTRACK + .008), WR)), brk, out)       # brake disc just behind the dark disc

for cx in (XF, XR):
    for side in (1, -1): wheel(cx, side)

TRI('wheels')
for cx in (XF, XR):                                             # black arch flares
    for sg in (1, -1):
        rows = []
        for r, off in ((RA + .001, .003), (RA + .008, .011), (RA + .03, .013), (RA + FLARE - .008, .013), (RA + FLARE, .002)):
            path = [(cx + r, .305)] + [(cx + r * math.cos(math.radians(a)), WR + r * math.sin(math.radians(a))) for a in range(0, 181, 15)] + [(cx - r, .305)]
            path = [(x, max(z, .305)) for x, z in path]
            rows.append([SIDE(x, z, off, sg) for x, z in path])
        grid(BLK, rows, lambda c: Vector((0, 0, .8)))
for sg in (1, -1):                                              # sill cladding between the arches
    xs = [XF - RA - .03 - (XF - RA - .03 - (XR + RA + .03)) * i / 10 for i in range(11)]
    rows = [[SIDE(x, z, off, sg) for z, off in ((.346, .002), (.352, .010), (.402, .010), (.41, .002))] for x in xs]
    grid(BLK, rows)

TRI('flares+sill')
# ================================================================= GLASSHOUSE: window frames, glass, chrome kick-up line, screens
DLO = [(0.793, 1.024), (0.789, 1.064), (0.533, 1.26), (0.296, 1.395), (0.107, 1.462), (-0.13, 1.491), (-0.415, 1.491), (-0.841, 1.469), (-1.125, 1.44), (-1.232, 1.383), (-1.409, 1.372),
       (-1.514, 1.305), (-1.456, 1.249), (-1.267, 1.148), (-1.078, 1.125), (-0.841, 1.096), (-0.367, 1.058), (0.107, 1.042)]
def dlo_range(x):
    zs = []
    for p, q in zip(DLO, DLO[1:] + DLO[:1]):
        if p[0] == q[0] or not (min(p[0], q[0]) <= x <= max(p[0], q[0])): continue
        zs.append(p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]))
    return (min(zs), max(zs)) if zs else None
def side_col(m, x0, x1, n, pad_z, off, sg, nv=6, pad_x=0.0):
    xs = [x0 + (x1 - x0) * i / n for i in range(n + 1)]; rows = []
    for x in xs:
        xc = min(max(x, -1.5139), .7929); r = dlo_range(xc)
        z0, z1 = r[0] - pad_z, r[1] + pad_z
        rows.append([SIDE(x, z0 + (z1 - z0) * j / nv, off, sg) for j in range(nv + 1)])
    grid(m, rows)
for sg in (1, -1):
    side_col(BLK, .815, -1.535, 22, .02, .003, sg, 4)                                   # black window surround + pillars
    side_col(GLASS, .78, -.335, 9, -.008, .0058, sg, 4)                                    # front door glass
    side_col(GLASS, -.405, -1.17, 9, -.008, .0058, sg, 4)                                  # rear door glass
    side_col(GLASS, -1.30, -1.495, 4, -.006, .0058, sg, 3)                                # pinched quarter window
    pts = [SIDE(x, dlo_range(min(max(x, -1.5139), .7929))[0] - .0185, .0, sg) for x in [.80 - 2.3 * i / 30 for i in range(31)]]
    strip(CHR, pts, lambda p: Vector((0, 1 if p.y > 0 else -1, 0)), .014, .0075)         # chrome window line kicking up at the C pillar

def screen_h(x): return min(.70 - .12 * (.975 - x) / .915, (wall_y(x, ZT(x) - CROWN - RC) or .8) - .07)
def windscreen(off, hpad, x0, x1, m, n=8):
    rows = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n; h = max(.05, screen_h(x) + hpad); rows.append([TOP(x, -h + 2 * h * j / 14, off) for j in range(11)])
    grid(m, rows)
windscreen(.0025, .035, .99, .035, BLK); windscreen(.0050, .0, .955, .07, GLASS, 8)
def rear_glass(off, pad, m):
    rows = []; xa, xb = -2.02 + pad, -1.62 - pad
    for i in range(9):
        v = i / 8; x = xa + (xb - xa) * v; h = (.60 + pad) * max(0.0, 1 - abs(2 * v - 1) ** 7) ** (1 / 3.2) + .0001
        rows.append([TOP(x, -h + 2 * h * j / 10, off) for j in range(11)])
    grid(m, rows)
rear_glass(.0025, .035, BLK); rear_glass(.005, .0, GLASS)
TRI('glasshouse')
# roof rails: silver bar on four black stanchions; top of the bar is the traced 1.59 m
for sg in (1, -1):
    xs = [-1.32 + 1.32 * i / 10 for i in range(11)]
    tube_path(ALY, [Vector((x, sg * .575, _ZT(x) - .013)) for x in xs], lambda p: Vector((0, 0, 1)), .013, 8, closed=False)
    for x in (-1.26, -.9, -.5, -.1):
        zt_ = top_z(x, .575); box(BLK, (x, sg * .575, (zt_ + _ZT(x) - .013) / 2), (.035, .022, _ZT(x) - .013 - zt_ + .004))

# ================================================================= FRONT FASCIA (brochure front view: V-motion grille, boomerang lamps, fog corners)
def fnrm(y, z):                                                # outward normal of the nose surface at (y,z) (plan tangent only)
    t = FX(y + .02, z) - FX(y - .02, z); n = Vector((t.y, -t.x, 0)).normalized()
    return -n if n.x < 0 else n
FP = lambda off: (lambda y, z: FX(y, z, off + .007))
def scl(poly, k, dy=0.0, dz=0.0):
    cy = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
    return [(cy + (y - cy) * k + dy, cz + (z - cz) * k + dz) for y, z in poly]
def sym(half): return [(-y, z) for y, z in half] + [(y, z) for y, z in reversed(half) if y > 1e-6]
LENS_H = ('FleetLights', (.50, .58, .66, 1))
# hood: shut lines and the two creases sweeping from the cowl to the grille corners
for sg in (1, -1):
    groove([TOP(x, sg * y, .004) for x, y in ((1.07, .70), (1.45, .712), (1.80, .70), (2.03, .56), (2.085, .12))], UP)
    groove([TOP(x, sg * y, .004) for x, y in ((1.12, .64), (1.66, .46), (2.05, .29))], UP, w=.0035, h=.001)
groove([TOP(2.085, y, .004) for y in (-.12, 0.0, .12)], UP)
TRI('hood')
# grille: dark mesh (checker cells) inside the traced outline, chrome V-motion band, lower chrome lip, roundel
GRILLE = sym([(0, .892), (.52, .905), (.41, .801), (.283, .729), (.16, .722), (0, .686)])
GRILLE = [(-.52, .905), (0, .892), (.52, .905), (.41, .801), (.283, .729), (.16, .722), (0, .686), (-.16, .722), (-.283, .729), (-.41, .801)]
fill(DGR, GRILLE, FP(.008), 7, 22, 1, mf=lambda k, i: GRY if (k + i) % 2 else DGR)
Vo = [(-.285, .906), (0, .688), (.285, .906)]; Vi = [(-.232, .906), (0, .742), (.232, .906)]
def vline(p): return [(p[0][0] + (p[1][0] - p[0][0]) * t / 8, p[0][1] + (p[1][1] - p[0][1]) * t / 8) for t in range(9)] + [(p[1][0] + (p[2][0] - p[1][0]) * t / 8, p[1][1] + (p[2][1] - p[1][1]) * t / 8) for t in range(1, 9)]
grid(CHR, [[FX(y, z, .024) for y, z in vline(Vo)], [FX(y, z, .024) for y, z in vline(Vi)]])
grid(CHR, [[FX(y, .906, .024 - .0065 * a) for y in (-.285 + .57 * i / 12 for i in range(13))] for a in (0, 1)])          # top bar of the V
for sg in (1, -1): grid(CHR, [[FX(sg * (.285 + .235 * i / 6), z, .02) for i in range(7)] for z in (.905, .893)])           # chrome lip along the wing mesh
c = FX(0, .805, .025); n = Vector((1, 0, 0)); torus(CHR, c, n, .037, .0055, 20, 5); disc(CHR, c + n * .002, n, .031, .003, 20); ring_disc(BLK, c + n * .0035, n, .014, .028, 20)
TRI('grille')
# headlamps: boomerang (traced outline) = black housing, pale lens, dark reflector, two projectors, white LED DRL, amber indicator
HL = [(.41, .807), (.527, .899), (.677, .922), (.803, .941), (.81, .873), (.71, .82), (.56, .781), (.437, .768)]
for sg in (1, -1):
    P_ = mirror_poly(HL, sg) if False else [(sg * y, z) for y, z in HL]
    fill(BLK, scl(P_, 1.075), FP(.0035), 7, 12, 1); fill(LENS_H, scl(P_, .95), FP(.0075), 7, 12, 1)
    fill(DGR, scl(P_, .66, 0, -.012), FP(.0092), 3, 5, 1)
    for t in (.28, .62):
        py = HL[0][0] + (HL[3][0] - HL[0][0]) * t; pz = .81 + .075 * t + .004; cc = FX(sg * py, pz, .0175); nn = fnrm(sg * py, pz)
        torus(CHR, cc, nn, .027, .0042, 18, 5); disc(LHEAD, cc + nn * .001, nn, .022, .007, 18)
    strip(LHEAD, [FX(sg * y, z, .007) for y, z in ((.452, .826), (.545, .886), (.68, .906), (.792, .922))], lambda p: Vector((1, 0, 0)), .013, .0105)
    strip(LAMB, [FX(sg * y, z, .007) for y, z in ((.62, .805), (.72, .836), (.775, .853))], lambda p: Vector((1, 0, 0)), .012, .0105)
TRI('headlamps')
# lower intake with chrome-edged mesh and bars, fog lamps in round bezels, corner air vents, plate recess
INTAKE = [(-.31, .48), (.31, .48), (.443, .467), (.503, .441), (.46, .392), (.31, .369), (-.31, .369), (-.46, .392), (-.503, .441), (-.443, .467)]
fill(DGR, INTAKE, FP(.006), 3, 16, 1, mf=lambda k, i: GRY if (k + i) % 2 else DGR)
tube_path(CHR, [FX(y, z, .019) for y, z in INTAKE], lambda p: Vector((1, 0, 0)), .0055, 6)
for yb in (-.24, -.12, 0.0, .12, .24): grid(DGR, [[FX(yb + d, z, .019) for z in (.372, .478)] for d in (-.006, .006)])
for sg in (1, -1):
    cc = FX(sg * .655, .397, .01); nn = fnrm(sg * .655, .397)
    disc(BLK, cc + nn * .006, nn, .056, .004, 24); torus(CHR, cc + nn * .012, nn, .06, .0072, 24, 6); ring_disc(DGR, cc + nn * .0125, nn, .034, .054, 24); disc(LHEAD, cc + nn * .015, nn, .032, .012, 20)
    fill(BLK, [(sg * y, z) for y, z in ((.62, .60), (.74, .665), (.84, .655), (.855, .585), (.78, .525), (.67, .515))], FP(.004), 6, 8, 1)
fill(BLK, [(-.29, .495), (.29, .495), (.29, .605), (-.29, .605)], FP(.004), 4, 10, 1); fill(LPF, [(-.26, .512), (.26, .512), (.26, .592), (-.26, .592)], FP(.0085), 3, 8, 1)
TRI('intake+fog+plate')
fill(BLK, [(-.84, .346), (.84, .346), (.84, .405), (-.84, .405)], FP(.004), 2, 12, 1)                       # black lower bumper lip

# ================================================================= REAR: tailgate, boomerang tail lamps, plate recess, skid plate, spoiler
RP = lambda off: (lambda y, z: RX(y, z, off + .007))
def rnrm(y, z):
    t = RX(y + .02, z) - RX(y - .02, z); n = Vector((-t.y, t.x, 0)).normalized()
    return -n if n.x > 0 else n
TL = [(.375, 1.069), (.556, 1.085), (.737, 1.118), (.79, 1.145), (.80, 1.07), (.775, 1.003), (.70, .971), (.556, .974), (.441, 1.003), (.391, 1.036)]
for sg in (1, -1):
    P_ = [(sg * y, z) for y, z in TL]
    fill(BLK, scl(P_, 1.07), RP(.0035), 8, 14, 1); fill(LTAIL, scl(P_, .93), RP(.0075), 8, 14, 1)
    fill(LREV, [(sg * y, z) for y, z in ((.425, 1.024), (.50, .998), (.585, .985), (.58, 1.008), (.50, 1.03), (.44, 1.048))], RP(.0085), 4, 8, 1)
    fill(LAMB, [(sg * y, z) for y, z in ((.69, 1.10), (.79, 1.136), (.805, 1.095), (.72, 1.065))], RP(.0085), 4, 6, 1)
    strip(DGR, [RX(sg * y, z, .007) for y, z in ((.40, 1.045), (.56, 1.06), (.72, 1.09), (.80, 1.12))], lambda p: Vector((-1, 0, 0)), .008, .0092)
    fill(LTAIL, [(sg * y, z) for y, z in ((.52, .425), (.70, .435), (.70, .462), (.52, .452))], RP(.005), 3, 8, 1)           # rear reflectors
fill(BLK, [(-.40, .935), (.40, .935), (.34, .80), (-.34, .80)], RP(.004), 6, 12, 1); fill(LPR, [(-.26, .815), (.26, .815), (.26, .915), (-.26, .915)], RP(.0085), 3, 8, 1)
c = RX(0, 1.035, .012); n = Vector((-1, 0, 0)); torus(CHR, c, n, .035, .005, 20, 5); disc(CHR, c + n * .002, n, .029, .003, 20)
TRI('taillamps+plate')
skid = [(-.43, .385), (.43, .385), (.40, .48), (-.40, .48)]
fill(ALY, skid, RP(.006), 4, 10, 1)
for y0, y1 in ((-.33, -.20), (-.10, .10), (.20, .33)): fill(BLK, [(y0, .40), (y1, .40), (y1, .46), (y0, .46)], RP(.0085), 2, 3, 1)
fill(BLK, [(-.84, .346), (.84, .346), (.84, .405), (-.84, .405)], RP(.004), 2, 12, 1)                       # black lower bumper lip
groove([RX(y, .665, .0012) for y in [-.80 + 1.6 * i / 12 for i in range(13)]], XN)                           # bumper / tailgate seam
tg = [(-.60, 1.43), (-.655, 1.30), (-.665, 1.0), (-.66, .80), (-.62, .715), (0, .70), (.62, .715), (.66, .80), (.665, 1.0), (.655, 1.30), (.60, 1.43)]
def smooth_path(pts, n=5):
    out = []
    for i in range(len(pts) - 1):
        for k in range(n): t = k / n; out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
    return out + [pts[-1]]
groove([RX(y, z, .0012) for y, z in smooth_path(tg, 2)], XN)                                                  # tailgate shut line
TRI('rear')
# roof spoiler / extension over the rear glass (own small loft, body colour)
SPX0, SPX1 = -1.45, -1.811
def sp_top(x): return top_z(x, 0) + .014 if x > -1.549 else spline([(-1.549, 1.484), (-1.783, 1.446), (-1.811, 1.433)])(x)
def sp_bot(x): return max(spline([(-1.45, 1.50), (-1.55, 1.45), (-1.70, 1.385), (-1.783, 1.361), (-1.811, 1.372)])(x), top_z(x, 0) + .004)
SPS = [SPX0 + (SPX1 - SPX0) * i / 11 for i in range(12)]
ring_sp = []
for x in SPS:
    zt_, zb_ = sp_top(x), min(sp_bot(x), sp_top(x) - .012); u = (SPX0 - x) / (SPX0 - SPX1); hws = .56 * max(0.0, 1 - u ** 5) ** (1 / 5) * (1 - .06 * u)
    zc, hh = (zt_ + zb_) / 2, (zt_ - zb_) / 2; pts = []
    for k in range(14):
        th = 2 * math.pi * k / 14; cs, sn = math.cos(th), math.sin(th)
        pts.append(Vector((x, hws * math.copysign(abs(cs) ** .62, cs), zc + hh * math.copysign(abs(sn) ** .62, sn))))
    ring_sp.append([V(BODY, p) for p in pts])
for a, b in zip(ring_sp, ring_sp[1:]):
    for j in range(14): addf(BODY, (a[j], a[(j + 1) % 14], b[(j + 1) % 14], b[j]), lambda ctr: Vector((ctr.x + 1.4, 0, ctr.z - .0)) if False else Vector((-1.0, 0, 1.2)) if False else Vector((ctr.x, 0, 1.38)))
fill(LTAIL, [(-.17, 1.372), (.17, 1.372), (.17, 1.386), (-.17, 1.386)], lambda y, z: Vector((sp_bot(-1.74) + .0, y, z)) if False else Vector((-1.7885, y, z)), 2, 6, 1)   # third brake light under the lip

# ================================================================= SIDE DETAIL: door shut lines, handles, mirrors, wipers, interior
SN = lambda p: Vector((0, 1 if p.y > 0 else -1, 0))
for sg in (1, -1):
    for path in (((.80, 1.0), (.79, .8), (.765, .6), (.745, .42)), ((-.375, 1.05), (-.385, .8), (-.39, .6), (-.385, .42)), ((-1.22, 1.14), (-1.25, .9), (-1.26, .7), (-1.25, .52))):
        groove([SIDE(x, z, .0035, sg) for x, z in smooth_path(list(path), 4)], SN, w=.0045, h=.0012)
    for hx in (-.12, -1.07):                                                       # recessed handle pocket + body-colour pull
        fill(BLK, [(hx - .085, .918), (hx + .085, .918), (hx + .085, .972), (hx - .085, .972)], lambda x, z, sg=sg: SIDE(x, z, .003, sg), 3, 6, 1)
        grid(BODY, [[SIDE(x, z, o, sg) for z, o in ((.930, .004), (.936, .012), (.954, .012), (.960, .004))] for x in (hx - .065 + .13 * i / 4 for i in range(5))])
    # mirror: painted housing, dark glass on the rear face, black base on the door
    mx, my, mz = .60, sg * .985, 1.16
    ellipsoid(BODY, (mx, my, mz), (.105, .052, .068), 10, 6)
    c = Vector((mx - .098, my, mz)); disc(DGR, c, Vector((-1, 0, 0)), .052, .004, 12)
    box(BLK, (.66, sg * .93, 1.10), (.05, .09, .03), None)
for sg in (1, -1):                                                                 # shoulder crease and lower swage line
    groove([SIDE(x, BELT(x) - .004 if x < .78 else .93, .004, sg) for x in [.76 - 2.28 * i / 14 for i in range(15)]], SN, w=.004, h=.0013)
    groove([SIDE(x, .50 + .05 * (x + 1.1) / 1.8, .004, sg) for x in [.62 - 1.7 * i / 8 for i in range(9)]], SN, w=.0035, h=.001)
# wipers on the windscreen
for ya, yb in ((-.60, -.08), (.05, .50)):
    strip(BLK, [TOP(.95 - .36 * t, ya + (yb - ya) * t, .008) for t in (0, .5, 1)], UP, .014, 0)
# interior behind the glass: floor, dash, RHD wheel, four seats (dark, low detail)
box(INT, (0, 0, .36), (2.5, 1.2, .03)); box(INT, (.78, 0, .86), (.36, 1.3, .28)); box(INT, (.62, -.30, .98), (.05, .36, .30), Vector((0, .5, 0)) if False else None)
for yy in (-.34, .34):
    box(INT, (-.15, yy, .56), (.5, .46, .16)); box(INT, (-.40, yy, .88), (.12, .46, .62), None)
box(INT, (-1.0, 0, .56), (.5, 1.2, .16)); box(INT, (-1.26, 0, .90), (.12, 1.2, .62))

# ================================================================= ASSEMBLE, NORMALISE, EXPORT
def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Roughness'].default_value = .34 if name in ('FleetBody', 'FleetGlass') else .65
    p.inputs['Metallic'].default_value = .32 if name == 'FleetBody' else .08
    if name == 'FleetGlass': p.inputs['Roughness'].default_value = .16; p.inputs['Metallic'].default_value = .4
    c = m.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name = 'Color'; m.node_tree.links.new(c.outputs['Color'], p.inputs['Base Color'])
    m.use_backface_culling = True
    return m
MATS = {s: material(s) for s in SEMS}
for s in SEMS:
    bm_ = BM[s]; bmesh.ops.remove_doubles(bm_, verts=list(bm_.verts), dist=1e-6)
OBJ = []
for s in SEMS:
    me = bpy.data.meshes.new(s); BM[s].to_mesh(me); BM[s].free(); ob = bpy.data.objects.new(s, me); bpy.context.collection.objects.link(ob); me.materials.append(MATS[s]); OBJ.append(ob)
    me.color_attributes.active_color = me.color_attributes['Color']; me.color_attributes.render_color_index = me.color_attributes.find('Color')
allv = [v.co for o in OBJ for v in o.data.vertices]; lo = [min(v[i] for v in allv) for i in range(3)]; hi = [max(v[i] for v in allv) for i in range(3)]
zs = HGT / (hi[2] - lo[2])
print('RAW bounds', [round(a, 4) for a in lo], [round(a, 4) for a in hi], 'zscale', round(zs, 4))
def fit_x(x):                                                  # stretch only the bumper overhangs (outside the wheels) onto +-LEN/2
    if x > 1.8: return 1.8 + (x - 1.8) * (LEN / 2 - 1.8) / (hi[0] - 1.8)
    if x < -1.8: return -1.8 + (x + 1.8) * (LEN / 2 - 1.8) / (-lo[0] - 1.8)
    return x
for o in OBJ:
    for v in o.data.vertices: v.co.x = fit_x(v.co.x); v.co.z = (v.co.z - lo[2]) * zs
    o.data.update()
for o in OBJ:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34)); o.select_set(False)
allv = [v.co for o in OBJ for v in o.data.vertices]; lo = [min(v[i] for v in allv) for i in range(3)]; hi = [max(v[i] for v in allv) for i in range(3)]
widest = hi[1] - lo[1]
root = bpy.data.objects.new(ID, None); bpy.context.collection.objects.link(root)
for o in OBJ: o.parent = root
bpy.ops.object.select_all(action='SELECT'); OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT', export_vertex_color='ACTIVE',
                          export_texcoords=False, export_attributes=False, export_cameras=False, export_lights=False, export_extras=False)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'renders' / 'qashqai.blend'))
tris = sum(len(o.data.loop_triangles) if o.data.loop_triangles else sum(len(p.vertices) - 2 for p in o.data.polygons) for o in OBJ)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in OBJ); verts = sum(len(o.data.vertices) for o in OBJ)
def validate(path):
    raw = path.read_bytes(); assert raw[:4] == b'glTF'
    n = struct.unpack_from('<I', raw, 12)[0]; g = json.loads(raw[20:20 + n]); binary = raw[28 + n:]
    assert len(g['meshes']) == 6 and sorted(m['name'] for m in g['materials']) == sorted(SEMS) and not any(m.get('doubleSided', False) for m in g['materials'])
    def values(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; comp = {'VEC3': 3, 'VEC4': 4, 'SCALAR': 1}[a['type']]
        code, size = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}[a['componentType']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', comp * size)
        return [struct.unpack_from('<' + code * comp, binary, off + j * stride) for j in range(a['count'])]
    pts_all = []; tri = 0; vcount = 0; body_white = True
    for mesh in g['meshes']:
        assert len(mesh['primitives']) == 1
        pr = mesh['primitives'][0]; a = pr['attributes']; assert all(k in a for k in ('POSITION', 'NORMAL', 'COLOR_0'))
        pts = values(a['POSITION']); nor = values(a['NORMAL']); col = values(a['COLOR_0']); pts_all += pts; vcount += len(pts)
        assert all(math.isfinite(c) for p in pts for c in p) and all(abs(sum(c * c for c in q) - 1) < .001 for q in nor)
        ind = values(pr['indices']); tri += len(ind) // 3
        if mesh['name'] == 'FleetBody': body_white = all(min(c[:3]) > .999 for c in col)
    lo_ = [min(p[i] for p in pts_all) for i in range(3)]; hi_ = [max(p[i] for p in pts_all) for i in range(3)]
    assert abs(lo_[1]) < 1e-4 and abs(hi_[1] - HGT) < 1e-4, (lo_, hi_)
    assert abs(lo_[0] + LEN / 2) < 1e-4 and abs(hi_[0] - LEN / 2) < 1e-4, (lo_, hi_)
    assert body_white, 'FleetBody vertex colour must be white'
    return tri, lo_, hi_
gt, glo, ghi = validate(OUT_GLB)
print('PER-MESH tris', {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in OBJ})
print('BUILD tris', tris, 'gltf tris', gt, 'verts', verts, 'bytes', OUT_GLB.stat().st_size, 'nonmanifold shell edges', NONMAN, 'widthWithMirrors', round(widest, 4))
if OUT_GLB == ROOT / 'assets/vehicles/nissan-qashqai.glb': (HERE / '_stats.json').write_text(json.dumps(dict(triangles=gt, vertices=verts, bytes=OUT_GLB.stat().st_size, sha256=hashlib.sha256(OUT_GLB.read_bytes()).hexdigest(), widthIncludingMirrors=round(widest, 6))))
