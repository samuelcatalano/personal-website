#!/usr/bin/env python3
"""Build the original, scale-preserving Wembley landmark asset with Blender."""

import json
import math
import struct
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / "assets/processed/landmarks"
EXPECTED = ((-24.0, 0.0, -16.4), (24.0, 23.1, 16.4))
# Linear vertex colours (glTF): keep values low, they read ~1.5x brighter in sRGB.
COLORS = {
    "concrete": (0.13, 0.14, 0.155, 1.0),
    "clad_a": (0.25, 0.27, 0.29, 1.0),
    "clad_b": (0.20, 0.22, 0.24, 1.0),
    "dark": (0.035, 0.038, 0.045, 1.0),
    "seat_a": (0.42, 0.025, 0.035, 1.0),
    "seat_b": (0.58, 0.035, 0.045, 1.0),
    "turf": (0.07, 0.24, 0.07, 1.0),
    "steel": (0.86, 0.88, 0.90, 1.0),
    "brace": (0.74, 0.77, 0.80, 1.0),
    # Arch members carry a colour signature (r == g, b > g) that no other Trim colour has: the runtime
    # glows only these at night (js/world/authored-landmarks.js), keeping the braid crisp.
    "arch": (0.87, 0.87, 0.90, 1.0),
    "arch_brace": (0.77, 0.77, 0.80, 1.0),
    "roof": (0.32, 0.34, 0.36, 1.0),
    "panel": (0.46, 0.48, 0.50, 1.0),
    "band": (0.52, 0.45, 0.30, 1.0),
    "line": (0.88, 0.88, 0.82, 1.0),
    "glass": (0.03, 0.055, 0.08, 1.0),
    "mullion_glass": (0.07, 0.10, 0.13, 1.0),
    "screen": (0.0, 0.17, 0.15, 1.0),
    "walk": (0.30, 0.30, 0.29, 1.0),
    "lamp": (0.95, 0.80, 0.55, 1.0),
    "core_glass": (0.05, 0.085, 0.115, 1.0),
    "bay_line": (0.45, 0.45, 0.43, 1.0),
    "asphalt": (0.075, 0.08, 0.085, 1.0),
    "aisle": (0.095, 0.10, 0.105, 1.0),
}


