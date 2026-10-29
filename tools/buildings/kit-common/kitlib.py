"""Shared Blender helpers for the project-authored, texture-free facade kits (shop, midrise).

Same contract as tools/buildings/townhouse-kit: GLB root -> module node (extras: category, anchor) ->
`<module>__<role>` nodes (extras: semantic_role mass|trim|glass) -> meshes. Authored directly in the
final glTF frame (+Y up, +Z outward from the facade, X left to right); the Z-up export conversion is
baked into the vertices so every node keeps an identity transform.
"""
import json, math, os, struct

import bpy
from mathutils import Matrix, Vector

ROLES = ("mass", "trim", "glass")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))


class Kit:
    def __init__(self, root_name, prefix, colors, output, expected):
        self.output, self.expected, self.modules = output, expected, []
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.root = bpy.data.objects.new(root_name, None)
        bpy.context.collection.objects.link(self.root)
        self.materials = {}
        for role, (color, roughness) in colors.items():
            mat = bpy.data.materials.new(f"{prefix}_{role.title()}")
            mat.diffuse_color = color
            shader = mat.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = color
            shader.inputs["Roughness"].default_value = roughness
            self.materials[role] = mat

    def module(self, name, category, anchor):
        m = Module(self, name, category, anchor)
        self.modules.append(m)
        return m

    def validate(self):
        names = {m.name for m in self.modules}
        assert len(names) == len(self.modules), "Module names must be unique"
        for category, count in self.expected.items():
            assert sum(m.category == category for m in self.modules) == count, f"Wrong {category} module count"
        assert len(self.modules) == sum(self.expected.values()), "Unexpected module total"
        for m in self.modules:
            meshes = [o for g in m.root.children if g.type == "EMPTY" for o in g.children if o.type == "MESH"]
            assert meshes, f"Module has no mesh geometry: {m.name}"
            for obj in meshes:
                assert obj.get("semantic_role") in ROLES and len(obj.data.polygons) > 0, f"Bad mesh: {obj.name}"
                pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
                assert all(math.isfinite(v) for p in pts for v in p), f"Invalid bounds: {obj.name}"
                assert all(max(p[i] for p in pts) > min(p[i] for p in pts) for i in range(3)), f"Degenerate bounds: {obj.name}"
            for g in list(m.root.children):
                if not g.children:
                    bpy.data.objects.remove(g, do_unlink=True)

    def export(self):
        self.validate()
        os.makedirs(os.path.dirname(self.output), exist_ok=True)
        fix = Matrix.Rotation(math.pi / 2, 4, "X")
        for obj in bpy.context.scene.objects:
            if obj.type == "MESH":
                obj.data.transform(fix @ obj.matrix_world)
                obj.matrix_world = Matrix.Identity(4)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in bpy.context.scene.objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = self.root
        bpy.ops.export_scene.gltf(filepath=self.output, export_format="GLB", use_selection=True, export_extras=True, export_apply=True)
        self.inspect()

    def inspect(self):
        with open(self.output, "rb") as f:
            magic, version, length = struct.unpack("<4sII", f.read(12))
            assert magic == b"glTF" and version == 2 and length == os.path.getsize(self.output)
            n, t = struct.unpack("<I4s", f.read(8))
            doc = json.loads(f.read(n).decode().rstrip(" \t\r\n\0"))
        nodes = doc["nodes"]
        by_name = {n.get("name"): i for i, n in enumerate(nodes)}
        meshes = [i for i, n in enumerate(nodes) if "mesh" in n]
        parent = {c: p for p, n in enumerate(nodes) for c in n.get("children", [])}
        for m in self.modules:
            node = nodes[by_name[m.name]]
            assert node.get("extras", {}).get("category") == m.category, f"Lost category: {m.name}"
            for c in node["children"]:
                role = nodes[c].get("extras", {}).get("semantic_role")
                assert role in ROLES and nodes[c]["name"] == f"{m.name}__{role}", f"Bad role node: {m.name}"
                assert any(parent.get(i) == c for i in meshes), f"Empty role node: {m.name}/{role}"
        assert all(not any(k in nodes[i] for k in ("translation", "rotation", "scale")) for i in meshes), "Mesh transforms must be baked"
        print(f"{self.root.name} assertions passed: {len(self.modules)} modules, {len(meshes)} mesh nodes, {os.path.getsize(self.output)} bytes")


class Module:
    def __init__(self, kit, name, category, anchor):
        self.kit, self.name, self.category, self.anchor = kit, name, category, anchor
        self.root = bpy.data.objects.new(name, None)
        self.root["category"], self.root["anchor"] = category, anchor
        bpy.context.collection.objects.link(self.root)
        self.root.parent = kit.root
        self.groups = {}
        for role in ROLES:
            g = bpy.data.objects.new(f"{name}__{role}", None)
            bpy.context.collection.objects.link(g)
            g.parent, g["semantic_role"] = self.root, role
            self.groups[role] = g

    def box(self, role, name, loc, dims, rot=None):
        """Axis-aligned box centred at loc; rot = (rx, ry, rz) radians applied about its centre."""
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        obj = bpy.context.object
        obj.name = f"{self.name}__{name}"
        obj.dimensions = dims
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if rot:
            obj.rotation_euler = rot
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        return self._finish(obj, role)

    def cyl(self, role, name, loc, radius, depth, vertices=12, axis="Y"):
        rot = {"Y": (math.pi / 2, 0, 0), "X": (0, math.pi / 2, 0), "Z": (0, 0, 0)}[axis]
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
        obj = bpy.context.object
        obj.name = f"{self.name}__{name}"
        return self._finish(obj, role)

    def _finish(self, obj, role):
        obj.data.materials.append(self.kit.materials[role])
        obj["semantic_role"] = role
        obj.parent = self.groups[role]
        obj.matrix_parent_inverse = self.groups[role].matrix_world.inverted()
        return obj
