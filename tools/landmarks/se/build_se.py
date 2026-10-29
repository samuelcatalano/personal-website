"""Catedral da Se (Sao Paulo): neo-gothic nave, buttresses, green copper dome on a drum, two spired west towers.
Procedural bmesh build, Cycles bake (albedo / AO / roughness-metal / night emissive), glTF export. Same pipeline as tools/landmarks/bigben.
Run: blender -b --python tools/landmarks/se/build_se.py
Authored in glTF space (Y up, metres) = the local frame of the procedural `se` group in js/world/landmark-geometry.js; V() maps to Blender (Z up)."""
import bpy, bmesh, math, os, time, json, struct
import numpy as np
from mathutils import Vector, geometry

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'models', 'source', 'se'))
TEX = os.path.join(OUT, 'tex')
os.makedirs(TEX, exist_ok=True)
SIZES = {0: 1024, 1: 512}
ST, TR, SL, VD, GD, GL, DR = range(7)   # authoring slots
MATS = ['stone', 'trim', 'slate', 'verd', 'gold', 'glass', 'door']
ROUGH = [.88, .8, .65, .55, .3, .1, .7]
METAL = [0, 0, 0, 0, 1, 0, 0]
STONES = {'stone': ('#a89f8c', '#c4bba6'), 'trim': ('#cdc5b0', '#e0d9c6')}
V = lambda x, y, z: Vector((x, -z, y))
sin, cos, pi = math.sin, math.cos, math.pi


def arch(uc, v0, w, h):
    sp = max(h - .95 * w, h * .5)
    return [(uc - w / 2, v0), (uc + w / 2, v0), (uc + w / 2, v0 + sp), (uc + .36 * w, v0 + sp + .45 * (h - sp)),
            (uc, v0 + h), (uc - .36 * w, v0 + sp + .45 * (h - sp)), (uc - w / 2, v0 + sp)]


def circ(uc, vc, r, n):
    return [(uc + r * cos(2 * pi * i / n), vc + r * sin(2 * pi * i / n)) for i in range(n)]


