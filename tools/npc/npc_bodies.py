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

BASE = {"gender": 1.0, "age": 0.54, "weight": 0.45, "muscle": 0.5, "height": 0.56,
        "african": 0.1, "asian": 0.1, "caucasian": 0.8}
VARIANTS = {
    "NPC_F": {"gender": 0.0, "age": 0.50, "weight": 0.40, "muscle": 0.35, "height": 0.50},
    "NPC_G": {"gender": 0.0, "age": 0.55, "weight": 0.55, "muscle": 0.30, "height": 0.56},
    "NPC_H": {"gender": 0.05, "age": 0.48, "weight": 0.30, "muscle": 0.40, "height": 0.62},
}


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
