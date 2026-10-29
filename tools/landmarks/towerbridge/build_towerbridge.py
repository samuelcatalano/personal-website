"""Tower Bridge (London): two Victorian Gothic towers, high-level walkways, bascule deck, suspension side spans, abutments.
Procedural bmesh build, Cycles bake (albedo / AO / roughness-metal / night emissive), glTF export.
Run: blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
All coordinates are authored in glTF space (Y up, metres) in the SAME local frame as the procedural createTowerBridge group
(origin = river centreline, x across the carriageway, z along the crossing, towers at z = +-9.5); V() maps them to Blender (Z up)."""
import bpy, bmesh, math, os, time, json, struct
import numpy as np
from mathutils import Vector, geometry

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'models', 'source', 'towerbridge'))
TEX = os.path.join(OUT, 'tex')
os.makedirs(TEX, exist_ok=True)
SIZE = 1024
ST, SL, BL, TR, GL, GD, DK, LW, LC, WG = range(10)   # authoring slots
MATS = ['stone', 'slate', 'blue', 'trim', 'glass', 'gilt', 'deck', 'lampw', 'lampc', 'wglass']
ROUGH = [.85, .6, .45, .5, .08, .3, .9, .4, .4, .08]
METAL = [0, 0, .5, .2, 0, 1, 0, 0, 0, 0]
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
            for k in range(5):
                u = -wd / 2 + (k + .5) * wd / 5
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
    segs = [(-17, -11.9), (-7.1, 7.1), (11.9, 17)]
    for z0, z1 in segs:
        zc, ln = (z0 + z1) / 2, z1 - z0
        b.box(0, 4.0, zc, 6.0, 1.0, ln, BL)
        b.box(0, 5.0, zc, 5.0, .2, ln, DK, ('-y', '+x', '-x'))               # carriageway (deck top = 5.2)
        for sx in (-1, 1):
            b.box(sx * 2.75, 5.0, zc, .5, .28, ln, TR, ('-y', '-x' if sx > 0 else '+x'))   # raised footway
            b.box(sx * 2.88, 6.15, zc, .2, .2, ln, TR)                       # hand rail
            if b.lod == 0:
                k = int(ln // 2)
                for i in range(k + 1):
                    z = z0 + .2 + i * (ln - .4) / k
                    b.box(sx * 2.88, 5.28, z, .12, .9, .12, TR)              # rail posts
                    b.box(sx * 3.04, 4.1, z, .08, .8, .12, TR)               # girder stiffeners
    # deck lamps: pole + warm lantern head, light by night
    for sx in (-1, 1):
        for z in (-16.2, -14.2, -12.6, -6, -3, 0, 3, 6, 12.6, 14.2, 16.2):
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
    nseg = 12 if b.lod == 0 else 8
    for sx in (-1, 1):
        for dr in (-1, 1):
            y0, y1, z0, z1 = 18.4, 10.0, dr * 12.1, dr * 16.6
            pts = [(sx * 3.25, y1 + (y0 - y1) * (1 - i / nseg) ** 2, z0 + (z1 - z0) * i / nseg) for i in range(nseg + 1)]
            b.tube(pts, .12, 6 if b.lod == 0 else 4, BL)
            for i in range(1, nseg + 1):                                       # chain lights: cool white beads along the span
                if b.lod == 1 and i % 2: continue
                p = pts[i]; b.box(p[0], p[1] + .13, p[2], .16, .16, .16, LC, ('-y',))
            k = 6 if b.lod == 0 else 3
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
    bm.loops.layers.uv.new('UVMap')
    me = bpy.data.meshes.new(f'TowerBridge_LOD{lod}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'TowerBridge_LOD{lod}', me); bpy.context.scene.collection.objects.link(ob)
    for n in MATS: me.materials.append(bpy.data.materials.new(n))
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    # tiny lit parts (lamp heads, chain beads) get their UV footprint scaled up so the emissive always covers >= ~6 px
    uvd = me.uv_layers.active.data
    for pl in me.polygons:
        if pl.material_index not in (LW, LC): continue
        li = list(pl.loop_indices); uvs = [uvd[i].uv.copy() for i in li]
        c = sum(uvs, uvs[0] * 0) / len(uvs)
        for i, u in zip(li, uvs): uvd[i].uv = c + (u - c) * 3.0
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=.006, rotate=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------- baking
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda v: v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


STONE_RAMP = ('#8d887d', '#a9a193')
BLUE_RAMP = ('#2352a0', '#2f64b4')
COL = {'trim': '#e9e8e2', 'glass': '#1c2630', 'gilt': '#d4a63c', 'deck': '#2b2d31', 'lampw': '#fff0d0', 'lampc': '#dce8ff', 'wglass': '#7f98ad'}


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
        if name == 'stone':
            c = ramp(noise(3, 5, (1, 1, .4)), *STONE_RAMP)
            c = mul(c, ramp(noise(40, 2), '#dcdcdc', '#ffffff'))
            lines = math_('MULTIPLY_ADD', math_('LESS_THAN', math_('FRACT', math_('DIVIDE', Z, .6)), .05), -.2, 1)   # horizontal courses
            c = mul(c, lines)
            wet = node('ShaderNodeMapRange'); wet.inputs[1].default_value = 0; wet.inputs[2].default_value = 3.5; wet.inputs[3].default_value = .72; wet.inputs[4].default_value = 1; link(Z, wet.inputs[0])
            return mul(c, wet.outputs[0])
        if name == 'slate': return ramp(noise(25, 4), '#46536b', '#5f6f8c')
        if name == 'blue': return ramp(noise(30, 2), *BLUE_RAMP)
        if name == 'deck':
            base = ramp(noise(60, 3), '#26282c', '#35383d')
            dash = math_('MULTIPLY', math_('LESS_THAN', math_('ABSOLUTE', X), .07), math_('LESS_THAN', math_('FRACT', math_('DIVIDE', Y, 4.0)), .5))
            mx = node('ShaderNodeMixRGB'); link(base, mx.inputs['Color1']); mx.inputs['Color2'].default_value = lin('#dedede'); link(dash, mx.inputs['Fac'])
            return mx.outputs['Color']
        return None
    if chan == 'ALB':
        s = albedo()
        if s is not None: link(s, em.inputs['Color'])
        else: em.inputs['Color'].default_value = lin(COL[name])
    else:  # EMI: night lighting (floodlit warm towers, lit windows, blue/white chain and walkway lights, deck lamps)
        if name == 'stone':
            warm = node('ShaderNodeRGB'); warm.outputs[0].default_value = (1, .66, .36, 1)
            link(mul(albedo(), warm.outputs[0]), em.inputs['Color'])
            mr = node('ShaderNodeMapRange'); mr.inputs[1].default_value = 0; mr.inputs[2].default_value = 26; mr.inputs[3].default_value = .30; mr.inputs[4].default_value = .12
            link(Z, mr.inputs[0]); link(mr.outputs[0], em.inputs['Strength'])
        elif name == 'trim': em.inputs['Color'].default_value = rgb('#ffc98a'); em.inputs['Strength'].default_value = .28
        elif name == 'slate': link(albedo(), em.inputs['Color']); em.inputs['Strength'].default_value = .1
        elif name == 'blue': em.inputs['Color'].default_value = rgb('#3a7be0'); em.inputs['Strength'].default_value = .14
        elif name == 'gilt': em.inputs['Color'].default_value = rgb('#e8b04a'); em.inputs['Strength'].default_value = .25
        elif name == 'glass':
            vo = node('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = .35; link(P, vo.inputs['Vector'])
            wn = node('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; link(vo.outputs['Position'], wn.inputs['Vector'])
            lit = math_('GREATER_THAN', wn.outputs['Value'], .22)
            em.inputs['Color'].default_value = lin('#ffc46b'); link(math_('MULTIPLY_ADD', lit, .55, .1), em.inputs['Strength'])
        elif name == 'wglass': em.inputs['Color'].default_value = lin('#eaf2ff'); em.inputs['Strength'].default_value = .75
        elif name == 'lampw': em.inputs['Color'].default_value = lin('#fff0d0'); em.inputs['Strength'].default_value = 1.0
        elif name == 'lampc': em.inputs['Color'].default_value = lin('#cfe0ff'); em.inputs['Strength'].default_value = 1.0
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
    # verify: every lit-type pane (lamp / beads) must be emissive at its UV centre; windows only report their lit share (random by design)
    e = px(emi); uvd = ob.data.uv_layers.active.data; tot = {}; lit = {}
    for pl in ob.data.polygons:
        if pl.material_index not in (GL, WG, LW, LC): continue
        uvs = [uvd[i].uv for i in pl.loop_indices]; c = sum(uvs, uvs[0] * 0) / len(uvs)
        ok = e[min(SIZE - 1, int(c[1] * SIZE)), min(SIZE - 1, int(c[0] * SIZE)), :3].max() > .05
        n = MATS[pl.material_index]; tot[n] = tot.get(n, 0) + 1; lit[n] = lit.get(n, 0) + ok
    print('LITCHECK', lod, {n: f'{lit[n]}/{tot[n]}' for n in tot})
    p = lambda n: os.path.join(TEX, f'lod{lod}_{n}.png')
    save(alb, p('albedo')); save(emi, p('emissive')); save(ormi, p('orm'))
    # export material: standard ORM packing (R = baked AO, G = roughness, B = metalness)
    for i in range(len(ob.data.materials)): ob.data.materials.pop(index=0)
    m = bpy.data.materials.new('TowerBridgeAtlas'); m.use_nodes = True; m.use_backface_culling = True; N = m.node_tree.nodes; L = m.node_tree.links; N.clear()
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
    glb = os.path.join(OUT, f'towerbridge.lod{lod}.raw.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    me = ob.data; me.calc_loop_triangles()
    mn, mx, j = bounds_of(glb)
    return dict(lod=lod, tris=len(me.loop_triangles), verts=len(me.vertices), min=[round(x, 3) for x in mn], max=[round(x, 3) for x in mx], bake_s=round(bt, 1),
                images=len(j.get('images', [])), mats=[x['name'] for x in j['materials']], glb=glb)


if __name__ == '__main__':
    print('RESULT', json.dumps([run(0), run(1)], indent=1))
