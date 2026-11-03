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
CHILD = os.environ.get("NPC_RIG", "adult") == "child"  # child rig: kid macros, clips suffixed _C, npc_child_walk.blend
SUF = "_C" if CHILD else ""
IK = os.environ.get("NPC_IK", "1") == "1"  # 0: retarget without the ground IK pass (pre-IK comparison)
UAL = os.environ["NPC_UAL"]  # UAL1_Standard.glb, Quaternius, CC0 1.0
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from npc_retarget import retarget_walk  # noqa: E402

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402


def macro_dict(height):
    d = TargetService.get_default_macro_info_dict()
    vals = {"gender": 1.0, "age": 0.50, "weight": 0.40, "muscle": 0.55, "height": height, "proportions": 0.85,  # slim, idealised proportions (longer legs)
            "african": 0.1, "asian": 0.1, "caucasian": 0.8}
    if CHILD:  # age 0.1875 = 11 years in MPFB; 0.16 ~ 9; proportions default (a child's own)
        vals.update(gender=0.5, age=float(os.environ.get("NPC_CHILD_AGE", 0.16)), weight=0.45, muscle=0.4, proportions=0.5)

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
HumanService.create_human(macro_detail_dict=macro_dict(0.5 if CHILD else 0.56))
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
# clip name -> (UAL action, retarget parameters); NPC_Walk is the original, the others are variations
CLIPS = {"NPC_Walk": ("Walk_Loop", {}), "NPC_Walk2": ("Walk_Formal_Loop", dict(swing_k=1.8, elbow_base=8.0)),
         "NPC_Walk3": ("Walk_Loop", dict(swing_k=1.4, elbow_base=6.0, hip_f=0.8, hip_b=0.55))}
CLIPS = {k + SUF: v for k, v in CLIPS.items()}
if not CHILD:  # the adult's formal forward swing read as marching; preserve the shorter child's stride
    CLIPS["NPC_Walk3"] = ("Walk_Loop", dict(swing_k=1.4, elbow_base=6.0, hip_f=0.68, hip_b=0.65))
CLIP_NAMES = list(CLIPS)
src.animation_data_create()
FR = range(0, 32)
def knee_report(dst, frames, tag="KNEE"):
    gt = tag.replace("KNEE", "GAIT")
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
        r = {"f": f, "root": P("Root" if "Root" in dst.pose.bones else "root")}
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
            sh, el, wr = P("upperarm_" + s), P("lowerarm_" + s), P("hand_" + s)
            th = knee - hip
            r["hip" + s] = math.degrees(math.atan2(th.y * fwd, -th.z))  # + = thigh swung forward
            r["hipab" + s] = math.degrees(math.atan2((th.x if s == "l" else -th.x), -th.z))  # + = knee out from the hip (bow)
            r["elb" + s] = 180 - math.degrees((sh - el).normalized().angle((wr - el).normalized()))
            ua = el - sh
            r["abd" + s] = math.degrees(math.atan2((ua.x if s == "l" else -ua.x), -ua.z))  # + = elbow out from the shoulder
            r["asw" + s] = math.degrees(math.atan2(ua.y * fwd, -ua.z))  # + = upper arm swung forward
        for b in ("upperarm", "lowerarm", "thigh", "calf"):  # roll of the bone about its own axis, relative to its parent (swing-twist)
            for s in "lr":
                q = dst.pose.bones[f"{b}_{s}"].rotation_quaternion
                r[f"tw_{b}{s}"] = math.degrees(2 * math.atan2(q.y, q.w))
        r["gerr"] = abs(min(P("ball_l").z, P("ball_r").z) - floor) * 1000
        rows.append(r)
    print(f"{tag} f   devL   devR  hingeL hingeR flexL flexR  yawL  yawR  gerr", flush=True)
    for r in rows:
        print(f"{tag} {r['f']:2d} {r['devl']:+6.1f} {r['devr']:+6.1f} {r['hingel']:6.1f} {r['hinger']:6.1f}"
              f" {r['flexl']:5.1f} {r['flexr']:5.1f} {r['yawl']:5.1f} {r['yawr']:5.1f} {r['gerr']:5.2f}", flush=True)
    for s in "lr":
        devs = [r["dev" + s] for r in rows]
        bent = [r["hinge" + s] for r in rows if r["flex" + s] > 5.0]
        yaws = [abs(r["yaw" + s]) for r in rows if not math.isnan(r["yaw" + s])]
        print(f"{tag} SUM {s}: max|dev| {max(abs(d) for d in devs):.1f} mm, mean dev {sum(devs) / len(devs):+.1f} mm,"
              f" hinge max {max(bent):.1f} deg (flex>5, n={len(bent)}), yaw max {max(yaws):.1f} deg (n={len(yaws)})",
              flush=True)
    print(f"{gt} f  kneeL kneeR  hipL  hipR hipabL hipabR elbL elbR abdL abdR aswL aswR", flush=True)
    for r in rows:
        print(f"{gt} {r['f']:2d} {r['flexl']:5.1f} {r['flexr']:5.1f} {r['hipl']:5.1f} {r['hipr']:5.1f} {r['hipabl']:6.1f} {r['hipabr']:6.1f}"
              f" {r['elbl']:4.0f} {r['elbr']:4.0f} {r['abdl']:4.1f} {r['abdr']:4.1f} {r['aswl']:5.1f} {r['aswr']:5.1f}", flush=True)
    def rng(k):
        v = [r[k + s] for r in rows for s in "lr"]
        return f"{min(v):.1f}..{max(v):.1f}"
    print(f"{gt} SUM knee {rng('flex')} (nat 0..65) hip {rng('hip')} (nat -10..+30) hipab {rng('hipab')} (nat ~0..4)"
          f" elbow {rng('elb')} (nat 10..30) arm abd {rng('abd')} (nat <10) arm swing {rng('asw')}", flush=True)
    def twr(b):
        v = [r[f"tw_{b}{s}"] for r in rows for s in "lr"]
        v = [((x + 180) % 360) - 180 for x in v]
        return f"{min(v):.0f}..{max(v):.0f}"
    print(f"{gt} SUM bone roll vs parent (deg): upperarm {twr('upperarm')} lowerarm {twr('lowerarm')} thigh {twr('thigh')} calf {twr('calf')}", flush=True)
    g = [r["gerr"] for r in rows]
    print(f"{tag} SUM ground: max {max(g):.2f} mm, mean {sum(g) / len(g):.2f} mm", flush=True)
    print(f"{tag} SUM root f0 {tuple(round(c, 4) for c in rows[0]['root'])} f{rows[-1]['f']} "
          f"{tuple(round(c, 4) for c in rows[-1]['root'])}", flush=True)