class Bucket:
    def __init__(self, name):
        self.name = name
        self.vertices = []
        self.faces = []
        self.colors = []
        self.smooth = []

    def add(self, vertices, faces, color, smooth=False):
        offset = len(self.vertices)
        # Builder coordinates are game X/Y/Z; Blender meshes use Z-up.
        self.vertices.extend((float(v[0]), -float(v[2]), float(v[1])) for v in vertices)
        self.faces.extend(tuple(offset + i for i in f) for f in faces)
        if callable(color):
            self.colors.extend(color(i) for i in range(len(faces)))
        else:
            self.colors.extend([color] * len(faces))
        self.smooth.extend([smooth] * len(faces))

    def box(self, center, size, color):
        x, y, z = center
        sx, sy, sz = (v * 0.5 for v in size)
        self.add(
            [(x + dx * sx, y + dy * sy, z + dz * sz)
             for dx, dy, dz in ((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1))],
            [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],
            color,
        )

    def ring(self, profile, segments, color, smooth=False):
        vertices = []
        for rx, rz, y in profile:
            for i in range(segments):
                a = math.tau * i / segments
                vertices.append((rx * math.cos(a), y, rz * math.sin(a)))
        faces = []
        for j in range(len(profile)):
            nxt = (j + 1) % len(profile)
            for i in range(segments):
                k = (i + 1) % segments
                faces.append((j * segments + i, j * segments + k,
                              nxt * segments + k, nxt * segments + i))
        self.add(vertices, faces, color, smooth)

    def beam(self, a, b, radius, color, sides=5):
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        u = axis.cross(Vector((0, 0, 1)))
        if u.length_squared < 1e-8:
            u = axis.cross(Vector((0, 1, 0)))
        u.normalize()
        v = axis.cross(u).normalized()
        vertices = []
        for p in (a, b):
            for i in range(sides):
                theta = math.tau * i / sides
                vertices.append(p + radius * (u * math.cos(theta) + v * math.sin(theta)))
        faces = [(tuple(range(sides - 1, -1, -1))), tuple(range(sides, 2 * sides))]
        faces.extend((i, (i + 1) % sides, sides + (i + 1) % sides, sides + i)
                     for i in range(sides))
        self.add(vertices, faces, color, True)

    def flat(self, a, b, width, normal, color):
        """Flat ribbon member (2 tris; materials are double-sided) facing `normal`; replaces 8-12 tri beams
        for thin steel that only needs to read as a line at the site's camera distance."""
        a, b = Vector(a), Vector(b)
        side = (b - a).cross(Vector(normal)).normalized() * (width * .5)
        self.add([a - side, b - side, b + side, a + side], [(0, 1, 2, 3)], color)

    def tube(self, points, radius, color, sides=6):
        points = [Vector(p) for p in points]
        vertices = []
        for i, p in enumerate(points):
            tangent = (points[min(i + 1, len(points) - 1)] -
                       points[max(0, i - 1)]).normalized()
            u = Vector((-tangent.y, tangent.x, 0)).normalized()
            v = tangent.cross(u).normalized()
            for j in range(sides):
                theta = math.tau * j / sides
                vertices.append(p + radius * (u * math.cos(theta) + v * math.sin(theta)))
        faces = [tuple(range(sides - 1, -1, -1)),
                 tuple(range((len(points) - 1) * sides, len(points) * sides))]
        for i in range(len(points) - 1):
            for j in range(sides):
                k = (j + 1) % sides
                faces.append((i * sides + j, i * sides + k,
                              (i + 1) * sides + k, (i + 1) * sides + j))
        self.add(vertices, faces, color, True)

    def object(self, collection, material):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        if mesh.validate(verbose=True, clean_customdata=False):
            raise AssertionError(f"{self.name}: Blender repaired invalid geometry")
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        colors = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
        for poly, color, smooth in zip(mesh.polygons, self.colors, self.smooth):
            poly.use_smooth = smooth
            for loop_index in poly.loop_indices:
                colors.data[loop_index].color = color
        mesh.materials.append(material)
        mesh.calc_loop_triangles()
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        return obj


def materials():
    result = {}
    for name, roughness, metallic in (("Mass", .82, .06), ("Trim", .42, .52), ("Glass", .23, .12)):
        mat = bpy.data.materials.new(name)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        vertex_color = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex_color.layer_name = "Color"
        mat.node_tree.links.new(vertex_color.outputs["Color"], shader.inputs["Base Color"])
        mat.diffuse_color = (1, 1, 1, 1)
        result[name] = mat
    return result


# The arch leans ~22 deg north (real Wembley): feet land on the ground beyond the bowl's east/west sides,
# spanning wider than the stadium; the crown hangs over the north roof.
ARCH_FOOT_X, ARCH_FOOT_Z, ARCH_RISE, ARCH_LEAN, ARCH_R = 23.3, 0.0, 22.0, 9.0, .6
ARCH_PROFILE = .6  # <1 steepens the legs so they clear the roof edge, like the real arch's near-vertical springing


def arch_point(t):
    s = max(0.0, 4 * t * (1 - t)) ** ARCH_PROFILE
    return Vector((-ARCH_FOOT_X + 2 * ARCH_FOOT_X * t, .5 + ARCH_RISE * s, ARCH_FOOT_Z - ARCH_LEAN * s))


def arch_frame(t):
    eps = 1e-3
    tangent = (arch_point(min(1, t + eps)) - arch_point(max(0, t - eps))).normalized()
    binormal = Vector((1, 0, 0)).cross(Vector((0, ARCH_RISE, -ARCH_LEAN))).normalized()
    return tangent, binormal.cross(tangent).normalized(), binormal


