# Build the five NPCs from npc_a_walk.blend and the body coordinates written by npc_bodies.py.
# Each body is a collapse-decimated copy; the jacket and jeans are shelled off it and the shoes are lofted from the feet; all follow their bones
# rigidly; the hair is a procedural planoC style; each NPC is one vertex-coloured mesh. All five share the armature of
# NPC_A and the retargeted NPC_Walk clip, and they go into one GLB.
# Run: /opt/homebrew/bin/blender -b --factory-startup --python npc_build.py
import os
import bmesh
import json
import math
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

OUT = os.environ["NPC_OUT"]  # .blend, PNG and GLB outputs
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # hair_styles.py sits next to this script
import hair_styles as hs  # noqa: E402
import cloth_styles as cs  # noqa: E402
import types

hs.HEAD_BONE = "head"
hs.SPINE_BONE = "spine_03"  # the MPFB game_engine rig names this bone "head" (UAL uses "Head")

FOOT_KEEP = float(os.environ.get("FOOT_KEEP", 0.0))  # feet keep more detail so the shoe shell has no torn toe
HEAD_KEEP = float(os.environ.get("HEAD_KEEP", 0.5))  # the head resists the collapse by this much, so the face is less faceted
DECIMATE = float(os.environ.get("DECIMATE", 0.28))  # collapse ratio for each body; the garments are shelled off the same low-res copy
GARMENT_SPECS = {
    # the jacket is cut above the shoulder tops (1.56 m on the rest pose, measured), so no skin shows at the shoulders
    "jacket": dict(keep=["pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r",
                         "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"],
                   avoid=["hand_l", "hand_r"], rule="any", zlo=0.86, zhi=1.58, offset=0.020, thick=0.012),
    "jeans": dict(keep=["spine_01", "spine_02", "pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r"],
                  avoid=[], rule="all", zlo=0.17, zhi=1.10, offset=0.017,
                  thick=0.010),
    "shoes": dict(keep=["foot_l", "foot_r", "ball_l", "ball_r", "calf_l", "calf_r"],
                  avoid=[], rule="all", zlo=0.00, zhi=0.20, offset=0.014, thick=0.024),
}
COVER_TOP = {"jacket": float(os.environ.get("COVER_TOP", 1.50))}  # body stays visible above this, so the neck opening shows skin
# tops hang to the upper thigh, under the crotch (m, 1.8 m reference); women's tops 2.5 cm longer; trousers rise 10 cm under the hem
TOP_HEM = dict(sweater_print=0.74, hoodie=0.74, zip_jacket=0.76, puffer=0.80, shirt=0.78)
FEMALE_HEM_DROP, TROUSER_UNDER_HEM, HEM_FLARE = 0.025, 0.10, 0.010  # flare: 10 mm outward at the hem, flat to 10 cm above it, gone by 28 cm
NPCS = [  # NPC_A is the body already in npc_a_walk.blend; the others come from body_<name>.json
    dict(name="NPC_A", json=False, hair=("wavy_long", "#4a3322"), skin="#cd8d68",
         top="zip_jacket", bottom="track",
         c=dict(body="#2e4468", sleeve="#243653", accent="#ebe7dc", trim="#1b2740", zip="#0e1420",
                base="#3b3e46", stripe="#ebe7dc"),
         shoe=dict(kind="sneaker", colour="#efede7", sole="#2b2e35", accent="#8d9bb5", lace="#2b2e35")),
    dict(name="NPC_B", json=True, hair=("curls", "#1c1613"), skin="#935a37", smile=0.5,
         top="puffer", bottom="jeans",
         c=dict(body="#7d2b3a", sleeve="#5e202d", base="#2b3a56"),
         shoe=dict(kind="boot", colour="#2b2119", sole="#c99a67", accent="#3a2c21", lace="#8a7255")),
    dict(name="NPC_C", json=True, hair=("ponytail", "#a98a58"), skin="#e7b092",
         top="hoodie", bottom="cargo",
         c=dict(body="#6a7a52", sleeve="#566444", accent="#ebe5d3", trim="#4c593b", base="#5d584b"),
         shoe=dict(kind="runner", colour="#8e929b", sole="#f4f2ec", accent="#cfd2d8", lace="#f0eee8")),
    dict(name="NPC_D", json=True, hair=("bald_horseshoe", "#5e5e66"), skin="#b67650", smile=0.4,
         top="sweater_print", bottom="jeans",
         c=dict(body="#c79b30", sleeve="#b58a29", accent="#22314c", print2="#f2eee3", trim="#94711f", base="#82a0c4"),
         shoe=dict(kind="runner", colour="#d65a2c", sole="#f2eee3", accent="#f2eee3", lace="#f8f4ea")),
    dict(name="NPC_E", json=True, hair=("topknot", "#8a4a22"), skin="#f4c4a0",
         top="shirt", bottom="chinos",
         c=dict(body="#ebe6d8", sleeve="#e3ddcc", accent="#c9c1ac", base="#a65c36", belt="#4a3220", buckle="#bfb7a0",
                roll_t=0.34),
         shoe=dict(kind="sneaker", colour="#4a3426", sole="#e8e3d3", accent="#33231a", lace="#e9e2d0")),
    dict(name="NPC_F", json=True, fem=True, hair=("wavy_long", "#2a1a12"), skin="#e9b896", smile=0.8,
         top="sweater_print", bottom="chinos",
         c=dict(body="#b4486b", sleeve="#a03d5e", accent="#2a2f3f", print2="#f4ece4", trim="#7e2c47", base="#2b3140", belt="#3a2a22", buckle="#c9b88a", zip="#111111", stripe="#ffffff"),
         shoe=dict(kind="sneaker", colour="#f2efe9", sole="#2b2b30", accent="#c98aa0", lace="#2b2b30")),
    dict(name="NPC_G", json=True, fem=True, hair=("ponytail", "#5a2a1c"), skin="#c98a62",
         top="puffer", bottom="jeans",
         c=dict(body="#2f6f7a", sleeve="#24565f", accent="#ffffff", trim="#1c3f46", base="#1d2431", belt="#222222", buckle="#aaaaaa", zip="#111111", stripe="#ffffff", print2="#ffffff"),
         shoe=dict(kind="boot", colour="#5a3a26", sole="#c99a67", accent="#3a2619", lace="#9a8060")),
    dict(name="NPC_H", json=True, fem=True, hair=("pixie", "#6b3a1f"), skin="#7a4a30", smile=0.6,
         top="zip_jacket", bottom="cargo",
         c=dict(body="#e6d8b8", sleeve="#d6c6a2", accent="#3a3a3a", trim="#b8a47c", zip="#2a2a2a", base="#6a5f48", stripe="#3a3a3a", print2="#ffffff", belt="#2a2a2a", buckle="#aaaaaa"),
         shoe=dict(kind="runner", colour="#d9a441", sole="#f2eee3", accent="#f2eee3", lace="#ffffff")),
]

