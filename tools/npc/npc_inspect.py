# Inspect NPC_A: MPFB body (height macro 0.56) on the game_engine rig, against the UAL1 armature.
# Prints bone-name overlap, rest-orientation differences per shared bone, and the Walk_Loop frame range.
# Run: /opt/homebrew/bin/blender -b --python npc_inspect.py
import os
import math
import addon_utils
import bpy

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

UAL = os.environ["NPC_UAL"]  # UAL1_Standard.glb, Quaternius, CC0 1.0


def macro_dict(height):
    d = TargetService.get_default_macro_info_dict()
    vals = {"gender": 1.0, "age": 0.54, "weight": 0.45, "muscle": 0.5, "height": height,
            "african": 0.1, "asian": 0.1, "caucasian": 0.8}

    def walk(dct):
        for k in list(dct.keys()):
            if isinstance(dct[k], dict):
                walk(dct[k])
            else:
                for name, val in vals.items():
                    if name in str(k).lower():
                        dct[k] = val

    walk(d)
    return d


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
HumanService.create_human(macro_detail_dict=macro_dict(0.56))
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
HumanService.add_builtin_rig(body, "game_engine")
mpfb_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("INSP body dims", [round(c, 3) for c in body.dimensions], "verts", len(body.data.vertices), flush=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=UAL)
ual_arm = next(o for o in bpy.data.objects if o not in before and o.type == "ARMATURE")
walk = bpy.data.actions["Walk_Loop"]
print("INSP walk frames", walk.frame_range[0], walk.frame_range[1], flush=True)

mb = {b.name for b in mpfb_arm.data.bones}
ub = {b.name for b in ual_arm.data.bones}
print("INSP bones mpfb", len(mb), "ual", len(ub), flush=True)
print("INSP ual_only", sorted(ub - mb), flush=True)
print("INSP mpfb_only", sorted(mb - ub), flush=True)


def world_rot(arm, bone):
    return (arm.matrix_world.to_3x3() @ bone.matrix_local.to_3x3()).to_quaternion()


diffs = []
for name in sorted(ub & mb):
    qa = world_rot(ual_arm, ual_arm.data.bones[name])
    qb = world_rot(mpfb_arm, mpfb_arm.data.bones[name])
    diffs.append((math.degrees(qa.rotation_difference(qb).angle), name))
vals = sorted(d for d, _ in diffs)
print("INSP rest diff deg min", round(vals[0], 1), "median", round(vals[len(vals) // 2], 1),
      "max", round(vals[-1], 1), flush=True)
for d, name in sorted(diffs, reverse=True)[:12]:
    print("INSP rest", name, round(d, 1), flush=True)
for name in ("pelvis", "spine_01", "upperarm_l", "lowerarm_l", "thigh_l", "calf_l", "head"):
    if name in ub and name in mb:
        d = dict((n, v) for v, n in diffs)[name]
        print("INSP key", name, round(d, 1), flush=True)
