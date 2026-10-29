# Authored low-floor double-decker (New Routemaster / StreetDeck proportions), fully procedural: no external model, no textures.
# Run: blender -b --factory-startup -P build_bus_dd.py -- [out.glb]
# Output contract = assets/vehicles/double-decker-bus.glb: three.js forward +X, up +Y, right +Z, ground y=0, 11.7 x 4.3 x 2.8 m, wheel nodes FL FR RL RR
# (origin at the wheel centre, no rotation: runtime spins rotation.z), one mesh per semantic material role (see BUCKETS), no textures / vertex colours;
# only BusDisplay has UVs. Blender frame while modelling: nose +X, up +Z, kerb side (left) +Y; the glTF exporter maps that to three.js.
# Liveries are position-cut regions (skirt, stripe, diagonal sweep bands, roundel) that the runtime recolours per city (BUS_VARIANTS).
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = a[0] if a else os.path.join(ROOT, 'assets/vehicles/double-decker-bus.glb')

W, ZR = 1.26, 4.10                     # hull half width, roof height
WR = 0.445
WHEELS = dict(FL=(3.015, 0.998, 0.140), FR=(3.015, -0.998, 0.140), RL=(-2.826, 0.950, 0.180), RR=(-2.826, -0.950, 0.180))
SKIRT_Z, LIP_Z, STRIPE = 0.66, 0.46, (0.80, 0.90)
SWEEP_K, T_FRONT, T_WHITE, T_LILAC = 0.68, 3.0, 2.55, 2.0          # diagonal bands: t = x + K (z - 0.3); front colour, white, lilac, rear
BUCKETS = ['BusBody', 'BusAccent', 'BusStripe', 'BusTrim', 'BusGlass', 'BusRubber', 'BusMetal', 'BusHeadlight', 'BusTaillight', 'BusDisplay', 'BusInterior',
           'BusSkirtF', 'BusSweep', 'BusLilac', 'BusRear', 'BusMark', 'BusMark2', 'BusWheel']
BI = {b: i for i, b in enumerate(BUCKETS)}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
def mat(name, hexcol, rough=0.45, metal=0.0, alpha=1.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*lin(hexcol), 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(hexcol), 1); b.inputs['Emission Strength'].default_value = emit
    return m
MATS = dict(BusBody=mat('BusBody', '#c9252b', 0.38), BusAccent=mat('BusAccent', '#8e1a1f', 0.4), BusStripe=mat('BusStripe', '#c9252b', 0.4),
            BusTrim=mat('BusTrim', '#0d0e10', 0.35), BusGlass=mat('BusGlass', '#2a4558', 0.05, 0.0, 0.6), BusRubber=mat('BusRubber', '#242629', 0.85),
            BusMetal=mat('BusMetal', '#d4d7da', 0.4, 0.4), BusHeadlight=mat('BusHeadlight', '#fff3d6', 0.2, 0, 1, 2.0),
            BusTaillight=mat('BusTaillight', '#c01414', 0.3, 0, 1, 1.0), BusDisplay=mat('BusDisplay', '#3a2a08', 0.3, 0, 1, 1.2),
            BusInterior=mat('BusInterior', '#2a2622', 0.9),
            # city-specific regions (a city that does not set one falls back to body / accent in the runtime): front skirt, sweep, lilac band, rear block, roundel ring + bar
            BusSkirtF=mat('BusSkirtF', '#8e1a1f', 0.4), BusSweep=mat('BusSweep', '#c9252b', 0.4), BusLilac=mat('BusLilac', '#c9252b', 0.4), BusRear=mat('BusRear', '#c9252b', 0.4),
            BusMark=mat('BusMark', '#f2f2f0', 0.4), BusMark2=mat('BusMark2', '#1c3f94', 0.4), BusWheel=mat('BusWheel', '#c3c8cd', 0.38, 0.5))

# ---- 1. hull: side profile (x, z) extruded across the width, then bevelled (big plan-view radius on the nose / tail chains, small on the rest)
RAD = 0.74                                                       # plan-view corner radius at nose and tail (pill ends)
RR = 0.45                                                        # roof edge radius
ZS = ZR - RR                                                     # side wall top; the roof arc starts here
XF = [(0.34, 5.62), (0.62, 5.86), (1.40, 5.86), (2.60, 5.80), (ZS, 5.60)]          # nose x(z): bumper chamfer, lamp panel, raked upper deck
XR = [(0.34, -5.66), (0.50, -5.86), (ZS, -5.84)]                                    # tail x(z)
def tab(t, z):
    z = min(max(z, t[0][0]), t[-1][0])
    for (z0, x0), (z1, x1) in zip(t, t[1:]):
        if z <= z1: return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
    return t[-1][1]
