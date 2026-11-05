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
EXPECTED = ((-20.6, 0.0, -13.3), (20.6, 16.77, 13.3))
COLORS = {
    "concrete": (0.63, 0.66, 0.68, 1.0),
    "seat_a": (0.34, 0.035, 0.055, 1.0),
    "seat_b": (0.52, 0.055, 0.075, 1.0),
    "turf": (0.12, 0.34, 0.15, 1.0),
    "steel": (0.70, 0.76, 0.80, 1.0),
    "brace": (0.45, 0.53, 0.58, 1.0),
    "roof": (0.78, 0.82, 0.84, 1.0),
    "line": (0.88, 0.88, 0.82, 1.0),
    "glass": (0.105, 0.19, 0.26, 1.0),
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


def arch_point(t):
    return Vector((-20.0 + 40.0 * t + 2.2 * math.sin(math.pi * t),
                   0.22 + 16.20 * 4 * t * (1 - t), -12.78))


def arch_points(count, z_offset=0.0, normal_offset=0.0, start=0.0, end=1.0):
    path = [arch_point(start + (end - start) * i / count) for i in range(count + 1)]
    if normal_offset:
        result = []
        for i, point in enumerate(path):
            tangent = (path[min(i + 1, count)] - path[max(0, i - 1)]).normalized()
            normal = Vector((-tangent.y, tangent.x, 0)).normalized()
            result.append(point + normal * normal_offset)
        path = result
    return [Vector((p.x, p.y, p.z + z_offset)) for p in path]


def build_lod(level, mats):
    lod0 = level == 0
    segment = 48 if lod0 else 22
    glass_segment = 48 if lod0 else 20
    seat_segment = 24 if lod0 else 14
    mass, trim, glass = Bucket("Mass"), Bucket("Trim"), Bucket("Glass")
    # The low elliptical shell keeps the Wembley arch as the skyline silhouette.
    mass.ring([(20.1, 13.3, 0), (20.1, 13.3, 1.45),
               (19.65, 12.85, 1.45), (19.65, 12.85, 0)], segment, COLORS["concrete"])
    mass.ring([(20.55, 13.25, 1.42), (20.55, 13.25, 2.55),
               (20.2, 12.9, 2.55), (20.2, 12.9, 1.42)], segment, COLORS["concrete"])
    glass.ring([(20.54, 13.24, 2.62), (20.54, 13.24, 4.2),
                (20.34, 13.04, 4.2), (20.34, 13.04, 2.62)], glass_segment,
               lambda face: (.20, .30, .36, 1) if (face % glass_segment) % 5 == 0 else COLORS["glass"])
    mass.ring([(20.52, 13.22, 4.18), (20.52, 13.22, 4.55),
               (20.17, 12.87, 4.55), (20.17, 12.87, 4.18)], segment, COLORS["steel"])
    glass.ring([(20.49, 13.19, 4.58), (20.49, 13.19, 6.72),
                (20.29, 12.99, 6.72), (20.29, 12.99, 4.58)], glass_segment,
               lambda face: (.20, .30, .36, 1) if (face % glass_segment) % 5 == 0 else COLORS["glass"])
    mass.ring([(20.32, 13.02, 6.7), (20.32, 13.02, 7.5),
               (19.97, 12.67, 7.5), (19.97, 12.67, 6.7)], segment, COLORS["concrete"])

    # Broad, rising red seating decks form a bowl around the pitch.
    tiers = ((7.35, 4.7, 9.1, 5.85, .65, 2.65),
             (9.15, 5.9, 11.25, 7.25, 2.65, 4.9),
             (11.3, 7.25, 13.0, 8.45, 4.9, 7.42))
    for row, (inner_x, inner_z, outer_x, outer_z, inner_y, outer_y) in enumerate(tiers):
        mass.ring([(inner_x, inner_z, inner_y), (outer_x, outer_z, outer_y),
                   (outer_x, outer_z, outer_y - .16),
                   (inner_x, inner_z, inner_y - .12)], seat_segment,
                  COLORS["seat_a"] if row != 1 else COLORS["seat_b"])

    mass.box((0, .28, 0), (14.2, .16, 8.8), COLORS["turf"])
    for x, z, w, d in ((0, 0, .07, 8.6), (0, -4.28, 14, .06),
                       (0, 4.28, 14, .06), (-6.97, 0, .06, 8.5),
                       (6.97, 0, .06, 8.5), (-4.7, 0, 2.1, .06),
                       (4.7, 0, 2.1, .06), (-5.9, 0, .06, 3.4),
                       (5.9, 0, .06, 3.4)):
        trim.box((x, .37, z), (w, .025, d), COLORS["line"])
    trim.ring([(1.05, 1.05, .385), (1.05, 1.05, .36),
               (1.0, 1.0, .36), (1.0, 1.0, .385)], 24 if lod0 else 16, COLORS["line"])

    # Sliding end leaves cover the end stands, leaving the full pitch visible through the centre.
    panel_x = 14 if lod0 else 5
    panel_z = 6 if lod0 else 3
    for sign in (-1, 1):
        vertices, faces = [], []
        for ix in range(panel_x + 1):
            x_abs = 7.55 + (16.25 - 7.55) * ix / panel_x
            z_max = 9.9 * math.sqrt(max(0.0, 1 - (x_abs / 16.5) ** 2))
            for iz in range(panel_z + 1):
                across = -1 + 2 * iz / panel_z
                z = across * z_max
                y = 8.0 + .22 * (1 - across * across)
                vertices.append((sign * x_abs, y, z))
        for ix in range(panel_x):
            for iz in range(panel_z):
                a = ix * (panel_z + 1) + iz
                b, c = a + panel_z + 1, a + panel_z + 2
                faces.append((a, b, c, a + 1))
        mass.add(vertices, faces, COLORS["roof"])

    # Roof rim and exposed radial frame remain visible around and beneath both leaves.
    mass.ring([(20.25, 13.0, 7.92), (20.25, 13.0, 7.65),
               (16.55, 10.2, 7.65), (16.55, 10.2, 7.92)], segment, COLORS["roof"])
    bays = 20 if lod0 else 10
    spokes = 10 if lod0 else 5
    for i in range(bays):
        a = math.tau * i / bays
        p = lambda t, y: (20.43 * math.cos(t), y, 13.15 * math.sin(t))
        trim.beam(p(a, 2.55), p(a, 7.5), .038, COLORS["steel"], 4)
        if i % 2 == 0:
            trim.beam(p(a, 1.45), p(a, 2.55), .075, COLORS["steel"], 5)
        if i % 2 == 0:
            delta = math.tau / bays * .46
            trim.beam(p(a - delta, 7.5), p(a + delta, 7.92), .045, COLORS["steel"], 4)
    for y, rx, rz in ((4.53, 20.5, 13.2), (7.62, 20.25, 13.0)):
        trim.ring([(rx, rz, y), (rx, rz, y - .055),
                   (rx - .12, rz - .12, y - .055), (rx - .12, rz - .12, y)], 24 if lod0 else 16, COLORS["steel"])
    for i in range(spokes):
        a = math.tau * i / spokes
        trim.beam((18.9 * math.cos(a), 7.82, 12.05 * math.sin(a)),
                  (16.55 * math.cos(a), 7.86, 10.2 * math.sin(a)),
                  .06, COLORS["steel"], 4)
    trim.ring([(16.6, 10.25, 7.88), (16.6, 10.25, 7.8),
               (16.3, 9.95, 7.8), (16.3, 9.95, 7.88)], 24 if lod0 else 16, COLORS["steel"])

    # Repeated curtain-wall mullions make the dark glazing read as a glazed stadium facade.
    mullions = 36 if lod0 else 18
    for i in range(mullions):
        a = math.tau * i / mullions
        x, z = 20.47 * math.cos(a), 13.17 * math.sin(a)
        trim.beam((x, 2.62, z), (x * .99, 7.45, z * .99),
                  .034, COLORS["steel"], 4)

    for sign in (-1, 1):
        mass.box((sign * 20.0, .24, -12.78), (1.2, .48, .95), COLORS["concrete"])
        spring = arch_point(.02 if sign < 0 else .98)
        trim.beam((sign * 20.0, .18, -12.78), spring, .16, COLORS["steel"], 6)
        for z in (-13.0, -12.56):
            trim.beam((sign * 20.0, 0.0, z), (sign * 20.0, 1.5, z),
                      .055, COLORS["steel"], 4)
        trim.beam((sign * 20.0, 1.5, -13.0), (sign * 20.0, 1.5, -12.56),
                  .055, COLORS["steel"], 4)

    # One curved spine and its ground-spanning splayed legs form a single, broad 3D lattice girder.
    n = 16 if lod0 else 8
    start, end = .02, .98
    arch_sides = (-.35, .35)
    chord_offsets = (-.30, .30)
    spine_points = arch_points(n, start=start, end=end)
    trim.tube(arch_points(n * 2, start=start, end=end), .22, COLORS["steel"], 8)
    for z_offset in arch_sides:
        inner = arch_points(n, z_offset, chord_offsets[0], start, end)
        outer = arch_points(n, z_offset, chord_offsets[1], start, end)
        for i in range(n + 1):
            trim.beam(inner[i], outer[i], .04, COLORS["steel"], 4)
            if i < n:
                trim.beam(inner[i], outer[i + 1], .05, COLORS["brace"], 4)
                trim.beam(outer[i], inner[i + 1], .05, COLORS["brace"], 4)

    for i in range(0, n + 1, 2):
        for offset in chord_offsets:
            tangent = (spine_points[min(i + 1, n)] - spine_points[max(i - 1, 0)]).normalized()
            normal = Vector((-tangent.y, tangent.x, 0)).normalized()
            center = spine_points[i] + normal * offset
            trim.beam((center.x, center.y, center.z + arch_sides[0]),
                      (center.x, center.y, center.z + arch_sides[1]), .04, COLORS["steel"], 4)

    # Slender stays connect the single arch back to the roof edge it supports.
    tie_steps = (0.16, .23, .30, .37, .44, .51, .58, .65, .72, .79, .86) if lod0 else (.22, .36, .5, .64, .78)
    for t in tie_steps:
        point = arch_point(t)
        roof_z = -13.0 * math.sqrt(max(0.0, 1 - (point.x / 20.2) ** 2))
        trim.beam(point, (point.x, 7.82, roof_z), .022, COLORS["steel"], 4)

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
