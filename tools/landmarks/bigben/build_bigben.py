"""Big Ben (Elizabeth Tower) + Palace of Westminster river frontage.
Procedural bmesh build, Cycles bake (albedo / AO / roughness-metal / night emissive), glTF export.
Run: blender -b --python tools/landmarks/bigben/build_bigben.py
All coordinates below are authored in glTF space (Y up, metres); V() maps them to Blender (Z up)."""
import bpy, bmesh, math, os, time, json, struct
import numpy as np
from mathutils import Vector, geometry

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets', 'models', 'source', 'bigben'))
TEX = os.path.join(OUT, 'tex')
os.makedirs(TEX, exist_ok=True)
SIZE = 1024
S, SL, GD, GL, BZ, LV, SH, TAN, BASE, SP, DK, RD = range(12)   # authoring slots
MATS = ['stone', 'slate', 'gold', 'glass', 'bronze', 'louvre', 'shaft', 'tan', 'base', 'spire', 'slit', 'border']
ROUGH = [.85, .6, .3, .08, .5, .5, .85, .85, .9, .6, .8, .6]
METAL = [0, 0, 1, 0, .6, .6, 0, 0, 0, .2, 0, 0]
STONES = {'stone': ('#a58250', '#c09a62'), 'shaft': ('#a07a4c', '#b58b59'), 'tan': ('#c49a62', '#d0a870'), 'base': ('#6e4c33', '#835d40')}
V = lambda x, y, z: Vector((x, -z, y))
SIDES = [((0, 0, 1), (1, 0, 0)), ((0, 0, -1), (-1, 0, 0)), ((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))]
TZ = 1.5  # tower axis z


def arch(uc, v0, w, h):
    sp = max(h - .95 * w, h * .5)
    return [(uc - w / 2, v0), (uc + w / 2, v0), (uc + w / 2, v0 + sp), (uc + .36 * w, v0 + sp + .45 * (h - sp)),
            (uc, v0 + h), (uc - .36 * w, v0 + sp + .45 * (h - sp)), (uc - w / 2, v0 + sp)]


