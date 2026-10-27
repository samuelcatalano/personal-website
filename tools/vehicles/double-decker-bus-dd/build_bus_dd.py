# Game-ready double-decker from "London DD Bus" by jsa201077 (CC-BY-4.0, https://sketchfab.com/3d-models/london-dd-bus-a2a2736856a7452bbbaf712e07ed8eb4).
# Run: blender -b --factory-startup -P build_bus_dd.py -- [src.glb] [out.glb]
# Output contract = assets/vehicles/double-decker-bus.glb: three.js forward +X, up +Y, right +Z, ground y=0, wheel nodes FL FR RL RR
# (origin at the wheel centre, no rotation: runtime spins rotation.z), one mesh per semantic material (BusBody BusAccent BusStripe BusTrim
# BusGlass BusRubber BusMetal BusHeadlight BusTaillight BusDisplay BusInterior), no textures / vertex colours; only BusDisplay has UVs.
# Paint regions are read from the source's baked texture (red / black / grey) and cut by exact planes (skirt, swoosh) so Glasgow can repaint.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = a[0] if a else os.path.join(ROOT, 'assets/models/source/london-bus/london_dd_bus.glb')
OUT = a[1] if len(a) > 1 else os.path.join(ROOT, 'assets/vehicles/double-decker-bus.glb')
S = 0.0240                       # source inches -> metres, tuned so the hull is ~11.6 m (old bus 11.2 m) and the wheels r 0.445 (old 0.47)
DISSOLVE = dict(BusGlass=1.5, BusBody=2.0, BusAccent=2.0, BusStripe=2.0, BusTrim=2.0, BusInterior=4.0)   # planar dissolve angle per bucket (degrees)
INTERIOR_TRIS = 650              # what the saloon silhouette seen through the glass may cost
# measured on the source tyres (metres after the bake): axle x, tyre centre |y|, tyre half width, radius
WHEELS = dict(FL=(3.015, 0.998, 0.130), FR=(3.015, -0.998, 0.130), RL=(-2.826, 0.950, 0.180), RR=(-2.826, -0.950, 0.180)); WR = 0.445
# livery cuts (z up, x forward): skirt top, and the swoosh as boolean regions between lines z = f(x)
SKIRT_Z = 0.66
SW_LO, SW_HI, SW_X1 = 0.96, 1.12, 3.75
SW_KINK_LO, SW_SLOPE_LO = 2.2, 0.30      # lower edge turns up at x=2.2 (past the last saloon window), 0.30 m per metre
SW_KINK_HI, SW_SLOPE_HI = 2.0, 0.40      # upper edge turns up earlier / steeper so the swoosh widens towards the door
FRONT_LINE = (4.15, 4.21)
FRAME_W, LIP_Z, ARCH_W = 0.06, 0.30, 0.10   # black window surround width, bottom lip height, wheel-arch surround                 # thin pink line above the windscreen (front-facing faces)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
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
            BusInterior=mat('BusInterior', '#2a2622', 0.9))
BUCKETS = list(MATS)

# ---- 1. bake: inches, nose -Y, up +Z, left +X  ->  metres, nose +X, up +Z, left +Y (glTF export maps to three.js forward +X, up +Y, right +Z)
meshes = [o for o in sc.objects if o.type == 'MESH']
def bb(o, m=None):
    vs = [(m or o.matrix_world) @ v.co for v in o.data.vertices]; return [(min(v[i] for v in vs), max(v[i] for v in vs)) for i in range(3)]
by = {o.data.materials[0].name: o for o in meshes}
x0 = sum(bb(by['london_bus_glass1'])[0]) / 2; y0 = sum(bb(by['london_bus_body_1'])[1]) / 2
FIX = Matrix.Scale(S, 4) @ Matrix(((0, -1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))) @ Matrix.Translation((-x0, -y0, 0))
src = {}
for o in meshes:
    o.data = o.data.copy(); o.data.transform(FIX @ o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4); src[o.data.materials[0].name] = o
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
SHELL, FRAME, GLASS_, BLIND, HUB, PLATE, WHEEL_, SEATS = (src[k] for k in ('london_bus_body_1', 'material', 'london_bus_glass1', 'london_bus_bo1', 'material_0', 'plates1', 'london_bus_wheel1', 'london_bus_chass1'))

