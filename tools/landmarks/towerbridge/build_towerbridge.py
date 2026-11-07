"""Tower Bridge (London): two Victorian Gothic towers, high-level walkways, bascule deck.
Procedural bmesh build, vertex-colour PBR, direct GLB export.
Run: blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
Authored in real metres (road level = 0; proportions from the 1900 Routledge elevation, towers ~63 m above road, walkways ~38 m above road,
61 m central span). V() scales by K so the whole bridge fits the frozen envelope of createTowerBridge: origin = river centreline,
x across the carriageway, z along the crossing, Y up."""
import bpy, bmesh, math, os, json, struct
from mathutils import Vector, geometry

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'processed', 'landmarks'))
os.makedirs(OUT, exist_ok=True)
ST, SL, BL, TR, GL, GD, DK, LW, WG, LS = range(10)   # authoring slots; LS = light strips (night only)
MATS = ['stone', 'slate', 'blue', 'trim', 'glass', 'gilt', 'deck', 'lampw', 'wglass', 'strip']
K = 0.40                     # scene metres per real metre: one factor keeps the proportions inside the frozen envelope
DECK_TOP = 5.2               # scene height of the carriageway, unchanged
V = lambda x, y, z: Vector((K * x, -K * z, K * y + DECK_TOP))
SIDES = [((0, 0, 1), (1, 0, 0)), ((0, 0, -1), (-1, 0, 0)), ((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))]
TZ = 36.5                    # tower centres (+-z); the inner faces are 61 m apart, the central span
TX, TZH = 9.0, 6.0           # tower half widths (across x, along z)
ZIN = 30.5                   # inner face of each tower
HALF = 7.5                   # carriageway + footway half width
RIVER = -15.0                # pier foot (scene -0.8, the river)
WALK_Y = 38.0                # high-level walkway floor, above road


def arch(uc, v0, w, h):
    sp = max(h - .95 * w, h * .5)
    return [(uc - w / 2, v0), (uc + w / 2, v0), (uc + w / 2, v0 + sp), (uc + .36 * w, v0 + sp + .45 * (h - sp)),
            (uc, v0 + h), (uc - .36 * w, v0 + sp + .45 * (h - sp)), (uc - w / 2, v0 + sp)]


