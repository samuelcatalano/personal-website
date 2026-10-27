# blender -b --factory-startup -P render_views.py -- in.glb outdir prefix   : front 3/4, side, rear 3/4 stills (player palette is baked into the GLB materials)
import bpy, math, os, sys
from mathutils import Vector
src, out, pre = sys.argv[sys.argv.index('--') + 1:][:3]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.56, .57, .6, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
bpy.ops.mesh.primitive_plane_add(size=80); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.36, .37, .39, 1); g.data.materials.append(gm)
for nm, rot, en in (('key', (math.radians(50), 0, math.radians(-35)), 3.2), ('fill', (math.radians(60), 0, math.radians(150)), 1.4)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; s.collection.objects.link(L)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam; cam.data.lens = 70
s.render.resolution_x, s.render.resolution_y = 1000, 640
T = Vector((0, 0, 0.68))
for n, az, el, r in (('front34', -38, 22, 9), ('side', -90, 6, 9.5), ('rear34', -142, 22, 9)):
    A, E = math.radians(az), math.radians(el)
    cam.location = T + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (T - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, f'{pre}-{n}.png'); bpy.ops.render.render(write_still=True)
