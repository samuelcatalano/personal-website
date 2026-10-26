# A330-300-style airliner, original geometry. Run: blender -b --factory-startup -P build_a330.py -- out.glb
# Blender axes: nose +X, up +Z, right wing -Y  (glTF export -> three.js: forward +X, up +Y, right +Z). Origin = fuselage centre.
# Master in real metres (A330-300: L 63.7, span 60.3, fuselage Ø 5.64); exported scaled to EXPORT_LEN.
import bpy, bmesh, math, sys
from mathutils import Vector

L, R, SPAN, EXPORT_LEN = 63.7, 2.82, 60.3, 40.0
RING, NSEC = 48, 96

bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, rgb, rough=0.45, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
WHITE, NAVY, DARK = mat('White', (0.86, 0.87, 0.88), 0.35), mat('Navy', (0.008, 0.016, 0.075), 0.35, 0.1), mat('Dark', (0.01, 0.012, 0.016), 0.15, 0.3)
GREY, RED, BLUE = mat('WingGrey', (0.62, 0.64, 0.67), 0.4, 0.2), mat('Red', (0.62, 0.02, 0.04), 0.4), mat('Blue', (0.04, 0.10, 0.42), 0.4)
MATS = [WHITE, NAVY, DARK, GREY, RED, BLUE]

def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for m in mats: me.materials.append(m)
    return ob

def loft(bm, rings, closed=True, cap_start=False, cap_end=False):
    """rings: list of vertex-coordinate lists of equal length; returns faces (row-major)."""
    vs = [[bm.verts.new(p) for p in r] for r in rings]; n = len(rings[0]); faces = []
    for a, b in zip(vs, vs[1:]):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n; faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    if cap_start: faces.append(bm.faces.new(list(reversed(vs[0]))))
    if cap_end: faces.append(bm.faces.new(vs[-1]))
    return faces, vs

# ---------- fuselage: longitudinal profile (top, bottom, half-width, along s = distance from nose) ----------
def profile(s):
    if s < 7.0:                       # rounded nose, slightly drooped, cockpit brow on top
        t = s / 7.0
        k = math.sqrt(max(0.0, 1 - (1 - t) ** 2.2))
        top = -0.55 + (R + 0.55) * math.sqrt(max(0.0, 1 - (1 - t) ** 1.55))
        bot = -0.55 - (R - 0.55) * k
        return top, bot, R * k ** 0.95
    if s < 44.0: return R, -R, R
    t = (s - 44.0) / (L - 44.0)        # tail: belly sweeps up early, crown holds then drops into the cone
    top = R - (R - 0.95) * t ** 2.2
    bot = -R + (R + 0.55) * (1 - (1 - t) ** 1.6)
    w = R - (R - 0.32) * t ** 1.3
    return top, max(bot, top - 2 * w * 1.05), w

def sec_s(i): return L * (0.5 - 0.5 * math.cos(math.pi * i / (NSEC - 1)))  # dense at nose and tail

bm = bmesh.new(); rings, ss = [], []
for i in range(NSEC):
    s = min(L, max(0.02, sec_s(i))); top, bot, w = profile(s); zc, hz = (top + bot) / 2, (top - bot) / 2
    rings.append([Vector((L / 2 - s, -w * math.sin(a), zc + hz * math.cos(a))) for a in (2 * math.pi * k / RING for k in range(RING))]); ss.append(s)
faces, _ = loft(bm, rings, cap_start=True, cap_end=True)
for f in faces:                        # livery by position: navy belly, dark window strip, dark cockpit glazing
    c = f.calc_center_median(); s = L / 2 - c.x; top, bot, w = profile(min(L, max(0.02, s))); zc, hz = (top + bot) / 2, (top - bot) / 2; zn = (c.z - zc) / max(hz, 1e-3)
    if zn < -0.42 and s < 58: f.material_index = 1