# ---- 2a. glass panes (connected components of the glass mesh, all flat axis-aligned rectangles): their expanded rectangles become the black frames
def glass_panes():
    bm = bmesh.new(); bm.from_mesh(GLASS_.data); seen_, out = set(), {}
    for v in bm.verts:
        if v in seen_: continue
        st, comp = [v], []; seen_.add(v)
        while st:
            q = st.pop(); comp.append(q)
            for e in q.link_edges:
                w = e.other_vert(q)
                if w not in seen_: seen_.add(w); st.append(w)
        mn = [min(q.co[i] for q in comp) for i in range(3)]; mx = [max(q.co[i] for q in comp) for i in range(3)]
        if mx[1] - mn[1] < 0.15 and abs(mn[1]) > 0.9: out[('side', round(mn[0], 2), round(mx[0], 2), round(mn[2], 2), round(mx[2], 2), 1 if mn[1] > 0 else -1)] = ('side', mn[0], mx[0], mn[2], mx[2], 1 if mn[1] > 0 else -1)
        elif mx[0] - mn[0] < 0.3 and abs(mn[0]) > 5: out[('end', round(mn[1], 2), round(mx[1], 2), round(mn[2], 2), round(mx[2], 2), 1 if mn[0] > 0 else -1)] = ('end', mn[1], mx[1], mn[2], mx[2], 1 if mn[0] > 0 else -1)
    bm.free(); return list(out.values())
PANES = glass_panes(); print('glass panes', len(PANES))
def in_frame(p):
    x, y, z = p.center; m = FRAME_W
    for kind, a0, a1, z0, z1, sg in PANES:
        if z0 - m <= z <= z1 + m:
            if kind == 'side' and sg * y > 0.9 and a0 - m <= x <= a1 + m: return True
            if kind == 'end' and sg * x > 5 and a0 - m <= y <= a1 + m: return True
    return False

# ---- 2. exact paint cuts on the skin meshes (planes extruded along Y, so left/right stay symmetric)
line_lo = lambda x: SW_LO + max(0.0, x - SW_KINK_LO) * SW_SLOPE_LO
line_hi = lambda x: SW_HI + max(0.0, x - SW_KINK_HI) * SW_SLOPE_HI
def diag(x, z0, slope):   # plane through (x, z0) with z - z0 = slope (x' - x)
    return Vector((x, 0, z0)), Vector((-slope, 0, 1)).normalized()
# the swoosh ends in a thin diagonal kick at the rear: two parallel strokes rising towards the tail (pink then blue)
KICK_Z = (SW_LO, 1.95); KICK_SLOPE = 0.55   # x shifts back 0.55 m per metre of height
kick_x = lambda z, x0_: x0_ - KICK_SLOPE * (z - SW_LO)
KICK = ((-3.80, -4.05, 'BusStripe'), (-4.12, -4.30, 'BusAccent'))   # (x_front, x_back, bucket) at z = SW_LO
CUTS = [(Vector((0, 0, z)), Vector((0, 0, 1))) for z in (SKIRT_Z, SW_LO, SW_HI, *FRONT_LINE, KICK_Z[1])] + [diag(SW_KINK_LO, SW_LO, SW_SLOPE_LO), diag(SW_KINK_HI, SW_HI, SW_SLOPE_HI), (Vector((SW_X1, 0, 0)), Vector((1, 0, 0)))]
CUTS += [(Vector((xs, 0, SW_LO)), Vector((1, 0, KICK_SLOPE)).normalized()) for xs in sorted({k[0] for k in KICK} | {k[1] for k in KICK})]
for kind, a0, a1, z0, z1, sg in PANES:
    ax = Vector((1, 0, 0)) if kind == 'side' else Vector((0, 1, 0))
    for a_ in (a0 - FRAME_W, a1 + FRAME_W): CUTS.append((ax * a_, ax))
    for z_ in (z0 - FRAME_W, z1 + FRAME_W): CUTS.append((Vector((0, 0, z_)), Vector((0, 0, 1))))
_seen, _u = set(), []
for co, no in CUTS:   # drop duplicate planes (shared window edges)
    k = (round(co.dot(no), 3), tuple(round(c, 3) for c in no))
    if k not in _seen: _seen.add(k); _u.append((co, no))
CUTS = _u; print('paint cuts', len(CUTS))
for o in (SHELL, FRAME):
    bm = bmesh.new(); bm.from_mesh(o.data)
    for co, no in CUTS: bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
    bm.to_mesh(o.data); bm.free()

