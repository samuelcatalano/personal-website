# NPC_A walk check: MPFB body (height macro 0.56) on the game_engine rig, with the UAL Walk_Loop retargeted onto it.
# Bakes the macro shape into the mesh, prints root-motion and ground numbers, renders two side views, saves a .blend.
# Run: /opt/homebrew/bin/blender -b --factory-startup --python npc_walk_check.py
import os
import math
import sys

import addon_utils
import bpy
from mathutils import Vector

OUT = os.environ["NPC_OUT"]  # .blend, PNG and GLB outputs
IK = os.environ.get("NPC_IK", "1") == "1"  # 0: retarget without the ground IK pass (pre-IK comparison)
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
from ual_names import to_unreal_names  # noqa: E402
print("CHECK renamed UAL bones", to_unreal_names(src), flush=True)
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

act = retarget_walk(src, dst, range(0, 32), "NPC_Walk", ground_ik=IK)
print("CHECK action", act.name, "frames", act.frame_range[0], act.frame_range[1], "ik", IK, flush=True)


def knee_report(dst, frames):
    # Evaluated pose, world space, per frame: knee offset in x from the hip-ankle line (mm, signed; + = +x),
    # knee hinge (bend plane normal) vs the pelvis lateral axis (deg), flexion (deg), toe-out (deg, + = outward),
    # lowest ball joint above the rest floor (mm), root position.
    dw = dst.matrix_world.copy()
    bn = dst.data.bones
    fwd = 1.0 if (dw @ bn["ball_l"].head_local).y > (dw @ bn["foot_l"].head_local).y else -1.0
    floor = min((dw @ bn[b].head_local).z for b in ("ball_l", "ball_r"))
    rows = []
    for f in frames:
        scene.frame_set(f)
        layer.update()

        def P(name):
            return (dw @ dst.pose.bones[name].matrix).to_translation()

        px = ((dw @ dst.pose.bones["pelvis"].matrix).to_3x3() @ Vector((1, 0, 0))).normalized()
        r = {"f": f, "root": P("Root")}
        for s in "lr":
            hip, knee, ank, ball = P("thigh_" + s), P("calf_" + s), P("foot_" + s), P("ball_" + s)
            kz = (knee.z - hip.z) / (ank.z - hip.z)
            r["dev" + s] = (knee.x - (hip.x + (ank.x - hip.x) * kz)) * 1000
            r["flex" + s] = 180 - math.degrees((hip - knee).normalized().angle((ank - knee).normalized()))
            n = (knee - hip).cross(ank - knee).normalized()
            r["hinge" + s] = math.degrees(math.acos(min(1.0, abs(n.dot(px)))))
            fy = (dw @ dst.pose.bones["foot_" + s].matrix).to_3x3() @ Vector((0, 1, 0))  # foot bone axis (toe direction)
            yaw = math.degrees(math.atan2(fy.x, fy.y * fwd)) if abs(fy.z) < 0.6 else float("nan")  # pitched foot: no yaw
            r["yaw" + s] = yaw if s == "l" else -yaw
        r["gerr"] = abs(min(P("ball_l").z, P("ball_r").z) - floor) * 1000
        rows.append(r)
    print("KNEE f   devL   devR  hingeL hingeR flexL flexR  yawL  yawR  gerr", flush=True)
    for r in rows:
        print(f"KNEE {r['f']:2d} {r['devl']:+6.1f} {r['devr']:+6.1f} {r['hingel']:6.1f} {r['hinger']:6.1f}"
              f" {r['flexl']:5.1f} {r['flexr']:5.1f} {r['yawl']:5.1f} {r['yawr']:5.1f} {r['gerr']:5.2f}", flush=True)
    for s in "lr":
        devs = [r["dev" + s] for r in rows]
        bent = [r["hinge" + s] for r in rows if r["flex" + s] > 5.0]
        yaws = [abs(r["yaw" + s]) for r in rows if not math.isnan(r["yaw" + s])]
        print(f"KNEE SUM {s}: max|dev| {max(abs(d) for d in devs):.1f} mm, mean dev {sum(devs) / len(devs):+.1f} mm,"
              f" hinge max {max(bent):.1f} deg (flex>5, n={len(bent)}), yaw max {max(yaws):.1f} deg (n={len(yaws)})",
              flush=True)
    g = [r["gerr"] for r in rows]
    print(f"KNEE SUM ground: max {max(g):.2f} mm, mean {sum(g) / len(g):.2f} mm", flush=True)
    print(f"KNEE SUM root f0 {tuple(round(c, 4) for c in rows[0]['root'])} f{rows[-1]['f']} "
          f"{tuple(round(c, 4) for c in rows[-1]['root'])}", flush=True)


knee_report(dst, range(0, 32))

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