def arch_braid(trim, stations, nodes, chords):
    """Braided circular lattice like the real arch: hoops every bay (bay ~ tube diameter), two families of
    diagonals crossing in diamonds, plus a few longitudinal chords. Members are flat ribbons lying on the
    arch's cylinder (2 tris each, materials are double-sided) so the dense braid fits the triangle budget."""
    frames = []
    for i in range(stations + 1):
        t = i / stations
        _, normal, binormal = arch_frame(t)
        frames.append((arch_point(t), normal, binormal))

    def at(i, theta):
        centre, normal, binormal = frames[i]
        return centre + ARCH_R * (normal * math.cos(theta) + binormal * math.sin(theta))

    def ribbon(i, a, j, b, width, color):
        pa, pb = at(i, a), at(j, b)
        radial = (pa + pb) * .5 - (frames[i][0] + frames[j][0]) * .5
        side = (pb - pa).cross(radial).normalized() * (width * .5)
        trim.add([pa - side, pb - side, pb + side, pa + side], [(0, 1, 2, 3)], color)

    step = math.tau / nodes
    node = lambda i, k: step * k + (step * .5 if i % 2 else 0)  # nodes shift half a step per bay -> diamonds
    for i in range(stations + 1):
        for k in range(nodes):
            ribbon(i, node(i, k), i, node(i, k + 1), .12, COLORS["arch"])
        if i < stations:
            for k in range(nodes):
                ribbon(i, node(i, k), i + 1, node(i + 1, k), .13, COLORS["arch"])
                ribbon(i, node(i, k), i + 1, node(i + 1, k - 1), .13, COLORS["arch_brace"])
    for k in range(chords):
        theta = math.tau * k / chords + step * .25
        for i in range(stations):
            ribbon(i, theta, i + 1, theta, .14, COLORS["arch"])


def ellipse(rx, rz, a):
    return rx * math.cos(a), rz * math.sin(a)


def facade_frame(a, r, rx=20.55, rz=13.25):
    """Point on the facade ellipse scaled to radius r, with its unit tangent and outward normal."""
    x, z = rx * r / 20.55 * math.cos(a), rz * r / 20.55 * math.sin(a)
    tx, tz = -rx * math.sin(a), rz * math.cos(a)
    tl = math.hypot(tx, tz)
    tx, tz = tx / tl, tz / tl
    return x, z, tx, tz, tz, -tx


