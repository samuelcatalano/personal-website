# Original Blender model of the Toyota Corolla (E210 sedan, Brazil MY2020) for the Three.js city fleet.
# Run: blender -b --factory-startup -P build_toyota_corolla.py -- [out.glb]
# Method (same as the Mini): side silhouette traced pixel-by-pixel from a visual reference (px tables -> metres), ring-loft body with
# superellipse-like plan ends, real tumblehome glasshouse (thin shell, boolean window openings, recessed glass), per-part hand-written
# details projected onto the shell by ray casts.  References are visual only (Outlines 12th-gen sedan blueprints); nothing is copied.
# Blender: nose +X, up +Z, left = +Y.  glTF export_yup -> forward +X, up +Y.  Origin on ground, centred.
import bpy, bmesh, math, sys, json, hashlib, struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = Path(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 1 else ROOT / 'assets/vehicles/toyota-corolla.glb'
L, W, H_, WB = 4.63, 1.78, 1.455, 2.7
XF, XR, RT, ZC = 1.38, -1.32, 0.325822, 0.325822          # axle x, tyre radius = axle height
HW = W / 2

# ================= reference px -> metres =================
S_ = 4.63 / 1743.0; ZSC = 1.0104                              # side blueprint: 1743 px = 4.63 m, 1.0104 stretches the traced roof to 1.455
X = lambda px: (px - 876.5) * S_
Z = lambda py: (544 - py) * S_ * ZSC

class Tab:                                                    # monotone cubic (no overshoot) through sorted points
    def __init__(s, pts):
        p = sorted(pts); s.x = np.array([a for a, _ in p], float); s.y = np.array([b for _, b in p], float)
        h = np.diff(s.x); d = np.diff(s.y) / h; m = np.zeros(len(s.x))
        m[1:-1] = np.where(d[:-1] * d[1:] > 0, 2 * d[:-1] * d[1:] / (d[:-1] + d[1:] + 1e-30), 0.0); m[0], m[-1] = d[0], d[-1]; s.m, s.h = m, h
    def __call__(s, x):
        x = min(max(x, s.x[0]), s.x[-1]); i = min(int(np.searchsorted(s.x, x, 'right')) - 1, len(s.h) - 1); h = s.h[i]; t = (x - s.x[i]) / h
        return float((2 * t ** 3 - 3 * t * t + 1) * s.y[i] + (t ** 3 - 2 * t * t + t) * h * s.m[i] + (-2 * t ** 3 + 3 * t * t) * s.y[i + 1] + (t ** 3 - t * t) * h * s.m[i + 1])
def lerp(a, b, t): return a + (b - a) * t
def sstep(t): t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)

# centre-line top silhouette (px read from the side blueprint every ~24 px; ends = rear/nose faces)
TOP_PX = [(22, 160), (53, 157), (77, 153), (101, 149), (125, 145), (149, 141), (170, 137), (197, 126), (221, 114), (245, 103), (269, 92), (293, 81),
          (317, 70), (341, 60), (365, 51), (389, 41), (413, 33), (437, 28), (461, 24), (485, 20), (509, 17), (533, 14), (581, 9), (629, 6), (677, 4),
          (725, 2), (773, 2), (821, 3), (869, 5), (917, 9), (965, 16), (1013, 25), (1061, 42), (1109, 61), (1157, 83), (1205, 106), (1253, 130),
          (1301, 157), (1340, 178), (1380, 176), (1421, 181), (1469, 188), (1517, 196), (1565, 205), (1613, 217), (1661, 234), (1709, 259), (1733, 276)]
ST_TAB = [(-2.315, 0.50), (-2.311, 0.62), (-2.303, 0.78), (-2.290, 0.92), (-2.278, 0.995)] + [(X(p), Z(q)) for p, q in TOP_PX if p > 22] \
         + [(2.289, 0.69), (2.300, 0.63), (2.315, 0.55)]
ST = Tab(ST_TAB)
# underside / bumper bottoms
ZB = Tab([(-2.315, 0.36), (-2.30, 0.325), (-2.17, 0.277), (-1.9, 0.235), (-1.70, 0.212), (-0.95, 0.186), (1.07, 0.186), (1.73, 0.19), (2.0, 0.205),
          (2.24, 0.223), (2.30, 0.235), (2.315, 0.27)])
# shoulder (window bottom) line, px read along the glass lower edge
BELT = Tab([(X(p), Z(q)) for p, q in [(170, 150), (300, 156), (420, 160), (500, 164), (600, 171), (700, 178), (800, 181), (900, 186), (1000, 190), (1100, 196), (1180, 199), (1262, 203), (1340, 206)]])
# plan half-width of the body (max over height), end rounding; no top-view blueprint -> known width + typical sedan corner radii
PW = Tab([(-2.315, 0.52), (-2.305, 0.60), (-2.28, 0.67), (-2.24, 0.73), (-2.18, 0.78), (-2.10, 0.82), (-2.0, 0.855), (-1.85, 0.88), (-1.6, 0.89), (1.6, 0.89),
          (1.8, 0.885), (1.95, 0.88), (2.07, 0.865), (2.17, 0.84), (2.25, 0.79), (2.295, 0.70), (2.315, 0.57)])
HWT = Tab([(0.15, 0.78), (0.19, 0.80), (0.26, 0.845), (0.35, 0.875), (0.5, 0.89), (0.8, 0.89), (0.9, 0.885), (1.0, 0.875)])   # body half width vs height
TUMB, INSET, RA = 0.62, 0.30, 0.352
LROWS = [0, 0.03, 0.07, 0.115, 0.2, 0.32, 0.46, 0.62, 0.8, 1.0]; NR_ = len(LROWS); NW, NA, NC = 3, 4, 4
HALF = 1 + NR_ + NW + NA + NC; NRING = 2 * HALF - 2

def arch_z(x):
    for c in (XF, XR):
        if abs(x - c) < RA: return ZC + math.sqrt(RA * RA - (x - c) ** 2)
    return -1.0

def ring(x):
    """half profile bottom-centre -> top-centre as [(y,z)], inset flags, shoulder z"""
    zb, st, f = ZB(x), ST(x), PW(x) / HW
    zs = max(min(BELT(x) - 0.035, st - 0.085), zb + 0.12); st = max(st, zs + 0.03)
    zr = [zb + t * (zs - zb) for t in LROWS]
    half, fl = [(0.0, zb)], [False]
    for z in zr: half.append((HWT(z) * f, z)); fl.append(False)
    hws = HWT(zs) * f; h = st - zs
    c = 0.011 + 0.034 * sstep(h / 0.15); rc = min(0.07 + 0.05 * sstep(h / 0.2), 0.9 * (st - c - zs)); zt = st - c; zw = zt - rc
    yw = hws - TUMB * (zw - zs)
    for j in range(1, NW + 1): z = zs + (zw - zs) * j / NW; half.append((hws - TUMB * (z - zs), z)); fl.append(False)
    p0, p1, p2 = Vector((yw, zw)), Vector((yw - TUMB * rc, zt)), Vector((yw - TUMB * rc - 0.9 * rc, zt))
    for j in range(1, NA + 1): t = j / NA; q = (1 - t) ** 2 * p0 + 2 * t * (1 - t) * p1 + t * t * p2; half.append((q.x, q.y)); fl.append(False)
    yc = p2.x
    for j in range(1, NC + 1): y = yc * (1 - j / NC); half.append((y, st - c * (y / yc) ** 2 if yc > 1e-6 else st)); fl.append(False)
    assert len(half) == HALF, (len(half), HALF)
    return half, fl, zs

