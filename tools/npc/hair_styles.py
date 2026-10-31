# Procedural hairstyles for the walk atlas, built in the rig's space (before atlas_render.py normalises the height).
# Each style is parented to the rig like the free hair meshes, so one table serves both heads.
# A style is a list of primitives in skull units: u across the skull (+ right), v front to back (- face, + back),
# w down from the crown (0 = crown, 1 = jaw). Shapes:
#   ("ell", (u, v, w), (ru, rv, rw), (rx, ry, rz))  ellipsoid; radii in skull units; rotation in degrees
#   ("box", (u, v, w), (ru, rv, rw), (rx, ry, rz))  block; the subdivision modifier rounds it
#   ("tube", p0, p1, r0, r1)                          tapered link from p0 to p1; radii as a fraction of the half width
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HEAD_BONE = "Head"  # the rig's head bone: the hair follows it through the walk cycle


def bone_parent_inverse(arm, bone_name):
    # Blender hangs a bone's children at its tail, so the rest parent frame is the bone plus its length along Y
    bone = arm.data.bones[bone_name]
    return (bone.matrix_local @ Matrix.Translation((0, bone.length, 0))).inverted()


class Skull:
    def __init__(self, cx, cy, top, hw, hd, hh):
        self.cx, self.cy, self.top, self.hw, self.hd, self.hh = cx, cy, top, hw, hd, hh

    def point(self, u, v, w):
        return Vector((self.cx + u * self.hw, self.cy + v * self.hd, self.top - w * self.hh))


def skull_from_body(points, height):
    # crown = highest point; the head is the top 10% of the body, so the narrower neck does not widen the frame
    top = max(p.z for p in points)
    head = [p for p in points if p.z > top - 0.10 * height]
    xs = [p.x for p in head]
    ys = [p.y for p in head]
    return Skull(0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys)), top,
                 0.5 * (max(xs) - min(xs)), 0.5 * (max(ys) - min(ys)), 0.15 * height)


def _place(sk, c, r, rot):
    scale = Vector((r[0] * sk.hw, r[1] * sk.hd, r[2] * sk.hh))
    turn = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    return Matrix.Translation(sk.point(*c)) @ turn @ Matrix.Diagonal(scale).to_4x4()


def _add(bm, sk, p):
    if p[0] == "ell":
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0, matrix=_place(sk, p[1], p[2], p[3]), calc_uvs=False)
    elif p[0] == "box":
        bmesh.ops.create_cube(bm, size=2.0, matrix=_place(sk, p[1], p[2], p[3]), calc_uvs=False)
    else:  # tube: a cone along the segment, radius1 at p0
        a, b = sk.point(*p[1]), sk.point(*p[2])
        axis = b - a
        turn = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=p[3] * sk.hw, radius2=p[4] * sk.hw,
                              depth=axis.length, matrix=Matrix.Translation(0.5 * (a + b)) @ turn, calc_uvs=False)


