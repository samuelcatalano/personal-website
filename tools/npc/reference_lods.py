#!/usr/bin/env python3
"""Build unrigged body/head LODs without reshaping or regenerating either source.

python3 tools/npc/reference_lods.py BODY.glb HEAD.glb OUT --body-dump BODY.post.bin --head-dump HEAD.post.bin
Uses installed Blender and optional local Pixal3D replay; no downloads or installs.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

BUDGETS = {"body": (18000, 6500, 2000), "head": (12000, 4000, 700)}


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def reduce_mesh(bpy, obj, target):
    before = triangles(obj)
    if before <= target:
        return
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new("LOD reduction", "DECIMATE")
    modifier.ratio = target / before
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Decimate retains orphan vertices; remove them so source and exported bounds describe rendered geometry.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    assert 0 < triangles(obj) <= target + 2, (obj.name, triangles(obj), target)


def import_mesh(bpy, path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in objects if o.type == "MESH"]
    assert len(meshes) == 1 and not any(o.type == "ARMATURE" for o in objects), "Expected one unrigged source mesh"
    assert meshes[0].data.uv_layers, "Source has no UV layer"
    return meshes[0]


def smooth_uv_seams(bpy, obj):
    # Average normals across identical atlas vertices without welding/removing any source faces.
    import numpy as np
    coordinates = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", coordinates)
    coordinates = coordinates.reshape(-1, 3)
    _, inverse = np.unique(coordinates, axis=0, return_inverse=True)
    obj.data.calc_loop_triangles()
    indices = np.empty(len(obj.data.loop_triangles) * 3, dtype=np.int32)
    obj.data.loop_triangles.foreach_get("vertices", indices)
    indices = indices.reshape(-1, 3)
    faces = coordinates[indices]
    normals = np.cross(faces[:, 1] - faces[:, 0], faces[:, 2] - faces[:, 0])
    averaged = np.zeros((int(inverse.max()) + 1, 3), dtype=np.float64)
    for corner in range(3):
        np.add.at(averaged, inverse[indices[:, corner]], normals)
    lengths = np.linalg.norm(averaged, axis=1)
    averaged /= np.maximum(lengths[:, None], 1e-20)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    assert np.isfinite(averaged).all() and obj.data.uv_layers
    obj.data.normals_split_custom_set_from_vertices(averaged[inverse].tolist())


def summary(bpy, obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    assert points and all(math.isfinite(c) for point in points for c in point), "Invalid mesh positions"
    images = {node.image for material in obj.data.materials if material and material.use_nodes
              for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image}
    assert images and obj.data.uv_layers, "Missing texture/UV data"
    assert all(0 < max(image.size) <= 2048 for image in images), "Texture exceeds 2048 cap"
    return {"triangles": triangles(obj), "vertices": len(obj.data.vertices),
            "materials": len(obj.data.materials), "textures": [list(image.size) for image in images],
            "bounds_blender_xyz": [[round(min(point[i] for point in points), 7) for i in range(3)],
                                   [round(max(point[i] for point in points), 7) for i in range(3)]],
            "uv_layers": len(obj.data.uv_layers)}


def transfer_colour(bpy, source, target, directory):
    # Replay keeps generator paint; bake the accepted source paint rather than silently replacing it.
    image = bpy.data.images.new("albedo", width=2048, height=2048, alpha=False)
    material = bpy.data.materials.new("reference_albedo")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    target.data.materials.clear()
    target.data.materials.append(material)
    target.active_material_index = 0
    for node in nodes:
        node.select = False
    texture.select = True
    nodes.active = texture
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.seed = 0
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.use_pass_direct = bake.use_pass_indirect = False
    bake.use_pass_color = True
    bake.use_clear = True
    bake.margin = 16
    bake.cage_extrusion = max(target.dimensions) * 0.005
    bake.max_ray_distance = bake.cage_extrusion * 2
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    assert bpy.ops.object.bake(type="DIFFUSE") == {"FINISHED"}, "Albedo bake failed"
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    image.filepath_raw = str(directory / "albedo.png")
    image.file_format = "PNG"
    image.save()



def image_stats(image):
    import numpy as np
    values = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(values)
    rgb = values.reshape(-1, 4)[:, :3]
    assert np.isfinite(rgb).all() and rgb.max() > 0, "Empty/nonfinite baked image"
    variation = rgb.std(axis=0, dtype=np.float64)
    assert variation.max() > 1e-5, "Baked image is constant; inspect bake/ray alignment"
    return {"mean_rgb": rgb.mean(axis=0, dtype=np.float64).tolist(),
            "stddev_rgb": variation.tolist(), "min_rgb": rgb.min(axis=0).tolist(),
            "max_rgb": rgb.max(axis=0).tolist()}


def bake_normals(bpy, source, target, directory):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    material = target.data.materials[0]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    image = bpy.data.images.new("normal", width=2048, height=2048, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    for node in nodes:
        node.select = False
    texture.select = True
    nodes.active = texture
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.margin = 16
    bake.use_clear = True
    bake.cage_extrusion = max(target.dimensions) * 0.005
    bake.max_ray_distance = bake.cage_extrusion * 2
    bake.normal_space = "TANGENT"
    bake.normal_r, bake.normal_g, bake.normal_b = "POS_X", "POS_Y", "POS_Z"
    # Sample rays in the unchanged world frame; this reports misses rather than certifying all atlas texels.
    tree = BVHTree.FromPolygons([source.matrix_world @ vertex.co for vertex in source.data.vertices],
                               [tuple(poly.vertices) for poly in source.data.polygons])
    hits = misses = 0
    step = max(1, len(target.data.polygons) // 4000)
    normal_matrix = target.matrix_world.to_3x3().inverted().transposed()
    for index in range(0, len(target.data.polygons), step):
        poly = target.data.polygons[index]
        center = target.matrix_world @ poly.center
        normal = sum((target.data.corner_normals[i].vector for i in poly.loop_indices), Vector())
        normal = (normal_matrix @ normal).normalized()
        origin = center + normal * bake.cage_extrusion
        point, _, _, _ = tree.ray_cast(origin, -normal, bake.max_ray_distance)
        if point is None:
            misses += 1
        else:
            hits += 1
    del tree
    assert hits, "No sampled cage rays reached the source; normal bake refused"
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    assert bpy.ops.object.bake(type="NORMAL") == {"FINISHED"}, "Normal bake failed"
    stats = image_stats(image)
    image.filepath_raw = str(directory / "normal.png")
    image.file_format = "PNG"
    image.save()
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.space = "TANGENT"
    links.new(texture.outputs["Color"], normal_map.inputs["Color"])
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    albedo = next(node.image for node in nodes if node.type == "TEX_IMAGE" and node.image != image)
    report = {"status": "completed with sampled ray misses" if misses else "completed",
              "space": "TANGENT", "swizzle": "+X,+Y,+Z", "device": "CPU",
              "size": [2048, 2048], "cage_extrusion": bake.cage_extrusion,
              "max_ray_distance": bake.max_ray_distance, "sampled_ray_hits": hits,
              "sampled_ray_misses": misses, "coverage_limit": "Face-centre sample, not per-texel coverage",
              "normal_image": stats, "albedo_image": image_stats(albedo)}
    print("REFERENCE_LODS normal bake: " + json.dumps(report), flush=True)
    return report


def has_normal_texture(obj):
    return any(node.type == "NORMAL_MAP" and node.inputs["Color"].is_linked
               and node.inputs["Color"].links[0].from_node.type == "TEX_IMAGE"
               for material in obj.data.materials if material and material.use_nodes
               for node in material.node_tree.nodes)


def build_part(bpy, args, name):
    source_path, dump = getattr(args, name), getattr(args, name + "_dump")
    directory = args.out / name
    directory.mkdir(parents=True, exist_ok=True)
    native_path = directory / "native-lod0.glb"
    route, reason = "blender-decimate", "No native dump supplied"
    if dump:
        sys.path.insert(0, str(args.lab))
        from image_to_3dlab import pixal3d_native
        try:
            assert dump.is_file(), f"Missing dump: {dump}"
            pixal3d_native.native_retopo(dump, source_path, native_path, BUDGETS[name][0], 2048, directory / "native.log")
            route, reason = "pixal3d-native-and-source-colour-transfer", None
        except (pixal3d_native.FrameMismatch, pixal3d_native.ReplayFailed, OSError) as error:
            reason = str(error)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = import_mesh(bpy, source_path)
    points = [source.matrix_world @ v.co for v in source.data.vertices]
    source_info = {"triangles": triangles(source), "bounds_blender_xyz":
                   [[min(point[i] for point in points) for i in range(3)],
                    [max(point[i] for point in points) for i in range(3)]]}
    del points
    for image in bpy.data.images:
        if image.type == "IMAGE" and max(image.size) > 2048:
            ratio = 2048 / max(image.size)
            image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
    if route.startswith("pixal3d"):
        base = import_mesh(bpy, native_path)
        reduce_mesh(bpy, base, BUDGETS[name][0])
        transfer_colour(bpy, source, base, directory)
    else:
        base = source.copy()
        base.data = source.data.copy()
        bpy.context.collection.objects.link(base)
        reduce_mesh(bpy, base, BUDGETS[name][0])
        for i, image in enumerate({n.image for m in base.data.materials if m and m.use_nodes
                                   for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image}):
            image.filepath_raw = str(directory / f"map-{i}.png")
            image.file_format = "PNG"
            image.save()
    smooth_uv_seams(bpy, source)
    smooth_uv_seams(bpy, base)
    normal_bake = bake_normals(bpy, source, base, directory)
    for material in base.data.materials:
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                node.inputs["Metallic"].default_value = 0.0
                node.inputs["Roughness"].default_value = 0.8 if name == "body" else 0.75
    bpy.data.objects.remove(source, do_unlink=True)
    base.name = name + "-lod0"
    baseline = summary(bpy, base)
    span = max(b - a for a, b in zip(*source_info["bounds_blender_xyz"]))
    assert max(abs(a - b) for old, new in zip(source_info["bounds_blender_xyz"], baseline["bounds_blender_xyz"])
               for a, b in zip(old, new)) <= span * 0.03, "LOD0 coordinate frame/bounds changed beyond 3%"
    records = []
    for level, target in enumerate(BUDGETS[name]):
        obj = base if level == 0 else base.copy()
        if level:
            obj.data = base.data.copy()
            bpy.context.collection.objects.link(obj)
            reduce_mesh(bpy, obj, target)
        obj.name = f"{name}-lod{level}"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        path = directory / f"lod{level}.glb"
        bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                                  export_animations=False, export_image_format="AUTO", export_tangents=True)
        info = summary(bpy, obj)
        imported = import_mesh(bpy, path)
        check = summary(bpy, imported)
        assert check["triangles"] == info["triangles"] and check["uv_layers"] > 0
        assert sorted(check["textures"]) == sorted(info["textures"]), "Reimport texture dimensions changed"
        assert has_normal_texture(imported), "Reimport lost the linked normal texture"
        assert all(abs(a - b) < 1e-5 for old, new in zip(info["bounds_blender_xyz"], check["bounds_blender_xyz"])
                   for a, b in zip(old, new)), "Reimport bounds changed"
        bpy.data.objects.remove(imported, do_unlink=True)
        records.append({"level": level, "target": target, "path": str(path), **info, "reimport_uv_check": "passed"})
        if level:
            bpy.data.objects.remove(obj, do_unlink=True)
    return {"source": str(source_path), "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
            "source_measurements": source_info, "route": route, "fallback_reason": reason,
            "lods": records, "normal_bake": normal_bake,
            "metallic_factor": 0, "roughness_factor": 0.8 if name == "body" else 0.75,
            "limits": "Unrigged; no roughness-map bake; normal rays sampled only; LOD1/2 reuse LOD0 normal atlas approximately; visual review required"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("body", type=Path)
    parser.add_argument("head", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--body-dump", type=Path)
    parser.add_argument("--head-dump", type=Path)
    parser.add_argument("--lab", type=Path, default=Path.home() / "image-to-3dlab")
    parser.add_argument("--blender", default=shutil.which("blender") or "/opt/homebrew/bin/blender")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    for name in ("body", "head", "out", "lab", "body_dump", "head_dump"):
        value = getattr(args, name)
        if value is not None:
            setattr(args, name, value.expanduser().resolve())
    assert args.body.is_file() and args.head.is_file(), "Missing source GLB"
    assert not args.body.is_relative_to(args.out) and not args.head.is_relative_to(args.out), "Keep source files outside the output directory"
    args.out.mkdir(parents=True, exist_ok=True)
    try:
        import bpy
    except ModuleNotFoundError:
        with (args.out / "blender.log").open("w") as log:
            subprocess.run([args.blender, "--background", "--python-exit-code", "1", "--python", str(Path(__file__).resolve()), "--", *argv],
                           stdout=log, stderr=subprocess.STDOUT, check=True)
        result = json.loads((args.out / "summary.json").read_text())
        for name, part in result.items():
            print(json.dumps({"part": name, "route": part["route"], "triangles": [lod["triangles"] for lod in part["lods"]]}))
        return
    result = {}
    for name in BUDGETS:
        print(f"REFERENCE_LODS {name}: starting", flush=True)
        result[name] = build_part(bpy, args, name)
        print(f"REFERENCE_LODS {name}: complete", flush=True)
    (args.out / "summary.json").write_text(json.dumps(result, indent=2))
    print(f"REFERENCE_LODS summary: {args.out / 'summary.json'}", flush=True)


if __name__ == "__main__":
    main()
