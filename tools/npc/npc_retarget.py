# Retarget a UAL clip onto the MPFB game_engine rig, by world-space rotation deltas.
# The two rigs disagree on bone roll (median 83 deg, see npc_inspect.py), so copying local rotations would
# twist the limbs. Each bone's world rotation change is measured against its own source rest and applied to
# the target's rest. The pelvis follows the source pelvis, scaled by leg length. Every frame the lowest ball
# joint is held at its rest height, so the feet neither sink nor float.
# Posture: the spine keeps a quarter of the source chest pitch and is set upright (TILT); the clavicles yaw back 4 deg;
# a planted knee under the hip stays near straight (KNEE_STAND) and keeps the source bend when reaching or lifted.
# Knee targets are smoothed around the loop. The pelvis follows the per-frame ground lock with a 3-tap smooth, and each planted
# foot (source foot height under 1 cm, weight CW) is then put exactly on the floor by a 2-bone leg solve (ik_override, pass 2).
# Legs: the MPFB A-pose splay is removed (SPLAY: thigh and calf start vertical), and the knee bends about the pelvis lateral axis.
import bpy
import math
from mathutils import Euler, Matrix, Quaternion, Vector

SRC_OF = {"Root": "root", "head": "Head"}  # rig name -> UAL name; the rest only differ in case
PELVIS = "pelvis"
ROOT = "Root"
BALLS = ("ball_l", "ball_r")


# Gait shaping (deg). The UAL walks march: thigh +47/-24, knee 87 in swing, elbows 32-41 (+14 added here), arms 8-23 out. Natural gait:
# hip +30/-10, swing knee ~62, elbow 10-30, upper arm under 10 from the body. Per-clip overrides go through `params`.
GAIT = dict(hip_f=0.75, hip_b=0.50,  # thigh swing scale, forward / backward of vertical
            knee_k=0.74,  # scale of the source knee bend in swing and at heel strike
            elbow_base=4.0, elbow_k=0.45, elbow_fw=6.0,  # elbow flexion = base + k * source bend + fw * hand-forward weight
            abd_k=0.30, abd_min=3.0,  # upper arm abduction = max(min, k * source abduction)
            swing_k=1.0, swing_c=-8.0,  # arm swing amplitude scale about the centre angle (deg, + forward)
            ank_air=8.0, ank_k=0.25, ank_dorsi=-12.0, ank_h0=0.015, ank_h1=0.035)  # swing foot: plantarflexion soft limit (deg) and its fade-in over the ball height (m)  # arm swing amplitude scale about the centre angle (deg, + forward)


