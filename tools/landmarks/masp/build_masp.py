"""MASP (Museu de Arte de Sao Paulo, Lina Bo Bardi): glass box hung from two red concrete portal frames, free span underneath, plaza level and stairs.
Procedural bmesh build, Cycles bake (albedo / AO / roughness-metal / night emissive), glTF export.
Run: blender -b --python tools/landmarks/masp/build_masp.py
Coordinates are authored in glTF space (Y up, metres) in the SAME local frame as the procedural createMasp group (origin = centre of the footprint at
ground level, x along the long side, z across it); V() maps them to Blender (Z up). Envelope (frozen): x +-20, z +-6.5, y 0..15.6."""
import bpy, bmesh, math, os, time, json, struct
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'models', 'source', 'masp'))
TEX = os.path.join(OUT, 'tex')
os.makedirs(TEX, exist_ok=True)
SIZE = 1024
CN, RD, GL, MU, PV, SF = range(6)   # authoring slots: concrete, red paint, glass, mullion steel, plaza paving, lit soffit
MATS = ['concrete', 'red', 'glass', 'mullion', 'paving', 'soffit']
ROUGH = [.85, .55, .08, .45, .8, .85]
METAL = [0, 0, 0, .3, 0, 0]
V = lambda x, y, z: Vector((x, -z, y))
BAY = 2.1                # glazing module (m), same as the procedural mullion pitch
GY0, GY1 = 8.55, 13.1  # glass band


class B:
    def __init__(s, lod):
        s.bm = bmesh.new(); s.lod = lod

    def poly(s, pts, m, hint):
        q = [pts[0]]
        for p in pts[1:]:
            if max(abs(p[i] - q[-1][i]) for i in range(3)) > 1e-6: q.append(p)
        if len(q) > 1 and max(abs(q[0][i] - q[-1][i]) for i in range(3)) <= 1e-6: q.pop()
        if len(q) < 3: return
        try: f = s.bm.faces.new([s.bm.verts.new(V(*p)) for p in q])
        except ValueError: return
        f.material_index = m; f.normal_update()
        if f.normal.dot(V(*hint)) < 0: bmesh.ops.reverse_faces(s.bm, faces=[f])

    def box(s, cx, y0, cz, w, h, d, m=CN, skip=('-y',)):
        x0, x1, z0, z1, y1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0 + h
        F = {'+x': ((1, 0, 0), [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)]),
             '-x': ((-1, 0, 0), [(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)]),
             '+y': ((0, 1, 0), [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]),
             '-y': ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]),
             '+z': ((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),
             '-z': ((0, 0, -1), [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)])}
        for k, (n, p) in F.items():
            if k not in skip: s.poly(p, m, n)


def frames(b):
    L0 = b.lod == 0
    for dx in (-17, 17):
        for dz in (-5.5, 5.5):
            b.box(dx, 0.3, dz, 1.8, 13.8, 1.6, RD)                                   # portal column (rises from the plaza slab)
            b.box(dx, 0.3, dz, 2.1, .35, 1.9, CN)                                    # concrete shoe
            if L0: b.box(dx, 13.5, dz, 2.1, .6, 1.9, RD)                              # haunch under the beam
        b.box(dx, 14.1, 0, 2.0, 1.5, 13.0, RD, ())                                   # transverse portal beam
    for dz in (-5.55, 5.55):
        b.box(0, 13.65, dz, 40, 1.45, 1.35, RD, ())                              # long beams on top of the roof (hang the box)
        if L0:
            for x in (-19.95, 19.95): b.box(x, 13.65, dz, .1, 1.45, 1.35, CN)          # beam end caps


def hangers(b):
    L0 = b.lod == 0
    for dz in (-1, 1):
        for i in range(-4, 4):
            x = (2 * i + 1) * BAY
            b.box(x, 7.95, dz * 5.45, .3, 5.7, .5, RD)                               # slim hanger from beam to floor slab edge
            if L0:
                b.box(x, 7.85, dz * 5.45, .5, .12, .7, MU)                           # shoe plate under the slab edge
                b.box(x, 13.55, dz * 5.45, .5, .12, .7, MU)                          # bracket where it meets the beam


