# Garment styling for the NPC pack, vertex colours only: per-vertex colour functions on the shell, plus small decal
# meshes that are ray-cast onto the shell (stripes, pockets, prints, cuffs, collars). Rest pose, metres, front = -y.
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def mul(c, f):
    return (min(1.0, c[0] * f), min(1.0, c[1] * f), min(1.0, c[2] * f), 1.0)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def cast(bvhs, o, d, lift, nth=1):
    # first (or second, to skip the inner wall of a solidified shell) hit of the nearest bvh, moved `lift` along d
    hit = None
    for b in bvhs:
        h = b.ray_cast(o, d)
        if h[0] is not None and (hit is None or h[3] < hit[1][3]):
            hit = (b, h)
    if hit is None:
        return None
    b, h = hit
    loc = h[0]
    if nth == 2:
        h2 = b.ray_cast(loc + d * 0.0015, d)
        if h2[0] is not None:
            loc = h2[0]
    return loc + d * lift


def decal(H, bvhs, rows, lift, colour, nth=1, wrap=False):
    # rows: list of rows of (origin, dir) rays; neighbouring hits become quads; a missed ray drops its quads
    verts, idx = [], []
    for row in rows:
        r = []
        for o, d in row:
            p = cast(bvhs, o, d, lift, nth) if o is not None else None
            if p is None:
                r.append(None)
            else:
                r.append(len(verts))
                verts.append(p)
        idx.append(r)
    faces = []
    for i in range(len(idx) - 1):
        n = len(idx[i])
        for j in range(n if wrap else n - 1):
            k = (j + 1) % n
            q = (idx[i][j], idx[i][k], idx[i + 1][k], idx[i + 1][j])
            if None not in q:
                faces.append(q)
    if not faces:
        return []
    used = sorted({i for f in faces for i in f})
    rm = {o: n for n, o in enumerate(used)}
    vv = [verts[i] for i in used]
    return [H.part(vv, [tuple(rm[i] for i in f) for f in faces], [H.sw(v) for v in vv], colour)]


def quad(H, pts, colour):
    return H.part(pts, [(0, 1, 2, 3)], [H.sw(v) for v in pts], colour)


def chain(B, names, ss):
    # (point, unit axis) samples along consecutive bones, s in 0..1 over their total length
    sg = [B[n] for n in names]
    ls = [(t - h).length for h, t in sg]
    tot = sum(ls)
    out = []
    for s in ss:
        x = s * tot
        for k, ((h, t), L) in enumerate(zip(sg, ls)):
            if x <= L or k == len(sg) - 1:
                out.append((h + (t - h) * clamp(x / L), (t - h).normalized()))
                break
            x -= L
    return out


def lateral(ax, dx):
    d = Vector((dx, 0.0, 0.0))
    d = d - ax * d.dot(ax)
    return d.normalized()


def strip(H, bvhs, pts, dx, w, lift, colour, nth=2, off=0.0):
    # a stripe of width w running along a limb on its outer (lateral) side
    rows = []
    for c, ax in pts:
        d = lateral(ax, dx)
        p = ax.cross(d).normalized()
        c = c + p * off
        rows.append([(c - p * w / 2, d), (c + p * w / 2, d)])
    return decal(H, bvhs, rows, lift, colour, nth)


def limb_ring(H, bvhs, c0, c1, ax, lift, colour, n=12, w0=0.0, nth=2):
    # a band around a limb between axis points c0 and c1
    u = ax.cross(Vector((0, 0, 1)))
    if u.length < 0.1:
        u = ax.cross(Vector((1, 0, 0)))
    u.normalize()
    v = ax.cross(u).normalized()
    rows = []
    for c in (c0, c1):
        rows.append([(c, u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) for k in range(n)])
    return decal(H, bvhs, rows, lift, colour, nth, wrap=True)


def torso_ring(H, bvhs, z0, z1, lift, colour, n=26, nth=2, yc=0.03):
    rows = []
    for z in (z0, z1):
        rows.append([(Vector((0, yc, z)), Vector((math.sin(2 * math.pi * k / n), -math.cos(2 * math.pi * k / n), 0)))
                     for k in range(n)])
    return decal(H, bvhs, rows, lift, colour, nth, wrap=True)


