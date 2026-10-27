# Game-ready London cab from "LTI TX4 London Taxi" by Nieve5677 (CC-BY-4.0).
# Run: blender -b --factory-startup -P build_cab_tx4.py -- [src.glb] [out.glb]
# Output contract = assets/vehicles/london-cab.glb: three.js forward +X, up +Y, right +Z, ground y=0, wheel nodes FL FR RL RR
# (origin at the wheel centre, no rotation: runtime spins rotation.z), six buckets CabBody/CabGlass/CabRubber/CabTrim/CabInterior/CabLights,
# COLOR_0 on every mesh (runtime materials use vertexColors), no textures, no UVs, <= 10k triangles.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = a[0] if a else os.path.join(ROOT, 'assets/models/source/london-taxi/london_taxi.glb')
OUT = a[1] if len(a) > 1 else os.path.join(ROOT, 'assets/vehicles/london-cab.glb')
BUCKETS = ('CabBody', 'CabGlass', 'CabRubber', 'CabTrim', 'CabInterior', 'CabLights')
# final triangle budget per bucket body part (wheels: 4 x tyre revolve + 4 x rim on top); total hard ceiling 10k
BUDGET = dict(CabBody=3000, CabGlass=550, CabRubber=900, CabTrim=1100, CabInterior=550, CabLights=420)
PRE = 2.0     # decimate to PRE x budget first, cull hidden faces, then decimate to the budget
WHITE, AMBER, SIGN, RED, HEAD = (1, 1, 1), (1, 0.27, 0.015), (1, 0.62, 0.18), (0.75, 0.015, 0.012), (1, 0.94, 0.79)
TYRE_SEG, RIM_R = 24, 0.245

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
def lin(h): return h
M = {}
for n in BUCKETS:
    m = bpy.data.materials.new(n); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (.02, .02, .02, 1); M[n] = m

# ---- 1. bake: cm, Y-down-up source (up = -Y, nose = -Z, left = +X) -> metres, forward +X, left +Y, up +Z (glTF export maps to three.js +Y up)
FIX = Matrix.Scale(0.01, 4) @ Matrix(((0, 0, -1, 0), (1, 0, 0, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
src = {}
for o in [o for o in sc.objects if o.type == 'MESH']:
    o.data = o.data.copy(); o.data.transform(FIX @ o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4); src[o.name] = o
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
def obj(*ns): return [src['Object_%d' % n] for n in ns]
def bounds(o):
    vs = [v.co for v in o.data.vertices]; return [(min(v[i] for v in vs), max(v[i] for v in vs)) for i in range(3)]
def mname(o): return o.data.materials[0].name

# ---- 2. piece helper: copy of o holding the faces accepted by pred(centroid, normal), decimated to ~target tris, painted `color`
def clone(o):
    c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c); return c
def decimate(c, target, bucket=None):
    if bucket == 'CabGlass':   # flat panes: dissolve coplanar faces first so collapse does not leave zig-zag slivers
        d = c.modifiers.new('p', 'DECIMATE'); d.decimate_type = 'DISSOLVE'; d.angle_limit = math.radians(1.5)
        t = c.modifiers.new('t', 'TRIANGULATE')
        bpy.context.view_layer.objects.active = c; bpy.ops.object.modifier_apply(modifier='p'); bpy.ops.object.modifier_apply(modifier='t')
    n = len(c.data.polygons)
    if n > target:
        d = c.modifiers.new('d', 'DECIMATE'); d.ratio = max(target / n, 0.002)
        bpy.context.view_layer.objects.active = c; bpy.ops.object.modifier_apply(modifier='d')
def paint(c, color, bucket):
    c.data.materials.clear(); c.data.materials.append(M[bucket])
    for k in list(c.data.color_attributes): c.data.color_attributes.remove(k)
    ca = c.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for i in range(len(ca.data)): ca.data[i].color = (*color, 1)
    while c.data.uv_layers: c.data.uv_layers.remove(c.data.uv_layers[0])
parts = {n: [] for n in BUCKETS}   # bucket -> [(piece, color)]
def take(o, pred, target, bucket, color=WHITE):
    c = clone(o); bm = bmesh.new(); bm.from_mesh(c.data); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not pred(f.calc_center_median(), f.normal)], context='FACES')
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(c.data); bm.free()
    if not c.data.polygons: bpy.data.objects.remove(c); return None
    decimate(c, int(target * PRE), bucket); paint(c, color, bucket); parts[bucket].append(c); return c
def join(os_):
    bpy.ops.object.select_all(action='DESELECT')
    for o in os_: o.select_set(True)
    bpy.context.view_layer.objects.active = os_[0]; bpy.ops.object.join(); return bpy.context.view_layer.objects.active
ALL = lambda c, n: True

# ---- 3. wheels: centres from the source tyres (objects 49/51/53/55), tyre rebuilt as a smooth revolve, rim = source hub faces
wheel_c = {}
for o in obj(49, 51, 53, 55):
    (x0, x1), (y0, y1), (z0, z1) = bounds(o); c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); R = (z1 - z0) / 2
    wheel_c[('F' if c.x > 0 else 'R') + ('L' if c.y > 0 else 'R')] = (c, R, (y1 - y0) / 2)
