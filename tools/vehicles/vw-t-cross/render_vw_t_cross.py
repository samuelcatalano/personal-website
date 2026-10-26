# blender -b --factory-startup -P render_vw_t_cross.py -- [view ...]   renders the exported GLB (not the authoring scene)
# views: front side rear q_front q_rear top  ->  renders/<view>.png ; ortho framing matches the blueprint crops (see compare_vw_t_cross.py)
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[2]; OUT = HERE / 'renders'; OUT.mkdir(exist_ok=True)
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/vehicles/vw-t-cross.glb'))
s = bpy.context.scene
try: s.render.engine = 'BLENDER_EEVEE'
except TypeError: s.render.engine = 'BLENDER_EEVEE_NEXT'
s.view_settings.view_transform = 'Standard'
PAINT = (.64, .32, .16, 1)
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    m = o.data.materials[0]; m.use_backface_culling = True; m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bs.outputs[0], out.inputs[0])
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = o.data.color_attributes[0].name
    if 'Body' in o.name:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1
        nt.links.new(vc.outputs[0], mx.inputs[6]); mx.inputs[7].default_value = PAINT; nt.links.new(mx.outputs[2], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = .25; bs.inputs['Metallic'].default_value = .35
    else:
        nt.links.new(vc.outputs[0], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = .15 if 'Glass' in o.name else .6
        if 'Lights' in o.name: nt.links.new(vc.outputs[0], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = .15
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.7, .72, .75, 1); bg.inputs[1].default_value = .55
bpy.ops.mesh.primitive_plane_add(size=60); g = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.45, .46, .48, 1); g.data.materials.append(gm)
for nm, rot, en in (('key', (math.radians(55), 0, math.radians(-30)), 2.4), ('fill', (math.radians(60), 0, math.radians(150)), 1.0), ('top', (0, 0, 0), .6)):
    L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN')); L.data.energy = en; L.rotation_euler = rot; s.collection.objects.link(L)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
s.render.image_settings.file_format = 'PNG'; s.render.film_transparent = False
# ortho framings: (res_x, res_y, ortho_scale m, cam centre x/y/z, direction)  -- blueprint crops in original px, 1 px = 1/411.9 m (side)
def ortho(name, rx, ry, ppm, pivot_px, ground_px, dirv):
    cx, cy = rx / 2, ry / 2; d = Vector(dirv)
    off_h = (pivot_px - cx) / ppm; off_v = (ground_px - cy) / ppm          # world point (0,0,0) sits at pivot_px,ground_px
    up = Vector((0, 0, 1)); right = d.cross(up).normalized() * -1 if False else (up.cross(d)).normalized()
    # camera looks along -d (camera sits at +d*10); screen right = (-d) x up
    right = ((-d).cross(up)).normalized()
    pos = d * 12 + right * (-off_h) + up * off_v
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = rx / ppm
    cam.location = pos; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    s.render.resolution_x, s.render.resolution_y = rx, ry
    s.render.filepath = str(OUT / f'{name}.png'); bpy.ops.render.render(write_still=True)
import json
CAL = json.loads((HERE / 'framing.json').read_text())
def view(name):
    if name in CAL: c = CAL[name]; ortho(name, c['rx'], c['ry'], c['ppm'], c['px'], c['gy'], c['dir'])
    else:
        cam.data.type = 'PERSP'; cam.data.lens = 50; s.render.resolution_x, s.render.resolution_y = 1200, 760
        az, el, T, dist = {'q_front': (35, 14, (0, 0, .7), 7.2), 'q_rear': (145, 14, (0, 0, .7), 7.2), 'q_front_l': (-35, 14, (0, 0, .7), 7.2), 'q_rear_l': (-145, 14, (0, 0, .7), 7.2), 'q_low': (60, 4, (0, 0, .7), 7.2), 'top': (0, 89, (0, 0, .7), 7.2),
                           'c_rear': (150, 22, (-1.85, 0, 1.0), 3.2), 'c_front': (32, 18, (1.75, 0, .75), 3.4), 'c_side': (80, 8, (-.2, 0, 1.0), 5.2), 'c_wheel': (90, 0, (1.25, 0, .35), 2.2)}[name]
        a_, e_ = math.radians(az), math.radians(el); T = Vector(T); dd = Vector((math.cos(a_) * math.cos(e_), -math.sin(a_) * math.cos(e_), math.sin(e_)))
        cam.location = T + dd * dist; cam.rotation_euler = (T - cam.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = str(OUT / f'{name}.png'); bpy.ops.render.render(write_still=True)
for v in (a or ['side', 'front', 'rear', 'q_front', 'q_rear']): view(v)