def hull(s, phi, off=0.02):            # point on the fuselage at station s, angle phi from the crown (phi > 0 = right side)
    top, bot, w = profile(s); zc, hz = (top + bot) / 2, (top - bot) / 2
    n = Vector((0, -math.sin(phi) * hz, math.cos(phi) * w)).normalized()
    return Vector((L / 2 - s, -w * math.sin(phi), zc + hz * math.cos(phi))) + n * off
def decal(s0, s1, p0, p1, ns=4, npz=4, chamfer=0.0, off=0.06):   # conforming dark patch (windows) sharing the fuselage mesh; 6 cm proud (3.8 cm exported) or it z-fights the hull at flyover distance
    vs = [[bm.verts.new(hull(s0 + (s1 - s0) * i / ns, p0 + (p1 - p0) * j / npz, off)) for j in range(npz + 1)] for i in range(ns + 1)]
    for i in range(ns):
        for j in range(npz):
            if chamfer and (i in (0, ns - 1)) and (j in (0, npz - 1)): continue   # knock off corners: rounded window
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            if f.normal.dot(f.calc_center_median() - Vector((f.calc_center_median().x, 0, (profile(min(L, max(0.02, L / 2 - f.calc_center_median().x)))[0] + profile(min(L, max(0.02, L / 2 - f.calc_center_median().x)))[1]) / 2))) < 0: f.normal_flip()
            f.material_index = 2
DOORS, PITCH = (9.6, 18.6, 41.2, 51.0), 0.62
for side in (1, -1):                  # individual passenger windows, A330-like pitch, gaps at the doors
    s_ = 10.4
    while s_ < 52.2:
        if all(abs(s_ - d) > 0.85 for d in DOORS): decal(s_ - 0.15, s_ + 0.15, side * math.acos(0.46), side * math.acos(0.27), 1, 1)   # one flat quad: straight edges (rows aliased into a kink); 1.2 cm chord sag < 6 cm lift
        s_ += PITCH
def ws(phi): k = min(1.0, abs(phi) / 1.25); s0 = 3.55 + 0.95 * k ** 1.5; return s0, s0 + 1.05 - 0.3 * k
for p0, p1 in [(0.03, 0.47), (0.53, 0.92), (0.98, 1.25)]:   # continuous six-pane windscreen band; gaps = body-colour mullions
    for side in (1, -1):
        cols = [p0 + (p1 - p0) * j / 5 for j in range(6)]
        vs = [[bm.verts.new(hull(ws(p)[0] + (ws(p)[1] - ws(p)[0]) * i / 3, side * p)) for p in cols] for i in range(4)]
        for i in range(3):
            for j in range(5):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
                if f.normal.x < 0 and f.normal.z < 0.3 or (f.normal.y * side) > 0.2: pass
                f.material_index = 2
bm.normal_update()
for f in bm.faces:                    # decals face outward like the hull
    if f.material_index == 2:
        c = f.calc_center_median(); top, bot, w = profile(min(L, max(0.02, L / 2 - c.x)))
        if f.normal.dot(Vector((0, c.y, c.z - (top + bot) / 2))) < 0: f.normal_flip()
fus = new_obj('Fuselage', bm, MATS)

# ---------- lifting surfaces: airfoil sections lofted along a span curve ----------
def airfoil(n=18, tc=0.12, camber=0.02):
    pts = []
    for k in range(n):                 # cosine spacing, upper TE->LE then lower LE->TE
        x = 0.5 * (1 + math.cos(math.pi * k / (n - 1)))
        yt = 5 * tc * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        pts.append((x, camber * 4 * x * (1 - x) + yt))
    return pts + [(x, camber * 4 * x * (1 - x) - (z - camber * 4 * x * (1 - x))) for x, z in reversed(pts[1:-1])]

