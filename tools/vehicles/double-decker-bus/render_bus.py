# blender -b --factory-startup -P render_bus.py -- in.glb outdir [--variant glasgow]
import bpy, math, sys, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; glasgow = '--variant' in a and a[a.index('--variant') + 1] == 'glasgow'; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return (*[((x + 0.055) / 1.055) ** 2.4 for x in c], 1)
if glasgow:                                           # preview-only recolour of the semantic paint materials
    for n, h in (('BusBody', '#5b2a86'), ('BusAccent', '#c9bfe0')):
        for m in bpy.data.materials:
            if m.name.startswith(n): m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = lin(h)
s = bpy.context.scene
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.render.resolution_x, s.render.resolution_y = 1200, 800
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.5, .52, .55, 1); bg.inputs[1].default_value = 1.0
bpy.ops.mesh.primitive_plane_add(size=80); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.diffuse_color = (.35, .36, .38, 1); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.35, .36, .38, 1); g.data.materials.append(gm)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(40), 0, math.radians(-30)); s.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 50; s.collection.objects.link(cam); s.camera = cam
T = Vector((0, 0, 2.0))
VIEWS = [('front', 0, 6, 17), ('rear', 180, 6, 17), ('left', 90, 4, 24), ('right', -90, 4, 24), ('front_left', 40, 20, 20), ('front_right', -40, 20, 20),
         ('rear_left', 140, 20, 20), ('rear_right', -140, 20, 20), ('top_left', 45, 55, 22), ('top_right', -45, 55, 22)]
for name, az, el, r in VIEWS:
    A, E = math.radians(az), math.radians(el)
    cam.location = T + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (T - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