def full_ring(x):
    half, fl, zs = ring(x)
    pts = [Vector((x, y, z)) for y, z in half] + [Vector((x, -y, z)) for y, z in half[-2:0:-1]]
    flags = fl + fl[-2:0:-1]
    return pts, flags, zs

def stations():
    tail = [-2.315, -2.311, -2.305, -2.296, -2.285, -2.274, -2.262, -2.245, -2.225, -2.195, -2.16, -2.11, -2.05, -1.98]
    nose = [2.315, 2.311, 2.305, 2.298, 2.289, 2.278, 2.265, 2.25, 2.23, 2.2, 2.16, 2.11, 2.05, 1.98]
    xs = set(tail + nose)
    xs |= {round(v, 4) for v in np.arange(-1.90, 1.91, 0.13)}
    xs = sorted(xs)
    out = [xs[0]]
    for v in xs[1:]:
        if v - out[-1] > 0.0035: out.append(v)
    return out

def cabin_h(x):
    half, fl, zs = ring(x); return half[-1][1] - zs

# ================= six export meshes, per-corner vertex colours =================
SEM = ['FleetBody', 'FleetGlass', 'FleetTrim', 'FleetRubber', 'FleetLights', 'FleetInterior']
C = dict(white=(1, 1, 1, 1), black=(.022, .026, .030, 1), dark=(.050, .054, .060, 1), chrome=(.80, .82, .85, 1), alloy=(.46, .48, .51, 1), glass=(.060, .105, .140, 1),
         tyre=(.019, .022, .025, 1), head=(.93, .96, 1, 1), red=(.65, .012, .018, 1), dred=(.30, .006, .010, 1), amber=(1, .29, .02, 1), plate=(.90, .90, .84, 1),
         seat=(.055, .058, .066, 1), dash=(.035, .038, .044, 1), liner=(.20, .19, .18, 1), disc=(.16, .16, .17, 1))
BM = {s: bmesh.new() for s in SEM}
CL = {s: BM[s].loops.layers.float_color.new('Color') for s in SEM}
def paint(f, col):
    for l in f.loops: l[CL[f.id_sem]] = col if False else col
def face(sem, col, vs, ref=None):
    """vs: bmesh verts or Vectors of one face in `sem` mesh; ref: point the normal must point away from (or None)."""
    bm = BM[sem]; vv = [bm.verts.new(v) if isinstance(v, Vector) else v for v in vs]
    try: f = bm.faces.new(vv)
    except ValueError: return None
    if ref is not None:
        f.normal_update(); c = f.calc_center_median(); r = ref(c) if callable(ref) else ref
        if f.normal.dot(c - r) < 0: f.normal_flip()
    for l in f.loops: l[CL[sem]] = col
    return f
def grid(sem, col, rows, ref=None, flip=False):
    """rows: list of equal-length lists of Vectors (shared vertices -> smooth)."""
    bm = BM[sem]; vr = [[bm.verts.new(p) for p in r] for r in rows]
    for a, b in zip(vr, vr[1:]):
        for i in range(len(a) - 1):
            q = (a[i], a[i + 1], b[i + 1], b[i]); face(sem, col, q[::-1] if flip else q, ref)
    return vr

# ================= body loft (closed solid) =================
XS = stations(); RINGS = [full_ring(x) for x in XS]
CAB = [cabin_h(x) > 0.09 for x in XS]
body_faces, gh_faces = [], []                      # (a,b,c,d, black?) vertex position tuples built later
def build_loft():
    bm = bmesh.new(); gh = bmesh.new(); VB, VG = {}, {}
    def bv(i, j, b, d):
        k = (i, j)
        if k not in d: d[k] = b.verts.new(RINGS[i][0][j])
        return d[k]
    def flagged(i, j): return RINGS[i][1][j]
    n = NRING
    for i in range(len(XS) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            gh_face = CAB[i] and CAB[i + 1] and NR_ <= j <= 2 * HALF - 3 - NR_
            if gh_face:
                b, d = gh, VG
            else:
                b, d = bm, VB
            vs = (bv(i, j, b, d), bv(i, j2, b, d), bv(i + 1, j2, b, d), bv(i + 1, j, b, d))
            try: f = b.faces.new(vs)
            except ValueError: continue
            f.material_index = 0
            xm = (XS[i] + XS[i + 1]) / 2; nl = (5 if xm < 0 else 4) if abs(xm) > 1.75 else 3      # bumpers: taller black valance, sill: slim skirt
            low = (j <= nl) or (j >= 2 * HALF - 2 - nl - 1)       # lowest rows -> black cladding
            f.material_index = 1 if low else 0
    for sgn, i in ((1, len(XS) - 1), (-1, 0)):         # end caps: fan around the ring centroid
        pts = [bv(i, j, bm, VB) for j in range(n)]; c = bm.verts.new(sum((p.co for p in pts), Vector()) / n)
        for j in range(n):
            f = bm.faces.new((c, pts[j], pts[(j + 1) % n]) if sgn > 0 else (c, pts[(j + 1) % n], pts[j])); f.material_index = 0
    return bm, gh

# ================= finish: objects, smoothing, fit, export, self-check =================
def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = .34 if name in ('FleetBody', 'FleetGlass') else .65; p.inputs['Metallic'].default_value = .32 if name == 'FleetBody' else .08
    if name == 'FleetGlass': p.inputs['Roughness'].default_value = .16; p.inputs['Metallic'].default_value = .4
    c = m.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name = 'Color'; m.node_tree.links.new(c.outputs['Color'], p.inputs['Base Color'])
    m.diffuse_color = (1, 1, 1, 1); m.use_backface_culling = True
    return m
FIT = {}
def finish(out=OUT, fit=True, save_blend=None):
    objs = []
    for s in SEM:
        bm = BM[s]
        if not bm.faces: continue
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=2e-5)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-6)
        me = bpy.data.meshes.new(s); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(s, me); bpy.context.collection.objects.link(ob)
        me.materials.append(material(s)); me.color_attributes.active_color = me.color_attributes['Color']; me.color_attributes.default_color_name = 'Color'; objs.append(ob)
    for ob in objs:                                                   # the loop colour layer is named 'Color' already
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(62)); ob.select_set(False)
    if fit:                                                           # exact envelope: length, height, centred, ground origin
        allv = [v.co for o in objs for v in o.data.vertices]; lo = [min(v[i] for v in allv) for i in range(3)]; hi = [max(v[i] for v in allv) for i in range(3)]
        sx, sz = L / (hi[0] - lo[0]), H_ / (hi[2] - lo[2]); cx = (hi[0] + lo[0]) / 2
        print('FIT scale x %.4f z %.4f  width %.3f' % (sx, sz, hi[1] - lo[1])); FIT.update(cx=cx, sx=sx, lz=lo[2], sz=sz, width=hi[1] - lo[1])
        for o in objs:
            for v in o.data.vertices: v.co = Vector(((v.co.x - cx) * sx, v.co.y, (v.co.z - lo[2]) * sz))
            o.data.update()
    root = bpy.data.objects.new('toyota-corolla', None); bpy.context.collection.objects.link(root)
    for o in objs: o.parent = root
    if save_blend: bpy.ops.wm.save_as_mainfile(filepath=str(save_blend))
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_texcoords=False, export_attributes=False, export_cameras=False, export_lights=False, export_extras=False)
    return objs

