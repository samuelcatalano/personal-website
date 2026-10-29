"""Build the original townhouse facade module library and export its raw GLB.

Run with: blender -b --factory-startup -P tools/buildings/townhouse-kit/build_townhouse_kit.py
"""
import json
import math
import os
import struct

import bpy
from mathutils import Matrix, Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUTPUT = os.path.join(ROOT, "assets/processed/buildings/townhouse-kit.glb")
ROLES = ("mass", "trim", "glass")
MATERIALS = {
    "mass": ((0.39, 0.20, 0.13, 1), 0.88),
    "trim": ((0.80, 0.72, 0.59, 1), 0.78),
    "glass": ((0.22, 0.43, 0.52, 1), 0.28),
}
EXPECTED = {
    "window": 7,
    "door": 6,
    "cornice": 5,
    "roof": 5,
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene_root = bpy.data.objects.new("TownhouseKit", None)
bpy.context.collection.objects.link(scene_root)
materials = {}
for role, (color, roughness) in MATERIALS.items():
    material = bpy.data.materials.new(f"Townhouse_{role.title()}")
    material.diffuse_color = color
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    materials[role] = material


class Module:
    def __init__(self, name, category, anchor):
        self.name = name
        self.category = category
        self.anchor = anchor
        self.root = bpy.data.objects.new(name, None)
        self.root.empty_display_type = "PLAIN_AXES"
        self.root.empty_display_size = 0.12
        self.root["category"] = category
        self.root["anchor"] = anchor
        bpy.context.collection.objects.link(self.root)
        self.root.parent = scene_root
        self.groups = {}
        for role in ROLES:
            group = bpy.data.objects.new(f"{name}__{role}", None)
            bpy.context.collection.objects.link(group)
            group.parent = self.root
            group["semantic_role"] = role
            self.groups[role] = group

    def box(self, role, name, loc, dims, bevel=0.018, segments=1):
        # Rollout budget: one bevel segment, and no bevel on slim parts (muntins, brackets) that read as plain boxes from street distance.
        if min(dims) < 0.1:
            bevel = 0
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        obj = bpy.context.object
        obj.name = f"{self.name}__{name}"
        obj.dimensions = dims
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            modifier = obj.modifiers.new("Soft masonry edges", "BEVEL")
            modifier.width = bevel
            modifier.segments = segments
            modifier.affect = "EDGES"
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        self._finish(obj, role)
        return obj

    def cylinder(self, role, name, loc, radius, depth, vertices=8, axis="Y"):
        rotation = (math.pi / 2, 0, 0) if axis == "Y" else (0, 0, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
        obj = bpy.context.object
        obj.name = f"{self.name}__{name}"
        self._finish(obj, role)
        return obj

    def _finish(self, obj, role):
        obj.data.materials.append(materials[role])
        obj["semantic_role"] = role
        obj.parent = self.groups[role]
        obj.matrix_parent_inverse = self.groups[role].matrix_world.inverted()


modules = []


def module(name, category, anchor):
    result = Module(name, category, anchor)
    modules.append(result)
    return result


def window_frame(m, width, height, muntins=1, panes=2, stone=False):
    # The opening plane is z=0; all depth projects toward the street (+Z).
    surround = "mass" if stone else "trim"
    m.box(surround, "reveal_head", (0, height - 0.045, -0.045), (width + 0.12, 0.11, 0.16))
    for side in (-1, 1):
        m.box(surround, "jamb", (side * (width / 2 + 0.025), height / 2, -0.035), (0.09, height, 0.14))
    m.box("glass", "glazing", (0, height / 2, -0.10), (width - 0.11, height - 0.18, 0.035), bevel=0.006, segments=1)
    m.box("trim", "sash_top", (0, height - 0.09, -0.025), (width - 0.06, 0.075, 0.09))
    m.box("trim", "sash_bottom", (0, 0.09, -0.025), (width - 0.06, 0.075, 0.09))
    for side in (-1, 1):
        m.box("trim", "sash_side", (side * (width / 2 - 0.07), height / 2, -0.025), (0.07, height - 0.16, 0.09))
    m.box("trim", "projecting_sill", (0, -0.07, 0.015), (width + 0.24, 0.12, 0.25), bevel=0.025)
    for i in range(1, muntins + 1):
        y = height * i / (muntins + 1)
        m.box("trim", "horizontal_muntin", (0, y, 0.006), (width - 0.12, 0.035, 0.06), bevel=0.008)
    for i in range(1, panes):
        x = -width / 2 + width * i / panes
        m.box("trim", "vertical_muntin", (x, height / 2, 0.006), (0.035, height - 0.18, 0.06), bevel=0.008)
    for side in (-1, 1):
        m.box("trim", "sill_bracket", (side * (width * 0.34), -0.17, -0.005), (0.09, 0.17, 0.11), bevel=0.018)


window_specs = [
    ("window_sash_6light_01", 0.92, 1.48, 2, 2, True),
    ("window_sash_4light_02", 1.05, 1.48, 1, 2, False),
    ("window_tall_8light_03", 0.88, 1.72, 3, 2, True),
    ("window_paired_sash_04", 1.34, 1.55, 2, 2, False),
    ("window_slim_sash_05", 0.76, 1.44, 1, 1, True),
    ("window_shop_upper_06", 1.28, 1.12, 1, 3, False),
    ("window_broad_sash_07", 1.48, 1.58, 2, 3, True),
]
for name, width, height, rows, columns, stone in window_specs:
    m = module(name, "window", "center of sill line on facade plane")
    window_frame(m, width, height, rows, columns, stone)


door_specs = [
    ("door_recessed_panel_01", 1.02, 2.24, "panel"),
    ("door_glazed_top_02", 1.02, 2.32, "glazed"),
    ("door_sidelight_03", 1.34, 2.35, "sidelight"),
    ("door_double_leaf_04", 1.48, 2.42, "double"),
    ("storefront_timber_05", 2.05, 2.62, "storefront"),
    ("storefront_pilaster_06", 2.32, 2.72, "shopfront"),
]
for name, width, height, style in door_specs:
    m = module(name, "door", "center of threshold on facade plane")
    leaf_width = width - (0.40 if style in ("sidelight", "storefront", "shopfront") else 0.12)
    if style == "double":
        leaf_width = (width - 0.12) / 2
    frame_role = "mass" if style in ("storefront", "shopfront") else "trim"
    for side in (-1, 1):
        m.box(frame_role, "jamb_or_pilaster", (side * (width / 2 - 0.06), height / 2, 0.005), (0.12, height, 0.22))
    m.box("trim", "head", (0, height - 0.06, 0.015), (width, 0.12, 0.24), bevel=0.025)
    m.box("mass", "threshold", (0, -0.04, 0.02), (width + 0.10, 0.10, 0.32), bevel=0.02)
    if style == "double":
        for side in (-1, 1):
            cx = side * (leaf_width / 2 + 0.02)
            m.box("mass", "door_leaf", (cx, height / 2, -0.075), (leaf_width, height - 0.16, 0.12))
            for y in (0.42, 0.90, 1.43):
                m.box("trim", "raised_panel_rail", (cx, y, 0.002), (leaf_width * 0.72, 0.045, 0.035))
            m.box("trim", "raised_panel_stile", (cx, 0.88, 0.002), (0.045, 0.94, 0.035))
            m.cylinder("trim", "brass_knob", (cx - side * (leaf_width * 0.36), 0.99, 0.075), 0.038, 0.045, axis="Z")
    else:
        door_x = -width * 0.10 if style in ("sidelight", "storefront", "shopfront") else 0
        m.box("mass", "door_leaf", (door_x, height / 2, -0.075), (leaf_width, height - 0.16, 0.12))
        for y in (0.40, 0.90, 1.42):
            m.box("trim", "raised_panel_rail", (door_x, y, 0.002), (leaf_width * 0.72, 0.045, 0.035))
        if style == "glazed":
            m.box("glass", "door_lite", (0, height * 0.72, 0.004), (leaf_width * 0.62, 0.67, 0.03), bevel=0.008)
            for side in (-1, 1):
                m.box("trim", "lite_stile", (side * leaf_width * 0.31, height * 0.72, 0.025), (0.045, 0.76, 0.045))
            m.box("trim", "lite_rail", (0, height * 0.72, 0.025), (leaf_width * 0.66, 0.045, 0.045))
        if style == "sidelight":
            for side in (-1, 1):
                if side == 1:
                    x = width * 0.31
                    m.box("glass", "sidelight_glazing", (x, height * 0.53, -0.07), (0.32, height * 0.72, 0.035), bevel=0.005)
                    m.box("trim", "sidelight_muntin", (x, height * 0.53, 0.01), (0.32, 0.035, 0.06))
        if style in ("storefront", "shopfront"):
            glass_width = (width - leaf_width) / 2
            for side in (-1, 1):
                x = side * (leaf_width / 2 + glass_width / 2)
                m.box("glass", "shopfront_glazing", (x, height * 0.56, -0.055), (glass_width - 0.08, height * 0.82, 0.035), bevel=0.005)
                m.box("trim", "shopfront_rail", (x, height * 0.18, 0.015), (glass_width, 0.075, 0.10))
            m.box("trim", "transom", (0, height * 0.88, 0.015), (width - 0.12, 0.06, 0.11))
        m.cylinder("trim", "brass_knob", (door_x + leaf_width * 0.37, 0.98, 0.075), 0.038, 0.045, axis="Z")
    for side in (-1, 1):
        m.box("trim", "entry_casing", (side * (width / 2 + 0.045), height / 2, 0.045), (0.07, height + 0.12, 0.12))


cornice_specs = [
    ("cornice_classical_01", 4.9, 0.28, 0.34),
    ("cornice_bracketed_02", 4.9, 0.34, 0.38),
    ("string_course_03", 4.9, 0.16, 0.24),
    ("cornice_stepped_04", 4.9, 0.31, 0.34),
    ("cornice_terrace_05", 4.9, 0.24, 0.30),
]
for name, span, height, depth in cornice_specs:
    m = module(name, "cornice", "center of wall run at underside datum")
    m.box("mass", "backing", (0, height * 0.52, -depth * 0.36), (span, height * 0.70, depth * 0.52), bevel=0.025)
    if "bracketed" in name:
        for x in (-2.12, -1.28, -0.43, 0.43, 1.28, 2.12):
            m.box("trim", "dentil_bracket", (x, height * 0.12, depth * 0.10), (0.20, height * 0.42, depth * 0.32), bevel=0.025)
        for y, w, d in ((height * 0.74, span, depth * 0.72), (height * 0.92, span + 0.10, depth)):
            m.box("trim", "moulding", (0, y, 0), (w, height * 0.16, d), bevel=0.035)
    elif "stepped" in name:
        for y, w, d in ((height * 0.38, span, depth * 0.65), (height * 0.65, span + 0.08, depth * 0.82), (height * 0.90, span + 0.16, depth)):
            m.box("trim", "step", (0, y, 0), (w, height * 0.20, d), bevel=0.025)
    elif "string" in name:
        m.box("trim", "fascia", (0, height * 0.62, 0), (span + 0.10, height * 0.22, depth * 0.80), bevel=0.04)
        m.box("trim", "lower_bead", (0, height * 0.22, depth * 0.08), (span + 0.04, height * 0.12, depth * 0.52), bevel=0.04)
    else:
        m.box("trim", "lower_ovolo", (0, height * 0.35, 0), (span + 0.06, height * 0.25, depth * 0.82), bevel=0.07)
        m.box("trim", "upper_coping", (0, height * 0.82, 0), (span + 0.18, height * 0.20, depth), bevel=0.045)
        if "terrace" in name:
            m.box("trim", "brick_course", (0, height * 0.10, -depth * 0.15), (span, height * 0.16, depth * 0.55), bevel=0.025)


roof_specs = [
    "roof_chimney_brick_01",
    "roof_chimney_stone_02",
    "roof_dormer_sash_03",
    "roof_ridge_vent_04",
    "roof_ridge_finial_05",
]
for name in roof_specs:
    m = module(name, "roof", "center of roof contact footprint")
    if "chimney" in name:
        size = 0.56 if "brick" in name else 0.48
        m.box("mass", "stack", (0, 0.62, 0), (size, 1.24, size), bevel=0.045)
        for y in (0.30, 0.54, 0.78):
            m.box("trim", "mortar_band", (0, y, size / 2 + 0.008), (size + 0.01, 0.025, 0.02), bevel=0.004, segments=1)
        m.box("trim", "cap_slab", (0, 1.28, 0), (size + 0.20, 0.15, size + 0.20), bevel=0.04)
        for side in (-1, 1):
            m.box("trim", "flue_rim_long", (0, 1.39, side * size * 0.26), (size * 0.58, 0.055, 0.07), bevel=0.012)
            m.box("trim", "flue_rim_short", (side * size * 0.26, 1.39, 0), (0.07, 0.055, size * 0.58), bevel=0.012)
    elif "dormer" in name:
        m.box("mass", "dormer_cheeks", (0, 0.43, -0.03), (0.94, 0.86, 0.48), bevel=0.04)
        m.box("glass", "dormer_glazing", (0, 0.44, 0.24), (0.64, 0.57, 0.045), bevel=0.012)
        for x in (-0.35, 0.35):
            m.box("trim", "dormer_jamb", (x, 0.44, 0.275), (0.055, 0.62, 0.06))
        m.box("trim", "dormer_sill", (0, 0.11, 0.29), (0.86, 0.09, 0.18), bevel=0.02)
        m.box("trim", "dormer_roof", (0, 0.91, 0), (1.16, 0.11, 0.86), bevel=0.035)
    elif "vent" in name:
        m.box("mass", "vent_body", (0, 0.23, 0), (1.12, 0.46, 0.42), bevel=0.07)
        for y in (0.08, 0.19, 0.30, 0.41):
            m.box("trim", "louvre", (0, y, 0.225), (0.94, 0.035, 0.07), bevel=0.012)
        m.box("trim", "vent_cap", (0, 0.51, 0), (1.24, 0.09, 0.52), bevel=0.035)
    else:
        m.box("mass", "ridge_base", (0, 0.08, 0), (0.70, 0.16, 0.70), bevel=0.05)
        m.cylinder("trim", "finial_stem", (0, 0.48, 0), 0.075, 0.64, vertices=12, axis="Y")
        m.cylinder("trim", "finial_orb", (0, 0.88, 0), 0.16, 0.28, vertices=16, axis="Y")
        m.cylinder("trim", "finial_tip", (0, 1.10, 0), 0.07, 0.20, vertices=10, axis="Y")


def validate_modules():
    names = {m.name for m in modules}
    assert len(names) == len(modules), "Module names must be unique"
    assert len(modules) == sum(EXPECTED.values()), f"Expected 23 modules, got {len(modules)}"
    for category, count in EXPECTED.items():
        assert sum(m.category == category for m in modules) == count, f"Wrong {category} module count"
    assert all(all(role in m.groups for role in ROLES) for m in modules), "Missing semantic role group"
    for m in modules:
        assert tuple(m.root.location) == (0.0, 0.0, 0.0) and tuple(m.root.rotation_euler) == (0.0, 0.0, 0.0), f"Module origin is not its anchor: {m.name}"
        meshes = [o for o in m.root.children if o.type == "EMPTY" for o in o.children if o.type == "MESH"]
        assert meshes, f"Module has no mesh geometry: {m.name}"
        for obj in meshes:
            assert obj.get("semantic_role") in ROLES, f"Mesh lacks semantic role: {obj.name}"
            assert len(obj.data.vertices) > 0 and len(obj.data.polygons) > 0, f"Empty mesh: {obj.name}"
            bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
            assert all(math.isfinite(v) for point in bounds for v in point), f"Invalid bounds: {obj.name}"
            assert all(max(p[i] for p in bounds) > min(p[i] for p in bounds) for i in range(3)), f"Degenerate bounds: {obj.name}"
        for group in list(m.root.children):
            if not group.children:
                bpy.data.objects.remove(group, do_unlink=True)


def inspect_glb(path):
    with open(path, "rb") as file:
        magic, version, length = struct.unpack("<4sII", file.read(12))
        assert magic == b"glTF" and version == 2 and length == os.path.getsize(path), "Invalid GLB header"
        chunk_length, chunk_type = struct.unpack("<I4s", file.read(8))
        assert chunk_type == b"JSON", "GLB must begin with a JSON chunk"
        document = json.loads(file.read(chunk_length).decode("utf-8").rstrip(" \t\r\n\0"))
    nodes = document.get("nodes", [])
    node_names = {node.get("name") for node in nodes}
    mesh_nodes = [node for node in nodes if "mesh" in node]
    assert {m.name for m in modules} <= node_names, "Export lost one or more named modules"
    assert len(mesh_nodes) >= len(modules), "Export lost module geometry"
    parent = {}
    for parent_index, node in enumerate(nodes):
        for child_index in node.get("children", []):
            parent[child_index] = parent_index
    for item in modules:
        index = next(i for i, node in enumerate(nodes) if node.get("name") == item.name)
        children = nodes[index].get("children", [])
        assert children, f"Export lost module role groups: {item.name}"
        for child in children:
            role = nodes[child].get("extras", {}).get("semantic_role")
            assert role in ROLES and nodes[child].get("name") == f"{item.name}__{role}", f"Bad role group for {item.name}"
            assert any(parent.get(mesh_index) == child for mesh_index, node in enumerate(nodes) if "mesh" in node), f"Empty exported role: {item.name}/{nodes[child].get('name')}"
        assert all(not any(key in nodes[mesh_index] for key in ("translation", "rotation", "scale")) for mesh_index, node in enumerate(nodes) if "mesh" in node and parent.get(mesh_index) in children), f"Mesh transform must be baked: {item.name}"
    mesh_count = len(mesh_nodes)
    return len(nodes), mesh_count, document


validate_modules()
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
# Bake the axis correction into vertices so every module and mesh node remains untransformed.
axis_fix = Matrix.Rotation(math.pi / 2, 4, "X")
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.data.transform(axis_fix @ obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = scene_root
bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format="GLB", use_selection=True, export_extras=True, export_apply=True)
node_count, mesh_count, _ = inspect_glb(OUTPUT)
print(f"Townhouse kit assertions passed: {len(modules)} modules, {mesh_count} mesh nodes, {node_count} GLB nodes, {os.path.getsize(OUTPUT)} bytes")
