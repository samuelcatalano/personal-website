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
FB, FR, FW, PS = 10, 11, 12, 13                       # flag cloth: blue, red, white; PS = pale Portland-stone dressings
MATS = ['stone', 'slate', 'blue', 'trim', 'glass', 'gilt', 'deck', 'lampw', 'wglass', 'strip', 'flagblue', 'flagred', 'flagwhite', 'portland']
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
ZA, AW, AD = 68.0, 8.5, 4.5   # shore abutment tower: centre z, half width (x), half depth (z)
ZOUT = TZ + TZH              # outer face of each tower (side spans start here)


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


def rarch(uc, v0, w, h, n=8):
    """Round (semicircular) arch outline, bottom corners first."""
    r = w / 2; sp = h - r
    pts = [(uc - r, v0), (uc - r, v0 + sp)]
    pts += [(uc - r * math.cos(math.pi * i / n), v0 + sp + r * math.sin(math.pi * i / n)) for i in range(1, n)]
    return pts + [(uc + r, v0 + sp), (uc + r, v0)]


def fpt(cx, cz, hx, hz, N, U, y0, u, v, d=0.0):
    """Point on a face: u along the face, v up, d outward."""
    wd = 2 * hx if N[2] else 2 * hz
    return (cx + N[0] * hx - U[0] * wd / 2 + U[0] * u + N[0] * d, y0 + v, cz + N[2] * hz - U[2] * wd / 2 + U[2] * u + N[2] * d)


def dress(b, cx, cz, hx, hz, N, U, y0, uc, v, w, h, d, m=PS, shift=0.0):
    """Axis-aligned box standing on a face (sill, hood, balcony), centred at uc."""
    px, _, pz = fpt(cx, cz, hx, hz, N, U, y0, uc, v, d / 2 + shift)
    wall = ('-x' if N[0] > 0 else '+x') if N[0] else ('-z' if N[2] > 0 else '+z')
    if N[2]: b.box(px, y0 + v, pz, w, h, d, m, ('-y', wall))
    else: b.box(px, y0 + v, pz, d, h, w, m, ('-y', wall))


def archring(b, cx, cz, hx, hz, N, U, y0, uc, v0, w, h, grow, off, m=PS):
    """Moulded surround (archivolt) around a round-arched opening."""
    inner, outer = rarch(uc, v0, w, h), rarch(uc, v0, w + 2 * grow, h + grow)
    P = lambda q: fpt(cx, cz, hx, hz, N, U, y0, q[0], q[1], off)
    for i in range(len(inner) - 1): b.poly([P(inner[i]), P(inner[i + 1]), P(outer[i + 1]), P(outer[i])], m, N)


TIERS = ((5.0, 3.2), (11.5, 3.2), (18.0, 3.4), (24.0, 3.4), (30.5, 3.4), (37.0, 3.0))   # window groups of three, as in the photographs


def facade(b, cx, cz, hx, hz, N, U, y0, tiers, gcs, ops, skip, bal_v, bal_w, L0, door=None):
    """Three-light mullioned window groups with sills and hoods, plus a balcony under the chosen tier."""
    for v0, h in tiers:
        if skip(v0, h): continue
        for uc in gcs:
            for k in (-1, 0, 1): ops.append((rect(uc + k * 1.6 - .55, v0, 1.1, h), GL, .3))
            if L0:
                dress(b, cx, cz, hx, hz, N, U, y0, uc, v0 - .3 - 0, 4.9, .3, .5)
                dress(b, cx, cz, hx, hz, N, U, y0, uc, v0 + h, 4.9, .3, .5)
    if L0 and bal_v is not None:
        for uc in (door if door is not None else gcs[:1] if len(gcs) == 1 else [(gcs[0] + gcs[1]) / 2]):
            dress(b, cx, cz, hx, hz, N, U, y0, uc, bal_v, bal_w, .45, 1.7)                # balcony slab
            dress(b, cx, cz, hx, hz, N, U, y0, uc, bal_v + .45, bal_w, 1.0, .18, TR, 1.51)  # balustrade
            for k in (-1, 1): dress(b, cx, cz, hx, hz, N, U, y0, uc + k * bal_w * .32, bal_v - 1.1, .5, 1.1, 1.0)  # corbels


