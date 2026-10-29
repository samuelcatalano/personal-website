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
LW = .08                 # baked mullion half-width as a fraction of one pane (widened at LOD1 so the rhythm survives 512 px)
CN, RD, GL, MU, PV, SF = range(6)   # authoring slots: concrete, red paint, glass, mullion steel, plaza paving, lit soffit
MATS = ['concrete', 'red', 'glass', 'mullion', 'paving', 'soffit']
ROUGH = [.85, .55, .08, .45, .8, .85]
METAL = [0, 0, 0, .3, 0, 0]
V = lambda x, y, z: Vector((x, -z, y))
BAY = 0.65               # glazing module (m): slender panes, fine pitch


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


# Frozen envelope: x +-20, z +-6.5, y 0..15.6. Four chunky red columns at the corners (x 17.2..20, outer face inset to z +-5.6) carry two deep girders; the glass box
# runs BETWEEN the columns (ends recessed, no cantilever) and its long glass wall, fascia and slab edge sit at z +-6.5, outboard of the girders.
XC0, XC1 = 17.2, 20.0    # column x range (inner / outer face)
ZC0, ZC1 = 3.0, 5.6      # column z range (outer face inset behind the glass plane)
XB = 17.2                # box half length (up to the column inner faces)
ZB = 6.5                 # slab / fascia half depth (glass plane)
ZG = 6.42                # glass plane (mullions and fascia flush at 6.5)
FY0, FY1 = 8.0, 9.3      # floor slab (soffit at 8.0)
GY0, GY1 = FY1, 12.4     # glass band (two storeys)
RY0, RY1 = GY1, 13.5     # concrete fascia band above the glass
GM = (GY0 + GY1) / 2     # mid rail


def frames(b):
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(sx * (XC0 + XC1) / 2, .2, sz * (ZC0 + ZC1) / 2, XC1 - XC0, 15.4, ZC1 - ZC0, RD, ())      # chunky column
    for sz in (-1, 1):
        b.box(0, RY1, sz * 4.6, 2 * XC0, 15.6 - RY1, 2.0, RD, ('+x', '-x'))                              # deep girder on the fascia, set back behind the glass plane


def body(b):
    L0 = b.lod == 0
    b.box(0, FY0, 0, 2 * XB, FY1 - FY0, 2 * ZB, CN, ('-y',))                                             # raw concrete floor slab
    b.poly([(-XB, FY0, -ZB), (XB, FY0, -ZB), (XB, FY0, ZB), (-XB, FY0, ZB)], SF, (0, -1, 0))             # lit soffit
    b.box(0, RY0, 0, 2 * XB, RY1 - RY0, 2 * ZB, CN, ())                                                  # fascia band over the glass + roof slab
    n = 22 if L0 else 11                                                                                  # skylight ribs between the girders
    for i in range(n):
        x = -XB + 1.0 + i * (2 * XB - 2.0) / (n - 1)
        b.box(x, RY1, 0, .28 if L0 else .5, .65, 2 * 3.6 - .1, CN, ())
    nb = int(XB / BAY) - 1
    for sz in (-1, 1):                                                                                    # long glass faces: fine pitch, thin dark mullions, mid rail
        b.poly([(-XB + .1, GY0, sz * ZG), (XB - .1, GY0, sz * ZG), (XB - .1, GY1, sz * ZG), (-XB + .1, GY1, sz * ZG)], GL, (0, 0, sz))
        if L0:
            for i in range(-nb, nb + 1): b.box(i * BAY, GY0, sz * (ZG + .04), .05, GY1 - GY0, .08, MU, ('+y', '-y', '-z'))
            for y in (GY0, GM - .04, GY1 - .08): b.box(0, y, sz * (ZG + .04), 2 * XB - .2, .08, .08, MU, ('+y', '-y', '-z'))
    for sx in (-1, 1):                                                                                    # glazed ends, recessed between the end columns
        xg = sx * (XB - .12)
        b.poly([(xg, GY0, -ZG), (xg, GY0, ZG), (xg, GY1, ZG), (xg, GY1, -ZG)], GL, (sx, 0, 0))
        if L0:
            for i in range(-18, 19): b.box(xg + sx * .03, GY0, i * (ZG - .1) / 18.0, .06, GY1 - GY0, .05, MU, ('+y', '-y', '-x'))
            b.box(xg + sx * .03, GM - .04, 0, .06, .08, 2 * ZG - .2, MU, ('+y', '-y', '-x'))


