"""Re-pose an already rigged reference NPC: contrapposto Idle and a rebuilt Wave; weights and Walk untouched.

blender -b --factory-startup --python-exit-code 1 --python tools/npc/refine_reference_pose.py -- rigged.blend output-directory [albedo-dir]
albedo-dir (optional): Body_albedo.png / Head_albedo.png (and Body_normal.png) from reproject_views.py replace those maps.
Always start from the original rig .blend: the stance is applied on top of Idle, so a second pass would compound it.
"""
import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_rig import build_wave, clips_as_tracks, natural_stance, save_and_export

args = [Path(arg).resolve() for arg in sys.argv[sys.argv.index('--') + 1:]]
source, output, albedo = args[0], args[1], (args[2] if len(args) > 2 else None)
if source.parent == output:
    raise ValueError('Write to a new directory: the source rig must stay intact')
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
rig = next(ob for ob in bpy.data.objects if ob.type == 'ARMATURE')
meshes = [ob for ob in bpy.data.objects if ob.type == 'MESH']
body = bpy.data.objects['Body']
for name in ('Body', 'Head') if albedo else ():
    node = next(n for n in bpy.data.objects[name].active_material.node_tree.nodes if n.type == 'TEX_IMAGE'
                and n.outputs['Color'].links and n.outputs['Color'].links[0].to_socket.name == 'Base Color')
    replacement = bpy.data.images.load(str(albedo / f'{name}_albedo.png'))
    replacement.colorspace_settings.name = node.image.colorspace_settings.name
    replacement.name = node.image.name + '.reprojected'
    node.image = replacement
    normal_file = albedo / f'{name}_normal.png'
    normal = next((n for n in bpy.data.objects[name].active_material.node_tree.nodes if n.type == 'TEX_IMAGE'
                   and n.image and n.image.colorspace_settings.name == 'Non-Color'), None)
    if normal and normal_file.exists():
        cleaned = bpy.data.images.load(str(normal_file)); cleaned.colorspace_settings.name = 'Non-Color'
        cleaned.name = normal.image.name + '.cleaned'; normal.image = cleaned


def weld_normals(ob, precision=5):
    """The mesh is split along UV seams; each copy had its own normal, so seams shaded as dark specks and creases.
    Copies at one position now share their averaged normal (custom split normals); no vertex moves."""
    import numpy as np
    mesh = ob.data
    n = len(mesh.vertices)
    co = np.empty(n * 3, np.float32); mesh.vertices.foreach_get('co', co)
    nor = np.empty(n * 3, np.float32); mesh.vertices.foreach_get('normal', nor)
    _, group = np.unique(np.round(co.reshape(-1, 3), precision), axis=0, return_inverse=True)
    group = group.ravel()
    total = np.zeros((group.max() + 1, 3)); np.add.at(total, group, nor.reshape(-1, 3))
    shared = total[group] / np.linalg.norm(total[group], axis=1, keepdims=True).clip(1e-9)
    mesh.normals_split_custom_set_from_vertices([tuple(v) for v in shared])
    return int(n - (group.max() + 1))


seams = {name: weld_normals(bpy.data.objects[name]) for name in ('Body', 'Head')}
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
bpy.data.actions.remove(bpy.data.actions['Wave'])
rig.data.pose_position = 'POSE'
scene = bpy.context.scene
fps = scene.render.fps / scene.render.fps_base
idle = bpy.data.actions['Idle']
rig.animation_data.action = idle
rig.animation_data.action_slot = idle.slots[0]
start, end = (int(round(v)) for v in idle.frame_range)
report = {'source': str(source), 'albedo': str(albedo) if albedo else None, 'welded_seam_vertices': seams, 'stance': natural_stance(rig, body, list(range(start, end + 1)), fps)}
wave, report['wave'] = build_wave(rig, idle, fps, body)
clips_as_tracks(rig, {name: bpy.data.actions[name] for name in ('Idle', 'Walk', 'Wave')})
scene['production_status'] = 'CANDIDATE: contrapposto Idle and rebuilt Wave await visual approval'
save_and_export(rig, meshes, output)
(output / 'refine-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('REFINE_OK', json.dumps(report['welded_seam_vertices']), json.dumps(report['stance']['sole_calibration']), flush=True)
