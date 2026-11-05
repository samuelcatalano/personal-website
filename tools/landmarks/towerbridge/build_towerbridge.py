"""Tower Bridge (London): two Victorian Gothic towers, high-level walkways, bascule deck, suspension side spans, abutments.
Procedural bmesh build, vertex-colour PBR atlas, direct GLB export.
Run: blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
All coordinates are authored in glTF space (Y up, metres) in the SAME local frame as the procedural createTowerBridge group
(origin = river centreline, x across the carriageway, z along the crossing, towers at z = +-9.5); V() maps them to Blender (Z up)."""
import bpy, bmesh, math, os, json, struct
from mathutils import Vector, geometry

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'processed', 'landmarks'))
os.makedirs(OUT, exist_ok=True)
ST, SL, BL, TR, GL, GD, DK, LW, WG = range(9)   # authoring slots
MATS = ['stone', 'slate', 'blue', 'trim', 'glass', 'gilt', 'deck', 'lampw', 'wglass']
V = lambda x, y, z: Vector((x, -z, y))
SIDES = [((0, 0, 1), (1, 0, 0)), ((0, 0, -1), (-1, 0, 0)), ((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))]
TZ = 9.5                 # tower axis z (+-)
HX, HZ = 2.6, 2.4        # tower body half extents
DECK_TOP = 5.2


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
    b.frus(0, -.8, tz, 3.4, 3.1, 2.85, 2.6, 2.0, ST)                      # pier: battered stone foot
    ROWS = [(3.6, 2.6), (7.2, 3.0), (11.4, 3.0), (15.2, 3.0), (19.4, 2.4)]
    Y0, Y1 = 1.2, 22.4
    inner = -1 if tz > 0 else 1                                              # z direction towards the other tower (walkway side)
    for N, U in SIDES:
        wd = 2 * HX if N[2] else 2 * HZ
        ops = []
        if N[2]:                                                             # road faces: tall portal for the carriageway
            ops.append((arch(wd / 2, DECK_TOP - Y0, 3.4, 4.4), DK, 1.2))
        for i, (y0, h) in enumerate(ROWS):
            if N[2] and i < 2: continue
            if N[2] == inner and i == 4: continue                            # walkway docks here
            for du in (-1, 1):
                ops.append((arch(wd / 2 + du * (1.05 if N[2] else 1.0), y0 - Y0, .85, h - .5), GL, .3))
        b.face(0, tz, HX, HZ, N, U, Y0, Y1 - Y0, ops, ST, .3)
    for y in (10.8, 14.8, 18.8):                                        # string courses: white-capped stone banding
        b.box(0, y, tz, 5.8, .22, 5.4, TR)
    b.box(0, 22.4, tz, 6.0, .5, 5.6, TR)                                     # crown corbel slab
    b.box(0, 22.9, tz, 5.4, .6, 5.0, ST)                                     # parapet
    if L0:
        for N, U in SIDES:                                                   # merlons / machicolation blocks
            wd = 5.4 if N[2] else 5.0
            for k in range(3):
                u = -wd / 2 + (k + .5) * wd / 3
                b.box(N[0] * 2.72 + U[0] * u, 23.5, tz + N[2] * 2.52 + U[2] * u, .5 if N[2] else .3, .3, .3 if N[2] else .5, TR)
    # steep slate roof, dormers, lantern, gilt finial
    b.frus(0, 23.5, tz, 2.7, 2.5, 2.0, 1.85, 1.2, SL)
    b.frus(0, 24.7, tz, 2.0, 1.85, .55, .5, 6.4, SL)
    b.frus(0, 31.1, tz, .55, .5, .3, .3, .9, ST, top=True)
    b.frus(0, 32.0, tz, .26, .26, .0, .0, 3.2, GD)
    for N, U in SIDES:
        c = (N[0] * 1.9, tz + N[2] * 1.9)
        b.box(c[0], 24.0, c[1], .85 if N[2] else .8, 1.3, .8 if N[2] else .85, ST)
        wd = .85 if N[2] else .85
        b.wall((c[0] + N[0] * .4 - U[0] * wd / 2, 24.1, c[1] + N[2] * .4 - U[2] * wd / 2), U, N, wd, 1.1, [(arch(wd / 2, .1, .5, .85), GL, .12)], ST, .12)
        b.frus(c[0], 25.3, c[1], .5 if N[2] else .45, .45 if N[2] else .5, 0, 0, 1.0, SL)
    # corner turrets with lancet slits, cornice, slender cone and gilt tip
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * 2.55, tz + sz * 2.45
            for N, U in SIDES:
                if not ((N[0] == sx) or (N[2] == sz)): continue
                wd = 1.2 if N[2] else 1.1
                ops = [(arch(wd / 2, y0 - 1.2, .36, 1.7), DK, .2) for y0 in (4.4, 8.6, 12.8, 17.0, 20.4)] if L0 else [(arch(wd / 2, y0 - 1.2, .36, 1.7), DK, .2) for y0 in (8.6, 17.0)]
                b.face(cx, cz, .6, .55, N, U, 1.2, 22.8, ops, ST, .2)
            b.box(cx, 24.0, cz, 1.45, .35, 1.35, TR)
            b.cone(cx, 24.35, cz, .8, .08, 4.4, 8 if L0 else 6, SL)
            b.cone(cx, 28.75, cz, .09, .0, 1.0, 4, GD)