# ---- 4. visibility: glass blocks the rays, so what survives is skin; what a ray reaches only through the glass is the saloon
def tree_of(objs):
    vs, ps = [], []
    for o in objs:
        base = len(vs); vs += [v.co.copy() for v in o.data.vertices]; ps += [tuple(base + i for i in p.vertices) for p in o.data.polygons]
    return BVHTree.FromPolygons(vs, ps)
solids = [SHELL, FRAME, BLIND, HUB, PLATE, WHEEL_, SEATS]
T_SKIN = tree_of(solids + [GLASS_]); T_SEE = tree_of(solids)
DIRS = [Vector((math.cos(e) * math.cos(t), math.cos(e) * math.sin(t), math.sin(e))) for e in (0.0, 0.3, 0.7, 1.1, 1.5) for t in [2 * math.pi * i / 24 for i in range(24)]]
def seen(tree, c, n):
    return any(n.dot(d) > 0 and tree.ray_cast(c + n * 0.004, d, 30)[0] is None for d in DIRS)
def classify_vis(o):    # -> {poly index: ('skin' | 'saloon', flip)}; the source has inward-wound faces (double-sided material), so try the back side too
    out = {}
    for p in o.data.polygons:
        for tree, kind in ((T_SKIN, 'skin'), (T_SEE, 'saloon')):
            if seen(tree, p.center, p.normal): out[p.index] = (kind, False); break
            if seen(tree, p.center, -p.normal): out[p.index] = (kind, True); break
    return out

# ---- 5. collect faces per bucket into bmeshes
BM = {b: bmesh.new() for b in BUCKETS}
def add_faces(o, picks):    # picks: {poly index: bucket}; copies the polygons (triangulated) into the bucket bmeshes with fresh verts
    for pi, bucket in picks.items():
        bucket, flip = bucket if isinstance(bucket, tuple) else (bucket, False)
        p = o.data.polygons[pi]; vs = [BM[bucket].verts.new(o.data.vertices[i].co) for i in p.vertices]
        try: f = BM[bucket].faces.new(vs)
        except ValueError: continue
        f.normal_update()
        if f.normal.dot(-p.normal if flip else p.normal) < 0: f.normal_flip()

T_GLASS = tree_of([GLASS_])
def shell_bucket(p, flip=False):
    """paint by geometry, not by the source texture (its big triangles bleed across window edges): black around the glass, arches and the
    bottom lip; red regions are cut by exact planes into skirt / swoosh / kick / front line; everything else is body"""
    x, y, z = p.center; nx, ny = (-p.normal.x, -p.normal.y) if flip else (p.normal.x, p.normal.y)
    if in_frame(p): return 'BusTrim'
    if z < LIP_Z: return 'BusTrim'
    if any(abs(y) > 0.9 and math.hypot(x - wx, z - WR) < WR + ARCH_W for wx in (WHEELS['FL'][0], WHEELS['RL'][0])): return 'BusTrim'
    if z < SKIRT_Z: return 'BusAccent'
    side = abs(ny) > 0.35
    if side and x < SW_X1 and line_lo(x) < z < line_hi(x): return 'BusStripe'
    if side and KICK_Z[0] < z < KICK_Z[1]:
        for xa, xb, bk in KICK:
            if kick_x(z, xb) < x < kick_x(z, xa): return bk
    if nx > 0.5 and FRONT_LINE[0] < z < FRONT_LINE[1]: return 'BusStripe'
    return 'BusBody'
def collect(o, skin):   # skin: poly -> bucket or None (then not wanted); saloon faces always go to BusInterior
    picks = {}
    for i, (kind, flip) in classify_vis(o).items():
        b = skin(o.data.polygons[i], flip) if kind == 'skin' else 'BusInterior'
        if b: picks[i] = (b, flip)
    add_faces(o, picks)
# the skin is split between 'body_1' and the pale 'material' mesh (sliver wedges), both painted by position; mirrors/blind box and hub bits are trim/chrome
collect(SHELL, shell_bucket); collect(FRAME, lambda p, f: None if abs(p.normal.z) > 0.6 else shell_bucket(p, f))
collect(BLIND, lambda p, f: 'BusMetal' if abs(p.center.y) > 1.3 else 'BusTrim')
collect(HUB, lambda p, f: None); collect(SEATS, lambda p, f: None)
add_faces(PLATE, {p.index: 'BusMetal' for p in PLATE.data.polygons})
add_faces(GLASS_, {p.index: 'BusGlass' for p in GLASS_.data.polygons})   # flat panes, dissolved below

