"""Render the raw GLBs (4 views x 2 LODs) with Cycles CPU. Run: blender -b --python tools/landmarks/masp/render_views.py [-- night]"""
import bpy, os, sys, math
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'models', 'source', 'masp'))
OUT = os.path.join(HERE, 'renders'); os.makedirs(OUT, exist_ok=True)
night = 'night' in sys.argv
V = lambda x, y, z: Vector((x, -z, y))          # glTF space -> Blender space (importer already converted the mesh)
VIEWS = {'front34': ((-30, 12, 42), (0, 9, 0), 38), 'front': ((0, 7, 60), (0, 8, 0), 36), 'under': ((-14, 1.7, 22), (0, 8, 0), 34), 'side': ((-60, 7, 4), (0, 8, 0), 40)}
for lod in (0, 1):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 900, 900; sc.view_settings.view_transform = 'Standard'
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, f'masp.lod{lod}.raw.glb'))
    for m in bpy.data.materials:
        pb = m.node_tree.nodes.get('Principled BSDF')
        if pb and not night: pb.inputs['Emission Strength'].default_value = 0
    w = bpy.data.worlds.new('w'); w.use_nodes = True; sc.world = w
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.02, .03, .06, 1) if night else (.55, .68, .85, 1); bg.inputs[1].default_value = .3 if night else 1.0
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 1.0 if night else 4.0
    sun.rotation_euler = (math.radians(55), 0, math.radians(35)) if not night else (math.radians(80), 0, 0)
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    for name, (p, t, lens) in VIEWS.items():
        cam.data.lens = lens; cam.data.clip_end = 500; cam.location = V(*p)
        cam.rotation_euler = (V(*t) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, f'{name}_lod{lod}{"_night" if night else ""}.png'); bpy.ops.render.render(write_still=True)