def neck_y(z):
    return -0.014 - 0.3265 * (z - 1.549)


def collar(H, body_bvh, spec, colour, skip=0.0, n=18):
    # a ring around the neck from the body surface: spec = [(z, gap)] bottom to top
    rows = []
    for z, gap in spec:
        row = []
        for k in range(n):
            a = 2 * math.pi * k / n
            if skip and (a < skip or a > 2 * math.pi - skip):
                row.append((None, None))
            else:
                row.append((Vector((0, neck_y(z), z)), Vector((math.sin(a), -math.cos(a), 0))))
        rows.append(row)
    # per-row gap: build with decal per consecutive pair is not possible, so cast here
    pts = []
    for (z, gap), row in zip(spec, rows):
        pts.append([cast([body_bvh], o, d, gap) if o is not None else None for o, d in row])
    verts, idx = [], []
    for r in pts:
        ri = []
        for p in r:
            if p is None:
                ri.append(None)
            else:
                ri.append(len(verts))
                verts.append(p)
        idx.append(ri)
    faces = []
    for i in range(len(idx) - 1):
        for j in range(n):
            k = (j + 1) % n
            q = (idx[i][j], idx[i][k], idx[i + 1][k], idx[i + 1][j])
            if None not in q:
                faces.append(q)
    if not faces:
        return []
    used = sorted({i for f in faces for i in f})
    rm = {o: m for m, o in enumerate(used)}
    vv = [verts[i] for i in used]
    return [H.part(vv, [tuple(rm[i] for i in f) for f in faces], [H.sw(v) for v in vv], colour)]


def bisect_z(me, zs):
    bm = bmesh.new()
    bm.from_mesh(me)
    for z in zs:
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1), dist=1e-6)
    bm.to_mesh(me)
    bm.free()
    me.update()


def cut_forearm(me, B, side, tcut):
    # rolled sleeves: drop the shell beyond fraction tcut of the lowerarm (bisect across the arm first for a clean edge)
    h, t = B[f"lowerarm_{side}"]
    ax = (t - h)
    L = ax.length
    ax = ax / L
    pc = h + ax * (L * tcut)
    bm = bmesh.new()
    bm.from_mesh(me)

    def near(p):
        u = clamp((p - h).dot(ax) / L)
        return (h + ax * (u * L) - p).length < 0.16 and (p - h).dot(ax) > -0.05
    geom = [f for f in bm.faces if near(f.calc_center_median())]
    gg = geom + [e for f in geom for e in f.edges] + [v for f in geom for v in f.verts]
    bmesh.ops.bisect_plane(bm, geom=list(set(gg)), plane_co=pc, plane_no=ax, dist=1e-6)
    drop = [f for f in bm.faces if near(f.calc_center_median()) and (f.calc_center_median() - pc).dot(ax) > 0
            and (f.calc_center_median() - h).dot(ax) > 0]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()


ARM_BONES = ["spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r",
             "lowerarm_l", "lowerarm_r"]


def outdir(B, p, names):
    best = None
    for n in names:
        h, t = B[n]
        ab = t - h
        u = clamp((p - h).dot(ab) / max(ab.length_squared, 1e-9))
        q = h + ab * u
        d = (p - q).length
        if best is None or d < best[0]:
            best = (d, p - q)
    v = best[1]
    return v.normalized() if v.length > 1e-6 else Vector((0, -1, 0))


def sleeve_t(H, verts, side):
    # furthest sleeve end along the lowerarm, as a fraction of its length
    h, t = H.B[f"lowerarm_{side}"]
    ax = t - h
    L = ax.length
    best = 0.0
    for p in verts:
        u = (p - h).dot(ax) / (L * L)
        if u > 0 and (h + ax * u - p).length < 0.07:
            best = max(best, u)
    return best


def mesh_data(me):
    return [v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons]


PUFF_P = 0.105
PUFF_Z0 = 0.905


