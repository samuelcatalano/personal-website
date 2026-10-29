# Game-ready Mini from "2014 Mini Cooper S (F56)" by Ddiaz Design (CC-BY-NC-SA-4.0, owner-approved 2026-10-27).
# Run: blender -b --factory-startup -P build_mini_f56.py -- [src.glb] [out.glb]
# Output contract = assets/vehicles/mini-cooper.glb: three.js forward +X, up +Y, right +Z, ground y=0, wheel nodes FL FR RL RR
# (origin at the wheel centre, no rotation: runtime spins rotation.z, steers rotation.y), semantic CarXxx materials, no textures.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = a[0] if a else os.path.join(ROOT, 'assets/models/source/mini-f56/2014_mini_cooper_s_f56.glb')
OUT = a[1] if len(a) > 1 else os.path.join(ROOT, 'assets/vehicles/mini-cooper.glb')
COL = dict(CarBody='#efe7d6', CarRoof='#c9252b', CarGlass='#1b2830', CarTrim='#17191c', CarChrome='#aeb4ba', CarHeadlight='#fff6e0', CarTaillight='#c01414', CarInterior='#2b2724', CarPlate='#f3f1ea', CarRim='#4a4e54')
STRIPE_X, STRIPE_Y = (1.0, 1.72), ((0.09, 0.27))   # twin bonnet stripes: x range, |y| band (symmetric about the centreline)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
def mat(name, rough=0.4, metal=0.0, alpha=1.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(COL[name]), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if emit: b.inputs['Emission Color'].default_value = (*lin(COL[name]), 1); b.inputs['Emission Strength'].default_value = emit
    return m
M = dict(CarBody=mat('CarBody', 0.35), CarRoof=mat('CarRoof', 0.3), CarGlass=mat('CarGlass', 0.04, 0, 0.78), CarTrim=mat('CarTrim', 0.45), CarChrome=mat('CarChrome', 0.2, 0.7),
         CarHeadlight=mat('CarHeadlight', 0.2, 0, 1, 0.8), CarTaillight=mat('CarTaillight', 0.3, 0, 1, 0.6), CarInterior=mat('CarInterior', 0.85), CarPlate=mat('CarPlate', 0.5), CarRim=mat('CarRim', 0.35, 0.6))

# ---- 1. bake: apply armature, then world transform; cm-scale armature -> metres, source nose -Y -> +X, ground at tyre bottom
meshes = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.convert(target='MESH')
FIX = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Scale(100, 4)
for o in [o for o in sc.objects if o.type == 'MESH']:
    o.data = o.data.copy(); o.data.transform(FIX @ o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4)
    for m in list(o.modifiers): o.modifiers.remove(m)
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
src = {o.name: o for o in sc.objects}
def find(key, matkey=None):
    return [o for o in src.values() if key in o.name and (matkey is None or matkey in o.data.materials[0].name)]
def bounds(o):
    vs = [v.co for v in o.data.vertices]
    return [(min(v[i] for v in vs), max(v[i] for v in vs)) for i in range(3)]
wheels_src = find('Wheel1A')
dz = -min(bounds(w)[2][0] for w in wheels_src)
for o in src.values(): o.data.transform(Matrix.Translation((0, 0, dz)))

# ---- 2. piece helpers
def clone(o):
    c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c); return c
def cent(o, p): return o.matrix_world @ p.center
def take(o, pred, material):
    """copy of o holding only faces with pred(centroid, normal), all in `material`"""
    c = clone(o); bm = bmesh.new(); bm.from_mesh(c.data); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not pred(f.calc_center_median(), f.normal)], context='FACES')
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(c.data); bm.free()
    if not c.data.polygons: bpy.data.objects.remove(c); return None
    c.data.materials.clear(); c.data.materials.append(M[material])
    for p in c.data.polygons: p.material_index = 0
    return c
ALL = lambda c, n: True
pieces = []
def add(o, pred, material):
    p = take(o, pred, material)
    if p: pieces.append(p)
    return p

# ---- 3. body shell + roof (roof panel, mirror caps), then bonnet stripes cut by exact planes
paint = find('Paint_Geo', 'Paint_Material1')[0]
body = take(paint, ALL, 'CarBody')
bm = bmesh.new(); bm.from_mesh(body.data)
def cut(plane_y):
    fs = [f for f in bm.faces if STRIPE_X[0] - 0.2 < f.calc_center_median().x < STRIPE_X[1] + 0.2 and f.normal.z > 0.2]
    geom = list({*fs, *(e for f in fs for e in f.edges), *(v for f in fs for v in f.verts)})
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, plane_y, 0), plane_no=(0, 1, 0))
for s in (-1, 1):
    for y in STRIPE_Y: cut(s * y)
bm.faces.ensure_lookup_table()
for f in bm.faces:
    c = f.calc_center_median()
    if f.normal.z > 0.2 and STRIPE_X[0] < c.x < STRIPE_X[1] and STRIPE_Y[0] < abs(c.y) < STRIPE_Y[1]: f.material_index = 1
bm.to_mesh(body.data); bm.free()
body.data.materials.append(M['CarRoof']); pieces.append(body)
add(find('Paint_Geo', 'carP_2')[0], ALL, 'CarRoof')