def half_w(z): return W * (1 - 0.040 * min(max((z - 2.5) / (ZS - 2.5), 0.0), 1.0))    # tumblehome
def ring(z, inset, M=8):
    """closed rounded-rectangle outline (plan view) at height z, offset inwards by inset; 4 * (M + 1) points, same topology at every level"""
    zc = min(z, ZS); xf, xr, hw = tab(XF, zc) - inset, tab(XR, zc) + inset, half_w(zc) - inset; r = max(RAD - inset, 0.03); pts = []
    for cx, cy, a0 in ((xf - r, hw - r, 0), (xr + r, hw - r, 90), (xr + r, -(hw - r), 180), (xf - r, -(hw - r), 270)):
        for k in range(M + 1):
            a = math.radians(a0 + 90 * k / M); pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    return pts
LEVELS = [(0.34, 0.05), (0.40, 0.0), (0.62, 0.0), (1.40, 0.0), (2.60, 0.0), (ZS, 0.0)]
for k in range(1, 9):
    th = math.radians(90 * k / 8); LEVELS.append((ZS + RR * math.sin(th), RR * (1 - math.cos(th))))
for k in range(1, 5): i = RR + 0.2 * k; LEVELS.append((ZR + 0.085 * (1 - ((i - RR) / 0.8) ** 2), i))
bm = bmesh.new(); rings = []
for z, ins in LEVELS:
    pts = ring(z, ins)
    if abs(z - ZS) > 1e-6 and z > ZS: pts = [(x, y, z) for x, y, _ in ring(ZS, ins)]   # roof arc / crown keep the wall-top outline, inset
    rings.append([bm.verts.new(p) for p in pts])
for r0, r1 in zip(rings, rings[1:]):
    n = len(r0)
    for i in range(n):
        if (i + 1) % (len(r0) // 4 and 9) == 0 and False: pass
        bm.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))