class B:
    def __init__(s, lod):
        s.bm = bmesh.new(); s.lod = lod; s.hi = lod == 0

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

    def lathe(s, cx, cz, prof, seg, m, a0=0):
        """Surface of revolution around the vertical axis; prof = [(r, y)] bottom->top, outward normal."""
        for k in range(seg):
            a, b = a0 + 2 * pi * k / seg, a0 + 2 * pi * (k + 1) / seg; am = (a + b) / 2
            for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
                if abs(r0 - r1) < 1e-9 and abs(y0 - y1) < 1e-9: continue
                nr, ny = y1 - y0, -(r1 - r0); pt = lambda r, y, t: (cx + r * sin(t), y, cz + r * cos(t))
                s.poly([pt(r0, y0, a), pt(r0, y0, b), pt(r1, y1, b), pt(r1, y1, a)], m, (nr * sin(am), ny, nr * cos(am)))

    def cap(s, cx, cz, r, y, seg, m, a0=0, up=True):
        s.poly([(cx + r * sin(a0 + 2 * pi * k / seg), y, cz + r * cos(a0 + 2 * pi * k / seg)) for k in range(seg)], m, (0, 1 if up else -1, 0))

    def beam(s, a, b, r, m, sides=4):
        a, b = Vector(a), Vector(b); d = (b - a).normalized()
        t = Vector((0, 0, 1)) if abs(d.y) > .9 else Vector((0, 1, 0))
        u = d.cross(t).normalized() * r; v = d.cross(u).normalized() * r
        ring = lambda c: [c + u * cos(2 * pi * k / sides + pi / sides) + v * sin(2 * pi * k / sides + pi / sides) for k in range(sides)]
        ra, rb = ring(a), ring(b)
        for k in range(sides):
            j = (k + 1) % sides; mid = (ra[k] + ra[j]) / 2 - a
            s.poly([tuple(ra[k]), tuple(ra[j]), tuple(rb[j]), tuple(rb[k])], m, (mid.x, mid.y, mid.z))

    def gable(s, x0, x1, y0, y1, z0, z1, m):
        """Roof of two slopes over x0..x1 (ridge at x centre, height y1) along z0..z1 (hip-less; ends open)."""
        xm = (x0 + x1) / 2
        s.poly([(x0, y0, z0), (xm, y1, z0), (xm, y1, z1), (x0, y0, z1)], m, (-1, 1, 0))
        s.poly([(x1, y0, z0), (xm, y1, z0), (xm, y1, z1), (x1, y0, z1)], m, (1, 1, 0))

    def plate(s, O, U, N, polys, m, off=.03, skirt=False):
        """Flat polygon (outer, holes...) lying on a wall plane, lifted off by `off`. skirt: close the outer edge back to the wall."""
        P = lambda u, v, o=off: (O[0] + U[0] * u + N[0] * o, O[1] + v, O[2] + U[2] * u + N[2] * o)
        flat = [p for pl in polys for p in pl]
        for a, b, c in geometry.tessellate_polygon([[Vector((u, v, 0)) for u, v in pl] for pl in polys]):
            s.poly([P(*flat[a]), P(*flat[b]), P(*flat[c])], m, N)
        if skirt:
            pl = polys[0]
            for i in range(len(pl)):
                a, b = pl[i], pl[(i + 1) % len(pl)]
                du, dv = b[0] - a[0], b[1] - a[1]
                s.poly([P(*a, 0), P(*b, 0), P(*b), P(*a)], m, (U[0] * dv + 0, -du, U[2] * dv))   # outward-in-plane normal (dv, -du) of a CCW outline

    def wall(s, O, U, N, w, h, ops, m=ST, depth=.3, outer=None, y0=0):
        """Planar wall with pointed/round openings: ops = [(outline_uv, pane_mat|None, depth|None)]. LOD1: openings become flat decals."""
        P = lambda u, v: (O[0] + U[0] * u, O[1] + y0 + v, O[2] + U[2] * u)
        polys = [outer or [(0, 0), (w, 0), (w, h), (0, h)]] + ([o[0] for o in ops] if s.hi else [])
        flat = [p for pl in polys for p in pl]
        for a, b, c in geometry.tessellate_polygon([[Vector((u, v, 0)) for u, v in pl] for pl in polys]):
            s.poly([P(*flat[a]), P(*flat[b]), P(*flat[c])], m, N)
        for pts, pm, dp in ops:
            dp = dp or depth
            Q = lambda u, v, d: tuple(P(u, v)[i] - N[i] * d for i in range(3))
            if s.hi:
                cu = sum(p[0] for p in pts) / len(pts); cv = sum(p[1] for p in pts) / len(pts)
                for i in range(len(pts)):
                    a, b = pts[i], pts[(i + 1) % len(pts)]
                    du, dv = cu - (a[0] + b[0]) / 2, cv - (a[1] + b[1]) / 2
                    s.poly([Q(*a, 0), Q(*b, 0), Q(*b, dp), Q(*a, dp)], m, (U[0] * du, dv, U[2] * du))
                if pm is not None: s.poly([Q(*p, dp) for p in pts], pm, N)
            elif pm is not None:
                s.poly([Q(*p, -.03) for p in pts], pm, N)


def lancet(u, v0, w, h, pane=GL, depth=None): return (arch(u, v0, w, h), pane, depth)


def frame(b, O, U, N, u, v0, w, h, grow=.4):
    """Stone archivolt around a lancet (LOD0 only)."""
    if not b.hi: return
    b.plate(O, U, N, [arch(u, v0 - .05, w + grow, h + grow * .7), arch(u, v0, w, h)], TR, .07, True)
    if h >= 4.5 and w < 1.5:   # stone mullion up the middle of tall lancets
        P = lambda v: (O[0] + U[0] * u - N[0] * .1, O[1] + v, O[2] + U[2] * u - N[2] * .1)
        b.beam(P(v0), P(v0 + h * .72), .035, TR, 4)


# ---------------------------------------------------------------- geometry
DT = pi / 16


