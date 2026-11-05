#!/usr/bin/env python3
"""Build the local Copan landmark mesh and export its two GLB LODs."""

import json
import math
import random
import struct
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "assets" / "processed" / "landmarks"
HEIGHT, LENGTH, AMPLITUDE, DEPTH = 36.0, 34.0, 5.0, 9.2
BASE_HEIGHT, STORIES, BAND_HEIGHT = 3.2, 32, 0.18
HALF_DEPTH = DEPTH / 2
CORE_DEPTH = HALF_DEPTH - 0.75
CORE_TOP = HEIGHT - BAND_HEIGHT - 0.05
GLASS_DEPTH = CORE_DEPTH + 0.03
WINDOW_TEXTURE_SIZE = (384, 192)


def vector(value):
    return Vector(value)


def srgb(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values)


def material(name, color, roughness, metallic=0, emission_image=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*srgb(color), 1)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission_image:
        emission = bsdf.inputs.get("Emission Color")
        if emission is None:
            raise ValueError("Blender Principled BSDF has no Emission Color input")
        image_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.image = emission_image
        image_node.interpolation = "Closest"
        mat.node_tree.links.new(image_node.outputs["Color"], emission)
        bsdf.inputs["Emission Strength"].default_value = 1
    return mat


class Surface:
    def __init__(self, name):
        self.name = name
        self.vertices = []
        self.faces = []
        self.normals = []
        self.smooth = []
        self.uvs = []
        self.has_uvs = False

    def face(self, points, expected, smooth=False, corner_normals=None, corner_uvs=None):
        points = [vector(p) for p in points]
        normal = vector(expected).normalized()
        area = sum((points[i].cross(points[(i + 1) % len(points)]) for i in range(len(points))), Vector())
        if area.length < 1e-10:
            raise ValueError(f"Degenerate face in {self.name}")
        if area.dot(normal) < 0:
            points.reverse()
            if corner_normals is not None:
                corner_normals = list(reversed(corner_normals))
            if corner_uvs is not None:
                corner_uvs = list(reversed(corner_uvs))
        normals = corner_normals or [normal] * len(points)
        start = len(self.vertices)
        self.vertices.extend(tuple(p) for p in points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.normals.extend(tuple(vector(n).normalized()) for n in normals)
        self.smooth.append(smooth)
        self.uvs.append(corner_uvs)
        self.has_uvs |= corner_uvs is not None

    def object(self, collection, mat):
        if any(not all(math.isfinite(v) for v in n) or abs(vector(n).length - 1) > 1e-6 for n in self.normals):
            raise ValueError(f"Invalid custom normal in {self.name}")
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(mat)
        mesh.update(calc_edges=True)
        if mesh.validate(verbose=False, clean_customdata=False):
            raise ValueError(f"Invalid geometry in {self.name}")
        mesh.normals_split_custom_set(self.normals)
        for polygon, smooth in zip(mesh.polygons, self.smooth):
            polygon.use_smooth = smooth
            polygon.material_index = 0
        if self.has_uvs:
            layer = mesh.uv_layers.new(name="UVMap")
            for polygon, uvs in zip(mesh.polygons, self.uvs):
                for loop_index, uv in zip(polygon.loop_indices, uvs or [(0, 0)] * len(polygon.loop_indices)):
                    layer.data[loop_index].uv = uv
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        return obj


def frame(t):
    x = -LENGTH / 2 + LENGTH * t
    z = AMPLITUDE * math.sin(2 * math.pi * t)
    slope = AMPLITUDE * 2 * math.pi / LENGTH * math.cos(2 * math.pi * t)
    scale = math.sqrt(1 + slope * slope)
    tangent = Vector((1 / scale, 0, slope / scale))
    normal = Vector((-slope / scale, 0, 1 / scale))
    return Vector((x, -z, 0)), Vector((tangent.x, -tangent.z, 0)), Vector((normal.x, -normal.z, 0))


def point(t, depth, y, tangent_offset=0):
    center, tangent, normal = frame(t)
    return center + normal * depth + tangent * tangent_offset + Vector((0, 0, y))


def sweep_box(target, y0, y1, depth, segments, top_bottom=True, end_caps=True):
    for side in (-1, 1):
        for i in range(segments):
            t0, t1 = i / segments, (i + 1) / segments
            n0, n1 = frame(t0)[2] * side, frame(t1)[2] * side
            nm = frame((t0 + t1) / 2)[2] * side
            target.face(
                [point(t0, side * depth, y0), point(t1, side * depth, y0),
                 point(t1, side * depth, y1), point(t0, side * depth, y1)],
                nm, True, [n0, n1, n1, n0],
            )
    if top_bottom:
        for y, up in ((y1, True), (y0, False)):
            expected = Vector((0, 0, 1 if up else -1))
            for i in range(segments):
                t0, t1 = i / segments, (i + 1) / segments
                target.face(
                    [point(t0, -depth, y), point(t1, -depth, y),
                     point(t1, depth, y), point(t0, depth, y)],
                    expected,
                )
    if end_caps:
        for t, sign in ((0, -1), (1, 1)):
            tangent = frame(t)[1] * sign
            target.face(
                [point(t, -depth, y0), point(t, depth, y0),
                 point(t, depth, y1), point(t, -depth, y1)],
                tangent,
            )


def add_core(target, segments):
    sweep_box(target, 0, CORE_TOP, CORE_DEPTH, segments, end_caps=False)


def add_end_face(target, t, side, d0, d1, y0, y1, offset=0):
    target.face(
        [point(t, d0, y0, offset), point(t, d1, y0, offset),
         point(t, d1, y1, offset), point(t, d0, y1, offset)],
        frame(t)[1] * side,
    )


def add_end_mullion(target, t, side, center, width, y0, y1, offset):
    target.face(
        [point(t, center - width / 2, y0, offset),
         point(t, center + width / 2, y0, offset),
         point(t, center + width / 2, y1, offset),
         point(t, center - width / 2, y1, offset)],
        frame(t)[1] * side,
    )


def add_end_windows(mass, trim, glass, base_mullions, side_story_step):
    side_windows = 0
    for t, side in ((0, -1), (1, 1)):
        # The horizontal ribbon end caps remain outside these recessed end windows.
        for d0, d1 in (
            (-CORE_DEPTH, -CORE_DEPTH + 0.22),
            (CORE_DEPTH - 0.22, CORE_DEPTH),
        ):
            add_end_face(mass, t, side, d0, d1, BASE_HEIGHT, CORE_TOP - 0.20)
            add_end_face(mass, t, side, d0, d1, 0.42, 2.75)
        add_end_face(mass, t, side, -CORE_DEPTH, CORE_DEPTH, CORE_TOP - 0.20, CORE_TOP)
        inset = -side * 0.04
        panel_depth = CORE_DEPTH - 0.22
        if t == 1:
            add_end_face(mass, t, side, -panel_depth, panel_depth, BASE_HEIGHT, CORE_TOP - 0.20, inset)
            window_height = 0.24
            pitch = (CORE_TOP - BASE_HEIGHT) / STORIES
            for story in range(0, STORIES, side_story_step):
                y = BASE_HEIGHT + (story + 0.5) * pitch
                for column in range(4):
                    d = -panel_depth + (column + 0.5) * 2 * panel_depth / 4
                    add_end_face(glass, t, side, d - 0.09, d + 0.09,
                                 y - window_height / 2, y + window_height / 2, -side * 0.015)
                    side_windows += 1
        else:
            add_end_face(glass, t, side, -panel_depth, panel_depth, BASE_HEIGHT, CORE_TOP - 0.20, inset)
            for i in range(1, 5):
                d = -panel_depth + i * 2 * panel_depth / 5
                add_end_mullion(trim, t, side, d, 0.055, BASE_HEIGHT + 0.04, CORE_TOP - 0.24, inset / 2)
        add_end_face(glass, t, side, -panel_depth, panel_depth, 0.42, 2.75, inset)
        for i in range(1, base_mullions + 1):
            d = -panel_depth + i * 2 * panel_depth / (base_mullions + 1)
            add_end_mullion(trim, t, side, d, 0.08, 0.42, 2.75, inset / 2)
    expected = 4 * math.ceil(STORIES / side_story_step)
    if side_windows != expected:
        raise ValueError(f"Copan side wall has {side_windows} windows; expected {expected}")


def add_window_wall(target, y0, y1, depth, segments):
    for side in (-1, 1):
        for i in range(segments):
            t0, t1 = i / segments, (i + 1) / segments
            n0, n1 = frame(t0)[2] * side, frame(t1)[2] * side
            u0 = (0.5 if side == 1 else 0) + t0 * 0.5
            u1 = (0.5 if side == 1 else 0) + t1 * 0.5
            v0 = 0.02 + 0.96 * (y0 - BASE_HEIGHT) / (HEIGHT - BAND_HEIGHT - BASE_HEIGHT)
            v1 = 0.02 + 0.96 * (y1 - BASE_HEIGHT) / (HEIGHT - BAND_HEIGHT - BASE_HEIGHT)
            target.face(
                [point(t0, side * depth, y0), point(t1, side * depth, y0),
                 point(t1, side * depth, y1), point(t0, side * depth, y1)],
                frame((t0 + t1) / 2)[2] * side, True,
                [n0, n1, n1, n0],
                [(u0, v0), (u1, v0), (u1, v1), (u0, v1)] if y0 >= BASE_HEIGHT else None,
            )


def lit_windows_image():
    width, height = WINDOW_TEXTURE_SIZE
    cell_w, cell_h = width // 48, height // STORIES
    pixels = [0.0] * (width * height * 4)
    pixels[3::4] = [1.0] * (width * height)
    rng = random.Random(6407)
    lit = 0
    for side in range(2):
        for bay in range(24):
            for story in range(STORIES):
                if rng.random() >= 0.29:
                    continue
                lit += 1
                w, h = rng.choice((4, 5)), rng.choice((3, 4))
                x0 = side * width // 2 + bay * cell_w + (cell_w - w) // 2
                y0 = story * cell_h + (cell_h - h) // 2
                value = rng.choice((0.58, 0.72, 0.86, 1.0))
                tint = rng.choices(((1.0, 0.42, 0.12), (1.0, 0.78, 0.5), (0.42, 0.72, 1.0)), (0.72, 0.22, 0.06), k=1)[0]
                for y in range(y0, y0 + h):
                    for x in range(x0, x0 + w):
                        pixel = (y * width + x) * 4
                        pixels[pixel:pixel + 3] = tuple(value * channel for channel in tint)
    if not 0.25 <= lit / (48 * STORIES) <= 0.33:
        raise ValueError(f"Unexpected Copan window light density: {lit}/{48 * STORIES}")
    image = bpy.data.images.new("Copan_Lit_Windows", width, height, alpha=False)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels)
    image.pack()
    return image


