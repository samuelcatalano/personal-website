#!/usr/bin/env python3
"""Read-only Blender geometry/scale checks; no likeness or visual-quality claim."""
import argparse
import json
import math
import sys

import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("blend")
    parser.add_argument("--min-height", type=float, default=0.5)
    parser.add_argument("--max-height", type=float, default=2.5)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if not (math.isfinite(args.min_height) and math.isfinite(args.max_height) and 0 < args.min_height <= args.max_height):
        parser.error("Height bounds must be finite, positive and ordered")
    bpy.ops.wm.open_mainfile(filepath=bpy.path.abspath(args.blend))
    errors, bounds = [], []
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        errors.append("No mesh objects in the scene")
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "ARMATURE"}:
            continue
        if any(not math.isfinite(v) for row in obj.matrix_world for v in row):
            errors.append(f"{obj.name}: nonfinite world transform")
        if any(abs(v - 1) > 1e-4 for v in obj.scale):
            errors.append(f"{obj.name}: unapplied scale {tuple(obj.scale)}")
        if obj.matrix_basis.to_quaternion().angle > 1e-4:
            errors.append(f"{obj.name}: unapplied rotation")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices = 0
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            if not mesh.vertices:
                errors.append(f"{obj.name}: empty evaluated mesh")
                continue
            vertices += len(mesh.vertices)
            points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
            if any(not math.isfinite(n) for point in points for n in point):
                errors.append(f"{obj.name}: nonfinite evaluated vertices")
                continue
            bounds.extend((Vector(tuple(min(p[i] for p in points) for i in range(3))),
                           Vector(tuple(max(p[i] for p in points) for i in range(3)))))
        finally:
            evaluated.to_mesh_clear()
    size = None
    if bounds:
        low = [min(p[i] for p in bounds) for i in range(3)]
        high = [max(p[i] for p in bounds) for i in range(3)]
        unit = bpy.context.scene.unit_settings.scale_length
        size = [(b - a) * unit for a, b in zip(low, high)]
        if any(n <= 0 for n in size):
            errors.append("Degenerate scene bounds")
        if not args.min_height <= size[2] <= args.max_height:
            errors.append(f"Z height {size[2]:.4f} m outside requested range")
    print(json.dumps({"check": "geometry and scale only", "meshes": len(meshes),
                      "evaluated_vertices": vertices, "size_metres_xyz": size,
                      "errors": errors}, allow_nan=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