# ---- 4. trim, glass, lamps, interior
chrome_zone = lambda c, n: c.x > 1.55 and 0.25 < c.z < 0.8 and abs(c.y) < 0.62   # grille surround
col = find('Coloured_Geo', 'Coloured_Material1')
col = [o for o in col if len(o.data.polygons) > 5000][0]
add(col, lambda c, n: not chrome_zone(c, n), 'CarTrim'); add(col, chrome_zone, 'CarChrome')
add(find('Window_Geo', 'Window_Material1')[0], ALL, 'CarTrim')
add(find('Window_Geo', 'red_glass')[0], ALL, 'CarTaillight')
gl = find('Window_Geo', 'glass_light')[0]
add(gl, lambda c, n: c.z >= 0.8, 'CarGlass')
add(gl, lambda c, n: c.z < 0.8 and c.x > 0, 'CarHeadlight'); add(gl, lambda c, n: c.z < 0.8 and c.x <= 0, 'CarTaillight')
lt = find('Light_Geo')[0]
add(lt, lambda c, n: c.x > 0, 'CarChrome'); add(lt, lambda c, n: c.x <= 0, 'CarTrim')
add(find('Interior_Geo', 'InteriorA')[0], ALL, 'CarInterior')
add(find('InteriorTillingColourZone')[0], ALL, 'CarInterior')
add(find('Base_Geo')[0], ALL, 'CarTrim')
add(find('Grille1_Geo')[0], ALL, 'CarTrim'); add(find('Grille2_Geo')[0], ALL, 'CarTrim')
add(find('Badge_Geo')[0], ALL, 'CarChrome')
add(find('ManufacturerPlate')[0], ALL, 'CarPlate')
for o in find('Calliper'): add(o, ALL, 'CarRoof')   # red calipers stay on the body (they do not spin)

TYRE_PROFILE = [(0.210, 0.100), (0.232, 0.116), (0.262, 0.118), (0.292, 0.108), (0.308, 0.090), (0.312, 0.060), (0.312, 0.045), (0.306, 0.040), (0.306, 0.035), (0.312, 0.030), (0.312, 0.020), (0.306, 0.015), (0.306, 0.010), (0.312, 0.005)]   # (radius, half-width) outer half; mirrored; four shallow circumferential tread grooves
def tyre(c, R, seg=96):
    k = R / 0.312; prof = [(r * k, y) for r, y in TYRE_PROFILE]; prof += [(r, -y) for r, y in reversed(prof)]
    bm = bmesh.new(); rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; rings.append([bm.verts.new((c.x + r * math.cos(a), c.y + y, c.z + r * math.sin(a))) for r, y in prof])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(len(prof)): bm.faces.new((r0[j], r0[(j + 1) % len(prof)], r1[(j + 1) % len(prof)], r1[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('tyre'); bm.to_mesh(me); bm.free(); me.materials.append(M['CarTrim'])
    o = bpy.data.objects.new('tyre', me); sc.collection.objects.link(o); return o
# ---- 5. wheels: centre from tyre bounds; tyre/rim split by radius, origin at the centre, axes = car axes (axle along Y)
RIM_R = 0.215
wheels = {}
for w in wheels_src:
    (x0, x1), (y0, y1), (z0, z1) = bounds(w); c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); R = (z1 - z0) / 2
    name = ('F' if c.x > 0 else 'R') + ('L' if c.y > 0 else 'R')
    rad = lambda p: math.hypot(p.x - c.x, p.z - c.z)
    parts = [tyre(c, R), take(w, lambda p, n: rad(p) < RIM_R, 'CarRim')]   # source tyre tread/lettering is replaced by a smooth revolve; keep the source rim geometry
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    o.data.transform(Matrix.Translation(-c)); o.location = c; wheels[name] = (o, R)
    print('wheel', name, 'centre', tuple(round(v, 3) for v in c), 'radius', round(R, 3))

# ---- 6. join body pieces, smooth, parent, export
bpy.ops.object.select_all(action='DESELECT')
for p in pieces: p.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]; bpy.ops.object.join()
B = bpy.context.view_layer.objects.active; B.name = 'Body'; B.data.name = 'Body'
for o in sc.objects:
    if o is not B and o.name not in wheels: bpy.data.objects.remove(o)
root = bpy.data.objects.new('CarRoot', None); sc.collection.objects.link(root)
for o in [B, *[w for w, _ in wheels.values()]]:
    o.parent = root
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='OBJECT')
    me = o.data; print('validate', o.name, me.validate(verbose=True)); me.uv_layers.clear() if hasattr(me.uv_layers, 'clear') else None
    for k in list(me.attributes.keys()):
        if k.startswith(('UV', 'Col', 'color')): me.attributes.remove(me.attributes[k])
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
    except Exception: bpy.ops.object.shade_smooth()
for m in list(bpy.data.materials):
    if m.name not in M: bpy.data.materials.remove(m)
for i in list(bpy.data.images): bpy.data.images.remove(i)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, use_selection=True, export_apply=True, export_texcoords=False, export_image_format='NONE',
                          export_animations=False, export_cameras=False, export_lights=False, export_materials='EXPORT')
tot = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == 'MESH')
print('EXPORTED', OUT, 'tris', tot, 'bytes', os.path.getsize(OUT))