bpy.ops.wm.open_mainfile(filepath=f"{OUT}/npc_a_walk.blend")  # body on the rig, NPC_Walk already retargeted
scene = bpy.context.scene
layer = bpy.context.view_layer
_MATERIAL = None


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (1.0,)


def sole_for(h):
    # contrast sole: white-ish shoes get a grey sole, dark or coloured shoes a near-white one
    lum = sum(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) / 765.0
    return hex_linear("#8a8a86" if lum > 0.8 else "#e8e6df")


def part(verts, faces, weights, colour):
    return dict(verts=verts, faces=faces, weights=weights, colour=colour)


def compact(verts, faces, weights):
    # keep only the vertices that a face uses, renumbered in order
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return [verts[i] for i in used], [tuple(remap[i] for i in f) for f in faces], [weights[i] for i in used]


def body_weights(body, bones):
    # per full-resolution body vertex: {bone name: weight}; MPFB helper groups that match no bone are dropped
    names = {g.index: g.name for g in body.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if names[g.group] in bones} for v in body.data.vertices]


def nearest_weights(kd, bw, co, k=4):
    out, tot = {}, 0.0
    for _, i, d in kd.find_n(co, k):
        w = 1.0 / (d + 1e-4)
        tot += w
        for name, val in bw[i].items():
            out[name] = out.get(name, 0.0) + val * w
    return {n: v / tot for n, v in out.items()}


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def seg_weights(segs, co, k=3):
    # garments follow their nearest bones rigidly: the three closest bone segments in the rest pose, blended by
    # inverse-square distance so joints still bend
    near = sorted((seg_dist(co, a, b), name) for name, a, b in segs)[:k]
    inv = [(1.0 / (d + 1e-3) ** 2, name) for d, name in near]
    tot = sum(w for w, _ in inv)
    return {name: w / tot for w, name in inv}


def ramp(x):
    # 0 below a bone weight of 0.1, 1 above 0.9: the protection fades in over the edge of a bone's region
    return min(1.0, max(0.0, (x - 0.1) / 0.8))


def protection(bw, body):
    # per body vertex: 1 keeps it through the decimation, 0 lets the collapse take it. The hands fade in across the wrist,
    # so the forearm thins out gradually instead of stepping down there
    return [max(ramp(w.get("hand_l", 0.0) + w.get("hand_r", 0.0)), HEAD_KEEP * ramp(w.get("head", 0.0)) * smooth01((v.co.z - 1.575) / 0.02),
                FOOT_KEEP * ramp(sum(w.get(n, 0.0) for n in ("foot_l", "foot_r", "ball_l", "ball_r")))) for w, v in zip(bw, body.data.vertices)]


def decimate(body, ratio, protect):
    # collapse-decimated copy of the body; the silhouette holds at city scale, and protected vertices keep their detail
    dg = bpy.context.evaluated_depsgraph_get()
    src = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    ob = bpy.data.objects.new("lo_raw", src)
    scene.collection.objects.link(ob)
    grp = ob.vertex_groups.new(name="protect")
    for i, p in enumerate(protect):
        grp.add([i], 1.0 - p, "REPLACE")  # the collapse takes high weights first and leaves weight 0 alone, so 1 - p
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.ratio = ratio
    mod.vertex_group = "protect"
    mod.vertex_group_factor = 1.0
    layer.update()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(src)
    return out


def region(lo, lo_w, keep, avoid_pts, zlo, zhi, wmin=0.15, band=None):
    # low-res vertices a garment covers: its bones dominate the weight, the height is in range, and it stays 9 cm
    # clear of the joints it leaves bare (wrists for the jacket, ankles for the jeans). The collapsed hands carry
    # forearm weight, so the joints are checked by distance. A 6 cm margin in height lets cut_z() slice flat edges.
    return {v.index for v in lo.vertices
            if zlo - 0.16 <= v.co.z <= zhi + 0.06
            and (max((lo_w[v.index].get(n, 0.0) for n in keep), default=0.0) >= wmin
                 or (band and band[0] <= v.co.z <= band[1] and abs(v.co.x) < 0.22))  # hip verts weighted to the thigh left notches in the hem
            and all((v.co - p).length > 0.09 for p in avoid_pts)}


