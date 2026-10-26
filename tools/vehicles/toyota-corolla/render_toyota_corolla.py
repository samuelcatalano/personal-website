# blender -b --factory-startup -P render_toyota_corolla.py -- model.glb outdir [refdir]
# Contact renders (front/side/rear/3-4 views, closeups) + compare.png (reference row above model row above silhouette overlay,
# identical framing, orthographic) when refdir holds side.png (blueprint, 1755x703) and large.png (4-view sheet, 1185x1185).
import bpy, math, sys, os
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; refdir = a[2] if len(a) > 2 else None; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
try: sc.render.engine = 'BLENDER_EEVEE'
except TypeError: sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.view_settings.view_transform = 'Standard'
PAINT = (.62, .63, .66, 1)
def mk(name, rough, metal=0.0, alpha=1.0, emit=0.0, tint=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    c = nt.nodes.new('ShaderNodeAttribute'); c.attribute_name = ''; m['attr'] = c.name
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if tint:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1; mx.inputs[7].default_value = tint
        nt.links.new(c.outputs['Color'], mx.inputs[6]); nt.links.new(mx.outputs[2], b.inputs['Base Color'])
        if emit: nt.links.new(mx.outputs[2], b.inputs['Emission Color'])
    else:
        nt.links.new(c.outputs['Color'], b.inputs['Base Color'])
        if emit: nt.links.new(c.outputs['Color'], b.inputs['Emission Color'])
    if emit: b.inputs['Emission Strength'].default_value = emit
    return m
MATS = {'FleetBody': mk('b', .32, .15, tint=PAINT), 'FleetGlass': mk('g', .08, .0, .45), 'FleetTrim': mk('t', .3, .45), 'FleetRubber': mk('r', .8),
        'FleetInterior': mk('i', .85), 'FleetLights': mk('l', .2, 0, 1, .7)}
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    nm = o.name.split('.')[0]; m = MATS.get(nm)
    if m is None: continue
    ca = o.data.color_attributes
    an = ca[0].name if len(ca) else 'Color'
    mm = m.copy(); mm.node_tree.nodes[m['attr']].attribute_name = an; o.data.materials.clear(); o.data.materials.append(mm)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.56, .57, .6, 1); bg.inputs[1].default_value = 1.1
bpy.ops.mesh.primitive_plane_add(size=80); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.36, .37, .39, 1); gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9; g.data.materials.append(gm)
for nm, rot, en in (('key', (math.radians(50), 0, math.radians(-35)), 3.2), ('fill', (math.radians(60), 0, math.radians(150)), 1.4)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; sc.collection.objects.link(L)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, az, el, r, lens=50, size=(960, 600), ortho=None, target=Vector((0, 0, .65)), shift=(0, 0)):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho: cam.data.ortho_scale = ortho
    cam.data.lens = lens; cam.data.shift_x, cam.data.shift_y = shift; sc.render.resolution_x, sc.render.resolution_y = size
    A, E = math.radians(az), math.radians(el)
    cam.location = target + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
def load(p):
    im = bpy.data.images.load(p); h, w_ = im.size[1], im.size[0]
    return np.array(im.pixels[:], dtype=np.float32).reshape(h, w_, 4)[::-1]
def save(arr, p):
    h, w_ = arr.shape[:2]; im = bpy.data.images.new(os.path.basename(p), w_, h); rgba = np.ones((h, w_, 4), np.float32); rgba[:, :, :3] = arr[::-1, :, :3]
    im.pixels = rgba.ravel().tolist(); im.filepath_raw = p; im.file_format = 'PNG'; im.save()
def resize(arr, w_, h_):
    ys = (np.arange(h_) * arr.shape[0] / h_).astype(int); xs = (np.arange(w_) * arr.shape[1] / w_).astype(int); return arr[ys][:, xs]
VIEWS = [('front34', -38, 22, 9), ('rear34', -142, 22, 9), ('front34_l', 38, 15, 9), ('side', -90, 3, 12), ('top', -90, 80, 12),
         ('front', 0, 6, 12), ('rear', 180, 6, 12)]
for n, az, el, r in VIEWS: shot(n, az, el, r)
shot('front_close', -30, 12, 4.6, target=Vector((1.7, 0, .62)), size=(1100, 700))
shot('rear_close', -150, 12, 4.6, target=Vector((-1.8, 0, .72)), size=(1100, 700))
shot('wheel_close', -90, 4, 3.0, lens=60, target=Vector((1.38, 0, .36)), size=(900, 700))
shot('cabin_close', -60, 28, 5.5, lens=60, target=Vector((0, 0, 1.0)), size=(1100, 700))
if refdir:
    ref_side = load(os.path.join(refdir, 'side.png'))[:703, :, :3]; ref_big = load(os.path.join(refdir, 'large.png'))[:, :, :3]
    S_, ZSC = 4.63 / 1743.0, 1.0104
    # (name, ref array, crop (x0,y0,x1,y1), px/m, ground row (abs), centre col (abs), azimuth, vertical stretch of the reference)
    specs = [('side', ref_side, (0, 0, 1755, 560), 1 / S_, 544, 876.5, -90, ZSC), ('front', ref_big, (815, 245, 1125, 465), 127.5, 452, 969.5, 0, 1.0),
             ('rear', ref_big, (815, 625, 1125, 845), 134.0, 832, 971.0, 180, 1.0)]
    rows = []; g.hide_render = True; sc.render.film_transparent = True
    for name, ref, (x0, y0, x1, y1), ppm, ground, cc, az, vs in specs:
        cw, ch = x1 - x0, y1 - y0; k = 3; cwk, chk = cw * k, int(round(ch * vs * k)); ortho = cw / ppm
        zc = ((ground - y0) * vs - ch * vs / 2) / ppm; dy = (cc - x0 - cw / 2) / ppm * (1 if az == 0 else -1 if az == 180 else 0)
        shot('cmp_' + name, az, 0, 30, size=(cwk, chk), ortho=ortho, target=Vector((0, dy, zc)))
        m = load(os.path.join(out, 'cmp_' + name + '.png')); r_ = resize(ref[y0:y1, x0:x1], cwk, chk)
        mask = m[:, :, 3] > 0.5; ov = r_.copy()
        edge = (mask ^ np.pad(mask, 1)[2:, 1:-1]) | (mask ^ np.pad(mask, 1)[:-2, 1:-1]) | (mask ^ np.pad(mask, 1)[1:-1, 2:]) | (mask ^ np.pad(mask, 1)[1:-1, :-2])
        edge &= mask; ov[mask] = ov[mask] * .55 + np.array([1, .6, .6]) * .45; ov[edge] = (1, 0, 0)
        tw = 600; th = int(chk * tw / cwk)
        mod = np.where(mask[:, :, None], m[:, :, :3], np.array([.92, .92, .92]))
        rows.append(np.concatenate([resize(r_, tw, th), resize(mod, tw, th), resize(ov, tw, th)], 1))
        os.remove(os.path.join(out, 'cmp_' + name + '.png'))
    save(np.concatenate(rows, 0), os.path.join(out, 'compare.png'))
