#!/usr/bin/env python3
"""Build the original Gilbert Scott landmark and export its two GLB LODs.

Run from any directory with:
    blender -b --python tools/landmarks/university/build_university.py
"""

import bmesh
import bpy
import json
import math
import struct
from pathlib import Path
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "assets" / "processed" / "landmarks"
HEIGHT = 34.7
X_LIMIT = 36.45
Z_LIMIT = 7.65
TAU = math.tau


def srgb(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values)


def tint(hex_color):
    return (*srgb(hex_color), 1)


def game_to_blender(point):
    """Three.js Y-up (x,y,z) to Blender Z-up (x,-z,y)."""
    x, y, z = point
    return (x, -z, y)


def blender_to_game(point):
    x, y, z = point
    return (x, z, -y)


def make_material(name, roughness, metallic=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (1, 1, 1, 1)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    color = material.node_tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = "Col"
    material.node_tree.links.new(color.outputs["Color"], shader.inputs["Base Color"])
    return material


class Surface:
    def __init__(self, name):
        self.name = name
        self.vertices = []
        self.faces = []
        self.colors = []
        self.smooth = []

    def face(self, points, color, smooth=False):
        points = [Vector(point) for point in points]
        area = sum((points[i].cross(points[(i + 1) % len(points)]) for i in range(len(points))), Vector())
        if len(points) < 3 or area.length < 1e-8:
            raise ValueError(f"Degenerate face in {self.name}: {points}")
        start = len(self.vertices)
        self.vertices.extend(game_to_blender(point) for point in points)
        self.colors.extend([color] * len(points))
        self.faces.append(tuple(range(start, start + len(points))))
        self.smooth.append(smooth)

    def box(self, center, size, color):
        x, y, z = center
        w, h, d = size
        p = [(x + sx * w / 2, y + sy * h / 2, z + sz * d / 2)
             for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        for ids in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                    (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.face([p[i] for i in ids], color)

    def beam(self, a, b, radius, color, sides=4, caps=False, smooth=False):
        a, b = Vector(a), Vector(b)
        axis = b - a
        if axis.length < 1e-8:
            raise ValueError(f"Zero-length beam in {self.name}")
        axis.normalize()
        seed = Vector((0, 0, 1)) if abs(axis.z) < .9 else Vector((0, 1, 0))
        u = axis.cross(seed).normalized()
        v = axis.cross(u).normalized()
        rings = []
        for center in (a, b):
            rings.append([center + radius * (u * math.cos(TAU * i / sides) + v * math.sin(TAU * i / sides))
                          for i in range(sides)])
        for i in range(sides):
            j = (i + 1) % sides
            self.face((rings[0][i], rings[0][j], rings[1][j], rings[1][i]), color, smooth)
        if caps:
            self.face(tuple(reversed(rings[0])), color)
            self.face(rings[1], color)

    def gable(self, center, base_y, width, height, length, along_x, color):
        cx, _, cz = center
        if along_x:
            cross = [Vector((cx, base_y, cz - width / 2)),
                     Vector((cx, base_y, cz + width / 2)),
                     Vector((cx, base_y + height, cz))]
            ends = [cross[i] + Vector((side * length / 2, 0, 0)) for side in (-1, 1) for i in range(3)]
        else:
            cross = [Vector((cx - width / 2, base_y, cz)),
                     Vector((cx + width / 2, base_y, cz)),
                     Vector((cx, base_y + height, cz))]
            ends = [cross[i] + Vector((0, 0, side * length / 2)) for side in (-1, 1) for i in range(3)]
        self.face(ends[:3], color)
        self.face(ends[3:], color)
        for i in range(3):
            j = (i + 1) % 3
            self.face((ends[i], ends[j], ends[3 + j], ends[3 + i]), color)

    def frustum(self, cx, y0, cz, radius0, radius1, height, color, sides=8, angle=0,
                cap_bottom=True, cap_top=True):
        rings = []
        for y, radius in ((y0, radius0), (y0 + height, radius1)):
            rings.append([Vector((cx + radius * math.cos(angle + TAU * i / sides), y,
                                  cz + radius * math.sin(angle + TAU * i / sides))) for i in range(sides)])
        if cap_bottom:
            self.face(rings[0], color)
        if radius1 > 1e-8 and cap_top:
            self.face(rings[1], color)
        for i in range(sides):
            j = (i + 1) % sides
            if radius1 <= 1e-8:
                self.face((rings[0][i], rings[0][j], Vector((cx, y0 + height, cz))), color)
            else:
                self.face((rings[0][i], rings[0][j], rings[1][j], rings[1][i]), color)

    def pyramid(self, cx, y0, cz, half_width, height, color):
        bottom = [(cx - half_width, y0, cz - half_width), (cx + half_width, y0, cz - half_width),
                  (cx + half_width, y0, cz + half_width), (cx - half_width, y0, cz + half_width)]
        apex = (cx, y0 + height, cz)
        self.face(bottom, color)
        for i in range(4):
            self.face((bottom[i], bottom[(i + 1) % 4], apex), color)

    def arch_window(self, glass, cx, y0, width, height, center, normal, lod0=True, mullions=True):
        """Recessed pointed pane and raised stone ribs; center is the wall-plane origin."""
        n = Vector(normal).normalized()
        u = Vector((1, 0, 0)) if abs(n.z) > .5 else Vector((0, 0, -1 if n.x > 0 else 1))
        if n.z < -.5:
            u = Vector((-1, 0, 0))
        origin = Vector(center)
        def point(x, y, depth):
            return origin + u * (cx + x) + Vector((0, y, 0)) + n * depth

        shoulder = height * .76
        outline = [(-width / 2, y0), (width / 2, y0), (width / 2, y0 + shoulder), (0, y0 + height), (-width / 2, y0 + shoulder)]
        glass.face([point(x, y, .07) for x, y in outline], tint("#283d4a"))
        rib = tint("#d3bd96")
        depth = .18
        radius = max(.045, width * .07)
        bottom_left, bottom_right = point(-width / 2, y0, depth), point(width / 2, y0, depth)
        left_shoulder, right_shoulder = point(-width / 2, y0 + shoulder, depth), point(width / 2, y0 + shoulder, depth)
        apex = point(0, y0 + height, depth)
        if lod0 or width > 1.5:
            for a, b in ((bottom_left, left_shoulder), (bottom_right, right_shoulder),
                         (left_shoulder, apex), (apex, right_shoulder)):
                self.beam(a, b, radius, rib, sides=3)
        if mullions and (lod0 or width > 1.5):
            self.beam(point(0, y0, depth), apex, radius * .66, rib, sides=3)
            self.beam(point(-width * .42, y0 + height * .45, depth),
                      point(width * .42, y0 + height * .45, depth), radius * .58, rib, sides=3)
            if lod0 and height > 3.6:
                self.beam(point(-width * .36, y0 + height * .69, depth),
                          point(0, y0 + height * .98, depth), radius * .4, rib, sides=3)
                self.beam(point(width * .36, y0 + height * .69, depth),
                          point(0, y0 + height * .98, depth), radius * .4, rib, sides=3)

    def object(self, collection, parent, material):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update(calc_edges=True)
        if mesh.validate(verbose=False, clean_customdata=False):
            raise ValueError(f"Blender rejected invalid geometry in {self.name}")
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        colors = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
        for item, color in zip(colors.data, self.colors):
            item.color = color
        mesh.color_attributes.active_color = colors
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon in mesh.polygons:
            normal = polygon.normal
            for loop_index in polygon.loop_indices:
                p = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                if abs(normal.z) >= abs(normal.x) and abs(normal.z) >= abs(normal.y):
                    coord = (p.x, p.y)
                elif abs(normal.y) >= abs(normal.x):
                    coord = (p.x, p.z)
                else:
                    coord = (p.y, p.z)
                uv.data[loop_index].uv = coord
            polygon.use_smooth = all(self.smooth)
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(material)
        return obj


def window_pair(trim, glass, x, z, normal, lod0, lower=True):
    base_y = 1.05 if lower else 6.15
    width, height = (1.12, 4.45) if lower else (.94, 2.75)
    trim.arch_window(glass, x, base_y, width, height, (0, 0, z), normal, lod0, True)


def add_clock_dial(trim, center, horizontal, normal, lod0):
    center, horizontal, normal = Vector(center), Vector(horizontal), Vector(normal)
    up = Vector((0, 1, 0))
    rim, face, ink = tint("#68533d"), tint("#e4d6b8"), tint("#493b2e")
    winding = -1 if horizontal.cross(up).dot(normal) > 0 else 1
    point = lambda radius, angle, depth: center + normal * depth + horizontal * (winding * math.sin(angle) * radius) + up * (math.cos(angle) * radius)
    for radius, depth, color in ((.78, .05, rim), (.62, .07, face)):
        trim.face([point(radius, TAU * i / 16, depth) for i in range(16)], color)
    ticks = 12 if lod0 else 4
    for i in range(ticks):
        angle = TAU * i / ticks
        trim.beam(point(.43, angle, .085), point(.52, angle, .085), .025, ink, sides=4)
    trim.beam(center + normal * .09, point(.36, TAU / 6, .09), .035, ink, sides=4)
    trim.beam(center + normal * .09, point(.48, 0, .09), .025, ink, sides=4)


def make_spire(trim, lod0):
    levels = [(23.6, 2.5), (26, 2.0), (28.2, 1.5), (30.2, 1.0), (32, .55)]
    if not lod0:
        levels = [levels[i] for i in (0, 2, 4)]
    center_z = 3.0
    slate = tint("#4a4d54")
    corners = lambda level: [Vector((-level[1], level[0], center_z - level[1])),
                             Vector((level[1], level[0], center_z - level[1])),
                             Vector((level[1], level[0], center_z + level[1])),
                             Vector((-level[1], level[0], center_z + level[1]))]
    for k, level in enumerate(levels):
        ring = corners(level)
        for i in range(4):
            trim.beam(ring[i], ring[(i + 1) % 4], .075, slate, sides=4)
            if k < len(levels) - 1:
                upper = corners(levels[k + 1])
                trim.beam(ring[i], upper[i], .115, slate, sides=4)
                if lod0 or (k + i) % 2 == 0:
                    trim.beam(ring[i], upper[(i + 1) % 4], .055, slate, sides=4)
    for i, corner in enumerate(corners(levels[-1])):
        trim.beam(corner, (0, 33.2, center_z), .08, slate, sides=4)
    trim.beam((0, 33.2, center_z), (0, HEIGHT, center_z), .055, tint("#b09a61"), sides=4, caps=True)


def build_lod(lod_index, materials, root_collection, university_root):
    lod0 = lod_index == 0
    lod_name = f"LOD{lod_index}"
    collection = bpy.data.collections.new(lod_name)
    root_collection.children.link(collection)
    lod_root = bpy.data.objects.new(lod_name, None)
    lod_root.empty_display_type = "PLAIN_AXES"
    collection.objects.link(lod_root)
    lod_root.parent = university_root

    mass, trim, glass = Surface("Mass"), Surface("Trim"), Surface("Glass")
    sand, sandstone_light = tint("#b49a74"), tint("#c8b088")
    slate, gilt = tint("#4a4d54"), tint("#b09a61")

    # Long, balanced ranges with steep slate roofs and two rows of recessed lancets.
    for side in (-1, 1):
        mass.box((side * 18, 5, 0), (26, 10, 12), sand)
        trim.box((side * 18, 5.15, 6.08), (26.3, .32, .48), sandstone_light)
        trim.box((side * 18, 5.15, -6.08), (26.3, .32, .48), sandstone_light)
        trim.box((side * 18, 10.02, 0), (26.4, .42, 12.4), sandstone_light)
        trim.gable((side * 18, 0, 0), 10.25, 12.8, 6.25, 26, True, slate)
        trim.beam((side * 5, 16.5, 0), (side * 31, 16.5, 0), .09, slate, sides=4)
        # Shallow buttresses stay just proud of the wall, with small stone pinnacles.
        for i in range(9):
            x = side * (5.2 + i * 3.1)
            for face_z in (-6.0, 6.0):
                center_z = face_z + (0.22 if face_z > 0 else -0.22)
                trim.box((x, 5.05, center_z), (.38, 10.1, .46), sandstone_light)
                if lod0 or i % 2 == 0:
                    trim.pyramid(x, 10.1, center_z, .34, 1.25, sandstone_light)
        for i in range(8):
            x = side * (6.75 + i * 3.1)
            for front in (-1, 1):
                window_pair(trim, glass, x, front * 6.02, (0, 0, front), lod0, True)
                window_pair(trim, glass, x, front * 6.02, (0, 0, front), lod0, False)

        # Small gabled dormers project through the front and rear roof slopes.
        dormers = (8.5, 14, 19.5, 25) if lod0 else (10, 20, 26)
        for dx in dormers:
            x = side * dx
            for front in (-1, 1):
                cz = front * 5.0
                mass.box((x, 12.05, cz), (2.0, 2.0, 1.5), sand)
                trim.gable((x, 0, cz), 13.05, 2.3, 1.35, 1.8, False, slate)
                trim.arch_window(glass, x, 11.1, .82, 1.7, (0, 0, front * 5.78), (0, 0, front), lod0, not lod0)

    # End pavilions and corner turrets cap the wings without exceeding the old site envelope.
    for side in (-1, 1):
        mass.box((side * 33.1, 6.5, 0), (5.4, 13, 13), sand)
        trim.box((side * 33.1, 13.05, 0), (5.8, .42, 13.4), sandstone_light)
        trim.gable((side * 33.1, 0, 0), 13.35, 5.7, 4.5, 13.3, False, slate)
        for front in (-1, 1):
            trim.arch_window(glass, side * 33.1, 2.2, 2.0, 4.55,
                             (0, 0, front * 6.52), (0, 0, front), lod0, True)
            trim.arch_window(glass, side * 33.1, 7.15, 1.25, 2.6,
                             (0, 0, front * 6.52), (0, 0, front), lod0, not lod0)
        for corner_x in (side * 30.7, side * 35.1):
            for corner_z in (-6.3, 6.3):
                mass.frustum(corner_x, 12.8, corner_z, .72, .66, 1.5, sand, sides=8, angle=math.pi / 8, cap_top=False)
                trim.frustum(corner_x, 14.3, corner_z, 1.35, 1.35, .18, sandstone_light, sides=8,
                             cap_bottom=False, cap_top=False)
                trim.frustum(corner_x, 14.48, corner_z, 1.35, 0, 2.75, slate, sides=8, cap_bottom=False)
                trim.beam((corner_x, 17.23, corner_z), (corner_x, 17.9, corner_z), .045, gilt, sides=4, caps=True)

    # Central hall link and curved concert-hall frontage with deep, repeated arches.
    mass.box((0, 4.5, 0), (10, 9, 12), sand)
    trim.box((0, 9.02, 0), (10.5, .34, 12.4), sandstone_light)
    trim.gable((0, 0, 0), 9.2, 12.8, 4.25, 10.6, True, slate)
    for i, x in enumerate((-4.5, -3, -1.5, 0, 1.5, 3, 4.5)):
        front_z = 6.0 + 1.15 * (1 - (x / 5.1) ** 2)
        mass.box((x, 4.5, front_z - .32), (1.48, 9, .72), sand)
        # Curved bays are faceted original geometry; their glass sits behind the raised stone ribs.
        trim.arch_window(glass, x, 4.45, 1.12, 4.05, (0, 0, front_z), (0, 0, 1), lod0, True)
        if i != 6:
            trim.arch_window(glass, x, .55, .98, 3.3, (0, 0, front_z), (0, 0, 1), lod0, not lod0)
        if lod0:
            trim.box((x + .72, 4.55, front_z + .1), (.12, 8.9, .18), sandstone_light)

    # Square tower, belfry, flanking spirelets and the open lattice crown.
    mass.box((0, 8.5, 3), (8, 17, 8), sand)
    mass.box((0, 20, 3), (7, 6, 7), sandstone_light)
    for y in (7, 12.5, 17, 23):
        trim.box((0, y, 3), (8.35, .3, 8.35), sandstone_light)
    for front in (-1, 1):
        trim.arch_window(glass, 0, 8.7, 2.0, 6.2, (0, 0, 3 + front * 4.02),
                         (0, 0, front), lod0, True)
        for x_offset in (-1.55, 1.55):
            trim.arch_window(glass, x_offset, 18.05, 1.1, 3.9,
                             (0, 0, 3 + front * 3.52), (0, 0, front), lod0, True)
    for side in (-1, 1):
        trim.arch_window(glass, 0, 9.0, 1.9, 6.0, (side * 4.02, 0, 3), (side, 0, 0), lod0, True)
        for z_offset in (-1.5, 1.5):
            trim.arch_window(glass, z_offset, 18.05, 1.1, 3.9,
                             (side * 3.52, 0, 3), (side, 0, 0), lod0, True)
    for x in (-4.2, 4.2):
        for z in (-.9, 6.9):
            trim.box((x, 8.45, z), (.72, 16.9, .78), sandstone_light)
            trim.pyramid(x, 16.9, z, .48, 2.1, sandstone_light)
    for side in (-1, 1):
        x = side * 5.55
        mass.frustum(x, 9.2, 3, .78, .72, 7.2, sand, sides=8, angle=math.pi / 8, cap_top=False)
        trim.frustum(x, 16.4, 3, 1.03, 0, 5.8, slate, sides=8, angle=math.pi / 8, cap_bottom=False)
        trim.beam((x, 22.2, 3), (x, 23.1, 3), .05, gilt, sides=4, caps=True)
    for x in (-3.7, 3.7):
        for z in (-.7, 6.7):
            trim.box((x, 24.7, z), (1, 2.3, 1), sandstone_light)
            trim.frustum(x, 25.78, z, .74, 0, 3.07, slate, sides=4, angle=math.pi / 4)
    for center, horizontal, normal in (
        ((0, 15.9, 7), (1, 0, 0), (0, 0, 1)), ((0, 15.9, -1), (1, 0, 0), (0, 0, -1)),
        ((4, 15.9, 3), (0, 0, 1), (1, 0, 0)), ((-4, 15.9, 3), (0, 0, 1), (-1, 0, 0)),
    ):
        add_clock_dial(trim, center, horizontal, normal, lod0)
    make_spire(trim, lod0)

    objects = [mass.object(collection, lod_root, materials["Mass"]),
               trim.object(collection, lod_root, materials["Trim"]),
               glass.object(collection, lod_root, materials["Glass"])]
    return objects


def triangle_count(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def duplicate_triangle_count(objects):
    seen = set()
    duplicates = 0
    samples = []
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            points = [tuple(round(value, 6) for value in obj.matrix_world @ mesh.vertices[i].co) for i in triangle.vertices]
            key = tuple(sorted(points))
            if key in seen:
                duplicates += 1
                if len(samples) < 8:
                    samples.append(key)
            seen.add(key)
    return duplicates, samples


def bounds(objects):
    points = [blender_to_game(obj.matrix_world @ vertex.co) for obj in objects for vertex in obj.data.vertices]
    return tuple(min(point[i] for point in points) for i in range(3)) + tuple(max(point[i] for point in points) for i in range(3))


def validate_geometry(objects, lod):
    if len(objects) != 3 or {obj.name for obj in objects} != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: expected the Mass, Trim and Glass buckets")
    if {obj.data.materials[0].name for obj in objects} != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: unexpected material names")
    if any(abs(value) > 1e-7 for obj in objects for value in (*obj.location, *obj.rotation_euler)):
        raise ValueError(f"{lod}: mesh transform moved the local origin")
    for obj in objects:
        mesh = obj.data
        if len(mesh.color_attributes) != 1 or mesh.color_attributes[0].name != "Col" or not mesh.uv_layers:
            raise ValueError(f"{lod}: missing vertex colour or UV data in {obj.name}")
        for vertex in mesh.vertices:
            if not all(math.isfinite(value) for value in vertex.co):
                raise ValueError(f"{lod}: non-finite position in {obj.name}")
        for polygon in mesh.polygons:
            if polygon.area < 1e-9 or not all(math.isfinite(value) for value in polygon.normal) or abs(polygon.normal.length - 1) > 1e-3:
                raise ValueError(f"{lod}: degenerate face or invalid normal in {obj.name}")
        for tri in mesh.loop_triangles:
            a, b, c = (mesh.vertices[i].co for i in tri.vertices)
            if (b - a).cross(c - a).length < 1e-9:
                raise ValueError(f"{lod}: degenerate triangle in {obj.name}")
    count = triangle_count(objects)
    duplicates, duplicate_samples = duplicate_triangle_count(objects)
    if duplicates:
        raise ValueError(f"{lod}: {duplicates} exactly coincident triangle pairs may z-fight: {duplicate_samples}")
    if count > (8000 if lod == "LOD0" else 4000):
        parts = {obj.name: len(obj.data.loop_triangles) for obj in objects}
        raise ValueError(f"{lod}: triangle budget exceeded: {count} ({parts})")
    box = bounds(objects)
    if abs(box[0] + X_LIMIT) > .02 or abs(box[3] - X_LIMIT) > .02:
        raise ValueError(f"{lod}: X envelope changed: {box}")
    if abs(box[2] + Z_LIMIT) > .25 or abs(box[5] - Z_LIMIT) > .25:
        raise ValueError(f"{lod}: Z envelope changed: {box}")
    if abs(box[1]) > .02 or abs(box[4] - HEIGHT) > .02:
        raise ValueError(f"{lod}: vertical envelope changed: {box}")
    return count, box


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB header: {path}")
    size, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError(f"Missing GLB JSON chunk: {path}")
    return json.loads(data[20:20 + size].decode("utf-8").rstrip(" \t\r\n\0"))


def export_lod(path, lod_objects, lod_root):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (*lod_objects, lod_root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = lod_root
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_materials="EXPORT")
    bpy.ops.object.select_all(action="DESELECT")


def validate_roundtrip(path, lod, tri_limit):
    document = read_glb(path)
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    names = {material["name"] for material in document.get("materials", [])}
    if len(primitives) != 3 or names != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: expected three single-material draw calls, got {len(primitives)}")
    if document.get("images") or document.get("textures") or document.get("animations"):
        raise ValueError(f"{lod}: unexpected texture or animation payload")
    if any("uri" in buffer for buffer in document.get("buffers", [])):
        raise ValueError(f"{lod}: external buffer payload")
    nodes = document.get("nodes", [])
    roots = [node for node in nodes if node.get("name") == lod and len(node.get("children", [])) == 3]
    if not roots or {nodes[i].get("name") for i in roots[0]["children"]} != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: missing named root or material-bucket hierarchy")
    for primitive in primitives:
        if "NORMAL" not in primitive.get("attributes", {}) or "COLOR_0" not in primitive.get("attributes", {}):
            raise ValueError(f"{lod}: GLB lost normals or vertex colours")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported_objects = list(set(bpy.data.objects) - before)
    imported = [obj for obj in imported_objects if obj.type == "MESH"]
    if len(imported) != 3:
        raise ValueError(f"{lod}: Blender imported {len(imported)} mesh buckets")
    count = triangle_count(imported)
    box = bounds(imported)
    if count > tri_limit or abs(box[1]) > .03 or abs(box[4] - HEIGHT) > .03:
        raise ValueError(f"{lod}: round-trip changed bounds or triangle budget: {box}, {count}")
    if abs(box[0] + X_LIMIT) > .03 or abs(box[3] - X_LIMIT) > .03:
        raise ValueError(f"{lod}: round-trip changed X envelope: {box}")
    if abs(box[2] + Z_LIMIT) > .25 or abs(box[5] - Z_LIMIT) > .25:
        raise ValueError(f"{lod}: round-trip changed Z envelope: {box}")
    imported_names = {obj.name.split(".")[0] for obj in imported}
    if imported_names != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: imported node names changed: {imported_names}")
    for obj in imported:
        for vertex in obj.data.vertices:
            if not all(math.isfinite(value) for value in vertex.co):
                raise ValueError(f"{lod}: imported non-finite position")
        for poly in obj.data.polygons:
            if poly.area < 1e-9 or not all(math.isfinite(value) for value in poly.normal) or abs(poly.normal.length - 1) > 1e-3:
                raise ValueError(f"{lod}: imported degenerate geometry or invalid normal")
    if duplicate_triangle_count(imported)[0]:
        raise ValueError(f"{lod}: imported exact triangle overlap may z-fight")
    for obj in imported_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    return count, box, len(primitives)


def main():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    scene = bpy.context.scene
    root_collection = bpy.data.collections.new("University")
    scene.collection.children.link(root_collection)
    university_root = bpy.data.objects.new("University", None)
    university_root.empty_display_type = "CUBE"
    root_collection.objects.link(university_root)
    materials = {"Mass": make_material("Mass", .86),
                 "Trim": make_material("Trim", .72),
                 "Glass": make_material("Glass", .24, .08)}
    OUT.mkdir(parents=True, exist_ok=True)
    metrics = {}
    for lod_index in (0, 1):
        lod_root = None
        objects = build_lod(lod_index, materials, root_collection, university_root)
        lod_root = objects[0].parent
        name = f"LOD{lod_index}"
        triangles, box = validate_geometry(objects, name)
        path = OUT / f"university.lod{lod_index}.glb"
        export_lod(path, objects, lod_root)
        imported_triangles, imported_box, calls = validate_roundtrip(path, name, 8000 if lod_index == 0 else 4000)
        metrics[name] = {"triangles": triangles, "draw_calls": calls, "bounds": box,
                         "roundtrip_triangles": imported_triangles, "roundtrip_bounds": imported_box,
                         "bytes": path.stat().st_size}
        for obj in objects:
            obj.name = f"LOD{lod_index}_{obj.name}"
            obj.data.name = obj.name
    lod1_collection = bpy.data.collections["LOD1"]
    lod1_collection.hide_viewport = True
    lod1_collection.hide_render = True
    keep_materials = set(materials.values())
    for material in list(bpy.data.materials):
        if material not in keep_materials:
            bpy.data.materials.remove(material)
    keep_collections = {root_collection, bpy.data.collections["LOD0"], lod1_collection}
    for collection in list(bpy.data.collections):
        if collection not in keep_collections:
            bpy.data.collections.remove(collection, do_unlink=True)
    blend_path = HERE / "university.blend"
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print("UNIVERSITY_METRICS " + json.dumps(metrics, sort_keys=True))


if __name__ == "__main__":
    main()
