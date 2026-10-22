# blender -b --factory-startup -P render_mini.py -- in.glb outdir [refdir]
# 10 perspective views + all_views.jpg + left_vs_right.jpg (+ compare.jpg when refdir has right/front/rear/front_right.png)
import bpy, math, sys, os
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; refdir = a[2] if len(a) > 2 else None; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; bgn = w.node_tree.nodes['Background']; bgn.inputs[0].default_value = (.56, .57, .6, 1); bgn.inputs[1].default_value = 1.1
bpy.ops.mesh.primitive_plane_add(size=80); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.36, .37, .39, 1); gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9; g.data.materials.append(gm)
for nm, rot, en in (('key', (math.radians(50), 0, math.radians(-35)), 3.2), ('fill', (math.radians(60), 0, math.radians(150)), 1.4)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; s.collection.objects.link(L)
if os.environ.get('NOSHADOW'):
    for L_ in bpy.data.lights: L_.use_shadow = False
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
T = Vector((0, 0, 0.68))
def shot(name, az, el, r, lens=70, size=(900, 600), ortho=None, target=T):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho: cam.data.ortho_scale = ortho
    cam.data.lens = lens; s.render.resolution_x, s.render.resolution_y = size
    A, E = math.radians(az), math.radians(el)
    cam.location = target + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.image_settings.file_format = 'PNG'; s.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
VIEWS = [('front', 0, 10, 9.5), ('rear', 180, 10, 9.5), ('left', 90, 8, 9.5), ('right', -90, 8, 9.5), ('front_left', 38, 25, 9.5), ('front_right', -38, 25, 9.5),
         ('rear_left', 142, 25, 9.5), ('rear_right', -142, 25, 9.5), ('top_left', 45, 55, 9.5), ('top_right', -45, 55, 9.5)]
for n, az, el, r in VIEWS: shot(n, az, el, r)
shot('front_right_close', -38, 18, 4.6, lens=70, target=Vector((1.2, -0.1, 0.62)))
shot('rear_close', 160, 14, 4.4, lens=70, target=Vector((-1.5, 0.0, 0.72)))
shot('hero_low_close', -32, 7, 4.2, lens=60, target=Vector((1.0, -0.2, 0.5)))

def load(path):
    im = bpy.data.images.load(path); h, w_ = im.size[1], im.size[0]
    return np.array(im.pixels[:], dtype=np.float32).reshape(h, w_, 4)[::-1, :, :3]            # top-down rgb
def save(arr, path, q=88):
    h, w_ = arr.shape[:2]; im = bpy.data.images.new(os.path.basename(path), w_, h); rgba = np.concatenate([arr[::-1], np.ones((h, w_, 1), np.float32)], 2)
    im.pixels = rgba.ravel().tolist(); im.file_format = 'JPEG'; s.render.image_settings.file_format = 'JPEG'; s.render.image_settings.quality = q; im.save_render(path, scene=s)
def down(a_, f): h, w_ = a_.shape[0] // f * f, a_.shape[1] // f * f; return a_[:h, :w_].reshape(h // f, f, w_ // f, f, 3).mean((1, 3))
def label(img, text): return img                                                              # (no font in headless factory build; order is documented in REPORT)
V = {n: load(os.path.join(out, n + '.png')) for n, *_ in VIEWS}
order = ['front', 'front_right', 'right', 'rear_right', 'top_right', 'rear', 'rear_left', 'left', 'front_left', 'top_left']
rows = [np.concatenate([down(V[n], 2) for n in order[:5]], 1), np.concatenate([down(V[n], 2) for n in order[5:]], 1)]
save(np.concatenate(rows, 0), os.path.join(out, 'all_views.jpg'))
lf = V['left'][:, ::-1]; rt = V['right']; diff = np.clip(np.abs(lf - rt) * 4, 0, 1)
print('LEFT-vs-RIGHT mean abs diff (flipped left vs right):', float(np.abs(lf - rt).mean()))
save(np.concatenate([lf, rt, diff], 1), os.path.join(out, 'left_vs_right.jpg'))
if refdir:                                                                                    # same-framing compare: ref (top) vs model (bottom)
    cols = []
    for n, view in (('right', dict(az=-90, el=0.5, r=20, ortho=1254 * 3.82 / 1207, target=Vector((0, 0, (885 - 627) * 3.82 / 1207)))),
                    ('front', dict(az=0, el=9, r=20, ortho=1254 * 1.73 / 1065, target=Vector((0, 0, 0.68)))),
                    ('rear', dict(az=180, el=9, r=20, ortho=1254 * 1.73 / 975, target=Vector((0, 0, 0.71)))),
                    ('front_right', dict(az=-38, el=22, r=9.5, ortho=None, target=Vector((0, 0, 0.62))))):
        shot('cmp_' + n, view['az'], view['el'], view['r'], lens=85, size=(1254, 1254), ortho=view['ortho'], target=view['target'])
        cols.append(np.concatenate([down(load(os.path.join(refdir, n + '.png')), 2), down(load(os.path.join(out, 'cmp_' + n + '.png')), 2)], 0))
    save(np.concatenate(cols, 1), os.path.join(out, 'compare.jpg'))
    for n in ('right', 'front', 'rear', 'front_right'): os.remove(os.path.join(out, 'cmp_' + n + '.png'))