def building(b):
    hi = b.hi
    # --- lower body (30 x 12 x 14); front handled by wall pieces, back + sides by windowed walls
    b.box(0, 0, 0, 30, 12, 14, ST, ('-y', '+y', '+z', '+x', '-x', '-z'))
    b.box(0, 11.8, -.15, 30.6, .35, 14.3, TR, ('-y', '+z'))
    # aisle lean-to roofs (slate), pitched against the clerestory
    for sx in (-1, 1):
        x0, x1 = sx * 7.8, sx * 15.2
        b.poly([(x0, 13.2, -7.3), (x1, 12.15, -7.3), (x1, 12.15, 1.0), (x0, 13.2, 1.0)], SL, (0, 1, 0))
    # clerestory (15.6 wide), gable roof over the nave
    b.box(0, 12, 0, 15.6, 3.5, 14, ST, ('-y', '+y', '+z', '+x', '-x', '-z'))
    b.gable(-8.1, 8.1, 15.4, 19.55, -7.2, 7.2, SL)
    # --- front facade between the towers: portal, lancets, rose window, stone gable
    OF, UF, NF = (-8, 0, 7), (1, 0, 0), (0, 0, 1)
    rose = (circ(8, 11.6, 1.45, 24 if hi else 12), GL, .25)
    pent = [(0, 0), (16, 0), (16, 15.5), (15.8, 15.5), (8, 19.5), (.2, 15.5), (0, 15.5)]
    b.wall(OF, UF, NF, 16, 19.5, [lancet(8, 1.5, 3.2, 6.4, DR, .7), lancet(3, 3, 1.3, 4.8), lancet(13, 3, 1.3, 4.8), rose], ST, .3, pent)
    frame(b, OF, UF, NF, 8, 1.5, 3.2, 6.4, .7); frame(b, OF, UF, NF, 3, 3, 1.3, 4.8); frame(b, OF, UF, NF, 13, 3, 1.3, 4.8)
    if hi:   # portal inner arch, string courses, gable coping
        b.plate(OF, UF, NF, [arch(8, 1.4, 4.4, 7.4), arch(8, 1.5, 3.2, 6.4)], TR, .12, True)
        b.box(0, 8.55, 7.1, 16, .22, .3, TR, ('-y',)); b.box(0, 13.25, 7.1, 16, .22, .3, TR, ('-y',))
    # rose window tracery: ring + spokes in stone in front of the lit glass
    C = (0, 11.6, 7.04)
    for k in range(6 if hi else 3):
        a = k * pi / (6 if hi else 3); d = (cos(a) * 1.46, sin(a) * 1.46)
        b.beam((C[0] - d[0], C[1] - d[1], C[2]), (C[0] + d[0], C[1] + d[1], C[2]), .045 if hi else .06, TR, 4)
    n = 12 if hi else 6
    if hi:
        for k in range(n):
            a0, a1 = 2 * pi * k / n, 2 * pi * (k + 1) / n
            b.beam((C[0] + .75 * cos(a0), C[1] + .75 * sin(a0), C[2]), (C[0] + .75 * cos(a1), C[1] + .75 * sin(a1), C[2]), .04, TR, 4)
            b.beam((C[0] + 1.5 * cos(a0), C[1] + 1.5 * sin(a0), C[2]), (C[0] + 1.5 * cos(a1), C[1] + 1.5 * sin(a1), C[2]), .09, TR, 4)
    # outer facade corners (x 14..15, between tower and aisle edge)
    for sx in (-1, 1):
        x0 = 14 if sx > 0 else -15
        b.wall((x0, 0, 7), (1, 0, 0), (0, 0, 1), 1, 12, [], ST)
    # --- stepped stairs (heights 1.5 .. .3 descending outwards)
    for i in range(5):
        b.box(0, 0, 7.5 + i * .75, 10 - i * .4, 1.5 - i * .3, .75, TR, ('-y', '-z'))
    # --- back wall
    for_back = [lancet(11, 3, 1.3, 5), lancet(19, 3, 1.3, 5)]
    b.wall((-15, 0, -7), (1, 0, 0), (0, 0, -1), 30, 12, for_back, ST)
    for u in (11, 19): frame(b, (-15, 0, -7), (1, 0, 0), (0, 0, -1), u, 3, 1.3, 5)
    b.wall((-7.8, 0, -7), (1, 0, 0), (0, 0, -1), 15.6, 7.5, [], ST, .3, [(0, 12), (15.6, 12), (15.6, 15.5), (15.4, 15.5), (7.8, 19.5), (.2, 15.5), (0, 15.5)])
    # --- side walls: windowed lower wall, buttresses with pinnacles, clerestory lancets
    for sx in (-1, 1):
        O = (sx * 15, 0, -7); N = (sx, 0, 0)
        ops = [lancet(wz + 7, 4, 1.1, 5) for wz in (-4.5, -1.5, 1.5, 4.5)]
        b.wall(O, (0, 0, 1), N, 14, 12, ops, ST)
        for wz in (-4.5, -1.5, 1.5, 4.5): frame(b, O, (0, 0, 1), N, wz + 7, 4, 1.1, 5, .35)
        O2 = (sx * 7.8, 12, -7)
        b.wall(O2, (0, 0, 1), (sx, 0, 0), 8, 3.5, [lancet(2.5, .7, 1, 2.4), lancet(5.5, .7, 1, 2.4)], ST, .25, None, 0)
        for k in range(-2, 3):
            bz = k * 3
            b.box(sx * 15.35, 0, bz, .9, 11.4, .7, TR, ('-y',))
            b.lathe(sx * 15.35, bz, [(.5, 11.4), (.5, 12.25), (0, 13.95)], 4, TR, pi / 4)
    # --- drum, windows, ribbed dome, lantern
    seg = 32 if hi else 16
    b.lathe(0, 0, [(5.6, 15.3), (5.5, 20.8)], seg, ST)
    b.lathe(0, 0, [(5.9, 15.3), (5.9, 15.7), (5.5, 15.7)], seg, TR)
    b.lathe(0, 0, [(5.5, 20.775), (5.85, 20.775), (5.85, 21.125), (5.5, 21.125)], seg, TR)
    for k in range(8):
        a = (4 * k + .5) * DT; r = 5.5 * cos(DT / 2)
        O = (r * sin(a) - cos(a) * .5, 0, r * cos(a) + sin(a) * .5); U = (cos(a), 0, -sin(a)); N = (sin(a), 0, cos(a))
        if hi: b.plate(O, U, N, [arch(.5, 16.3, 1.4, 3.8), arch(.5, 16.4, 1.0, 3.6)], TR, .06, True)
        b.plate(O, U, N, [arch(.5, 16.4, 1.0, 3.6)], GL, .04)
    rings = 9 if hi else 5
    prof = [(5.5 * cos(t), 21.1 + 6.325 * sin(t)) for t in [i / rings * pi / 2 for i in range(rings + 1)]]
    b.lathe(0, 0, prof, seg, VD)
    if hi:
        for k in range(8):
            a = k * pi / 4; pts = [(5.6 * cos(t) * sin(a), 21.1 + 6.45 * sin(t), 5.6 * cos(t) * cos(a)) for t in [i / 8 * pi / 2 for i in range(8)]]
            for p0, p1 in zip(pts, pts[1:]): b.beam(p0, p1, .1, TR, 3)
    b.lathe(0, 0, [(1.15, 26.9), (1.0, 29.5)], 12 if hi else 8, ST)
    b.lathe(0, 0, [(1.45, 26.9), (1.45, 27.2), (1.15, 27.2)], 12 if hi else 8, TR)
    b.lathe(0, 0, [(1.3, 29.5), (0, 31.5)], 12 if hi else 8, VD)
    b.beam((0, 31.4, 0), (0, 33.6, 0), .08, GD, 4); b.beam((-.45, 32.6, 0), (.45, 32.6, 0), .07, GD, 4)
    # --- west towers
    for sx in (-1, 1):
        tx, tz = sx * 11, 4
        b.box(tx, 0, tz, 6, 26, 6, ST, ('-y', '+z', '+x' if sx > 0 else '-x'))
        # front face
        win = [lancet(3, y, 1.1, 3.4) for y in (4, 9.5, 14.8)] + [lancet(2.1, 20.4, 1.0, 5), lancet(3.9, 20.4, 1.0, 5)]
        Of = (tx - 3, 0, 7)
        b.wall(Of, (1, 0, 0), (0, 0, 1), 6, 26, win, ST)
        for y in (4, 9.5, 14.8): frame(b, Of, (1, 0, 0), (0, 0, 1), 3, y, 1.1, 3.4, .3)
        for u in (2.1, 3.9): frame(b, Of, (1, 0, 0), (0, 0, 1), u, 20.4, 1.0, 5, .3)
        # outer side face, above the aisle roof
        Os = (tx + sx * 3, 0, tz - 3); Us = (0, 0, 1); Ns = (sx, 0, 0)
        b.wall(Os, Us, Ns, 6, 14, [lancet(3, 14.8 - 12, 1.1, 3.4), lancet(2.1, 8.4, 1.0, 5), lancet(3.9, 8.4, 1.0, 5)], ST, .3, None, 12)
        for px in (-1, 1):
            for pz in (-1, 1):
                cx, cz = tx + px * 3, tz + pz * 3
                b.box(cx, 0, cz, 1.0, 24, 1.0, TR, ('-y',))
                b.lathe(cx, cz, [(.7, 24), (.7, 24.4), (0, 27.2)], 8 if hi else 4, TR, pi / 8 if hi else pi / 4)
        for y in (8, 13.5, 19, 26): b.box(tx, y, tz, 7.2, .3, 7.2, TR, ('-y',))
        b.lathe(tx, tz, [(3.0, 26.3), (.12, 36.85)], 8, VD)
        if hi:   # spire ribs
            for k in range(8):
                a = k * pi / 4
                b.beam((tx + 3.0 * sin(a), 26.3, tz + 3.0 * cos(a)), (tx + .35 * sin(a), 36.1, tz + .35 * cos(a)), .06, TR, 3)
        b.beam((tx, 36.9, tz), (tx, 39.3, tz), .08, GD, 4); b.box(tx, 38.2, tz, 1, .12, .12, GD)


