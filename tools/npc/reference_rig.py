"""Bind the reference master to an MPFB donor rig; geometry stays a candidate.

blender -b --factory-startup --python-exit-code 1 --python tools/npc/reference_rig.py -- master.glb UAL.glb output-directory
The height and joint anchors are staging inferences, not photographic measurements.
"""
import argparse
from bisect import bisect_right
import json
import math
from pathlib import Path
import sys

import addon_utils
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

sys.path.insert(0, str(Path(__file__).resolve().parent))
from npc_retarget import retarget_walk
from ual_names import to_unreal_names


def positions(mesh):
    coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', coords)
    return coords.reshape(-1, 3)


def set_positions(mesh, coords):
    mesh.vertices.foreach_set('co', np.asarray(coords, dtype=np.float32).ravel())
    mesh.update()


def vertical_map(z, source, target):
    index = max(0, min(len(source) - 2, bisect_right(source, z) - 1))
    fraction = (z - source[index]) / (source[index + 1] - source[index])
    return target[index] + fraction * (target[index + 1] - target[index])


def self_check():
    assert vertical_map(.5, [0, 1, 2], [0, 2, 3]) == 1
    assert vertical_map(1.5, [0, 1, 2], [0, 2, 3]) == 2.5
    assert vertical_map(2, [0, 1, 2], [0, 2, 3]) == 3
    bary = barycentric_transform(Vector((.25, .25, 0)), Vector((0, 0, 0)),
                                 Vector((1, 0, 0)), Vector((0, 1, 0)),
                                 Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    assert (bary - Vector((.5, .25, .25))).length < 1e-6


def normalize_master(meshes, frame=None):
    worlds = {ob: ob.matrix_world.copy() for ob in meshes}
    bounds = []
    for ob in meshes:
        ob.data = ob.data.copy()
        ob.parent = None
        ob.data.transform(worlds[ob])
        ob.matrix_world = Matrix.Identity(4)
        bounds.append(positions(ob.data))
    low = np.min([p.min(axis=0) for p in bounds], axis=0)
    high = np.max([p.max(axis=0) for p in bounds], axis=0)
    if not np.isfinite([low, high]).all() or high[2] <= low[2]:
        raise ValueError('Master has invalid bounds')
    origin = np.asarray(frame['origin']) if frame else np.array([(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, low[2]])
    scale = frame['uniform_scale'] if frame else 1.78 / (high[2] - low[2])
    for ob, points in zip(meshes, bounds):
        set_positions(ob.data, (points - origin) * scale)
    return {'uniform_scale': float(scale), 'origin': origin.tolist(), 'height_assumption_m': 1.78}


def make_donor():
    addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    macros = TargetService.get_default_macro_info_dict()
    values = dict(gender=1.0, age=.5, weight=.9, muscle=.3, height=.5,
                  proportions=.3, african=.1, asian=.1, caucasian=.8)

    def set_macros(data):
        for key, value in data.items():
            if isinstance(value, dict):
                set_macros(value)
            else:
                for name, setting in values.items():
                    if name in str(key).lower():
                        data[key] = setting

    set_macros(macros)
    before = set(bpy.data.objects)
    HumanService.create_human(macro_detail_dict=macros)
    donor = max((ob for ob in bpy.data.objects if ob not in before and ob.type == 'MESH'),
                key=lambda ob: len(ob.data.vertices))
    bpy.context.view_layer.objects.active = donor
    bpy.ops.object.select_all(action='DESELECT')
    donor.select_set(True)
    HumanService.add_builtin_rig(donor, 'game_engine')
    bpy.context.view_layer.objects.active = donor
    donor.select_set(True)
    if donor.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    # Fit the rig before removing MPFB helper vertices used by its joint landmarks.
    for modifier in list(donor.modifiers):
        if modifier.type == 'MASK':
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        else:
            donor.modifiers.remove(modifier)
    rig = next(ob for ob in bpy.data.objects if ob not in before and ob.type == 'ARMATURE')
    rig.name = 'ReferenceRig'
    donor_world, rig_world = donor.matrix_world.copy(), rig.matrix_world.copy()
    donor.parent = None
    donor.data.transform(donor_world)
    donor.matrix_world = Matrix.Identity(4)
    rig.data.transform(rig_world)
    rig.matrix_world = Matrix.Identity(4)
    points = positions(donor.data)
    low, high = points.min(axis=0), points.max(axis=0)
    scale = 1.78 / (high[2] - low[2])
    shift = Vector(((low[0] + high[0]) / 2, (low[1] + high[1]) / 2, low[2]))
    transform = Matrix.Scale(float(scale), 4) @ Matrix.Translation(-shift)
    donor.data.transform(transform)
    rig.data.transform(transform)
    bones = rig.data.bones
    source = [0, bones['foot_l'].head_local.z, bones['calf_l'].head_local.z,
              bones['pelvis'].head_local.z, bones['upperarm_l'].head_local.z,
              bones['neck_01'].head_local.z, bones['head'].head_local.z, 1.78]
    target = [0, .095, .455, .88, 1.39, 1.515, 1.60, 1.78]
    if not all(a < b for a, b in zip(source, source[1:])):
        raise ValueError(f'Donor anchors are not monotone: {source}')
    points = positions(donor.data)
    points[:, 2] = np.interp(points[:, 2], source, target)
    set_positions(donor.data, points)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in rig.data.edit_bones:
        bone.head.z = vertical_map(bone.head.z, source, target)
        bone.tail.z = vertical_map(bone.tail.z, source, target)
    bpy.ops.object.mode_set(mode='OBJECT')
    arm_fit = fit_scanned_arm_rest(donor, rig)
    return donor, rig, {'source_z_m': source, 'target_z_m': target, 'macros': values,
                        'arm_rest_fit': arm_fit,
                        'status': 'inferred joint anchors; donor face unused'}


def fit_scanned_arm_rest(donor, rig):
    """Fit the donor's forward-bent wrists to the scan's lower, straighter A-pose."""
    report = {}
    for side, sign in (('l', 1), ('r', -1)):
        forearm = rig.pose.bones['lowerarm_' + side]
        rest = forearm.bone.matrix_local.copy()
        elbow = rest.translation.copy()
        target = Vector((sign * .50, -.02, .97))
        direction = (target - elbow).normalized()
        rotation = (rest.to_3x3() @ Vector((0, 1, 0))).rotation_difference(direction)
        matrix = (rotation.to_matrix() @ rest.to_3x3()).to_4x4()
        matrix.translation = elbow
        forearm.matrix = matrix
        bpy.context.view_layer.update()
        hand = rig.pose.bones['hand_' + side]
        wrist = hand.matrix.translation.copy()
        hand_rest = hand.bone.matrix_local.to_3x3()
        hand_direction = Vector((sign * .35, 0, -.94)).normalized()
        rotation = (hand_rest @ Vector((0, 1, 0))).rotation_difference(hand_direction)
        matrix = (rotation.to_matrix() @ hand_rest).to_4x4()
        matrix.translation = wrist
        hand.matrix = matrix
        report[side] = {'target_wrist_m': list(target), 'fitted_wrist_m': list(wrist),
                        'hand_direction': list(hand_direction)}
    bpy.context.view_layer.update()
    modifier = donor.modifiers.new('Fit donor arm rest', 'ARMATURE')
    modifier.object = rig
    bpy.context.view_layer.objects.active = donor
    bpy.ops.object.select_all(action='DESELECT')
    donor.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return report


def bind_meshes(meshes, donor, rig):
    donor.data.calc_loop_triangles()
    triangles = [tuple(tri.vertices) for tri in donor.data.loop_triangles]
    coords = [v.co.copy() for v in donor.data.vertices]
    tree = BVHTree.FromPolygons(coords, triangles, all_triangles=True)
    deform = {bone.name for bone in rig.data.bones if bone.use_deform}
    names = {group.index: group.name for group in donor.vertex_groups if group.name in deform}
    source_weights = [{names[g.group]: g.weight for g in vertex.groups if g.group in names and g.weight > 0}
                      for vertex in donor.data.vertices]
    neck_axis = rig.data.bones['head'].head_local

    def donor_weights(co):
        hit, _, face, distance = tree.find_nearest(co)
        if face is None:
            raise ValueError(f'No donor triangle near {tuple(co)}')
        ids = triangles[face]
        bary = barycentric_transform(hit, *(coords[i] for i in ids),
                                     Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        weights = {}
        for index, fraction in zip(ids, bary):
            for name, weight in source_weights[index].items():
                weights[name] = weights.get(name, 0) + max(0, fraction) * weight
        return weights, distance

    def neck_share(co):
        # The head mesh carries the visible neck: it follows the body at the collar, the skull above the jaw.
        height = min(1, max(0, (1.56 - co.z) / .06))
        radius = math.hypot(co.x - neck_axis.x, co.y - neck_axis.y)
        close = min(1, max(0, (.14 - radius) / .02))  # The chin overhangs the neck; it stays on the skull.
        return height * height * (3 - 2 * height) * close

    def write(groups, index, weights):
        active = sorted(((name, weight) for name, weight in weights.items() if weight > 1e-8),
                        key=lambda pair: pair[1], reverse=True)[:4]
        total = sum(weight for _, weight in active)
        if total <= 0 or not math.isfinite(total):
            raise ValueError(f'Unweighted master vertex {index}')
        for name, weight in active:
            groups[name].add([index], weight / total, 'REPLACE')

    result = []
    for ob in meshes:
        ob.vertex_groups.clear()
        groups = {name: ob.vertex_groups.new(name=name) for name in sorted(deform)}
        distances = []
        if ob.name == 'ReferenceEyes':
            groups['head'].add(list(range(len(ob.data.vertices))), 1, 'REPLACE')
        elif ob.name == 'Head':
            for vertex in ob.data.vertices:
                share = neck_share(vertex.co)
                if share <= 0:
                    groups['head'].add([vertex.index], 1, 'REPLACE')
                    continue
                weights, _ = donor_weights(vertex.co)
                total = sum(weights.values())
                mixed = {name: share * weight / total for name, weight in weights.items()}
                mixed['head'] = mixed.get('head', 0) + 1 - share
                write(groups, vertex.index, mixed)
        elif ob.name == 'Body':
            for vertex in ob.data.vertices:
                weights, distance = donor_weights(vertex.co)
                write(groups, vertex.index, weights)
                distances.append(distance)
        else:
            raise ValueError(f'Unexpected master mesh: {ob.name}')
        ob.parent = rig
        ob.matrix_parent_inverse = Matrix.Identity(4)
        modifier = ob.modifiers.new('Reference deform', 'ARMATURE')
        modifier.object = rig
        result.append({'mesh': ob.name, 'vertices': len(ob.data.vertices), 'unweighted': 0,
                       'max_influences': 1 if ob.name == 'ReferenceEyes' else 4,
                       'nearest_donor_distance_m_max': max(distances, default=0),
                       'nearest_donor_distance_m_mean': sum(distances) / len(distances) if distances else 0})
        print('REFERENCE_BIND', json.dumps(result[-1]), flush=True)
    return result


def measure_feet(body, rig, frames):
    scene = bpy.context.scene
    rest = positions(body.data)
    feet = {side: np.flatnonzero((rest[:, 2] < .16) & (rest[:, 0] * sign > 0))
            for side, sign in [('left', 1), ('right', -1)]}
    if any(not len(ids) for ids in feet.values()):
        raise ValueError('No master foot vertices below inferred 0.16 m threshold')
    samples = []
    for frame in frames:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        try:
            points = positions(mesh)
            row = {'frame': frame}
            for side, ids in feet.items():
                row[side + '_sole_min_z_m'] = float(points[ids, 2].min())
                row[side + '_foot_max_z_m'] = float(points[ids, 2].max())
                row[side + '_centre_y_m'] = float(points[ids, 1].mean())
            row['lowest_sole_z_m'] = min(row[side + '_sole_min_z_m'] for side in feet)
            samples.append(row)
        finally:
            evaluated.to_mesh_clear()
    keys = ('left_sole_min_z_m', 'right_sole_min_z_m', 'lowest_sole_z_m')
    speeds = []
    fps = scene.render.fps / scene.render.fps_base
    for previous, current in zip(samples, samples[1:]):
        for side in feet:
            if max(previous[side + '_sole_min_z_m'], current[side + '_sole_min_z_m']) < .015:
                speed = (current[side + '_centre_y_m'] - previous[side + '_centre_y_m']) * fps
                if speed > .05:
                    speeds.append(speed)
    return {'selection': 'rest-pose Body vertices below inferred 0.16 m, split by X sign',
            'ranges_m': {key: [min(row[key] for row in samples), max(row[key] for row in samples)] for key in keys},
            'stance_speed_mps': float(np.median(speeds)) if speeds else None,
            'frames': samples, 'status': 'evaluated geometry only; no natural-motion approval'}


def ground_scanned_soles(body, rig, frames):
    """Calibrate the reused joint-ground lock to this scan's actual shoe soles."""
    ids = np.flatnonzero(positions(body.data)[:, 2] < .16)
    if not len(ids):
        raise ValueError('No scanned sole vertices to calibrate')
    corrections = []
    root = rig.pose.bones['Root']
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        try:
            floor = float(positions(mesh)[ids, 2].min())
        finally:
            evaluated.to_mesh_clear()
        matrix = root.matrix.copy()
        matrix.translation.z -= floor
        root.matrix = matrix
        root.keyframe_insert('location', frame=frame)
        corrections.append(floor)
    return {'root_height_correction_m': [min(corrections), max(corrections)],
            'basis': 'evaluated scan soles, not donor toe-joint height'}


ARM_CLEARANCE_DEGREES = 16  # The scan's torso is far wider than the animation source's: tune here.


def clear_arms_from_torso(rig, frames):
    # Swing each upper arm outward about the armature's forward axis; the forearm follows as its child.
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        for name in ('upperarm_l', 'upperarm_r'):
            bone = rig.pose.bones[name]
            outward = -math.copysign(math.radians(ARM_CLEARANCE_DEGREES), bone.head.x)
            pivot = Matrix.Translation(bone.head)
            bone.matrix = pivot @ Matrix.Rotation(outward, 4, 'Y') @ pivot.inverted() @ bone.matrix
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    return ARM_CLEARANCE_DEGREES


WAVE_LOOPS = 3  # The clip spans whole Idle loops: raises, waves, lowers, then rests before repeating.
WAVE_HZ = 1.55
WAVE_END_S = 3.9
LEG_CLOSE_DEGREES = 5  # Each thigh, toward the other: the Idle stance is wide at this character's scale.


def aim_bone(bone, direction):
    # Armature space, about the bone's head; children follow on the next update.
    current = (bone.tail - bone.head).normalized()
    pivot = Matrix.Translation(bone.head)
    rotation = current.rotation_difference(direction.normalized()).to_matrix().to_4x4()
    bone.matrix = pivot @ rotation @ pivot.inverted() @ bone.matrix
    bpy.context.view_layer.update()


def lean_bone(bone, radians):
    # About the character's forward axis: positive tips the top toward its left.
    pivot = Matrix.Translation(bone.head)
    bone.matrix = pivot @ Matrix.Rotation(radians, 4, 'Y') @ pivot.inverted() @ bone.matrix
    bpy.context.view_layer.update()


def turn_to_thumb_inward(rig, hand, bone, share):
    axis = (hand.tail - hand.head).normalized()
    thumb = rig.pose.bones['thumb_01_r'].head - hand.head
    thumb -= axis * thumb.dot(axis)
    inward = Vector((1, 0, 0)) - axis * axis.x
    angle = math.atan2(axis.dot(thumb.cross(inward)), thumb.dot(inward)) * share
    pivot = Matrix.Translation(bone.head)
    bone.matrix = pivot @ Matrix.Rotation(angle, 4, axis) @ pivot.inverted() @ bone.matrix
    bpy.context.view_layer.update()


def smooth(value):
    value = min(1, max(0, value))
    return value * value * (3 - 2 * value)


def open_waving_fingers(rig, hand, amount):
    # Straighten the scan's relaxed fingers with a slight fan; more would stretch their shared surface.
    axis = (hand.tail - hand.head).normalized()
    lateral = (Vector((1, 0, 0)) - axis * axis.x).normalized()
    keyed = []
    targets = {'index': axis + lateral * .07, 'middle': axis + lateral * .02, 'ring': axis - lateral * .03,
               'pinky': axis - lateral * .08, 'thumb': axis * .6 + lateral * .8}
    for finger, target in targets.items():
        for part in ('01', '02', '03'):
            bone = rig.pose.bones[f'{finger}_{part}_r']
            aim_bone(bone, (bone.tail - bone.head).normalized().lerp(target.normalized(), .85 * amount))
            keyed.append(bone)
    return keyed


def build_wave(rig, idle, fps, body):
    """Idle's body with the Memoji's arms: raises the right hand, waves unevenly, lowers it and rests."""
    wave = idle.copy()
    wave.name = 'Wave'
    rig.animation_data.action = wave
    rig.animation_data.action_slot = wave.slots[0]
    scene = bpy.context.scene
    start, end = (int(round(v)) for v in wave.frame_range)
    loop = end - start
    last = start + loop * WAVE_LOOPS
    for frame in range(end + 1, last + 1):
        scene.frame_set(start + (frame - start) % loop)
        pose = [(bone, bone.rotation_quaternion.copy(), bone.location.copy()) for bone in rig.pose.bones]
        for bone, rotation, location in pose:
            bone.rotation_quaternion = rotation
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            if bone.name in ('Root', 'pelvis'):
                bone.location = location
                bone.keyframe_insert('location', frame=frame)
    # Hips and legs hold the first frame's stance: owner's request, only the upper body moves.
    scene.frame_set(start)
    planted = [(bone, bone.rotation_quaternion.copy(), bone.location.copy()) for bone in rig.pose.bones
               if bone.name in ('Root', 'pelvis') or bone.name.startswith(('thigh', 'calf', 'foot', 'ball'))]
    named = {name: rig.pose.bones[name] for name in ('spine_02', 'upperarm_r', 'lowerarm_r', 'hand_r',
                                                     'upperarm_l', 'lowerarm_l', 'hand_l')}
    for frame in range(start, last + 1):
        scene.frame_set(frame)
        for bone, rotation, location in planted:
            bone.rotation_quaternion = rotation
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            if bone.name in ('Root', 'pelvis'):
                bone.location = location
                bone.keyframe_insert('location', frame=frame)
        bpy.context.view_layer.update()
        t = (frame - start) / fps
        up = min(smooth(t / .55), smooth((WAVE_END_S - t) / .7))
        phase = 2 * math.pi * WAVE_HZ * (t - .4)
        # Uneven amplitude, a lagging wrist and an elbow that follows: a plain sine reads as a machine.
        forearm_angle = 10 + (13 + 5 * math.sin((t - .4) * 1.7)) * math.sin(phase)
        wrist_angle = forearm_angle + 20 * math.sin(phase - 1)
        elbow = math.radians(3.5) * math.sin(phase - .5)
        drift = .012 * math.sin(t * 1.3)
        lean_bone(named['spine_02'], math.radians(2.2) * up + .004 * math.sin(t * .9))
        for side in ('l', 'r'):
            thigh, foot = rig.pose.bones['thigh_' + side], rig.pose.bones['foot_' + side]
            inward = math.copysign(math.radians(LEG_CLOSE_DEGREES), thigh.head.x)
            lean_bone(thigh, inward)
            lean_bone(foot, -inward)  # The sole stays flat on the ground.
            thigh.keyframe_insert('rotation_quaternion', frame=frame)
            foot.keyframe_insert('rotation_quaternion', frame=frame)
        rest_upper, rest_forearm, rest_hand = Vector((-.34, .03, -.94)), Vector((-.16, -.2, -.97)), Vector((-.12, -.22, -.97))
        aim_bone(named['upperarm_r'], rest_upper.lerp(Vector((-.86 - elbow, -.06, -.42 + elbow)), up) + Vector((0, drift, 0)))
        fore = math.radians(forearm_angle)
        aim_bone(named['lowerarm_r'], rest_forearm.lerp(Vector((-math.sin(fore), -.14, math.cos(fore))), up))
        wrist = math.radians(wrist_angle)
        aim_bone(named['hand_r'], rest_hand.lerp(Vector((-math.sin(wrist), -.22, math.cos(wrist))), up))
        keyed = list(named.values())
        if up > .01:
            # Palm to the viewer: a raised right hand has its thumb toward the head.
            turn_to_thumb_inward(rig, named['hand_r'], named['lowerarm_r'], .6 * up)
            turn_to_thumb_inward(rig, named['hand_r'], named['hand_r'], up)
            keyed += open_waving_fingers(rig, named['hand_r'], up)
        aim_bone(named['upperarm_l'], Vector((.42, .05 + drift, -.9)))
        aim_bone(named['lowerarm_l'], Vector((-.3, -.5 + drift, -.8)))
        aim_bone(named['hand_l'], Vector((-.3, -.5, -.8)))
        for bone in keyed:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    # Closer legs reach lower, so the soles are measured against the floor again.
    soles = ground_scanned_soles(body, rig, list(range(start, last + 1)))
    return wave, {'source_action': 'Idle_Loop body with procedural arms', 'baked_frames': [start, last], 'fps': fps,
                  'duration_s': (last - start) / fps, 'wave_hz': WAVE_HZ, 'sole_calibration': soles}


def keep_scanned_fingers_relaxed(rig, frames):
    # The reference scan has touching fingers; imported grasp poses stretch their shared surface.
    fingers = [b for b in rig.pose.bones if b.name.startswith(('thumb_', 'index_', 'middle_', 'ring_', 'pinky_'))]
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        for bone in fingers:
            bone.rotation_quaternion = (1, 0, 0, 0)
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    return len(fingers)


def stage(master, ual, output, normalization=None):
    self_check()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(master))
    meshes = [ob for ob in bpy.context.scene.objects if ob.type == 'MESH']
    if {ob.name for ob in meshes} != {'Body', 'Head', 'ReferenceEyes'}:
        raise ValueError('Master must contain exactly Body, Head and ReferenceEyes')
    if any(ob.type == 'ARMATURE' for ob in bpy.context.scene.objects):
        raise ValueError('Expected unrigged master')
    normalization = normalize_master(meshes, normalization)
    donor, rig, anchors = make_donor()
    weights = bind_meshes(meshes, donor, rig)
    bpy.data.objects.remove(donor, do_unlink=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ual))
    imported = [ob for ob in bpy.data.objects if ob not in before]
    src = next(ob for ob in imported if ob.type == 'ARMATURE')
    to_unreal_names(src)
    clips, actions = {}, {}
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    for name, source_name in [('Idle', 'Idle_Loop'), ('Walk', 'Walk_Loop')]:
        source_action = bpy.data.actions.get(source_name)
        if source_action is None or not source_action.slots:
            raise ValueError(f'Missing UAL action/slot {source_name}')
        src.animation_data_create()
        src.animation_data.action = source_action
        src.animation_data.action_slot = source_action.slots[0]
        start, end = source_action.frame_range
        frames = list(range(math.floor(start), math.ceil(end) + 1))
        if rig.animation_data:
            rig.animation_data.action = None
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        scene.frame_set(frames[0])
        actions[name] = retarget_walk(src, rig, frames, name)
        clips[name] = {'source_action': source_name, 'source_frames': [float(start), float(end)],
                       'baked_frames': [frames[0], frames[-1]], 'fps': fps,
                       'duration_s': (frames[-1] - frames[0]) / fps}
        clips[name]['relaxed_finger_bones'] = keep_scanned_fingers_relaxed(rig, frames)
        clips[name]['arm_clearance_degrees'] = clear_arms_from_torso(rig, frames)
        body = next(ob for ob in meshes if ob.name == 'Body')
        clips[name]['sole_calibration'] = ground_scanned_soles(body, rig, frames)
        if name == 'Walk':
            clips[name]['foot_floor'] = measure_feet(body, rig, frames)
    if '--normalization' not in sys.argv:  # The runtime takes clips from LOD0 only.
        actions['Wave'], clips['Wave'] = build_wave(rig, actions['Idle'], fps, next(ob for ob in meshes if ob.name == 'Body'))
    for ob in imported:
        bpy.data.objects.remove(ob, do_unlink=True)
    for action in list(bpy.data.actions):
        if action not in actions.values():
            bpy.data.actions.remove(action)
    rig.animation_data.action = None
    for name, action in actions.items():
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(action.frame_range[0]), action)
        strip.action_slot = action.slots[0]
    scene['production_status'] = 'CANDIDATE: weights and retarget only; deformation and motion await visual approval'
    scene['height_assumption_m'] = 1.78
    rig['walk_speed_mps'] = clips['Walk']['foot_floor']['stance_speed_mps']
    rig['height_m'] = 1.78
    rig['archetype'] = 'reference'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.frame_start, scene.frame_end = clips['Walk']['baked_frames']
    scene.frame_set(scene.frame_start)
    # NLA tracks are separate clips for export; mute evaluation to save the editable master in its rest pose.
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.data.pose_position = 'REST'
    bpy.ops.file.pack_all()
    blend = output / 'npc_game_ready.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    rig.data.pose_position = 'POSE'
    for track in rig.animation_data.nla_tracks:
        track.mute = False
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes + [rig]:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(output / 'rigged.glb'), export_format='GLB',
                              use_selection=True, export_animations=True, export_skins=True,
                              export_all_influences=False, export_yup=True, export_apply=False,
                              export_attributes=True, export_image_format='AUTO',
                              export_extras=True,
                              export_frame_range=False,
                              export_animation_mode='NLA_TRACKS')
    report = {'master': str(master), 'ual': str(ual), 'normalization': normalization,
              'anchors': anchors, 'weights': weights, 'bones': len(rig.data.bones),
              'deform_bones': sum(b.use_deform for b in rig.data.bones), 'clips': clips,
              'status': scene['production_status'], 'blend_saved_in_rest_pose': True}
    (output / 'rig-report.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print('REFERENCE_RIG', json.dumps(report, allow_nan=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('master', type=Path)
    parser.add_argument('ual', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--normalization', type=Path, help='Reuse the LOD0 rig report normalization for lower LODs')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    frame = json.loads(args.normalization.read_text())['normalization'] if args.normalization else None
    stage(args.master.resolve(strict=True), args.ual.resolve(strict=True), args.output.resolve(), frame)