def surface(name, stations, material, mirror=True, livery=None):
    """stations: (le Vector, chord, chord_dir Vector, thick_dir Vector, t/c)."""
    bm = bmesh.new()
    for side in ([1, -1] if mirror else [1]):
        rings = []
        for le, ch, cd, nd, tc in stations:
            le2, cd2, nd2 = Vector((le.x, le.y * side, le.z)), Vector((cd.x, cd.y * side, cd.z)), Vector((nd.x, nd.y * side, nd.z))
            rings.append([le2 + cd2 * (x * ch) + nd2 * (z * ch) for x, z in airfoil(tc=tc, camber=0.0 if livery else 0.02)])
        faces, _ = loft(bm, rings, cap_end=True)
        if side == -1:
            for f in faces: f.normal_flip()
        if livery:
            for f in faces: f.material_index = livery(f.calc_center_median())
    return new_obj(name, bm, MATS if livery else [material])

d2r = math.radians
def wing_st(y, chord, le_x, z, nd=Vector((0, 0, 1)), tc=0.12): return (Vector((le_x, -y, z)), chord, Vector((-1, 0, 0)), nd, tc)
WLE0, WZ0, LE_SWEEP, DIH = L / 2 - 23.0, -R * 0.62, d2r(32), d2r(5.5)
def wing_at(y, chord, tc): return wing_st(y, chord, WLE0 - y * math.tan(LE_SWEEP), WZ0 + y * math.tan(DIH), tc=tc)
semi = SPAN / 2
wl = [wing_at(0, 11.4, 0.15), wing_at(3.0, 10.4, 0.145), wing_at(9.6, 7.1, 0.12), wing_at(16, 5.0, 0.11), wing_at(23, 3.6, 0.105), wing_at(semi - 0.9, 2.5, 0.1)]
tipx, tipz = WLE0 - (semi - 0.2) * math.tan(LE_SWEEP), WZ0 + (semi - 0.2) * math.tan(DIH)   # small canted winglet
wl += [(Vector((tipx - 0.4, -semi, tipz + 0.35)), 2.0, Vector((-1, 0, 0)), Vector((0, 0.7, 0.7)).normalized(), 0.09),
       (Vector((tipx - 1.6, -semi - 0.25, tipz + 2.6)), 0.9, Vector((-1, 0, 0)), Vector((0, 1, 0.15)).normalized(), 0.08)]
wings = surface('Wings', wl, GREY)

HS0 = L / 2 - 55.6
hs = [(Vector((HS0 - y * math.tan(d2r(34)), -y, 0.25 + y * math.tan(d2r(7)))), c, Vector((-1, 0, 0)), Vector((0, 0, 1)), 0.1) for y, c in [(0, 6.2), (1.6, 5.6), (5.5, 3.6), (9.7, 1.8)]]
stab = surface('Stabilisers', hs, WHITE)

FN0 = L / 2 - 50.5
FIN_ST = [(-0.8, 10.5), (0.6, 8.6), (3.0, 6.6), (6.0, 4.6), (8.4, 3.3), (9.2, 3.0)]
fin = surface('Fin', [(Vector((FN0 - z * math.tan(d2r(40)), 0, 2.2 + z)), c, Vector((-1, 0, 0)), Vector((0, 1, 0)), 0.11) for z, c in FIN_ST], WHITE, mirror=False)
def fin_pt(x, z, side, off=0.025):    # point on the fin skin: chord fraction x, height z (fin frame), side +-1
    for (za, ca), (zb, cb) in zip(FIN_ST, FIN_ST[1:]):
        if za <= z <= zb: c = ca + (cb - ca) * (z - za) / (zb - za); break
    yt = 5 * 0.11 * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) * c
    return Vector((FN0 - z * math.tan(d2r(40)) - x * c, side * (yt + off), 2.2 + z))