def body(b):
    L0 = b.lod == 0
    b.box(0, 8.0, 0, 33, .55, 10.4, CN, ('-y',))                                     # floor slab (ledge top shows outside the glass) (soffit is a lit material, below)
    b.poly([(-16.5, 8.0, -5.2), (16.5, 8.0, -5.2), (16.5, 8.0, 5.2), (-16.5, 8.0, 5.2)], SF, (0, -1, 0))
    b.box(0, 13.1, 0, 33, .55, 10.4, CN, ())                                          # roof slab (soffit strip shows outside the glass)
    for sx in (-1, 1):
        b.box(sx * 16.3, GY0, 0, .4, GY1 - GY0, 10.0, CN)                            # end walls
    for sz in (-1, 1):                                                               # long glass faces (recessed pane + steel grid in front)
        zg = sz * 4.8
        b.poly([(-16.1, GY0, zg), (16.1, GY0, zg), (16.1, GY1, zg), (-16.1, GY1, zg)], GL, (0, 0, sz))
        zm = sz * 4.88
        if L0:
            for i in range(-7, 8): b.box(i * BAY, GY0, zm, .075, GY1 - GY0, .16, MU, ('+x', '-x', '+z', '-z'))
            for y in (GY0, 10.75, GY1 - .1): b.box(0, y, zm, 32.2, .1, .16, MU, ('+y', '-y', '+z', '-z'))
        else:
            b.box(0, GY1 - .1, zm, 32.2, .1, .16, MU, ('+y', '-y', '+z', '-z'))
            b.box(0, GY0, zm, 32.2, .1, .16, MU, ('+y', '-y', '+z', '-z'))


def plaza(b):
    L0 = b.lod == 0
    b.box(0, 0, 0, 36.4, .32, 10.8, PV)              # plaza slab (belvedere level)
    # stairs down to the avenue (front, +z): three treads inside the frozen z envelope
    for k, h in enumerate((.22, .14, .07)):
        b.box(0, 0, 5.4 + .35 * (k + .5), 12 - 2 * k, h, .35, PV, ('-y', '-z'))
    if L0:
        for sx in (-1, 1):
            b.box(sx * 6.1, 0, 5.4 + .5, .22, .6, 1.1, CN)                           # stair cheeks
    # rear lower block: stone retaining volume with dark slits
    b.box(0, 0, -5.95, 34.0, 1.0, 1.0, CN)
    if L0:
        for i in range(-7, 8): b.box(i * 2.2, .35, -5.44, 1.4, .3, .03, MU, ('+x', '-x', '+y', '-y', '-z'))