def walkways(b):
    for wx in (-1.5, 1.5):
        Z0 = 7.1
        b.box(wx, 19.0, 0, 1.2, 1.3, 2 * Z0, BL, ('-y', '+x', '-x', '+z', '-z'))
        b.box(wx, 20.3, 0, 1.45, .2, 2 * Z0 + .2, TR, ('-y',))
        b.box(wx, 18.9, 0, 1.3, .12, 2 * Z0, TR, ('-y', '+y'))
        n = 11; pitch = 2 * Z0 / n
        for N, U in (((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))):
            ops = [(rect(.14 + pitch * i, .3, pitch - .28, .75), WG, .08) for i in range(n)]
            b.wall((wx + N[0] * .6, 19.0, Z0 * (1 if N[0] > 0 else -1)), U, N, 2 * Z0, 1.3, ops, BL, .08)


def deck(b):
    # Two independent bascule leaves meet at a narrow, visible centre joint.
    segs = [(-17, -11.9), (-7.1, -.09), (.09, 7.1), (11.9, 17)]
    for z0, z1 in segs:
        zc, ln = (z0 + z1) / 2, z1 - z0
        b.box(0, 4.0, zc, 6.0, 1.0, ln, BL)
        b.box(0, 5.0, zc, 5.0, .2, ln, DK, ('-y', '+x', '-x'))               # carriageway (deck top = 5.2)
        for sx in (-1, 1):
            b.box(sx * 2.75, 5.0, zc, .5, .28, ln, TR, ('-y', '-x' if sx > 0 else '+x'))   # raised footway
            b.box(sx * 2.88, 6.15, zc, .2, .2, ln, TR)                       # hand rail
            if b.lod == 0:
                k = int(ln // 3)
                for i in range(k + 1):
                    z = z0 + .2 + i * (ln - .4) / k
                    b.box(sx * 2.88, 5.28, z, .12, .9, .12, TR)              # rail posts
                    b.box(sx * 3.04, 4.1, z, .08, .8, .12, TR)               # girder stiffeners
    if b.lod == 0:
        for sg in (-1, 1):
            z = sg * 7.1
            b.tube([(-2.8, 4.25, z), (2.8, 4.25, z)], .18, 4, BL)            # visible bascule hinge shaft
            for sx in (-1, 1):
                b.box(sx * 2.6, 3.72, z, .48, .2, .52, TR)
                b.tube([(sx * 2.45, 3.8, z + sg * .2), (sx * 2.45, 4.55, z + sg * .5)], .08, 4, TR)  # hydraulic ram
    # deck lamps: pole + warm lantern head, light by night
    for sx in (-1, 1):
        for z in (-16.2, -14.2, -12.6, -6, -3, 3, 6, 12.6, 14.2, 16.2):
            if b.lod == 0: b.box(sx * 2.88, 5.28, z, .08, 1.9, .08, BL)
            b.box(sx * 2.88, 7.0 if b.lod == 0 else 5.3, z, .26, .32, .26, LW, ('-y',))
            if b.lod == 0: b.frus(sx * 2.88, 7.32, z, .17, .17, .02, .02, .18, TR)


def abutments(b):
    for sg in (-1, 1):
        az = 16 * sg
        b.box(0, 0, az, 7.4, 4.0, 3.0, ST, ('-y', '+z' if sg > 0 else '-z'))
        N = (0, 0, sg); U = (sg, 0, 0)                                       # outward face: three blind arches
        b.face(0, az, 3.7, 1.5, N, U, 0, 4.0, [(arch(1.5 + k * 2.2, .4, 1.2, 2.8), DK, .3) for k in range(3)], ST, .3)
        for sx in (-1, 1):
            pz = 16.6 * sg
            b.box(sx * 3.25, 4.0, pz, .9, 6.0, .9, ST)                          # chain anchor post
            b.box(sx * 3.25, 4.3, pz, 1.0, .18, 1.0, TR)
            b.box(sx * 3.25, 8.4, pz, 1.0, .18, 1.0, TR)
            b.cone(sx * 3.25, 10, pz, .62, .04, 1.7, 8 if b.lod == 0 else 4, SL)


def chains(b):
    nseg = 8 if b.lod == 0 else 6
    for sx in (-1, 1):
        for dr in (-1, 1):
            y0, y1, z0, z1 = 18.4, 10.0, dr * 12.1, dr * 16.6
            pts = [(sx * 3.25, y1 + (y0 - y1) * (1 - i / nseg) ** 2, z0 + (z1 - z0) * i / nseg) for i in range(nseg + 1)]
            b.tube(pts, .12, 4, BL)
            k = 4 if b.lod == 0 else 2
            for i in range(k):
                u = (i + .5) / k; p = pts[min(nseg, max(1, round(u * nseg)))]
                b.box(sx * 3.25, 5.28, p[2], .07, p[1] - 5.28, .07, TR)       # hangers
            b.box(sx * 3.25, 18.0, dr * 12.1, .5, .5, .4, TR)                  # bracket plate at the tower
            b.box(sx * 3.25, 9.7, dr * 16.6, .4, .4, .5, TR)                   # anchor plate on the post


def make(lod):
    b = B(lod)
    for tz in (-TZ, TZ): tower(b, tz)
    walkways(b); deck(b); abutments(b); chains(b)
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


COLORS = tuple(map(linear_hex, ('#a49e92', '#53617d', '#285aa5', '#e9e8e2', '#303943', '#d4a63c', '#2b2d31', '#fff0d0', '#8299ad')))


def run(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ob = make(lod); me = ob.data
    colors = me.color_attributes.new(name='COLOR_0', type='FLOAT_COLOR', domain='CORNER')
    for poly in me.polygons:
        color = COLORS[poly.material_index]
        for loop in poly.loop_indices: colors.data[loop].color = color
        poly.material_index = 0
    me.color_attributes.active_color = colors
    me.materials.clear()
    mat = bpy.data.materials.new('TowerBridgeAtlas'); mat.diffuse_color = (1, 1, 1, 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Metallic'].default_value = .08
    bsdf.inputs['Roughness'].default_value = .72
    vertex_color = mat.node_tree.nodes.new('ShaderNodeVertexColor'); vertex_color.layer_name = colors.name
    mat.node_tree.links.new(vertex_color.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
    me.calc_loop_triangles(); tris = len(me.loop_triangles)
    limit = 8000 if lod == 0 else 4000
    assert tris <= limit, f'LOD{lod} triangle budget exceeded: {tris} > {limit}'
    glb = os.path.join(OUT, f'towerbridge.lod{lod}.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    mn, mx, doc = bounds_of(glb)
    assert -4.4 <= mn[0] and mx[0] <= 4.4 and -18 <= mn[2] and mx[2] <= 18, (mn, mx)
    assert -1.05 < mn[1] and mx[1] <= 35.5 and abs(mx[1] - 35.2) < .3, (mn, mx)
    assert len(doc['materials']) == 1 and doc['materials'][0]['name'] == 'TowerBridgeAtlas'
    assert not doc.get('images') and not doc.get('textures'), 'direct PBR GLB must not contain texture assets'
    primitive = doc['meshes'][0]['primitives'][0]
    assert 'COLOR_0' in primitive['attributes'] and 'NORMAL' in primitive['attributes'] and 'indices' in primitive
    assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1
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
