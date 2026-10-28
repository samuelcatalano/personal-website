#!/usr/bin/env python3
"""Prepare the supplied Caio Millennium II GLB for the São Paulo bus scene.

Run with:
  blender -b --factory-startup -P tools/vehicles/caio-millennium-volvo-b10m/build_sao_paulo_bus.py -- --source /path/to/caio_millennium_volvo_b10m.glb
"""

import argparse
import bmesh
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DEFAULT = ROOT / "assets/vehicles/sao-paulo-bus.glb"
BODY_OBJECT = "Object_15"
FRONT_DETAIL = "Object_6"
PLANE_OBJECT = "Object_12"
TRIANGLE_BUDGET = 12_000
SOURCE_SCALE = 2.0

PALETTE = {
    "BusBody": (0.125, 0.638, 0.026, 1),
    "BusAccent": (0.075, 0.32, 0.012, 1),
    "BusStripe": (0.15, 0.70, 0.035, 1),
    "BusSweep": (0.005, 0.25, 0.82, 1),
    "BusSkirtF": (0.11, 0.57, 0.02, 1),
    "BusTrim": (0.018, 0.024, 0.031, 1),
    "BusGlass": (0.003, 0.008, 0.012, 1),
    "BusRubber": (0.025, 0.028, 0.031, 1),
    "BusMetal": (0.34, 0.38, 0.40, 1),
    "BusHeadlight": (0.95, 0.89, 0.63, 1),
    "BusTaillight": (0.72, 0.025, 0.018, 1),
    "BusDisplay": (0.012, 0.018, 0.022, 1),
    "BusInterior": (0.045, 0.052, 0.055, 1),
}

SOURCE_ROLE = {
    "Material.004": "BusBody",
    "Material.020": "BusBody",
    "Material.006": "BusGlass",
    "Material.008": "BusGlass",
    "Material.010": "BusTrim",
    "Material.002": "BusTrim",
    "Materiais": "BusTrim",
    "Materiais.002": "BusTrim",
    "Material.001": "BusTrim",
    "Material.005": "BusRubber",
    "Material.019": "BusRubber",
    "Material.007": "BusMetal",
    "Material.009": "BusMetal",
    "Material.012": "BusMetal",
    "Material.016": "BusMetal",
    "Material.003": "BusAccent",
    "Material.011": "BusTaillight",
    "Material.017": "BusTaillight",
    "Material.018": "BusTaillight",
    "Material": "BusMetal",
}


def triangles(objects):
    return sum(sum(max(0, p.loop_total - 2) for p in o.data.polygons) for o in objects)