def cut_z(mesh, zlo, zhi):
    # flat hems and waists: bisect at the two heights, then drop the faces that lie outside them
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for z in (zlo, zhi):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0.0, 0.0, z), plane_no=(0.0, 0.0, 1.0), dist=1e-6)
    for v in bm.verts:  # snap the bisect seam to the exact heights
        for z in (zlo, zhi):
            if abs(v.co.z - z) < 2e-3:
                v.co.z = z
    outside = [f for f in bm.faces if not zlo - 1e-6 <= f.calc_center_median().z <= zhi + 1e-6]
    bmesh.ops.delete(bm, geom=outside, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return mesh


def crosses_gap(lo, face):
    # a face that reaches from one leg to the other below the crotch (about 0.8 m) is the bridge that makes a skirt
    xs = [lo.vertices[i].co.x for i in face]
    zs = [lo.vertices[i].co.z for i in face]
    mz = sum(zs) / len(zs)
    return min(xs) < 0.0 < max(xs) and (mz < 0.75 or (mz < 0.84 and max(xs) - min(xs) > 0.12))


def flare_hem(me, zlo, amount):
    # the hem hangs off the hips: each vertex moves horizontally away from the body axis by `amount`, flat up to 10 cm above
    # the hem and faded out by 28 cm; horizontal only, so the hem edge stays level. A push from the axis, not from the nearest
    # body point: in the groin the nearest point can lie behind the shell, and the push drove the shell into the body
    for v in me.vertices:
        f = amount * (1.0 - smooth01((v.co.z - zlo - 0.10) / 0.18))
        if f <= 0.0:
            continue
        d = Vector((v.co.x, v.co.y - 0.03, 0.0))  # 0.03: the torso axis, as in cloth_styles.torso_ring
        if d.length_squared < 1e-8:
            d = Vector((0.0, -1.0, 0.0))
        v.co += d.normalized() * f
    me.update()


BUST_OFF, BUST_SMOOTH, BUST_IT = 0.010, 1.0, 3  # female tops: 10 mm more air over the bust and belly; Laplacian factor and passes


def bust_pass(me):
    # female tops hang looser over the bust and belly: each vertex stands off by BUST_OFF horizontally from the torso axis (as in
    # flare_hem), full from z 1.05 to 1.26 and gone by 1.40. The sides fade out between |x| 0.12 and 0.20, so the sleeves keep
    # their fit. Then a Laplacian pass (BUST_IT iterations, factor BUST_SMOOTH) softens the shell over the same band
    def side(v):
        return 1.0 - smooth01((abs(v.co.x) - 0.12) / 0.08)
    for v in me.vertices:
        w = smooth01((v.co.z - 0.95) / 0.10) * (1.0 - smooth01((v.co.z - 1.26) / 0.14)) * side(v)
        if w <= 0.0:
            continue
        d = Vector((v.co.x, v.co.y - 0.03, 0.0))  # 0.03: the torso axis
        if d.length_squared < 1e-8:
            d = Vector((0.0, -1.0, 0.0))
        v.co += d.normalized() * BUST_OFF * w
    nb = [set() for _ in me.vertices]
    for p in me.polygons:
        for a, b in p.edge_keys:
            nb[a].add(b)
            nb[b].add(a)
    for _ in range(BUST_IT):
        co = [v.co.copy() for v in me.vertices]
        for v in me.vertices:
            w = BUST_SMOOTH * smooth01((v.co.z - 1.00) / 0.05) * (1.0 - smooth01((v.co.z - 1.25) / 0.08)) * side(v)
            if w <= 0.0 or not nb[v.index]:
                continue
            m = sum((co[j] for j in nb[v.index]), Vector()) / len(nb[v.index])
            v.co = co[v.index] + (m - co[v.index]) * w
    me.update()


def garment_shell(lo, ok, body, spec):
    # shrunk onto the body and thickened inwards; no subdivision, which would quadruple the triangles. The jacket keeps
    # any face that touches its region, so thin sleeves survive decimation; jeans and sneakers keep only whole faces,
    # because a face that touches both legs would bridge the crotch into a skirt
    keep = any if spec["rule"] == "any" else all
    faces = [tuple(p.vertices) for p in lo.polygons if keep(i in ok for i in p.vertices)]
    if spec["rule"] == "all":
        faces = [f for f in faces if not crosses_gap(lo, f)]
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    me = bpy.data.meshes.new("shell_raw")
    me.from_pydata([lo.vertices[i].co.copy() for i in used], [], [tuple(remap[i] for i in f) for f in faces])
    me.update()
    ob = bpy.data.objects.new("shell_raw", me)
    scene.collection.objects.link(ob)
    sw = ob.modifiers.new("shrink", "SHRINKWRAP")
    sw.target = body
    sw.wrap_method = "NEAREST_SURFACEPOINT"
    sw.offset = spec["offset"]
    sw.wrap_mode = "OUTSIDE_SURFACE"  # the default follows each vertex's sign, so a vertex 1 mm inside was pushed under the skin
    so = ob.modifiers.new("solid", "SOLIDIFY")
    so.thickness = spec["thick"]
    so.offset = -1.0  # the shell grows inwards from the shrunk surface, so its outside keeps the offset
    layer.update()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    if spec.get("bust"):
        bust_pass(baked)
    out = cut_z(baked, spec["zlo"], spec["zhi"])
    if spec.get("flare"):
        flare_hem(out, spec["zlo"], spec["flare"])
    if os.environ.get("DIAG"):
        bz = sorted(round(v.co.z, 3) for v in out.vertices if v.co.z < spec["zlo"] + 0.03)
        from collections import Counter
        cnt = Counter(k for q in out.polygons for k in q.edge_keys)
        zs = [out.vertices[i].co.z for k, c in cnt.items() if c == 1 for i in k]
        print("DIAG shell", spec["zlo"], "boundary verts", len(zs), "z min/max", min(zs), max(zs), "n<zlo+0.5mm", sum(z < spec["zlo"] + 5e-4 for z in zs), flush=True)
    return out


SHOE = dict(  # per kind: sole thickness at the forefoot and at the heel block, collar height at the ankle, toe box above the sole, upper rounding (m)
    sneaker=dict(s_fore=0.026, s_heel=0.026, collar=0.115, toe=0.045, rc=0.018),
    runner=dict(s_fore=0.028, s_heel=0.028, collar=0.115, toe=0.045, rc=0.020),
    boot=dict(s_fore=0.026, s_heel=0.030, collar=0.200, toe=0.055, rc=0.016),
)
LIP, OVERLAP, EDGE = 0.001, 0.003, 0.009  # sole 1 mm proud of the upper; its wall runs 3 mm up the upper (no gap); sole edge radius (m)
HEEL_ROUND, TOE_ROUND, NOSE_ROUND = 0.030, 0.050, 0.022  # plan radii of the heel counter and the nose; side radius of the toe cap (m)
STATION_Y = [0.056, 0.040, -0.005, -0.045, -0.085, -0.140, -0.195, -0.232, -0.244]  # heel -> toe, on a 0.30 m shoe
TOE_SPRING, SOLE_DROP = 0.010, -0.004  # the sole rises 1 cm at the tip; its underside sits 4 mm into the floor (MPFB toes reach z -0.006)
LEAN_Z0, LEAN_Z1 = 0.09, 0.12  # above the ankle the upper follows the rest-pose calf bone line: none at z 0.09, all at 0.12
C45 = math.sqrt(0.5)


def smooth01(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


def foot_at(pts, y):
    # lateral extent (mirrored to +x) and top height of the foot at station y; the window widens where the foot ends
    for win in (0.012, 0.02, 0.03):
        sel = [p for p in pts if abs(p.y - y) <= win]
        if len(sel) >= 6:
            break
    return min(p.x for p in sel), max(p.x for p in sel), max(p.z for p in sel)


def shoe(body, bw, side, st, calf, fem=False):
    # closed low-poly shoe per foot: 9 stations heel -> toe (cosine spacing), 22-point rings. Ring = flat sole (thickness per kind,
    # toe spring, rounded edge) whose wall runs 3 mm up the upper, then the upper: foot envelope plus a margin, a toe box (P["toe"]
    # above the sole, rounded nose), the collar on the ankle. Above the ankle the shaft is shifted onto the rest-pose calf line
    # (calf = knee, ankle of this leg). Length = this foot's own span, heel to toe (no extra allowance), x body height/1.8 for women,
    # centred on the foot. ponytail: the rig foot_l/ball_l bones span only 20.6 cm, so a bone-based length would leave the mesh foot out.
    # Weights: foot -> ball across y -0.13..-0.16 so the toe bends at the ball; the collar blends calf -> foot.
    # Sole = part 0 (fixed colour), upper = 0.75.
    sx = 1 if side == "l" else -1
    kind = st["kind"]
    P = SHOE[kind]
    fb, bb, calf_n = f"foot_{side}", f"ball_{side}", f"calf_{side}"
    pts = [Vector((v.co.x * sx, v.co.y, v.co.z)) for v in body.data.vertices
           if v.co.x * sx > 0 and v.co.z < 0.16 and bw[v.index].get(fb, 0.0) + bw[v.index].get(bb, 0.0) > 0.5]
    span = max(p.y for p in pts) - min(p.y for p in pts)
    L = span * (max(v.co.z for v in body.data.vertices) / 1.8 if fem else 1.0)
    y_mid = 0.5 * (max(p.y for p in pts) + min(p.y for p in pts))
    y_front, y_back = y_mid - 0.5 * L, y_mid + 0.5 * L
    y_rf, y_rb, y_nose = y_front + TOE_ROUND, y_back - HEEL_ROUND, y_front + NOSE_ROUND
    margin = 0.010 if kind == "sneaker" else 0.012
    colour, sole_c = hex_linear(st["colour"]), hex_linear(st["sole"])
    accent, lace = hex_linear(st["accent"]), hex_linear(st["lace"])
    knee, ankle = calf
    def calf_xy(z):
        p = ankle + (knee - ankle) * ((z - ankle.z) / (knee.z - ankle.z))
        return p.x, p.y

    cx0, cy0 = calf_xy(LEAN_Z0)

    def lean(z):  # shift of the upper at height z onto the calf line, 0 on the foot
        g = smooth01((z - LEAN_Z0) / (LEAN_Z1 - LEAN_Z0))
        cx, cy = calf_xy(z)
        return g * (cx - cx0), g * (cy - cy0)

    stations = []
    for y_ref in STATION_Y:
        u = (0.056 - y_ref) / 0.300  # 0 at the heel, 1 at the toe
        y = y_back + u * (y_front - y_back)
        x0, x1, zf = foot_at(pts, y)
        xc, half = (x0 + x1) / 2.0, (x1 - x0) / 2.0 + margin
        if y > -0.02:
            half = max(half, 0.052 if kind == "boot" else 0.046)  # the collar wraps the shin (about 3.7 cm half-width)
        fb_ = math.sqrt(max(0.0, 1.0 - ((y - y_rb) / HEEL_ROUND) ** 2)) if y > y_rb else 1.0
        ff_ = math.sqrt(max(0.0, 1.0 - ((y_rf - y) / TOE_ROUND) ** 2)) if y < y_rf else 1.0
        wu = max(0.009, half * fb_ * ff_)  # blunt nose: 1.8 cm wide at the tip, not a point
        zb = SOLE_DROP + TOE_SPRING * smooth01((-0.13 - y) / (-0.13 - y_front))
        hf = smooth01((y + 0.10) / 0.03)  # boot heel block: a short step, not a wedge slope
        zs = zb + P["s_fore"] + (P["s_heel"] - P["s_fore"]) * hf
        zt = zs + OVERLAP  # the sole wall runs up the upper to here (welt)
        nose = math.sqrt(max(0.0, 1.0 - ((y_nose - y) / NOSE_ROUND) ** 2)) if y < y_nose else 1.0
        top = max(zf + 0.010, zs + P["toe"] * nose, zs + 0.012)  # toe box, rounded at the nose; the instep follows the foot
        if kind == "boot":  # vertical shaft to the ankle front, then a steep drop to the instep
            top = max(top, P["collar"] * min(1.0, max(0.0, (y + 0.075) / 0.04)))
        elif y > -0.04:
            top = max(top, P["collar"])
        ws = wu + LIP
        rb = min(EDGE, 0.45 * ws)
        rc = max(0.001, min(P["rc"], 0.45 * (top - zt), 0.45 * wu))
        m1 = zt + (top - rc - zt) / 3.0
        m2 = zt + 2.0 * (top - rc - zt) / 3.0
        right = [(0.0, zb, 1), (ws - rb, zb, 1), (ws - rb + rb * C45, zb + rb - rb * C45, 1), (ws, zb + rb, 1), (ws, zt, 1),
                 (wu, zt, 0), (wu, m1, 0), (wu, m2, 0), (wu, top - rc, 0), (wu - rc + rc * C45, top - rc + rc * C45, 0),
                 (wu - rc, top, 0), (0.0, top, 0)]  # role 1 = sole, 0 = upper
        ring = right + [(-dx, z, r) for dx, z, r in reversed(right[1:-1])]
        stations.append((y, xc, wu, zs, top, ring))
    nr = len(stations[0][5])
    n_st = len(stations)
    verts, cols, tags, wts, faces = [], [], [], [], []
    for y, xc, wu, zs, top, ring in stations:
        m = smooth01((-0.13 - y) / 0.03)  # 0 on the foot, 1 on the ball
        heel = min(1.0, max(0.0, (y + 0.02) / 0.02))  # 1 at the ankle and heel, 0 from the instep forward
        for dx, z, role in ring:
            is_sole = role == 1
            lace_on = (not is_sole and kind != "boot" and dx < 0.22 * wu and -0.165 < y < -0.06 and z > zs + 0.5 * (top - zs))
            dz = 0.0  # lace strip is colour only: a raised step at its edge made spikes
            dX, dY = lean(z)
            c_ = sole_c if is_sole else colour
            if lace_on:
                c_ = lace
            elif not is_sole:
                if kind == "sneaker" and y < y_front + 0.03 and z < zs + 0.45 * (top - zs):
                    c_ = accent  # toe cap
                elif kind == "runner" and dx >= 0.97 * wu and zs + 0.005 < z < zs + 0.5 * (top - zs) + 1e-4:
                    c_ = accent  # side stripe on the mid wall (the top stays the upper colour)
            cols.append(c_)
            tags.append(0.0 if is_sole else 0.75)
            c = 0.6 * min(1.0, max(0.0, (z - 0.085) / 0.03)) * heel  # collar follows the calf, the rest the foot
            w = {fb: (1.0 - c) * (1.0 - m), bb: (1.0 - c) * m, calf_n: c}
            wts.append({k: v for k, v in w.items() if v > 1e-4})
            verts.append(Vector((sx * (xc + dx) + dX, y + dY, z + dz)))
    for i in range(1, n_st):
        for k in range(nr):
            a, b = (i - 1) * nr + k, (i - 1) * nr + (k + 1) % nr
            faces.append((a, b, i * nr + (k + 1) % nr, i * nr + k))
    for i, rev in ((0, True), (n_st - 1, False)):  # heel and toe caps: fans to the ring centroid
        o = len(verts)
        verts.append(sum((verts[i * nr + k] for k in range(nr)), Vector()) / nr)
        cols.append(accent if (i and kind == "sneaker") else colour)
        tags.append(0.75)
        wts.append(dict(wts[i * nr]))
        faces += [((i * nr + (k + 1) % nr, i * nr + k, o) if rev else (i * nr + k, i * nr + (k + 1) % nr, o)) for k in range(nr)]
    cen = sum(verts, Vector()) / len(verts)  # outward winding per face: the shoe is near-convex
    faces = [f if (verts[f[1]] - verts[f[0]]).cross(verts[f[2]] - verts[f[0]]).dot(
        sum((verts[j] for j in f), Vector()) / len(f) - cen) >= 0 else tuple(reversed(f)) for f in faces]
    return part([tuple(v) for v in verts], faces, wts, cols) | dict(tag=tags)


def hair_part(body, arm, style, colour, surface):
    points = [body.matrix_world @ v.co for v in body.data.vertices]
    sk = hs.skull_from_body(points, body.dimensions.z)
    bvh = BVHTree.FromPolygons([v.co.copy() for v in surface.vertices], [tuple(q.vertices) for q in surface.polygons])  # the visible (decimated) skin
    verts, faces, tones, wts = hs.hair_mesh(style, sk, bvh)
    print("HAIR", style, "verts", len(verts), "tris", sum(len(f) - 2 for f in faces), flush=True)
    cols = [[min(1.0, c * t) for c in colour[:3]] + [1.0] for t in tones]
    return dict(part(verts, faces, wts, cols), flat=style in hs.FLAT, tag=1.0)


def material():
    # one material for every NPC: the colour comes from the per-vertex colour attribute
    global _MATERIAL
    if _MATERIAL is None:
        _MATERIAL = bpy.data.materials.new("NPC_Vertex")
        _MATERIAL.use_nodes = True
        nt = _MATERIAL.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.7
    return _MATERIAL


def merge_to_npc(name, parts, arm):
    verts, faces, cols, wts, tags = [], [], [], [], []
    for p in parts:
        off = len(verts)
        verts += p["verts"]
        faces += [tuple(i + off for i in f) for f in p["faces"]]
        c_ = p["colour"] if isinstance(p["colour"], list) else [p["colour"]] * len(p["verts"])
        cols += c_
        tg = p.get("tag", 0.0)  # part id: 0 fixed (skin, eyes), .25 top, .5 trousers, .75 shoes, 1 hair; the page tints by it
        tags += tg if isinstance(tg, list) else [tg] * len(c_)
        wts += p["weights"]
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    fi = 0
    for p in parts:
        for _ in p["faces"]:
            me.polygons[fi].use_smooth = not p.get("flat")
            fi += 1
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for d, c in zip(attr.data, cols):
        d.color = c
    ta = me.attributes.new("_part", "FLOAT", "POINT")  # custom glTF attribute: GLTFLoader keeps it as geometry.attributes._part
    ta.data.foreach_set("value", tags)
    me.materials.append(material())
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    for n in sorted({n for w in wts for n in w}):
        ob.vertex_groups.new(name=n)
    for i, w in enumerate(wts):
        for n, val in w.items():
            if val > 1e-4:
                ob.vertex_groups[n].add([i], min(val, 1.0), "REPLACE")
    return ob


EYE_R = 0.93  # eyeball radius as a fraction of the MPFB helper eyeball fitted on each body (the helper is a stylised 1.6 cm ball)
IRIS = dict(NPC_F="#4a2c17", NPC_G="#5d7f4a", NPC_H="#2e2118", NPC_A="#3b6f8f", NPC_B="#4a2c17", NPC_C="#5d7f4a", NPC_D="#2e2118", NPC_E="#6a8fb5")


def face_colours(verts, sk, fem=False, smile=0.0):
    # vertex-colour modelling of the head, no extra geometry: tints multiply the skin, each a gaussian around a landmark
    # (rest pose, metres). smile 0..1 lifts the mouth corners and adds a nasolabial line; the cheek flush scales with skin tone
    smile = min(1.0, 0.45 + 0.55 * smile)  # a friendly resting face: never below a slight smile
    lum = 0.2126 * sk[0] + 0.7152 * sk[1] + 0.0722 * sk[2]  # linear luminance of the skin
    flush = 0.35 + 0.30 * (1.0 - lum)  # a darker skin takes a stronger flush, so the colour still reads
    LM = [((0.0, 1.648), (0.010, 0.010), (1.05, 0.80, 0.78), 0.6, -0.12),  # nose tip: warmer
          ((0.0095, 1.641), (0.005, 0.005), (0.78, 0.66, 0.64), 0.6, -0.10),  # nostrils: shadow
          ((-0.0095, 1.641), (0.005, 0.005), (0.78, 0.66, 0.64), 0.6, -0.10),
          ((0.0, 1.634), (0.0045, 0.007), (0.90, 0.80, 0.78), 0.35, -0.10),  # philtrum groove
          ((0.052, 1.652), (0.024, 0.018), (1.04, 0.74, 0.74), flush, -0.10),  # cheeks: flushed, graded by skin tone
          ((-0.052, 1.652), (0.024, 0.018), (1.04, 0.74, 0.74), flush, -0.10),
          ((0.032, 1.668), (0.016, 0.008), (0.86, 0.80, 0.84), 0.7, -0.12),  # eye bags: soft, cool
          ((-0.032, 1.668), (0.016, 0.008), (0.86, 0.80, 0.84), 0.7, -0.12),
          ((0.034, 1.694), (0.024, 0.006), (0.90, 0.86, 0.84), 0.45, -0.12),  # brow-ridge shadow
          ((-0.034, 1.694), (0.024, 0.006), (0.90, 0.86, 0.84), 0.45, -0.12),
          ((0.080, 1.668), (0.010, 0.022), (0.84, 0.74, 0.72), 0.4, 0.04),  # inner ear: the hollow
          ((-0.080, 1.668), (0.010, 0.022), (0.84, 0.74, 0.72), 0.4, 0.04)]
    lip, lip_k = ((1.00, 0.36, 0.40), 1.0) if fem else ((1.00, 0.52, 0.52), 0.9)  # lips: redder

    def seg_d(px, pz, ax, az, bx, bz):  # distance from (px, pz) to the segment a-b, in the x-z plane
        dx, dz = bx - ax, bz - az
        t = min(1.0, max(0.0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
        return math.hypot(px - ax - t * dx, pz - az - t * dz)

    out = []
    for v in verts:
        c = list(sk[:3])
        for (lx, lz), (sx_, sz_), tint, k, ymax in LM:
            if v.y < ymax:
                w = k * math.exp(-((v.x - lx) / sx_) ** 2 - ((v.z - lz) / sz_) ** 2)
                c = [ci * (1 + w * (t - 1)) for ci, t in zip(c, tint)]
        if v.y < -0.10:  # mouth: the smile lifts the slit to its corners (3.5 mm at smile 1); then corner shade and smile line
            ax = abs(v.x)
            zl = v.z - 0.0035 * smile * min(1.0, (ax / 0.024) ** 2)
            for tint, w in ((lip, lip_k * math.exp(-(v.x / 0.022) ** 2 - ((zl - 1.617) / 0.0065) ** 2)),
                            ((0.84, 0.72, 0.72), 0.5 * math.exp(-((ax - 0.026) / 0.007) ** 2 - ((zl - 1.620) / 0.007) ** 2)),
                            ((0.84, 0.74, 0.72), 0.45 * smile * math.exp(-(seg_d(ax, zl, 0.013, 1.646, 0.027, 1.622) / 0.0045) ** 2))):
                c = [ci * (1 + w * (t - 1)) for ci, t in zip(c, tint)]
        if abs(v.x) > 0.06 and 1.63 < v.z < 1.72 and abs(v.y) < 0.06:  # ears: warmer
            c = [ci * t for ci, t in zip(c, (1.03, 0.82, 0.80))]
        t = min(1.0, max(0.0, (1.585 - v.z) / 0.04))  # neck: a little darker than the face
        c = [ci * (1 - 0.14 * t) for ci in c]
        out.append((*c, 1.0))
    return out


def eye_sockets(bvh, name):
    # the true eye of each side: MPFB morphs its eyeball helper geometry (vertex groups helper-l/r-eye, 72 verts) with every macro,
    # so each body's own helper verts hold its eye. A least-squares sphere fit per side gives centre and radius. a_body is the
    # NPC_A body with the groups; every json body has the same topology, so the indices carry over. Returns {sx: dict(c, r)}.
    import numpy as np
    global _EYE_IDX
    if _EYE_IDX is None:
        gi = {g.name: g.index for g in a_body.vertex_groups}
        _EYE_IDX = {sx: [v.index for v in a_body.data.vertices if any(x.group == gi[n] for x in v.groups)]
                    for sx, n in ((1, "helper-l-eye"), (-1, "helper-r-eye"))}
    P = np.array([v.co[:] for v in _BODY_FOR_EYES.data.vertices])
    out = {}
    for sx, idx in _EYE_IDX.items():
        Q = P[idx]
        sol = np.linalg.lstsq(np.c_[2 * Q, np.ones(len(Q))], (Q ** 2).sum(1), rcond=None)[0]
        c = Vector(sol[:3].tolist())
        r = float(np.sqrt(sol[3] + sol[:3] @ sol[:3]))
        out[sx] = dict(c=c, r=r)
        print("EYEFIT", name, "L" if sx > 0 else "R", "centre x %.4f y %.4f z %.4f r %.4f" % (c.x, c.y, c.z, r), flush=True)
    return out


_EYE_IDX = None
_BODY_FOR_EYES = None  # set by build_npc: the full-resolution body whose helper verts are fitted


def face_parts(npc, bvh, socks):
    # per side: an eyeball at its fitted helper position (14 x 12 sphere, front pole = pupil, first rings = iris), a skin lid shell
    # 0.8 mm outside it with the opening between the lids left open (dark lash line along the upper edge), and a brow ribbon
    # that follows the skin; all rigid on the head bone
    white, dark, iris = hex_linear("#f2f0ec"), hex_linear("#0c0a0a"), hex_linear(IRIS[npc["name"]])
    sk = hex_linear(npc['skin'])
    fem = npc.get("fem", False)
    lid_up = tuple(c * 0.84 for c in sk[:3]) + (1.0,)  # 10% darker in sRGB is ~16% in linear
    lid_lo = tuple(c * 0.88 for c in sk[:3]) + (1.0,)  # a darker lower lid reads as the eye bag
    lash = tuple(c * 0.30 for c in sk[:3]) + (1.0,)
    brow_c = tuple(0.8 * h + 0.2 * s for h, s in zip(hex_linear(npc['hair'][1]), sk[:3])) + (1.0,)
    out = []
    from mathutils import Matrix
    rot = Matrix.Rotation(1.5708, 3, "X")
    for sx in (-1, 1):
        c, ER = socks[sx]["c"], socks[sx]["r"] * EYE_R
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=16, radius=ER)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
        cols, verts = [], []
        for v in bm.verts:
            front = -v.co.y / ER  # 1 at the front pole
            cols.append(dark if front > 0.985 else iris if front > 0.84 else white)
            verts.append(v.co + c)
        bm.faces.ensure_lookup_table()
        idx = {v: i for i, v in enumerate(bm.verts)}
        faces = [tuple(idx[v] for v in f.verts) for f in bm.faces]
        bm.free()
        out.append(part(verts, faces, [{"head": 1.0}] * len(verts), cols))
        # lids: a skin-coloured front-hemisphere shell 0.8 mm outside the eyeball; the band between the lids is left open
        RL = ER + 0.0008
        z_lo, z_hi = -0.0050 * ER / 0.015, 0.0026 * ER / 0.015  # the opening, relative to the eye centre
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=16, radius=RL)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
        bm.faces.ensure_lookup_table()
        drop = [f for f in bm.faces if -f.calc_center_median().y < 0.05 * RL or z_lo < f.calc_center_median().z < z_hi]
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        lv, lc = [], []
        for v in bm.verts:
            lv.append(v.co + c)
            edge = 0 < v.co.z < z_hi + 0.0035  # first ring above the opening: the lash line
            lc.append(lash if edge else lid_up if v.co.z > 0 else lid_lo)
        idx = {v: i for i, v in enumerate(bm.verts)}
        lf = [tuple(idx[v] for v in f.verts) for f in bm.faces]
        bm.free()
        out.append(part(lv, lf, [{"head": 1.0}] * len(lv), lc))
        # brow: a ribbon of 7 stations from the inner end (towards the nose) to the tail, each station ray-cast onto the skin
        # and lifted 0.7 mm off it. A gentle arch (neutral to slightly raised), thinner for women, tapering at both ends
        N = 7
        top, bot = [], []
        for i in range(N):
            t = i / (N - 1)
            x = c.x + sx * (-0.016 + 0.040 * t)
            arch = 0.0215 + 0.0040 * math.sin(math.pi * min(1.0, t * 1.15)) - 0.0010 * t
            hw = (0.0022 if fem else 0.0028) * (0.55 + 0.45 * math.sin(math.pi * (0.1 + 0.8 * t))) * (1.0 - 0.35 * t ** 3)
            for dz, lst in ((hw, top), (-hw, bot)):
                z = c.z + arch + dz
                hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
                lst.append(hit[0] + hit[1] * 0.0007 if hit[0] else Vector((x, c.y - ER, z)))
        bv = bot + top
        bf = [(i, i + 1, N + i + 1, N + i) for i in range(N - 1)]
        if sx > 0:
            bf = [f[::-1] for f in bf]
        bcol = [tuple(min(1.0, ci * (0.80 + 0.30 * (i % N) / (N - 1))) for ci in brow_c[:3]) + (1.0,) for i in range(2 * N)]
        out.append(dict(part(bv, bf, [{"head": 1.0}] * (2 * N), bcol), tag=1.0))
    return out


def flatten_groin(body):
    # the MPFB groin bulges through the jeans shell; clamp the body's front surface in the crotch and lower belly to a
    # smooth limit (y -0.098 at z 0.85, -0.128 at 0.915, -0.134 above: the belly level), faded out over |x| 0.02-0.04
    for v in body.data.vertices:
        if v.co.z < 0.78 or v.co.z > 0.97 or abs(v.co.x) > 0.04:
            continue
        z = v.co.z
        lim = -0.098 - 0.030 * min(1.0, max(0.0, (z - 0.85) / 0.065)) - 0.006 * min(1.0, max(0.0, (z - 0.915) / 0.045))
        w = 1.0 - min(1.0, max(0.0, (abs(v.co.x) - 0.02) / 0.02))
        if v.co.y < lim:
            v.co.y += w * (lim - v.co.y)
    body.data.update()


def drop_bridges(q):
    # a trouser face that reaches from one leg to the other and dips below z 0.75 is the crotch bridge: clipped at 0.75,
    # so the part above (the seam, 0.77-0.85) stays closed and the legs stay apart below it. Dropping whole faces opened
    # holes in the seam; a mean-height test let the low corners through. ponytail: cut edges are not welded to neighbours.
    ZCUT = 0.75
    V, W = q["verts"], q["weights"]
    col = q["colour"] if isinstance(q["colour"], list) else [q["colour"]] * len(V)

    def bridge(f):
        return min(V[i][0] for i in f) < 0.0 < max(V[i][0] for i in f) and min(V[i][2] for i in f) < ZCUT

    if not any(bridge(f) for f in q["faces"]):
        return q
    verts, wts, cols, cut = [tuple(v) for v in V], list(W), list(col), {}

    def at_cut(a, b):  # the point where edge a-b crosses z 0.75; both faces that use the edge share it
        key = (min(a, b), max(a, b))
        if key not in cut:
            t = (ZCUT - V[a][2]) / (V[b][2] - V[a][2])
            verts.append((V[a][0] + t * (V[b][0] - V[a][0]), V[a][1] + t * (V[b][1] - V[a][1]), ZCUT))
            wts.append({n: W[a].get(n, 0.0) * (1 - t) + W[b].get(n, 0.0) * t for n in W[a].keys() | W[b].keys()})
            cols.append(tuple(col[a][k] + t * (col[b][k] - col[a][k]) for k in range(len(col[a]))))
            cut[key] = len(verts) - 1
        return cut[key]

    faces = []
    for f in q["faces"]:
        if not bridge(f):
            faces.append(f)
            continue
        out = []  # Sutherland-Hodgman clip of the face to z >= 0.75, then a fan
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            if V[a][2] >= ZCUT:
                out.append(a)
            if (V[a][2] - ZCUT) * (V[b][2] - ZCUT) < 0.0:
                out.append(at_cut(a, b))
        faces += [(out[0], out[j], out[j + 1]) for j in range(1, len(out) - 1)]
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    return dict(q, verts=[verts[i] for i in used], faces=[tuple(remap[i] for i in f) for f in faces],
                weights=[wts[i] for i in used], colour=[cols[i] for i in used])

def build_npc(npc, body, bw, arm, segs):
    flatten_groin(body)
    kd = KDTree(len(body.data.vertices))
    for v in body.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    lo = decimate(body, DECIMATE, protection(bw, body))
    lo_w = [nearest_weights(kd, bw, v.co) for v in lo.vertices]
    B = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones}
    H = types.SimpleNamespace(B=B, part=part, sw=lambda co: seg_weights(segs, co))
    oc = npc["c"]
    specs = {g: dict(s) for g, s in GARMENT_SPECS.items()}
    kind_t, kind_b = npc["top"], npc["bottom"]
    if kind_t == "puffer":
        specs["jacket"].update(offset=0.022, thick=0.014)
    if kind_t == "hoodie":
        specs["jacket"].update(offset=0.026, thick=0.014)
    hem = TOP_HEM[kind_t] - (FEMALE_HEM_DROP if npc.get("fem") else 0.0)
    specs["jacket"].update(zlo=hem, flare=HEM_FLARE)
    if npc.get("fem"):
        specs["jacket"].update(bust=True)  # NPC_F, G, H: the top stands off the bust (bust_pass)
    specs["jeans"].update(zhi=hem + TROUSER_UNDER_HEM)  # the trousers rise under the hem, so no skin shows between them
    if kind_t == "shirt":
        specs["jacket"].update(offset=0.016)
    if kind_b == "track":
        specs["jeans"].update(offset=0.022, thick=0.012)  # 0.026 poked through a zip top's flared hem at the trouser top
    if kind_b == "cargo":
        specs["jeans"].update(offset=0.022)
    # the collar tucks 1.5 cm under the hem: the trousers end at the collar height minus 1.5 cm
    specs["jeans"].update(zlo=SHOE[npc["shoe"]["kind"]]["collar"] - 0.015)
    avoid_extra = {"jacket": []}
    if kind_t == "shirt":
        for s_ in ("l", "r"):
            h_, t_ = B[f"lowerarm_{s_}"]
            avoid_extra["jacket"].append(h_ + (t_ - h_) * 0.66)
    regions = {g: region(lo, lo_w, s["keep"], [arm.data.bones[b].head_local for b in s["avoid"]] + avoid_extra.get(g, []),
                         s["zlo"], s["zhi"], band={"jacket": (s["zlo"] - 0.06, max(s["zlo"] + 0.12, 0.98))}.get(g))
               for g, s in specs.items()}
    # the body is hidden only inside the final heights of each garment
    covered = set().union(*({i for i in regions[g] if s["zlo"] <= lo.vertices[i].co.z <= min(s["zhi"], COVER_TOP.get(g, 9.0))}
                            for g, s in specs.items()))
    # a hole in a shell must not show the room behind it: outside the puffers (tri budget) the torso keeps its body faces,
    # already tinted like the garment below
    hide = covered if kind_t == "puffer" else {i for i in covered if not (specs["jacket"]["zlo"] - 0.02 <= lo.vertices[i].co.z <= 1.40)}
    body_faces = [tuple(p.vertices) for p in lo.polygons if not all(i in hide for i in p.vertices)]
    body_faces = [f for f in body_faces if not crosses_gap(lo, f)]
    # decimated hip/leg faces poke through the trousers shell (wedges at the groin); the shell closes the leg, so drop
    # body faces wholly below the hem and away from the hands
    arm_hand = ("hand_l", "hand_r", "lowerarm_l", "lowerarm_r", "upperarm_l", "upperarm_r")
    body_faces = [f for f in body_faces if not all(0.24 < lo.vertices[i].co.z < specs["jacket"]["zlo"] + 0.05 and abs(lo.vertices[i].co.x) < 0.2
                                                   and max((lo_w[i].get(n, 0.0) for n in arm_hand), default=0.0) < 0.1 for i in f)]
    b_verts, b_faces, b_w = compact([v.co.copy() for v in lo.vertices], body_faces, lo_w)
    bcols = face_colours(b_verts, hex_linear(npc["skin"]), npc.get("fem", False), npc.get("smile", 0.0))
    used_ = sorted({i for f in body_faces for i in f})
    btag = [0.0] * len(used_)
    for k_, i_ in enumerate(used_):  # vertices under a garment take its colour, so a gap in the shell shows cloth, not skin
        if i_ in covered or 0.2 < lo.vertices[i_].co.z < specs["jacket"]["zlo"]:  # legs and hips are all under the trousers
            z_ = lo.vertices[i_].co.z
            if z_ >= specs["jacket"]["zlo"] and z_ < 1.47:
                w_ = lo_w[i_]
                a_ = cs.smooth(0.35, 0.85, sum(w_.get(n, 0.0) for n in ("upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r")))
                bcols[k_] = cs.mix(hex_linear(oc["body"]), hex_linear(oc["sleeve"]), a_)
                btag[k_] = 0.25
            elif z_ < specs["jacket"]["zlo"] and z_ > 0.2:
                bcols[k_] = hex_linear(oc["base"])
                btag[k_] = 0.5
    parts = [dict(part(b_verts, b_faces, b_w, bcols), tag=btag)]
    for side in ("l", "r"):
        parts.append(shoe(body, bw, side, npc["shoe"], B[f"calf_{side}"], fem=npc.get("fem", False)))
    body_bvh = BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices], [tuple(p.vertices) for p in body.data.polygons])
    lin = {k: hex_linear(v) for k, v in oc.items() if isinstance(v, str)}
    lin["zlo"], lin["zhi"] = specs["jacket"]["zlo"], specs["jeans"]["zhi"]
    lin["roll_t"] = oc.get("roll_t", 0.34)
    lin["gap"] = specs["jacket"]["offset"] + specs["jacket"]["thick"]
    for gname, spec in specs.items():
        if gname == "shoes":
            continue  # the sneakers above replace the shrinkwrapped shell; the spec still hides the body under them
        me = garment_shell(lo, regions[gname], body, spec)
        if gname == "jacket":
            parts += [dict(q, tag=0.25) for q in cs.dress_top(H, me, kind_t, lin, body_bvh)]
        else:
            lb = dict(lin, zlo=spec["zlo"], zhi=spec["zhi"])
            lb.pop("belt", None)  # the tops now cover the belt band, so no belt ring is drawn
            parts += [dict(drop_bridges(q), tag=0.5) for q in cs.dress_bottom(H, me, kind_b, lb, body_bvh)]
        bpy.data.meshes.remove(me)
    style, hcol = npc["hair"]
    bvh_lo = BVHTree.FromPolygons([v.co.copy() for v in lo.vertices], [tuple(q.vertices) for q in lo.polygons])
    global _BODY_FOR_EYES
    _BODY_FOR_EYES = body
    parts += face_parts(npc, bvh_lo, eye_sockets(bvh_lo, npc["name"]))
    parts.append(hair_part(body, arm, style, hex_linear(hcol), lo))
    bpy.data.meshes.remove(lo)
    ob = merge_to_npc(npc["name"], parts, arm)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print("BUILD", npc["name"], "body verts", len(b_verts), "merged verts", len(ob.data.vertices), "tris", tris,
          "groups", len(ob.vertex_groups), flush=True)
    return ob