def validate(path):
    raw = Path(path).read_bytes(); assert raw[:4] == b'glTF'
    n = struct.unpack_from('<I', raw, 12)[0]; g = json.loads(raw[20:20 + n]); binary = raw[28 + n:]
    assert len(g['meshes']) == 6 and sorted(m['name'] for m in g['materials']) == sorted(SEM)
    assert not any(m.get('doubleSided', False) for m in g['materials'])
    def values(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; comp = {'VEC3': 3, 'VEC4': 4, 'SCALAR': 1}[a['type']]
        code, size = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}[a['componentType']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', comp * size)
        return [struct.unpack_from('<' + code * comp, binary, off + j * stride) for j in range(a['count'])]
    pts, tris, verts = [], 0, 0
    for mesh in g['meshes']:
        assert len(mesh['primitives']) == 1; pr = mesh['primitives'][0]; at = pr['attributes']; assert all(k in at for k in ('POSITION', 'NORMAL', 'COLOR_0'))
        p = values(at['POSITION']); nn = values(at['NORMAL']); pts += p; verts += len(p); assert len(p) == len(nn)
        assert all(math.isfinite(c) for q in p for c in q) and all(abs(sum(c * c for c in q) - 1) < .001 for q in nn)
        ind = values(pr['indices']); tris += len(ind) // 3
    lo = [min(q[i] for q in pts) for i in range(3)]; hi = [max(q[i] for q in pts) for i in range(3)]
    assert abs(lo[1]) < 1e-5 and abs(hi[1] - H_) < 1e-5 and abs(lo[0] + L / 2) < 1e-5 and abs(hi[0] - L / 2) < 1e-5, (lo, hi)
    return dict(triangles=tris, vertices=verts, lo=lo, hi=hi, bytes=len(raw))

# ================= boolean helpers =================
def mkobj(bm, name, nmat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for i in range(nmat): me.materials.append(bpy.data.materials.new('%s_%d' % (name, i)))
    return ob
def cutter(name, parts):
    """parts: list of (ring_a, ring_b) vertex-position loops sharing count -> closed prism; material 1/2 set by caller via idx"""
    bm = bmesh.new()
    for lo, hi, mi in parts:
        a = [bm.verts.new(p) for p in lo]; b = [bm.verts.new(p) for p in hi]; n = len(a)
        for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])).material_index = mi
        bm.faces.new(a[::-1]).material_index = mi; bm.faces.new(b).material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return mkobj(bm, name, 3)