def remove_dense_small_islands(obj):
    """Discard two extreme tessellated wheel-face islands while retaining the window/frame components."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    unseen = set(bm.faces)
    remove = []
    while unseen:
        start = unseen.pop()
        component, stack = {start}, [start]
        while stack:
            face = stack.pop()
            for vert in face.verts:
                for linked in vert.link_faces:
                    if linked in unseen:
                        unseen.remove(linked)
                        component.add(linked)
                        stack.append(linked)
        verts = {vert for face in component for vert in face.verts}
        spans = [max(v.co[i] for v in verts) - min(v.co[i] for v in verts) for i in range(3)]
        if len(component) > 2_000 and max(spans) < 0.75:
            remove.extend(component)
    if remove:
        bmesh.ops.delete(bm, geom=remove, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(obj.data)
    removed = len(remove)
    bm.free()
    return removed


def material(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = PALETTE[name]
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = PALETTE[name]
    shader.inputs["Roughness"].default_value = 0.42 if name in {"BusBody", "BusAccent", "BusStripe", "BusSweep", "BusSkirtF"} else 0.72
    return mat


def smooth_points(points, steps=5):
    """Catmull-Rom interpolation for the small livery ribbon only."""
    result = []
    ext = [points[0], *points, points[-1]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for j in range(steps):
            t = j / steps
            t2, t3 = t * t, t * t * t
            result.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k]) * t2 + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k]) * t3) for k in range(3)))
    result.append(points[-1])
    return result


def add_sweep(side_y, sign):
    # A short, texture-free ribbon follows the supplied SP electric-bus sweep reference.
    path = smooth_points([
        (-2.4, 2.50, 0.10),
        (-3.2, 2.42, 0.18),
        (-3.9, 1.95, 0.32),
        (-3.5, 1.35, 0.38),
        (-4.25, 0.82, 0.25),
        (-5.25, 0.80, 0.075),
    ])
    verts, faces = [], []
    for x, z, half_width in path:
        y = (side_y - max(0, z - 2.0) * 1.0) * sign
        # The sweep lies on the flat outer bus side; mirrored to both sides.
        verts.extend(((x, y, z - half_width), (x, y, z + half_width)))
    for i in range(len(path) - 1):
        a = 2 * i
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new("SaoPauloBlueSweep")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material("BusSweep"))
    mesh.update()
    obj = bpy.data.objects.new("BusSweep_L" if sign > 0 else "BusSweep_R", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_wheel_pivots():
    # The source keeps wheel pieces embedded in larger meshes; these named axle markers let runtime split them later.
    for axle, x in (("F", 5.8), ("M", 0.75), ("R", -5.3)):
        for side, y in (("L", 0.98), ("R", -0.98)):
            pivot = bpy.data.objects.new(axle + side, None)
            pivot.empty_display_type = "SPHERE"
            pivot.empty_display_size = 0.08
            pivot.location = (x, y, 0.55)
            pivot["wheel_radius"] = 0.52
            pivot["wheel_pivot"] = True
            bpy.context.scene.collection.objects.link(pivot)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path, help="Supplied Caio Millennium II Volvo B10M GLB")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source, output = args.source.expanduser().resolve(), args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    output.parent.mkdir(parents=True, exist_ok=True)

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj.name in {"Cube", PLANE_OBJECT, "Object_5"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    by_name = {o.name: o for o in meshes}
    if BODY_OBJECT not in by_name or FRONT_DETAIL not in by_name:
        raise RuntimeError("Supplied source no longer has the expected body/front reference meshes")

    # The imported GLB has Z-up world transforms and the bus points diagonally in XY.
    body, front = by_name[BODY_OBJECT], by_name[FRONT_DETAIL]
    body_center = body.matrix_world @ sum((Vector(c) for c in body.bound_box), Vector()) / 8
    front_center = front.matrix_world @ sum((Vector(c) for c in front.bound_box), Vector()) / 8
    # The selected marker is at the rear end; the windshield/front is at the opposite end in the supplied GLB.
    forward = body_center - front_center
    forward.z = 0
    if forward.length < 1e-6:
        raise RuntimeError("Could not infer the source bus forward direction")
    angle = -math.atan2(forward.y, forward.x)
    rotate = Matrix.Rotation(angle, 4, "Z")

    transformed = {o: [rotate @ (o.matrix_world @ Vector(c)) for c in o.bound_box] for o in meshes}
    all_points = [p for ps in transformed.values() for p in ps]
    min_z = min(p.z for p in all_points)
    max_x = max(p.x for p in all_points)
    min_x = min(p.x for p in all_points)
    max_y = max(p.y for p in all_points)
    min_y = min(p.y for p in all_points)
    center_x, center_y = (max_x + min_x) / 2, (max_y + min_y) / 2
    normalize = Matrix.Diagonal((SOURCE_SCALE, SOURCE_SCALE, SOURCE_SCALE, 1)) @ Matrix.Translation(Vector((-center_x, -center_y, -min_z))) @ rotate

    for obj in meshes:
        obj.data = obj.data.copy()
        baked = normalize @ obj.matrix_world
        for vertex in obj.data.vertices:
            vertex.co = baked @ vertex.co
        obj.parent = None
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        obj.data.validate(clean_customdata=True)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()

    dense_removed = remove_dense_small_islands(by_name["Object_18"])

    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    # Replace the source paint with the established runtime semantic roles.
    for obj in meshes:
        if not obj.data.materials:
            continue
        source_name = obj.data.materials[0].name
        role = SOURCE_ROLE.get(source_name)
        if role is None:
            raise RuntimeError(f"No runtime material-role mapping for source material {source_name!r}")
        obj.data.materials.clear()
        obj.data.materials.append(material(role))

    body.data.update()
    body_points = [Vector(c) for c in body.bound_box]
    half_width = max(abs(p.y) for p in body_points) - 0.09
    add_sweep(half_width, 1)
    add_sweep(half_width, -1)
    add_wheel_pivots()

    # Uniform collapse keeps the supplied meshes and their silhouette while fitting the hero budget.
    ratio = 0.12
    for obj in meshes:
        if len(obj.data.polygons) <= 3:
            continue
        modifier = obj.modifiers.new("12k triangle budget", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    bpy.context.view_layer.update()

    result_meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    count = triangles(result_meshes)
    # A few disconnected source meshes resist one collapse pass; trim only the largest until in budget.
    while count > TRIANGLE_BUDGET:
        obj = max(result_meshes, key=lambda o: triangles([o]))
        before = triangles([obj])
        modifier = obj.modifiers.new("budget cleanup", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = 0.48
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        count = triangles(result_meshes)
        if triangles([obj]) >= before:
            print(f"DECIMATION_FLOOR={obj.name}:{before}")
            break
    for obj in result_meshes:
        if obj.data.validate(verbose=True, clean_customdata=True):
            print(f"MESH_REPAIRED={obj.name}")
        obj.data.update()
    count = triangles(result_meshes)
    if count > TRIANGLE_BUDGET:
        raise RuntimeError(f"Decimation yielded {count} triangles (budget {TRIANGLE_BUDGET})")
    if any(o.name == PLANE_OBJECT for o in result_meshes):
        raise RuntimeError("Stray source plane survived cleanup")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_yup=True,
        export_apply=True, export_cameras=False, export_lights=False,
        export_animations=False, export_skins=False, export_extras=True,
    )
    print(f"SAO_PAULO_BUS_EXPORT={output}")
    print(f"SAO_PAULO_BUS_TRIANGLES={count}")
    print(f"SAO_PAULO_BUS_DENSE_WHEEL_FACES_REMOVED={dense_removed}")
    print(f"SAO_PAULO_BUS_BOUNDS={tuple(round(v * SOURCE_SCALE, 3) for v in (max_x-min_x, max_y-min_y, max((p.z for p in all_points))-min_z))}")
    print(f"SAO_PAULO_BUS_MATERIALS={sorted({m.name for o in result_meshes for m in o.data.materials})}")
    print("SAO_PAULO_BUS_WHEEL_PIVOTS=FL/FR@+5.8,ML/MR@+0.75,RL/RR@-5.3; y=+/-0.98,z=0.55,r=0.52")


if __name__ == "__main__":
    main()