def variant_body(npc, faces):
    # same topology as NPC_A's body, so the vertex weights carry over by index
    with open(f"{OUT}/body_{npc['name']}.json") as f:
        coords = json.load(f)
    me = bpy.data.meshes.new(npc["name"] + "_body")
    me.from_pydata([tuple(c) for c in coords], [], faces)
    me.update()
    ob = bpy.data.objects.new(npc["name"] + "_body", me)
    scene.collection.objects.link(ob)
    # NPC_A's body masks out the MPFB eye, teeth and tongue helpers (vertex group "body"); without the same mask the
    # collapse turns them into skin plates across the face
    g = ob.vertex_groups.new(name="body")
    g.add([v.index for v in a_body.data.vertices if any(a_body.vertex_groups[x.group].name == "body" for x in v.groups)],
          1.0, "REPLACE")
    ob.modifiers.new("Mask", "MASK").vertex_group = "body"
    return ob


def export_glb(path, objs, arm):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    arm.select_set(True)
    layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=True, export_all_influences=False,
                              export_yup=True, export_vertex_color="MATERIAL", export_morph=False, export_attributes=True)


a_body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("BUILD base", a_body.name, len(a_body.data.vertices), "arm", arm.name, "action",
      arm.animation_data.action.name, flush=True)

# build in the rest pose: the saved scene sits on a walk frame, and any posed body would bake that walk into the mesh
clip = arm.animation_data.action  # NPC_Walk; reattached before export
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location, pb.rotation_quaternion, pb.scale = (0.0, 0.0, 0.0), (1.0, 0.0, 0.0, 0.0), (1.0, 1.0, 1.0)
layer.update()

bw = body_weights(a_body, arm.data.bones)
faces_base = [tuple(p.vertices) for p in a_body.data.polygons]
segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones]  # rest bone segments

built = []
for npc in NPCS:
    body = variant_body(npc, faces_base) if npc["json"] else a_body
    built.append(build_npc(npc, body, bw, arm, segs))
    if body is not a_body:
        me = body.data
        bpy.data.objects.remove(body)
        bpy.data.meshes.remove(me)

bpy.data.objects.remove(a_body)
for o in list(bpy.data.objects):
    if o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o)
arm.animation_data.action = clip
arm.animation_data.action_slot = clip.slots[0]
export_glb(f"{OUT}/npc_pack.glb", built, arm)
print("BUILD exported", f"{OUT}/npc_pack.glb", "npcs", len(built), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/npc_pack_built.blend")
print("BUILD saved", flush=True)