def prism_y(poly, y0, y1, mi): return ([Vector((u, y0, v)) for u, v in poly], [Vector((u, y1, v)) for u, v in poly], mi)
def prism_z(poly, z0, z1, mi): return ([Vector((u, v, z0)) for u, v in poly], [Vector((u, v, z1)) for u, v in poly], mi)
def cyl_y(xc, zc, r, y0, y1, mi, seg=48):
    poly = [(xc + r * math.cos(2 * math.pi * k / seg), zc + r * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
    return prism_y(poly, y0, y1, mi)
def bool_cut(ob, cut):
    bpy.context.view_layer.objects.active = ob
    m = ob.modifiers.new('cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.solver = 'EXACT'; m.object = cut; m.use_hole_tolerant = True
    bpy.ops.object.modifier_apply(modifier=m.name); bpy.data.objects.remove(cut, do_unlink=True)
def absorb(ob, mapping, to_remove=True):
    """copy faces of a Blender object into the six export meshes by material index; verts are shared per (target) for smoothing."""
    bm = bmesh.new(); bm.from_mesh(ob.data); vmap = {}
    for f in bm.faces:
        sem, col = mapping[f.material_index]; tb = BM[sem]; vs = []
        for v in f.verts:
            k = (sem, v.index)
            if k not in vmap: vmap[k] = tb.verts.new(v.co)
            vs.append(vmap[k])
        try: nf = tb.faces.new(vs)
        except ValueError: continue
        for l in nf.loops: l[CL[sem]] = col
    bm.free()
    if to_remove: bpy.data.objects.remove(ob, do_unlink=True)

# ================= greenhouse side-window outlines (px read from the side blueprint) =================
T_TAB = Tab([(X(p), Z(q)) for p, q in [(423, 102), (450, 86), (480, 72), (530, 59), (600, 47), (680, 40), (750, 37), (830, 36), (900, 37), (1000, 50), (1100, 82), (1150, 107), (1200, 142), (1250, 175), (1262, 182)]])
B_TAB = Tab([(X(p), Z(q)) for p, q in [(423, 160), (500, 164), (600, 171), (700, 178), (800, 181), (900, 186), (1000, 190), (1100, 196), (1180, 198), (1214, 199), (1262, 186)]])
# window = (left edge bottom x, left edge top x, right edge bottom x, right edge top x) in px
WINDOWS = {'quarter': (424, 423, 546, 526), 'rear': (558, 538, 758, 748), 'front': (836, 806, 1210, 1192), 'tri': (1216, 1214, 1262, 1262)}
def window_poly(name, n=9, inset=0.0):
    lb, lt, rb, rt = [X(v) for v in WINDOWS[name]]; pts = []
    for i in range(n + 1): x = lerp(lb, rb, i / n); pts.append((x, B_TAB(x) + inset))                     # bottom edge, left -> right
    for i in range(n + 1): x = lerp(rt, lt, i / n); pts.append((x, T_TAB(x) - inset))                     # top edge, right -> left
    return pts

def build_all_shell():
    bm, gh = build_loft(); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    body = mkobj(bm, 'body', 2)
    cs = [cyl_y(c, ZC, RA, sg * 0.59, sg * 1.2, 1) for c in (XF, XR) for sg in (1, -1)]
    for k, c in enumerate(cs): bool_cut(body, cutter('a%d' % k, [c]))
    absorb(body, {0: ('FleetBody', C['white']), 1: ('FleetRubber', C['black'])})
    g = mkobj(gh, 'gh', 3)
    bpy.context.view_layer.objects.active = g
    m = g.modifiers.new('s', 'SOLIDIFY'); m.thickness = 0.022; m.offset = -1; m.use_even_offset = True; m.use_rim = True; m.material_offset = 1; m.material_offset_rim = 1
    bpy.ops.object.modifier_apply(modifier=m.name)
    parts = []
    for sg in (1, -1):
        for nm in WINDOWS: parts.append(prism_y(window_poly(nm), sg * 0.25, sg * 1.1, 2))
    parts.append(prism_z([(0.40, -0.52), (0.70, -0.585), (1.0, -0.64), (1.145, -0.665), (1.145, 0.665), (1.0, 0.64), (0.70, 0.585), (0.40, 0.52)], 0.8, 1.7, 2))
    parts.append(prism_z([(-1.28, -0.50), (-1.55, -0.55), (-1.835, -0.60), (-1.835, 0.60), (-1.55, 0.55), (-1.28, 0.50)], 0.8, 1.7, 2))
    for k, pt in enumerate(parts): bool_cut(g, cutter('w%d' % k, [pt]))
    absorb(g, {0: ('FleetBody', C['white']), 1: ('FleetInterior', C['liner']), 2: ('FleetTrim', C['black'])})

# ================= surface queries (same equations as the loft) =================
def wall_y(x, z):
    """half width of the wall at height z (z above the shoulder uses the tumblehome part of the ring)"""
    half, _, zs = ring(x)
    for i in range(NR_, HALF - 1):
        (ya, za_), (yb, zb_) = half[i], half[i + 1]
        if za_ <= z <= zb_ and zb_ > za_: return lerp(ya, yb, (z - za_) / (zb_ - za_))
    return half[-1][0]
def top_z(x, y):
    """height of the upper surface at lateral |y| (walks the crown/corner part from the top centre outward)"""
    half, _, zs = ring(x); y = abs(y)
    for i in range(HALF - 1, NR_, -1):
        (ya, za_), (yb, zb_) = half[i], half[i - 1]
        if ya <= y <= yb and yb > ya: return lerp(za_, zb_, (y - ya) / (yb - ya))
    return half[NR_][1]

# ================= wheels: rounded tyre, graphite dish, ten twin-spoke alloys (5 pairs), hub, dark disc =================
SEG = 22
TYRE = [(0.2085, 0.0935), (0.2215, 0.1005), (0.262, 0.1035), (0.300, 0.0940), (0.3190, 0.0600), (0.3258, 0.0140)]   # (r, y) outer half; mirrored for the inner half
def build_wheel(cx, side):
    wy = side * 0.78
    ang = [2 * math.pi * k / SEG for k in range(SEG)]
    def P(r, yo, k): return Vector((cx + r * math.cos(ang[k]), wy + side * yo, ZC + r * math.sin(ang[k])))
    def vring(sem, r, yo): return [BM[sem].verts.new(P(r, yo, k)) for k in range(SEG)]
    def band(sem, col, A, B, ref):
        for k in range(SEG): face(sem, col, (A[k], A[(k + 1) % SEG], B[(k + 1) % SEG], B[k]), ref)
    def tref(rc, yo): return lambda c: (lambda t: Vector((cx + rc * math.cos(t), wy + side * yo, ZC + rc * math.sin(t))))(math.atan2(c.z - ZC, c.x - cx))
    prof = [(r, -y) for r, y in TYRE] + [(r, y) for r, y in reversed(TYRE)]
    rows = [vring('FleetRubber', r, y) for r, y in prof]
    for a, b in zip(rows, rows[1:]): band('FleetRubber', C['tyre'], a, b, tref(0.265, 0.0))
    bead_in = vring('FleetRubber', 0.2085, -0.0935); bead_ce = [BM['FleetRubber'].verts.new(Vector((cx, wy - side * 0.0935, ZC)))]
    # inner sidewall closes onto the rim barrel; outer: rim lip + barrel + dark disc + spokes
    lip_o, lip_i = vring('FleetTrim', 0.2085, 0.0935), vring('FleetTrim', 0.2032, 0.0935)
    band('FleetTrim', C['alloy'], lip_i, lip_o, lambda c: Vector((cx, c.y + side * 1, ZC)) )
    bar_t = vring('FleetTrim', 0.1960, 0.0880); band('FleetTrim', C['alloy'], bar_t, lip_i, lambda c: Vector((cx, wy, ZC)))
    bar_b = vring('FleetTrim', 0.1960, 0.030); band('FleetTrim', C['dark'], bar_b, bar_t, lambda c: Vector((c.x, c.y, c.z)) * 0 + Vector((cx, c.y, ZC)), )
    cen = BM['FleetTrim'].verts.new(P(0, 0.030, 0))
    for k in range(SEG): face('FleetTrim', C['disc'], (cen, bar_b[(k + 1) % SEG], bar_b[k]), lambda c: Vector((c.x, wy - side * 1, c.z)))
    ry = lambda r: 0.056 + 0.026 * ((r - 0.05) / 0.14) ** 0.7          # concave dish: spokes sit proud of the dark disc
    sw = lambda r: 0.0125 + 0.0105 * (r - 0.05) / 0.14
    RR = [0.052, 0.10, 0.15, 0.19]
    for pair in range(5):
        for off in (-0.16, 0.16):
            a = 2 * math.pi * pair / 5 + off; ca, sa = math.cos(a), math.sin(a)
            def Q(r, w, yo): return Vector((cx + r * ca - w * sa, wy + side * yo, ZC + r * sa + w * ca))
            top = [(Q(r, -sw(r), ry(r)), Q(r, sw(r), ry(r))) for r in RR]; bot = [(Q(r, -sw(r), 0.032), Q(r, sw(r), 0.032)) for r in RR]
            mid = Vector((cx + 0.12 * ca, wy, ZC + 0.12 * sa))
            for i in range(len(RR) - 1):
                face('FleetTrim', C['alloy'], (top[i][0], top[i][1], top[i + 1][1], top[i + 1][0]), lambda c: Vector((c.x, wy - side * 1, c.z)))
                face('FleetTrim', C['alloy'], (top[i][1], bot[i][1], bot[i + 1][1], top[i + 1][1]), mid)
                face('FleetTrim', C['alloy'], (bot[i][0], top[i][0], top[i + 1][0], bot[i + 1][0]), mid)
            face('FleetTrim', C['alloy'], (top[-1][0], top[-1][1], bot[-1][1], bot[-1][0]), mid)      # spoke end at the rim
    hub_o, hub_i = vring('FleetTrim', 0.058, 0.030), vring('FleetTrim', 0.058, 0.066); band('FleetTrim', C['alloy'], hub_o, hub_i, lambda c: Vector((cx, c.y, ZC)) )
    hc = BM['FleetTrim'].verts.new(P(0, 0.072, 0))
    for k in range(SEG): face('FleetTrim', C['chrome'], (hc, hub_i[k], hub_i[(k + 1) % SEG]), lambda c: Vector((cx, wy - side * 1, ZC)))
    # brake caliper hint between spokes
    for k in range(3):
        a0, a1 = math.radians(-30 + 16 * k), math.radians(-30 + 16 * (k + 1)); q = lambda r, aa: Vector((cx + r * math.cos(aa), wy + side * 0.042, ZC + r * math.sin(aa)))
        face('FleetTrim', C['black'], (q(0.10, a0), q(0.19, a0), q(0.19, a1), q(0.10, a1)), lambda c: Vector((c.x, wy - side * 1, c.z)))
def build_wheels():
    for cx in (XF, XR):
        for sd in (1, -1): build_wheel(cx, sd)

# ================= glass panes (recessed inside the cut openings) + opaque black frit border on screens =================
def build_glass():
    for sg in (1, -1):
        for nm in WINDOWS:
            lb, lt, rb, rt = [X(v) for v in WINDOWS[nm]]; nu, nv = (8, 3) if nm != 'tri' else (4, 2); rows = []
            for j in range(nv + 1):
                b = 0.04 + 0.92 * j / nv
                row = []
                for i in range(nu + 1):
                    a = 0.035 + 0.93 * i / nu; xl, xr = lerp(lb, lt, b), lerp(rb, rt, b); x = lerp(xl, xr, a); z = lerp(B_TAB(x), T_TAB(x), b)
                    row.append(Vector((x, sg * (wall_y(x, z) - 0.011), z)))
                rows.append(row)
            grid('FleetGlass', C['glass'], rows, ref=lambda c, sg=sg: Vector((c.x, sg * 0.0, c.z)))
    def screen(xa, xb, hwf, name):
        # xa = base (lower) x, xb = header x; hwf(x) = half width of the opening there
        cols = [0, 0.018, 0.07, 0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85, 0.93, 0.982, 1.0]; rowsb = [0, 0.04, 0.2, 0.4, 0.6, 0.8, 0.96, 1.0]
        for j in range(len(rowsb) - 1):
            for i in range(len(cols) - 1):
                ps = []
                for (aa, bb) in ((cols[i], rowsb[j]), (cols[i + 1], rowsb[j]), (cols[i + 1], rowsb[j + 1]), (cols[i], rowsb[j + 1])):
                    x = lerp(xa, xb, bb); y = (2 * aa - 1) * (hwf(x) - 0.004); ps.append(Vector((x, y, top_z(x, y) - 0.011)))
                border = i in (0, len(cols) - 2) or j in (0, len(rowsb) - 2)
                face('FleetTrim' if border else 'FleetGlass', C['black'] if border else C['glass'], ps, ref=lambda c: Vector((c.x, c.y * 0, c.z - 1.0)))
    screen(1.145, 0.40, Tab([(0.40, 0.52), (0.70, 0.585), (1.0, 0.64), (1.145, 0.665)]), 'wind')
    screen(-1.835, -1.28, Tab([(-1.835, 0.60), (-1.55, 0.55), (-1.28, 0.50)]), 'back')

# ================= primitives for details =================
def box(sem, col, c, s, ref_in=False):
    c = Vector(c); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2; v = lambda sx, sy, sz: Vector((c.x + sx * hx, c.y + sy * hy, c.z + sz * hz))
    q = [(v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1)), (v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)), (v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
         (v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)), (v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1)), (v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1))]
    for f in q: face(sem, col, f, c)
