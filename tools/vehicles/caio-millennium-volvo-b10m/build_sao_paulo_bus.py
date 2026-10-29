#!/usr/bin/env python3
"""Author the São Paulo articulated bus (Caio Millennium II body on a Volvo B10M chassis) from scratch.

No external source is needed any more: the earlier Sketchfab import had broken wheels, misplaced doors and a blob livery, so the
bus is modelled procedurally here from reference proportions (low-floor body, wrap-around raked windscreen, destination blind,
sliding doors on the right/kerb side, bellows, rear engine grille, six wheels).

Run with:
  blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py

Contract kept from the previous asset (js/world/vehicle-assets.js depends on it): +X forward, +Y up, +Z right in the GLB (Blender
+X forward, +Y left, +Z up), origin on the ground at the centre, 16.76 x 2.63 x 3.10 m, one render mesh per Bus* role, empties
FL/FR/ML/MR/RL/RR as wheel pivots (x = +5.8 / +0.75 / -5.3, |y| = 0.98, z = 0.52, wheel_radius 0.52). Wheel triangles lie inside
that circle and nothing else of Rubber/Trim/Metal does, so the runtime can still split and spin them.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DEFAULT = ROOT / "assets/vehicles/sao-paulo-bus.glb"

PALETTE = {  # review colours only: the runtime swaps these for the shared project materials by role name
    "BusBody": (0.125, 0.638, 0.026, 1), "BusSweep": (0.005, 0.25, 0.82, 1),
    "BusTrim": (0.018, 0.024, 0.031, 1), "BusGlass": (0.003, 0.008, 0.012, 1), "BusRubber": (0.025, 0.028, 0.031, 1),
    "BusMetal": (0.58, 0.61, 0.64, 1), "BusHeadlight": (0.95, 0.89, 0.63, 1), "BusTaillight": (0.72, 0.025, 0.018, 1),
    "BusDisplay": (0.012, 0.018, 0.022, 1),
}
ROLE_ORDER = list(PALETTE)

# ---- body envelope -------------------------------------------------------------------------------------------------------
LEVELS = [0.28, 0.34, 0.42, 0.55, 0.75, 1.0, 1.28, 1.8, 2.3, 2.5, 2.65, 2.78, 2.87, 2.94]
HALF_W = [1.17, 1.205, 1.225, 1.225, 1.225, 1.225, 1.225, 1.225, 1.225, 1.215, 1.19, 1.13, 1.04, 0.80]
D_FRONT = [-0.42, -0.30, -0.18, -0.07, -0.02, 0.0, -0.04, -0.19, -0.32, -0.35, -0.40, -0.48, -0.62, -0.85]  # raked windscreen
D_REAR = [0.40, 0.28, 0.15, 0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03, 0.10, 0.25, 0.50]
D_FLAT = [0.0] * len(LEVELS)
ACCENT_TOP = 0.55  # dark (BusTrim) skirt below this level
W = 1.225
X_NOSE, X_TAIL = 8.344, -8.379
FRONT_BODY_REAR, REAR_BODY_FRONT = -0.95, -1.90
AXLES = {"F": 5.8, "M": 0.75, "R": -5.3}
WHEEL_Y, WHEEL_Z, WHEEL_R = 0.98, 0.52, 0.52
ARCH_R = 0.60

ADD = {}  # role -> bmesh of additive geometry (world coords)
CUTTERS = []  # (bmesh, role)


def level(table, z):
    for i in range(len(LEVELS) - 1):
        if z <= LEVELS[i + 1] + 1e-9:
            t = (z - LEVELS[i]) / (LEVELS[i + 1] - LEVELS[i])
            return table[i] + (table[i + 1] - table[i]) * t
    return table[-1]


def add_bm(role):
    return ADD.setdefault(role, bmesh.new())


def mkface(bm, pts, hint=None):
    verts = [bm.verts.new(p) for p in pts]
    f = bm.faces.new(verts)
    if hint is not None and f.normal.dot(Vector(hint)) < 0:
        f.normal_flip()
    return f


def box_bm(bm, x0, x1, y0, y1, z0, z1):
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])
    return bm


def add_box(role, x0, x1, y0, y1, z0, z1, bevel=0.0):
    bm = bmesh.new()
    box_bm(bm, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    merge(role, bm)


def merge(role, bm):
    tmp = bpy.data.meshes.new("tmp")
    bm.to_mesh(tmp)
    bm.free()
    add_bm(role).from_mesh(tmp)
    bpy.data.meshes.remove(tmp)


def cut_box(role, x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    box_bm(bm, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    CUTTERS.append((bm, role))


def side_cut(sign, role, x0, x1, z0, z1, depth):
    """Pocket in the flat side wall (sign +1 left / -1 right), bottom `depth` under the skin."""
    ys = sorted((sign * (W - depth), sign * (W + 0.2)))
    cut_box(role, x0, x1, ys[0], ys[1], z0, z1)


def side_quad(sign, role, x0, x1, z0, z1, inset):
    y = sign * (W - inset)
    mkface(add_bm(role), [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], hint=(0, sign, 0))


# ---- body loft -----------------------------------------------------------------------------------------------------------
def contour_pt(end, spec, z, xe, r):
    """Point on the rounded plan contour at one end. end=+1 front / -1 rear; spec=('y', y) flat or ('t', side, theta deg)."""
    w = level(HALF_W, z)
    rr = min(r, w - 0.1)
    flat = w - rr
    table = D_FLAT if r <= 0.2 else (D_FRONT if end > 0 else D_REAR)
    x0 = xe + level(table, z)
    if spec[0] == "y":
        y = spec[1]
        bulge = 0.035 * (1 - (y / flat) ** 2) if end > 0 and r > 0.2 else 0.0
        return Vector((x0 + bulge * end, y, z)), Vector((end, 0, 0))
    side, th = spec[1], math.radians(spec[2])
    cx, cy = x0 - end * rr, side * flat
    return Vector((cx + end * rr * math.cos(th), cy + side * rr * math.sin(th), z)), Vector((end * math.cos(th), side * math.sin(th), 0))


def build_body(name, x_front, x_rear, rf, rr, rake_front):
    """Lofted shell: horizontal rounded-rectangle slices stacked over LEVELS."""
    bm = bmesh.new()
    n_arc = 6
    rows = []
    for z in LEVELS:
        w = level(HALF_W, z)
        flat_f, flat_r = w - min(rf, w - 0.1), w - min(rr, w - 0.1)
        pts = []
        # front face (right -> left), then front-left arc, rear-left arc, rear face, rear-right arc, front-right arc
        for k in range(7):
            pts.append(contour_pt(1, ("y", -flat_f + 2 * flat_f * k / 6), z, x_front, rf)[0])
        for k in range(1, n_arc + 1):
            pts.append(contour_pt(1, ("t", 1, 90 * k / n_arc), z, x_front, rf)[0])
        for k in range(0, n_arc + 1):
            th = 90 + 90 * k / n_arc
            pts.append(rear_pt(x_rear, 1, th, z, rr))
        for k in range(1, 6):
            pts.append(rear_pt(x_rear, 0, 180, z, rr, y=flat_r - 2 * flat_r * k / 6))
        for k in range(0, n_arc + 1):
            th = 180 + 90 * k / n_arc
            pts.append(rear_pt(x_rear, -1, th, z, rr))
        for k in range(0, n_arc):
            th = 270 + 90 * k / n_arc
            pts.append(contour_pt(1, ("t", -1, 90 * (n_arc - k) / n_arc), z, x_front, rf)[0])
        rows.append([bm.verts.new(p) for p in pts])
    n = len(rows[0])
    for j in range(len(rows) - 1):
        accent = LEVELS[j + 1] <= ACCENT_TOP + 1e-9
        for i in range(n):
            f = bm.faces.new((rows[j][i], rows[j][(i + 1) % n], rows[j + 1][(i + 1) % n], rows[j + 1][i]))
            f.material_index = ROLE_ORDER.index("BusTrim" if accent else "BusBody")
    for row, flip, role in ((rows[0], True, "BusTrim"), (rows[-1], False, "BusBody")):
        f = bm.faces.new(row[::-1] if flip else row)
        f.material_index = ROLE_ORDER.index(role)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return bm


def rear_pt(xe, side, th_deg, z, r, y=None):
    w = level(HALF_W, z)
    rr = min(r, w - 0.1)
    flat = w - rr
    x0 = xe + (level(D_REAR, z) if r > 0.2 else 0.0)
    if y is not None:
        return Vector((x0, y, z))
    t = math.radians(th_deg)
    cx, cy = x0 + rr, side * flat
    return Vector((cx + rr * math.cos(t), cy + rr * math.sin(t), z))


# ---- surface helpers following the raked front contour ----------------------------------------------------------------------
def front_surface(specs, zs, xe=X_NOSE, r=0.5):
    grid = []
    for z in zs:
        grid.append([contour_pt(1, s, z, xe, r) for s in specs])
    return grid


def front_slab(role, specs, zs, d_in, d_out):
    g = front_surface(specs, zs)
    bm = bmesh.new()
    outer = [[bm.verts.new(p + n * d_out) for p, n in row] for row in g]
    inner = [[bm.verts.new(p - n * d_in) for p, n in row] for row in g]
    rz, cx = len(zs), len(specs)
    for j in range(rz - 1):
        for i in range(cx - 1):
            bm.faces.new((outer[j][i], outer[j][i + 1], outer[j + 1][i + 1], outer[j + 1][i]))
            bm.faces.new((inner[j][i], inner[j + 1][i], inner[j + 1][i + 1], inner[j][i + 1]))
    for i in range(cx - 1):
        bm.faces.new((outer[0][i], inner[0][i], inner[0][i + 1], outer[0][i + 1]))
        bm.faces.new((outer[-1][i], outer[-1][i + 1], inner[-1][i + 1], inner[-1][i]))
    for j in range(rz - 1):
        bm.faces.new((outer[j][0], outer[j + 1][0], inner[j + 1][0], inner[j][0]))
        bm.faces.new((outer[j][-1], inner[j][-1], inner[j + 1][-1], outer[j + 1][-1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    CUTTERS.append((bm, role))


def front_panel(role, specs, zs, inset, uv=False):
    g = front_surface(specs, zs)
    bm = add_bm(role)
    uv_layer = bm.loops.layers.uv.verify() if uv else None
    vs = [[bm.verts.new(p - n * inset) for p, n in row] for row in g]
    rz, cx = len(zs), len(specs)
    for j in range(rz - 1):
        for i in range(cx - 1):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            if f.normal.x < 0:
                f.normal_flip()
            if uv:
                for loop in f.loops:
                    loop[uv_layer].uv = ((loop.vert.co.y - vs[0][0].co.y) / (vs[0][-1].co.y - vs[0][0].co.y), (loop.vert.co.z - zs[0]) / (zs[-1] - zs[0]))


def ys(a, b, n):
    return [("y", a + (b - a) * k / (n - 1)) for k in range(n)]


def arcs(side, thetas):
    return [("t", side, t) for t in thetas]


def front_specs(y0, y1, n, arc_to=0):
    """Increasing-y specs from y0..y1 flat plus optional arc continuation on either side."""
    specs = []
    if arc_to:
        specs += arcs(-1, [arc_to * k / 3 for k in (3, 2, 1)])
    specs += ys(y0, y1, n)
    if arc_to:
        specs += arcs(1, [arc_to * k / 3 for k in (1, 2, 3)])
    return specs


# ---- wheels ---------------------------------------------------------------------------------------------------------------
def lathe(role, profile, cx, cy, cz, sign, segs=36, ref_dy=0.0):
    """Revolve (radius, y offset) profile around the wheel axis (parallel to Y)."""
    bm = bmesh.new()
    rows = []
    for k in range(segs):
        a = 2 * math.pi * k / segs
        ca, sa = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((cx + r * ca, cy + sign * dy, cz + r * sa)) for r, dy in profile])
    m = len(profile)
    for k in range(segs):
        for i in range(m - 1):
            f = bm.faces.new((rows[k][i], rows[(k + 1) % segs][i], rows[(k + 1) % segs][i + 1], rows[k][i + 1]))
            f.normal_update()
            # open profile: orient every face away from a reference point on the wheel axis (no closed volume to recalc)
            if f.normal.dot(f.calc_center_median() - Vector((cx, cy + sign * ref_dy, cz))) < 0:
                f.normal_flip()
    merge(role, bm)


def build_wheels():
    for ax, x in AXLES.items():
        for side, sign in (("L", 1), ("R", -1)):
            cy = sign * WHEEL_Y
            tyre = [(0.31, -0.15), (0.40, -0.152), (0.485, -0.145), (0.515, -0.11), (0.52, -0.06), (0.52, 0.06), (0.515, 0.11), (0.485, 0.145), (0.40, 0.152), (0.31, 0.15)]
            lathe("BusRubber", tyre, x, cy, WHEEL_Z, sign)
            rim = [(0.31, 0.15), (0.295, 0.138), (0.215, 0.125), (0.13, 0.14), (0.085, 0.152), (0.0, 0.152)]
            lathe("BusMetal", rim, x, cy, WHEEL_Z, sign, 36, ref_dy=-3.0)
            inner = [(0.31, -0.15), (0.0, -0.15)]
            lathe("BusRubber", inner, x, cy, WHEEL_Z, sign, 36, ref_dy=3.0)
            for k in range(8):  # lug nuts
                a = 2 * math.pi * k / 8
                lx, lz = x + 0.115 * math.cos(a), WHEEL_Z + 0.115 * math.sin(a)
                lathe("BusRubber", [(0.0, 0.15), (0.022, 0.15), (0.022, 0.172), (0.0, 0.172)], lx, cy, lz, sign, 6, ref_dy=0.161)


def wheel_arches():
    for x in AXLES.values():
        for sign in (1, -1):
            y0, y1 = sorted((sign * 0.62, sign * 1.45))
            bm = bmesh.new()
            segs = 24
            ring0 = [bm.verts.new((x + ARCH_R * math.cos(2 * math.pi * k / segs), y0, WHEEL_Z + ARCH_R * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
            ring1 = [bm.verts.new((v.co.x, y1, v.co.z)) for v in ring0]
            for k in range(segs):
                bm.faces.new((ring0[k], ring0[(k + 1) % segs], ring1[(k + 1) % segs], ring1[k]))
            bm.faces.new(ring0[::-1])
            bm.faces.new(ring1)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            CUTTERS.append((bm, "BusTrim"))


# ---- bellows --------------------------------------------------------------------------------------------------------------
def build_bellows():
    x0, x1 = REAR_BODY_FRONT - 0.02, FRONT_BODY_REAR + 0.02
    pleats = 7
    stations = []
    for k in range(pleats * 2 + 1):
        x = x0 + (x1 - x0) * k / (pleats * 2)
        outer = k % 2 == 0
        inset = 0.045 if outer else 0.12
        stations.append((x, 1.185 - inset, 0.36 + inset * 0.6, 2.80 - inset))
    bm = bmesh.new()
    rows = []
    for x, hw, zb, zt in stations:
        pts = []
        rad = 0.30
        for cy, cz, a0 in ((-(hw - rad), zb + rad, 180), (hw - rad, zb + rad, 270), (hw - rad, zt - rad, 0), (-(hw - rad), zt - rad, 90)):
            for k in range(6):
                t = math.radians(a0 + 90 * k / 5)
                pts.append((x, cy + rad * math.cos(t), cz + rad * math.sin(t)))
        rows.append([bm.verts.new(p) for p in pts])
    n = len(rows[0])
    for j in range(len(rows) - 1):
        for i in range(n):
            f = bm.faces.new((rows[j][i], rows[j][(i + 1) % n], rows[j + 1][(i + 1) % n], rows[j + 1][i]))
            c = f.calc_center_median()
            if f.normal.dot(c - Vector((c.x, 0.0, 1.55))) < 0:  # open tube: point every face away from the bus axis
                f.normal_flip()
    merge("BusTrim", bm)
    add_box("BusMetal", REAR_BODY_FRONT + 0.02, FRONT_BODY_REAR - 0.02, -0.95, 0.95, 0.30, 0.38)  # turntable floor plate
    add_box("BusMetal", REAR_BODY_FRONT + 0.02, FRONT_BODY_REAR - 0.02, -0.90, 0.90, 2.76, 2.82)  # roof cover plate


# ---- features -------------------------------------------------------------------------------------------------------------
def windows():
    def spread(x0, x1, n, pillar=0.10):
        w = (x1 - x0 - pillar * (n - 1)) / n
        return [(x0 + k * (w + pillar), x0 + k * (w + pillar) + w) for k in range(n)]

    z0, z1 = 1.28, 2.30
    left = spread(-0.75, 7.40, 7) + spread(-8.05, -2.05, 5)
    right = spread(4.05, 6.40, 2) + spread(-0.75, 2.75, 3) + spread(-8.05, -4.15, 3) + spread(-2.85, -2.05, 1)
    for sign, items in ((1, left), (-1, right)):
        for a, b in items:
            side_cut(sign, "BusTrim", a, b, z0, z1, 0.05)
            side_quad(sign, "BusGlass", a, b, z0 + 0.012, z1 - 0.012, 0.016)
    # doors on the right (kerb) side: two sliding leaves, body-coloured lower panel, glazed upper, metal seam
    for a, b in ((6.50, 7.50), (2.85, 3.95), (-4.00, -2.95)):
        side_cut(-1, "BusTrim", a, b, 0.36, 2.34, 0.06)
        mid, gap = (a + b) / 2, 0.012
        for la, lb in ((a + 0.04, mid - gap), (mid + gap, b - 0.04)):
            side_quad(-1, "BusGlass", la, lb, 0.98, 2.28, 0.034)
            add_box("BusBody", la, lb, -(W - 0.06), -(W - 0.03), 0.40, 0.95)
        add_box("BusMetal", mid - gap, mid + gap, -(W - 0.062), -(W - 0.022), 0.40, 2.30)
        add_box("BusMetal", a + 0.03, b - 0.03, -(W - 0.062), -(W - 0.022), 0.955, 0.985)  # leaf waist rail
    # engine louvres, left side of the rear section
    side_cut(1, "BusTrim", -7.35, -6.15, 0.60, 1.18, 0.05)
    for k in range(6):
        z = 0.66 + k * 0.088
        add_box("BusBody", -7.30, -6.20, W - 0.05, W - 0.025, z, z + 0.04)


def front_end():
    # raked, wrap-around windscreen
    zs = [1.18, 1.28, 1.8, 2.3, 2.42]
    specs = front_specs(-0.70, 0.70, 7, arc_to=45)
    front_slab("BusTrim", specs, zs, 0.04, 0.2)
    front_panel("BusGlass", specs, [1.20, 1.28, 1.8, 2.3, 2.40], 0.02)
    # centre post and wipers
    zc = [1.20, 1.8, 2.40]
    mid = contour_pt(1, ("y", 0.0), 1.8, X_NOSE, 0.5)[0]
    for z_a, z_b in ((1.20, 2.40),):
        a = contour_pt(1, ("y", 0), z_a, X_NOSE, 0.5)[0]
        b = contour_pt(1, ("y", 0), z_b, X_NOSE, 0.5)[0]
        bm = bmesh.new()
        box_bm(bm, -0.03, 0.03, -0.025, 0.025, 0, 1)
        for v in bm.verts:
            t = v.co.z
            v.co = Vector((a.x + (b.x - a.x) * t - 0.015 + v.co.x, v.co.y, a.z + (b.z - a.z) * t))
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        merge("BusTrim", bm)
    # destination blind above the screen
    dspecs = ys(-0.62, 0.62, 2)
    dz = [2.50, 2.65, 2.82]
    front_slab("BusTrim", dspecs, dz, 0.06, 0.2)
    front_panel("BusDisplay", dspecs, dz, 0.03, uv=True)
    # headlamp clusters (wrapping the corner), right and left
    for side in (-1, 1):
        specs = (ys(0.38, 0.70, 3) if side > 0 else ys(-0.70, -0.38, 3))
        arc = arcs(side, [25, 50, 75])
        spec_all = (specs + arc) if side > 0 else (arcs(side, [75, 50, 25]) + specs)
        zl = [0.74, 0.86, 0.98]
        front_slab("BusTrim", spec_all, zl, 0.05, 0.2)
        front_panel("BusHeadlight", spec_all, zl, 0.02)
    # lower air intake with bars, badge
    ispecs = ys(-0.55, 0.55, 2)
    front_slab("BusTrim", ispecs, [0.50, 0.62, 0.70], 0.05, 0.2)
    for k in range(4):
        z = 0.52 + k * 0.045
        p0, _ = contour_pt(1, ("y", -0.52), z, X_NOSE, 0.5)
        add_box("BusMetal", p0.x - 0.034, p0.x - 0.012, -0.52, 0.52, z, z + 0.02)
    p, _ = contour_pt(1, ("y", 0.0), 1.08, X_NOSE, 0.5)
    add_box("BusMetal", p.x - 0.02, p.x + 0.008, -0.14, 0.14, 1.06, 1.10, bevel=0.008)
    # amber indicator pods at the bumper corners
    for side in (-1, 1):
        sp = [("t", side, 70), ("t", side, 85)] if side > 0 else [("t", side, 85), ("t", side, 70)]
        front_slab("BusTrim", sp, [0.40, 0.52], 0.04, 0.2)
        front_panel("BusHeadlight", sp, [0.40, 0.52], 0.015)
    # mirrors
    for side in (-1, 1):
        add_box("BusTrim", 7.92, 7.99, side * 1.00, side * 1.30, 2.26, 2.32)
        add_box("BusTrim", 7.90, 8.03, side * 1.285, side * 1.317, 1.98, 2.40, bevel=0.012)
    # side destination (right, above the front door)
    side_cut(-1, "BusTrim", 6.70, 7.30, 2.35, 2.54, 0.04)
    mkface(add_bm("BusDisplay"), [(6.72, -(W - 0.025), 2.37), (7.28, -(W - 0.025), 2.37), (7.28, -(W - 0.025), 2.52), (6.72, -(W - 0.025), 2.52)], hint=(0, -1, 0))
    bm = ADD["BusDisplay"]
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        if abs(f.normal.y) > 0.9:
            for loop in f.loops:
                loop[uvl].uv = ((loop.vert.co.x - 6.72) / 0.56 if f.normal.y > 0 else 1 - (loop.vert.co.x - 6.72) / 0.56, (loop.vert.co.z - 2.37) / 0.15)


def rear_end():
    # rear window, engine grille, tail lamps, plate
    cut_box("BusTrim", X_TAIL - 0.2, X_TAIL + 0.05, -0.50, 0.50, 1.85, 2.30)
    mkface(add_bm("BusGlass"), [(X_TAIL + 0.03, -0.48, 1.87), (X_TAIL + 0.03, 0.48, 1.87), (X_TAIL + 0.03, 0.48, 2.28), (X_TAIL + 0.03, -0.48, 2.28)], hint=(-1, 0, 0))
    cut_box("BusTrim", X_TAIL - 0.2, X_TAIL + 0.06, -0.42, 0.42, 0.78, 1.45)
    for k in range(7):
        z = 0.82 + k * 0.09
        add_box("BusBody", X_TAIL + 0.045, X_TAIL + 0.02, -0.40, 0.40, z, z + 0.045)
    for side in (-1, 1):
        a, b = sorted((side * 0.52, side * 0.70))
        cut_box("BusTrim", X_TAIL - 0.2, X_TAIL + 0.05, a, b, 0.62, 1.50)
        mkface(add_bm("BusTaillight"), [(X_TAIL + 0.03, a + 0.012, 0.64), (X_TAIL + 0.03, b - 0.012, 0.64), (X_TAIL + 0.03, b - 0.012, 1.48), (X_TAIL + 0.03, a + 0.012, 1.48)], hint=(-1, 0, 0))
    cut_box("BusTrim", X_TAIL - 0.2, X_TAIL + 0.03, -0.20, 0.20, 0.36, 0.50)
    mkface(add_bm("BusMetal"), [(X_TAIL + 0.012, -0.18, 0.375), (X_TAIL + 0.012, 0.18, 0.375), (X_TAIL + 0.012, 0.18, 0.485), (X_TAIL + 0.012, -0.18, 0.485)], hint=(-1, 0, 0))


def roof():
    for x0, x1 in ((2.0, 5.3), (-7.6, -3.3)):
        add_box("BusMetal", x0, x1, -0.62, 0.62, 2.90, 3.10, bevel=0.07)
    add_box("BusMetal", 6.2, 6.7, -0.30, 0.30, 2.93, 3.01, bevel=0.03)
    add_box("BusTrim", -3.3, -3.0, -0.10, 0.10, 2.92, 3.00, bevel=0.02)


def sweep_cutters():
    def smooth(t):
        return t * t * (3 - 2 * t)

    pieces = [(7.70, 8.05), (4.05, 6.40), (-0.80, 2.75), (-8.05, -4.05), (-2.90, -2.05)]
    for sign in (1, -1):
        for xa, xb in pieces:
            n = 14
            top = [(xa + (xb - xa) * k / n, 0.62 + 0.46 * smooth(k / n) ** 1.3 * min(1.0, (xb - xa) / 2.4)) for k in range(n + 1)]
            pts = [(xa, 0.58), (xb, 0.58)] + top[::-1]
            if xb - xa < 0.5:
                continue
            bm = bmesh.new()
            y0, y1 = sorted((sign * (W - 0.007), sign * (W + 0.2)))
            bot = [bm.verts.new((x, y0, z)) for x, z in pts]
            top_v = [bm.verts.new((x, y1, z)) for x, z in pts]
            m = len(pts)
            bm.faces.new(bot)
            bm.faces.new(top_v[::-1])
            for i in range(m):
                bm.faces.new((bot[i], bot[(i + 1) % m], top_v[(i + 1) % m], top_v[i]))
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            CUTTERS.append((bm, "BusSweep"))


# ---- assembly -------------------------------------------------------------------------------------------------------------
def material(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = PALETTE[name]
    mat.use_nodes = True
    sh = mat.node_tree.nodes.get("Principled BSDF")
    sh.inputs["Base Color"].default_value = PALETTE[name]
    sh.inputs["Roughness"].default_value = 0.35 if name == "BusMetal" else 0.42 if name in {"BusBody", "BusSweep"} else 0.72
    sh.inputs["Metallic"].default_value = 0.55 if name == "BusMetal" else 0.0
    if name in {"BusHeadlight", "BusTaillight"}:
        sh.inputs["Emission Color"].default_value = PALETTE[name]
        sh.inputs["Emission Strength"].default_value = 0.4
    return mat


def to_object(bm, name, role_of_index=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for r in ROLE_ORDER:
        mesh.materials.append(material(r))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bool_cut(body, cutters):
    cut_coll = bpy.data.collections.new("Cutters")
    bpy.context.scene.collection.children.link(cut_coll)
    for k, (bm, role) in enumerate(cutters):
        mesh = bpy.data.meshes.new(f"cut{k}")
        bm.to_mesh(mesh)
        bm.free()
        for r in ROLE_ORDER:
            mesh.materials.append(material(r))
        for p in mesh.polygons:
            p.material_index = ROLE_ORDER.index(role)
        o = bpy.data.objects.new(f"cut{k}", mesh)
        cut_coll.objects.link(o)
    mod = body.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.operand_type = "COLLECTION"
    mod.collection = cut_coll
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="cut")
    for o in list(cut_coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(cut_coll)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    front = build_body("front", X_NOSE, FRONT_BODY_REAR, 0.5, 0.04, True)
    rear = build_body("rear", REAR_BODY_FRONT, X_TAIL, 0.04, 0.45, False)
    body_bm = front
    tmp = bpy.data.meshes.new("tmp")
    rear.to_mesh(tmp)
    rear.free()
    body_bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)

    windows()
    front_end()
    rear_end()
    roof()
    wheel_arches()
    sweep_cutters()
    build_wheels()
    build_bellows()

    body = to_object(body_bm, "Body")
    bool_cut(body, CUTTERS)

    # split the cut body by material index and merge everything per role
    final = {}
    me = body.data
    for r_idx, role in enumerate(ROLE_ORDER):
        bm = bmesh.new()
        bm.from_mesh(me)
        doomed = [f for f in bm.faces if f.material_index != r_idx]
        if doomed:
            bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        final[role] = bm
    bpy.data.objects.remove(body, do_unlink=True)
    for role, bm in ADD.items():
        tmp = bpy.data.meshes.new("tmp")
        bm.to_mesh(tmp)
        bm.free()
        final[role].from_mesh(tmp)
        bpy.data.meshes.remove(tmp)

    objs = []
    for role in ROLE_ORDER:
        bm = final[role]
        if not bm.faces:
            bm.free()
            continue
        mesh = bpy.data.meshes.new(role)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(material(role))
        for p in mesh.polygons:
            p.material_index = 0
        o = bpy.data.objects.new(role, mesh)
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)

    for o in objs:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))

    for axle, x in AXLES.items():
        for side, y in (("L", WHEEL_Y), ("R", -WHEEL_Y)):
            p = bpy.data.objects.new(axle + side, None)
            p.empty_display_type = "SPHERE"
            p.empty_display_size = 0.08
            p.location = (x, y, WHEEL_Z)
            p["wheel_radius"] = WHEEL_R
            p["wheel_pivot"] = True
            bpy.context.scene.collection.objects.link(p)

    tris = sum(sum(max(0, q.loop_total - 2) for q in o.data.polygons) for o in objs)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_yup=True, export_apply=True, export_cameras=False,
        export_lights=False, export_animations=False, export_skins=False, export_extras=True,
    )
    print(f"SAO_PAULO_BUS_EXPORT={output}")
    print(f"SAO_PAULO_BUS_TRIANGLES={tris}")
    print("SAO_PAULO_BUS_ROLES=" + ",".join(o.name for o in objs))


if __name__ == "__main__":
    main()
