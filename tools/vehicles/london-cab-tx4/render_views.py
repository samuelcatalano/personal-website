# blender -b --factory-startup -P render_views.py -- in.glb outdir prefix   : front 3/4, side, rear 3/4 stills (materials are the GLB buckets; neutral studio light)
import bpy, math, os, sys
from mathutils import Vector
src, out, pre = sys.argv[sys.argv.index('--') + 1:][:3]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
# approximate the runtime finishes (vehicle-assets.js CAB_FINISH): body near-black clearcoat, chrome trim, tinted glass; lamps glow by vertex colour
FIN = dict(CabBody=((.03, .033, .038), .3, .3, 1), CabGlass=((.06, .09, .11), .1, 0, .4), CabRubber=((.02, .022, .025), .8, 0, 1), CabTrim=((.53, .57, .61), .3, .35, 1), CabInterior=((.08, .085, .09), .85, 0, 1), CabLights=((1, 1, 1), .2, 0, 1))
for m in bpy.data.materials:
    if m.name.split('.')[0] not in FIN: continue
    c, r, mt, al = FIN[m.name.split('.')[0]]; b = m.node_tree.nodes['Principled BSDF']; nt = m.node_tree
    b.inputs['Roughness'].default_value, b.inputs['Metallic'].default_value, b.inputs['Alpha'].default_value = r, mt, al
    for l in list(b.inputs['Base Color'].links): nt.links.remove(l)
    at = nt.nodes.new('ShaderNodeVertexColor'); at.layer_name = 'Color'; mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1
    mx.inputs[6].default_value = (*c, 1); nt.links.new(at.outputs[0], mx.inputs[7]); nt.links.new(mx.outputs[2], b.inputs['Base Color'])
    if al < 1:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if m.name.startswith('CabLights'): nt.links.new(at.outputs[0], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.5
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
T = Vector((0, 0, 0.9))
for n, az, el, r in (('front34', -38, 22, 9), ('side', -90, 6, 9.5), ('rear34', -142, 22, 9)):
    A, E = math.radians(az), math.radians(el)
    cam.location = T + Vector((r * math.cos(E) * math.cos(A), r * math.cos(E) * math.sin(A), r * math.sin(E)))
    cam.rotation_euler = (T - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.join(out, f'{pre}-{n}.png'); bpy.ops.render.render(write_still=True)