def circ(uc, vc, r, n):
    return [(uc + r * math.cos(2 * math.pi * i / n), vc + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


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

    def box(s, cx, y0, cz, w, h, d, m=S, skip=()):
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

    def ring(s, cx, cz, o, i, y0, h, m, top=True, bot=True, ib=None):
        ib = ib or i; y1 = y0 + h
        C = lambda hx, hz, y: [(cx - hx, y, cz - hz), (cx + hx, y, cz - hz), (cx + hx, y, cz + hz), (cx - hx, y, cz + hz)]
        Ob, Ot, It, Ib = C(*o, y0), C(*o, y1), C(*i, y1), C(*ib, y0)
        for k in range(4):
            j = (k + 1) % 4
            s.poly([Ob[k], Ob[j], Ot[j], Ot[k]], m, ((Ob[k][0] + Ob[j][0]) / 2 - cx, 0, (Ob[k][2] + Ob[j][2]) / 2 - cz))
            if top: s.poly([Ot[k], Ot[j], It[j], It[k]], m, (0, 1, 0))
            if bot: s.poly([Ob[k], Ob[j], Ib[j], Ib[k]], m, (0, -1, 0))

    def wall(s, O, U, N, w, h, ops, m=S, depth=.25):
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
                s.poly([Q(*p, -.03) for p in pts], pm, N)   # LOD1: window = flat decal

    def sides(s, cx, cz, hx, hz, y0, h, ops_fn, m=S, depth=.25):
        for N, U in SIDES:
            wd = 2 * hx if N[2] else 2 * hz
            O = (cx + N[0] * hx - U[0] * wd / 2, y0, cz + N[2] * hz - U[2] * wd / 2)
            s.wall(O, U, N, wd, h, ops_fn(wd, N), m, depth)

    def sphere(s, cx, cy, cz, r, m):
        g = bmesh.ops.create_uvsphere(s.bm, u_segments=8, v_segments=6, radius=r)
        bmesh.ops.translate(s.bm, verts=g['verts'], vec=V(cx, cy, cz))
        for f in {f for v in g['verts'] for f in v.link_faces}: f.material_index = m


def dial(b, N, U):
    R, r = 2.15, 1.75
    n = 24 if b.lod == 0 else 12
    C = (N[0] * 2.95, 21.0, TZ + N[2] * 2.95)
    p = lambda r, a, o: (C[0] + U[0] * r * math.cos(a) + N[0] * o, C[1] + r * math.sin(a), C[2] + U[2] * r * math.cos(a) + N[2] * o)
    rad = lambda a: (U[0] * math.cos(a), math.sin(a), U[2] * math.cos(a))
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n; am = (a0 + a1) / 2; rr = rad(am)
        b.poly([p(R, a0, 0), p(R, a1, 0), p(R, a1, .12), p(R, a0, .12)], GD, rr)
        b.poly([p(R, a0, .12), p(R, a1, .12), p(r, a1, .12), p(r, a0, .12)], GD, N)
        if b.lod == 0: b.poly([p(r, a0, .12), p(r, a1, .12), p(r, a1, 0), p(r, a0, 0)], GD, tuple(-c for c in rr))


def arch5(uc, v0, w, h):
    return [(uc - w / 2, v0), (uc + w / 2, v0), (uc + w / 2, v0 + h * .6), (uc, v0 + h), (uc - w / 2, v0 + h * .6)]


def fb(b, N, U, u, y0, w, h, d0, d1, m, skip=(), hw=2.95):
    """Box on a tower face, in face coordinates: u along the face, d0..d1 outward from the face plane at distance hw."""
    off = hw + (d0 + d1) / 2
    wx, wz = (w, d1 - d0) if N[2] else (d1 - d0, w)
    b.box(N[0] * off + U[0] * u, y0, TZ + N[2] * off + U[2] * u, wx, h, wz, m, skip)


def tower(b):
    cz = TZ; L0 = b.lod == 0
    b.ring(0, cz, (3.0, 3.0), (2.7, 2.7), 0, 2.2, BASE, bot=False)                 # darker plain base block
    YT = [2.4, 7.45, 12.45]
    def shaft(w, N):                                                                 # 3 tiers: 6 long thin slits + 4 blind arches each
        o = []
        for y0 in YT:
            for k in range(6):
                u = w / 2 - 2.0 + k * .8
                o.append(([(u - .06, y0 + .5 - 2.2), (u + .06, y0 + .5 - 2.2), (u + .06, y0 + 2.5 - 2.2), (u - .06, y0 + 2.5 - 2.2)], DK, .16))
            o += [(arch5(w / 2 - 1.8 + k * .9, y0 + 3.1 - 2.2, .46, .8), SH if L0 else None, .15) for k in range(5)]
        return o
    b.sides(0, cz, 2.7, 2.7, 2.2, 14.9, shaft, SH, .16)
    for y, h in ((6.85, .25), (7.2, .12), (11.9, .25), (12.25, .12), (16.85, .25)): b.ring(0, cz, (2.8, 2.8), (2.7, 2.7), y, h, TAN)
    b.ring(0, cz, (2.9, 2.9), (2.8, 2.8), 17.1, .3, TAN, top=False)
    b.sides(0, cz, 2.9, 2.9, 17.4, .5, lambda w, N: [(arch5(w / 2 - 2.1 + k * .6, .08, .4, .34), BASE if L0 else None, .15) for k in range(8)], TAN, .15)  # machicolation row
    b.ring(0, cz, (2.95, 2.95), (2.9, 2.9), 17.9, .1, TAN, top=False)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(sx * 2.52, 2.2, cz + sz * 2.52, .56, 14.9, .56, TAN, ['-y', '+y'])
            b.box(sx * 2.78, 18, cz + sz * 2.78, .55, 6.25, .55, SH, ['-y'])
            b.box(sx * 2.78, 24.25, cz + sz * 2.78, .38, 1.75, .38, TAN, ['-y'])    # corner pinnacle + gold tip + cross
            b.frus(sx * 2.78, 26.0, cz + sz * 2.78, .2, .2, 0, 0, .6, GD)
            b.box(sx * 2.78, 26.6, cz + sz * 2.78, .06, .6, .06, GD, ['-y']); b.box(sx * 2.78, 26.95, cz + sz * 2.78, .34, .05, .05, GD); b.box(sx * 2.78, 26.95, cz + sz * 2.78, .05, .05, .34, GD)
            b.box(sx * 1.93, 28.5, cz + sz * 1.93, .12, .7, .12, GD, ['-y'])      # lantern corner pinnacle + cross
            b.box(sx * 1.93, 29.2, cz + sz * 1.93, .04, .5, .04, GD, ['-y']); b.box(sx * 1.93, 29.5, cz + sz * 1.93, .24, .04, .04, GD); b.box(sx * 1.93, 29.5, cz + sz * 1.93, .04, .04, .24, GD)
    nd = 24 if b.lod == 0 else 12
    def stage(w, N):                                                                 # dial recess + gold-trimmed arcade of small pointed arches
        return [(circ(w / 2, 3.0, 1.75, nd), BZ if L0 else None, .25)] + [(arch5(w / 2 - 2.1 + k * .6, 5.5, .38, .4), DK, .15) for k in range(8)]
    b.sides(0, cz, 2.95, 2.95, 18, 5.95, stage, TAN)
    for N, U in SIDES:
        O = (N[0] * 3.0 - U[0] * 2.5, 18.5, cz + N[2] * 3.0 - U[2] * 2.5)
        b.wall(O, U, N, 5.0, 5.0, [(circ(2.5, 2.5, 2.15, nd), None, .05)], GD, .05)   # gold panel with the dial hole
        if L0:
            for u, y0, w, h in ((-2.3, 18.7, .08, 4.6), (2.3, 18.7, .08, 4.6), (0, 18.7, 4.5, .08), (0, 23.22, 4.5, .08)): fb(b, N, U, u, y0, w, h, .05, .085, RD)
        for u in (-2.55, 2.55): fb(b, N, U, u, 18.5, .1, 5.0, 0, .1, GD)               # beaded vertical edges
        dial(b, N, U)
    b.ring(0, cz, (3.05, 3.05), (2.75, 2.75), 23.95, .3, TAN, ib=(2.95, 2.95))
    b.ring(0, cz, (2.95, 2.95), (2.85, 2.85), 24.25, .08, GD)
    b.frus(0, 24.25, cz, 2.85, 2.85, 1.85, 1.85, 1.9, SL)                              # slate hip + 8 dormers
    for N, U in SIDES:
        for u in (-.9, .9):
            cx_, cz_ = N[0] * 2.3 + U[0] * u, N[2] * 2.3 + U[2] * u
            w, dd = (.42, .4) if N[2] else (.4, .42)
            b.box(cx_, 24.55, cz + cz_, w, .5, dd, TAN, ['-y', '+z' if N[2] > 0 else '-z' if N[2] < 0 else '+x' if N[0] > 0 else '-x'])
            fx, fz = cx_ + N[0] * .21, cz_ + N[2] * .21
            b.poly([(fx + U[0] * .13, 24.7, cz + fz + U[2] * .13), (fx - U[0] * .13, 24.7, cz + fz - U[2] * .13), (fx - U[0] * .13, 24.95, cz + fz - U[2] * .13), (fx + U[0] * .13, 24.95, cz + fz + U[2] * .13)], DK, N)
            b.frus(cx_, 25.05, cz + cz_, .28, .28, 0, 0, .4, GD)
    b.ring(0, cz, (2.1, 2.1), (1.8, 1.8), 26.15, .15, GD)                       # gold open-work lantern
    b.sides(0, cz, 1.8, 1.8, 26.3, 2.0, lambda w, N: [([(w / 2 - 1.26 + k * .42 + dx, .25 + dy) for dx, dy in ((-.11, 0), (.11, 0), (.11, 1.5), (-.11, 1.5))], LV, .16) for k in range(7)], GD, .16)
    if L0:
        for N, U in SIDES:
            for u in (-1.5, -.75, 0, .75, 1.5): fb(b, N, U, u, 26.3, .06, .34, .17, .23, GD, hw=1.8)
        b.ring(0, cz, (2.04, 2.04), (1.96, 1.96), 26.62, .04, GD)
    b.ring(0, cz, (2.1, 2.1), (1.6, 1.6), 28.3, .2, GD, ib=(1.8, 1.8))
    b.ring(0, cz, (1.77, 1.77), (1.57, 1.57), 28.5, .18, GD)                       # crown cornice
    b.frus(0, 28.68, cz, 1.57, 1.57, .1, .1, 3.9, SP)                               # tall narrow slate spire
    ap = (0, 32.58, cz)
    for dx, dz in ((1, 1), (1, -1), (-1, 1), (-1, -1), (1, 0), (-1, 0), (0, 1), (0, -1)):  # gold ribs
        l = math.hypot(dx, dz); ux, uz = dx / l, dz / l;         P0 = (dx * 1.57 if dx else 0, 28.68, cz + (dz * 1.57 if dz else 0)); sh = .02
        P0 = (P0[0] + ux * sh, P0[1], P0[2] + uz * sh)
        b.poly([(P0[0] - uz * .045, P0[1], P0[2] + ux * .045), (P0[0] + uz * .045, P0[1], P0[2] - ux * .045), (ux * sh, ap[1], ap[2] + uz * sh)], GD, (ux, .3, uz))
    b.box(0, 32.5, cz, .07, 1.5, .07, GD, ['-y']); b.box(0, 33.3, cz, .4, .05, .05, GD); b.box(0, 33.3, cz, .05, .05, .4, GD)
    if L0: b.sphere(0, 32.7, cz, .12, GD)


def palace(b):
    L0 = b.lod == 0
    X0, X1 = 5.6, 33.3; bw = (X1 - X0) / 10
    for sgn in (1, -1):
        N = (0, 0, sgn); U = (sgn, 0, 0)
        O = (X0 if sgn > 0 else X1, .8, 3.6 * sgn)
        ops = []
        for i in range(10):
            uc = (i + .5) * bw
            if sgn > 0 and i == 4: ops.append((arch(uc, .05, 1.5, 3.1), BZ, None))
            else: ops += [(arch(uc + dx, .5, .62, 2.5), GL, None) for dx in (-.37, .37)]
            ops += [(arch(uc + dx, 3.4, .62, 2.4), GL, None) for dx in (-.37, .37)]
        b.wall(O, U, N, X1 - X0, 6.2, ops)
        zc = 3.6 * sgn
        b.box(20, 0, zc + .075 * sgn, 34.0, .8, .15, S, ['-y', '-z' if sgn > 0 else '+z'])             # plinth slab
        for i in range(1, 10):                                                                      # buttresses + pinnacles
            x = X0 + i * bw
            b.box(x, .8, zc + .2 * sgn, .7, 3.15, .4, S, ['-y', '-z' if sgn > 0 else '+z'])
            b.box(x, 3.95, zc + .15 * sgn, .5, 3.05, .3, S, ['-y', '-z' if sgn > 0 else '+z'])
            b.box(x, 7.0, zc + .2 * sgn, .34, 1.0, .34, S, ['-y'])
            b.frus(x, 8.0, zc + .2 * sgn, .17, .17, 0, 0, .8, S)
        for i in range(10):                                                                         # string courses between buttresses
            x = X0 + (i + .5) * bw
            b.box(x, 3.95, zc + .075 * sgn, bw - .5, .2, .15, S, ['-y', '-z' if sgn > 0 else '+z'])
        b.box(20, 7.0, zc - .1 * sgn + 0 * sgn, X1 - X0, 0.9, .5, S, ['-y'])                        # cornice + parapet block
        if L0:
            n = 29
            for i in range(n):
                b.box(X0 + (i + .5) * (X1 - X0) / n, 7.9, zc - .0 * sgn, .55, .5, .35, S, ['-y'])
    # roof (hipped between the pavilions) with lantern turrets
    b.poly([(X0, 7.9, 3.25), (X1, 7.9, 3.25), (X1, 10.2, 0), (X0, 10.2, 0)], SL, (0, 1, 1))
    b.poly([(X0, 7.9, -3.25), (X1, 7.9, -3.25), (X1, 10.2, 0), (X0, 10.2, 0)], SL, (0, 1, -1))
    for x in (9, 14.5, 20, 25.5, 30):
        b.box(x, 10.0, 0, .9, 1.3, .9, S, ['-y']); b.frus(x, 11.3, 0, .6, .6, 0, 0, 1.6, SL); b.frus(x, 12.9, 0, .05, .05, 0, 0, .35, GD)
    # end pavilions
    for cx, x0, x1 in ((4.05, 2.5, 5.6), (35.15, 33.3, 37.0)):
        w = x1 - x0
        for sgn in (1, -1):
            N = (0, 0, sgn); U = (sgn, 0, 0)
            ops = [(arch(w / 2, .5, 1.0, 2.6), GL, None), (arch(w / 2, 3.4, 1.0, 2.4), GL, None)]
            b.wall((x0 if sgn > 0 else x1, .8, 3.75 * sgn), U, N, w, 7.4, ops)
            b.box(cx, 8.2, 3.85 * sgn, w, .3, .2, S, ['-y'])
        for px_ in (x0 + .25, x1 - .25):
            for sz in (-1, 1):
                b.box(px_, 8.5, sz * 3.65, .4, 1.1, .4, S, ['-y']); b.frus(px_, 9.6, sz * 3.65, .2, .2, 0, 0, .9, SL); b.frus(px_, 10.5, sz * 3.65, .04, .04, 0, 0, .3, GD)
        if cx < 10:
            b.poly([(x0, .8, 3.75), (x0, .8, -3.75), (x0, 8.2, -3.75), (x0, 8.2, 3.75)], S, (-1, 0, 0))
            b.frus(cx, 8.5, 0, w / 2 + .1, 3.95, 0, 2.2, 1.2, SL)
        else:
            b.poly([(x1, .8, 3.75), (x1, .8, -3.75), (x1, 8.2, -3.75), (x1, 8.2, 3.75)], S, (1, 0, 0))
            b.ring(cx, 0, (1.85, 3.95), (1.55, 1.9), 8.2, .3, S)
    # Victoria-style tower on the far end
    cx = 35.15
    def vt(wd, N):
        return [(arch(wd / 2, .9, .95, 3.4), GL, None), (arch(wd / 2, 5.6, .95, 3.4), GL, None)]
    b.sides(cx, 0, 1.55, 1.9, 8.5, 12, vt)
    b.ring(cx, 0, (1.82, 2.17), (1.55, 1.9), 20.4, .4, S)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(cx + sx * 1.38, 8.5, sz * 1.72, .4, 11.9, .4, S, ['-y'])
            b.box(cx + sx * 1.62, 20.8, sz * 1.97, .3, .5, .3, S, ['-y']); b.frus(cx + sx * 1.62, 21.3, sz * 1.97, .15, .15, 0, 0, .7, GD)
    b.frus(cx, 20.8, 0, 1.62, 1.97, 0, 0, 3.2, SL)
    b.frus(cx, 24.0, 0, .06, .06, 0, 0, 2.5, GD)


def make(lod):
    b = B(lod); tower(b); palace(b)
    bm = b.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.loops.layers.uv.new('UVMap')
    me = bpy.data.meshes.new(f'BigBen_LOD{lod}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'BigBen_LOD{lod}', me); bpy.context.scene.collection.objects.link(ob)
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


def mat_nodes(m, chan, img, idx, nt_cache={}):
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
    zsep = node('ShaderNodeSeparateXYZ'); link(P, zsep.inputs[0]); Z = zsep.outputs['Z']
    def albedo():
        if name in STONES:
            c = ramp(noise(3, 6, (1, 1, .35)), *STONES[name])
            g = ramp(noise(45, 3), '#d8d8d8', '#ffffff')
            c = mul(c, g)
            d = node('ShaderNodeMath', operation='DIVIDE'); d.inputs[1].default_value = .5; link(Z, d.inputs[0])
            fr = node('ShaderNodeMath', operation='FRACT'); link(d.outputs[0], fr.inputs[0])
            lt = node('ShaderNodeMath', operation='LESS_THAN'); lt.inputs[1].default_value = .05; link(fr.outputs[0], lt.inputs[0])
            ma = node('ShaderNodeMath', operation='MULTIPLY_ADD'); ma.inputs[1].default_value = -.2; ma.inputs[2].default_value = 1; link(lt.outputs[0], ma.inputs[0])
            c = mul(c, ma.outputs[0])
            soot = node('ShaderNodeMapRange'); soot.inputs[1].default_value = 0; soot.inputs[2].default_value = 6; soot.inputs[3].default_value = .78; soot.inputs[4].default_value = 1; link(Z, soot.inputs[0])
            return mul(c, soot.outputs[0])
        if name == 'spire':   # blue-grey slate with baked gold studs
            base = ramp(noise(14, 3, (1, 1, .5)), '#46536b', '#5f6f8c')
            vo = node('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 22; link(P, vo.inputs['Vector'])
            lt = node('ShaderNodeMath', operation='LESS_THAN'); lt.inputs[1].default_value = .09; link(vo.outputs['Distance'], lt.inputs[0])
            mx = node('ShaderNodeMixRGB'); link(base, mx.inputs['Color1']); mx.inputs['Color2'].default_value = lin('#d9a93a'); link(lt.outputs[0], mx.inputs['Fac'])
            return mx.outputs['Color']
        if name == 'slate': return ramp(noise(25, 4), '#46536b', '#5f6f8c')
        return None
    COL = {'border': '#5b2b35', 'slit': '#3a2a20', 'gold': '#d9a93a', 'glass': '#1b2630', 'bronze': '#3a4a3c', 'louvre': '#3a4a3c'}
    if chan == 'ALB':
        s = albedo()
        if s is not None: link(s, em.inputs['Color'])
        else: em.inputs['Color'].default_value = lin(COL[name])
    else:  # EMI: night lighting
        if name in STONES:
            link(albedo(), em.inputs['Color'])
            mr = node('ShaderNodeMapRange'); mr.inputs[1].default_value = 0; mr.inputs[2].default_value = 12; mr.inputs[3].default_value = .15; mr.inputs[4].default_value = .10
            link(Z, mr.inputs[0]); link(mr.outputs[0], em.inputs['Strength'])
        elif name == 'gold': em.inputs['Color'].default_value = lin('#d9a93a'); em.inputs['Strength'].default_value = .55
        elif name == 'louvre': em.inputs['Color'].default_value = lin('#ffb24a')
        elif name in ('glass', 'slit'):
            sc = node('ShaderNodeVectorMath', operation='SCALE'); sc.inputs['Scale'].default_value = 1 / 1.4; link(P, sc.inputs[0])
            fl = node('ShaderNodeVectorMath', operation='FLOOR'); link(sc.outputs[0], fl.inputs[0])
            wn = node('ShaderNodeTexWhiteNoise', noise_dimensions='3D'); link(fl.outputs[0], wn.inputs['Vector'])
            gt = node('ShaderNodeMath', operation='GREATER_THAN'); gt.inputs[1].default_value = .22; link(wn.outputs['Value'], gt.inputs[0])
            mx = node('ShaderNodeMixRGB'); mx.inputs['Color1'].default_value = (0, 0, 0, 1); mx.inputs['Color2'].default_value = lin('#ffc46b')
            link(gt.outputs[0], mx.inputs['Fac']); link(mx.outputs['Color'], em.inputs['Color'])
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
    mn = np.min([a['min'] for a in j['accessors'] if a.get('type') == 'VEC3' and 'min' in a and a['min'][1] >= -1e9][:1], axis=0)
    a = [x for x in j['accessors'] if 'min' in x and x['type'] == 'VEC3'][0]
    return a['min'], a['max'], j


def run(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'
    ob = make(lod)
    w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 5.0
    t0 = time.time(); sc.cycles.samples = 1
    alb = bake(ob, 'ALB', 'EMIT', 'sRGB'); emi = bake(ob, 'EMI', 'EMIT', 'sRGB'); rm = bake(ob, 'RM', 'EMIT', 'Non-Color')
    sc.cycles.samples = 48
    ao = bake(ob, 'AO', 'AO', 'Non-Color')
    bt = time.time() - t0
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)
    a, r = px(ao), px(rm)
    orm = np.ones((SIZE, SIZE, 4), np.float32); orm[..., 0] = a[..., 0]; orm[..., 1] = r[..., 1]; orm[..., 2] = r[..., 2]
    ormi = bpy.data.images.new('orm', SIZE, SIZE, alpha=False); ormi.colorspace_settings.name = 'Non-Color'; ormi.pixels.foreach_set(orm.ravel())
    p = lambda n: os.path.join(TEX, f'lod{lod}_{n}.png')
    save(alb, p('albedo')); save(emi, p('emissive')); save(ormi, p('orm'))
    # export material: standard ORM packing
    for i in range(len(ob.data.materials)): ob.data.materials.pop(index=0)
    m = bpy.data.materials.new('BigBenAtlas'); m.use_nodes = True; m.use_backface_culling = True; N = m.node_tree.nodes; L = m.node_tree.links; N.clear()
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
    glb = os.path.join(OUT, f'bigben.lod{lod}.raw.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    me = ob.data; me.calc_loop_triangles()
    mn, mx, j = bounds_of(glb)
    return dict(lod=lod, tris=len(me.loop_triangles), verts=len(me.vertices), min=[round(x, 3) for x in mn], max=[round(x, 3) for x in mx], bake_s=round(bt, 1),
                images=len(j.get('images', [])), mats=[x['name'] for x in j['materials']], glb=glb)


if __name__ == '__main__':
    print('RESULT', json.dumps([run(0), run(1)], indent=1))