bm.faces.new(rings[-1][::-1]); bm.faces.new(rings[0])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bmesh.ops.triangulate(bm, faces=bm.faces[:]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
lay = bm.faces.layers.int.new('fx')       # 1 = material already decided (pockets); 0 = decided by position later
mi = bm.faces.layers.int.new('mi')
# wheel wells: 28-gon cut around each front / rear arch, inside extruded inward (black well), outer ring black trim
ARCH_R, ARCH_RING, ARCH_N = 0.60, 0.085, 28
def archcut(wx, sg, R):
    for k in range(ARCH_N):
        th = 2 * math.pi * (k + 0.5) / ARCH_N; n = Vector((math.cos(th), 0, math.sin(th)))
        co = Vector((wx, 0, WR)) + n * R
        bm.normal_update(); fs = [f for f in bm.faces if f.normal.y * sg > 0.5 and max(v.co.x for v in f.verts) > wx - R - 0.1 and min(v.co.x for v in f.verts) < wx + R + 0.1 and min(v.co.z for v in f.verts) < WR + R + 0.1]
        geom = fs + list({e for f in fs for e in f.edges}) + list({v for f in fs for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=n)
def inpoly(p, wx, R):
    return all((p.x - wx) * math.cos(2 * math.pi * (k + 0.5) / ARCH_N) + (p.z - WR) * math.sin(2 * math.pi * (k + 0.5) / ARCH_N) <= R + 1e-4 for k in range(ARCH_N))
for wx in (WHEELS['FL'][0], WHEELS['RL'][0]):
    for sg in (1, -1):
        bm.normal_update(); archcut(wx, sg, ARCH_R + ARCH_RING); bm.normal_update(); archcut(wx, sg, ARCH_R); bm.normal_update()
        ring, well = [], []
        for f in bm.faces:
            p = f.calc_center_median()
            if (f.normal.y * sg > 0.8 or (p.z < 0.45 and f.normal.y * sg > 0.4)) and p.y * sg > 1.0 and inpoly(p, wx, ARCH_R + ARCH_RING):
                (well if inpoly(p, wx, ARCH_R) else ring).append(f)
        for f in ring: f[lay] = 1; f[mi] = BI['BusTrim']
        if well:
            ext = bmesh.ops.extrude_face_region(bm, geom=well); nv = [v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)]
            bmesh.ops.delete(bm, geom=[f for f in well if f.is_valid], context='FACES_ONLY'); bmesh.ops.translate(bm, vec=(0, -sg * 0.58, 0), verts=nv)
            for g in ext['geom']:
                if isinstance(g, bmesh.types.BMFace): g[lay] = 1; g[mi] = BI['BusTrim']

# ---- 2. glazing: continuous glass bands cut into the skin by exact planes (flush glass, thin dark frame + pillars), wrapping the rounded nose and tail
UZ = (2.80, 3.64); FW = 0.04
UP_P = [-4.60, -3.30, -2.00, -0.70, 0.60, 1.90, 3.20, 4.50]                              # upper-deck pillars (both sides)
LOW_X = (-3.45, 5.12)                                                                    # lower side band extent
LOW_P_L = [-2.55, -0.30, 0.95, 2.20, 3.30]; LOW_P_R = [-2.30, -1.10, 0.10, 1.30, 2.50, 3.70, 4.55]
DOORS = [(3.98, 5.04), (-1.74, -0.62)]; DOOR_P = [3.98, 4.51, 5.04, -1.74, -1.18, -0.62]  # kerb doors: glazed leaves down to the sill
RAKE_X0, RAKE_S, RAKE_CAP = 2.60, 0.28, 2.62                                            # lower band top rises towards the front (stepped New Routemaster window line)
def low_top(x): return 2.22 + RAKE_S * min(max(x - RAKE_X0, 0.0), (RAKE_CAP - 2.22) / RAKE_S)
def vert_faces(): bm.normal_update(); return [f for f in bm.faces if not f[lay] and abs(f.normal.z) < 0.6]
def vcut(co, no, pred=lambda f: True):
    fs = [f for f in vert_faces() if pred(f)]; geom = fs + list({e for f in fs for e in f.edges}) + list({v for f in fs for v in f.verts})
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
Zc = lambda z: (Vector((0, 0, z)), Vector((0, 0, 1)))
for z in (UZ[0] - FW, UZ[0], UZ[1], UZ[1] + FW, 0.48, 0.52, 1.11, 1.15, 2.18, 2.22, 2.26, 1.28, 1.32, 2.34, 2.38, 1.51, 1.55, 2.30): vcut(*Zc(z))
sidef = lambda f: abs(f.normal.y) > 0.5
for xp in UP_P: 
    for dx in (-0.045, 0.045): vcut(Vector((xp + dx, 0, 0)), Vector((1, 0, 0)), sidef)
for xp in (*LOW_P_L, *LOW_P_R, *DOOR_P):
    for dx in (-0.045, 0.045): vcut(Vector((xp + dx, 0, 0)), Vector((1, 0, 0)), sidef)
for xe in LOW_X:
    for dx in (-FW, 0, FW): vcut(Vector((xe + dx, 0, 0)), Vector((1, 0, 0)), sidef)
for off in (0, FW):        # rake of the lower band top (diagonal planes, side faces ahead of the rake start only)
    co = Vector((RAKE_X0, 0, 2.22 + off)); no = Vector((-RAKE_S, 0, 1)).normalized()
    vcut(co, no, lambda f: sidef(f) and f.calc_center_median().x > 2.0)
vcut(*Zc(RAKE_CAP)); vcut(*Zc(RAKE_CAP + FW))
def bandclass(p, n):
    x, y, z = p; sg = 1 if y > 0 else -1
    pil = lambda lst, w=0.0: any(abs(x - xp) < 0.045 + w for xp in lst)
    # upper band: all the way round (side faces get pillars)
    if UZ[0] - 1e-4 <= z <= UZ[1] + 1e-4: return 'BusTrim' if (sidef_n(n) and pil(UP_P)) else 'BusGlass'
    if UZ[0] - FW - 1e-4 <= z <= UZ[1] + FW + 1e-4: return 'BusTrim'
    # front lower windscreen (wraps the nose), rear lower glass
    if n.x > 0.45 and abs(y) < 1.05:
        if 1.32 - 1e-4 <= z <= 2.34 + 1e-4: return 'BusGlass'
        if 1.28 - 1e-4 <= z <= 2.38 + 1e-4: return 'BusTrim'
    if n.x < -0.45 and abs(y) < 0.95:
        if 1.55 - 1e-4 <= z <= 2.30 + 1e-4: return 'BusGlass'
        if 1.51 - 1e-4 <= z <= 2.34 + 1e-4: return 'BusTrim'
    if sidef_n(n) and LOW_X[0] - FW - 1e-4 <= x <= LOW_X[1] + FW + 1e-4:
        door = sg > 0 and any(a0 - 1e-4 <= x <= a1 + 1e-4 for a0, a1 in DOORS)
        zb, zt = (0.52 if door else 1.15), low_top(x)
        inside_x = LOW_X[0] - 1e-4 <= x <= LOW_X[1] + 1e-4
        if inside_x and zb - 1e-4 <= z <= zt + 1e-4: return 'BusTrim' if pil((LOW_P_L if sg > 0 else LOW_P_R) + (DOOR_P if sg > 0 else [])) else 'BusGlass'
        if (zb - FW - 1e-4 <= z <= zt + FW + 1e-4): return 'BusTrim'
    return None
def sidef_n(n): return abs(n.y) > 0.5
bm.normal_update()
for f in bm.faces:
    if f[lay] or abs(f.normal.z) > 0.6: continue
    r = bandclass(f.calc_center_median(), f.normal)
    if r: f[lay] = 1; f[mi] = BI[r]
print('glazing done')
# ---- 3. livery cuts on the remaining skin (planes only through faces not already decided)
def skin():
    bm.normal_update(); return [f for f in bm.faces if not f[lay]]
def livery_cut(co, no):
    fs = skin(); geom = fs + list({e for f in fs for e in f.edges}) + list({v for f in fs for v in f.verts})
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
for z in (LIP_Z, SKIRT_Z, *STRIPE): livery_cut(Vector((0, 0, z)), Vector((0, 0, 1)))
for t in (T_FRONT, T_WHITE, T_LILAC): livery_cut(Vector((t + SWEEP_K * 0.3, 0, 0)), Vector((1, 0, SWEEP_K)).normalized())
livery_cut(Vector((0, 0, 3.66)), Vector((0, 0, 1)))
print('livery cuts done')
def paint(p, n):
    x, y, z = p
    if z < LIP_Z: return 'BusTrim'
    t = x + SWEEP_K * (z - 0.3)
    if z < SKIRT_Z: return 'BusSkirtF' if t > T_FRONT else 'BusAccent'
    if n.z > 0.5 and z > 3.66: return 'BusSweep'
    if STRIPE[0] < z < STRIPE[1] and (abs(n.y) > 0.3 or n.x > 0.3): return 'BusStripe'
    if t <= T_FRONT: return 'BusSweep' if t > T_WHITE else 'BusLilac' if t > T_LILAC else 'BusRear'
    return 'BusBody'
BM = {b: bmesh.new() for b in BUCKETS}
def add(bucket, pts, nrm):
    vs = [BM[bucket].verts.new(p) for p in pts]
    try: f = BM[bucket].faces.new(vs)
    except ValueError: return None
    f.normal_update()
    if f.normal.dot(nrm) < 0: f.normal_flip()
    return f
bm.normal_update()
for f in bm.faces: f[mi] = f[mi] if f[lay] else BI[paint(f.calc_center_median(), f.normal)]
merge = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][mi] == e.link_faces[1][mi] and e.calc_face_angle(1) < math.radians(1.2)]
bmesh.ops.dissolve_edges(bm, edges=merge, use_verts=True, use_face_split=False)   # merge coplanar same-role faces (cut seams inside glass / paint fields)
print('merged', len(merge))
for f in bm.faces:
    b = BUCKETS[f[mi]]
    add(b, [v.co.copy() for v in f.verts], f.normal)
    if b == 'BusGlass': add('BusInterior', [v.co - f.normal * 0.07 for v in f.verts], f.normal)    # opaque dark saloon behind the glass
