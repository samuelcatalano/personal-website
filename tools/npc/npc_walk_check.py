# NPC_A walk check: MPFB body (height macro 0.56) on the game_engine rig, with the UAL Walk_Loop retargeted onto it.
# Bakes the macro shape into the mesh, prints root-motion and ground numbers, renders two side views, saves a .blend.
# Run: /opt/homebrew/bin/blender -b --factory-startup --python npc_walk_check.py
import os
import math
import sys

import addon_utils
import bpy

OUT = os.environ["NPC_OUT"]  # .blend, PNG and GLB outputs
UAL = os.environ["NPC_UAL"]  # UAL1_Standard.glb, Quaternius, CC0 1.0
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from npc_retarget import retarget_walk  # noqa: E402

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402


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


scene = bpy.context.scene
layer = bpy.context.view_layer

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
HumanService.create_human(macro_detail_dict=macro_dict(0.56))
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
HumanService.add_builtin_rig(body, "game_engine")
dst = next(o for o in bpy.data.objects if o.type == "ARMATURE")

layer.objects.active = body
body.select_set(True)
bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
body.select_set(False)
print("CHECK body verts", len(body.data.vertices), "shape keys", body.data.shape_keys is not None,
      "groups", len(body.vertex_groups), flush=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=UAL)
new = [o for o in bpy.data.objects if o not in before]
src = next(o for o in new if o.type == "ARMATURE")
walk = bpy.data.actions["Walk_Loop"]
src.animation_data_create()
src.animation_data.action = walk
src.animation_data.action_slot = walk.slots[0]

for f in range(0, 33, 8):
    scene.frame_set(f)
    layer.update()
    r = src.pose.bones["root"].matrix.to_translation()
    p = src.pose.bones["pelvis"].matrix.to_translation()
    print("CHECK src f", f, "root", tuple(round(c, 3) for c in r), "pelvis", tuple(round(c, 3) for c in p), flush=True)

act = retarget_walk(src, dst, range(0, 32), "NPC_Walk")
print("CHECK action", act.name, "frames", act.frame_range[0], act.frame_range[1], flush=True)

for o in new:
    bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a.name != "NPC_Walk":
        bpy.data.actions.remove(a)

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
cam.location = (4.6, 0.0, 0.95)
cam.rotation_euler = (math.radians(90), 0, math.radians(90))
cam_d.lens = 85
scene.camera = cam
sun_d = bpy.data.lights.new("sun", "SUN")
sun_d.energy = 3.0
sun = bpy.data.objects.new("sun", sun_d)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(55), 0, math.radians(35))
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.render.resolution_x = 384
scene.render.resolution_y = 576
for f in (0, 16):
    scene.frame_set(f)
    scene.render.filepath = f"{OUT}/walk_check_f{f:02d}.png"
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", f, flush=True)

bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/npc_a_walk.blend")
print("CHECK saved", flush=True)
