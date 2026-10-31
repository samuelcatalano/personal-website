# Procedural hairstyles: a scalp shell (grid with a per-azimuth hairline) plus flat-shaded locks (tapered blades) laid on
# the real head surface, found by ray casting. Angles: a = azimuth (0 = face, + toward +x, 180 = nape), e = elevation
# (0 = ear level, 90 = crown), h = height above the scalp in metres. Every vertex carries a tone (1 = base colour,
# <1 root/dark, >1 tip/light) that hair_part multiplies into the hair colour.
import math
import random

from mathutils import Vector

HEAD_BONE = "Head"


class Skull:
    def __init__(self, cx, cy, top, hw, hd, hh):
        self.cx, self.cy, self.top, self.hw, self.hd, self.hh = cx, cy, top, hw, hd, hh


def skull_from_body(points, height):
    top = max(p.z for p in points)
    head = [p for p in points if p.z > top - 0.10 * height]
    xs = [p.x for p in head]
    ys = [p.y for p in head]
    return Skull(0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys)), top,
                 0.5 * (max(xs) - min(xs)), 0.5 * (max(ys) - min(ys)), 0.15 * height)


class Head:
    def __init__(self, sk, bvh):
        self.sk, self.bvh = sk, bvh
        self.c = Vector((sk.cx, sk.cy, sk.top - 0.50 * sk.hh))  # ponytail: ear-level centre guess, rays do the real fit

    def dirv(self, a, e):
        a, e = math.radians(a), math.radians(e)
        return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))

    def surf(self, a, e):
        d = self.dirv(a, e)
        hit = self.bvh.ray_cast(self.c + d * 0.6, -d)
        if hit[0] is None:
            return self.c + d * 0.1, d
        return hit[0], d

    def pt(self, a, e, h):
        s, d = self.surf(a, e)
        return s + d * h

    def ps(self, a, e, h):
        s, d = self.surf(a, e)
        return s + d * h, d

    def cyl(self, a, z, clr):
        # point on the outermost body surface at azimuth a and height z (horizontal ray to the head axis), clr outside it
        ar = math.radians(a)
        d = Vector((math.sin(ar), -math.cos(ar), 0.0))
        o = Vector((self.sk.cx, self.sk.cy, z))
        hit = self.bvh.ray_cast(o + d * 0.5, -d)
        r = (hit[0] - o).dot(d) if hit[0] else 0.09
        return o + d * (r + clr), d


def smooth_interp(knots, a):
    aa = abs(((a + 180) % 360) - 180)
    for (x0, y0), (x1, y1) in zip(knots, knots[1:]):
        if aa <= x1:
            f = (aa - x0) / (x1 - x0)
            f = f * f * (3 - 2 * f)
            return y0 + (y1 - y0) * f
    return knots[-1][1]


def shell(hd, knots, height, tone, naz=28, rings=3):
    # smooth scalp cap: hairline(a) from knots, height(s) metres (s=0 crown, 1 edge), tone(s)
    verts, tones, faces = [hd.pt(0, 89.5, height(0))], [tone(0)], []
    for r in range(1, rings + 1):
        s = r / rings
        for j in range(naz):
            a = -180 + 360 * j / naz
            e = 90 - s * (90 - smooth_interp(knots, a))
            verts.append(hd.pt(a, e, height(s)))
            tones.append(tone(s))
    for j in range(naz):
        faces.append((0, 1 + j, 1 + (j + 1) % naz))
    for r in range(1, rings):
        o0, o1 = 1 + (r - 1) * naz, 1 + r * naz
        for j in range(naz):
            k = (j + 1) % naz
            faces += [(o0 + j, o1 + j, o1 + k), (o0 + j, o1 + k, o0 + k)]
    return verts, faces, tones