def ellipsoid(sem, col, c, s, us=12, vs=7):
    c = Vector(c); rows = []
    for j in range(vs + 1):
        ph = math.pi * j / vs - math.pi / 2; rows.append([Vector((c.x + s[0] * math.cos(ph) * math.cos(2 * math.pi * i / us), c.y + s[1] * math.cos(ph) * math.sin(2 * math.pi * i / us), c.z + s[2] * math.sin(ph))) for i in range(us)])
    bm = BM[sem]; vr = [[bm.verts.new(p) for p in r] for r in rows]
    for a, b in zip(vr, vr[1:]):
        for i in range(us): face(sem, col, (a[i], a[(i + 1) % us], b[(i + 1) % us], b[i]), c)
def torus(sem, col, c, n, R, r, seg=18, sides=4):
    c = Vector(c); n = Vector(n).normalized(); u = (Vector((0, 0, 1)) - n * n.z).normalized(); v = n.cross(u); bm = BM[sem]; rings = []
    for k in range(seg):
        a = 2 * math.pi * k / seg; d = u * math.cos(a) + v * math.sin(a); cc = c + d * R
        rings.append([bm.verts.new(cc + (d * math.cos(b) + n * math.sin(b)) * r) for b in (2 * math.pi * s / sides for s in range(sides))])
    for k in range(seg):
        A, B = rings[k], rings[(k + 1) % seg]
        for s in range(sides): face(sem, col, (A[s], A[(s + 1) % sides], B[(s + 1) % sides], B[s]), lambda ctr, c=c, n=n: c + ((ctr - c) - n * (ctr - c).dot(n)).normalized() * R)
