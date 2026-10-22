# blender -b --factory-startup -P render_a330.py -- in.glb outdir
import bpy, math, sys, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene; s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x, s.render.resolution_y = 1200, 800
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.5, .52, .55, 1); bg.inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (math.radians(40), 0, math.radians(-30)); s.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 50; s.collection.objects.link(cam); s.camera = cam
for name, az, el in [('front_right', -40, 22), ('right', -90, 8), ('rear_right', -140, 22), ('front', 0, 8), ('top_right', -45, 55)]:
    r = 78; A, E = math.radians(az), math.radians(el)
    cam.location = Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (-cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