def tube(pn, w, t0, t1, th=0.9, prof=None, ns=5, wave=(0.0, 0.0), tl=None):
    # leaf-shaped tube through explicit (point, outward normal) pairs; w = half width, wave = (amplitude m, cycles) sideways
    n = len(pn)
    prof = prof or [0.75, 1.0, 0.92, 0.62, 0.25]
    P = [p for p, _ in pn]
    N = [q for _, q in pn]
    NS = ns
    verts, tones, faces = [], [], []
    for i in range(n):
        f = i / (n - 1)
        pi = f * (len(prof) - 1)
        i0 = min(int(pi), len(prof) - 2)
        r = prof[i0] + (prof[i0 + 1] - prof[i0]) * (pi - i0)
        t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
        side = N[i].cross(t).normalized()
        nn = side.cross(t).normalized()
        if nn.dot(N[i]) < 0:
            nn = -nn
        c0 = P[i] + side * (wave[0] * math.sin(2 * math.pi * wave[1] * f))
        tt = tl[i] if tl else t0 + (t1 - t0) * f
        for k in range(NS):
            th_ = 2 * math.pi * k / NS
            c, s = math.cos(th_), math.sin(th_)
            verts.append(c0 + side * (w * r * c) + nn * (w * r * th * s))
            tones.append(tt * (0.9 if s < 0 else 1.0))
    for i in range(n - 1):
        for k in range(NS):
            k2 = (k + 1) % NS
            a, b = i * NS, (i + 1) * NS
            faces += [(a + k, b + k, b + k2), (a + k, b + k2, a + k2)]
    for i, rev in ((0, True), (n - 1, False)):
        ring = verts[i * NS:(i + 1) * NS]
        verts.append(sum(ring, Vector()) / NS)
        tones.append(tones[i * NS])
        c = len(verts) - 1
        faces += [((i * NS + (k + 1) % NS, i * NS + k, c) if rev else (i * NS + k, i * NS + (k + 1) % NS, c)) for k in range(NS)]
    return verts, faces, tones


def lock(hd, keys, w, t0, t1, hs, th=0.9, prof=None, **kw):
    # keys = [(a, e)], hs = centre height above the skin per key
    return tube([hd.ps(k[0], k[1], hs[i]) for i, k in enumerate(keys)], w, t0, t1, th, prof, **kw)


class Acc:
    def __init__(self):
        self.v, self.f, self.t, self.w = [], [], [], []

    def add(self, part, wfn=None):
        v, f, t = part
        self.w += [(wfn(p) if wfn else {HEAD_BONE: 1.0}) for p in v]
        o = len(self.v)
        self.v += v
        self.f += [tuple(i + o for i in q) for q in f]
        self.t += t


def path(a0, a1, e0, e1, bend=0.0, n=4):
    return [(a0 + (a1 - a0) * i / (n - 1) + bend * math.sin(math.pi * i / (n - 1)), e0 + (e1 - e0) * i / (n - 1)) for i in range(n)]


def over_top(a0, u0, u1, conv=0.5, n=6, bend=0.0):
    # path along a meridian from front angle u0 over the crown (90) to the back angle u1 (deg from the front horizon)
    out = []
    for i in range(n):
        u = u0 + (u1 - u0) * i / (n - 1)
        a = a0 * (1 - conv * i / (n - 1)) + bend * math.sin(math.pi * i / (n - 1))
        out.append((a, u) if u <= 88 else ((a + 180, 180 - u) if u >= 92 else (a, 89.5)))
    return out



SPINE_BONE = "spine_03"
FLAT = {"curls"}  # styles whose faces are flat shaded (faceted curls)


def sstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def band(hd, a0, a1, elo, ehi, h, tone, naz=18, rows=3):
    # hair band between two elevation curves over an azimuth range (a may pass 180): the horseshoe of a bald crown
    verts, tones, faces = [], [], []
    for r in range(rows + 1):
        s = r / rows
        for j in range(naz + 1):
            a = a0 + (a1 - a0) * j / naz
            e = elo(a) + (ehi(a) - elo(a)) * s
            verts.append(hd.pt(a, e, h(a, s)))
            tones.append(tone(a, s))
    for r in range(rows):
        for j in range(naz):
            o0, o1 = r * (naz + 1) + j, (r + 1) * (naz + 1) + j
            faces += [(o0, o1, o1 + 1), (o0, o1 + 1, o0 + 1)]
    return verts, faces, tones


def beard(hd, h0, hc, tone, etop, cols=13, rows=5):
    # thin shell over jaw, cheeks and chin; the mouth is left open (hair band stays off the lips)
    verts, tones, faces = [], [], []
    for r in range(rows + 1):
        s = r / rows
        for j in range(cols):
            a = -84 + 168 * j / (cols - 1)
            eb = -49 + 27 * (abs(a) / 84) ** 1.5
            e = etop(a) + (eb - etop(a)) * s
            verts.append(hd.pt(a, e, h0 + (hc - h0) * math.exp(-(a / 28) ** 2) * sstep(s * 1.4)))
            tones.append(tone(a, s))
    for r in range(rows):
        for j in range(cols - 1):
            q = (r * cols + j, (r + 1) * cols + j, (r + 1) * cols + j + 1, r * cols + j + 1)
            m = sum((verts[i] for i in q), Vector()) / 4
            if abs(m.x) < 0.030 and 1.604 < m.z < 1.630:
                continue
            faces += [(q[0], q[1], q[2]), (q[0], q[2], q[3])]
    return verts, faces, tones


