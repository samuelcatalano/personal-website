# Retarget a UAL clip onto the MPFB game_engine rig, by world-space rotation deltas.
# The two rigs disagree on bone roll (median 83 deg, see npc_inspect.py), so copying local rotations would
# twist the limbs. Each bone's world rotation change is measured against its own source rest and applied to
# the target's rest. The pelvis follows the source pelvis, scaled by leg length. Every frame the lowest ball
# joint is held at its rest height, so the feet neither sink nor float.
import bpy
from mathutils import Matrix, Vector

SRC_OF = {"Root": "root", "head": "Head"}  # rig name -> UAL name; the rest only differ in case
PELVIS = "pelvis"
ROOT = "Root"
BALLS = ("ball_l", "ball_r")


def retarget_walk(src, dst, frames, action_name):
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
    order = sorted(dst.pose.bones, key=lambda pb: len(pb.parent_recursive))
    for pb in order:
        pb.rotation_mode = "QUATERNION"

    def pose(shift):
        for pb in order:
            name = pb.name
            sname = SRC_OF.get(name, name)
            spb = src.pose.bones[sname]
            s_world = sw @ spb.matrix
            delta = s_world.to_quaternion() @ src_rest[sname].inverted()
            rot = delta @ dst_rest[name]
            if name == PELVIS:
                move = (s_world.to_translation() - src_head0) * scale
                head = dst_head0 + move + Vector((0, 0, shift))
            else:
                head = dw @ pb.matrix.to_translation()  # parent-chained joint, already updated by the last set
            pb.matrix = dinv @ Matrix.LocRotScale(head, rot, None)
            layer.update()

    def ball_z():
        return min((dw @ dst.pose.bones[b].matrix.to_translation()).z for b in BALLS)

    prev = {}
    for f in frames:
        scene.frame_set(f)
        layer.update()
        pose(0.0)
        shift = floor - ball_z()
        pose(shift)
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