def dress_top(H, me, kind, C, body_bvh):
    # returns the list of parts for one top: the shell with per-vertex colours, then its decals
    B = H.B
    if kind == "puffer":
        zs = []
        k = 0
        while PUFF_Z0 + k * PUFF_P < 1.52:
            g = PUFF_Z0 + k * PUFF_P
            zs += [g - 0.0045, g + 0.0045]
            k += 1
        bisect_z(me, zs)
    HEM = mul(C["body"], 0.62) if kind == "puffer" else C["trim"] if kind in ("zip_jacket", "hoodie", "sweater_print") else None
    HEM_H = 0.03
    if HEM:  # hem band painted on the shell itself (two close rings give a crisp edge), no floating decal
        bisect_z(me, [C["zlo"] + HEM_H - 0.001, C["zlo"] + HEM_H])
    if kind == "shirt":
        for s in ("l", "r"):
            cut_forearm(me, B, s, C["roll_t"])
    verts, faces = mesh_data(me)
    cols = []
    for i, p in enumerate(verts):
        w = H.sw(p)
        arm = sum(w.get(n, 0.0) for n in ("upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"))
        f = smooth(0.35, 0.85, arm)
        c = mix(C["body"], C["sleeve"], f)
        if HEM and p.z < C["zlo"] + HEM_H - 0.0005 and f < 0.5:
            c = HEM
        elif kind == "puffer":
            ph = (p.z - PUFF_Z0) / PUFF_P
            puff = 0.5 - 0.5 * math.cos(2 * math.pi * ph)
            dg = abs(((p.z - PUFF_Z0 + PUFF_P / 2) % PUFF_P) - PUFF_P / 2)
            c = mul(c, 0.52 if dg < 0.0052 else 0.88 + 0.16 * puff)
            if p.z > PUFF_Z0 - 0.02:
                verts[i] = p + outdir(B, p, ARM_BONES) * (0.009 * puff * (1.0 - 0.6 * smooth(1.38, 1.52, p.z)))
        elif kind == "hoodie":
            c = mul(c, 0.96 + 0.06 * math.sin(p.z * 60))  # faint knit
        cols.append(c)
    bvh = BVHTree.FromPolygons(verts, faces)
    bv = [bvh]
    parts = [H.part(verts, faces, [H.sw(v) for v in verts], cols)]
    zlo = C["zlo"]
    arm_l = chain(B, ["upperarm_l", "lowerarm_l"], [i / 12 for i in range(1, 12)])
    arm_r = chain(B, ["upperarm_r", "lowerarm_r"], [i / 12 for i in range(1, 12)])
    tend = {s: sleeve_t(H, verts, s) for s in ("l", "r")}

    gap = C["gap"]

    def cuffs(colour, width=0.07, lift=0.0):
        out = []
        for s in ("l", "r"):
            h, t = B[f"lowerarm_{s}"]
            L = (t - h).length
            ax = (t - h).normalized()
            te = tend[s] + 0.03
            u = ax.cross(Vector((0, 0, 1))).normalized()
            v = ax.cross(u).normalized()
            rows = []
            for tt in (te - width / L, te - width / L * 0.5, te):
                c = h + ax * (L * tt)
                rows.append([(c, u * math.cos(a * math.pi / 6) + v * math.sin(a * math.pi / 6)) for a in range(12)])
            out += decal(H, [body_bvh], rows, gap + 0.004 + lift, colour, 1, wrap=True)
        return out

    def hem(colour, z1=0.07, lift=0.0):
        # cast onto the shell itself (second hit = outer wall), so the band hugs the cloth and the bottom edge stays level
        rows = [[(Vector((0, 0.03, z)), Vector((math.sin(2 * math.pi * k / 26), -math.cos(2 * math.pi * k / 26), 0))) for k in range(26)]
                for z in (zlo + 0.0005, zlo + z1 * 0.5, zlo + z1)]
        return decal(H, bv, rows, 0.006 + lift, colour, 2, wrap=True)

    if kind == "zip_jacket":
        parts += cuffs(C["trim"])
        parts += collar(H, body_bvh, [(1.49, 0.012), (1.545, 0.014), (1.55, 0.004)], C["trim"], skip=0.0)
        for dx, a in ((1, arm_l), (-1, arm_r)):
            parts += strip(H, bv, a, dx, 0.022, 0.004, C["accent"])
            parts += strip(H, bv, a, dx, 0.005, 0.0055, C["trim"], off=0.0)
        for dx in (1, -1):
            rows = []
            for z in [zlo + 0.05 + i * 0.045 for i in range(11)]:
                rows.append([(Vector((0, 0.03 - 0.0, z)), Vector((dx, 0, 0)))])
            side = []
            zz = [zlo + 0.05 + i * 0.045 for i in range(11)]
            side = [[(Vector((0, 0.03 - 0.014, z)), Vector((dx, 0, 0))), (Vector((0, 0.03 + 0.014, z)), Vector((dx, 0, 0)))]
                    for z in zz]
            parts += decal(H, bv, side, 0.004, C["accent"], 2)
        zz = [zlo + 0.01 + i * 0.05 for i in range(12)]
        parts += decal(H, bv, [[(Vector((-0.004, -0.6, z)), Vector((0, 1, 0))), (Vector((0.004, -0.6, z)), Vector((0, 1, 0)))]
                               for z in zz], -0.004, C["zip"], 1)
        pull = [Vector((-0.012, -0.6, 1.40)), Vector((0.012, -0.6, 1.40)), Vector((0.012, -0.6, 1.355)), Vector((-0.012, -0.6, 1.355))]
        pts = [cast(bv, o, Vector((0, 1, 0)), -0.007) for o in pull]
        if None not in pts:
            parts.append(quad(H, pts, C["accent"]))
        # chest zip pocket lines
        for sx in (-1, 1):
            parts += decal(H, bv, [[(Vector((sx * 0.065, -0.6, 1.285)), Vector((0, 1, 0))), (Vector((sx * 0.115, -0.6, 1.285)), Vector((0, 1, 0)))],
                                   [(Vector((sx * 0.065, -0.6, 1.279)), Vector((0, 1, 0))), (Vector((sx * 0.115, -0.6, 1.279)), Vector((0, 1, 0)))]],
                           -0.004, C["zip"], 1)
    elif kind == "puffer":
        parts += cuffs(mul(C["sleeve"], 0.62), width=0.06, lift=0.008)
        for k in range(1, 6):
            g = PUFF_Z0 + k * PUFF_P
            parts += torso_ring(H, bv, g - 0.005, g + 0.005, 0.003, mul(C["body"], 0.4))
        parts += collar(H, body_bvh, [(1.485, 0.016), (1.525, 0.034), (1.575, 0.036), (1.60, 0.024), (1.602, 0.009)], C["body"])
        parts += collar(H, body_bvh, [(1.575, 0.036), (1.60, 0.024)], mul(C["body"], 0.55), n=18)
        zz = [1.30, 1.34, 1.38]
        parts += decal(H, bv, [[(Vector((-0.004, -0.6, 1.0)), Vector((0, 1, 0))), (Vector((0.004, -0.6, 1.0)), Vector((0, 1, 0)))],
                               [(Vector((-0.004, -0.6, 1.47)), Vector((0, 1, 0))), (Vector((0.004, -0.6, 1.47)), Vector((0, 1, 0)))]],
                       -0.012, mul(C["body"], 0.4), 1)
    elif kind == "hoodie":
        parts += cuffs(C["trim"])
        parts += collar(H, body_bvh, [(1.49, 0.014), (1.53, 0.026), (1.55, 0.026), (1.56, 0.012)], C["trim"], skip=0.0)
        # hood bunched behind the neck
        hit = bvh.ray_cast(Vector((0, 0.6, 1.48)), Vector((0, -1, 0)))
        yb = hit[0].y if hit[0] is not None else 0.1
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=1.0)
        cen = Vector((0.0, yb - 0.032, 1.495))
        hv = []
        for v in bm.verts:
            hv.append(cen + Vector((v.co.x * 0.115, v.co.y * 0.080, v.co.z * 0.072)))
        bm.faces.ensure_lookup_table()
        ix = {v: i for i, v in enumerate(bm.verts)}
        hf = [tuple(ix[v] for v in f.verts) for f in bm.faces if f.calc_center_median().y > -0.05]
        bm.free()
        used = sorted({i for f in hf for i in f})
        rm = {o: m for m, o in enumerate(used)}
        hv2 = [hv[i] for i in used]
        hcols = [mul(C["body"], 0.78 + 0.22 * clamp((p.z - 1.43) / 0.14) if False else 0.92) for p in hv2]
        parts.append(H.part(hv2, [tuple(rm[i] for i in f) for f in hf], [H.sw(v) for v in hv2], hcols))
        # kangaroo pocket
        rows = [[(Vector((x, -0.6, z)), Vector((0, 1, 0))) for x in (-0.12, -0.08, -0.04, 0.0, 0.04, 0.08, 0.12)]
                for z in (zlo + 0.07, zlo + 0.11, zlo + 0.15, zlo + 0.19)]
        parts += decal(H, bv, rows, -0.007, mul(C["body"], 0.8), 1)
        for sx in (-1, 1):  # pocket openings
            parts += decal(H, bv, [[(Vector((sx * 0.105, -0.6, zlo + 0.08)), Vector((0, 1, 0))), (Vector((sx * 0.12, -0.6, zlo + 0.08)), Vector((0, 1, 0)))],
                                   [(Vector((sx * 0.07, -0.6, zlo + 0.185)), Vector((0, 1, 0))), (Vector((sx * 0.085, -0.6, zlo + 0.185)), Vector((0, 1, 0)))]],
                           -0.009, mul(C["body"], 0.5), 1)
        # drawstrings
        for sx in (-1, 1):
            parts += decal(H, bv, [[(Vector((sx * 0.032, -0.6, z)), Vector((0, 1, 0))), (Vector((sx * 0.040, -0.6, z)), Vector((0, 1, 0)))]
                                   for z in (1.475, 1.44, 1.405, 1.37, 1.33)], -0.0045, C["accent"], 1)
    elif kind == "sweater_print":
        parts += cuffs(C["trim"], 0.05)
        parts += collar(H, body_bvh, [(1.49, 0.012), (1.52, 0.018), (1.552, 0.018), (1.556, 0.007)], C["trim"])
        rows = [[(Vector((x, -0.6, z)), Vector((0, 1, 0))) for x in (-0.07, -0.035, 0.0, 0.035, 0.07)]
                for z in (1.17, 1.21, 1.25, 1.29)]
        parts += decal(H, bv, rows, -0.008, C["accent"], 1)
        for k, (zc, hw) in enumerate(((1.268, 0.05), (1.243, 0.036), (1.218, 0.05), (1.193, 0.026))):
            parts += decal(H, bv, [[(Vector((-hw, -0.6, zc + 0.005)), Vector((0, 1, 0))), (Vector((hw, -0.6, zc + 0.005)), Vector((0, 1, 0)))],
                                   [(Vector((-hw, -0.6, zc - 0.005)), Vector((0, 1, 0))), (Vector((hw, -0.6, zc - 0.005)), Vector((0, 1, 0)))]],
                           -0.011, C["print2"], 1)
    elif kind == "shirt":
        parts += collar(H, body_bvh, [(1.485, 0.012), (1.52, 0.014), (1.553, 0.016), (1.556, 0.006)], C["body"], skip=0.38)
        # collar flaps standing off the shoulders
        for sx in (-1, 1):
            tops = [(sx * 0.012, 1.553), (sx * 0.06, 1.538)]
            bots = [(sx * 0.07, 1.486), (sx * 0.016, 1.455)]
            lifts = [-0.019, -0.019, -0.004, -0.004]
            pts = [cast([bvh, body_bvh], Vector((x, -0.6, z)), Vector((0, 1, 0)), lf) for (x, z), lf in zip(tops + bots, lifts)]
            if None not in pts:
                parts.append(quad(H, pts, mul(C["body"], 1.02)))
                parts.append(quad(H, [pts[0], pts[1], pts[1] - Vector((0, 0, 0.004)), pts[0] - Vector((0, 0, 0.004))], mul(C["body"], 0.8)))
        # placket and buttons
        z0 = 1.50
        parts += decal(H, bv, [[(Vector((-0.016, -0.6, z)), Vector((0, 1, 0))), (Vector((0.016, -0.6, z)), Vector((0, 1, 0)))]
                               for z in [1.47 - i * 0.045 for i in range(9)]], -0.003, mul(C["body"], 0.93), 1)
        for z in [1.43 - i * 0.075 for i in range(5)]:
            pts = [cast(bv, Vector((x, -0.6, zz)), Vector((0, 1, 0)), -0.0055)
                   for x, zz in ((-0.007, z + 0.007), (0.007, z + 0.007), (0.007, z - 0.007), (-0.007, z - 0.007))]
            if None not in pts:
                parts.append(quad(H, pts, C["accent"]))
        # chest pocket on the wearer's left, a cuff roll band on each forearm
        parts += decal(H, bv, [[(Vector((x, -0.6, z)), Vector((0, 1, 0))) for x in (0.045, 0.075, 0.105)] for z in (1.31, 1.26, 1.21)],
                       -0.0035, mul(C["body"], 0.95), 1)
        for s, dx in (("l", 1), ("r", -1)):
            h, t = B[f"lowerarm_{s}"]
            L = (t - h).length
            ax = (t - h).normalized()
            te = C["roll_t"]
            parts += limb_ring(H, bv, h + ax * (L * (te - 0.17)), h + ax * (L * (te + 0.005)), ax, 0.010, mul(C["body"], 1.04))
            parts += limb_ring(H, bv, h + ax * (L * (te - 0.17)), h + ax * (L * (te - 0.16)), ax, 0.011, mul(C["body"], 0.8))
        # no hem ring on the shirt: it hangs untucked over the trousers, with no trim
    return parts