bm = bmesh.new()                      # abstract red/blue ribbons as conforming strips: smooth edges without tessellating the fin
for mi, v0, v1 in [(0, 0.98, 1.22), (1, 0.66, 0.86)]:
    for side in (1, -1):
        hs = [0.32 + 0.68 * k / 40 for k in range(41)]; rows = []
        for h in hs:
            z = -0.8 + h * 10.0; o = 0.9 * h - 0.10 * math.sin(math.pi * h)
            a, b = max(0.03, v0 - o), min(0.97, v1 - o)
            rows.append(None if a >= b else [fin_pt(a + (b - a) * t / 3, z, side) for t in range(4)])
        for r0, r1 in zip(rows, rows[1:]):
            if not (r0 and r1): continue
            v = [[bm.verts.new(p) for p in r] for r in (r0, r1)]
            for t in range(3):
                f = bm.faces.new((v[0][t], v[0][t + 1], v[1][t + 1], v[1][t]))
                if (f.normal.y > 0) != (side > 0): f.normal_flip()
                f.material_index = mi
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
finl = new_obj('FinLivery', bm, [RED, BLUE])

# ---------- engines: lathed nacelle + intake + fan face + plug, pylon ----------
def lathe(bm, prof, x0, y0, z0, seg=40, mi=0):
    rings = [[Vector((x0 - x, y0 - r * math.sin(a), z0 + r * math.cos(a))) for a in (2 * math.pi * k / seg for k in range(seg))] for x, r in prof]
    faces, vs = loft(bm, rings)
    for f in faces: f.material_index = mi
    return faces, vs
ENG_Y = 9.4
ex = WLE0 - ENG_Y * math.tan(LE_SWEEP) + 3.2           # intake ahead of the leading edge
ez = WZ0 + ENG_Y * math.tan(DIH) - 1.95
bm = bmesh.new()
for side in (1, -1):
    y = -ENG_Y * side
    lathe(bm, [(0.0, 1.30), (0.05, 1.43), (0.25, 1.52)], ex, y, ez, mi=3)                  # polished intake lip
    lathe(bm, [(0.25, 1.52), (0.8, 1.56), (2.0, 1.52), (3.2, 1.38), (4.0, 1.18), (4.15, 0.98)], ex, y, ez, mi=1)   # cowl
    lathe(bm, [(0.0, 1.30), (0.6, 1.20)], ex, y, ez, mi=2)                       # intake throat
    f, vs = lathe(bm, [(0.6, 1.20), (0.6, 0.30)], ex, y, ez, mi=2)             # fan face ring
    lathe(bm, [(0.45, 0.02), (0.6, 0.32)], ex, y, ez, mi=0)                     # spinner
    lathe(bm, [(4.15, 0.98), (4.6, 0.80), (5.6, 0.25), (5.9, 0.02)], ex, y, ez, mi=3)   # core + plug
for side in (1, -1):                   # pylon: thin airfoil wall from nacelle top to wing underside
    y = -ENG_Y * side; zt = WZ0 + ENG_Y * math.tan(DIH) - 0.2
    pr = [[Vector((ex - 0.9 - x * 4.6, y + z * 4.6 * 0.5, zz)) for x, z in airfoil(12, 0.10, 0.0)] for zz in (ez + 1.35, zt)]
    faces, _ = loft(bm, pr, cap_end=True); [setattr(f, 'material_index', 0) for f in faces]
eng = new_obj('Engines', bm, MATS)

for ob in bpy.context.scene.objects:
    if ob.type == 'MESH':
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        ob.select_set(False)
root = bpy.data.objects.new('AircraftRoot', None); bpy.context.collection.objects.link(root)
for ob in (fus, wings, stab, fin, finl, eng): ob.parent = root
root.scale = (EXPORT_LEN / L,) * 3

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'a330-original-poc.glb'
bpy.ops.wm.save_as_mainfile(filepath=out.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
print('BUILD tris', tris, 'verts', sum(len(o.data.vertices) for o in bpy.context.scene.objects if o.type == 'MESH'))