def tube(sem, col, pts, r, sides=6, closed=False, up=Vector((0, 0, 1))):
    """round-section tube along a polyline (Vectors), flat end caps omitted"""
    bm = BM[sem]; n = len(pts); rings = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if (closed or i > 0) else p; b = pts[(i + 1) % n] if (closed or i < n - 1) else p
        t = (b - a).normalized(); l = t.cross(up)
        if l.length < 1e-4: l = t.cross(Vector((0, 1, 0)))
        l.normalize(); m = t.cross(l).normalized()
        rings.append([bm.verts.new(p + (l * math.cos(2 * math.pi * k / sides) + m * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    for i in range(n if closed else n - 1):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(sides): face(sem, col, (A[k], A[(k + 1) % sides], B[(k + 1) % sides], B[k]), pts[i])

# ================= interior seen through the glass =================
def build_interior():
    I, c = 'FleetInterior', C
    box(I, c['dash'], (-0.25, 0, 0.44), (2.6, 1.30, 0.03))                                            # floor
    for sg in (1, -1):
        box(I, c['liner'], (-0.30, sg * 0.715, 0.70), (2.5, 0.04, 0.50))                              # door cards, top just under the glass line
        box(I, c['seat'], (0.36, sg * 0.37, 0.52), (0.52, 0.46, 0.13)); box(I, c['seat'], (0.09, sg * 0.37, 0.80), (0.12, 0.46, 0.62))   # front seats (cushion, back)
        ellipsoid(I, c['seat'], (0.04, sg * 0.37, 1.13), (0.055, 0.115, 0.075), 8, 5)                         # head restraints
        box(I, c['seat'], (0.15, sg * 0.37, 0.55), (0.34, 0.06, 0.06))
    box(I, c['seat'], (-0.72, 0, 0.52), (0.52, 1.20, 0.12)); box(I, c['seat'], (-0.99, 0, 0.82), (0.12, 1.20, 0.58))                   # rear bench
    for yy in (-0.38, 0, 0.38): ellipsoid(I, c['seat'], (-1.00, yy, 1.15), (0.05, 0.095, 0.07), 8, 5)
    box(I, c['dash'], (0.98, 0, 0.84), (0.42, 1.36, 0.22)); box(I, c['dash'], (0.86, 0, 0.95), (0.30, 1.30, 0.05))                       # dashboard
    box(I, c['dash'], (0.78, 0.37, 0.98), (0.12, 0.30, 0.16))                                                                              # instrument hood
    box(I, c['dash'], (0.30, 0, 0.60), (1.1, 0.20, 0.24))                                                                                  # tunnel console
    torus(I, c['dash'], (0.72, 0.37, 0.98), (-1, 0, 0.55), 0.17, 0.015)                                                                    # steering wheel (LHD)
    box(I, c['dash'], (-1.55, 0, 1.00), (0.60, 1.10, 0.03))                                                                                # parcel shelf
    box(I, c['dash'], (-1.80, 0, 0.62), (0.05, 1.2, 0.8))                                                                                  # boot bulkhead

# ================= decals projected onto the shell by ray casts =================
BVH = None
DIRS = {'F': (Vector((7, 0, 0)), Vector((-1, 0, 0))), 'R': (Vector((-7, 0, 0)), Vector((1, 0, 0))), 'L': (Vector((0, 7, 0)), Vector((0, -1, 0))),
        'Rt': (Vector((0, -7, 0)), Vector((0, 1, 0))), 'T': (Vector((0, 0, 7)), Vector((0, 0, -1)))}
_c, _s = math.cos(math.radians(36)), math.sin(math.radians(36))
DIAG = {'DL': (Vector((-_c, -_s, 0)), Vector((-_s, _c, 0)), 2.15), 'DR': (Vector((-_c, _s, 0)), Vector((_s, _c, 0)), 2.15),
        'RDL': (Vector((_c, -_s, 0)), Vector((_s, _c, 0)), -2.2), 'RDR': (Vector((_c, _s, 0)), Vector((-_s, _c, 0)), -2.2)}
def diag(kind, pts):
    d, pp, x0 = DIAG[kind]; return [(pp.x * x0 + pp.y * y, z) for y, z in pts]
def hit(kind, u, v):
    if kind in DIAG:
        d, pp, x0 = DIAG[kind]; o = -d * 7 + pp * u + Vector((0, 0, v))
        loc, n, i, dist = BVH.ray_cast(o, d, 20)
        if loc is None: return None
        if n.dot(d) > 0: n = -n
        return loc, n
    """kind F/R: (u,v)=(y,z); L/Rt: (x,z); T: (x,y).  returns (point, normal) or None"""
    o = {'F': Vector((7, u, v)), 'R': Vector((-7, u, v)), 'L': Vector((u, 7, v)), 'Rt': Vector((u, -7, v)), 'T': Vector((u, v, 7))}[kind]; d = DIRS[kind][1]
    loc, n, i, dist = BVH.ray_cast(o, d, 20)
    if loc is None: return None
    if n.dot(d) > 0: n = -n
    return loc, n
def patch(kind, P, na, nb, sem, col, eps=0.002, uv=None):
    """grid over the unit square; P(a,b)->(u,v) in the projection plane. Missing hits are skipped."""
    pts = [[None] * (na + 1) for _ in range(nb + 1)]
    for j in range(nb + 1):
        for i in range(na + 1):
            h = hit(kind, *P(i / na, j / nb))
            if h: pts[j][i] = (h[0] + h[1] * (eps + 0.003), h[1])
    bm = BM[sem]; vs = [[bm.verts.new(q[0]) if q else None for q in r] for r in pts]
    for j in range(nb):
        for i in range(na):
            qs = [(vs[j][i], pts[j][i]), (vs[j][i + 1], pts[j][i + 1]), (vs[j + 1][i + 1], pts[j + 1][i + 1]), (vs[j + 1][i], pts[j + 1][i])]
            if any(v is None for v, _ in qs): continue
            f = face(sem, col, [v for v, _ in qs]); 
            if f is None: continue
            nn = sum((q[1] for _, q in qs), Vector())
            f.normal_update()
            if f.normal.dot(nn) < 0: f.normal_flip()
    return vs
def ribbon(kind, uvs, width, sem, col, eps=0.0015):
    dense = []
    for a, b in zip(uvs, uvs[1:]):
        k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.035)); dense += [(lerp(a[0], b[0], q / k), lerp(a[1], b[1], q / k)) for q in range(k)]
    dense.append(uvs[-1]); uvs = dense
    hs = [hit(kind, *p) for p in uvs]; hs = [h for h in hs if h]
    if len(hs) < 2: return
    rows = []
    for i, (p, n) in enumerate(hs):
        a = hs[max(i - 1, 0)][0]; b = hs[min(i + 1, len(hs) - 1)][0]; t = (b - a).normalized(); s = t.cross(n).normalized()
        rows.append([p + n * (eps + 0.003) + s * width / 2 * q for q in (-1, 1)])
    bm = BM[sem]; vr = [[bm.verts.new(q) for q in r] for r in rows]
    for i in range(len(vr) - 1):
        f = face(sem, col, (vr[i][0], vr[i][1], vr[i + 1][1], vr[i + 1][0]))
        if f:
            f.normal_update()
            if f.normal.dot(hs[i][1]) < 0: f.normal_flip()
def line3(kind, uvs, r, sem, col, eps=0.004, sides=5):
    hs = [hit(kind, *p) for p in uvs]; hs = [h for h in hs if h]
    if len(hs) >= 2: tube(sem, col, [p + n * eps for p, n in hs], r, sides)
def poly_patch(kind, outline, n, sem, col, eps=0.002):
    """fill a convex-ish outline: fan of rows between left/right boundary pairs given as outline=[(u,v),...] closed; simple radial grid about the centroid"""
    dense = []
    for i, a in enumerate(outline):
        b = outline[(i + 1) % len(outline)]; k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.045))
        dense += [(lerp(a[0], b[0], q / k), lerp(a[1], b[1], q / k)) for q in range(k)]
    outline = dense; n = max(n, 3)
    cu = sum(p[0] for p in outline) / len(outline); cv = sum(p[1] for p in outline) / len(outline); m = len(outline)
    def P(a, b):
        k = a * m; i = int(k) % m; t = k - int(k); q = (outline[i][0] * (1 - t) + outline[(i + 1) % m][0] * t, outline[i][1] * (1 - t) + outline[(i + 1) % m][1] * t)
        return (cu + (q[0] - cu) * b, cv + (q[1] - cv) * b)
    return patch(kind, P, m, n, sem, col, eps)

