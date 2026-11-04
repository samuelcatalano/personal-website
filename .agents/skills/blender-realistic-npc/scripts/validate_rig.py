#!/usr/bin/env python3
"""Read-only Blender deform skeleton and weight checks; does not validate motion."""
import argparse
import json
import math
import sys

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("blend")
    parser.add_argument("--max-influences", type=int, default=4)
    parser.add_argument("--weight-tolerance", type=float, default=0.03)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.max_influences < 1 or not 0 <= args.weight_tolerance < 1:
        parser.error("Influences must be positive; tolerance must be in [0, 1)")
    bpy.ops.wm.open_mainfile(filepath=bpy.path.abspath(args.blend))
    errors, stats = [], []
    rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if not rigs:
        errors.append("No armature in scene")
    for rig in rigs:
        deform = [b for b in rig.data.bones if b.use_deform]
        if not deform:
            errors.append(f"{rig.name}: no deform bones")
        for bone in deform:
            if not math.isfinite(bone.length) or bone.length <= 1e-6 or any(not math.isfinite(v) for row in bone.matrix_local for v in row):
                errors.append(f"{rig.name}/{bone.name}: invalid rest bone")
    bound = 0
    for obj in (o for o in bpy.context.scene.objects if o.type == "MESH"):
        modifiers = [m for m in obj.modifiers if m.type == "ARMATURE"]
        if not modifiers:
            # Rigid bone-parented eyes, teeth and accessories are valid; other meshes need explicit review.
            if obj.parent_type == "BONE" and obj.parent in rigs and obj.parent_bone in obj.parent.data.bones:
                stats.append({"mesh": obj.name, "binding": "rigid bone parent"})
                continue
            errors.append(f"{obj.name}: no armature modifier or valid bone parent")
            continue
        if len(modifiers) != 1 or modifiers[0].object not in rigs:
            errors.append(f"{obj.name}: expected one valid armature modifier")
            continue
        modifier = modifiers[0]
        if not modifier.use_vertex_groups or not modifier.show_viewport or not modifier.show_render:
            errors.append(f"{obj.name}: disabled vertex-group deformation")
        bone_names = {b.name for b in modifier.object.data.bones if b.use_deform}
        deform_groups = {g.index for g in obj.vertex_groups if g.name in bone_names}
        failures = {"unweighted": 0, "nonfinite_or_negative": 0, "unnormalized": 0, "too_many_influences": 0}
        for vertex in obj.data.vertices:
            weights = [g.weight for g in vertex.groups if g.group in deform_groups]
            if any(not math.isfinite(w) or w < 0 for w in weights):
                failures["nonfinite_or_negative"] += 1
                continue
            active = [w for w in weights if w > 1e-6]
            if not active:
                failures["unweighted"] += 1
            elif abs(sum(active) - 1) > args.weight_tolerance:
                failures["unnormalized"] += 1
            if len(active) > args.max_influences:
                failures["too_many_influences"] += 1
        if any(failures.values()):
            errors.append(f"{obj.name}: {failures}")
        bound += 1
        stats.append({"mesh": obj.name, "vertices": len(obj.data.vertices), "deform_groups": len(deform_groups), "failures": failures})
    if not bound:
        errors.append("No skinned meshes checked")
    print(json.dumps({"check": "deform bones and weights only", "armatures": len(rigs),
                      "deform_bones": sum(sum(b.use_deform for b in r.data.bones) for r in rigs),
                      "meshes": stats, "errors": errors}, allow_nan=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