def retarget_walk(src, dst, frames, action_name, ground_ik=True, **params):
    G = dict(GAIT, **params)
    scene = bpy.context.scene
    layer = bpy.context.view_layer
    sw, dw = src.matrix_world.copy(), dst.matrix_world.copy()
    dinv = dw.inverted()
    src_rest = {b.name: (sw @ b.matrix_local).to_quaternion() for b in src.data.bones}
    dst_rest = {b.name: (dw @ b.matrix_local).to_quaternion() for b in dst.data.bones}
    src_head0 = sw @ src.data.bones[PELVIS].head_local
    dst_head0 = dw @ dst.data.bones[PELVIS].head_local
    scale = dst_head0.z / src_head0.z  # leg-length ratio, so the bob keeps its size relative to the body
    floor = min((dw @ dst.data.bones[b].head_local).z for b in BALLS)
    toe_floor = min((dw @ dst.data.bones[b].tail_local).z for b in BALLS)  # rest height of the toe tips
    order = sorted(dst.pose.bones, key=lambda pb: len(pb.parent_recursive))
    for pb in order:
        pb.rotation_mode = "QUATERNION"

    newrot = {}
    ARMQ = {}
    FOOTQ = {}
    fsrc = 1.0 if (sw @ src.data.bones["ball_l"].head_local).y > (sw @ src.data.bones["foot_l"].head_local).y else -1.0
    fdst = 1.0 if (dw @ dst.data.bones["ball_l"].head_local).y > (dw @ dst.data.bones["foot_l"].head_local).y else -1.0
    TORSO = {"spine_02", "spine_03", "clavicle_l", "clavicle_r", "neck_01", "neck_02", "neck_03", "head"}
    HEADG = {"neck_01", "neck_02", "neck_03", "head"}
    D = math.radians
    curl = {"01": 14, "02": 24, "03": 18}

    def rz(a): return Quaternion((0, 0, 1), a)
    def rx(a): return Quaternion((1, 0, 0), a)
    ARM = {"upperarm_l": "lowerarm_l", "lowerarm_l": "hand_l", "upperarm_r": "lowerarm_r", "lowerarm_r": "hand_r"}
    Y = Vector((0, 1, 0))  # bone axis in its own space
    SPINE = ("spine_01", "spine_02", "spine_03")
    # forward tilt added in world space (deg). MPFB rest: upper back tilts back 8, chest forward 6, neck forward 18
    TILT = {"spine_01": -3.5, "spine_02": 4.0, "spine_03": -8.0, "neck_01": -12.0, "head": -2.0}
    SHOULDER_BACK = 4.0  # deg: clavicles yaw back, the MPFB shoulders sit forward of the UAL ones
    KNEE_STAND = 4.5  # deg: a leg under the hip stays near this bend; a reaching or lifted leg keeps the source bend
    sfloor = min((sw @ src.data.bones[b].head_local).z for b in BALLS)
    ks_rest = {s: math.degrees((src_rest["thigh_" + s] @ Y).angle(src_rest["calf_" + s] @ Y)) for s in "lr"}
    kd_rest = {s: math.degrees((dst_rest["thigh_" + s] @ Y).angle(dst_rest["calf_" + s] @ Y)) for s in "lr"}
    # The MPFB A-pose legs splay ~6 deg outward at rest (hip x 0.11, ankle x 0.20), the UAL source stands straight, and the
    # world-delta retarget keeps that splay: the knees sat out and the bend plane tilted. Each thigh and calf gets a constant
    # turn about the forward axis that makes its rest bone vertical in the frontal plane; the source leg motion stays on top.
    SPLAY = {n: math.atan2((dst_rest[n] @ Y).x, -(dst_rest[n] @ Y).z) for n in ("thigh_l", "calf_l", "thigh_r", "calf_r")}

    def src_knee(side):  # source knee bend now (deg), foot height above the source rest floor (m), thigh angle (deg, + forward)
        t = (sw @ src.pose.bones["thigh_" + side].matrix).to_3x3() @ Y
        c = (sw @ src.pose.bones["calf_" + side].matrix).to_3x3() @ Y
        h = (sw @ src.pose.bones["ball_" + side].matrix).to_translation().z - sfloor
        alpha = math.degrees(math.atan2(t.y * fsrc, -t.z))
        return math.degrees(t.angle(c)), h, alpha

    def knee_want(side):  # wanted knee bend (deg) for the current source frame, before smoothing
        ks, h, alpha = src_knee(side)
        w_air = max(0.0, min(1.0, (h - 0.01) / 0.10))  # 0 on the floor, 1 when the foot is 11 cm up
        w_reach = max(0.0, min(1.0, (abs(alpha) - 3.0) / 6.0))  # 0 under the hip, 1 at 9 deg: heel strike and toe-off keep the source bend
        w = max(w_air, w_reach)
        d = ks - ks_rest[side]
        stance = KNEE_STAND + 0.1 * d  # a planted leg under the hip: nearly straight
        return stance + w * (G["knee_k"] * (kd_rest[side] + d) - stance)

    def pose(shift, ovr=None):
        hl =(sw @ src.pose.bones["hand_l"].matrix).to_translation().y
        hr = (sw @ src.pose.bones["hand_r"].matrix).to_translation().y
        hn = max(-1.0, min(1.0, (hl - hr) * fsrc / 0.30))  # +1: left hand forward
        pz = (sw @ src.pose.bones[PELVIS].matrix).to_translation().z
        bob = max(-1.0, min(1.0, (pz - 0.8915) / 0.0205))
        twist = fdst * D(5.0) * hn  # shoulders counter-rotate against the hips
        e_t = rz(twist) @ rx(-fdst * D(1.0))  # plus a small relaxed forward lean
        e_h = rz(-0.6 * twist) @ rx(-fdst * D(0.8) * bob) @ Quaternion((0, 1, 0), D(1.5) * hn)
        for pb in order:
            name = pb.name
            sname = SRC_OF.get(name, name)
            spb = src.pose.bones[sname]
            s_world = sw @ spb.matrix
            delta = s_world.to_quaternion() @ src_rest[sname].inverted()
            rot = delta @ dst_rest[name]
            if name in SPLAY:  # legs: start from the vertical rest (see SPLAY above)
                rot = Quaternion((0, 1, 0), SPLAY[name]) @ rot
            if name in ("thigh_l", "thigh_r"):  # tame the march: scale the sagittal thigh angle, forward and backward of vertical
                v = rot @ Y
                al = math.atan2(v.y * fdst, -v.z)
                rot = rx(fdst * (al * (G["hip_f"] if al > 0 else G["hip_b"]) - al)) @ rot
            if name in ARM:  # rests differ (UAL T-pose, MPFB A-pose): aim the bone along the source bone, not the source rotation delta
                kid = ARM[name]
                sdir = (sw @ src.pose.bones[SRC_OF.get(kid, kid)].matrix).to_translation() - s_world.to_translation()
                rdir = dw.to_3x3() @ (dst.data.bones[kid].head_local - dst.data.bones[name].head_local)
                rot = rdir.rotation_difference(sdir) @ dst_rest[name]
                side = name[-1]
                if name.startswith("upperarm"):  # relaxed arm: pull the abduction in, scale the swing; the forearm turns with it
                    v = rot @ Y
                    sgn = 1.0 if side == "l" else -1.0
                    ab = math.atan2(v.x * sgn, -v.z)
                    sw_ = math.atan2(v.y * fdst, -v.z)
                    dab = max(D(G["abd_min"]), G["abd_k"] * ab) - ab if ab > 0 else 0.0
                    dsw = (D(G["swing_c"]) + G["swing_k"] * (sw_ - D(G["swing_c"]))) - sw_
                    ARMQ[side] = rx(fdst * dsw) @ Quaternion((0, 1, 0), sgn * -dab)
                rot = ARMQ[side] @ rot
                if name.startswith("lowerarm"):  # elbow flexion set from the source bend (never hyperextended)
                    ua = newrot["upperarm_" + side] @ Y
                    la = rot @ Y
                    e = ua.angle(la)
                    fw = hn if side == "l" else -hn
                    e2 = D(G["elbow_base"] + G["elbow_fw"] * max(fw, 0.0)) + G["elbow_k"] * e
                    ax = ua.cross(la)
                    if ax.length > 1e-6:
                        tgt = Quaternion(ax.normalized(), e2) @ ua
                        rot = la.rotation_difference(tgt) @ rot
            elif any(p.name in ("hand_l", "hand_r") for p in pb.parent_recursive) or name in ("hand_l", "hand_r"):
                par = pb.parent.name  # hand and fingers keep their rest pose relative to the forearm
                rot = newrot[par] @ dst_rest[par].inverted() @ dst_rest[name]
            if name in HEADG:  # the source head looks ~14 deg down; keep only 15% of its motion so the face looks forward
                rot = dst_rest[name].slerp(rot, 0.15)
            if name in SPINE:  # the source chest pitches ~15 deg forward on its walk; keep a quarter of that
                rot = dst_rest[name].slerp(rot, 0.25)
            if name in TILT:  # set the rest S-curve upright: each segment is tilted in world space
                rot = rx(-fdst * D(TILT[name])) @ rot
            if name in ("clavicle_l", "clavicle_r"):  # shoulders back: the clavicle tip moves toward the back
                rot = rz(-fdst * D(SHOULDER_BACK) * (1.0 if name.endswith("_l") else -1.0)) @ rot
            if name in TORSO or name in ARM or name in ("upperarm_l", "upperarm_r"):
                rot = e_t @ rot
                if name in HEADG:
                    rot = e_h @ rot
            elif name[:-3] in ("index", "middle", "ring", "pinky", "thumb") or name[:-5] in ("index", "middle", "ring", "pinky", "thumb"):
                base = name.split("_")[0]
                k = name.split("_")[1]
                ang = D(curl[k] * (0.55 if base == "thumb" else 1.0) * (1.25 if base == "pinky" else 1.0))
                zw = dst_rest[name] @ Vector((0, 0, 1))
                sg = 1.0 if zw.x * (-1 if name.endswith("_l") else 1) > 0 else -1.0
                rot = rot @ Quaternion((1, 0, 0), sg * ang)
            if name in ("calf_l", "calf_r"):  # knee bend set from the smoothed per-frame target (see knee_want)
                side = name[-1]
                dt = newrot["thigh_" + side] @ Y
                # the knee is a hinge on the body's lateral axis: the calf is the thigh folded back by the wanted angle.
                # The source calf's own sideways tilt is dropped (it put the knee 15-17 mm out in swing, hinge 6-12 deg).
                lat = (newrot[PELVIS] @ Vector((1, 0, 0))).normalized()
                bend = D(KW[scene.frame_current][side])
                cands = [Quaternion(lat, sg * bend) @ dt for sg in (1.0, -1.0)]
                tgt = min(cands, key=lambda v: v.dot(Vector((0, fdst, 0))))  # the calf folds back, away from the forward axis
                rot = (rot @ Y).rotation_difference(tgt) @ rot
            if name in ("foot_l", "foot_r"):  # ankle: in the air the foot is set against the new shin, near neutral
                # The foot used to copy the source foot's world rotation; with the tamed knee (87 -> 62 deg) that left the foot
                # 60-75 deg plantarflexed in early swing (toes straight down, the shoe standing on end). Natural gait: up to
                # ~20 deg plantarflexion at toe-off, ~neutral in mid-swing for toe clearance. On the floor the source world
                # rotation is kept (flat stance, heel rise at push-off).
                side = name[-1]
                up = -(newrot["calf_" + side] @ Y)  # ankle -> knee
                fv = rot @ Y  # ankle -> ball
                up0 = -(dst_rest["calf_" + side] @ Y)
                p = math.degrees(up.angle(fv)) - math.degrees(up0.angle(dst_rest[name] @ Y))  # + = plantarflexed vs rest
                _, h, _ = src_knee(side)
                w = max(0.0, min(1.0, (h - G["ank_h0"]) / G["ank_h1"]))  # 0 with the ball on the floor, 1 once it is up
                lim = G["ank_air"] + G["ank_k"] * max(0.0, p - G["ank_air"])  # soft limit: the excess over ank_air is scaled down
                want = max(G["ank_dorsi"], min(p, lim))
                n = up.cross(fv)
                FOOTQ[side] = Quaternion(n.normalized(), -D(w * (p - want))) if n.length > 1e-6 else Quaternion()
                rot = FOOTQ[side] @ rot
            if name in ("ball_l", "ball_r") and name[-1] in FOOTQ:  # the toes turn with the corrected foot
                rot = FOOTQ[name[-1]] @ rot
            if name in ("ball_l", "ball_r"):  # toe contact: at push-off the toes bend up at the ball instead of going into the floor
                hd = dw @ pb.matrix.to_translation()  # ball joint, already moved by the foot
                ln = dst.data.bones[name].length
                dv = rot @ Y
                zmin = toe_floor - hd.z
                if dv.z * ln < zmin:  # tip below its rest height: pitch the toes up about the joint just enough
                    tz = max(-1.0, min(1.0, zmin / ln))
                    hz = Vector((dv.x, dv.y, 0.0))
                    if hz.length > 1e-6:
                        tgt = hz.normalized() * math.sqrt(max(0.0, 1.0 - tz * tz)) + Vector((0, 0, tz))
                        rot = dv.rotation_difference(tgt) @ rot
            if ovr and name in ovr:  # ground IK (second pass): thigh and calf set by ik_override
                rot = ovr[name]
            newrot[name] = rot
            if name == PELVIS:
                move = (s_world.to_translation() - src_head0) * scale
                head = dst_head0 + move + Vector((0, 0, shift))
            else:
                head = dw @ pb.matrix.to_translation()  # parent-chained joint, already updated by the last set
            pb.matrix = dinv @ Matrix.LocRotScale(head, rot, None)
            layer.update()

    def ball_z():
        return min((dw @ dst.pose.bones[b].matrix.to_translation()).z for b in BALLS)

    def ik_override(side):  # ground IK: a planted foot (CW=1) is put on the floor by bending the leg, hip and ankle fixed
        th, ca, fo, ba = "thigh_" + side, "calf_" + side, "foot_" + side, "ball_" + side
        L1, L2 = dst.data.bones[th].length, dst.data.bones[ca].length
        H = (dw @ dst.pose.bones[th].matrix).to_translation()
        A = (dw @ dst.pose.bones[fo].matrix).to_translation()  # ankle = foot head
        B = (dw @ dst.pose.bones[ba].matrix).to_translation()
        A2 = A + Vector((0, 0, (floor - B.z) * CW[scene.frame_current][side]))  # foot keeps its world rotation: ball moves with ankle
        v = A2 - H
        d = min(max(v.length, abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4)
        u = v.normalized()
        c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
        s = math.sqrt(max(0.0, 1.0 - c * c))
        fw = Vector((0, fdst, 0))
        p = (fw - fw.dot(u) * u).normalized()  # the knee points forward
        K = H + L1 * (c * u + s * p)
        out = {}
        for nm, tgt in ((th, K - H), (ca, A2 - K)):
            q = (dw @ dst.pose.bones[nm].matrix).to_quaternion()
            out[nm] = (q @ Y).rotation_difference(tgt.normalized()) @ q
        return out

    # knee targets for every frame first, then smoothed around the loop: a per-frame switch snapped the knee 35 deg
    frames = list(frames)
    raw, CW = {}, {}
    for f in frames:
        scene.frame_set(f)
        layer.update()
        raw[f] = {s: knee_want(s) for s in "lr"}
        # planted weight from the source foot height: 1 on the floor, 0 once the foot is 3 cm up
        CW[f] = {s: max(0.0, min(1.0, (0.03 - src_knee(s)[1]) / 0.02)) for s in "lr"}
    K = (1, 2, 3, 4, 3, 2, 1)
    KW = {}
    for i, f in enumerate(frames):
        KW[f] = {s: sum(k * raw[frames[(i + j - 3) % len(frames)]][s] for j, k in enumerate(K)) / sum(K) for s in "lr"}

    # ground lock per frame (pelvis height that puts the lowest ball on the floor), then only a 3-tap smooth around the loop;
    # the planted feet are then put exactly on the floor by ik_override, so the smoothing error is absorbed by the legs
    shifts = {}
    for f in frames:
        scene.frame_set(f)
        layer.update()
        pose(0.0)
        shifts[f] = floor - ball_z()
    K3 = (1, 2, 1)
    SH = {f: sum(k * shifts[frames[(i + j - 1) % len(frames)]] for j, k in enumerate(K3)) / sum(K3) for i, f in enumerate(frames)}

    prev = {}
    for f in frames:
        scene.frame_set(f)
        layer.update()
        shift = SH[f]
        pose(shift)
        ovr = {}
        for s in "lr":
            if ground_ik and CW[f][s] > 1e-6:  # ground_ik=False: the pre-IK pose, for comparison
                ovr.update(ik_override(s))
        if ovr:
            pose(shift, ovr)
        for pb in order:
            q = pb.rotation_quaternion.copy()
            if pb.name in prev and q.dot(prev[pb.name]) < 0:  # keep quaternion signs continuous
                q.negate()
                pb.rotation_quaternion = q
            prev[pb.name] = q.copy()
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if pb.name in (ROOT, PELVIS):
                pb.keyframe_insert("location", frame=f)
        print(f"RETARGET frame {f} ground_shift {shift:+.4f} balls_z {ball_z():.4f}", flush=True)
    act = dst.animation_data.action
    act.name = action_name
    return act