def make(lod):
    b = B(lod)
    frames(b); hangers(b); body(b); plaza(b)
    bm = b.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.loops.layers.uv.new('UVMap')
    me = bpy.data.meshes.new(f'Masp_LOD{lod}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'Masp_LOD{lod}', me); bpy.context.scene.collection.objects.link(ob)
    for n in MATS: me.materials.append(bpy.data.materials.new(n))
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
    bpy.ops.uv.pack_islands(margin=.006, rotate=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------- baking
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda v: v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


CON_RAMP = ('#b4b0a6', '#c6c2b8')
RED_RAMP = ('#b5121b', '#d2221f')
COL = {'mullion': '#34393e'}


def mat_nodes(m, chan, img, idx):
    nt = m.node_tree; N = nt.nodes; Lk = nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); Lk.new(em.outputs[0], out.inputs[0])
    it = N.new('ShaderNodeTexImage'); it.image = img; N.active = it; it.select = True
    def node(t, **k):
        x = N.new(t)
        for a, v in k.items(): setattr(x, a, v)
        return x
    def link(a, b_): Lk.new(a, b_)
    name = MATS[idx]
    if chan == 'RM':
        em.inputs['Color'].default_value = (1, ROUGH[idx], METAL[idx], 1); return
    tc = node('ShaderNodeTexCoord'); P = tc.outputs['Object']
    sep = node('ShaderNodeSeparateXYZ'); link(P, sep.inputs[0]); X, Y, Z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    def noise(scale, detail, stretch=(1, 1, 1)):
        mp = node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = stretch; link(P, mp.inputs['Vector'])
        nz = node('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        link(mp.outputs[0], nz.inputs['Vector']); return nz.outputs['Fac']
    def ramp(fac, c0, c1):
        r = node('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = lin(c0); r.color_ramp.elements[1].color = lin(c1)
        link(fac, r.inputs['Fac']); return r.outputs['Color']
    def mul(a, b_):
        x = node('ShaderNodeMixRGB', blend_type='MULTIPLY'); x.inputs['Fac'].default_value = 1
        link(a, x.inputs['Color1']); link(b_, x.inputs['Color2']); return x.outputs['Color']
    def math_(op, a, b_=None, c=None):
        x = node('ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b_, c)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: link(v, x.inputs[i])
        return x.outputs[0]
    def rgb(h, k=1.0):
        c = lin(h) if isinstance(h, str) else h
        return (c[0] * k, c[1] * k, c[2] * k, 1)
    def albedo():
        if name in ('concrete', 'soffit'):
            c = ramp(noise(4, 5), *CON_RAMP)
            c = mul(c, ramp(noise(45, 2), '#d4d4d4', '#ffffff'))
            boards = math_('MULTIPLY_ADD', math_('LESS_THAN', math_('FRACT', math_('DIVIDE', Z, .6)), .04), -.22, 1)   # formwork courses
            return mul(c, boards)
        if name == 'red':
            c = ramp(noise(18, 3, (1, 1, .5)), *RED_RAMP)
            wet = node('ShaderNodeMapRange'); wet.inputs[1].default_value = 0; wet.inputs[2].default_value = 4; wet.inputs[3].default_value = .8; wet.inputs[4].default_value = 1; link(Z, wet.inputs[0])
            return mul(c, wet.outputs[0])
        if name == 'paving':
            c = ramp(noise(30, 3), '#8f8c84', '#a29f96')
            gx = math_('GREATER_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('DIVIDE', X, 1.8)), .5)), .485)
            gy = math_('GREATER_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('DIVIDE', Y, 1.8)), .5)), .485)
            return mul(c, math_('MULTIPLY_ADD', math_('MAXIMUM', gx, gy), -.3, 1))
        if name == 'glass':
            t = node('ShaderNodeMapRange'); t.inputs[1].default_value = 8.55; t.inputs[2].default_value = 13.1; link(Z, t.inputs[0])
            c = ramp(t.outputs[0], '#1d3441', '#46687a')
            # steel grid lines (mullions every BAY, mid rail) so LOD1 keeps the grid without geometry
            vx = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('ADD', math_('DIVIDE', X, BAY), .5)), .5)), .018)
            hz = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', Z, 10.825)), .05)
            mx = node('ShaderNodeMixRGB'); link(c, mx.inputs['Color1']); mx.inputs['Color2'].default_value = lin('#3a4046'); link(math_('MAXIMUM', vx, hz), mx.inputs['Fac'])
            return mx.outputs['Color']
        return None
    if chan == 'ALB':
        s = albedo()
        if s is not None: link(s, em.inputs['Color'])
        else: em.inputs['Color'].default_value = lin(COL[name])
    else:  # EMI: night lighting (warm lit gallery box with scattered brighter cells, uplit red frames, lit soffit and plaza)
        if name == 'red':
            em.inputs['Color'].default_value = rgb('#ff2a18')
            mr = node('ShaderNodeMapRange'); mr.inputs[1].default_value = 0; mr.inputs[2].default_value = 15; mr.inputs[3].default_value = .36; mr.inputs[4].default_value = .1
            link(Z, mr.inputs[0]); link(mr.outputs[0], em.inputs['Strength'])
        elif name == 'glass':
            cell = node('ShaderNodeCombineXYZ')
            link(math_('FLOOR', math_('DIVIDE', X, BAY)), cell.inputs['X'])
            link(math_('FLOOR', math_('DIVIDE', math_('SUBTRACT', Z, 8.55), 2.275)), cell.inputs['Y'])
            link(math_('SIGN', Y), cell.inputs['Z'])
            wn = node('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; link(cell.outputs[0], wn.inputs['Vector'])
            lit = math_('GREATER_THAN', wn.outputs['Value'], .35)
            vx = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('ADD', math_('DIVIDE', X, BAY), .5)), .5)), .018)
            hz = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', Z, 10.825)), .05)
            pane = math_('SUBTRACT', 1, math_('MAXIMUM', vx, hz))                           # steel grid stays dark
            em.inputs['Color'].default_value = lin('#ffb866'); link(math_('MULTIPLY', math_('MULTIPLY_ADD', lit, .4, .1), pane), em.inputs['Strength'])
        elif name == 'soffit': em.inputs['Color'].default_value = lin('#ffd7a0'); em.inputs['Strength'].default_value = .38
        elif name == 'paving': em.inputs['Color'].default_value = lin('#ffd9a8'); em.inputs['Strength'].default_value = .1
        elif name == 'mullion': em.inputs['Color'].default_value = rgb('#ffc98a'); em.inputs['Strength'].default_value = .1
        elif name == 'concrete': em.inputs['Color'].default_value = rgb('#ffcf99'); em.inputs['Strength'].default_value = .05
        else: em.inputs['Color'].default_value = (0, 0, 0, 1)



def bake(ob, chan, btype, cs):
    img = bpy.data.images.new(f'bake_{chan}', SIZE, SIZE, alpha=False)
    img.colorspace_settings.name = cs
    for i, m in enumerate(ob.data.materials):
        m.use_nodes = True
        if chan in ('ALB', 'EMI', 'RM'): mat_nodes(m, chan, img, i)
        else: mat_nodes(m, 'RM', img, i)       # AO ignores shaders; only the active image node matters
    r = bpy.context.scene.render.bake
    r.margin = 8; r.margin_type = 'EXTEND'; r.use_clear = True
    bpy.ops.object.bake(type=btype)
    return img