for k, (c, R, hw) in wheel_c.items(): print('wheel', k, tuple(round(v, 3) for v in c), 'R', round(R, 3), 'halfwidth', round(hw, 3))
def nearest_wheel(p):
    for k, (c, R, hw) in wheel_c.items():
        if math.hypot(p.x - c.x, p.z - c.z) < 0.28 and abs(p.y - c.y) < 0.3: return k
def tyre(c, R, hw, seg=TYRE_SEG):
    # (radius, half-width) outer half: sidewall, shoulder, tread; mirrored. Open at the hub (the rim covers it).
    prof = [(RIM_R * 0.9, hw * 0.86), (R * 0.80, hw), (R * 0.96, hw * 0.92), (R, hw * 0.45)]; prof += [(r, -y) for r, y in reversed(prof)]
    bm = bmesh.new(); rings = []
    for i in range(seg):
        t = 2 * math.pi * i / seg; rings.append([bm.verts.new((r * math.cos(t), y, r * math.sin(t))) for r, y in prof])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(len(prof) - 1): bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('tyre'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('tyre', me); sc.collection.objects.link(o)
    paint(o, (1, 1, 1), 'CabRubber'); return o
def rim(c, R, sign, seg=20):
    # dished steel disc facing outwards (sign = outer side along Y): outer band alternates light/dark wedges so the spin reads, hub cap in the middle
    prof = [(RIM_R, 0.055), (RIM_R * 0.84, 0.075), (RIM_R * 0.52, 0.095), (RIM_R * 0.30, 0.115), (0.0, 0.125)]
    bm = bmesh.new(); rings = []
    for i in range(seg):
        t = 2 * math.pi * i / seg; rings.append([bm.verts.new((r * math.cos(t), sign * y, r * math.sin(t))) for r, y in prof])
    ctr = [bm.verts.new((0, sign * prof[-1][1], 0))]
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(len(prof) - 2): bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]) if sign > 0 else (r0[j], r0[j + 1], r1[j + 1], r1[j]))
        bm.faces.new((r0[-2], r1[-2], ctr[0]) if sign > 0 else (r0[-2], ctr[0], r1[-2]))
    for f in bm.faces:
        f.normal_update()
        if f.normal.y * sign < 0: f.normal_flip()
    me = bpy.data.meshes.new('rim'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('rim', me); sc.collection.objects.link(o)
    paint(o, (1, 1, 1), 'CabTrim'); ca = me.color_attributes['Col']
    for p in me.polygons:
        a = math.atan2(p.center.z, p.center.x) % (2 * math.pi); rr = math.hypot(p.center.x, p.center.z)
        if rr > RIM_R * 0.4 and rr < RIM_R * 0.9 and int(a / (2 * math.pi / seg)) % 2:
            for l in p.loop_indices: ca.data[l].color = (0.12, 0.12, 0.12, 1)
    return o
wheels = {}
for k, (c, R, hw) in wheel_c.items():
    o = join([tyre(c, R, hw), rim(c, R, 1 if c.y > 0 else -1)]); o.name = k; o.data.name = k; o.location = c; wheels[k] = o

# ---- 4. body pieces
under = lambda c, n: n.z < -0.5 and c.z < 0.5
def add(objs, pred, target, bucket, color=WHITE):   # target is shared by the source objects in proportion to their size
    tot = sum(len(o.data.polygons) for o in objs)
    return [take(o, pred, max(8, target * len(o.data.polygons) / tot), bucket, color) for o in objs]
add(obj(*range(22, 32)), lambda c, n: not under(c, n), BUDGET['CabBody'], 'CabBody')           # carpaint
# split the 'black' source into rubber (seals, bumper inserts, sign housing, wipers) minus the antenna
ant = lambda c: c.z > 1.9
add(obj(*range(9, 20)), lambda c, n: not ant(c) and not under(c, n), BUDGET['CabRubber'], 'CabRubber')
add(obj(5), ALL, 60, 'CabRubber')                                                                 # wipers
# chrome: grille, door handles, lamp rings, bumper strips, mirrors
add(obj(*range(32, 39)), lambda c, n: not under(c, n), BUDGET['CabTrim'], 'CabTrim')
add(obj(2), ALL, 120, 'CabTrim')                                                                  # mirror glass
add(obj(21), lambda c, n: abs(c.y) > 0.5, 60, 'CabTrim')                                          # brake discs stay on the body
# glass: windows/windscreen vs lamp lenses
lamp_f = lambda c: c.x > 1.7 and c.z < 1.0
lamp_r = lambda c: c.x < -1.9 and c.z < 1.3
add(obj(39, 40), lambda c, n: not (lamp_f(c) or lamp_r(c)) and not under(c, n), 600, 'CabGlass')
add(obj(58, 59, 60), ALL, 400, 'CabGlass')
add(obj(39, 40), lambda c, n: lamp_f(c), 200, 'CabLights', HEAD)
add(obj(3), ALL, 160, 'CabLights', RED)                                                           # tail lamps
add(obj(45), ALL, 160, 'CabLights', AMBER)                                                        # indicators
# interior silhouette
add(obj(41, 42, 43, 44), lambda c, n: c.z > 0.3, BUDGET['CabInterior'], 'CabInterior')

# ---- 5. roof TAXI sign: lit amber slab inside the sign housing (housing = black faces above the roofline in front of the antenna)
sg = [f.center for o in obj(12) for f in o.data.polygons if f.center.z > 1.8 and abs(f.center.y) < 0.5 and f.center.x > -0.2]
sx0, sx1 = min(p.x for p in sg), max(p.x for p in sg); sy = max(abs(p.y) for p in sg); sz = min(p.z for p in sg)
print('sign', round(sx0, 3), round(sx1, 3), round(sy, 3), round(sz, 3))
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.scale(bm, vec=(sx1 - sx0 + 0.06, 2 * sy + 0.04, 0.10), verts=bm.verts)
bmesh.ops.translate(bm, vec=((sx0 + sx1) / 2, 0, sz + 0.03), verts=bm.verts)
me = bpy.data.meshes.new('sign'); bm.to_mesh(me); bm.free(); so = bpy.data.objects.new('sign', me); sc.collection.objects.link(so)
paint(so, SIGN, 'CabLights'); parts['CabLights'].append(so)

# radiator backing: dark slab just behind the grille bars (the source has no radiator, so the grille would show the sky through it)
(gx0, gx1), (gy0, gy1), (gz0, gz1) = bounds(obj(32)[0])
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.scale(bm, vec=(0.02, gy1 - gy0 - 0.02, gz1 - gz0 - 0.04), verts=bm.verts)
bmesh.ops.translate(bm, vec=(gx0 + 0.03, (gy0 + gy1) / 2, (gz0 + gz1) / 2), verts=bm.verts)
me = bpy.data.meshes.new('radiator'); bm.to_mesh(me); bm.free(); ro = bpy.data.objects.new('radiator', me); sc.collection.objects.link(ro)
paint(ro, (1, 1, 1), 'CabRubber'); parts['CabRubber'].append(ro)

# ---- 6. per bucket: join, cull hidden faces (rays from outside, glass is see-through), decimate to the budget
J = {b: join(parts[b]) for b in BUCKETS if parts[b]}
def cull():
    dg = bpy.context.evaluated_depsgraph_get(); bms = {}; verts, polys, owner = [], [], []
    for b, o in J.items():
        if b == 'CabGlass': continue
        base = len(verts); verts += [v.co.copy() for v in o.data.vertices]; polys += [tuple(base + i for i in p.vertices) for p in o.data.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    dirs = [Vector((math.cos(e) * math.cos(t), math.cos(e) * math.sin(t), math.sin(e))) for e in (0.15, 0.55, 1.0, 1.5) for t in [2 * math.pi * i / 18 for i in range(18)]]
    for b, o in J.items():
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); dead = []
        for f in bm.faces:
            c, n = f.calc_center_median(), f.normal; seen = False
            for d in dirs:
                for s in (1, -1) if b in ('CabGlass', 'CabInterior') else (1,):
                    if s * n.dot(d) <= 0: continue
                    if tree.ray_cast(c + s * n * 0.004, d, 12.0)[0] is None: seen = True; break
                if seen: break
            if not seen: dead.append(f)
        print('cull', b, len(bm.faces), '->', len(bm.faces) - len(dead))
        bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(o.data); bm.free()
cull()
for b, o in J.items(): decimate(o, BUDGET[b], b); print('final', b, sum(len(p.vertices) - 2 for p in o.data.polygons))
bodies = list(J.values())
for b, o in J.items(): o.name = o.data.name = b

# ---- 7. wheel local geometry in glTF axes, parent, export
for o in sc.objects:
    if o not in bodies and o not in wheels.values() and o.type == 'MESH': bpy.data.objects.remove(o)
root = bpy.data.objects.new('CarRoot', None); sc.collection.objects.link(root)
for o in [*bodies, *wheels.values()]:
    o.parent = root; bpy.context.view_layer.objects.active = o; o.select_set(True)
    o.data.validate(verbose=True)
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    except Exception: bpy.ops.object.shade_smooth()
    for m in list(o.data.materials): pass
for m in list(bpy.data.materials):
    if m.name not in M: bpy.data.materials.remove(m)
for i in list(bpy.data.images): bpy.data.images.remove(i)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, use_selection=True, export_apply=True, export_texcoords=False, export_image_format='NONE',
                          export_animations=False, export_cameras=False, export_lights=False, export_materials='EXPORT', export_vertex_color='ACTIVE')
tot = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == 'MESH')
print('EXPORTED', OUT, 'tris', tot, 'bytes', os.path.getsize(OUT))