def turret(b, cx, cz, sx, sz, H, L0):
    """Round corner turret running the full height, ringed every 8 m, crowned by a banded stone spire and a cross."""
    ns = 12 if L0 else 8; top = H + 11.8
    b.cone(cx, 0, cz, 2.0, 2.0, top, ns, ST)
    for y in (8.0, 16.0, 24.0, 32.0, 40.0):
        b.cone(cx, y, cz, 2.3, 2.3, .5, ns, PS, top=True)
    if L0:
        phi = math.atan2(sz, sx)
        for y in (6.5, 13.0, 19.5, 26.0, 32.5, 39.0):                                       # arrow-slit windows on the outward diagonal
            R = 2.03; a0, a1 = phi - .13, phi + .13
            b.poly([(cx + R * math.cos(a0), y, cz + R * math.sin(a0)), (cx + R * math.cos(a1), y, cz + R * math.sin(a1)),
                    (cx + R * math.cos(a1), y + 1.6, cz + R * math.sin(a1)), (cx + R * math.cos(a0), y + 1.6, cz + R * math.sin(a0))], GL, (math.cos(phi), 0, math.sin(phi)))
    b.cone(cx, top, cz, 2.55, 2.55, .6, ns, PS, top=True)                                     # crown ring
    b.cone(cx, top + .6, cz, 2.2, 0.0, 7.0, ns, ST)                                          # stone spire
    if L0:
        for t in (.33, .66):
            r = 2.2 * (1 - t) + .1
            b.cone(cx, top + .6 + 7.0 * t - .15, cz, r, r, .3, ns, PS)                         # spire bands
        b.box(cx, top + 7.6, cz, .22, 1.9, .22, PS); b.box(cx, top + 8.6, cz, 1.0, .22, .22, PS)   # stone cross
    else:
        b.cone(cx, top + 7.6, cz, .3, 0.0, 1.0, 4, PS)


def dormer(b, cx, cz, H, N, L0):
    """Stone dormer on the parapet with a mullioned light and a pyramid slate roof; N is the outward face direction."""
    base = H + 2.8; w, dpt, h = 3.4, 2.6, 4.4
    tx, tzd = (w, dpt) if N[2] else (dpt, w)                             # box size across x and z
    b.box(cx, base, cz, tx, h, tzd, PS)
    b.frus(cx, base + h, cz, tx / 2 + .1, tzd / 2 + .1, 0, 0, 2.8, SL)
    fx, fz = cx + N[0] * (dpt / 2 + .04), cz + N[2] * (dpt / 2 + .04)
    b.box(fx, base + 1.0, fz, 2.2 if N[2] else .1, 2.4, .1 if N[2] else 2.2, GL)
    if L0:
        for k in (-1, 1):
            if N[2]: b.box(fx + k * .37, base + 1.0, fz + N[2] * .04, .08, 2.4, .08, PS)
            else: b.box(fx + N[0] * .04, base + 1.0, fz + k * .37, .08, 2.4, .08, PS)
        b.cone(cx, base + h + 2.8, cz, .22, 0.0, 1.0, 4, PS)


