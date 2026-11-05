"""Build the original low-poly London Eye asset and validate its exported GLBs.

Run from any directory with:
    blender -b --python tools/landmarks/london-eye/build_london_eye.py

Geometry is authored in the game's Y-up frame, mapped into Blender's Z-up frame,
then exported back to glTF Y-up. One Blender file contains both authored LODs.
"""
import bmesh
import bpy
import json
import math
import os
import struct
from pathlib import Path
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "assets" / "processed" / "landmarks"
RADIUS = 16.0
CAPSULES = 32
TAU = math.tau


def game_to_blender(p):
    """Three.js (x,y,z) -> Blender (x,-z,y); glTF export reverses this map."""
    return (p[0], -p[2], p[1])


def srgb(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


def material(name, color, roughness, metallic):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = srgb(color)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = srgb(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


class Mesh:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.smooth = []

    def vertex(self, p):
        self.vertices.append(tuple(float(x) for x in p))
        return len(self.vertices) - 1

    def face(self, ids, smooth=False):
        self.faces.append(tuple(ids))
        self.smooth.append(smooth)

    def tube(self, a, b, radius, sides, caps=True):
        a, b = Vector(a), Vector(b)
        axis = b - a
        if axis.length < 1e-8:
            raise ValueError("Tube endpoints must differ")
        axis.normalize()
        seed = Vector((0, 0, 1)) if abs(axis.z) < .9 else Vector((0, 1, 0))
        u = axis.cross(seed).normalized()
        v = axis.cross(u).normalized()
        rings = []
        for center in (a, b):
            ring = []
            for i in range(sides):
                angle = TAU * i / sides
                ring.append(self.vertex(center + radius * (u * math.cos(angle) + v * math.sin(angle))))
            rings.append(ring)
        for i in range(sides):
            j = (i + 1) % sides
            self.face((rings[0][i], rings[0][j], rings[1][j], rings[1][i]), True)
        if caps:
            self.face(tuple(reversed(rings[0])))
            self.face(tuple(rings[1]))

    def box(self, center, width, height, depth):
        x, y, z = center
        hx, hy, hz = width / 2, height / 2, depth / 2
        p = [(x + sx * hx, y + sy * hy, z + sz * hz)
             for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        ids = [self.vertex(v) for v in p]
        # Four corners per side; face normals are recalculated in Blender.
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                  (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.face(tuple(ids[i] for i in f))

    def torus_xy(self, center, radius, tube, major, minor):
        cx, cy, cz = center
        rings = []
        for i in range(major):
            phi = TAU * i / major
            ring = []
            for j in range(minor):
                theta = TAU * j / minor
                r = radius + tube * math.cos(theta)
                ring.append(self.vertex((cx + r * math.cos(phi), cy + r * math.sin(phi), cz + tube * math.sin(theta))))
            rings.append(ring)
        for i in range(major):
            ni = (i + 1) % major
            for j in range(minor):
                nj = (j + 1) % minor
                self.face((rings[i][j], rings[ni][j], rings[ni][nj], rings[i][nj]), True)

    def capsule(self, center, angle, sides, depth_ratio):
        # Tangential spherocapsule matching the existing single-pivot wheel motion.
        cx, cy, cz = center
        tangent = Vector((-math.sin(angle), math.cos(angle), 0))
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        depth = Vector((0, 0, 1))
        stations = ((-.76, 0), (-.5, .35), (0, .48), (.5, .35), (.76, 0))
        rings = []
        for along, width in stations[1:-1]:
            ring = []
            for i in range(sides):
                theta = TAU * i / sides
                p = Vector((cx, cy, cz)) + tangent * along + radial * (width * math.cos(theta)) + depth * (width * depth_ratio * math.sin(theta))
                ring.append(self.vertex(p))
            rings.append(ring)
        first = self.vertex(Vector((cx, cy, cz)) + tangent * stations[0][0])
        last = self.vertex(Vector((cx, cy, cz)) + tangent * stations[-1][0])
        for i in range(sides):
            j = (i + 1) % sides
            self.face((first, rings[0][i], rings[0][j]), True)
            self.face((rings[-1][i], last, rings[-1][j]), True)
        for lo, hi in zip(rings, rings[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                self.face((lo[i], hi[i], hi[j], lo[j]), True)

    def object(self, name, collection, parent, mat):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([game_to_blender(v) for v in self.vertices], [], self.faces)
        mesh.update()
        if len(mesh.polygons) != len(self.smooth):
            raise RuntimeError(f"{name}: source face count changed unexpectedly")
        if mesh.validate(verbose=True, clean_customdata=False):
            raise RuntimeError(f"{name}: Blender rejected invalid source geometry")
        for poly, smooth in zip(mesh.polygons, self.smooth):
            poly.use_smooth = smooth
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(mat)
        return obj


def empty(name, collection):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    collection.objects.link(obj)
    return obj


def make_lod(lod, mats):
    low = lod == 1
    collection = bpy.data.collections.new(f"LOD{lod}")
    bpy.context.scene.collection.children.link(collection)
    wheel = empty("eye-wheel", collection)
    frame = empty("eye-frame", collection)

    rim = Mesh()
    major, minor = (48, 3) if low else (64, 4)
    for side in (-1, 1):
        rim.torus_xy((0, 0, side * .72), RADIUS, .18, major, minor)
    for i in range(CAPSULES if not low else CAPSULES // 2):
        angle = TAU * i / (CAPSULES if not low else CAPSULES // 2)
        x, y = RADIUS * math.cos(angle), RADIUS * math.sin(angle)
        rim.tube((x, y, -.72), (x, y, .72), .06, 4, caps=False)
    rim_obj = rim.object("eye-rim", collection, wheel, mats["Trim"])

    spokes = Mesh()
    count = 8 if low else 16
    sides = 4
    for side in (-1, 1):
        z = side * .72
        for i in range(count):
            angle = TAU * i / count + (side > 0) * math.pi / count
            spokes.tube((1.05 * math.cos(angle), 1.05 * math.sin(angle), z),
                        ((RADIUS + .05) * math.cos(angle), (RADIUS + .05) * math.sin(angle), z),
                        .045 if not low else .055, sides, caps=False)
    spokes.tube((0, 0, -.9), (0, 0, .9), 1.18, 12 if not low else 10)
    for side in (-1, 1):
        spokes.tube((0, 0, side * .82), (0, 0, side * 1.12), .72, 12 if not low else 10)
    spokes.tube((0, 0, -1.4), (0, 0, 3.2), .4, 8 if not low else 6)
    for side in (-1, 1):
        spokes.tube((0, 0, side * 1.08), (0, 0, side * 1.25), .55, 8 if not low else 6)
    spokes_obj = spokes.object("eye-spokes", collection, wheel, mats["Mass"])

    pods = Mesh()
    for i in range(CAPSULES):
        angle = TAU * i / CAPSULES
        pods.capsule(((RADIUS + .55) * math.cos(angle), (RADIUS + .55) * math.sin(angle), 0),
                     angle, 6 if low else 8, .86)
    pods_obj = pods.object("eye-pods", collection, wheel, mats["Glass"])

    structure = Mesh()
    n = 6 if low else 8
    for side in (-1, 1):
        structure.tube((side * .62, 17.55, 3.1), (side * 3.6, .6, 7.4), .45, n)
    structure.tube((-2.1, 9.6, 5.2), (2.1, 9.6, 5.2), .22, 6 if low else 8)
    structure_obj = structure.object("eye-frame-struts", collection, frame, mats["Mass"])

    footing = Mesh()
    footing.box((0, .4, 7.4), 10.4, .8, 3.0)
    footing_obj = footing.object("eye-frame-footing", collection, frame, mats["Mass"])

    bearing = Mesh()
    bearing.torus_xy((0, 18, 3.1), .72, .10, 14 if low else 24, 3 if low else 4)
    bearing_obj = bearing.object("eye-frame-bearing", collection, frame, mats["Trim"])

    objects = [wheel, rim_obj, spokes_obj, pods_obj, frame, structure_obj, footing_obj, bearing_obj]
    return collection, wheel, frame, objects


def export_glb(path, objects, active):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_cameras=False,
                              export_lights=False, export_materials="EXPORT")


def read_glb_json(path):
    with open(path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF" or version != 2 or length != path.stat().st_size:
            raise AssertionError(f"Invalid GLB header: {path.name}")
        chunk_length, chunk_type = struct.unpack("<II", f.read(8))
        if chunk_type != 0x4E4F534A:
            raise AssertionError(f"GLB JSON chunk missing: {path.name}")
        data = json.loads(f.read(chunk_length))
    return data


def to_game(p):
    return Vector((p.x, p.z, -p.y))


def mesh_points(obj):
    return [to_game(obj.matrix_world @ v.co) for v in obj.data.vertices]


def bounds(points):
    if not points:
        raise AssertionError("Empty geometry bounds")
    return [tuple(min(p[i] for p in points) for i in range(3)),
            tuple(max(p[i] for p in points) for i in range(3))]


def connected_components(mesh):
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    unseen = set(range(len(adjacency)))
    count = 0
    while unseen:
        count += 1
        stack = [unseen.pop()]
        while stack:
            for other in adjacency[stack.pop()]:
                if other in unseen:
                    unseen.remove(other)
                    stack.append(other)
    return count


def validate_glb(path, lod):
    data = read_glb_json(path)
    if data.get("images") or data.get("animations"):
        raise AssertionError(f"Unexpected textures or animation: {path.name}")
    if {m["name"] for m in data.get("materials", [])} != {"Mass", "Trim", "Glass"}:
        raise AssertionError(f"Unexpected material names: {path.name}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = {obj.name: obj for obj in bpy.data.objects}
    wheel, frame = objects.get("eye-wheel"), objects.get("eye-frame")
    if not wheel or not frame or wheel.type != "EMPTY" or frame.type != "EMPTY":
        raise AssertionError(f"Missing exported roots: {path.name}")
    wheel_children = {obj.name: obj for obj in wheel.children}
    frame_children = {obj.name: obj for obj in frame.children}
    if set(wheel_children) != {"eye-rim", "eye-spokes", "eye-pods"}:
        raise AssertionError(f"Unexpected eye-wheel children: {sorted(wheel_children)}")
    if set(frame_children) != {"eye-frame-struts", "eye-frame-footing", "eye-frame-bearing"}:
        raise AssertionError(f"Unexpected eye-frame children: {sorted(frame_children)}")
    if any(obj.type != "MESH" for obj in (*wheel_children.values(), *frame_children.values())):
        raise AssertionError(f"Expected mesh nodes under both roots: {path.name}")

    wheel_origin = to_game(wheel.matrix_world.translation)
    frame_origin = to_game(frame.matrix_world.translation)
    if max(abs(v) for v in wheel_origin) > 1e-5 or max(abs(v) for v in frame_origin) > 1e-5:
        raise AssertionError(f"Unexpected root translation: {path.name}")
    rim_points = mesh_points(wheel_children["eye-rim"])
    rim_bounds = bounds(rim_points)
    if any(abs((rim_bounds[0][i] + rim_bounds[1][i]) / 2) > .02 for i in range(3)):
        raise AssertionError(f"Rim is not centered at the wheel pivot: {path.name}")
    if not (15.9 <= rim_bounds[1][0] <= 16.3 and 15.9 <= rim_bounds[1][1] <= 16.3):
        raise AssertionError(f"Wheel radius or XY orientation changed: {path.name} {rim_bounds}")
    if rim_bounds[1][2] - rim_bounds[0][2] > 1.9:
        raise AssertionError(f"Wheel plane is not XY with a +Z axle: {path.name}")
    frame_points = [p for obj in frame_children.values() for p in mesh_points(obj)]
    frame_bounds = bounds(frame_points)
    if abs(frame_bounds[0][1]) > .001 or not (18.5 <= frame_bounds[1][1] <= 19.0):
        raise AssertionError(f"Support is not ground-anchored at game scale: {path.name} {frame_bounds}")
    axle_points = mesh_points(wheel_children["eye-spokes"])
    if (not any(p.z > 3.0 and abs(p.x) < .5 and abs(p.y) < .5 for p in axle_points)
            or not any(p.z < -1.0 and abs(p.x) < .5 and abs(p.y) < .5 for p in axle_points)):
        raise AssertionError(f"Axle must extend along +Z through the wheel: {path.name}")
    if connected_components(wheel_children["eye-pods"].data) != CAPSULES:
        raise AssertionError(f"Expected {CAPSULES} separate capsule meshes: {path.name}")

    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    triangles = 0
    triangle_keys = set()
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        if any(not math.isfinite(v) for poly in mesh.polygons for v in poly.normal) or any(poly.normal.length < .99 for poly in mesh.polygons):
            raise AssertionError(f"Invalid normals in {obj.name}: {path.name}")
        points = mesh_points(obj)
        for tri in mesh.loop_triangles:
            tri_points = [points[i] for i in tri.vertices]
            area = (tri_points[1] - tri_points[0]).cross(tri_points[2] - tri_points[0]).length * .5
            if area < 1e-9 or not math.isfinite(area):
                raise AssertionError(f"Degenerate triangle in {obj.name}: {path.name}")
            key = tuple(sorted(tuple(round(v, 6) for v in p) for p in tri_points))
            if key in triangle_keys:
                raise AssertionError(f"Duplicate face in {obj.name}: {path.name}")
            triangle_keys.add(key)
        if any(not math.isfinite(v) for p in points for v in p):
            raise AssertionError(f"Non-finite vertices in {obj.name}: {path.name}")
    limit = 4000 if lod == 0 else 2500
    if triangles > limit or not 3 <= len(meshes) <= 8:
        raise AssertionError(f"Budget exceeded: {path.name} tris={triangles}, meshes={len(meshes)}")
    if len({slot.material.name for obj in meshes for slot in obj.material_slots}) > 3:
        raise AssertionError(f"More than three materials: {path.name}")

    all_points = [p for obj in meshes for p in mesh_points(obj)]
    asset_bounds = bounds(all_points)
    return {
        "lod": lod,
        "triangles": triangles,
        "draw_calls": len(meshes),
        "materials": sorted({slot.material.name for obj in meshes for slot in obj.material_slots}),
        "capsules": connected_components(wheel_children["eye-pods"].data),
        "wheel_rim_bounds": [[round(v, 3) for v in row] for row in rim_bounds],
        "frame_bounds": [[round(v, 3) for v in row] for row in frame_bounds],
        "asset_bounds": [[round(v, 3) for v in row] for row in asset_bounds],
        "duplicate_faces": 0,
        "bytes": path.stat().st_size,
        "textures": len(data.get("images", [])),
        "animations": len(data.get("animations", [])),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    mats = {
        "Mass": material("Mass", "#D2D4D3", .62, .12),
        "Trim": material("Trim", "#AEBBC3", .36, .58),
        "Glass": material("Glass", "#24343C", .28, .18),
    }
    built = []
    for lod in (0, 1):
        collection, wheel, frame, objects = make_lod(lod, mats)
        path = OUT / f"london-eye.lod{lod}.glb"
        export_glb(path, objects, wheel)
        built.append((lod, path))
        for obj in objects:
            obj.name = f"{obj.name}-lod{lod}"
            if obj.data:
                obj.data.name = f"{obj.data.name}-lod{lod}"
    blend_path = HERE / "london-eye.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    metrics = [validate_glb(path, lod) for lod, path in built]
    print("LONDON_EYE_VALIDATION " + json.dumps({
        "results": metrics,
        "blend_bytes": blend_path.stat().st_size,
        "blend": str(blend_path),
    }, indent=2))


if __name__ == "__main__":
    main()