def plaza(b):
    L0 = b.lod == 0
    b.box(0, 0, -.45, 40, .54, 12.1, PV)                                              # plaza slab (belvedere level, roof of the lower block)
    b.box(0, 0, 5.85, 33.4, .36, .6, PV, ('-y', '-z'))                                # wide steps down to the avenue (+z)
    b.box(0, 0, 6.3, 33.4, .18, .4, PV, ('-y', '-z'))
    if L0:
        for sx in (-1, 1):
            for dx in (4.5, 11.0):
                b.box(sx * dx, .54, -1.2, 3.2, .34, .8, MU)                           # dark bench / planter slabs
                b.box(sx * dx, .54, 2.0, 3.2, .34, .8, MU)
        b.box(0, .54, -6.35, 40, .5, .3, CN)                                          # rear parapet of the lower block


def make(lod):
    b = B(lod)
    frames(b); body(b); plaza(b)
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
    bpy.ops.object.mode_set(mode='OBJECT')
    uvd = me.uv_layers.active.data                                   # glass islands get 2.2x the texel area so the fine pane rhythm stays readable
    for pl in me.polygons:
        if pl.material_index != GL: continue
        li = list(pl.loop_indices); c = sum((uvd[i].uv for i in li), Vector((0, 0))) / len(li)
        for i in li: uvd[i].uv = c + (uvd[i].uv - c) * 2.2
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=.006, rotate=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------- baking
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda v: v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


CON_RAMP = ('#9a978f', '#aeaba2')
RED_RAMP = ('#c40f28', '#d8142f')
COL = {'mullion': '#1e2124'}


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
            c = ramp(noise(30, 3), '#8a6a58', '#a07c66')
            gx = math_('GREATER_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('DIVIDE', X, 1.8)), .5)), .485)
            gy = math_('GREATER_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('DIVIDE', Y, 1.8)), .5)), .485)
            return mul(c, math_('MULTIPLY_ADD', math_('MAXIMUM', gx, gy), -.3, 1))
        if name == 'glass':
            t = node('ShaderNodeMapRange'); t.inputs[1].default_value = GY0; t.inputs[2].default_value = GY1; link(Z, t.inputs[0])
            c = ramp(t.outputs[0], '#223330', '#4d6663')
            # steel grid lines (mullions every BAY, mid rail) so LOD1 keeps the grid without geometry
            vx = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('ADD', math_('DIVIDE', X, BAY), .5)), .5)), LW)
            hz = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', Z, GM)), .06)
            mx = node('ShaderNodeMixRGB'); link(c, mx.inputs['Color1']); mx.inputs['Color2'].default_value = lin('#1a1d20'); link(math_('MAXIMUM', vx, hz), mx.inputs['Fac'])
            return mx.outputs['Color']
        return None
    if chan == 'ALB':
        s = albedo()
        if s is not None: link(s, em.inputs['Color'])
        else: em.inputs['Color'].default_value = lin(COL[name])
    else:  # EMI: night lighting (warm lit gallery box with scattered brighter cells, uplit red frames, lit soffit and plaza)
        if name == 'red':
            em.inputs['Color'].default_value = rgb('#ff1a30')
            mr = node('ShaderNodeMapRange'); mr.inputs[1].default_value = 0; mr.inputs[2].default_value = 15.6; mr.inputs[3].default_value = .36; mr.inputs[4].default_value = .1
            link(Z, mr.inputs[0]); link(mr.outputs[0], em.inputs['Strength'])
        elif name == 'glass':
            cell = node('ShaderNodeCombineXYZ')
            link(math_('FLOOR', math_('DIVIDE', X, BAY * 3)), cell.inputs['X'])
            link(math_('FLOOR', math_('DIVIDE', math_('SUBTRACT', Z, GY0), (GY1 - GY0) / 2)), cell.inputs['Y'])
            link(math_('SIGN', Y), cell.inputs['Z'])
            wn = node('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; link(cell.outputs[0], wn.inputs['Vector'])
            lit = math_('GREATER_THAN', wn.outputs['Value'], .35)
            vx = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', math_('FRACT', math_('ADD', math_('DIVIDE', X, BAY), .5)), .5)), LW)
            hz = math_('LESS_THAN', math_('ABSOLUTE', math_('SUBTRACT', Z, GM)), .06)
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
    global SIZE, LW
    SIZE = 1024 if lod == 0 else 512; LW = .08 if lod == 0 else .15
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