# ---- 6. decals: front destination blind (UVs for the runtime canvas), headlamps, tail lamps, side blinds
def ray_hit(origin, d):
    h = T_SKIN.ray_cast(origin, d, 30); return (h[0], h[1]) if h[0] is not None else (None, None)
def decal(bucket, p0, nrm, right, up, hw, hh, off, uv=False, segs=0):
    """rectangle (segs=0) or disc centred on p0, facing nrm, lifted by off; right/up span the face; UVs = (u right, v up) when uv"""
    b = BM[bucket]; c = p0 + nrm * off
    if segs: pts = [c + right * (hw * math.cos(2 * math.pi * k / segs)) + up * (hh * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
    else: pts = [c - right * hw - up * hh, c + right * hw - up * hh, c + right * hw + up * hh, c - right * hw + up * hh]
    vs = [b.verts.new(p) for p in pts]; f = b.faces.new(vs); f.normal_update()
    if f.normal.dot(nrm) < 0: f.normal_flip()
    if uv:
        lay = b.loops.layers.uv.verify()
        for lp in f.loops:
            d = lp.vert.co - c; lp[lay].uv = (0.5 + d.dot(right) / (2 * hw), 0.5 + d.dot(up) / (2 * hh))
UPV = Vector((0, 0, 1))
def on_shell(x, y, z, face, rad=0.25):   # outermost skin point over a patch (rays along -face from outside), so decals clear local bulges; returns (point, face normal)
    side = face.cross(UPV) if abs(face.z) < 0.5 else Vector((1, 0, 0)); best = None
    for du in (-rad, 0, rad):
        for dv in (-rad, 0, rad):
            h, n = ray_hit(Vector((x, y, z)) + side * du + UPV * dv + face * 3, -face)
            if h is not None and (best is None or h.dot(face) > best.dot(face)): best = h
    if best is None: return None, None
    c = Vector((x, y, z)); c += face * (best.dot(face) - c.dot(face)); return c, face.copy()
# front blind: on the front skin between the decks (the source paints it on a black texture panel there)
h, n = on_shell(8, 0, 2.645, Vector((1, 0, 0)))
fright = UPV.cross(n)
decal('BusDisplay', h, n, fright, UPV, 0.55, 0.20, 0.016, uv=True); decal('BusTrim', h, n, fright, UPV, 0.60, 0.25, 0.008)
for sg in (1, -1):         # side blinds in the red band between the decks, text reads front-to-rear on both sides like a real blind
    h, n = on_shell(0.9, sg * 3, 2.55, Vector((0, sg, 0)))
    if h is not None:
        right = UPV.cross(n)
        decal('BusDisplay', h, n, right, UPV, 0.60, 0.21, 0.012, uv=True)
        decal('BusTrim', h, n, right, UPV, 0.66, 0.26, 0.006)
# lamps: discs flush on the skin (positions measured from the source's lamp texels)
for sg in (1, -1):
    h, n = on_shell(5.9, sg * 0.83, 0.86, Vector((1, 0, 0)))
    if h is not None:
        decal('BusTrim', h, n, Vector((0, 1, 0)), UPV, 0.20, 0.20, 0.02, segs=16); decal('BusHeadlight', h, n, Vector((0, 1, 0)), UPV, 0.15, 0.15, 0.03, segs=16)
    h, n = on_shell(-5.95, sg * 1.04, 1.10, Vector((-1, 0, 0)))
    if h is not None:
        decal('BusTrim', h, n, Vector((0, 1, 0)), UPV, 0.19, 0.19, 0.02, segs=16); decal('BusTaillight', h, n, Vector((0, 1, 0)), UPV, 0.14, 0.14, 0.03, segs=16)

# ---- 7. wheels: smooth tyre revolve + dished rim with alternating dark wedges (so the spin reads); axis = Y, origin = wheel centre
TYRE_SEG, RIM_SEG = 20, 16
def wheel(name, c, hw, sign):
    mesh = bpy.data.meshes.new(name); w = bmesh.new(); R, RIM = WR, WR * 0.62
    prof = [(RIM * 0.95, hw * 0.86), (R * 0.80, hw), (R * 0.96, hw * 0.92), (R, hw * 0.45)]; prof += [(r, -y) for r, y in reversed(prof)]
    rings = [[w.verts.new((r * math.cos(2 * math.pi * i / TYRE_SEG), y, r * math.sin(2 * math.pi * i / TYRE_SEG))) for r, y in prof] for i in range(TYRE_SEG)]
    mats = [MATS['BusRubber'], MATS['BusMetal'], MATS['BusTrim']]; [mesh.materials.append(m) for m in mats]
    for i in range(TYRE_SEG):
        r0, r1 = rings[i], rings[(i + 1) % TYRE_SEG]
        for j in range(len(prof) - 1): w.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j])).material_index = 0
    rp = [(RIM, 0.020), (RIM * 0.84, 0.050), (RIM * 0.52, 0.080), (RIM * 0.28, 0.100), (0.0, 0.108)]
    rr = [[w.verts.new((r * math.cos(2 * math.pi * i / RIM_SEG), sign * (hw * 0.86 + y), r * math.sin(2 * math.pi * i / RIM_SEG))) for r, y in rp[:-1]] for i in range(RIM_SEG)]
    ctr = w.verts.new((0, sign * (hw * 0.86 + rp[-1][1]), 0))
    for i in range(RIM_SEG):
        r0, r1 = rr[i], rr[(i + 1) % RIM_SEG]; dark = i % 2 == 1
        for j in range(len(rp) - 2): w.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1])).material_index = 2 if (dark and j in (1, 2)) else 1
        w.faces.new((r0[-1], r1[-1], ctr)).material_index = 1
    bmesh.ops.recalc_face_normals(w, faces=w.faces[:])
    for f in w.faces:   # tyre normals outwards (from axis), rim normals outwards along the sign axis
        cen = f.calc_center_median()
        if f.material_index == 0:
            if f.normal.dot(Vector((cen.x, 0, cen.z)) if abs(cen.y) < hw * 0.6 else Vector((0, cen.y, 0))) < 0: f.normal_flip()
        elif f.normal.y * sign < 0: f.normal_flip()
    bmesh.ops.triangulate(w, faces=w.faces[:]); w.to_mesh(mesh); w.free()
    o = bpy.data.objects.new(name, mesh); sc.collection.objects.link(o); o.location = (c[0], c[1], WR); return o