def oriented_box(bucket, a, r, y, width, height, depth, color, rx=20.55, rz=13.25):
    """Box tangent to the facade ellipse at angle a (r scales the ellipse outward)."""
    x, z, tx, tz, nx, nz = facade_frame(a, r, rx, rz)
    vertices = [(x + sx * width / 2 * tx + sn * depth / 2 * nx, y + sy * height / 2,
                 z + sx * width / 2 * tz + sn * depth / 2 * nz)
                for sy in (-1, 1) for sn in (-1, 1) for sx in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    bucket.add(vertices, faces, color)


def build_lod(level, mats):
    lod0 = level == 0
    segment = 48 if lod0 else 24
    seat_segment = 24 if lod0 else 14
    mass, trim, glass = Bucket("Mass"), Bucket("Trim"), Bucket("Glass")

    # Facade: grey plinth, dark glazed concourse, silver cladding band, steel rim.
    mass.ring([(20.3, 13.05, 0), (20.3, 13.05, 2.6),
               (19.9, 12.65, 2.6)], segment, COLORS["concrete"])
    glass.ring([(20.54, 13.24, 2.58), (20.54, 13.24, 4.2),
                (20.3, 13.0, 4.2)], segment,
               lambda f: COLORS["mullion_glass"] if (f % segment) % 4 == 0 else COLORS["glass"])
    mass.ring([(20.56, 13.26, 4.18), (20.56, 13.26, 4.55),
               (20.2, 12.9, 4.55)], segment, COLORS["clad_b"])
    mass.ring([(20.49, 13.19, 4.53), (20.49, 13.19, 6.95),
               (20.25, 12.95, 6.95)], segment,
              lambda f: COLORS["clad_a"] if (f % segment) % 2 else COLORS["clad_b"])
    mass.ring([(20.42, 13.12, 6.93), (20.42, 13.12, 7.72),
               (20.1, 12.8, 7.72)], segment, COLORS["concrete"])

    # Vertical steel fins give the cladding its rhythm; glazed entrance portals and two
    # big screens (south, camera side) break the plinth like the real concourse.
    fins = 32 if lod0 else 16
    for i in range(fins):
        x, z = ellipse(20.54, 13.24, math.tau * (i + .5) / fins)
        trim.flat((x, 4.55, z), (x, 7.7, z), .1, (x, 0, z), COLORS["steel"])
    for a in ((.5, 1.0, 2.15, 2.65, 3.65, 4.15, 5.25, 5.75) if lod0 else (1.0, 2.15, 4.15, 5.25)):
        oriented_box(glass, a, 20.5, 1.3, 1.8, 2.5, .5, COLORS["mullion_glass"])
        oriented_box(trim, a, 20.62, 2.62, 2.1, .14, .35, COLORS["steel"])
    for a in (1.3, 1.85):
        oriented_box(glass, a, 20.62, 5.6, 3.4, 1.9, .14, COLORS["screen"])
        # Screen content without textures: a white arch mark over a wordmark bar.
        x, z, tx, tz, nx, nz = facade_frame(a, 20.72)
        at = lambda u, y: (x + u * tx, y, z + u * tz)
        trim.tube([at(u, 5.05 + 1.05 * (1 - (u / 1.1) ** 2)) for u in (-1.1, -.73, -.37, 0, .37, .73, 1.1)],
                  .06, COLORS["line"], 3)
        trim.beam(at(-1.25, 4.92), at(1.25, 4.92), .07, COLORS["line"], 3)
    # Three red seating tiers form the bowl; dark hospitality band closes the back under the roof.
    tiers = ((7.35, 4.7, 9.1, 5.85, .65, 2.65),
             (9.15, 5.9, 11.25, 7.25, 2.65, 4.9),
             (11.3, 7.25, 13.0, 8.45, 4.9, 7.42))
    for row, (inner_x, inner_z, outer_x, outer_z, inner_y, outer_y) in enumerate(tiers):
        mass.ring([(inner_x, inner_z, inner_y), (outer_x, outer_z, outer_y),
                   (outer_x, outer_z, outer_y - .16),
                   (inner_x, inner_z, inner_y - .12)], seat_segment,
                  COLORS["seat_a"] if row != 1 else COLORS["seat_b"])
    mass.ring([(13.0, 8.45, 7.3), (13.0, 8.45, 8.3),
               (13.15, 8.6, 8.3)], seat_segment, COLORS["dark"])

    # Apron (aerial references): light walkway against the facade, then dark asphalt with a ring of
    # white-lined parking bays and an outer aisle. One-sided flat top just above the plaza.
    def apron(r0, r1, angles, color):
        y = .03
        vertices = [(rx * math.cos(a), y, rz * math.sin(a)) for rx, rz in (r0, r1) for a in angles]
        n = len(angles)
        faces = [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
        mass.add(vertices, faces, color)
    ring_angles = [math.tau * i / segment for i in range(segment)]
    bays = 56 if lod0 else 0
    apron((20.3, 13.05), (21.4, 14.0), ring_angles, COLORS["walk"])
    if bays:
        line = .012  # radians (~.27 m model): thin painted line, then a bay of asphalt
        bay_angles = [math.tau * k / bays + off for k in range(bays) for off in (0, line)]
        apron((21.4, 14.0), (23.0, 15.4), bay_angles,
              lambda f: COLORS["bay_line"] if f % 2 == 0 else COLORS["asphalt"])
    else:
        apron((21.4, 14.0), (23.0, 15.4), ring_angles, COLORS["asphalt"])
    apron((23.0, 15.4), (24.0, 16.4), ring_angles, COLORS["aisle"])
    # Low kerb closes the apron against the plaza.
    mass.ring([(24.0, 16.4, 0), (24.0, 16.4, .16), (23.86, 16.26, .16)], 40 if lod0 else 20, COLORS["walk"])
    # Light masts ring the apron (none at the arch feet); their lamp heads sit in Glass so they glow at night.
    if lod0:
        for i in range(14):
            a = math.tau * (i + .5) / 14
            x, z = ellipse(23.5, 15.9, a)
            trim.beam((x, .03, z), (x, 2.3, z), .05, COLORS["brace"], 3)
            glass.box((x, 2.38, z), (.34, .16, .34), COLORS["lamp"])
    # Four glazed stair cores break the drum like the real stadium's circulation towers.
    for a in (.78, 2.36, 3.92, 5.5):
        oriented_box(glass, a, 20.75, 3.75, 2.2, 7.4, 1.0, COLORS["core_glass"])
        oriented_box(trim, a, 20.8, 7.52, 2.4, .16, 1.15, COLORS["steel"])

    mass.box((0, .28, 0), (14.2, .16, 8.8), COLORS["turf"])
    for x, z, w, d in ((0, 0, .07, 8.6), (0, -4.28, 14, .06),
                       (0, 4.28, 14, .06), (-6.97, 0, .06, 8.5),
                       (6.97, 0, .06, 8.5), (-4.7, 0, 2.1, .06),
                       (4.7, 0, 2.1, .06), (-5.9, 0, .06, 3.4),
                       (5.9, 0, .06, 3.4)):
        trim.box((x, .37, z), (w, .025, d), COLORS["line"])
    trim.ring([(1.05, 1.05, .385), (1.05, 1.05, .36),
               (1.0, 1.0, .36), (1.0, 1.0, .385)], 16, COLORS["line"])

    # Roof: grey annulus over the stands, translucent beige inner band, open over the pitch.
    def roof_face(f):
        band, i = divmod(f, segment)
        if band > 1:
            return COLORS["roof"]
        seam = i % 4 == 0
        tone = COLORS["panel"] if band == 0 else COLORS["roof"]
        return tuple(c * .78 for c in tone[:3]) + (1,) if seam else tone
    mass.ring([(20.6, 13.3, 7.95), (17.2, 11.2, 8.24), (13.2, 8.9, 8.45),
               (13.2, 8.9, 8.25), (20.6, 13.3, 7.7)], segment, roof_face)
    mass.ring([(13.2, 8.9, 8.45), (11.6, 7.6, 8.55),
               (11.6, 7.6, 8.4), (13.2, 8.9, 8.25)], segment, COLORS["band"])
    # Sliding roof leaves over the south and west stands.
    for center, size in (((0, 8.78, 10.0), (12.0, .14, 4.6)), ((-15.3, 8.78, 0), (6.4, .14, 10.0))):
        mass.box(center, size, COLORS["panel"])
        cx, cy, cz = center
        for f in (-.4, -.2, 0, .2, .4):
            if size[0] > size[2]:
                trim.flat((cx + f * size[0], cy + .08, cz - size[2] / 2), (cx + f * size[0], cy + .08, cz + size[2] / 2), .1, (0, 1, 0), COLORS["steel"])
            else:
                trim.flat((cx - size[0] / 2, cy + .08, cz + f * size[2]), (cx + size[0] / 2, cy + .08, cz + f * size[2]), .1, (0, 1, 0), COLORS["steel"])

    # White inner-edge truss: two chords and a zig-zag web ringing the roof opening.
    def chord(rx, rz, y, r=.05):
        trim.ring([(rx, rz, y), (rx + r, rz + r, y - r), (rx - r, rz - r, y - r)], segment, COLORS["steel"])
    chord(11.75, 7.75, 9.0)
    chord(11.6, 7.6, 8.6)
    web = 32 if lod0 else 16
    for i in range(web):
        a, b = math.tau * i / web, math.tau * (i + 1) / web
        top = ellipse(11.75, 7.75, a)
        bottom = ellipse(11.6, 7.6, b)
        trim.flat((top[0], 8.97, top[1]), (bottom[0], 8.57, bottom[1]), .06, (top[0], 0, top[1]), COLORS["brace"])
    # Radial roof trusses and the V-truss under the overhanging roof edge.
    radials = 12 if lod0 else 6
    for i in range(radials):
        a = math.tau * (i + .5) / radials
        ix, iz = ellipse(13.2, 8.9, a)
        ox, oz = ellipse(20.3, 13.1, a)
        trim.flat((ix, 8.5, iz), (ox, 8.03, oz), .08, (0, 1, 0), COLORS["steel"])
    vees = 30 if lod0 else 15
    for i in range(vees):
        a, b = math.tau * i / vees, math.tau * (i + .5) / vees
        top = ellipse(20.5, 13.2, a)
        bottom = ellipse(20.47, 13.17, b)
        nxt = ellipse(20.5, 13.2, math.tau * (i + 1) / vees)
        trim.flat((top[0], 7.72, top[1]), (bottom[0], 7.12, bottom[1]), .07, (top[0], 0, top[1]), COLORS["steel"])
        trim.flat((bottom[0], 7.12, bottom[1]), (nxt[0], 7.72, nxt[1]), .07, (bottom[0], 0, bottom[1]), COLORS["steel"])

    # The arch: a leaning circular-section lattice girder on concrete feet beyond the bowl ends.
    if lod0:
        arch_braid(trim, 48, 6, 3)
    else:
        arch_braid(trim, 20, 6, 0)
    for sign in (-1, 1):
        mass.box((sign * ARCH_FOOT_X, .35, ARCH_FOOT_Z), (1.2, .7, 1.2), COLORS["concrete"])

    # Cable stays fan from the crown down to the north roof edge and opening.
    tie_steps = (.2, .28, .36, .44, .52, .6, .68, .76) if lod0 else (.26, .42, .58, .74)
    for t in tie_steps:
        point = arch_point(t)
        rim_z = -13.2 * math.sqrt(max(0.0, 1 - (point.x / 20.6) ** 2))
        trim.flat(point, (point.x, 7.95, rim_z), .045, (0, 0, 1), COLORS["steel"])
        if abs(point.x) < 11.0:
            inner_z = -7.75 * math.sqrt(1 - (point.x / 11.75) ** 2)
            trim.flat(point, (point.x, 9.0, inner_z), .045, (0, 0, 1), COLORS["steel"])
    collection = bpy.data.collections.new(f"Wembley LOD{level}")
    bpy.context.scene.collection.children.link(collection)
    objects = [bucket.object(collection, mats[bucket.name]) for bucket in (mass, trim, glass)]
    for obj, name in zip(objects, ("Mass", "Trim", "Glass")):
        obj.name = f"LOD{level}_{name}"
        obj.data.name = obj.name
    return collection, objects


def export_lod(level, objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    original_names, original_mesh_names = [], []
    for obj, name in zip(objects, ("Mass", "Trim", "Glass")):
        original_names.append(obj.name)
        original_mesh_names.append(obj.data.name)
        obj.name = name
        obj.data.name = name
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_normals=True,
                              export_texcoords=True, export_materials="EXPORT",
                              export_lights=False, export_cameras=False)
    for obj, name, mesh_name in zip(objects, original_names, original_mesh_names):
        obj.name = name
        obj.data.name = mesh_name
        obj.select_set(False)


def glb_json(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or total != len(data):
        raise AssertionError(f"Invalid GLB header: {path}")
    size, kind = struct.unpack_from("<I4s", data, 12)
    if kind != b"JSON":
        raise AssertionError(f"Missing GLB JSON chunk: {path}")
    return json.loads(data[20:20 + size].decode("utf-8")), len(data)


def validate(path, level):
    doc, byte_size = glb_json(path)
    names = {m["name"] for m in doc.get("materials", [])}
    mesh_names = {m["name"] for m in doc.get("meshes", [])}
    node_names = {n["name"] for n in doc.get("nodes", []) if "mesh" in n}
    if names != {"Mass", "Trim", "Glass"} or doc.get("images") or mesh_names != names or node_names != names:
        raise AssertionError(f"{path.name}: materials/images/names {names}/{doc.get('images')}/{mesh_names}/{node_names}")
    if len(doc.get("meshes", [])) != 3 or sum(len(m["primitives"]) for m in doc["meshes"]) != 3:
        raise AssertionError(f"{path.name}: expected three material draw calls")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 3:
        raise AssertionError(f"{path.name}: reimported {len(meshes)} mesh objects")
    if {obj.name for obj in meshes} != names:
        raise AssertionError(f"{path.name}: reimported mesh names do not match material buckets")
    game_corners = []
    for obj in meshes:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            game_corners.append((p.x, p.z, -p.y))
    bounds = [min(p[axis] for p in game_corners) for axis in range(3)] + [
        max(p[axis] for p in game_corners) for axis in range(3)]
    # Reorder compactly as (min xyz, max xyz).
    lo, hi = bounds[:3], bounds[3:]
    tolerance = .02 if level == 0 else .08
    for actual, expected in zip(lo + hi, EXPECTED[0] + EXPECTED[1]):
        if abs(actual - expected) > tolerance:
            raise AssertionError(f"{path.name}: bounds {lo}..{hi} differ from {EXPECTED}")
    triangles = 0
    triangle_keys = set()
    mats = set()
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        if not mesh.materials or len(mesh.materials) != 1:
            raise AssertionError(f"{path.name}/{obj.name}: expected one material")
        mats.add(mesh.materials[0].name)
        if not mesh.color_attributes:
            raise AssertionError(f"{path.name}/{obj.name}: missing authored surface colours")
        for tri in mesh.loop_triangles:
            coords = [tuple(round(float(v), 6) for v in mesh.vertices[i].co) for i in tri.vertices]
            cross = (Vector(coords[1]) - Vector(coords[0])).cross(Vector(coords[2]) - Vector(coords[0]))
            if cross.length < 1e-8:
                raise AssertionError(f"{path.name}/{obj.name}: degenerate face")
            if not all(math.isfinite(v) for v in tri.normal) or tri.normal.length < .99:
                raise AssertionError(f"{path.name}/{obj.name}: invalid normal")
            key = tuple(sorted(coords))
            if key in triangle_keys:
                raise AssertionError(f"{path.name}/{obj.name}: duplicate triangle")
            triangle_keys.add(key)
        if any(not math.isfinite(v) for vertex in mesh.vertices for v in vertex.co):
            raise AssertionError(f"{path.name}/{obj.name}: non-finite position")
    limit = 8000 if level == 0 else 4000
    if triangles > limit or mats != names:
        raise AssertionError(f"{path.name}: {triangles} tris or unexpected materials {mats}")
    return {"path": str(path.relative_to(ROOT)), "triangles": triangles, "draw_calls": len(meshes),
            "materials": sorted(mats), "bounds": {"min": lo, "max": hi}, "bytes": byte_size}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.preferences.filepaths.save_version = 0
    mats = materials()
    lod0, objects0 = build_lod(0, mats)
    lod1, objects1 = build_lod(1, mats)
    for level, objects in ((0, objects0), (1, objects1)):
        export_lod(level, objects, OUTPUT / f"wembley.lod{level}.glb")
    lod1.hide_viewport = True
    lod1.hide_render = True
    blend_path = SOURCE / "wembley.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)
    report = [validate(OUTPUT / f"wembley.lod{level}.glb", level) for level in (0, 1)]
    print(json.dumps({"blend": str(blend_path.relative_to(ROOT)), "assets": report}, indent=2))


if __name__ == "__main__":
    main()