def save(img, path):
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()


def bounds_of(glb):
    with open(glb, 'rb') as f:
        f.read(12); ln, _ = struct.unpack('<II', f.read(8)); j = json.loads(f.read(ln))
    a = [x for x in j['accessors'] if 'min' in x and x['type'] == 'VEC3'][0]
    return a['min'], a['max'], j


def run(lod):
    global SIZE
    SIZE = 1024 if lod == 0 else 512
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'
    ob = make(lod)
    w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 4.0
    t0 = time.time(); sc.cycles.samples = 1
    alb = bake(ob, 'ALB', 'EMIT', 'sRGB'); emi = bake(ob, 'EMI', 'EMIT', 'sRGB'); rm = bake(ob, 'RM', 'EMIT', 'Non-Color')
    sc.cycles.samples = 48
    ao = bake(ob, 'AO', 'AO', 'Non-Color')
    bt = time.time() - t0
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)
    a, r = px(ao), px(rm)
    orm = np.ones((SIZE, SIZE, 4), np.float32); orm[..., 0] = a[..., 0]; orm[..., 1] = r[..., 1]; orm[..., 2] = r[..., 2]
    ormi = bpy.data.images.new('orm', SIZE, SIZE, alpha=False); ormi.colorspace_settings.name = 'Non-Color'; ormi.pixels.foreach_set(orm.ravel())
    # verify: lit share of glass cells and that the soffit is emissive
    e = px(emi); uvd = ob.data.uv_layers.active.data; tot = {}; lit = {}
    for pl in ob.data.polygons:
        if pl.material_index not in (GL, SF): continue
        uvs = [uvd[i].uv for i in pl.loop_indices]; c = (sum(uvs, uvs[0] * 0) / len(uvs) * 3 + uvs[0]) / 4  # off-centre: the glass centre sits on the mid rail
        ok = e[min(SIZE - 1, int(c[1] * SIZE)), min(SIZE - 1, int(c[0] * SIZE)), :3].max() > .05
        n = MATS[pl.material_index]; tot[n] = tot.get(n, 0) + 1; lit[n] = lit.get(n, 0) + ok
    print('LITCHECK', lod, {n: f'{lit[n]}/{tot[n]}' for n in tot})
    p = lambda n: os.path.join(TEX, f'lod{lod}_{n}.png')
    save(alb, p('albedo')); save(emi, p('emissive')); save(ormi, p('orm'))
    # export material: standard ORM packing (R = baked AO, G = roughness, B = metalness)
    for i in range(len(ob.data.materials)): ob.data.materials.pop(index=0)
    m = bpy.data.materials.new('MaspAtlas'); m.use_nodes = True; m.use_backface_culling = True; N = m.node_tree.nodes; L = m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); pb = N.new('ShaderNodeBsdfPrincipled'); L.new(pb.outputs[0], out.inputs[0])
    def tx(path, cs):
        t = N.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path); t.image.colorspace_settings.name = cs; return t
    ta, to, te = tx(p('albedo'), 'sRGB'), tx(p('orm'), 'Non-Color'), tx(p('emissive'), 'sRGB')
    sep = N.new('ShaderNodeSeparateColor'); L.new(to.outputs['Color'], sep.inputs['Color'])
    L.new(ta.outputs['Color'], pb.inputs['Base Color']); L.new(sep.outputs['Green'], pb.inputs['Roughness']); L.new(sep.outputs['Blue'], pb.inputs['Metallic'])
    L.new(te.outputs['Color'], pb.inputs['Emission Color']); pb.inputs['Emission Strength'].default_value = 1.0
    ng = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree'); ng.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = N.new('ShaderNodeGroup'); gn.node_tree = ng; L.new(sep.outputs['Red'], gn.inputs['Occlusion'])
    ob.data.materials.append(m)
    for pl in ob.data.polygons: pl.material_index = 0
    glb = os.path.join(OUT, f'masp.lod{lod}.raw.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    me = ob.data; me.calc_loop_triangles()
    mn, mx, j = bounds_of(glb)
    return dict(lod=lod, tris=len(me.loop_triangles), verts=len(me.vertices), min=[round(x, 3) for x in mn], max=[round(x, 3) for x in mx], bake_s=round(bt, 1),
                images=len(j.get('images', [])), mats=[x['name'] for x in j['materials']], glb=glb)


if __name__ == '__main__':
    print('RESULT', json.dumps([run(0), run(1)], indent=1))