# ================= details =================
def sym(poly, sg): return [(sg * u, v) for u, v in poly]
def circle(cu, cv, r, n=14, sy=1.0): return [(cu + r * math.cos(2 * math.pi * k / n), cv + r * sy * math.sin(2 * math.pi * k / n)) for k in range(n)]
def sidekind(sg): return 'L' if sg > 0 else 'Rt'
def px2m(pts): return [(X(a), Z(b)) for a, b in pts]
def build_front():
    HEAD = [(0.30, 0.722), (0.50, 0.762), (0.70, 0.774), (0.83, 0.748), (0.862, 0.675), (0.825, 0.612), (0.775, 0.612), (0.768, 0.655), (0.70, 0.700), (0.50, 0.722), (0.32, 0.706)]
    LENS = [(0.34, 0.719), (0.50, 0.752), (0.70, 0.763), (0.815, 0.740), (0.845, 0.676), (0.815, 0.630), (0.785, 0.630), (0.778, 0.662), (0.70, 0.690), (0.50, 0.714), (0.35, 0.708)]
    for sg in (1, -1):
        kd = 'DL' if sg > 0 else 'DR'
        poly_patch(kd, diag(kd, sym(HEAD, sg)), 3, 'FleetTrim', C['black'], 0.0025)                      # thin dark housing
        poly_patch(kd, diag(kd, sym(LENS, sg)), 3, 'FleetTrim', C['dark'], 0.0040)                       # dark smoked lens
        ribbon(kd, diag(kd, [(sg * u, v) for u, v in [(0.38, 0.718), (0.50, 0.752), (0.70, 0.762), (0.81, 0.742)]]), 0.007, 'FleetLights', C['head'], 0.0055)   # narrow LED strip on the top edge
        ribbon(kd, diag(kd, [(sg * u, v) for u, v in [(0.835, 0.735), (0.852, 0.68), (0.828, 0.63)]]), 0.011, 'FleetLights', C['amber'], 0.0058)               # J-hook DRL
        poly_patch('F', sym([(0.56, 0.47), (0.80, 0.47), (0.81, 0.36), (0.64, 0.32), (0.56, 0.37)], sg), 3, 'FleetRubber', C['black'], 0.003)   # corner pocket
        poly_patch('F', [(sg * u, v) for u, v in circle(0.69, 0.375, 0.026)], 2, 'FleetTrim', C['dark'], 0.0045)                                 # small dark fog pod
        ribbon('F', [(sg * 0.60, 0.44), (sg * 0.79, 0.436)], 0.007, 'FleetTrim', C['dark'], 0.0045)
    poly_patch('F', [(-0.30, 0.685), (0.30, 0.685), (0.28, 0.645), (-0.28, 0.645)], 2, 'FleetTrim', C['black'], 0.0025)                        # thin upper slot
    poly_patch('F', circle(0, 0.668, 0.030, 16, 0.6), 2, 'FleetTrim', C['chrome'], 0.0045)                                                   # logo
    LOW = [(-0.34, 0.55), (0.34, 0.55), (0.46, 0.38), (0.46, 0.23), (-0.46, 0.23), (-0.46, 0.38)]
    poly_patch('F', LOW, 3, 'FleetRubber', C['black'], 0.003)                                                                                # blueprint trapezoid
    for k in range(4):
        zz = 0.27 + 0.07 * k; w = 0.44 if zz < 0.38 else 0.44 - (zz - 0.38) / 0.17 * 0.10
        ribbon('F', [(-w, zz), (w, zz)], 0.005, 'FleetTrim', (.034, .037, .042, 1), 0.0045)
    for sg in (1, -1):                                                                                                                         # bonnet shut line + crease
        ribbon('T', [(1.17, sg * 0.70), (1.45, sg * 0.725), (1.80, sg * 0.715), (2.05, sg * 0.66), (2.15, sg * 0.60)], 0.005, 'FleetTrim', C['black'], 0.0012)
        ribbon('T', [(1.20, sg * 0.40), (1.60, sg * 0.46), (2.00, sg * 0.40), (2.12, sg * 0.30)], 0.004, 'FleetTrim', C['black'], 0.0006)
def build_rear():
    TAIL = [(0.28, 0.953), (0.50, 0.968), (0.68, 0.972), (0.745, 0.945), (0.752, 0.89), (0.71, 0.84), (0.58, 0.845), (0.45, 0.885), (0.28, 0.925)]
    INN = [(0.31, 0.943), (0.50, 0.957), (0.67, 0.960), (0.727, 0.935), (0.733, 0.892), (0.695, 0.855), (0.59, 0.858), (0.46, 0.893), (0.31, 0.930)]
    for sg in (1, -1):
        kd = 'RDL' if sg > 0 else 'RDR'
        poly_patch(kd, diag(kd, sym(TAIL, sg)), 3, 'FleetTrim', C['black'], 0.0025)
        poly_patch(kd, diag(kd, sym(INN, sg)), 3, 'FleetLights', C['red'], 0.0050)                                                               # solid red lens
        ribbon(kd, diag(kd, [(sg * 0.33, 0.936), (sg * 0.50, 0.946), (sg * 0.68, 0.948), (sg * 0.715, 0.915)]), 0.012, 'FleetLights', C['dred'], 0.0062)     # darker inner graphic
        ribbon(kd, diag(kd, [(sg * 0.60, 0.872), (sg * 0.71, 0.872)]), 0.010, 'FleetLights', C['dred'], 0.0062)
        poly_patch(kd, diag(kd, [(sg * 0.712, 0.56), (sg * 0.738, 0.56), (sg * 0.738, 0.30), (sg * 0.712, 0.30)]), 2, 'FleetLights', C['red'], 0.004)  # vertical reflector
    ribbon('R', [(-0.30, 0.935), (0.30, 0.935)], 0.007, 'FleetTrim', C['black'], 0.004)                                                         # fine joining strip
    ribbon('R', [(-0.30, 0.946), (0.30, 0.946)], 0.004, 'FleetTrim', C['chrome'], 0.0045)
    ribbon('R', [(-0.27, 0.855), (0.27, 0.855), (0.27, 0.70), (-0.27, 0.70), (-0.27, 0.855)], 0.007, 'FleetTrim', C['dark'], 0.003)             # plate recess outline
    poly_patch('R', [(-0.20, 0.835), (0.20, 0.835), (0.20, 0.735), (-0.20, 0.735)], 2, 'FleetTrim', C['plate'], 0.0048)                         # plate
    poly_patch('R', circle(0, 0.885, 0.04, 14, 0.6), 2, 'FleetTrim', C['chrome'], 0.0045)                                                      # badge
    poly_patch('R', [(-0.70, 0.46), (0.70, 0.46), (0.70, 0.33), (-0.70, 0.33)], 3, 'FleetRubber', C['black'], 0.0025)                         # diffuser upper band
    for k in range(-6, 7): ribbon('R', [(k * 0.10, 0.38), (k * 0.10, 0.455)], 0.014, 'FleetTrim', C['dark'], 0.0038)                         # diffuser fins
    ribbon('R', [(-0.66, 0.465), (0.66, 0.465)], 0.006, 'FleetTrim', C['chrome'], 0.0035)
    ribbon('T', [(-2.25, -0.58), (-2.25, 0.58)], 0.02, 'FleetBody', C['white'], 0.008)                                                         # integrated boot lip
    for sg in (1, -1): ribbon('T', [(-1.85, sg * 0.585), (-2.0, sg * 0.64), (-2.2, sg * 0.68), (-2.27, sg * 0.64)], 0.005, 'FleetTrim', C['black'], 0.0012)
