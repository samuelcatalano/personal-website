#!/usr/bin/env python3
"""Build the original Riverside Museum landmark in Blender and export both LODs."""

import json
import math
import struct
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
BLEND = Path(__file__).resolve().parent / "riverside.blend"
GLB_DIR = ROOT / "assets/processed/landmarks"
KNOTS = [
    (0, 8.5), (3, 10.5), (6, 6.5), (9, 11), (11.5, 7.5), (14, 16.6),
    (16.5, 7), (18, 6.5), (21, 10), (24.5, 6.5), (28, 12), (30.5, 11.5), (32, 10.5),
]
DEPTH = 15.0
ROOF_THICKNESS = 0.85
FASCIA_DROP = 1.35
BOTTOM = 0.65
EPS = 1e-8


def roof_at(x):
    u = max(0.0, min(32.0, x + 16.0))
    for (u0, y0), (u1, y1) in zip(KNOTS, KNOTS[1:]):
        if u <= u1:
            return y0 + (y1 - y0) * (u - u0) / (u1 - u0)
    return KNOTS[-1][1]


def linear_channel(v):
    v /= 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


class MeshBucket:
    def __init__(self, material):
        self.material = material
        self.vertices = []
        self.faces = []

    def face(self, points, reverse=False):
        start = len(self.vertices)
        self.vertices.extend(points)
        face = tuple(range(start, start + len(points)))
        self.faces.append(face[::-1] if reverse else face)

    def box(self, center, size, angle_y=0.0):
        x, y, z = center
        sx, sy, sz = (v / 2 for v in size)
        c, s = math.cos(angle_y), math.sin(angle_y)
        local = [
            (-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
            (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz),
        ]
        verts = [(x + c * a + s * d, y + b, z - s * a + c * d) for a, b, d in local]
        start = len(self.vertices)
        self.vertices.extend(verts)
        self.faces.extend(tuple(start + i for i in f) for f in (
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
            (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5),
        ))

    def make_object(self, name, collection):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.validate(clean_customdata=True)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(name, mesh)
        obj.data.materials.append(self.material)
        collection.objects.link(obj)
        return obj


def material(name, hex_rgb, metallic, roughness):
    rgb = tuple(linear_channel(int(hex_rgb[i:i + 2], 16)) for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


def add_roof(mass, trim, seams):
    upper = [(u - 16.0, y - 0.045) for u, y in KNOTS]
    lower = [(x, y - ROOF_THICKNESS) for x, y in upper]
    half = DEPTH / 2
    for (x0, z0), (x1, z1), (_, lo0), (_, lo1) in zip(upper, upper[1:], lower, lower[1:]):
        mass.face([(x0, -half, z0), (x1, -half, z1), (x1, half, z1), (x0, half, z0)])
        mass.face([(x0, -half, lo0), (x1, -half, lo1), (x1, half, lo1), (x0, half, lo0)], True)
        mass.face([(x0, half, z0), (x1, half, z1), (x1, half, lo1), (x0, half, lo0)])
        mass.face([(x0, -half, z0), (x1, -half, z1), (x1, -half, lo1), (x0, -half, lo0)], True)
    x0, z0 = upper[0]
    x1, z1 = upper[-1]
    lo0, lo1 = lower[0][1], lower[-1][1]
    mass.face([(x0, -half, z0), (x0, half, z0), (x0, half, lo0), (x0, -half, lo0)])
    mass.face([(x1, -half, z1), (x1, half, z1), (x1, half, lo1), (x1, -half, lo1)], True)

    for y in seams:
        line = [(u - 16.0, h) for u, h in KNOTS]
        normals = []
        for (x0, z0), (x1, z1) in zip(line, line[1:]):
            length = math.hypot(x1 - x0, z1 - z0)
            normals.append((-(z1 - z0) / length, (x1 - x0) / length))
        offsets = [normals[0]]
        for previous, current in zip(normals, normals[1:]):
            nx, nz = previous[0] + current[0], previous[1] + current[1]
            scale = math.hypot(nx, nz)
            offsets.append((nx / scale, nz / scale))
        offsets.append(normals[-1])
        bottom = [(x - nx * 0.06, z - nz * 0.06) for (x, z), (nx, nz) in zip(line, offsets)]
        for i, ((x0, z0), (x1, z1)) in enumerate(zip(line, line[1:])):
            (bx0, bz0), (bx1, bz1) = bottom[i], bottom[i + 1]
            top0, top1 = (x0, y - 0.045, z0), (x1, y - 0.045, z1)
            top2, top3 = (x1, y + 0.045, z1), (x0, y + 0.045, z0)
            low0, low1 = (bx0, y - 0.045, bz0), (bx1, y - 0.045, bz1)
            low2, low3 = (bx1, y + 0.045, bz1), (bx0, y + 0.045, bz0)
            trim.face([top0, top1, top2, top3])
            trim.face([low3, low2, low1, low0])
            trim.face([top3, top2, low2, low3])
            trim.face([top0, top1, low1, low0], True)
        x0, z0 = line[0]
        x1, z1 = line[-1]
        b0x, b0z = bottom[0]
        b1x, b1z = bottom[-1]
        trim.face([(x0, y - 0.045, z0), (x0, y + 0.045, z0), (b0x, y + 0.045, b0z), (b0x, y - 0.045, b0z)])
        trim.face([(x1, y - 0.045, z1), (x1, y + 0.045, z1), (b1x, y + 0.045, b1z), (b1x, y - 0.045, b1z)], True)


def add_side_glass(glass, trim, lod):
    step = 0.5 if lod == 0 else 1.0
    for side in (-1, 1):
        y = side * 7.08
        outer = y + side * 0.055
        count = round(31.4 / step)
        xs = [-15.7 + 31.4 * i / count for i in range(count + 1)]
        for x0, x1 in zip(xs, xs[1:]):
            z0, z1 = roof_at(x0) - FASCIA_DROP, roof_at(x1) - FASCIA_DROP
            glass.face([(x0, y, BOTTOM), (x0, y, z0), (x1, y, z1), (x1, y, BOTTOM)], reverse=side < 0)
            f0, f1 = roof_at(x0) - ROOF_THICKNESS + 0.04, roof_at(x1) - ROOF_THICKNESS + 0.04
            trim.face([(x0, outer, f0), (x0, outer, z0), (x1, outer, z1), (x1, outer, f1)], reverse=side < 0)

        columns = 16 if lod == 0 else 8
        grid = [-15.7 + 31.4 * i / columns for i in range(columns + 1)]
        for x in grid:
            top = roof_at(x) - FASCIA_DROP
            height = top - BOTTOM
            trim.box((x, y + side * 0.055, (top + BOTTOM) / 2), (0.14, 0.16, height))

        elevations = (3.0, 5.8, 8.6, 11.4, 14.2)
        for x0, x1 in zip(grid, grid[1:]):
            top = min(roof_at(x0), roof_at(x1)) - FASCIA_DROP
            for elevation in elevations:
                if elevation < top - 0.15:
                    trim.box(((x0 + x1) / 2, y + side * 0.055, elevation), (x1 - x0, 0.14, 0.09))

        # A few deep steel V-frames make the glazed elevations read as a supported hall.
        for peak in ((-7.0, -2.0, 5.0, 12.0) if lod == 0 else (-2.0, 12.0)):
            z1 = roof_at(peak) - FASCIA_DROP + 0.12
            for foot in (peak - 1.5, peak + 1.5):
                dx, dz = peak - foot, z1 - BOTTOM
                trim.box(((foot + peak) / 2, y - side * 0.4, (z1 + BOTTOM) / 2),
                         (math.hypot(dx, dz), 0.16, 0.16), math.atan2(-dz, dx))


def add_end_glass(glass, trim, side, lod):
    x = side * 15.68
    top = roof_at(x) - FASCIA_DROP
    half = 6.78
    glass.face([(x, -half, BOTTOM), (x, -half, top), (x, half, top), (x, half, BOTTOM)], reverse=side > 0)
    count = 5 if lod == 0 else 3
    for i in range(count):
        y = -half + (2 * half) * i / (count - 1)
        trim.box((x + side * 0.065, y, (BOTTOM + top) / 2), (0.12, 0.10, top - BOTTOM))
    for elevation in (3.0, 5.8, 8.6, 11.4, 14.2):
        if elevation < top - 0.15:
            trim.box((x + side * 0.065, 0, elevation), (0.12, 2 * half, 0.075))


def create_asset(lod, collection, mats):
    mass, trim, glass = (MeshBucket(mats[n]) for n in ("Mass", "Trim", "Glass"))
    seam_count = 13 if lod == 0 else 7
    seams = [-6.4 + 12.8 * i / (seam_count - 1) for i in range(seam_count)]
    add_roof(mass, trim, seams)
    mass.box((0, 0, 0.475), (32.0, DEPTH, 0.35))
    add_side_glass(glass, trim, lod)
    add_end_glass(glass, trim, -1, lod)
    add_end_glass(glass, trim, 1, lod)

    suffix = "" if lod == 0 else "_LOD1"
    return [bucket.make_object(name + suffix, collection) for name, bucket in zip(("Mass", "Trim", "Glass"), (mass, trim, glass))]


def export_objects(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    names = [(obj, obj.name, obj.data.name) for obj in objects]
    targets = {obj.name.split("_LOD1")[0] for obj in objects}
    hidden_names = []
    for obj in bpy.data.objects:
        if obj not in objects and obj.name in targets:
            hidden_names.append((obj, obj.name, obj.data.name if obj.data else None))
            obj.name += "_saved"
            if obj.data:
                obj.data.name += "_saved"
    for obj, _, _ in names:
        target = obj.name.split("_LOD1")[0]
        obj.name = target
        obj.data.name = target
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(path), export_format="GLB", use_selection=True,
            export_yup=True, export_apply=True, export_materials="EXPORT",
            export_normals=True, export_texcoords=False,
            export_cameras=False, export_lights=False, export_animations=False,
            export_draco_mesh_compression_enable=False,
        )
    finally:
        for obj, object_name, data_name in names:
            obj.name, obj.data.name = object_name, data_name
        for obj, object_name, data_name in hidden_names:
            obj.name = object_name
            if obj.data:
                obj.data.name = data_name
        bpy.ops.object.select_all(action="DESELECT")


def validate_glb(path, expected_max):
    raw = path.read_bytes()
    assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2
    total = struct.unpack_from("<I", raw, 8)[0]
    assert total == len(raw), f"{path.name}: GLB length header mismatch"
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    assert json_type == 0x4E4F534A
    doc = json.loads(raw[20:20 + json_length].decode("utf-8").rstrip(" \0"))
    bin_offset = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", raw, bin_offset)
    assert bin_type == 0x004E4942
    assert len(doc.get("materials", [])) == 3
    assert {m["name"] for m in doc["materials"]} == {"Mass", "Trim", "Glass"}
    assert not doc.get("textures") and not doc.get("images")
    assert all("uri" not in b for b in doc.get("buffers", []))
    assert not doc.get("cameras") and "KHR_lights_punctual" not in doc.get("extensionsUsed", [])
    assert all(n.get("name") in {"Mass", "Trim", "Glass"} for n in doc["nodes"] if "mesh" in n)

    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=False)
    imported = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert {o.name for o in imported} == {"Mass", "Trim", "Glass"}
    assert len(imported) == 3
    low = Vector((float("inf"),) * 3)
    high = Vector((float("-inf"),) * 3)
    triangles = 0
    for obj in imported:
        assert len(obj.data.materials) == 1 and obj.data.materials[0].name in {"Mass", "Trim", "Glass"}
        assert len(obj.data.polygons) > 0
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            assert all(math.isfinite(v) for v in point)
            low = Vector((min(low[i], point[i]) for i in range(3)))
            high = Vector((max(high[i], point[i]) for i in range(3)))
        for poly in obj.data.polygons:
            assert len(poly.vertices) == 3, f"{obj.name}: GLB primitive is not triangulated"
            a, b, c = (obj.matrix_world @ obj.data.vertices[i].co for i in poly.vertices)
            assert (b - a).cross(c - a).length > EPS, f"{obj.name}: degenerate triangle"
            assert all(math.isfinite(v) for v in poly.normal), f"{obj.name}: non-finite normal"
        triangles += len(obj.data.polygons)
    dims = high - low
    bounds = (tuple(round(v, 4) for v in low), tuple(round(v, 4) for v in high))
    assert all(abs(a - b) < 0.02 for a, b in zip(dims, (32.0, DEPTH, 16.3))), f"{path.name}: local Blender bounds {bounds}"
    assert all(abs(a - b) < 0.02 for a, b in zip(low, (-16.0, -DEPTH / 2, 0.3)))
    assert all(abs(a - b) < 0.02 for a, b in zip(high, (16.0, DEPTH / 2, 16.6)))
    assert triangles <= expected_max, f"{path.name}: {triangles} triangles exceeds {expected_max}"

    imported_names = [o.name for o in imported]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    return {
        "triangles": triangles,
        "meshes_draw_calls": len(imported_names),
        "bounds_blender_z_up": bounds,
        "glb_bytes": len(raw),
        "bin_payload_bytes": bin_length,
    }


def preview(objects, out):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 1000, 650
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(out)
    world = bpy.data.worlds.new("Riverside preview world")
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.055, 0.075, 0.095, 1)
    scene.world = world
    light_collection = bpy.data.collections.new("Temporary preview only")
    scene.collection.children.link(light_collection)
    camera_data = bpy.data.cameras.new("Preview camera")
    camera = bpy.data.objects.new("Preview camera", camera_data)
    light_collection.objects.link(camera)
    camera.location = (30, 36, 27)
    target = Vector((0, 0, 8))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 49
    scene.camera = camera
    for name, location, energy, size in (
        ("Key", (1, 15, 31), 4300, 17), ("Fill", (-22, -5, 17), 2300, 15), ("Rim", (12, -18, 24), 3400, 13),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        obj = bpy.data.objects.new(name, data)
        light_collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((0, 0, 7)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.objects.active = camera
    bpy.ops.render.render(write_still=True)
    scene.camera = None
    for obj in list(light_collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(light_collection)
    bpy.data.worlds.remove(world)
    scene.world = None
    for obj in objects:
        obj.hide_set(False)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    materials = {
        "Mass": material("Mass", "C1C5C7", 0.62, 0.44),
        "Trim": material("Trim", "343B3E", 0.46, 0.5),
        "Glass": material("Glass", "84A2B4", 0.0, 0.08),
    }
    glass_shader = materials["Glass"].node_tree.nodes.get("Principled BSDF")
    glass_shader.inputs["Transmission Weight"].default_value = 0.8
    glass_shader.inputs["IOR"].default_value = 1.52
    collections = {}
    for name in ("LOD0", "LOD1"):
        collections[name] = bpy.data.collections.new(name)
        scene.collection.children.link(collections[name])
    lod0 = create_asset(0, collections["LOD0"], materials)
    lod1 = create_asset(1, collections["LOD1"], materials)
    GLB_DIR.mkdir(parents=True, exist_ok=True)
    export_objects(lod0, GLB_DIR / "riverside.lod0.glb")
    export_objects(lod1, GLB_DIR / "riverside.lod1.glb")

    for obj in lod1:
        obj.hide_set(True)
        obj.hide_render = True
    preview(lod0, Path("/tmp/riverside-lod0-preview.png"))
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    metrics = {
        "lod0": validate_glb(GLB_DIR / "riverside.lod0.glb", 8000),
        "lod1": validate_glb(GLB_DIR / "riverside.lod1.glb", 4000),
    }
    print("RIVERSIDE_VALIDATION=" + json.dumps(metrics, sort_keys=True))


if __name__ == "__main__":
    main()