def stance_speed(dst, frames, fps):
    # CLIP stance-foot speed (m/s): how fast the planted feet slide backward under the root; the runtime moves the NPC at this speed
    dw = dst.matrix_world.copy()
    fwd = 1.0 if (dw @ dst.data.bones["ball_l"].head_local).y > (dw @ dst.data.bones["foot_l"].head_local).y else -1.0
    floor = min((dw @ dst.data.bones[b].head_local).z for b in ("ball_l", "ball_r"))
    ys = {s: [] for s in "lr"}
    for f in frames:
        scene.frame_set(f)
        layer.update()
        for s in "lr":
            m = (dw @ dst.pose.bones["ball_" + s].matrix).to_translation()
            ys[s].append((m.y * fwd, m.z - floor))
    v, n = [], len(ys["l"])
    for s in "lr":
        for i in range(n):
            (y0, z0), (y1, z1) = ys[s][i], ys[s][(i + 1) % n]
            if max(z0, z1) < 0.012:
                v.append(-(y1 - y0) * fps)
    return sum(v) / len(v), len(v)


for clip_name, (ual, prm) in CLIPS.items():
    walk = bpy.data.actions[ual]
    src.animation_data.action = walk
    src.animation_data.action_slot = walk.slots[0]
    scene.frame_set(0)
    print("CHECK clip", clip_name, "from", ual, "src frames", tuple(walk.frame_range), "fps", scene.render.fps, flush=True)
    knee_report(src, FR, "SRC-" + clip_name + "-KNEE")
    if dst.animation_data:
        dst.animation_data.action = None
    act = retarget_walk(src, dst, FR, clip_name, ground_ik=IK, **prm)
    print("CHECK action", act.name, "frames", act.frame_range[0], act.frame_range[1], "ik", IK, flush=True)
    knee_report(dst, FR, "KNEE" if clip_name == "NPC_Walk" + SUF else clip_name + "-KNEE")
    sp, nn = stance_speed(dst, FR, scene.render.fps)
    print(f"CLIP {clip_name} stance-foot speed {sp:.3f} m/s (n={nn}) duration {len(FR) / scene.render.fps:.3f} s", flush=True)

for o in new:
    bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a.name not in CLIP_NAMES:
        bpy.data.actions.remove(a)
dst.animation_data.action = bpy.data.actions["NPC_Walk" + SUF]
dst.animation_data.action_slot = dst.animation_data.action.slots[0]
for nm in CLIP_NAMES:  # every clip also sits on its own NLA track: the glTF exporter writes each track as an animation
    tr = dst.animation_data.nla_tracks.new()
    tr.name = nm
    st = tr.strips.new(nm, 0, bpy.data.actions[nm])
    st.action_slot = bpy.data.actions[nm].slots[0]

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
    scene.render.filepath = f"{OUT}/walk_check{SUF.lower()}_f{f:02d}.png"
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", f, flush=True)

bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/" + ("npc_child_walk.blend" if CHILD else "npc_a_walk.blend"))
print("CHECK saved", flush=True)