def moustache(hd, w, tone, h=0.009, drop=6, e0=-23):
    acc = Acc()
    for s in (-1, 1):
        acc.add(tube([hd.ps(0, e0, h), hd.ps(s * 7, e0 - 0.3, h), hd.ps(s * 14, e0 - drop * 0.6, h * 0.8), hd.ps(s * 19, e0 - drop, h * 0.5)],
                     w, tone, tone, th=0.8, prof=[0.9, 1.0, 0.85, 0.35], ns=4))
    return acc.v, acc.f, acc.t


def style_wavy_long(hd, acc):
    # A: middle part, waves to the collar, tucked behind the ears
    kn = [(0, 40), (25, 35), (50, 33), (75, 33), (90, 35), (102, 34), (118, 12), (150, -8), (180, -14)]
    acc.add(shell(hd, kn, lambda s: 0.014 - 0.002 * s, lambda s: 0.82 + 0.15 * s, naz=20))
    acc.add(lock(hd, [(0, 42), (0, 64), (0, 84)], 0.005, 0.3, 0.35, (0.017, 0.019, 0.019), th=0.5, prof=[0.9, 1.0, 0.9], ns=4))
    zs = ((1.63, 0.026), (1.58, 0.034), (1.525, 0.042))
    for s in (-1, 1):
        for i in range(5):
            f = i / 4
            pn = [hd.ps(s * (3 + 3 * f), 70, 0.017), hd.ps(s * (18 + 8 * f), 52, 0.021), hd.ps(s * (50 + 8 * f), 42, 0.025),
                  hd.ps(s * (84 + 6 * f), 40, 0.027), hd.ps(s * (108 + 8 * f), 27, 0.027)]
            pn += [hd.cyl(s * (124 + 24 * f + 6 * k), z, c + 0.004 * f) for k, (z, c) in enumerate(zs)]
            acc.add(tube(pn, 0.034, 0.82 + 0.1 * f, 1.3, th=0.65, prof=[0.4, 0.9, 1.0, 1.0, 0.95, 0.9, 0.8, 0.55][:len(pn)],
                         ns=4, wave=(0.011 * (1 if i % 2 else -1), 3.0)))
    for a0 in (-168, 168):  # nape cover
        pn = [hd.ps(a0 * 0.95, 70, 0.017), hd.ps(a0 * 0.99, 40, 0.022), hd.ps(a0, 10, 0.026), hd.cyl(a0, 1.60, 0.030), hd.cyl(a0, 1.53, 0.040)]
        acc.add(tube(pn, 0.040, 0.8, 1.25, th=0.65, ns=4, wave=(0.006, 2.0), prof=[0.6, 1.0, 1.0, 0.95, 0.6]))