def build_style(name, sk, arm):
    spec = STYLES[name]
    prims = spec(sk) if callable(spec) else spec
    if not prims:
        return None
    bm = bmesh.new()
    for p in prims:
        _add(bm, sk, p)
    mesh = bpy.data.meshes.new(f"Cabelo_{name}")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mat = bpy.data.materials.new(f"Cabelo_{name}_mat")
    mat.use_nodes = True
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(f"Cabelo_{name}", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = HEAD_BONE
    obj.matrix_parent_inverse = bone_parent_inverse(arm, HEAD_BONE)  # bind-pose placement; the bone carries it
    soft = obj.modifiers.new("soften", "SUBSURF")
    soft.levels = 1
    soft.render_levels = 1
    obj.hide_render = True
    return obj


def braid_links(sk):
    # TODO(human): return the braid as a list of ("tube", p0, p1, r0, r1) links, one per consecutive pair of points
    # on a path from the back of the crown (about (0.35, 0.85, 0.2)) down the right side to the chest (about (0.45, 0.0, 2.1)).
    return []


# base caps: the crown and the close-cut shell, a little past the skull so the hair reads at cell size
# the nape is about 0.13 m deep (v 1.15), so anything hanging at the back starts out there, not inside the body
CAP = [("ell", (0, 0.10, 0.30), (1.16, 1.12, 0.36), (0, 0, 0))]
BUZZ = [("ell", (0, 0.08, 0.26), (1.08, 1.06, 0.30), (0, 0, 0))]
BOB = CAP + [("box", (0, 0.95, 0.72), (1.06, 0.26, 0.36), (0, 0, 0))]
LONG = CAP + [("box", (0, 1.05, 0.95), (1.0, 0.30, 0.95), (0, 0, 0))]

STYLES = {
    "buzz": BUZZ,
    "side_part": CAP + [("ell", (0.28, -0.12, -0.02), (0.78, 0.56, 0.14), (0, 0, -12))],
    "quiff": CAP + [("ell", (0, -0.42, -0.12), (0.80, 0.55, 0.34), (-28, 0, 0))],
    "pompadour": BUZZ + [("ell", (0, -0.20, -0.22), (0.92, 0.70, 0.36), (-30, 0, 0))],
    "mohawk": BUZZ + [("ell", (0, 0.0, -0.22), (0.24, 1.0, 0.36), (0, 0, 0))],
    "undercut": BUZZ + [("ell", (0, -0.18, -0.16), (1.0, 0.90, 0.40), (-18, 0, 0))],
    "two_block": BUZZ + [("box", (0, 0.05, 0.10), (1.0, 0.92, 0.20), (0, 0, 0))],
    "slick_back": [("ell", (0, 0.22, 0.25), (1.16, 1.06, 0.34), (0, 0, 0)), ("ell", (0, -0.25, -0.02), (0.95, 0.60, 0.22), (-10, 0, 0))],
    "textured_crop": BUZZ + [("ell", (0, -0.95, 0.10), (1.0, 0.24, 0.18), (-18, 0, 0))],
    "mullet": CAP + [("box", (0, 1.05, 0.88), (0.86, 0.30, 0.70), (0, 0, 0))],
    "shag": CAP + [("ell", (0, -0.98, 0.16), (1.0, 0.26, 0.22), (-20, 0, 0)),
                   ("box", (-1.0, 0.25, 0.78), (0.30, 0.78, 0.72), (0, 0, 0)), ("box", (1.0, 0.25, 0.78), (0.30, 0.78, 0.72), (0, 0, 0))],
    "curtain_bangs": CAP + [("box", (-0.42, -0.92, 0.44), (0.36, 0.20, 0.42), (0, 0, 14)),
                            ("box", (0.42, -0.92, 0.44), (0.36, 0.20, 0.42), (0, 0, -14)),
                            ("box", (0, 1.05, 0.95), (0.95, 0.30, 0.82), (0, 0, 0))],
    "fringe": CAP + [("box", (0, -0.98, 0.32), (1.0, 0.20, 0.18), (0, 0, 0))],
    "long": LONG,
    "bob": BOB,
    "wavy_bob": BOB + [("ell", (-1.0, 0.0, 0.95), (0.26, 0.40, 0.26), (0, 0, 0)), ("ell", (1.0, 0.0, 0.95), (0.26, 0.40, 0.26), (0, 0, 0))],
    "bun_low": CAP + [("ell", (0, 1.22, 0.72), (0.42, 0.42, 0.40), (0, 0, 0))],
    "bun_top": CAP + [("ell", (0, 0.55, -0.22), (0.42, 0.42, 0.40), (0, 0, 0))],
    "ponytail_high": CAP + [("tube", (0, 0.85, -0.05), (0, 1.42, 1.05), 0.38, 0.10)],
    "ponytail_side": CAP + [("tube", (0.70, 0.60, 0.40), (1.15, 1.05, 1.25), 0.36, 0.10)],
    "pigtails": CAP + [("tube", (-0.95, 0.30, 0.25), (-1.22, 0.70, 1.45), 0.30, 0.16),
                       ("tube", (0.95, 0.30, 0.25), (1.22, 0.70, 1.45), 0.30, 0.16)],
    "bangs_bob": BOB + [("box", (0, -0.98, 0.42), (1.0, 0.20, 0.20), (0, 0, 0))],
    "curly": CAP + [("ell", (-0.92, -0.30, 0.02), (0.36, 0.36, 0.34), (0, 0, 0)), ("ell", (0, -0.98, -0.02), (0.38, 0.36, 0.34), (0, 0, 0)),
                    ("ell", (0.92, -0.30, 0.02), (0.36, 0.36, 0.34), (0, 0, 0)), ("ell", (-0.92, 0.40, 0.22), (0.38, 0.38, 0.38), (0, 0, 0)),
                    ("ell", (0.92, 0.40, 0.22), (0.38, 0.38, 0.38), (0, 0, 0)), ("ell", (0, 1.12, 0.26), (0.42, 0.42, 0.40), (0, 0, 0))],
    "long_wavy": LONG + [("ell", (-0.98, 0.60, 0.95), (0.26, 0.42, 0.70), (0, 0, 0)), ("ell", (0.98, 0.60, 0.95), (0.26, 0.42, 0.70), (0, 0, 0))],
    "double_bun": CAP + [("ell", (-0.55, 0.35, -0.12), (0.34, 0.34, 0.34), (0, 0, 0)), ("ell", (0.55, 0.35, -0.12), (0.34, 0.34, 0.34), (0, 0, 0))],
    "braid": braid_links,
}
