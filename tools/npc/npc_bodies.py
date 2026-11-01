# Body shapes for NPC_B..E: MPFB macros on the same base mesh as NPC_A (19158 vertices, same topology), baked to
# vertex coordinates. Every variant keeps NPC_A's height macro, so one shared game_engine rig fits all five bodies;
# the height differences come from the instance scale in the page.
# Run: /opt/homebrew/bin/blender -b --factory-startup --python npc_bodies.py
import os
import json

import addon_utils
import bpy

OUT = os.environ["NPC_OUT"]  # .blend, PNG and GLB outputs

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402

BASE = {"gender": 1.0, "age": 0.50, "weight": 0.40, "muscle": 0.55, "height": 0.56, "proportions": 0.85,  # same as npc_walk_check (the rig)
        "african": 0.1, "asian": 0.1, "caucasian": 0.8}
VARIANTS = {  # street crowd: mostly slim young adults, varied ancestry (the face shape follows it); the rig is NPC_A's
    "NPC_B": {"age": 0.45, "weight": 0.35, "muscle": 0.55, "african": 0.85, "asian": 0.05, "caucasian": 0.10},
    "NPC_C": {"age": 0.55, "weight": 0.48, "muscle": 0.45, "african": 0.05, "asian": 0.15, "caucasian": 0.80},
    "NPC_D": {"age": 0.62, "weight": 0.50, "muscle": 0.55, "african": 0.60, "asian": 0.10, "caucasian": 0.30},
    "NPC_E": {"age": 0.45, "weight": 0.32, "muscle": 0.50, "african": 0.05, "asian": 0.05, "caucasian": 0.90},
    "NPC_F": {"gender": 0.0, "age": 0.45, "weight": 0.36, "muscle": 0.40, "height": 0.50, "african": 0.05, "asian": 0.10, "caucasian": 0.85},
    "NPC_G": {"gender": 0.0, "age": 0.50, "weight": 0.42, "muscle": 0.38, "height": 0.56, "african": 0.10, "asian": 0.60, "caucasian": 0.30},
    "NPC_H": {"gender": 0.05, "age": 0.45, "weight": 0.30, "muscle": 0.42, "height": 0.62, "african": 0.85, "asian": 0.05, "caucasian": 0.10},
    "NPC_I": {"age": 0.42, "weight": 0.36, "muscle": 0.50, "african": 0.05, "asian": 0.85, "caucasian": 0.10},
    "NPC_J": {"age": 0.58, "weight": 0.44, "muscle": 0.50, "african": 0.02, "asian": 0.03, "caucasian": 0.95},
    "NPC_K": {"gender": 0.0, "age": 0.42, "weight": 0.38, "muscle": 0.42, "height": 0.58, "african": 0.85, "asian": 0.05, "caucasian": 0.10},
    "NPC_L": {"gender": 0.0, "age": 0.40, "weight": 0.33, "muscle": 0.40, "height": 0.52, "african": 0.05, "asian": 0.20, "caucasian": 0.75},
}

# NPC_RIG=child: the three children (7-10 years, age macro 0.1875 = 11 y), fitted to the child rig of npc_walk_check.py (NPC_RIG=child)
CHILD_BASE = {"gender": 0.5, "age": 0.16, "weight": 0.45, "muscle": 0.4, "height": 0.5, "proportions": 0.5,
              "african": 0.1, "asian": 0.1, "caucasian": 0.8}
KIDS = {
    "NPC_KA": {"gender": 0.0, "age": 0.17, "weight": 0.45, "african": 0.05, "asian": 0.10, "caucasian": 0.85},
    "NPC_KB": {"gender": 1.0, "age": 0.15, "weight": 0.42, "african": 0.85, "asian": 0.05, "caucasian": 0.10},
    "NPC_KC": {"gender": 0.0, "age": 0.14, "weight": 0.40, "african": 0.05, "asian": 0.70, "caucasian": 0.25},
}
if os.environ.get("NPC_RIG") == "child":
    BASE, VARIANTS = CHILD_BASE, KIDS


def macro_dict(vals):
    d = TargetService.get_default_macro_info_dict()

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


layer = bpy.context.view_layer
for name, override in VARIANTS.items():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    HumanService.create_human(macro_detail_dict=macro_dict({**BASE, **override}))
    body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    layer.objects.active = body
    body.select_set(True)
    if body.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    body.select_set(False)
    coords = [[round(c, 5) for c in v.co] for v in body.data.vertices]
    with open(f"{OUT}/body_{name}.json", "w") as f:
        json.dump(coords, f)
    print("BODY", name, "zrange", round(min(v.co.z for v in body.data.vertices),3), round(max(v.co.z for v in body.data.vertices),3), "verts", len(coords), "dims", [round(c, 3) for c in body.dimensions], flush=True)