def tower(b, tz):
    L0 = b.lod == 0
    H = 42.0                                                             # body top, above road
    for k in range(3):                                                   # stepped, battered pier with course ledges
        y0 = RIVER + 5.0 * k; ha = lambda y: (12.0 - 1.6 * (y - RIVER) / 15.0, 9.0 - 1.6 * (y - RIVER) / 15.0)
        (a0, b0), (a1, b1) = ha(y0), ha(y0 + 5.0)
        ins = .3 if k else 0.0
        b.frus(0, y0, tz, a0 - ins, b0 - ins, a1, b1, 5.0, ST, top=(k < 2))
    b.poly([(-10.4, 0, tz - 7.4), (10.4, 0, tz - 7.4), (10.4, 0, tz + 7.4), (-10.4, 0, tz + 7.4)], PS, (0, 1, 0))   # pier top
    inner = -1 if tz > 0 else 1                                          # the side facing the other tower (walkway docks)
    for N, U in SIDES:
        wd = 2 * TX if N[2] else 2 * TZH
        ops = []
        if N[2]:
            ops.append((rarch(wd / 2, 0, 10.0, 10.5), DK, 1.2))          # carriageway portal
            ops.append((rarch(wd / 2, 22.6, 1.8, 5.0), GL, .3))          # tall arched light above the balcony
        gcs = [wd / 2 - 4.7, wd / 2 + 4.7] if N[2] else [wd / 2]
        tiers = [t for t in TIERS if not (N[2] and t[0] < 12)]
        facade(b, 0, tz, TX, TZH, N, U, 0, tiers, gcs, ops, lambda v0, h: N[2] == inner and v0 + h > 37.5, 23.0, 4.6, L0,
               door=[wd / 2] if N[2] else None)
        b.face(0, tz, TX, TZH, N, U, 0, H, ops, ST, .4)
        if L0 and N[2]: archring(b, 0, tz, TX, TZH, N, U, 0, wd / 2, 0, 10.0, 10.5, .9, .15)
    for y in (12.0, 24.0, 36.0):
        b.box(0, y, tz, 2 * TX + .6, .9, 2 * TZH + .6, PS)               # string courses
    b.box(0, H, tz, 2 * TX + 1.0, 1.2, 2 * TZH + 1.0, PS)                # cornice
    b.box(0, H + 1.2, tz, 2 * TX + .8, 1.6, 2 * TZH + .8, ST)            # parapet
    b.frus(0, H + 2.8, tz, 6.4, 4.4, 2.0, 1.2, 15.0, SL, top=True)       # tall steep slate roof: the dominant silhouette of the photographs
    b.box(0, H + 17.8, tz, 4.6, .5, 3.0, GD)                             # gilt cresting rail
    for sx in (-1, 1):
        for sz in (-1, 1): b.cone(sx * 1.9, H + 18.3, tz + sz * 1.1, .4, 0.0, 1.8, 4, GD)
    b.cone(0, H + 18.3, tz, .9, 0.0, 4.2, 6 if L0 else 4, GD)            # gilt fleuron spike (tallest point)
    if L0: b.box(0, H + 22.2, tz, .2, 1.4, .2, GD); b.box(0, H + 23.0, tz, .8, .2, .2, GD)
    for sx in (-1, 1):                                                   # parapet outline lights
        b.box(sx * (TX + .4), H + 2.8, tz, .25, .12, 2 * TZH + .8, LS)
    for sz in (-1, 1):
        b.box(0, H + 2.8, tz + sz * (TZH + .4), 2 * TX + .8, .12, .25, LS)
    for sx in (-1, 1):
        for sz in (-1, 1): turret(b, sx * (TX - 1.0), tz + sz * (TZH - 1.0), sx, sz, H, L0)
    for sz in (-1, 1):                                                   # four dormers on the long faces, one on each short face
        for sx in (-1, 1): dormer(b, sx * 3.8, tz + sz * (TZH + .4 - 1.3), H, (0, 0, sz), L0)
    for sx in (-1, 1): dormer(b, sx * (TX + .4 - 1.3), tz, H, (sx, 0, 0), L0)
    if L0:                                                              # merlons along the parapet (the short-face centre is the dormer)
        for k in range(3):
            u = -TX + (k + .5) * 2 * TX / 3
            for sz in (-1, 1): b.box(u, H + 2.8, tz + sz * (TZH + .2), 1.0, .8, .6, ST)
            if k != 1:
                v = -TZH + (k + .5) * 2 * TZH / 3
                for sx in (-1, 1): b.box(sx * (TX + .2), H + 2.8, tz + v, .6, .8, 1.0, ST)


def walkways(b):
    n = 10; pitch = 2 * ZIN / n
    for wx in (-5.8, 5.8):
        b.box(wx, WALK_Y - .4, 0, 3.2, .4, 2 * (ZIN - .5), TR)            # floor, ends short of the towers
        b.box(wx, WALK_Y + 4.0, 0, 3.4, .4, 2 * (ZIN - .5), TR)           # roof cap
        b.box(wx, WALK_Y + 4.4, 0, 1.2, .1, 2 * (ZIN - .5), LS)          # light strip along the roof
        b.box(wx, WALK_Y - .9, 0, 2.6, .12, 2 * (ZIN - .5), LS)          # light strip under the walkway
        for N, U in (((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 0, 1))):   # blue-framed glazing on both sides
            ops = [(rect(.12 + pitch * i, .4, pitch - .24, 3.2), WG, .08) for i in range(n)]
            b.wall((wx + N[0] * 1.5, WALK_Y, ZIN * (1 if N[0] > 0 else -1)), U, N, 2 * ZIN, 4.0, ops, BL, .08)