def rect(u0, v0, w, h):
    return [(u0, v0), (u0 + w, v0), (u0 + w, v0 + h), (u0, v0 + h)]


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

    def box(s, cx, y0, cz, w, h, d, m=ST, skip=('-y',)):
        x0, x1, z0, z1, y1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0 + h
        F = {'+x': ((1, 0, 0), [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)]),
             '-x': ((-1, 0, 0), [(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)]),
             '+y': ((0, 1, 0), [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]),
             '-y': ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]),
             '+z': ((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),
             '-z': ((0, 0, -1), [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)])}
        for k, (n, p) in F.items():
            if k not in skip: s.poly(p, m, n)

    def frus(s, cx, y0, cz, a0, b0, a1, b1, h, m, top=False, bot=False):
        Bo = [(cx - a0, y0, cz - b0), (cx + a0, y0, cz - b0), (cx + a0, y0, cz + b0), (cx - a0, y0, cz + b0)]
        T = [(cx - a1, y0 + h, cz - b1), (cx + a1, y0 + h, cz - b1), (cx + a1, y0 + h, cz + b1), (cx - a1, y0 + h, cz + b1)]
        for i in range(4):
            j = (i + 1) % 4
            s.poly([Bo[i], Bo[j], T[j], T[i]], m, ((Bo[i][0] + Bo[j][0]) / 2 - cx, 0, (Bo[i][2] + Bo[j][2]) / 2 - cz))
        if top: s.poly(T, m, (0, 1, 0))
        if bot: s.poly(Bo, m, (0, -1, 0))

    def cone(s, cx, y0, cz, r0, r1, h, n, m, top=False):
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n; am = (a0 + a1) / 2
            s.poly([(cx + r0 * math.cos(a0), y0, cz + r0 * math.sin(a0)), (cx + r0 * math.cos(a1), y0, cz + r0 * math.sin(a1)),
                    (cx + r1 * math.cos(a1), y0 + h, cz + r1 * math.sin(a1)), (cx + r1 * math.cos(a0), y0 + h, cz + r1 * math.sin(a0))], m, (math.cos(am), 0, math.sin(am)))
        if top and r1 > 0: s.poly([(cx + r1 * math.cos(2 * math.pi * i / n), y0 + h, cz + r1 * math.sin(2 * math.pi * i / n)) for i in range(n)], m, (0, 1, 0))

    def tube(s, pts, r, n, m):
        """Prism sweep along a polyline of (x, y, z) points."""
        rings = []
        for i, p in enumerate(pts):
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
            t = Vector((b[0] - a[0], b[1] - a[1], b[2] - a[2])).normalized()
            u = t.cross(Vector((0, 1, 0))); u = u.normalized() if u.length > 1e-4 else Vector((1, 0, 0)); v = t.cross(u)
            rings.append([tuple(Vector(p) + r * (math.cos(2 * math.pi * k / n) * u + math.sin(2 * math.pi * k / n) * v)) for k in range(n)])
        for i in range(len(pts) - 1):
            for k in range(n):
                j = (k + 1) % n; am = 2 * math.pi * (k + .5) / n
                a, b = rings[i], rings[i + 1]
                c = Vector(pts[i]); mid = [(a[k][q] + a[j][q]) / 2 - c[q] for q in range(3)]
                s.poly([a[k], a[j], b[j], b[k]], m, tuple(mid))

    def wall(s, O, U, N, w, h, ops, m=ST, depth=.25):
        """Planar wall w x h with pointed/round openings: ops = [(outline_uv, pane_mat|None, depth|None)]."""
        P = lambda u, v: (O[0] + U[0] * u, O[1] + v, O[2] + U[2] * u)
        lod0 = s.lod == 0
        outer = [(0, 0), (w, 0), (w, h), (0, h)]
        polys = [outer] + ([o[0] for o in ops] if lod0 else [])
        flat = [p for pl in polys for p in pl]
        for a, b, c in geometry.tessellate_polygon([[Vector((u, v, 0)) for u, v in pl] for pl in polys]):
            s.poly([P(*flat[a]), P(*flat[b]), P(*flat[c])], m, N)
        for pts, pm, dp in ops:
            dp = dp or depth
            Q = lambda u, v, d: tuple(P(u, v)[i] - N[i] * d for i in range(3))
            if lod0:
                cu = sum(p[0] for p in pts) / len(pts); cv = sum(p[1] for p in pts) / len(pts)
                for i in range(len(pts)):
                    a, b = pts[i], pts[(i + 1) % len(pts)]
                    du, dv = cu - (a[0] + b[0]) / 2, cv - (a[1] + b[1]) / 2
                    s.poly([Q(*a, 0), Q(*b, 0), Q(*b, dp), Q(*a, dp)], m, (U[0] * du, dv, U[2] * du))
                if pm is not None: s.poly([Q(*p, dp) for p in pts], pm, N)
            elif pm is not None:
                s.poly([Q(*p, -.03) for p in pts], pm, N)   # LOD1: opening = flat decal

    def face(s, cx, cz, hx, hz, N, U, y0, h, ops, m=ST, depth=.25):
        wd = 2 * hx if N[2] else 2 * hz
        O = (cx + N[0] * hx - U[0] * wd / 2, y0, cz + N[2] * hz - U[2] * wd / 2)
        s.wall(O, U, N, wd, h, ops, m, depth)
        return wd


def tower(b, tz):
    L0 = b.lod == 0
    H = 42.0                                                             # body top, above road
    b.frus(0, RIVER, tz, 9.8, 6.8, TX, TZH, -RIVER, ST)                  # battered pier from the river to road level
    inner = -1 if tz > 0 else 1                                          # the side facing the other tower (walkway docks)
    for N, U in SIDES:
        wd = 2 * TX if N[2] else 2 * TZH
        ops = []
        if N[2]:
            ops.append((arch(wd / 2, 0, 6.0, 9.0), DK, 1.2))             # carriageway portal
        for v0, h in ((6, 5.0), (14, 5.0), (22, 5.0), (30, 5.0), (36, 4.5)):
            if N[2] and v0 < 12: continue
            if N[2] == inner and v0 == 36: continue
            for du in (-1, 1):
                ops.append((arch(wd / 2 + du * (4.5 if N[2] else 3.0), v0, 2.2, h), GL, .3))
        b.face(0, tz, TX, TZH, N, U, 0, H, ops, ST, .4)
    for y in (12.0, 24.0, 36.0):
        b.box(0, y, tz, 2 * TX + .6, .9, 2 * TZH + .6, TR)               # string courses
    b.box(0, H, tz, 2 * TX + 1.0, 1.2, 2 * TZH + 1.0, TR)                # cornice
    b.box(0, H + 1.2, tz, 2 * TX + .8, 1.6, 2 * TZH + .8, ST)            # parapet
    b.frus(0, H + 1.6, tz, 7.6, 4.6, 2.2, 1.4, 6.0, SL, top=True)        # pitched slate roof
    for sx in (-1, 1):                                                   # parapet outline lights
        b.box(sx * (TX + .4), H + 2.8, tz, .25, .12, 2 * TZH + .8, LS)
    for sz in (-1, 1):
        b.box(0, H + 2.8, tz + sz * (TZH + .4), 2 * TX + .8, .12, .25, LS)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * 7.2, tz + sz * 4.6
            b.box(cx, H + 1.0, cz, 4.6, .8, 4.6, TR)                     # turret cornice
            b.frus(cx, H + 1.8, cz, 1.95, 1.95, 1.95, 1.95, 11.0, ST)    # turret shaft
            if L0:
                for N, U in SIDES:
                    if not ((N[0] == sx) or (N[2] == sz)): continue      # outer faces only
                    b.face(cx, cz, 2.0, 2.0, N, U, H + 2.0, 9.0, [(arch(2.0, 1.0, .7, 2.6), GL, .2)], ST, .2)
            b.cone(cx, H + 12.8, cz, 2.0, 0.0, 8.0, 8 if L0 else 6, SL)  # pointed spire
            b.cone(cx, H + 20.8, cz, .35, 0.0, .9, 4, GD)                # gilt tip


