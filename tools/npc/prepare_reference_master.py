"""Stage an unrigged reconstruction in a separate background Blender for likeness review.

blender -b --factory-startup --python-exit-code 1 --python tools/npc/prepare_reference_master.py -- input.glb output-directory
The 1.78 m height is a staging assumption, not a measurement from photographs.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


def stage(source, output, frame=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes or any(o.type == 'ARMATURE' for o in bpy.context.scene.objects):
        raise ValueError('Expected an unrigged reconstruction with mesh geometry')
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    if not points or not all(math.isfinite(c) for p in points for c in p):
        raise ValueError('Empty or nonfinite reconstruction')
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    if high.z - low.z <= 0:
        raise ValueError('Reconstruction has no height')
    scale = frame['scale'] if frame else 1.78 / (high.z - low.z)
    origin = Vector(frame['origin']) if frame else Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    transforms = [(ob, ob.matrix_world.copy()) for ob in meshes]
    for ob, world in transforms:
        if ob.data.users > 1:
            ob.data = ob.data.copy()
        ob.parent = None
        ob.matrix_world = Matrix.Identity(4)
        for v in ob.data.vertices:
            v.co = (world @ v.co - origin) * scale
        ob.data.update()
    points = [v.co.copy() for o in meshes for v in o.data.vertices]
    assert abs(min(p.z for p in points)) < 1e-5
    assert abs(max(p.z for p in points) - 1.78) < 1e-5

    scene = bpy.context.scene
    scene['production_status'] = 'CANDIDATE: likeness, topology, rig and animation unapproved'
    scene['height_assumption_m'] = 1.78
    scene['reconstruction_source'] = source.name
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Review world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.14, 0.14, 0.14, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.5
    scene.view_settings.view_transform = 'AgX'
    for name, pos, power, size in (
        ('Key', (-3, -4, 5), 550, 4),
        ('Fill', (3, -2, 3), 300, 3),
        ('Rim', (0, 3, 4), 400, 3),
    ):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
        scene.collection.objects.link(light)
        light.location = pos
        light.data.energy, light.data.shape, light.data.size = power, 'DISK', size
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.objects.new('Review camera', bpy.data.cameras.new('Review camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.05
    scene.render.resolution_x, scene.render.resolution_y = 560, 700
    target = Vector((0, 0, 0.89))
    camera.location = target + Vector((0, -4, 0))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'candidate_master.blend'))
    triangles = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    result = {'source': str(source), 'height_assumption_m': 1.78,
              'normalization': {'scale': scale, 'origin': list(origin)},
              'triangles': triangles, 'meshes': len(meshes), 'renders': [],
              'status': 'candidate; visual acceptance required'}
    for part, target_z, framing, dimensions in (
        ('body', 0.89, 2.05, (560, 700)),
        ('head', 1.60, 0.47, (560, 560)),
    ):
        scene.render.resolution_x, scene.render.resolution_y = dimensions
        camera.data.ortho_scale = framing
        target = Vector((0, 0, target_z))
        for name, degrees in (('front', 0), ('left_three_quarter', -35),
                              ('right_three_quarter', 35), ('left', -90),
                              ('right', 90), ('back', 180)):
            angle = math.radians(degrees)
            camera.location = target + Vector((4 * math.sin(angle), -4 * math.cos(angle), 0))
            camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
            path = output / f'{part}_{name}.png'
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            result['renders'].append(path.name)
    (output / 'review.json').write_text(json.dumps(result, indent=2) + '\n')
    print('NPC_REVIEW', json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--frame', type=Path, help='Reuse normalization from an earlier review.json for matched captures')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    frame = json.loads(args.frame.read_text())['normalization'] if args.frame else None
    stage(args.source.resolve(strict=True), args.output.resolve(), frame)