def octa(c, r, tone, rot):
    # 8-triangle lump (smooth shaded it reads as a round curl), tone brighter on top
    ax = [Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    vs = [Vector((v.x * math.cos(rot) - v.y * math.sin(rot), v.x * math.sin(rot) + v.y * math.cos(rot), v.z)) for v in ax]
    fs = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return [c + v * r for v in vs], fs, [tone * (0.86 + 0.2 * (v.z + 1) / 2) for v in vs]


def style_curls(hd, acc):
    # B: short tight curls, rounded 3-4 cm of volume, clean hairline, short beard
    kn = [(0, 38), (45, 37), (75, 33), (92, 27), (110, 4), (140, -8), (180, -12)]
    naz, rings = 32, 8
    rnd = random.Random(7)
    hfun = lambda s: 0.010 + 0.033 * (1 - s ** 2.2)
    verts, tones, faces = [hd.pt(0, 89.5, hfun(0) + 0.008)], [1.1], []
    for r in range(1, rings + 1):
        s = r / rings
        for j in range(naz):
            a = -180 + 360 * j / naz
            e = 90 - s * (90 - smooth_interp(kn, a))
            rv = rnd.random()  # irregular curls: random height per vertex, ~1.5 cm cells
            bump = (0.021 * rv - 0.003) * (1 - 0.7 * s ** 4)
            verts.append(hd.pt(a, e, hfun(s) + bump))
            tones.append(0.7 + 0.5 * rv)
    for j in range(naz):
        faces.append((0, 1 + j, 1 + (j + 1) % naz))
    for r in range(1, rings):
        o0, o1 = 1 + (r - 1) * naz, 1 + r * naz
        for j in range(naz):
            k = (j + 1) % naz
            faces += [(o0 + j, o1 + j, o1 + k), (o0 + j, o1 + k, o0 + k)]
    acc.add((verts, faces, tones))
    acc.add(beard(hd, 0.0035, 0.007, lambda a, s: 2.3 - 0.9 * math.exp(-(a / 40) ** 2) * (1 - 0.5 * s),
                  lambda a: -27 + 17 * sstep((abs(a) - 20) / 50)))
    acc.add(moustache(hd, 0.0055, 1.5, h=0.0075, drop=4))


def ico(c, r, tone):
    # 20-triangle icosphere lump, vertex tone brighter on top
    t = (1 + 5 ** 0.5) / 2
    base = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
          (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    vs = [Vector(b).normalized() for b in base]
    return [c + v * r for v in vs], fs, [tone * (0.85 + 0.2 * (v.z + 1) / 2) for v in vs]


def style_ponytail(hd, acc):
    # C: tight scalp, swept back to a high tie, ponytail to mid-back, sideburns
    kn = [(0, 39), (45, 38), (75, 33), (90, 30), (108, 8), (140, -2), (180, -4)]
    acc.add(shell(hd, kn, lambda s: 0.0125 - 0.002 * s, lambda s: 0.8 + 0.2 * (1 - s), naz=24))
    for i in range(7):
        a0 = -48 + i * 16
        acc.add(lock(hd, over_top(a0, 44, 152, conv=0.8, bend=0, n=6), 0.020, 0.95, 1.25,
                     (0.014, 0.016, 0.017, 0.017, 0.016, 0.015), prof=[0.3, 0.9, 0.95, 0.85, 0.6, 0.3], ns=4))
    for s in (-1, 1):  # sideburns in front of the ears
        acc.add(lock(hd, [(s * 70, 24), (s * 72, 10), (s * 74, -4)], 0.008, 0.8, 0.9, (0.011, 0.012, 0.011), th=0.5, prof=[0.9, 1.0, 0.5], ns=4))
    T, TN = hd.ps(180, 24, 0.016)
    pts = [(T, TN), (T + Vector((0, 0.022, -0.004)), TN)]
    y = T.y + 0.045
    for z, wide in ((1.67, 0.0), (1.60, 0.0), (1.52, 0.0), (1.43, 0.0), (1.36, 0.0), (1.30, 0.0)):
        hit = hd.bvh.ray_cast(Vector((0, 1.0, z)), Vector((0, -1, 0)))
        by = hit[0].y if hit[0] else 0.04
        y = max(by + 0.052, y - 0.004)
        pts.append((Vector((0, y, z)), Vector((0, 1, 0))))
    i0 = len(acc.v)
    acc.add(tube(pts, 0.030, 1.0, 1.2, th=1.0, prof=[0.5, 0.8, 1.0, 1.0, 0.95, 0.8, 0.55, 0.22], ns=6,
                 tl=[0.5, 0.55, 1.0, 1.08, 1.12, 1.16, 1.2, 1.25]),
            wfn=lambda p: (lambda t: {HEAD_BONE: 1.0 - 0.4 * t, SPINE_BONE: 0.4 * t})(sstep((1.72 - p.z) / 0.45)))


def af(a):
    return abs(((a + 180) % 360) - 180)


def style_bald_horseshoe(hd, acc):
    # D: bald crown, short grey horseshoe fading to the nape, full two-tone beard
    elo = lambda a: 28 - 40 * sstep((af(a) - 100) / 50) + 3 * math.sin(math.radians(a) * 7)
    ehi = lambda a: 46 - 12 * sstep((af(a) - 96) / 84)
    acc.add(band(hd, 66, 294, elo, ehi, lambda a, s: (0.002 + 0.013 * math.sin(math.pi * s) ** 0.7) * sstep(min(a - 62, 298 - a) / 20), lambda a, s: 0.55 + 0.6 * s ** 0.8 + 0.12 * math.sin(math.radians(a) * 11),
                 naz=34, rows=4))
    acc.add(beard(hd, 0.008, 0.017, lambda a, s: (0.85 + 0.75 * math.exp(-(a / 24) ** 2) * (0.4 + 0.8 * s)),
                  lambda a: -24 + 14 * sstep((abs(a) - 22) / 50), cols=15))
    acc.add(moustache(hd, 0.0085, 1.2, h=0.011, drop=8, e0=-23))


def style_topknot(hd, acc):
    # E: shaved sides, slicked top into a top knot, thin moustache
    kn = [(0, 43), (50, 41), (80, 36), (100, 30), (125, 24), (180, 20)]
    acc.add(shell(hd, kn, lambda s: 0.013, lambda s: 0.5 + 0.2 * (1 - s), naz=24))
    acc.add(band(hd, 66, 294, lambda a: 14 - 14 * sstep((af(a) - 100) / 60), lambda a: 34 - 8 * sstep((af(a) - 100) / 60),
                 lambda a, s: 0.008 * sstep(min(a - 62, 298 - a) / 24), lambda a, s: 1.0 + 0.5 * (1 - s), naz=22, rows=2))  # shaved sides: dark stubble
    bun_a, bun_e = 180, 70
    for i in range(6):
        a0 = -40 + i * 16
        acc.add(lock(hd, over_top(a0, 44, 110, conv=0.9, n=5), 0.024, 0.95, 1.2,
                     (0.014, 0.016, 0.017, 0.016, 0.016), prof=[0.6, 1.0, 0.95, 0.7, 0.3], ns=4))
    c0 = hd.pt(bun_a, bun_e, 0.040)
    # uv sphere bun, slightly tall, banded tone, sitting on a short base
    ring, seg = 8, 6
    verts, tones, faces = [], [], []
    for v in range(seg + 1):
        p = math.pi * v / seg
        for u in range(ring):
            q = 2 * math.pi * u / ring
            verts.append(c0 + Vector((0.038 * math.sin(p) * math.cos(q), 0.038 * math.sin(p) * math.sin(q), 0.044 * math.cos(p))))
            tones.append(0.95 + 0.25 * math.cos(p) + 0.1 * math.sin(2 * q + p * 2))
    for v in range(seg):
        for u in range(ring):
            a, b = v * ring + u, v * ring + (u + 1) % ring
            faces += [(a, a + ring, b + ring), (a, b + ring, b)] if 0 < v < seg - 1 else ([(a, a + ring, b + ring)] if v == 0 else [(a, b + ring, b)])
    acc.add((verts, faces, tones))
    acc.add(moustache(hd, 0.0038, 0.8, h=0.0065, drop=1.8, e0=-22))


def style_pixie(hd, acc):
    # H: short layered pixie: cropped sides above the ears, a longer crown, and a side-swept fringe that crosses the
    # forehead from the right to the left temple (brows and eyes stay clear: locks end at elevation 40)
    kn = [(0, 41), (45, 38), (75, 30), (90, 22), (110, 6), (140, 0), (180, -6)]
    acc.add(shell(hd, kn, lambda s: 0.016 - 0.002 * s, lambda s: 0.8 + 0.2 * (1 - s), naz=24))
    for k in range(7):  # fringe, swept diagonally: the root sits on the right of the crown, the tip lands on the left brow line
        f = k / 6
        pn = [(34 - 10 * f, 80 - 6 * f), (14 - 16 * f, 62 - 8 * f), (-18 - 24 * f, 46 - 4 * f), (-44 - 22 * f, 41 - 2 * f)]
        acc.add(lock(hd, pn, 0.014, 0.9, 1.15, (0.019, 0.023, 0.024, 0.020), th=0.5, prof=[0.7, 1.0, 1.0, 0.45], ns=4))
    for s in (-1, 1):  # layered tufts: crown, temple, over the ear, nape
        for i, (a0, e0, e1, hh) in enumerate(((60, 78, 40, 0.024), (88, 72, 22, 0.024), (112, 62, 12, 0.026), (140, 56, 2, 0.026), (166, 50, -10, 0.026))):
            acc.add(lock(hd, [(s * a0, e0), (s * (a0 + 6), (e0 + e1) / 2), (s * (a0 + 10), e1)], 0.026, 0.85 + 0.05 * i, 1.25, (hh - 0.006, hh, hh - 0.002),
                         th=0.6, prof=[0.8, 1.0, 0.45], ns=4))


STYLES = {"wavy_long": style_wavy_long, "curls": style_curls, "ponytail": style_ponytail,
          "bald_horseshoe": style_bald_horseshoe, "topknot": style_topknot, "pixie": style_pixie}


def hair_mesh(name, sk, bvh):
    hd = Head(sk, bvh)
    acc = Acc()
    STYLES[name](hd, acc)
    return acc.v, acc.f, acc.t, acc.w