bm.free()

# ---- 4. decals and small parts (all flat, authored): lamps, plates, blinds, roundels, grilles, mirrors, wipers, roof pods
UPV = Vector((0, 0, 1))
def decal(bucket, c, nrm, hw, hh, off=0.012, segs=0, uv=False, ring=0.0, right=None):
    right = right or UPV.cross(nrm); up = nrm.cross(right).normalized() if abs(nrm.z) > 0.9 else UPV
    c = c + nrm * off; b = BM[bucket]
    if segs:
        outer = [c + right * (hw * math.cos(2 * math.pi * k / segs)) + up * (hh * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
        if ring:
            inner = [c + right * (hw * ring * math.cos(2 * math.pi * k / segs)) + up * (hh * ring * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
            for k in range(segs): add(bucket, [outer[k], outer[(k + 1) % segs], inner[(k + 1) % segs], inner[k]], nrm)
            return
        add(bucket, outer, nrm); return
    pts = [c - right * hw - up * hh, c + right * hw - up * hh, c + right * hw + up * hh, c - right * hw + up * hh]
    f = add(bucket, pts, nrm)
    if uv and f:
        l = b.loops.layers.uv.verify()
        for lp in f.loops:
            d = lp.vert.co - c; lp[l].uv = (0.5 + d.dot(right) / (2 * hw), 0.5 + d.dot(up) / (2 * hh))
def box(bucket, lo, hi):    # axis-aligned box from two corners
    x0, y0, z0 = lo; x1, y1, z1 = hi; v = lambda x, y, z: Vector((x, y, z))
    for pts, n in (([v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], (0, 0, 1)), ([v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0)], (0, 0, -1)),
                   ([v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], (1, 0, 0)), ([v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)], (-1, 0, 0)),
                   ([v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0)], (0, 1, 0)), ([v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], (0, -1, 0))):
        add(bucket, pts, Vector(n))
def front_x(z): return 5.86 if z <= 1.40 else 5.86 - 0.06 * (z - 1.40) / 1.20
def end_pt(end, y, z):     # point on the rounded nose (end=+1) / tail (end=-1) and its outward normal
    base = front_x(z) if end > 0 else -5.85
    d = max(0.0, abs(y) - (W - RAD)); c = math.sqrt(max(RAD * RAD - d * d, 1e-6))
    return Vector((end * (abs(base) - RAD + c), y, z)), Vector((end * c, (1 if y > 0 else -1) * d, 0)).normalized() if d > 1e-6 else Vector((end, 0, 0))
def edecal(bucket, end, yc, zc, hw, hh, off=0.012, uv=False, n=6):    # strip-conformed rectangle on the rounded end
    b = BM[bucket]; cols = []
    for i in range(n + 1):
        y = yc - hw + 2 * hw * i / n; p, nr = end_pt(end, y, zc); cols.append((p + nr * off, nr, i / n))
    for i in range(n):
        q = [cols[i][0] - UPV * hh, cols[i + 1][0] - UPV * hh, cols[i + 1][0] + UPV * hh, cols[i][0] + UPV * hh]
        f = add(bucket, q, cols[i][1])
        if uv and f:
            l = b.loops.layers.uv.verify(); us = [cols[i][2] if end > 0 else 1 - cols[i][2], cols[i + 1][2] if end > 0 else 1 - cols[i + 1][2]]
            for lp, (u, v) in zip(f.loops, [(us[0], 0), (us[1], 0), (us[1], 1), (us[0], 1)]): lp[l].uv = (u, v)
FRONT, REAR = Vector((1, 0, 0)), Vector((-1, 0, 0))
# front: blind above the lower screen, headlamps in the lower corners, small grille, plate, wipers
edecal('BusTrim', 1, 0, 2.52, 0.80, 0.130, 0.010); edecal('BusDisplay', 1, 0, 2.52, 0.76, 0.098, 0.016, uv=True, n=8)
for sg in (1, -1):
    edecal('BusTrim', 1, sg * 0.78, 0.86, 0.24, 0.115, 0.008, n=4); edecal('BusHeadlight', 1, sg * 0.78, 0.89, 0.20, 0.060, 0.015, n=4)
    edecal('BusHeadlight', 1, sg * 0.78, 0.76, 0.12, 0.020, 0.015, n=3)
edecal('BusTrim', 1, 0, 0.92, 0.30, 0.15, 0.008, n=3)
for k in range(5): edecal('BusMetal', 1, 0, 0.84 + k * 0.05, 0.25, 0.010, 0.012, n=3)
edecal('BusTrim', 1, 0, 0.55, 0.30, 0.085, 0.008, n=3); edecal('BusMetal', 1, 0, 0.55, 0.26, 0.065, 0.012, n=3)
for sg in (1, -1):    # driver-screen wipers
    p, nr = end_pt(1, sg * 0.50, 1.55); box('BusTrim', (p.x + 0.0, sg * 0.50 - 0.012, 1.50), (p.x + 0.03, sg * 0.50 + 0.012, 2.12))
# rear: tail lamp clusters, high brake lamp, plate, engine louvres
for sg in (1, -1):
    edecal('BusTrim', -1, sg * 0.84, 1.10, 0.12, 0.44, 0.008, n=3); edecal('BusTaillight', -1, sg * 0.84, 1.10, 0.085, 0.40, 0.014, n=3)
edecal('BusTaillight', -1, 0, 2.43, 0.60, 0.025, 0.012, n=6)
edecal('BusTrim', -1, 0, 0.74, 0.34, 0.12, 0.008, n=3); edecal('BusMetal', -1, 0, 0.74, 0.26, 0.07, 0.012, n=3)
for k in range(5): edecal('BusTrim', -1, 0, 1.00 + k * 0.10, 0.50, 0.028, 0.008, n=4)
edecal('BusTrim', -1, 0, 3.80, 0.52, 0.08, 0.008, n=4)       # (rear blind sits in the glass band's frame)
# sides: route blinds above the front door / by the driver, roundels on the rear panel, engine louvres, fuel flap
for sg in (1, -1):
    n = Vector((0, sg, 0)); y = sg * W
    bx = 1.55
    decal('BusTrim', Vector((bx, y, 2.52)), n, 0.52, 0.15, 0.006); decal('BusDisplay', Vector((bx, y, 2.52)), n, 0.47, 0.115, 0.012, uv=True)
    rc = Vector((-4.45, y, 1.78))
    decal('BusMark', rc, n, 0.26, 0.26, 0.010, segs=40, ring=0.74); decal('BusMark2', rc, n, 0.31, 0.058, 0.014)
    for k in range(7): decal('BusTrim', Vector((-4.45, y, 0.80 + k * 0.075)), n, 0.60, 0.014, 0.008)
    decal('BusTrim', Vector((1.9, y, 0.95)), n, 0.20, 0.13, 0.006)          # service flap
# mirrors: arm + housing + mirror face, set at the A-pillar level of the lower screen
for sg in (1, -1):
    box('BusTrim', (5.00, sg * 1.20, 2.44), (5.12, sg * 1.40, 2.50)); box('BusTrim', (4.98, sg * 1.34, 1.92), (5.14, sg * 1.42, 2.50))
    box('BusMetal', (4.96, sg * 1.34, 1.96), (4.98, sg * 1.415, 2.46))
# roof: air-conditioning pod and two vents
box('BusSweep', (-4.2, -0.70, ZR + 0.03), (-1.6, 0.70, ZR + 0.19)); box('BusTrim', (-4.1, -0.55, ZR + 0.19), (-1.7, 0.55, ZR + 0.195)); box('BusSweep', (1.0, -0.45, ZR + 0.06), (2.0, 0.45, ZR + 0.14))

# ---- 5. wheels: chunky tyre (sidewall step, rim-protector ridge, tread grooves), deep-dished steel disc with 10 hand holes, nut ring and a raised hub cap; axis = Y, origin = wheel centre
TYRE_SEG, RIM_SEG = 48, 30
def wheel(name, c, hw, sign):
    mesh = bpy.data.meshes.new(name); w = bmesh.new(); R, RIM = WR, WR * 0.62
    outer = [(RIM * 0.96, 0.80), (RIM * 1.06, 0.82), (RIM * 1.10, 0.97), (RIM * 1.22, 0.99), (R * 0.84, 1.0), (R * 0.955, 0.94), (R * 0.995, 0.72), (R, 0.45), (R, 0.34), (R * 0.985, 0.29), (R * 0.985, 0.23), (R, 0.18), (R, 0.07)]
    inner = [(R, -0.07), (R, -0.5), (R * 0.9, -1.0), (RIM * 0.96, -0.80)]       # inboard half is hidden: kept coarse
    prof = [(r, sign * k * hw) for r, k in outer + [(R, 0.0)] + inner]
    rings = [[w.verts.new((r * math.cos(2 * math.pi * i / TYRE_SEG), y, r * math.sin(2 * math.pi * i / TYRE_SEG))) for r, y in prof] for i in range(TYRE_SEG)]
    mats = [MATS['BusRubber'], MATS['BusMetal'], MATS['BusTrim'], MATS['BusWheel']]; [mesh.materials.append(m) for m in mats]
    for i in range(TYRE_SEG):
        r0, r1 = rings[i], rings[(i + 1) % TYRE_SEG]
        for j in range(len(prof) - 1): w.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j])).material_index = 0
    y0 = hw * 0.80
    rp = [(1.02, 0.0), (0.96, 0.012), (0.90, -0.020), (0.80, -0.055), (0.63, -0.060), (0.49, -0.060), (0.42, -0.025), (0.38, 0.022), (0.30, 0.042), (0.16, 0.048), (0.12, 0.022)]
    rr = [[w.verts.new((RIM * k * math.cos(2 * math.pi * i / RIM_SEG), sign * (y0 + d), RIM * k * math.sin(2 * math.pi * i / RIM_SEG))) for k, d in rp] for i in range(RIM_SEG)]
    ctr = w.verts.new((0, sign * (y0 + 0.022), 0))
    for i in range(RIM_SEG):
        r0, r1 = rr[i], rr[(i + 1) % RIM_SEG]; hole = i % 3 == 1
        for j in range(len(rp) - 1):
            mi_ = 2 if (hole and j == 3) else 1 if j in (7, 8, 9, 10) else 3
            w.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1])).material_index = mi_
        w.faces.new((r0[-1], r1[-1], ctr)).material_index = 1
    for k in range(10):    # wheel nuts: low pentagonal prisms on the dish floor
        a = 2 * math.pi * (k + 0.5) / 10; cx, cz = RIM * 0.56 * math.cos(a), RIM * 0.56 * math.sin(a); yb, yt = sign * (y0 - 0.060), sign * (y0 - 0.036)
        lo = [w.verts.new((cx + 0.017 * math.cos(2 * math.pi * m / 5), yb, cz + 0.017 * math.sin(2 * math.pi * m / 5))) for m in range(5)]
        hi = [w.verts.new((cx + 0.017 * math.cos(2 * math.pi * m / 5), yt, cz + 0.017 * math.sin(2 * math.pi * m / 5))) for m in range(5)]
        for m in range(5): w.faces.new((lo[m], lo[(m + 1) % 5], hi[(m + 1) % 5], hi[m])).material_index = 1
        w.faces.new(hi).material_index = 1
    bmesh.ops.recalc_face_normals(w, faces=w.faces[:])
    for f in w.faces:
        cen = f.calc_center_median()
        if f.material_index == 0:
            if f.normal.dot(Vector((cen.x, 0, cen.z)) if abs(cen.y) < hw * 0.6 else Vector((0, cen.y, 0))) < 0: f.normal_flip()
        elif f.normal.y * sign < 0: f.normal_flip()
    bmesh.ops.triangulate(w, faces=w.faces[:]); w.to_mesh(mesh); w.free()
    o = bpy.data.objects.new(name, mesh); sc.collection.objects.link(o); o.location = (c[0], c[1], WR); return o
