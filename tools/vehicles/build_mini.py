"""MINI Cooper (F56-ish hatch) master model: profile/section-driven quad cage -> bmesh -> Subsurf.

Run:  blender -b --factory-startup -P tools/vehicles/build_mini.py -- [out.blend]
Units metres. Blender axes: forward +X, up +Z, car-right = -Y (glTF export Z-up->Y-up gives
three.js forward +X, up +Y, right +Z). Origin on the ground, centred between axles / on width.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
_a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = _a[0] if _a else os.path.join(HERE, 'mini.blend')

# =============================== TUNABLE DATA ===============================
# Side/plan profiles are (x, value) knots, PCHIP-interpolated.  x: nose +2.00, tail -1.82.
# Round-2 data: side profile traced from the RIGHT reference crop (roof flat, header ~x=.40, windscreen ~55 deg from vertical,
# hood/nose top fall), widths/tumblehome from the FRONT/REAR crops (roof ~0.67 of body width).
ZC = [(-1.86, .985), (-1.80, 1.00), (-1.66, 1.02), (-1.52, 1.15), (-1.40, 1.30), (-1.28, 1.368), (-1.10, 1.392),
      (-0.50, 1.402), (0.00, 1.398), (0.28, 1.388), (0.40, 1.370), (0.52, 1.280), (0.68, 1.160),
      (0.84, 1.040), (0.97, .960), (1.10, .950), (1.35, .925), (1.70, .860), (1.88, .815), (1.95, .785), (2.02, .75)]   # centre top line
ZB = [(-1.80, 1.000), (-1.6, .995), (-1.0, .985), (0.0, .968), (0.7, .950), (0.95, .940), (1.08, .885), (1.5, .84), (1.9, .78), (1.95, .76)]  # beltline rises to rear
ZF = [(-1.82, .30), (-1.72, .26), (-1.55, .20), (1.4, .20), (1.8, .22), (1.95, .275)]                      # underside
WH = [(-1.82, .74), (-1.70, .80), (-1.5, .85), (-1.3, .875), (-0.3, .868), (0.7, .868), (1.3, .878), (1.55, .868), (1.8, .835), (1.95, .80)]  # half width
YG = [(-1.86, .50), (-1.65, .54), (-1.5, .56), (-1.0, .59), (0.0, .60), (0.40, .585), (0.55, .565), (0.75, .60),
      (0.95, .65), (1.08, .675), (1.5, .65), (2.0, .58)]                                                   # roof/hood edge half width
ZS = 1.055   # round 2: reference reads taller/chunkier than the brochure car
ZC = [(x, z * ZS) for x, z in ZC]; ZB = [(x, z * ZS) for x, z in ZB]
DROP = [(0.9, .028), (1.2, .06), (2.0, .085)]   # gutter below centre top line (roof arch / domed bonnet)
STRAIGHT_X = [-1.60, -1.42, -1.28, -1.10, -0.75, -0.30, 0.10, 0.40, 0.52, 0.68, 0.84, 0.97, 1.12, 1.30, 1.50, 1.70]
WRAP_PHI = [18, 36, 54, 72, 90]          # nose/tail wrap stations: superellipse angle (deg), 90 = centre line
# per-row end x (row 0 = underside centre ... row 10 = top centre)
XE_FRONT = [1.93, 1.95, 1.97, 1.97, 1.96, 1.93, 1.90, 1.89, 1.88, 1.87, 1.87]
XE_REAR = [-1.74, -1.79, -1.86, -1.86, -1.85, -1.83, -1.81, -1.805, -1.80, -1.80, -1.80]
P_FRONT, P_REAR = 2.8, 3.4                # plan-view corner squareness
BUMPS = [((1.92, .60, .73), .17, .075, (.96, .26, 0))]   # (centre, sigma, amplitude, direction): headlight pods
CREASE_ROWS = {2: .35, 5: .9, 8: .65}     # row loops: sill, beltline, roof/bonnet edge
CREASE_X = {0.97: .5, 0.40: .3, -1.28: .3}   # cross loops (cowl, roof front, roof rear) - nearest station
WHEEL_X, TRACK, TYRE_R = 1.30, 0.735, 0.35
ARCH_R = 0.432
BLACK_FROM_ROW_BELOW = 3                  # sill/bumper black faces: row j < 3
GREENHOUSE_X_MAX = 0.95                   # rows>=5 behind this x are black pillar band

# glass outlines (x,z) side, (x,y) windscreen/rear
DOOR_GLASS = [(0.85, 1.045), (0.45, 1.375), (-0.36, 1.385), (-0.40, 1.045)]
QUARTER_GLASS = [(-0.46, 1.045), (-0.46, 1.385), (-0.95, 1.375), (-1.20, 1.27), (-1.31, 1.045)]
WINDSCREEN = [(0.95, .60), (0.415, .50), (0.415, -.50), (0.95, -.60)]
REAR_GLASS = [(-1.33, .50), (-1.79, .52), (-1.79, -.52), (-1.33, -.50)]
ROOF_OUT = [(0.40, .47), (0.20, .56), (-0.30, .60), (-1.00, .595), (-1.20, .57), (-1.34, .44),
            (-1.34, -.44), (-1.20, -.57), (-1.00, -.595), (-0.30, -.60), (0.20, -.56), (0.40, -.47)]
ROOF_LIFT, ROOF_THICK = 0.022, 0.020

# ================================ UTILITIES =================================
def pchip(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]; d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] > 0:
            w1 = 2 * h[i] + h[i - 1]; w2 = h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    def end(h0, h1, d0, d1):
        s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
        if s * d0 <= 0: return 0.0
        if d0 * d1 <= 0 and abs(s) > 3 * abs(d0): return 3 * d0
        return s
    m[0] = end(h[0], h[1], d[0], d[1]); m[-1] = end(h[-1], h[-2], d[-1], d[-2])
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = max(k for k in range(n - 1) if xs[k] <= x)
        t = (x - xs[i]) / h[i]
        return ((2*t**3 - 3*t**2 + 1) * ys[i] + (t**3 - 2*t**2 + t) * h[i] * m[i]
                + (-2*t**3 + 3*t**2) * ys[i + 1] + (t**3 - t**2) * h[i] * m[i + 1])
    return f

fZC, fZB, fZF, fW, fYG, fDROP = pchip(ZC), pchip(ZB), pchip(ZF), pchip(WH), pchip(YG), pchip(DROP)

def chaikin(poly, n=2):
    for _ in range(n):
        new = []
        for i in range(len(poly)):
            a = Vector(poly[i]); b = Vector(poly[(i + 1) % len(poly)])
            new += [tuple(a * .75 + b * .25), tuple(a * .25 + b * .75)]
        poly = new
    return poly

def round_poly(poly, r, n=5):
    out = []; N = len(poly)
    for i in range(N):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % N])
        a = (p0 - p1); b = (p2 - p1); ra = min(r, a.length * .45); rb = min(r, b.length * .45)
        A = p1 + a.normalized() * ra; B = p1 + b.normalized() * rb
        for k in range(n + 1):
            t = k / n; out.append(tuple((1 - t) ** 2 * A + 2 * t * (1 - t) * p1 + t * t * B))
    return out

def new_obj(name, bm_or_mesh, mats=(), parent=None, loc=(0, 0, 0)):
    if isinstance(bm_or_mesh, bmesh.types.BMesh):
        me = bpy.data.meshes.new(name); bm_or_mesh.to_mesh(me); bm_or_mesh.free()
    else:
        me = bm_or_mesh
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent: ob.parent = parent
    return ob

def smooth(ob, angle=None):
    for p in ob.data.polygons: p.use_smooth = True

# ================================ MATERIALS =================================
def mk(name, base, metal=0, rough=.5, alpha=1, coat=0, emit=None, emit_s=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    b.inputs['Alpha'].default_value = alpha
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .03
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = emit_s
    if alpha < 1:
        m.surface_render_method = 'BLENDED'; b.inputs['Specular IOR Level'].default_value = .15
    return m

def make_materials():
    return dict(
        cream=mk('BodyPaintCream', (.807, .738, .578), 0, .28, coat=.8),
        red=mk('BodyPaintRed', (.75, .012, .022), 0, .25, coat=.8),
        glass=mk('Glass', (.015, .02, .028), 0, .32, alpha=.6),
        tyre=mk('Tyre', (.02, .02, .022), 0, .7),
        wheel=mk('WheelMetal', (.62, .63, .66), 1, .28),
        chrome=mk('Chrome', (.9, .9, .92), 1, .06),
        lights=mk('Lights', (.9, .93, .97), 0, .05, emit=(1, .95, .85), emit_s=.15),
        dark=mk('InteriorDark', (.012, .012, .014), 0, .9))

# ================================ BODY CAGE =================================
NR = 11
def ring_pt(j, x):
    """(y, z) of ring row j at body x, for the full-width (t=1) section."""
    W = fW(x); zf = fZF(x); zb = fZB(x); zc = fZC(x); yg = fYG(x)
    zg = max(zc - fDROP(x), zb + .012); ys0 = .935 * W
    if j == 0: return 0.0, zf
    if j == 1: return .70 * W, zf
    if j == 2: return .93 * W, zf + .025
    if j == 3: return .992 * W, zf + .115
    if j == 4: return W, zf + .50 * (zb - zf)
    if j == 5: return ys0, zb
    if j in (6, 7, 8):
        s = {6: .18, 7: .55, 8: 1.0}[j]
        return ys0 + s * (yg - ys0), zb + s * (zg - zb)
    if j == 9: return .5 * yg, zc - .3 * (zc - zg)
    return 0.0, max(zc, zg)

def wrap_pt(j, phi, xe, xl, p):
    R = xe - xl; ph = math.radians(phi)
    t = math.cos(ph) ** (2 / p); u = math.sin(ph) ** (2 / p)     # superellipse quadrant
    x = xl + R * u
    y, z = ring_pt(j, x)
    return Vector((x, y * t, z))

def build_cage(mats):
    stations = []  # list of (kind, [Vector...]) rear -> front
    for t in reversed(WRAP_PHI):
        stations.append([wrap_pt(j, t, XE_REAR[j], STRAIGHT_X[0], P_REAR) for j in range(NR)])
    for x in STRAIGHT_X:
        stations.append([Vector((x, *ring_pt(j, x))) for j in range(NR)])
    for t in WRAP_PHI:
        stations.append([wrap_pt(j, t, XE_FRONT[j], STRAIGHT_X[-1], P_FRONT) for j in range(NR)])
    for st in stations:
        for p in st:
            for c, sg, amp, dr in BUMPS:
                w = math.exp(-((p - Vector(c)).length / sg) ** 2)
                p += Vector(dr) * amp * w
    bm = bmesh.new()
    V = [[bm.verts.new(p) for p in st] for st in stations]
    cl = bm.edges.layers.float.new('crease_edge')
    mats_idx = {'cream': 0, 'black': 1}
    nk = len(V)
    for k in range(nk - 1):
        for j in range(NR - 1):
            f = bm.faces.new((V[k][j], V[k][j + 1], V[k + 1][j + 1], V[k + 1][j]))
            cx = sum(v.co.x for v in f.verts) / 4
            black = (j < BLACK_FROM_ROW_BELOW) or (j < 4 and cx > 1.84) or (j < 3 and cx < -1.55) or (j >= 5 and cx < GREENHOUSE_X_MAX)
            f.material_index = 1 if black else 0
    xs_station = [sum(v.co.x for v in st) / NR for st in V]
    ns = len(WRAP_PHI)
    for k in range(ns - 1, nk - 1 - ns + 1):
        for j, w in CREASE_ROWS.items():
            e = bm.edges.get((V[k][j], V[k + 1][j]))
            if e: e[cl] = w
    for cx, w in CREASE_X.items():
        k = min(range(nk), key=lambda i: abs(xs_station[i] - cx))
        for j in range(5, NR - 1):
            e = bm.edges.get((V[k][j], V[k][j + 1]))
            if e: e[cl] = max(e[cl], w)
    cage = new_obj('Body_Cage', bm, [mats['cream'], mats['tyre']])
    mir = cage.modifiers.new('Mirror', 'MIRROR'); mir.use_axis[0] = False; mir.use_axis[1] = True; mir.use_mirror_merge = True; mir.merge_threshold = 1e-4
    sub = cage.modifiers.new('Subsurf', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    return cage

def evaluated_mesh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)

def bvh_of(me):
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces)
    tree = BVHTree.FromBMesh(bm); bm.free(); return tree

# ============================ PROJECTED PATCHES =============================
def make_proj(bvh, plane, sign=1, off=0.004):
    def proj(a, b, lift=0.0):
        if plane == 'z': o = Vector((a, b, 5.0)); d = Vector((0, 0, -1))
        elif plane == 'x': o = Vector((5.0 * sign, a, b)); d = Vector((-sign, 0, 0))
        else: o = Vector((a, 5.0 * sign, b)); d = Vector((0, -sign, 0))
        loc, n, _, _ = bvh.ray_cast(o, d)
        if loc is None: raise RuntimeError('no hit %s %.3f %.3f' % (plane, a, b))
        if n.dot(d) > 0: n = -n
        return loc + n * (off + lift), n
    return proj

def finish_patch(bm, normals):
    for f in bm.faces:
        if all(v in normals for v in f.verts):
            f.normal_update()
            if f.normal.dot(sum((normals[v] for v in f.verts), Vector())) < 0: f.normal_flip()

def radial_patch(bm, outline, K, proj, lift=lambda f: 0.0):
    c = Vector((sum(p[0] for p in outline) / len(outline), sum(p[1] for p in outline) / len(outline)))
    normals = {}
    def mkv(q, lf):
        pos, n = proj(q.x, q.y, lf); v = bm.verts.new(pos); normals[v] = n; return v
    cv = mkv(c, lift(0.0)); rings = []
    for k in range(1, K + 1):
        fr = k / K
        rings.append([mkv(c + (Vector(o) - c) * fr, lift(fr)) for o in outline])
    n = len(outline)
    for i in range(n):
        bm.faces.new((cv, rings[0][i], rings[0][(i + 1) % n]))
    for k in range(K - 1):
        for i in range(n):
            bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][(i + 1) % n], rings[k][(i + 1) % n]))
    finish_patch(bm, normals)

def grid_patch(bm, fn, nu, nv, proj, lift=lambda u, v: 0.0):
    normals = {}; G = []
    for i in range(nu + 1):
        col = []
        for k in range(nv + 1):
            u, v = i / nu, k / nv; a, b = fn(u, v); pos, n = proj(a, b, lift(u, v))
            vv = bm.verts.new(pos); normals[vv] = n; col.append(vv)
        G.append(col)
    for i in range(nu):
        for k in range(nv):
            bm.faces.new((G[i][k], G[i + 1][k], G[i + 1][k + 1], G[i][k + 1]))
    finish_patch(bm, normals)

def ring_strip(bm, outline, width, proj, lift=0.0):
    """closed strip: outline and its inset by width (towards centroid) -> chrome frame"""
    c = Vector((sum(p[0] for p in outline) / len(outline), sum(p[1] for p in outline) / len(outline)))
    normals = {}
    def mkv(q):
        pos, n = proj(q.x, q.y, lift); v = bm.verts.new(pos); normals[v] = n; return v
    outer = [mkv(Vector(o)) for o in outline]
    inner = [mkv(Vector(o)) for o in inset_poly(outline, width)]
    n = len(outline)
    for i in range(n):
        bm.faces.new((outer[i], outer[(i + 1) % n], inner[(i + 1) % n], inner[i]))
    finish_patch(bm, normals)

def densify(poly, step=.05):
    out = []
    for i in range(len(poly)):
        a, b = Vector(poly[i]), Vector(poly[(i + 1) % len(poly)]); n = max(1, int((b - a).length / step))
        out += [tuple(a + (b - a) * k / n) for k in range(n)]
    return out

def inset_poly(poly, d):
    """uniform inset of a closed 2D polygon (any winding), miter-ish"""
    P = [Vector(p) for p in poly]; N = len(P)
    area = sum(P[i].x * P[(i + 1) % N].y - P[(i + 1) % N].x * P[i].y for i in range(N))
    sg = 1 if area > 0 else -1
    out = []
    for i in range(N):
        e0 = (P[i] - P[i - 1]).normalized(); e1 = (P[(i + 1) % N] - P[i]).normalized()
        n0 = Vector((-e0.y, e0.x)) * sg; n1 = Vector((-e1.y, e1.x)) * sg   # inward normals
        b = (n0 + n1); b = b.normalized() if b.length > 1e-6 else n0
        out.append(tuple(P[i] + b * d / max(.4, b.dot(n0))))
    return out

def ellipse(cx, cy, rx, ry, n=24):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]

# ================================== PARTS ===================================
def spin(bm, prof, segs, closed=True, ax=1):
    rings = []
    for i in range(segs):
        th = 2 * math.pi * i / segs; c, s = math.cos(th), math.sin(th)
        rings.append([bm.verts.new((r * c, y, r * s)) for r, y in prof])
    m = len(prof)
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for j in range(m if closed else m - 1):
            j2 = (j + 1) % m
            try: bm.faces.new((a[j], a[j2], b[j2], b[j]))
            except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

def wheel_mesh(mats, segs=40):
    bm = bmesh.new()
    tyre = [(.242, .080), (.256, .098), (.286, .1025), (.315, .092), (.325, .060), (.328, 0), (.325, -.060),
            (.315, -.092), (.286, -.1025), (.256, -.098), (.242, -.080)]
    spin(bm, tyre, segs); for_mat = {f: 0 for f in bm.faces}
    for f in bm.faces: f.material_index = 0
    n0 = len(bm.faces)
    b2 = bmesh.new()
    spin(b2, [(.2385, .086), (.2385, .100), (.218, .102), (.213, .088)], segs)      # outer lip
    spin_h = bmesh.new()
    spin(spin_h, [(.0, .095), (.06, .095), (.07, .075), (.0, .075)], 16)             # hub cap
    spokes = bmesh.new()
    for i in range(10):
        a = 2 * math.pi * i / 10
        pts = []
        for (r, hw, y) in [(.05, .018, .060), (.226, .030, .060)]:
            for yy in (y, y + .026):
                for s in (-1, 1):
                    pts.append((r, yy, hw * s))
        # box between inner (r=.04) and outer (r=.205) ends; local x=radial, z=tangential
        vs = [spokes.verts.new((p[0] * math.cos(a) - p[2] * math.sin(a), p[1], p[0] * math.sin(a) + p[2] * math.cos(a))) for p in pts]
        for q in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]:
            spokes.faces.new([vs[k] for k in q])
    bmesh.ops.recalc_face_normals(spokes, faces=spokes.faces)
    disc = bmesh.new(); spin(disc, [(.0, .048), (.225, .048), (.225, .038), (.0, .038)], 32)
    # join with material ids
    out = bmesh.new()
    for src, mi in ((bm, 0), (b2, 1), (spin_h, 1), (spokes, 1), (disc, 2)):
        me = bpy.data.meshes.new('t'); src.to_mesh(me)
        for p in me.polygons: p.material_index = mi
        out.from_mesh(me); bpy.data.meshes.remove(me); src.free()
    return out

def arch_parts(mats, bvh_unused=None):
    """returns (cutter bmesh list, flare bmesh, liner bmesh) for all four wheels"""
    cut = bmesh.new(); flare = bmesh.new(); liner = bmesh.new()
    for wx in (WHEEL_X, -WHEEL_X):
        for sy in (1, -1):
            # cutter: cylinder along y, y in [.50, 1.0]
            cb = bmesh.new()
            segs = 40
            rings = []
            for yy in (.50, 1.0):
                rings.append([cb.verts.new((wx + ARCH_R * math.cos(2*math.pi*i/segs), sy * yy, TYRE_R + ARCH_R * math.sin(2*math.pi*i/segs))) for i in range(segs)])
            for i in range(segs):
                cb.faces.new((rings[0][i], rings[0][(i+1) % segs], rings[1][(i+1) % segs], rings[1][i]))
            cb.faces.new(rings[0][::-1]); cb.faces.new(rings[1])
            bmesh.ops.recalc_face_normals(cb, faces=cb.faces)
            for f in cb.faces: f.material_index = 1
            me = bpy.data.meshes.new('c'); cb.to_mesh(me); cb.free(); cut.from_mesh(me); bpy.data.meshes.remove(me)
            # flare sweep (profile radial offset from centre, lateral)
            prof = [(ARCH_R - .012, .70), (ARCH_R - .012, .88), (ARCH_R + .010, .918), (ARCH_R + .055, .908), (ARCH_R + .088, .878), (ARCH_R + .092, .80)]
            arc = [math.radians(a) for a in range(-14, 195, 7)]
            fv = []
            for th in arc:
                dd = min(th - arc[0], arc[-1] - th); kk = max(0.0, min(1.0, dd / math.radians(28)))   # taper the ends into the body
                fv.append([flare.verts.new((wx + r * math.cos(th), sy * (.80 + (l - .80) * kk if l > .80 else l), TYRE_R + r * math.sin(th))) for r, l in prof])
            for i in range(len(arc) - 1):
                for k in range(len(prof) - 1):
                    flare.faces.new((fv[i][k], fv[i][k+1], fv[i+1][k+1], fv[i+1][k]) if sy > 0 else (fv[i][k], fv[i+1][k], fv[i+1][k+1], fv[i][k+1]))
            # liner: half cylinder
            lv = []
            for th in arc:
                lv.append([liner.verts.new((wx + (ARCH_R - .02) * math.cos(th), sy * yy, TYRE_R + (ARCH_R - .02) * math.sin(th))) for yy in (.45, .86)])
            for i in range(len(arc) - 1):
                liner.faces.new((lv[i][0], lv[i][1], lv[i+1][1], lv[i+1][0]) if sy < 0 else (lv[i][0], lv[i+1][0], lv[i+1][1], lv[i][1]))
    # flare strip normals: outward
    for bmx in (flare,):
        bmesh.ops.recalc_face_normals(bmx, faces=bmx.faces)
    return cut, flare, liner

def basis_from_normal(n, up=Vector((0, 0, 1))):
    z = n.normalized(); x = up.cross(z)
    if x.length < 1e-4: x = Vector((1, 0, 0))
    x.normalize(); y = z.cross(x)
    return Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z)))

def dome_disc(bm, rx, ry, h, segs=24, rings=4, skirt=0.0):
    """lens: elliptical dome facing +Z in local space"""
    c = bm.verts.new((0, 0, h)); prev = None; rs = []
    for k in range(1, rings + 1):
        f = k / rings; hh = h * (1 - f ** 2)
        rs.append([bm.verts.new((rx * f * math.cos(2*math.pi*i/segs), ry * f * math.sin(2*math.pi*i/segs), hh)) for i in range(segs)])
    for i in range(segs): bm.faces.new((c, rs[0][i], rs[0][(i+1) % segs]))
    for k in range(rings - 1):
        for i in range(segs): bm.faces.new((rs[k][i], rs[k+1][i], rs[k+1][(i+1) % segs], rs[k][(i+1) % segs]))
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.is_valid])

def torus_ring(bm, rx, ry, w, h, segs=28):
    """chrome bezel: elliptical ring of width w, height h facing +Z"""
    prof = [(0, 0), (1, 0.0), (1, 1), (0.0, 1)]
    rings = []
    for i in range(segs):
        th = 2*math.pi*i/segs; c, s = math.cos(th), math.sin(th)
        ring = []
        for (a, b) in [(-w * .5, 0), (w * .5, 0), (w * .35, h), (-w * .35, h)]:
            ring.append(bm.verts.new(((rx + a) * c, (ry + a) * s, b)))
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[(i+1) % segs]
        for j in range(4): bm.faces.new((a[j], a[(j+1) % 4], b[(j+1) % 4], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

def add_at(dst, src_bm, M, mat_idx=0):
    me = bpy.data.meshes.new('t'); src_bm.to_mesh(me); src_bm.free()
    me.transform(M)
    for p in me.polygons: p.material_index = mat_idx
    dst.from_mesh(me); bpy.data.meshes.remove(me)

# ================================== BUILD ===================================
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = make_materials()
    root = bpy.data.objects.new('VehicleRoot', None); bpy.context.scene.collection.objects.link(root)

    cage = build_cage(mats)
    sub_me = evaluated_mesh(cage)

    # ---- body = evaluated cage with arch cutouts
    cut, flare_bm, liner_bm = arch_parts(mats)
    body = new_obj('Body', sub_me, [], root)
    cutter = new_obj('_cutters', cut, [mats['cream'], mats['tyre']]); 
    bo = body.modifiers.new('Arches', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cutter; bo.solver = 'EXACT'; bo.material_mode = 'TRANSFER'
    dg = bpy.context.evaluated_depsgraph_get()
    final = bpy.data.meshes.new_from_object(body.evaluated_get(dg), depsgraph=dg)
    body.modifiers.clear(); body.data = final
    # boolean drops material ids: copy from nearest pre-boolean face
    pre = BVHTree.FromPolygons([v.co.copy() for v in sub_me.vertices], [tuple(p.vertices) for p in sub_me.polygons])
    for p in final.polygons:
        loc, n, idx, d = pre.find_nearest(p.center)
        p.material_index = sub_me.polygons[idx].material_index
    bpy.data.objects.remove(cutter)
    for p in final.polygons: p.use_smooth = True
    cage.hide_viewport = True; cage.hide_render = True
    cage.parent = None
    cage.hide_viewport = True; cage.hide_render = True
    bvh = bvh_of(final)

    # ---- glass (derived from the body surface by projection)
    gbm = bmesh.new()
    for sy in (1, -1):
        proj = make_proj(bvh, 'y', sy, .010)
        for poly in (DOOR_GLASS, QUARTER_GLASS):
            radial_patch(gbm, round_poly(poly, .07, 6), 8, proj)
    radial_patch(gbm, round_poly(WINDSCREEN, .07, 6), 8, make_proj(bvh, 'z', 1, .010))
    radial_patch(gbm, round_poly(REAR_GLASS, .06, 6), 8, make_proj(bvh, 'z', 1, .010))
    for _ in range(6):   # relax projection jitter on interior verts (offset keeps the glass above the body)
        bmesh.ops.smooth_vert(gbm, verts=[v for v in gbm.verts if not v.is_boundary], factor=.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    glass = new_obj('Glass', gbm, [mats['glass']], root); smooth(glass)

    # ---- roof (floating arched shell)
    rb = bmesh.new()
    radial_patch(rb, round_poly(ROOF_OUT, .14, 4), 9, make_proj(bvh, 'z', 1, ROOF_LIFT))
    for v in rb.verts:   # small rear spoiler lip
        if v.co.x < -1.12: v.co.z += .022 * min(1.0, (-1.12 - v.co.x) / .2)
    # solidify inwards (towards body) by moving a copy down along normals and bridging the boundary
    rim_edges = [e for e in rb.edges if e.is_boundary]
    geom = bmesh.ops.extrude_face_region(rb, geom=list(rb.faces))
    newv = [v for v in geom['geom'] if isinstance(v, bmesh.types.BMVert)]
    for v in newv: v.co -= Vector((0, 0, ROOF_THICK))
    bmesh.ops.recalc_face_normals(rb, faces=rb.faces)
    for e in rb.edges:
        if e.is_boundary or all(abs(f.normal.z) < .6 for f in e.link_faces) or any(abs(f.normal.z) < .6 for f in e.link_faces): e.smooth = False
    roof = new_obj('Roof', rb, [mats['red']], root); smooth(roof)
    for e in roof.data.edges: pass
    rbvh = bvh_of(roof.data)

    # ---- stripes
    sb = bmesh.new()
    hood = make_proj(bvh, 'z', 1, .0035)
    for sg in (1, -1):
        def fn(u, v, sg=sg):
            x = 1.89 - u * 0.88                      # front -> cowl
            yc = sg * (0.20 - u * 0.03); return x, yc + sg * (v - .5) * .085
        grid_patch(sb, fn, 22, 3, hood)
    stripes_red = new_obj('Stripes_Red', sb, [mats['red']], root); smooth(stripes_red)
    wb = bmesh.new(); rp = make_proj(rbvh, 'z', 1, .0018)
    for sg in (1, -1):
        grid_patch(wb, lambda u, v, sg=sg: (0.34 - u * 1.50, sg * (0.075 + (v - .5) * .03)), 30, 2, rp)
    stripes_w = new_obj('Stripes_White', wb, [mats['cream']], root); smooth(stripes_w)

    # ---- bonnet scoop
    scb = bmesh.new()
    radial_patch(scb, chaikin([(1.70, .14), (1.70, -.14), (1.38, -.18), (1.38, .18)], 3), 5, make_proj(bvh, 'z', 1, .004), lift=lambda f: .028 * (1 - f ** 2) ** .5)
    slot = bmesh.new()
    radial_patch(slot, chaikin([(1.68, .11), (1.68, -.11), (1.63, -.12), (1.63, .12)], 3), 3, make_proj(bvh, 'z', 1, .033), lift=lambda f: 0)
    # ---- grilles / fog / lamps via front projection
    px = make_proj(bvh, 'x', 1, .004)
    trim = bmesh.new(); chromeb = bmesh.new(); darkb = bmesh.new(); lampb = bmesh.new()
    hexo = round_poly([(.30, .765), (.43, .64), (.30, .515), (-.30, .515), (-.43, .64), (-.30, .765)], .035, 4)
    radial_patch(darkb, hexo, 6, make_proj(bvh, 'x', 1, .008))
    ring_strip(chromeb, hexo, .062, make_proj(bvh, 'x', 1, .028))
    low = round_poly([(.40, .475), (.46, .425), (.40, .365), (-.40, .365), (-.46, .425), (-.40, .475)], .03, 4)
    radial_patch(darkb, low, 6, make_proj(bvh, 'x', 1, .006))
    ring_strip(chromeb, low, .012, make_proj(bvh, 'x', 1, .010))
    # shut-lines: bonnet outline, doors
    sl = bmesh.new()
    hood_o = densify([(1.00, .66), (1.50, .645), (1.76, .60), (1.86, .50), (1.885, .30), (1.89, 0), (1.885, -.30), (1.86, -.50), (1.76, -.60), (1.50, -.645), (1.00, -.66)], .05)
    ring_strip(sl, hood_o, .006, make_proj(bvh, 'z', 1, .0025))
    for sy in (1, -1):
        door_o = densify([(0.82, 1.015), (0.82, .36), (-0.43, .36), (-0.43, 1.03)], .05)
        ring_strip(sl, door_o, .005, make_proj(bvh, 'y', sy, .0025))
    shut = new_obj('Shutlines', sl, [mats['dark']], root); smooth(shut)
    # tail lamps (rear projection, from -x)
    pr = make_proj(bvh, 'x', -1, .004)
    tl = bmesh.new()
    for sg in (1, -1):   # raised vertical oval tail-lamp pods
        radial_patch(tl, ellipse(.54 * sg, .84, .095, .20, 28), 6, pr, lift=lambda f: .050 * (1 - f ** 2) ** .6)
    plate = bmesh.new()
    radial_patch(plate, round_poly([(.23, .70), (.23, .58), (-.23, .58), (-.23, .70)], .02, 3), 4, make_proj(bvh, 'x', -1, .004))
    new_obj('PlateRecess', plate, [mats['dark']], root)
    taillights = new_obj('Taillights', tl, [mats['red']], root); smooth(taillights)

    # bonnet scoop objects
    scoop = new_obj('Scoop', scb, [mats['cream']], root); smooth(scoop)
    slotob = new_obj('ScoopSlot', slot, [mats['dark']], root)

    # ---- trim (flares, liners, grille frames) and headlights
    trim_all = bmesh.new()
    add_at(trim_all, flare_bm, Matrix.Identity(4), 0)
    trim_ob = new_obj('Trim', trim_all, [mats['tyre']], root); smooth(trim_ob)
    liner_ob = new_obj('WheelWells', liner_bm, [mats['dark']], root)
    grille_dark = new_obj('GrilleDark', darkb, [mats['dark']], root); smooth(grille_dark)
    grille_chrome = new_obj('GrilleFrame', chromeb, [mats['chrome']], root); smooth(grille_chrome)

    hl = bmesh.new()   # lens + chrome ring on nose corner
    hlc = bmesh.new()
    for sg in (1, -1):
        for (cy, cz, rx, ry, name) in ((0.60, 0.735, .135, .108, 'head'), (0.56, 0.385, .045, .045, 'fog')):
            pos, n = make_proj(bvh, 'x', 1, 0.0)(cy * sg, cz)
            M = Matrix.Translation(pos + n * .002) @ basis_from_normal(n).to_4x4() @ Matrix.Rotation(math.radians(sg * 14 if name == 'head' else 0), 4, 'Z')
            b1 = bmesh.new(); dome_disc(b1, rx, ry, .062 if name == 'head' else .014); add_at(hl, b1, M, 0)
            b2 = bmesh.new(); torus_ring(b2, rx + .014, ry + .014, .040 if name == 'head' else .014, .045 if name == 'head' else .010); add_at(hlc, b2, M, 0)
    headlights = new_obj('Headlights', hl, [mats['lights']], root); smooth(headlights)
    hl_ring = new_obj('HeadlightRings', hlc, [mats['chrome']], root); smooth(hl_ring)

    # ---- mirrors
    mb = bmesh.new()
    for sg in (1, -1):
        b1 = bmesh.new(); bmesh.ops.create_uvsphere(b1, u_segments=16, v_segments=10, radius=1)
        M = Matrix.Translation((0.80, sg * 0.98, 1.075)) @ Matrix.Diagonal((.060, .080, .055, 1))
        add_at(mb, b1, M, 0)
    mirrors = new_obj('Mirrors', mb, [mats['red']], root); smooth(mirrors)

    # ---- interior tub: body shrunk along normals
    cage.modifiers['Subsurf'].levels = 1
    low_me = evaluated_mesh(cage); cage.modifiers['Subsurf'].levels = 2
    ib = bmesh.new(); ib.from_mesh(low_me)
    bmesh.ops.recalc_face_normals(ib, faces=ib.faces)
    for v in ib.verts: v.co -= v.normal * .05
    interior = new_obj('Interior', ib, [mats['dark']], root)
    for p in interior.data.polygons: p.material_index = 0

    # ---- wheels
    wheels = bpy.data.objects.new('Wheels', None); bpy.context.scene.collection.objects.link(wheels); wheels.parent = root
    wm = wheel_mesh(mats); wme = bpy.data.meshes.new('Wheel'); wm.to_mesh(wme); wm.free()
    for m in (mats['tyre'], mats['wheel'], mats['dark']): wme.materials.append(m)
    wme.transform(Matrix.Scale(TYRE_R / 0.328, 4))   # wheel profile was drawn for R=0.328
    for p in wme.polygons: p.use_smooth = True
    for name, wx, sy in (('FL', WHEEL_X, 1), ('FR', WHEEL_X, -1), ('RL', -WHEEL_X, 1), ('RR', -WHEEL_X, -1)):
        w = new_obj(name, wme, [], wheels, (wx, sy * TRACK, TYRE_R))
        if sy < 0: w.rotation_euler = (0, 0, math.pi)

    # ---- antenna
    ab = bmesh.new(); bmesh.ops.create_cone(ab, cap_ends=True, segments=8, radius1=.004, radius2=.0025, depth=.13)
    add_at(ab, bmesh.new(), Matrix.Identity(4)) if False else None
    me = bpy.data.meshes.new('ant'); ab.to_mesh(me); ab.free(); me.transform(Matrix.Translation((-1.28, .30, 1.50 + .065)))
    antenna = new_obj('Antenna', me, [mats['tyre']], root)

    # materials on body are slots [cream, black(tyre)]; clean-ups
    for ob in (stripes_red, stripes_w, scoop, slotob, taillights, glass): ob.parent = root
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name != 'Body_Cage':
            o.data.update()
    # the editable cage lives in its own scene ('Source') so exporters never pick it up
    src_scene = bpy.data.scenes.new('Source')
    for c in list(cage.users_collection): c.objects.unlink(cage)
    src_scene.collection.objects.link(cage); cage.hide_viewport = False; cage.hide_render = False
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name != 'Body_Cage':
            t = sum(len(p.vertices) - 2 for p in o.data.polygons); tris += t
            print('MESH %-14s verts %6d tris %6d' % (o.name, len(o.data.vertices), t))
    print('TOTAL tris', tris)

main()