def make(lod):
    b = B(lod); building(b)
    bm = b.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.loops.layers.uv.new('UVMap')
    me = bpy.data.meshes.new(f'Se_LOD{lod}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'Se_LOD{lod}', me); bpy.context.scene.collection.objects.link(ob)
    for n in MATS: me.materials.append(bpy.data.materials.new(n))
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
    bpy.ops.uv.pack_islands(margin=.004, rotate=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------- baking
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda v: v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


WARM = (1.0, .66, .32)   # sodium floodlight tint baked into the stone emissive


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
    sep = node('ShaderNodeSeparateXYZ'); link(P, sep.inputs[0]); X, Y, Z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    def blocks(row, brick):
        """Ashlar coursing: row height `row`, block length `brick` along the wall (x+y covers both wall orientations)."""
        s = node('ShaderNodeMath', operation='ADD'); link(X, s.inputs[0]); link(Y, s.inputs[1])
        cv = node('ShaderNodeCombineXYZ'); link(s.outputs[0], cv.inputs['X']); link(Z, cv.inputs['Y'])
        br = node('ShaderNodeTexBrick'); br.offset = .5; br.offset_frequency = 2
        br.inputs['Color1'].default_value = (.95, .95, .95, 1); br.inputs['Color2'].default_value = (1, 1, 1, 1); br.inputs['Mortar'].default_value = (.55, .55, .55, 1)
        br.inputs['Mortar Size'].default_value = .045; br.inputs['Mortar Smooth'].default_value = .3; br.inputs['Bias'].default_value = 0
        br.inputs['Brick Width'].default_value = brick; br.inputs['Row Height'].default_value = row; br.inputs['Scale'].default_value = 1
        link(cv.outputs[0], br.inputs['Vector']); return br.outputs['Color']
    def albedo():
        if name in STONES:
            c = ramp(noise(3, 6, (1, 1, .35)), *STONES[name])
            c = mul(c, ramp(noise(45, 3), '#d8d8d8', '#ffffff'))
            c = mul(c, blocks(.75 if name == 'stone' else .5, 1.5))
            soot = node('ShaderNodeMapRange'); soot.inputs[1].default_value = 0; soot.inputs[2].default_value = 3; soot.inputs[3].default_value = .86; soot.inputs[4].default_value = 1; link(Z, soot.inputs[0])
            return mul(c, soot.outputs[0])
        if name == 'verd':
            base = ramp(noise(6, 5, (1, 1, .3)), '#4e9b86', '#79c0a6')
            return mul(base, ramp(noise(22, 3, (3, 3, .6)), '#c8d8d0', '#ffffff'))
        if name == 'slate':
            base = ramp(noise(25, 4), '#3f4856', '#566174')
            d = node('ShaderNodeMath', operation='DIVIDE'); d.inputs[1].default_value = .3; link(Z, d.inputs[0])
            fr = node('ShaderNodeMath', operation='FRACT'); link(d.outputs[0], fr.inputs[0])
            lt = node('ShaderNodeMath', operation='LESS_THAN'); lt.inputs[1].default_value = .08; link(fr.outputs[0], lt.inputs[0])
            ma = node('ShaderNodeMath', operation='MULTIPLY_ADD'); ma.inputs[1].default_value = -.3; ma.inputs[2].default_value = 1; link(lt.outputs[0], ma.inputs[0])
            return mul(base, ma.outputs[0])
        if name == 'glass':   # stained-glass mottling: voronoi cells, deep blue to amber
            vo = node('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 5; link(P, vo.inputs['Vector'])
            return ramp(vo.outputs['Distance'], '#2a3e66', '#7a5a38')
        return None
    COL = {'gold': '#d9a93a', 'door': '#3a281c'}
    if chan == 'ALB':
        s = albedo()
        if s is not None: link(s, em.inputs['Color'])
        else: em.inputs['Color'].default_value = lin(COL[name])
    else:  # EMI: night lighting
        if name in STONES:
            c = albedo()
            tint = node('ShaderNodeMixRGB', blend_type='MULTIPLY'); tint.inputs['Fac'].default_value = 1
            link(c, tint.inputs['Color1']); tint.inputs['Color2'].default_value = (*WARM, 1); link(tint.outputs['Color'], em.inputs['Color'])
            mr = node('ShaderNodeMapRange'); mr.inputs[1].default_value = 0; mr.inputs[2].default_value = 34; mr.inputs[3].default_value = .30; mr.inputs[4].default_value = .12
            link(Z, mr.inputs[0]); link(mr.outputs[0], em.inputs['Strength'])
        elif name == 'glass':
            vo = node('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 5; link(P, vo.inputs['Vector'])
            link(ramp(vo.outputs['Distance'], '#ff8a2e', '#ffd27a'), em.inputs['Color']); em.inputs['Strength'].default_value = .9
        elif name == 'gold': em.inputs['Color'].default_value = lin('#d9a93a'); em.inputs['Strength'].default_value = .12
        elif name in ('verd', 'slate'):
            c = albedo(); tint = node('ShaderNodeMixRGB', blend_type='MULTIPLY'); tint.inputs['Fac'].default_value = 1
            link(c, tint.inputs['Color1']); tint.inputs['Color2'].default_value = (*WARM, 1); link(tint.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = .16 if name == 'verd' else .05
        else: em.inputs['Color'].default_value = (0, 0, 0, 1)


def bake(ob, chan, btype, cs, size):
    img = bpy.data.images.new(f'bake_{chan}', size, size, alpha=False)
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
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SIZE = SIZES[lod]
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'
    ob = make(lod)
    w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 4.0
    t0 = time.time(); sc.cycles.samples = 1
    alb = bake(ob, 'ALB', 'EMIT', 'sRGB', SIZE); emi = bake(ob, 'EMI', 'EMIT', 'sRGB', SIZE); rm = bake(ob, 'RM', 'EMIT', 'Non-Color', SIZE)
    sc.cycles.samples = 48
    ao = bake(ob, 'AO', 'AO', 'Non-Color', SIZE)
    bt = time.time() - t0
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)
    a, r = px(ao), px(rm)
    orm = np.ones((SIZE, SIZE, 4), np.float32); orm[..., 0] = a[..., 0]; orm[..., 1] = r[..., 1]; orm[..., 2] = r[..., 2]
    ormi = bpy.data.images.new('orm', SIZE, SIZE, alpha=False); ormi.colorspace_settings.name = 'Non-Color'; ormi.pixels.foreach_set(orm.ravel())
    # verify: every glass pane must be emissive at its UV centre and shrunken corners
    e = px(emi); uvd = ob.data.uv_layers.active.data; tot = lit = 0
    for pl in ob.data.polygons:
        if pl.material_index != GL: continue
        uvs = [uvd[i].uv for i in pl.loop_indices]; c = sum(uvs, uvs[0] * 0) / len(uvs)
        ok = all(e[min(SIZE - 1, int((c[1] + .8 * (u[1] - c[1])) * SIZE)), min(SIZE - 1, int((c[0] + .8 * (u[0] - c[0])) * SIZE)), :3].max() > .05 for u in [c] + uvs)
        tot += 1; lit += ok
    print('LITCHECK', lod, f'{lit}/{tot}')
    p = lambda n: os.path.join(TEX, f'lod{lod}_{n}.png')
    save(alb, p('albedo')); save(emi, p('emissive')); save(ormi, p('orm'))
    for i in range(len(ob.data.materials)): ob.data.materials.pop(index=0)
    m = bpy.data.materials.new('SeAtlas'); m.use_nodes = True; m.use_backface_culling = True; N = m.node_tree.nodes; L = m.node_tree.links; N.clear()
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
    glb = os.path.join(OUT, f'se.lod{lod}.raw.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    me = ob.data; me.calc_loop_triangles()
    mn, mx, j = bounds_of(glb)
    return dict(lod=lod, tris=len(me.loop_triangles), verts=len(me.vertices), min=[round(x, 3) for x in mn], max=[round(x, 3) for x in mx], bake_s=round(bt, 1),
                images=len(j.get('images', [])), mats=[x['name'] for x in j['materials']], glb=glb)


if __name__ == '__main__':
    import sys
    only = [int(a) for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else [0, 1]
    print('RESULT', json.dumps([run(l) for l in only], indent=1))