def build_sides():
    for sg in (1, -1):
        k = sidekind(sg)
        R_ = lambda pts: px2m(pts)
        for pts in ([(1200, 150), (1217, 240), (1218, 330), (1212, 420), (1195, 444)], [(775, 35), (797, 185), (810, 280), (808, 440)],
                    [(418, 168), (418, 188), (450, 240), (520, 330), (552, 405), (575, 438)], [(575, 442), (800, 446), (1195, 446)]):
            ribbon(k, R_(pts), 0.0055, 'FleetTrim', C['black'], 0.0012)
        ribbon(k, R_([(130, 176), (300, 179), (412, 186)]), 0.004, 'FleetTrim', C['black'], 0.0008)
        ribbon(k, R_([(1160, 240), (1365, 259)]), 0.004, 'FleetTrim', C['black'], 0.0008)
        ribbon(k, R_([(222, 226), (295, 316)]), 0.004, 'FleetTrim', C['black'], 0.0008)
        for (a, b, c_, d_) in ((818, 224, 906, 243), (470, 205, 560, 228)):                                     # door handles: recess + chrome bar
            ribbon(k, R_([(a - 4, b - 3), (c_ + 4, b - 3), (c_ + 4, d_ + 3), (a - 4, d_ + 3), (a - 4, b - 3)]), 0.004, 'FleetTrim', C['dark'], 0.0025)
            poly_patch(k, R_([(a + 4, b + 6), (c_ - 12, b + 6), (c_ - 12, d_ - 6), (a + 4, d_ - 6)]), 2, 'FleetTrim', C['chrome'], 0.003)
        ribbon(k, R_([(300, 178), (376, 178), (378, 226), (300, 226), (298, 178)]), 0.004, 'FleetTrim', C['black'], 0.0012)       # fuel flap
        xs = [lerp(X(424), X(1215), i / 24) for i in range(25)]
        ribbon(k, [(x, B_TAB(x) - 0.020) for x in xs], 0.013, 'FleetTrim', C['chrome'], 0.0035)              # chrome belt line
        xs = [lerp(X(432), X(1255), i / 30) for i in range(31)]
        ribbon(k, [(x, T_TAB(x) + 0.012) for x in xs], 0.009, 'FleetTrim', C['chrome'], 0.0035)              # chrome upper window line
        poly_patch(k, R_([(752, 36), (806, 36), (838, 186), (758, 186)]), 2, 'FleetTrim', C['black'], 0.002)  # B pillar
        poly_patch(k, R_([(528, 60), (540, 60), (550, 168), (540, 168)]), 2, 'FleetTrim', C['black'], 0.002)  # C/door gap
        for c in (XF, XR):                                                                                       # arch lip
            ribbon(k, [(c + (RA + 0.012) * math.cos(a), ZC + (RA + 0.012) * math.sin(a)) for a in [math.radians(-5 + 190 * q / 36) for q in range(37)]], 0.014, 'FleetRubber', C['black'], 0.002)
        poly_patch(k, [(1.50, 0.70), (1.58, 0.70), (1.58, 0.66), (1.50, 0.66)], 2, 'FleetLights', C['amber'], 0.003)   # side repeater
        sy = sg * 0.925
        ellipsoid('FleetBody', C['white'], (0.68, sy, 1.0), (0.095, 0.086, 0.066), 14, 8)                       # mirror
        ellipsoid('FleetTrim', C['black'], (0.61, sy, 1.0), (0.012, 0.066, 0.046), 12, 6)
        box('FleetTrim', C['black'], (0.70, sg * 0.86, 0.915), (0.07, 0.11, 0.028))
        box('FleetLights', C['amber'], (0.64, sg * 1.005, 1.0), (0.05, 0.008, 0.016))
    ellipsoid('FleetTrim', C['black'], (-1.10, 0, ST(-1.10) + 0.004), (0.085, 0.022, 0.030), 12, 6)           # shark fin
    for yy0, yy1 in ((-0.50, -0.06), (0.04, 0.46)):
        ribbon('T', [(1.10, yy0), (1.14, yy1)], 0.014, 'FleetTrim', C['black'], 0.003)
def build_details():
    global BVH
    BM['FleetBody'].normal_update(); BVH = BVHTree.FromBMesh(BM['FleetBody'])
    build_front(); build_rear(); build_sides()

def main():
    build_all_shell(); build_details(); build_wheels(); build_glass(); build_interior()
    def anch(kind, y, z):
        p, n = hit(kind, y, z); return p
    pf, pr = anch('F', 0.60, 0.69), anch('R', 0.55, 0.90)                     # lamp centres (pre-fit author coords)
    objs = finish(OUT, fit=True)
    tr = lambda p, sg: [round((p.x - FIT['cx']) * FIT['sx'], 6), round((p.z - FIT['lz']) * FIT['sz'], 6), round(sg * abs(p.y), 6)]
    v = validate(OUT); raw = OUT.read_bytes()
    rec = dict(id='toyota-corolla', name='Toyota Corolla', generation='Twelfth generation sedan, MY2020 Brazil', region='br', path='assets/vehicles/toyota-corolla.glb',
               dimensions=dict(length=L, bodyWidth=W, height=H_, wheelbase=round(XF - XR, 6), sourceWheelbase=WB, widthIncludingMirrors=round(FIT['width'], 6)),
               axles=dict(front=XF, rear=XR, height=round(RT, 6), halfTrack=0.78, wheelRadius=round(RT, 6)),
               beamAnchors=dict(front=[tr(pf, 1), tr(pf, -1)], rear=[tr(pr, 1), tr(pr, -1)]),
               materials=SEM, meshCount=6, triangles=v['triangles'], vertices=v['vertices'], bytes=v['bytes'], sha256=hashlib.sha256(raw).hexdigest(),
               sources=['https://getoutlines.com/blueprints/car/toyota/toyota-corolla-e120-2019.png', 'https://getoutlines.com/vectors/car/toyota/large/Toyota-Corolla-12-Gen-E210-Sporty-2019-blueprint-large.png',
                        'https://www.toyotacomunica.com.br/toyota-apresenta-o-novo-corolla-2020/', 'https://www.toyotaoman.com/wp-content/uploads/2020/05/Corolla-2020.pdf'],
               author='Original Blender geometry; references visual only')
    (HERE / 'record.json').write_text(json.dumps(rec, indent=2) + '\n')
    print('RECORD', json.dumps({k: rec[k] for k in ('triangles', 'vertices', 'bytes', 'sha256')}))
    return objs
if __name__ == '__main__' and 'COR_LIB' not in __import__('os').environ: main()