def walkways(b):
    n = 10; pitch = 2 * ZIN / n
    for wx in (-5.8, 5.8):
        b.box(wx, WALK_Y - .4, 0, 3.2, .4, 2 * (ZIN - .5), TR)            # floor, ends short of the towers
        b.box(wx, WALK_Y + 4.0, 0, 3.4, .4, 2 * (ZIN - .5), TR)           # roof cap
        b.box(wx, WALK_Y + 4.4, 0, 1.2, .1, 2 * (ZIN - .5), LS)          # light strip along the roof
        for N, U in (((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))):   # blue-framed glazing on both sides
            ops = [(rect(.12 + pitch * i, .4, pitch - .24, 3.2), WG, .08) for i in range(n)]
            b.wall((wx + N[0] * 1.5, WALK_Y, ZIN * (1 if N[0] > 0 else -1)), U, N, 2 * ZIN, 4.0, ops, BL, .08)


def deck(b):
    # Two bascule leaves meet at a narrow centre joint; the carriageway is their top surface.
    ZE = 29.8                                                             # leaves stop inside the piers
    for z0, z1 in ((-ZE, -.25), (.25, ZE)):
        zc, ln = (z0 + z1) / 2, z1 - z0
        b.box(0, -1.5, zc, 2 * HALF, 1.25, ln, BL)                        # painted leaf, top at -0.25
        b.box(0, -.25, zc, 2 * HALF - 1.6, .25, ln, DK, ('-y', '+x', '-x'))  # carriageway, top at road level
        for sx in (-1, 1):
            b.box(sx * (HALF - .9), 0, zc, 1.8, .6, ln, TR, ('-y', '-x' if sx > 0 else '+x'))  # raised footway
            b.box(sx * (HALF - .05), .6, zc, .1, .05, ln, LS)              # footway edge light
    for sg in (-1, 1):
        b.tube([(-6.5, -.9, sg * ZE), (6.5, -.9, sg * ZE)], .45, 4, BL)  # visible bascule hinge shaft
    if b.lod == 0:
        for sx in (-1, 1):
            for z0, z1 in ((-ZE, -.25), (.25, ZE)):
                zc, ln = (z0 + z1) / 2, z1 - z0
                b.box(sx * (HALF - .2), 1.35, zc, .16, .14, ln, TR)       # hand rail
                posts = int(ln // 3)
                for i in range(posts + 1):
                    b.box(sx * (HALF - .2), .6, z0 + .2 + i * (ln - .4) / max(1, posts), .12, .8, .12, TR)  # rail posts
            for z in (-20.0, -10.0, 10.0, 20.0):
                b.box(sx * (HALF - .5), 0, z, .25, 4.0, .25, BL)          # lamp post
                b.box(sx * (HALF - .5), 4.0, z, .6, .7, .6, LW, ('-y',))  # warm lantern


def make(lod):
    b = B(lod)
    for tz in (-TZ, TZ): tower(b, tz)
    walkways(b); deck(b)
    bm = b.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    me = bpy.data.meshes.new(f'TowerBridge_LOD{lod}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'TowerBridge_LOD{lod}', me); bpy.context.scene.collection.objects.link(ob)
    for n in MATS: me.materials.append(bpy.data.materials.new(n))
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return ob


def bounds_of(glb):
    with open(glb, 'rb') as f:
        f.read(12); ln, _ = struct.unpack('<II', f.read(8)); j = json.loads(f.read(ln))
    a = [x for x in j['accessors'] if 'min' in x and x['type'] == 'VEC3'][0]
    return a['min'], a['max'], j


def linear_hex(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)


COLORS = tuple(map(linear_hex, ('#a49e92', '#53617d', '#285aa5', '#e9e8e2', '#303943', '#d4a63c', '#2b2d31', '#fff0d0', '#8299ad', '#f4e7c4')))


def run(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ob = make(lod); me = ob.data
    colors = me.color_attributes.new(name='COLOR_0', type='FLOAT_COLOR', domain='CORNER')
    LIGHT_SLOTS = {GL, WG, LW, GD, LS}
    targets = []                                                           # clearing material slots resets indices, so apply them last
    for poly in me.polygons:
        color = COLORS[poly.material_index]
        for loop in poly.loop_indices: colors.data[loop].color = color
        s = poly.material_index
        if s in LIGHT_SLOTS: target = 1                                         # windows, glazing, lamps, gilt, strips glow at night
        elif s == ST:
            y = (poly.center.z - DECK_TOP) / K                                  # real metres above road
            target = 0 if y < 0 else (2 if y < 15 else 3)                       # piers stay plain; tower stone floodlit in two bands
        else: target = 0
        targets.append(target)
    me.color_attributes.active_color = colors
    me.materials.clear()
    for name, emit in (('TowerBridgeAtlas', None), ('TowerBridgeLights', (1.0, .85, .6)),
                       ('TowerBridgeFloodLow', (1.0, .72, .4)), ('TowerBridgeFloodHigh', (1.0, .72, .4))):
        mat = bpy.data.materials.new(name); mat.diffuse_color = (1, 1, 1, 1)
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
        bsdf.inputs['Metallic'].default_value = .08
        bsdf.inputs['Roughness'].default_value = .72
        vertex_color = mat.node_tree.nodes.new('ShaderNodeVertexColor'); vertex_color.layer_name = colors.name
        mat.node_tree.links.new(vertex_color.outputs['Color'], bsdf.inputs['Base Color'])
        if emit:
            bsdf.inputs['Emission Color'].default_value = (*emit, 1)
            bsdf.inputs['Emission Strength'].default_value = 1.0
        me.materials.append(mat)
    for poly, target in zip(me.polygons, targets): poly.material_index = target
    me.calc_loop_triangles(); tris = len(me.loop_triangles)
    limit = 8000 if lod == 0 else 4000
    assert tris <= limit, f'LOD{lod} triangle budget exceeded: {tris} > {limit}'
    glb = os.path.join(OUT, f'towerbridge.lod{lod}.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    mn, mx, doc = bounds_of(glb)
    assert -3.95 <= mn[0] and mx[0] <= 3.95 and -17.5 <= mn[2] and mx[2] <= 17.5, (mn, mx)   # inside the frozen envelope
    assert -1.05 < mn[1] and mx[1] <= 31.0 and abs(mx[1] - 30.7) < .4, (mn, mx)
    assert set(x['name'] for x in doc['materials']) <= {'TowerBridgeAtlas', 'TowerBridgeLights', 'TowerBridgeFloodLow', 'TowerBridgeFloodHigh'} and doc['materials'][0]['name'] == 'TowerBridgeAtlas', doc['materials']
    assert not doc.get('images') and not doc.get('textures'), 'direct PBR GLB must not contain texture assets'
    primitive = doc['meshes'][0]['primitives'][0]
    assert 'COLOR_0' in primitive['attributes'] and 'NORMAL' in primitive['attributes'] and 'indices' in primitive
    assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == len(doc['materials']), 'one mesh, one primitive per material'
    # Reimport the exported GLB so bounds, normals, indices and triangle counts are checked after serialization.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    meshes = [o.data for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 1, f'LOD{lod} should reimport as one mesh'
    imported = meshes[0]; imported.calc_loop_triangles()
    assert len(imported.loop_triangles) == tris, f'LOD{lod} changed triangle count on reimport'
    assert imported.color_attributes and len(imported.color_attributes) >= 1
    color_data = imported.color_attributes.active_color.data
    assert max(c.color[0] for c in color_data) - min(c.color[0] for c in color_data) > .1
    assert all(math.isfinite(c) for v in imported.vertices for c in v.co)
    assert all(.99 <= loop.normal.length <= 1.01 for loop in imported.loops), 'invalid loop normal'
    assert all(0 <= i < len(imported.vertices) for tri in imported.loop_triangles for i in tri.vertices), 'invalid index'
    tri_keys = [tuple(sorted(tuple(round(float(c), 5) for c in imported.vertices[i].co) for i in tri.vertices)) for tri in imported.loop_triangles]
    assert len(tri_keys) == len(set(tri_keys)), 'duplicate triangles may cause z-fighting'
    return dict(lod=lod, tris=tris, verts=len(imported.vertices), min=[round(x, 3) for x in mn], max=[round(x, 3) for x in mx],
                bytes=os.path.getsize(glb), mats=[x['name'] for x in doc['materials']], images=0, reimport='ok', glb=glb)


if __name__ == '__main__':
    print('RESULT', json.dumps([run(0), run(1)], indent=1))
