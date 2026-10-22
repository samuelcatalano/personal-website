"""Generic view renderer.  blender -b --factory-startup -P render_views.py -- model.blend outdir [--clay] [--bg] [--views a,b] [--res 960] [--samples 48]

Renders each view to <outdir>/<name>.png (transparent film) and <outdir>/<name>_bg.png (dark neutral background + ground).
Views are turntable-ish: camera elevation ~30deg, azimuth measured from +X (front) towards -Y (car right).
"""
import bpy, sys, math, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:]
blend, outdir = argv[0], argv[1]
CLAY = '--clay' in argv
def opt(k, d):
    return argv[argv.index(k) + 1] if k in argv else d
RES = int(opt('--res', 960)); SAMPLES = int(opt('--samples', 48)); PREFIX = opt('--prefix', '')
VIEWS = {  # name: (azimuth deg from +X toward car-right (-Y), elevation deg, focal mm) - round 2: low elevation for the near-side-on crops
    'front': (0, 22, 85), 'front_right': (38, 25, 110), 'right': (90, 20, 85), 'rear_right': (142, 25, 110),
    'rear': (180, 22, 85), 'rear_left': (218, 25, 110), 'left': (270, 20, 85), 'front_left': (322, 25, 110),
    'o_side': (90, 0, 0), 'o_top': (90, 89.9, 0), 'o_front': (0, 0, 0), 'o_rear': (180, 0, 0),
    'hero': (float(opt('--hero-az', 40)), float(opt('--hero-el', 26)), 110),
}
CUSTOM = opt('--cam', None)  # 'x,y,z,tx,ty,tz,focal' -> extra view named 'custom'
names = opt('--views', ','.join(VIEWS)).split(',')
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = SAMPLES
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'

# ---- clay override
if CLAY:
    def cm(n, c, r=.6):
        m = bpy.data.materials.new(n); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r; return m
    body, glass, dark = cm('clay', (.42, .42, .43), .5), cm('clayglass', (.20, .21, .24), .2), cm('claydark', (.035, .035, .04), .6)
    mp = {'BodyPaintCream': body, 'BodyPaintRed': body, 'Chrome': body, 'Lights': body, 'Glass': glass,
          'Tyre': dark, 'WheelMetal': dark, 'InteriorDark': dark}
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for s in o.material_slots:
                if s.material and s.material.name in mp: s.material = mp[s.material.name]
    for o in bpy.data.objects:   # no stripes in clay
        if o.name.startswith('Stripes'): o.hide_render = True

# ---- world: studio gradient for reflections, dark flat for camera rays
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].position = .35; ramp.color_ramp.elements[0].color = (.07, .075, .085, 1)
ramp.color_ramp.elements[1].position = .95; ramp.color_ramp.elements[1].color = (.95, .97, 1.0, 1)
bgs = nt.nodes.new('ShaderNodeBackground'); bgs.inputs['Strength'].default_value = 0.8
nt.links.new(ramp.outputs['Color'], bgs.inputs['Color'])
bgc = nt.nodes.new('ShaderNodeBackground'); bgc.inputs['Color'].default_value = (.022, .024, .028, 1)
lp = nt.nodes.new('ShaderNodeLightPath'); mix = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes.new('ShaderNodeOutputWorld')
DARKBG = True
nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac']); nt.links.new(bgs.outputs[0], mix.inputs[1]); nt.links.new(bgc.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs[0])

def add_light(kind, loc, rot, energy, size):
    l = bpy.data.lights.new(kind, kind); l.energy = energy
    if kind == 'SUN': l.angle = math.radians(size)
    else: l.size = size
    o = bpy.data.objects.new(kind, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]; return o
add_light('SUN', (0, 0, 8), (48, 12, 125), 1.8, 8)
add_light('AREA', (-3, 5, 3), (65, 0, 215), 150, 5)
add_light('AREA', (4, -4, 2.5), (70, 0, 40), 100, 5)

# ground disc (only in background version)
bpy.ops.mesh.primitive_circle_add(radius=14, fill_type='NGON', location=(0, 0, 0)); ground = bpy.context.object
gm = bpy.data.materials.new('G'); gm.use_nodes = True; gb = gm.node_tree.nodes['Principled BSDF']
gb.inputs['Base Color'].default_value = (.045, .048, .055, 1); gb.inputs['Roughness'].default_value = .75
ground.data.materials.append(gm)

car_objs = [o for o in bpy.data.objects if o.type == 'MESH' and o is not ground and not o.hide_render]
def bbox_pts():
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in car_objs:
        if o.name.startswith(('Body', 'Roof', 'Trim', 'Wheel', 'FL', 'FR', 'RL', 'RR')) and not o.name.startswith('Body_Cage'):
            me = o.data
            step = max(1, len(me.vertices) // 400)
            for v in list(me.vertices)[::step]: pts.append(o.matrix_world @ v.co)
    return pts
PTS = bbox_pts()
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_width = 36
center = Vector((0, 0, .65))

def frame(az, el, focal):
    cam.data.type = 'PERSP' if focal else 'ORTHO'
    if not focal: focal = 60; cam.data.ortho_scale = 5.0 if az in (90, 270) else 3.2
    cam.data.lens = focal; cam.data.shift_x = cam.data.shift_y = 0
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), math.sin(e)))
    dist = 9.0
    if cam.data.type == 'ORTHO':
        cam.location = center + d * 12; cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        if el > 80: cam.rotation_euler = (0, 0, math.radians(90))
        return
    for _ in range(4):
        cam.location = center + d * dist
        cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        ps = [world_to_camera_view(sc, cam, p) for p in PTS]
        xs = [p.x for p in ps]; ys = [p.y for p in ps]
        w_, h_ = max(xs) - min(xs), max(ys) - min(ys)
        k = max(w_ / 0.80, h_ / 0.80)
        dist *= k
    cam.location = center + d * dist
    bpy.context.view_layer.update()
    ps = [world_to_camera_view(sc, cam, p) for p in PTS]
    cam.data.shift_x = ((max(p.x for p in ps) + min(p.x for p in ps)) / 2 - .5)
    cam.data.shift_y = ((max(p.y for p in ps) + min(p.y for p in ps)) / 2 - .5) * (RES * 0.75) / RES * 1.0

sc.render.resolution_x = RES; sc.render.resolution_y = int(RES * .75)
for n in names:
    if n == 'custom':
        c = [float(v) for v in CUSTOM.split(',')]
        cam.data.type = 'PERSP'; cam.data.lens = c[6]; cam.data.shift_x = cam.data.shift_y = 0
        cam.location = c[:3]; cam.rotation_euler = (Vector(c[3:6]) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    else:
        az, el, f = VIEWS[n]
        frame(az, el, f)
    # transparent
    sc.render.film_transparent = True; ground.hide_render = True
    sc.render.filepath = os.path.join(outdir, '%s%s.png' % (PREFIX, n)); bpy.ops.render.render(write_still=True)
    sc.render.film_transparent = False; ground.hide_render = False
    sc.render.filepath = os.path.join(outdir, '%s%s_bg.png' % (PREFIX, n)); bpy.ops.render.render(write_still=True)
    print('rendered', n)
