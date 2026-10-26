# blender -b --factory-startup -P render_nissan_qashqai.py -- in.glb outdir
# Writes ortho side/front/rear (transparent bg, fixed framing shared with make_compare.sh) and perspective 3/4 + detail views.
import bpy, math, sys, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; os.makedirs(out, exist_ok=True)
PAINT = (0.12, 0.35, 0.44, 1) if len(a) < 3 else tuple(float(v) for v in a[2].split(','))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.62, .64, .67, 1); bg.inputs[1].default_value = 0.55
# paint the white FleetBody vertex colour like the runtime does (colour multiply)
for m in bpy.data.materials:
    if m.name.startswith('FleetBody'):
        nt = m.node_tree; p = nt.nodes['Principled BSDF']; lk = [l for l in nt.links if l.to_socket == p.inputs['Base Color']]
        if lk:
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0; mix.inputs[7].default_value = PAINT
            src_s = lk[0].from_socket; nt.links.remove(lk[0]); nt.links.new(src_s, mix.inputs[6]); nt.links.new(mix.outputs[2], p.inputs['Base Color'])
        p.inputs['Roughness'].default_value = .3; p.inputs['Metallic'].default_value = .2
for nm, rot, en in (('key', (math.radians(50), 0, math.radians(-35)), 2.3), ('fill', (math.radians(60), 0, math.radians(150)), 0.9), ('top', (0, 0, 0), 0.5)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; s.collection.objects.link(L)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
def shot(name, az, el, r, lens=70, size=(1300, 650), ortho=None, target=Vector((0, 0, .8)), transparent=False):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho: cam.data.ortho_scale = ortho
    cam.data.lens = lens; cam.data.clip_end = 100; s.render.resolution_x, s.render.resolution_y = size; s.render.film_transparent = transparent
    A, E = math.radians(az), math.radians(el)
    cam.location = target + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.image_settings.file_format = 'PNG'; s.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
if os.environ.get('SHOTS'):                                   # ad-hoc close-ups: SHOTS="name,az,el,r,lens,tx,ty,tz;..."
    for sh in os.environ['SHOTS'].split(';'):
        n_, az, el, r, ln, tx, ty, tz = sh.split(','); shot(n_, float(az), float(el), float(r), lens=float(ln), size=(1300, 800), target=Vector((float(tx), float(ty), float(tz))))
    sys.exit(0)
# ortho frames (must match make_compare.sh): side 5.2 m wide, z -0.2..2.4 ; front/rear 2.6 m wide, z -0.1..1.8
# car right side = -Y in Blender; the brochure side drawing shows the car's left? (nose to the left) -> camera at +Y looks at the left flank, nose appears on the left
shot('o_side', 90, 0, 30, size=(1300, 550), ortho=5.2, target=Vector((0, 0, 0.9)), transparent=True)
shot('o_front', 0, 0, 30, size=(1040, 760), ortho=2.6, target=Vector((0, 0, .85)), transparent=True)
shot('o_rear', 180, 0, 30, size=(1040, 760), ortho=2.6, target=Vector((0, 0, .85)), transparent=True)
shot('f34', 38, 20, 9.0, lens=80, size=(1300, 800), target=Vector((0, 0, .72)))
shot('r34', 142, 20, 9.0, lens=80, size=(1300, 800), target=Vector((0, 0, .72)))
shot('front', 0, 6, 9.0, lens=80, size=(1300, 800), target=Vector((0, 0, .8)))
shot('rear', 180, 6, 9.0, lens=80, size=(1300, 800), target=Vector((0, 0, .8)))
shot('side', 90, 3, 9.0, lens=80, size=(1300, 700), target=Vector((0, 0, .8)))
shot('top', 90, 89.9, 12, size=(1300, 700), ortho=5.2, target=Vector((0, 0, .8)), transparent=False)
shot('f34_close', 40, 14, 4.2, lens=70, size=(1300, 800), target=Vector((1.6, -0.1, .75)))
shot('r34_close', 140, 14, 4.2, lens=70, size=(1300, 800), target=Vector((-1.6, -0.1, .9)))
