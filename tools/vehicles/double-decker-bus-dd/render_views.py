# blender -b --factory-startup -P render_views.py -- in.glb outdir prefix [london|glasgow]   : front 3/4, side, rear 3/4 stills with the runtime palettes (vehicle-assets.js BUS_VARIANTS)
import bpy, math, os, sys
from mathutils import Vector
src, out, pre = sys.argv[sys.argv.index('--') + 1:][:3]; variant = (sys.argv[sys.argv.index('--') + 1:] + ['london'])[3]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
PAL = dict(london=dict(body='#b52a2d', accent='#7e1c20', stripe=None), glasgow=dict(body='#5a2a86', accent='#33174f', stripe='#e0398f', skirtF='#33174f', sweep='#f4f2f8', lilac='#b79ad6', rear='#7b4bb0', mark='#7b4bb0', mark2='#7b4bb0'), london_old=dict(body='#c9252b', accent='#8f171d', stripe=None), glasgow_old=dict(body='#8a36ae', accent='#c9cdd2', stripe=None))[variant]
def lin(h): c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return (*[((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c], 1)
# approximate runtime finishes: paint = glossy standard, trim/tyre dark, glass bluish translucent, chrome, lamps and blind emissive
FIN = dict(BusBody=(PAL['body'], .28, .1, 1), BusAccent=(PAL['accent'], .28, .1, 1), BusStripe=(PAL['stripe'] or PAL['body'], .28, .1, 1), BusSkirtF=(PAL.get('skirtF', PAL['accent']), .28, .1, 1), BusSweep=(PAL.get('sweep', PAL['body']), .28, .1, 1), BusLilac=(PAL.get('lilac', PAL['body']), .28, .1, 1), BusRear=(PAL.get('rear', PAL['body']), .28, .1, 1), BusTrim=('#1b1d21', .7, 0, 1), BusGlass=('#3d5262', .2, .3, .55),
           BusRubber=('#242629', .85, 0, 1), BusMetal=('#d8dadc', .3, .25, 1), BusHeadlight=('#fff3d6', .2, 0, 1), BusTaillight=('#c01414', .3, 0, 1), BusDisplay=('#ffb347', .5, 0, 1), BusMark=(PAL.get('mark', '#f2f2f0'), .4, 0, 1), BusMark2=(PAL.get('mark2', '#1c3f94'), .4, 0, 1), BusInterior=(os.environ.get('INTC', '#2a2622'), .9, 0, 1))
for m in bpy.data.materials:
    k = m.name.split('.')[0]
    if k not in FIN: continue
    h, r, mt, al = FIN[k]; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(h); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = mt; b.inputs['Alpha'].default_value = al
    if al < 1:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.56, .57, .6, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
bpy.ops.mesh.primitive_plane_add(size=80); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.36, .37, .39, 1); g.data.materials.append(gm)
for nm, rot, en in (('key', (math.radians(50), 0, math.radians(-35)), 3.2), ('fill', (math.radians(60), 0, math.radians(150)), 1.4)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; s.collection.objects.link(L)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam; cam.data.lens = 60
s.render.resolution_x, s.render.resolution_y = 1000, 640
T = Vector((0, 0, 2.0))
VIEWS = (('front34', -38, 14, 21), ('side', -90, 4, 23), ('rear34', -142, 14, 21)) if not os.environ.get('CLOSE') else (('cfront', -25, 8, 9), ('crear', -155, 8, 9), ('cfrontR', 30, 8, 9), ('cdoor', -60, 5, 9), ('kerb', 90, 4, 23), ('kerbfront', 60, 6, 11), ('kerbrear', 125, 6, 11))
TGT = {'cfront': (5, 0, 1.6), 'crear': (-5, 0, 1.8), 'cfrontR': (5, 0, 1.6), 'cdoor': (4, 0, 1.4), 'kerbfront': (3, 0, 1.5), 'kerbrear': (-3, 0, 1.8)}
for n, az, el, r in VIEWS:
    T = Vector(TGT.get(n, (0, 0, 2.0)))
    A, E = math.radians(az), math.radians(el)
    cam.location = T + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (T - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, f'{pre}-{n}.png'); bpy.ops.render.render(write_still=True)