wheels = {k: wheel(k, v, v[2], 1 if v[1] > 0 else -1) for k, v in WHEELS.items()}

# ---- 6. body meshes: one per material role
bodies = []
for b in BUCKETS:
    bmb = BM[b]
    if not bmb.faces: bmb.free(); continue
    bmesh.ops.triangulate(bmb, faces=bmb.faces[:]); bmesh.ops.remove_doubles(bmb, verts=bmb.verts[:], dist=1e-5)
    me = bpy.data.meshes.new(b); bmb.to_mesh(me); bmb.free()
    o = bpy.data.objects.new(b, me); sc.collection.objects.link(o); me.materials.append(MATS[b]); bodies.append(o)
root = bpy.data.objects.new('BusRoot', None); sc.collection.objects.link(root)
for o in [*bodies, *wheels.values()]:
    o.parent = root; o.data.validate(verbose=False)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    try: o.data.set_sharp_from_angle(angle=math.radians(38))
    except Exception: pass
for m in list(bpy.data.materials):
    if m.name not in MATS: bpy.data.materials.remove(m)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, use_selection=True, export_apply=True, export_texcoords=True, export_image_format='NONE',
                          export_animations=False, export_cameras=False, export_lights=False, export_materials='EXPORT', export_vertex_color='NONE')
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
for o in [*bodies, *wheels.values()]: print(' ', o.name, tri(o))
print('EXPORTED', OUT, 'tris', sum(tri(o) for o in [*bodies, *wheels.values()]), 'bytes', os.path.getsize(OUT))
