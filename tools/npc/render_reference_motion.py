"""Render a real baked reference-NPC action from the editable Blender artifact."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def render(source, output, clip, view, samples):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    action = next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name == clip)
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.data.pose_position = 'POSE'
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 640, 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Review world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.12, .12, .12, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    for position, energy in (((-3, -4, 5), 550), ((3, -2, 3), 300), ((0, 3, 4), 400)):
        light = bpy.data.objects.new('Review light', bpy.data.lights.new('Review light', 'AREA'))
        scene.collection.objects.link(light)
        light.location, light.data.energy, light.data.size = position, energy, 3
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.objects.new('Review camera', bpy.data.cameras.new('Review camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.05
    angle = {'front': 0, 'quarter': 35, 'side': 90}[view] * math.pi / 180
    target = Vector((0, 0, .89))
    camera.location = target + Vector((4 * math.sin(angle), -4 * math.cos(angle), 0))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    output.mkdir(parents=True, exist_ok=True)
    start, end = action.frame_range
    for index in range(samples):
        frame = start + (end - start) * index / samples
        scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
        scene.render.filepath = str(output / f'{index:03}.png')
        bpy.ops.render.render(write_still=True)
    report = {'source': str(source), 'clip': clip, 'view': view, 'samples': samples,
              'source_frames': [float(start), float(end)],
              'clip_duration_s': float((end - start) / scene.render.fps * scene.render.fps_base)}
    (output / 'render.json').write_text(json.dumps(report, indent=2) + '\n')
    print('REFERENCE_MOTION', json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--clip', choices=['Idle', 'Walk'], default='Walk')
    parser.add_argument('--view', choices=['front', 'quarter', 'side'], default='side')
    parser.add_argument('--samples', type=int, default=32)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if args.samples < 1:
        parser.error('samples must be positive')
    render(args.source.resolve(strict=True), args.output.resolve(), args.clip, args.view, args.samples)