wheels = {k: wheel(k, v, v[2], 1 if v[1] > 0 else -1) for k, v in WHEELS.items()}
for k, v in WHEELS.items(): wheels[k].location = (v[0], v[1], WR)

# ---- 8. build the body meshes: one per material, dissolve coplanar glass, decimate saloon
bodies = []
for b in BUCKETS:
    me = bpy.data.meshes.new(b); bm = BM[b]
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(b, me); sc.collection.objects.link(o); me.materials.append(MATS[b]); bodies.append(o)
    if b in DISSOLVE:   # flat regions merge back into big polygons (the long-edge split above only served the paint classification)
        d = o.modifiers.new('p', 'DECIMATE'); d.decimate_type = 'DISSOLVE'; d.angle_limit = math.radians(DISSOLVE[b]); t = o.modifiers.new('t', 'TRIANGULATE')
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='p'); bpy.ops.object.modifier_apply(modifier='t')
    if b == 'BusInterior' and len(me.polygons) > INTERIOR_TRIS:
        d = o.modifiers.new('d', 'DECIMATE'); d.ratio = INTERIOR_TRIS / len(me.polygons)
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='d')
bodies = [o for o in bodies if len(o.data.polygons)]
for o in [o for o in sc.objects if o.type == 'MESH' and o not in bodies and o not in wheels.values()]: bpy.data.objects.remove(o)

# ---- 9. export
root = bpy.data.objects.new('BusRoot', None); sc.collection.objects.link(root)
for o in [*bodies, *wheels.values()]:
    o.parent = root; bpy.context.view_layer.objects.active = o; o.select_set(True); o.data.validate(verbose=False)
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    except Exception: bpy.ops.object.shade_smooth()
for m in list(bpy.data.materials):
    if m.name not in MATS: bpy.data.materials.remove(m)
for i in list(bpy.data.images): bpy.data.images.remove(i)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, use_selection=True, export_apply=True, export_texcoords=True, export_image_format='NONE',
                          export_animations=False, export_cameras=False, export_lights=False, export_materials='EXPORT', export_vertex_color='NONE')
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
for o in [*bodies, *wheels.values()]: print(' ', o.name, tri(o))
print('EXPORTED', OUT, 'tris', sum(tri(o) for o in [*bodies, *wheels.values()]), 'bytes', os.path.getsize(OUT))