def slab(b, z0, z1):
    """One span of road: painted girder, carriageway, raised footways, edge lights, hand rails."""
    zc, ln = (z0 + z1) / 2, z1 - z0
    b.box(0, -1.5, zc, 2 * HALF, 1.25, ln, BL)                            # painted girder, top at -0.25
    b.box(0, -.25, zc, 2 * HALF - 1.6, .25, ln, DK, ('-y', '+x', '-x'))   # carriageway, top at road level
    for sx in (-1, 1):
        b.box(sx * (HALF - .9), 0, zc, 1.8, .6, ln, TR, ('-y', '-x' if sx > 0 else '+x'))  # raised footway
        b.box(sx * (HALF - .05), .6, zc, .1, .05, ln, LS)                  # footway edge light
        b.box(sx * (HALF - 1.8), .02, zc, .12, .05, ln, LS)                # carriageway edge light
        if b.lod == 0:
            b.box(sx * (HALF - .2), 1.35, zc, .16, .14, ln, TR)           # hand rail
            posts = int(ln // 3)
            for i in range(posts + 1):
                b.box(sx * (HALF - .2), .6, z0 + .2 + i * (ln - .4) / max(1, posts), .12, .8, .12, TR)  # rail posts


def deck(b):
    # Two bascule leaves meet at a narrow centre joint; the carriageway is their top surface. Fixed side spans run from the towers to the shore.
    ZE = 29.8                                                             # leaves stop inside the piers
    for z0, z1 in ((-ZE, -.25), (.25, ZE)): slab(b, z0, z1)
    for sg in (-1, 1):
        b.tube([(-6.5, -.9, sg * ZE), (6.5, -.9, sg * ZE)], .45, 4, BL)  # visible bascule hinge shaft
        slab(b, *sorted((sg * ZOUT, sg * (ZA - AD))))                    # side span, tower face to abutment face
    if b.lod == 0:
        for sx in (-1, 1):
            for z in (-20.0, -10.0, 10.0, 20.0, -50.0, -58.0, 50.0, 58.0):
                b.box(sx * (HALF - .5), 0, z, .25, 4.0, .25, BL)          # lamp post
                b.box(sx * (HALF - .5), 4.0, z, .6, .7, .6, LW, ('-y',))  # warm lantern


def clip_rect(pts, W, H):
    """Sutherland-Hodgman clip of a polygon to the cloth rectangle [0,W] x [0,H]."""
    for axis, bound, ge in ((0, 0, True), (0, W, False), (1, 0, True), (1, H, False)):
        out = []
        for i in range(len(pts)):
            a, c = pts[i - 1], pts[i]
            ina, inc = (a[axis] >= bound) == ge or a[axis] == bound, (c[axis] >= bound) == ge or c[axis] == bound
            if inc != ina:
                t = (bound - a[axis]) / (c[axis] - a[axis]); out.append((a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])))
            if inc: out.append(c)
        pts = out
        if len(pts) < 3: return []
    return pts