def dress_bottom(H, me, kind, C, body_bvh):
    B = H.B
    verts, faces = mesh_data(me)
    cols = []
    for p in verts:
        c = C["base"]
        z = p.z
        if kind == "jeans":
            f = 0.80 + 0.24 * smooth(0.08, 0.55, z) + 0.08 * smooth(0.55, 0.9, z)
            f += 0.10 * math.exp(-((z - 0.50) / 0.07) ** 2) * (1.0 if p.y < 0.0 else 0.4)  # faded knees
            f += 0.06 * math.exp(-((z - 0.82) / 0.07) ** 2)
            f *= 0.96 + 0.07 * math.sin(p.z * 90 + p.x * 40)  # whisker streaks
            c = mul(c, f)
        elif kind == "chinos":
            c = mul(c, 0.86 + 0.16 * smooth(0.1, 0.8, z))
        elif kind == "cargo":
            c = mul(c, 0.88 + 0.12 * smooth(0.1, 0.8, z))
        elif kind == "track":
            c = mul(c, 0.9 + 0.10 * smooth(0.1, 0.8, z))
        cols.append(c)
    bvh = BVHTree.FromPolygons(verts, faces)
    bv = [bvh]
    parts = [H.part(verts, faces, [H.sw(v) for v in verts], cols)]
    ss = [0.05 + i * 0.045 for i in range(21)]
    pathl = chain(B, ["thigh_l", "calf_l"], [min(0.93, s) for s in ss])
    pathr = chain(B, ["thigh_r", "calf_r"], [min(0.93, s) for s in ss])
    zlo, zhi = C["zlo"], C["zhi"]
    if kind == "jeans":
        for dx, pa in ((1, pathl), (-1, pathr)):
            parts += strip(H, bv, pa, dx, 0.005, 0.0018, mul(C["base"], 0.62))
            parts += strip(H, bv, pa, 0, 0.0, 0.0, C["base"]) if False else []
        # fly and pocket stitching
        parts += decal(H, bv, [[(Vector((-0.003, -0.6, z)), Vector((0, 1, 0))), (Vector((0.003, -0.6, z)), Vector((0, 1, 0)))]
                               for z in (zhi - 0.15, zhi - 0.10, zhi - 0.04)], -0.002, mul(C["base"], 0.6), 1)
        parts += torso_ring(H, bv, zlo + 0.002, zlo + 0.03, 0.003, mul(C["base"], 0.62)) if False else []
        for s in ("l", "r"):
            h, t = B[f"calf_{s}"]
            ax = (t - h).normalized()
            parts += limb_ring(H, bv, h + ax * 0.34, h + ax * 0.40, ax, 0.003, mul(C["base"], 0.7))
    elif kind == "chinos":
        for dx, pa in ((1, pathl), (-1, pathr)):
            parts += strip(H, bv, pa, dx, 0.004, 0.0018, mul(C["base"], 0.72))
        for s in ("l", "r"):
            h, t = B[f"calf_{s}"]
            ax = (t - h).normalized()
            parts += limb_ring(H, bv, h + ax * 0.31, h + ax * 0.375, ax, 0.007, mul(C["base"], 1.10))  # rolled cuff
            parts += limb_ring(H, bv, h + ax * 0.31, h + ax * 0.318, ax, 0.0075, mul(C["base"], 0.7))
        parts += decal(H, bv, [[(Vector((-0.003, -0.6, z)), Vector((0, 1, 0))), (Vector((0.003, -0.6, z)), Vector((0, 1, 0)))]
                               for z in (zhi - 0.14, zhi - 0.06)], -0.002, mul(C["base"], 0.65), 1)
    elif kind == "cargo":
        for s, dx in (("l", 1), ("r", -1)):
            h, t = B[f"thigh_{s}"]
            L = (t - h).length
            ax = (t - h).normalized()
            d0 = lateral(ax, dx)
            for t0, t1, lift, col in ((0.30, 0.66, 0.011, mul(C["base"], 1.06)), (0.30, 0.37, 0.013, mul(C["base"], 0.78))):
                rows = []
                for tt in [t0 + (t1 - t0) * i / 4 for i in range(5)]:
                    c = h + ax * (L * tt)
                    rows.append([(c, Matrix.Rotation(math.radians(a), 3, ax) @ d0) for a in (-8, 6, 20, 34, 48)])
                parts += decal(H, bv, rows, lift, col, 2)
            c = h + ax * (L * 0.345)
            pts = [cast(bv, c + d0 * 0.0, Matrix.Rotation(math.radians(a), 3, ax) @ d0, 0.016, 2) for a in (30, 34)]
            parts += decal(H, bv, [[(c, Matrix.Rotation(math.radians(a), 3, ax) @ d0) for a in (26, 38)],
                                   [(c - ax * 0.012, Matrix.Rotation(math.radians(a), 3, ax) @ d0) for a in (26, 38)]],
                           0.0155, mul(C["base"], 0.5), 2)
        for dx, pa in ((1, pathl), (-1, pathr)):
            parts += strip(H, bv, pa, dx, 0.004, 0.0018, mul(C["base"], 0.7))
        for s in ("l", "r"):
            h, t = B[f"calf_{s}"]
            ax = (t - h).normalized()
            parts += limb_ring(H, bv, h + ax * 0.33, h + ax * 0.375, ax, 0.004, mul(C["base"], 0.78))
    elif kind == "track":
        for dx, pa in ((1, pathl), (-1, pathr)):
            parts += strip(H, bv, pa, dx, 0.024, 0.003, C["stripe"])
            parts += strip(H, bv, pa, dx, 0.005, 0.0045, mul(C["base"], 0.7))
        for s in ("l", "r"):
            h, t = B[f"calf_{s}"]
            ax = (t - h).normalized()
            parts += limb_ring(H, bv, h + ax * 0.32, h + ax * 0.375, ax, 0.004, mul(C["base"], 0.62))
    if C.get("belt"):
        parts += torso_ring(H, bv, zhi - 0.05, zhi - 0.01, 0.004, C["belt"], yc=0.0)
        pts = [cast(bv, Vector((x, -0.6, z)), Vector((0, 1, 0)), -0.007)
               for x, z in ((-0.017, zhi - 0.008), (0.017, zhi - 0.008), (0.017, zhi - 0.052), (-0.017, zhi - 0.052))]
        if None not in pts:
            parts.append(quad(H, pts, C["buckle"]))
            pts2 = [cast(bv, Vector((x, -0.6, z)), Vector((0, 1, 0)), -0.0085)
                    for x, z in ((-0.010, zhi - 0.02), (0.010, zhi - 0.02), (0.010, zhi - 0.04), (-0.010, zhi - 0.04))]
            if None not in pts2:
                parts.append(quad(H, pts2, C["belt"]))
    return parts