def add_mullion(target, t, side, d0, d1, y0, y1, width):
    _, tangent, normal = frame(t)
    corners = [(-width / 2, d0), (-width / 2, d1),
               (width / 2, d1), (width / 2, d0)]
    bottom = [point(t, side * d, y0, along) for along, d in corners]
    top = [point(t, side * d, y1, along) for along, d in corners]
    outward = [-tangent, normal * side, tangent, normal * -side]
    for i in range(4):
        j = (i + 1) % 4
        target.face([bottom[i], bottom[j], top[j], top[i]], outward[i])


def bounds(objects):
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    return tuple(min(p[i] for p in points) for i in range(3)) + tuple(max(p[i] for p in points) for i in range(3))


def triangle_count(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def validate_geometry(objects, lod):
    if len(objects) != 3:
        raise ValueError(f"{lod}: expected three material buckets, got {len(objects)}")
    if {obj.data.materials[0].name for obj in objects} != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: wrong material buckets")
    if any(obj.location.length > 1e-7 or max(abs(v) for v in obj.rotation_euler) > 1e-7 or (obj.scale - Vector((1, 1, 1))).length > 1e-7 for obj in objects):
        raise ValueError(f"{lod}: mesh object transform moved the lot origin")
    for obj in objects:
        for vertex in obj.data.vertices:
            if not all(math.isfinite(v) for v in vertex.co):
                raise ValueError(f"{lod}: non-finite vertex in {obj.name}")
        for polygon in obj.data.polygons:
            if polygon.area < 1e-9 or not all(math.isfinite(v) for v in polygon.normal) or abs(polygon.normal.length - 1) > 1e-5:
                raise ValueError(f"{lod}: degenerate face or invalid normal in {obj.name}")
        for tri in obj.data.loop_triangles:
            a, b, c = (obj.data.vertices[i].co for i in tri.vertices)
            if (b - a).cross(c - a).length < 1e-9:
                raise ValueError(f"{lod}: degenerate triangle in {obj.name}")
    tri_limit = 8000 if lod == "LOD0" else 3500
    triangles = triangle_count(objects)
    if triangles > tri_limit:
        raise ValueError(f"{lod}: {triangles} triangles exceeds {tri_limit}")
    box = bounds(objects)
    if abs(box[2]) > 1e-5 or abs(box[5] - HEIGHT) > 1e-5:
        raise ValueError(f"{lod}: vertical bounds must be 0..{HEIGHT}, got {box}")
    if box[0] < -21.7 or box[3] > 21.7 or box[1] < -9.95 or box[4] > 9.95:
        raise ValueError(f"{lod}: escaped the established site envelope: {box}")
    return triangles, box


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB header: {path}")
    size, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError(f"Missing GLB JSON chunk: {path}")
    return json.loads(data[20:20 + size].decode("utf-8").rstrip(" \t\r\n\0"))


def validate_roundtrip(path, lod, tri_limit):
    doc = read_glb(path)
    primitive_count = sum(len(mesh["primitives"]) for mesh in doc.get("meshes", []))
    names = {mat["name"] for mat in doc.get("materials", [])}
    if primitive_count != 3 or names != {"Mass", "Trim", "Glass"}:
        raise ValueError(f"{lod}: GLB must export three named material primitives")
    images, textures = doc.get("images", []), doc.get("textures", [])
    glass = next((mat for mat in doc["materials"] if mat["name"] == "Glass"), {})
    if len(images) != 1 or len(textures) != 1 or "bufferView" not in images[0] or "uri" in images[0] or "emissiveTexture" not in glass:
        raise ValueError(f"{lod}: the embedded lit-window emission map is missing or external")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = list(set(bpy.data.objects) - before)
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 3:
        raise ValueError(f"{lod}: Blender imported {len(meshes)} mesh buckets")
    tri_count = triangle_count(meshes)
    box = bounds(meshes)
    if tri_count > tri_limit or abs(box[2]) > 1e-4 or abs(box[5] - HEIGHT) > 1e-3:
        raise ValueError(f"{lod}: Blender GLB round-trip changed bounds or triangle budget: {box}, {tri_count}")
    if box[0] < -21.7 or box[3] > 21.7 or box[1] < -9.95 or box[4] > 9.95:
        raise ValueError(f"{lod}: imported GLB escaped the established site envelope: {box}")
    glass_object = next(obj for obj in meshes if "Glass" in obj.name)
    if not glass_object.data.uv_layers:
        raise ValueError(f"{lod}: lit-window UVs did not survive GLB round-trip")
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return tri_count, box, primitive_count


def build_lod(name, material_set, config):
    band_segments, core_segments, glass_segments, base_mullions, columns = config
    if glass_segments != core_segments:
        raise ValueError(f"{name}: glass and core must share subdivisions to prevent the core crossing the curved glazing")
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    surfaces = {key: Surface(f"{name}_{key}") for key in material_set}
    mass, trim, glass = surfaces["Mass"], surfaces["Trim"], surfaces["Glass"]

    add_core(mass, core_segments)
    sweep_box(mass, 0, 0.32, HALF_DEPTH, band_segments)
    sweep_box(mass, 2.86, BASE_HEIGHT, HALF_DEPTH, band_segments)

    floor_pitch = (HEIGHT - BASE_HEIGHT) / STORIES
    for story in range(1, STORIES + 1):
        top = BASE_HEIGHT + story * floor_pitch
        full_band = name == "Copan_LOD0" or story % 4 == 0
        sweep_box(trim, top - BAND_HEIGHT, top, HALF_DEPTH, band_segments, full_band)

    add_window_wall(glass, BASE_HEIGHT, HEIGHT - BAND_HEIGHT, GLASS_DEPTH, glass_segments)
    add_window_wall(glass, 0.42, 2.75, HALF_DEPTH + 0.03, band_segments)

    for side in (-1, 1):
        for i in range(1, columns + 1):
            add_mullion(mass, i / (columns + 1), side, GLASS_DEPTH + 0.02, GLASS_DEPTH + 0.055,
                        BASE_HEIGHT + 0.04, CORE_TOP - 0.04, 0.10)
        for i in range(1, base_mullions + 1):
            add_mullion(trim, i / (base_mullions + 1), side, HALF_DEPTH + 0.05, HALF_DEPTH + 0.10,
                        0.42, 2.75, 0.08)

    add_end_windows(mass, trim, glass, max(1, base_mullions // 2), 1 if name == "Copan_LOD0" else 2)
    objects = [surfaces[key].object(collection, material_set[key]) for key in ("Mass", "Trim", "Glass")]
    return collection, objects


def export_lod(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_yup=True, export_normals=True, export_texcoords=True,
        export_cameras=False, export_lights=False, export_apply=True,
    )
    bpy.ops.object.select_all(action="DESELECT")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.name.startswith("Copan_LOD"):
            bpy.data.collections.remove(collection)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name == "Copan_Lit_Windows":
            bpy.data.images.remove(image)

    window_map = lit_windows_image()
    materials = {
        "Mass": material("Mass", "#c0af8d", 0.84),
        "Trim": material("Trim", "#d1bd91", 0.68),
        "Glass": material("Glass", "#4b4945", 0.34, 0.02, window_map),
    }
    configs = {
        "LOD0": (24, 32, 32, 8, 20),
        "LOD1": (12, 16, 16, 8, 10),
    }
    results = {}
    for lod, config in configs.items():
        collection, objects = build_lod(f"Copan_{lod}", materials, config)
        triangles, box = validate_geometry(objects, lod)
        path = OUT / f"copan.{lod.lower()}.glb"
        export_lod(objects, path)
        imported_triangles, imported_box, calls = validate_roundtrip(path, lod, 8000 if lod == "LOD0" else 3500)
        results[lod] = {
            "triangles": triangles,
            "roundtrip_triangles": imported_triangles,
            "draw_calls": calls,
            "bounds_blender": [round(v, 4) for v in imported_box],
            "bytes": path.stat().st_size,
        }
        if triangles != imported_triangles or any(abs(a - b) > 1e-3 for a, b in zip(box, imported_box)):
            raise ValueError(f"{lod}: Blender GLB round-trip differs from source geometry")
        if lod == "LOD1" and any(abs(a - b) > 1e-4 for a, b in zip(results["LOD0"]["bounds_blender"], results["LOD1"]["bounds_blender"])):
            raise ValueError("LOD1 changed the LOD0 bounds")
        if lod == "LOD1":
            for obj in objects:
                obj.hide_set(True)
                obj.hide_render = True
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "copan.blend"))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