def band(p0, p1, half, e0=60.0, e1=60.0):
    """Long quad of half-width `half` along p0 -> p1, extended by e0 / e1 beyond the ends."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    a, c = (p0[0] - ux * e0, p0[1] - uy * e0), (p1[0] + ux * e1, p1[1] + uy * e1)
    return [(a[0] + nx * half, a[1] + ny * half), (c[0] + nx * half, c[1] + ny * half), (c[0] - nx * half, c[1] - ny * half), (a[0] - nx * half, a[1] - ny * half)]


def plus(W, H, w):
    """Cross of arm width w as ONE polygon (overlapping coplanar bars would z-fight)."""
    x0, x1, y0, y1 = (W - w) / 2, (W + w) / 2, (H - w) / 2, (H + w) / 2
    return [(0, y0), (x0, y0), (x0, 0), (x1, 0), (x1, y0), (W, y0), (W, y1), (x1, y1), (x1, H), (x0, H), (x0, y1), (0, y1)]


def arms(half, off, W=60.0, H=30.0):
    """Four diagonal arms from the flag centre to the corners; the stripe is shifted `off` toward the counter-clockwise side."""
    out = []
    for cx_, cy_ in ((0, 0), (W, 0), (W, H), (0, H)):
        d = math.hypot(cx_ - W / 2, cy_ - H / 2); ux, uy = (cx_ - W / 2) / d, (cy_ - H / 2) / d; nx, ny = -uy, ux
        out.append(band((W / 2 + nx * off, H / 2 + ny * off), (cx_ + nx * off, cy_ + ny * off), half, 0.0, 60.0))
    return out


def jack_layers(W):
    """Union Jack on the official 60 x 30 grid: blue field, white saltire (6), counterchanged red saltire (2), white cross (10), red cross (6)."""
    k = W / 60.0; full = [(0, 0), (60, 0), (60, 30), (0, 30)]
    L = [(FB, [full]), (FW, arms(3.0, 0.0)), (FR, arms(1.0, 1.0)), (FW, [plus(60, 30, 10)]), (FR, [plus(60, 30, 6)])]
    return [(m, [[(x * k, y * k) for x, y in c] for c in (clip_rect(pl, 60, 30) for pl in polys) if c]) for m, polys in L], W, W / 2


def england_layers(W, H):
    return [(FW, [[(0, 0), (W, 0), (W, H), (0, H)]]), (FR, [plus(W, H, H / 5.0)])], W, H


def flag(b, pole_z, top, layered, d):
    """Pole on the walkway roof plus a double-sided cloth in the z-y plane built from stacked coloured polygons (no texture). d = -1 flies toward -z."""
    layers, W, H = layered; px = 5.8
    b.box(px, top - 12.0, pole_z, .3, 12.0, .3, TR)
    b.cone(px, top, pole_z, .25, 0.0, 1.0, 6, GD)
    z0, y0 = pole_z + d * .15, top - .3 - H
    for k, (slot, polys) in enumerate(layers):
        for pl in polys:
            for side in (1, -1):
                pts = [(px + side * .12 * k, y0 + v, z0 + d * u) for u, v in pl]
                b.poly(pts if side * d < 0 else pts[::-1], slot, (side, 0, 0))


def flags(b):
    top = WALK_Y + 4.5 + 12.0                                             # poles stand on the walkway roof
    flag(b, 12.0, top, jack_layers(6.0), -1)                              # Union Jack
    flag(b, -12.0, top, england_layers(6.0, 3.6), -1)                     # St George's cross
    for wx in (-5.8, 5.8):                                                # stone crest pavilion at mid span
        b.box(wx, WALK_Y + 4.4, 0, 3.0, 2.4, 2.4, PS)
        b.frus(wx, WALK_Y + 6.8, 0, 1.5, 1.2, 0.0, 0.0, 1.8, SL)
        b.cone(wx, WALK_Y + 8.6, 0, .3, 0.0, 1.2, 4, GD)
        for sx in (-1, 1): b.box(wx + sx * 1.5, WALK_Y + 5.0, 0, .1, 1.2, .8, GL)


def chains(b):
    """Side-span suspension chains: a teal top chord and a white bottom chord forming a lattice truss, white hangers down to the deck."""
    L0 = b.lod == 0; steps = 10 if L0 else 5; z0, z1 = ZOUT, ZA - AD
    for s in (-1, 1):
        for xc in (-6.8, 6.8):
            up, lo = [], []
            for i in range(steps + 1):
                t = i / steps; z = s * (z0 + (z1 - z0) * t)
                base = 38.0 + (20.0 - 38.0) * t - 1.6 * 4 * t * (1 - t)
                dep = 3.2 * math.sin(math.pi * t) ** .8
                up.append((xc, base + dep / 2, z)); lo.append((xc, base - dep / 2, z))
            b.tube(up, .3, 4, BL); b.tube(lo, .25, 4, TR)
            if L0:
                for i in range(1, steps): b.tube([lo[i], (xc, 1.4, lo[i][2])], .09, 4, TR)           # hangers
                for i in range(steps): b.tube(list((up[i], lo[i + 1]) if i % 2 == 0 else (lo[i], up[i + 1])), .1, 4, TR)   # N-lattice
            for z, y in ((s * z0, 38.0), (s * z1, 20.0)): b.box(xc, y - .9, z, 1.6, 1.8, .7, PS)     # anchor blocks


def abutment(b, s):
    """Shore tower: stone body with a round portal for the road, window groups, hip roof and four small round turrets."""
    L0 = b.lod == 0; cz = s * ZA; y0 = -13.0; top = 22.0                  # ground is 13 m below road level
    for N, U in SIDES:
        wd = 2 * AW if N[2] else 2 * AD
        ops = []
        if N[2]: ops.append((rarch(wd / 2, 13.0, 10.0, 10.5), DK, 1.2))
        gcs = [wd / 2 - 3.6, wd / 2 + 3.6] if N[2] else [wd / 2]
        facade(b, 0, cz, AW, AD, N, U, y0, ((26.0, 3.0), (31.0, 3.0)), gcs, ops, lambda v0, h: False, None, 0, L0)
        b.face(0, cz, AW, AD, N, U, y0, top - y0, ops, ST, .4)
        if L0 and N[2]: archring(b, 0, cz, AW, AD, N, U, y0, wd / 2, 13.0, 10.0, 10.5, .9, .15)
    b.box(0, top, cz, 2 * AW + .8, .8, 2 * AD + .8, PS)
    b.box(0, top + .8, cz, 2 * AW + .6, 1.0, 2 * AD + .6, ST)
    b.frus(0, top + 1.8, cz, AW - .8, AD - .6, 1.8, 1.0, 7.0, SL, top=True)
    b.box(0, top + 8.8, cz, 3.2, .4, 1.4, GD)
    ns = 8 if L0 else 6
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, zz = sx * (AW - .9), cz + sz * (AD - .9)
            b.cone(cx, 8.0, zz, 1.0, 1.0, top + 4.0 - 8.0, ns, ST)
            b.cone(cx, top + 4.0, zz, 1.25, 0.0, 4.5, ns, ST)


def lattice(b):
    """Diagonal bracing on the walkway sides (LOD0): thin tubes just outside the glazing."""
    n = 10; pitch = 2 * ZIN / n
    for wx in (-5.8, 5.8):
        for sx in (-1, 1):
            xs = wx + sx * 1.56
            for i in range(n):
                z0 = -ZIN + i * pitch + .15; z1 = -ZIN + (i + 1) * pitch - .15
                b.tube([(xs, WALK_Y + .25, z0), (xs, WALK_Y + 3.75, z1)], .08, 4, TR)
                b.tube([(xs, WALK_Y + 3.75, z0), (xs, WALK_Y + .25, z1)], .08, 4, TR)


def make(lod):
    b = B(lod)
    for tz in (-TZ, TZ): tower(b, tz)
    walkways(b); deck(b); flags(b); chains(b)
    for sg in (-1, 1): abutment(b, sg)
    if b.lod == 0: lattice(b)
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
    acc = [j['accessors'][pr['attributes']['POSITION']] for pr in j['meshes'][0]['primitives']]   # every primitive: the gilt crown is in the lights one
    return [min(a['min'][i] for a in acc) for i in range(3)], [max(a['max'][i] for a in acc) for i in range(3)], j


def linear_hex(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)


COLORS = tuple(map(linear_hex, ('#c2a98f', '#4a5560', '#2a8aa8', '#e9e8e2', '#303943', '#d4a63c', '#2b2d31', '#fff0d0', '#8299ad', '#f4e7c4', '#1f3a8a', '#cf1f2e', '#f4f4f0', '#ddcdb2')))


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
        elif s in (ST, PS):
            y = (poly.center.z - DECK_TOP) / K                                  # real metres above road
            target = 2 if y < 15 else 3                                         # piers and tower base floodlit (low band), upper stone in the high band
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
    limit = 16000 if lod == 0 else 6000
    assert tris <= limit, f'LOD{lod} triangle budget exceeded: {tris} > {limit}'
    glb = os.path.join(OUT, f'towerbridge.lod{lod}.glb')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_image_format='AUTO', export_cameras=False, export_lights=False)
    mn, mx, doc = bounds_of(glb)
    assert -4.95 <= mn[0] and mx[0] <= 4.95 and -29.4 <= mn[2] and mx[2] <= 29.4, (mn, mx)   # envelope released by the owner: side spans and abutments
    assert -1.05 < mn[1] and 30.9 < mx[1] <= 31.8, (mn, mx)
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
