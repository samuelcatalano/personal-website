"""Dump the rigged reference NPC, posed at Idle frame 0, for texture reprojection outside Blender.

blender -b --factory-startup --python-exit-code 1 --python tools/npc/export_posed_uv.py -- rig.blend out-dir
Writes <Mesh>.npz (posed vertices, normals, triangles, per-corner UVs), <Mesh>_albedo.png and, if any, <Mesh>_normal.png.
"""
from pathlib import Path
import sys

import bpy
import numpy as np

blend, out = (Path(a).resolve() for a in sys.argv[sys.argv.index('--') + 1:])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(blend))
rig = next(ob for ob in bpy.data.objects if ob.type == 'ARMATURE')
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.data.pose_position = 'POSE'
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
bpy.context.scene.frame_set(0)
depsgraph = bpy.context.evaluated_depsgraph_get()
for name in ('Body', 'Head'):
    ob = bpy.data.objects[name]
    mesh = ob.evaluated_get(depsgraph).to_mesh()
    mesh.transform(ob.matrix_world)
    mesh.calc_loop_triangles()
    n = len(mesh.vertices)
    co = np.empty(n * 3, np.float32); mesh.vertices.foreach_get('co', co)
    nor = np.empty(n * 3, np.float32); mesh.vertices.foreach_get('normal', nor)
    tris = np.empty(len(mesh.loop_triangles) * 3, np.int32); mesh.loop_triangles.foreach_get('vertices', tris)
    loops = np.empty(len(mesh.loop_triangles) * 3, np.int32); mesh.loop_triangles.foreach_get('loops', loops)
    uv = np.empty(len(mesh.loops) * 2, np.float32); mesh.uv_layers.active.data.foreach_get('uv', uv)
    np.savez(out / f'{name}.npz', co=co.reshape(-1, 3), normal=nor.reshape(-1, 3), tris=tris.reshape(-1, 3),
             uv=uv.reshape(-1, 2)[loops].reshape(-1, 3, 2))
    image = next(node.image for node in ob.active_material.node_tree.nodes
                 if node.type == 'TEX_IMAGE' and node.image and 'normal' not in node.image.name.lower()
                 and node.outputs['Color'].links and node.outputs['Color'].links[0].to_socket.name == 'Base Color')
    copy = image.copy(); copy.filepath_raw = str(out / f'{name}_albedo.png'); copy.file_format = 'PNG'; copy.save()
    normal = next((node.image for node in ob.active_material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image
                   and node.image.colorspace_settings.name == 'Non-Color'), None)
    if normal:
        copy = normal.copy(); copy.filepath_raw = str(out / f'{name}_normal.png'); copy.file_format = 'PNG'; copy.save()
    print('EXPORTED', name, n, len(tris) // 3, image.size[:], image.colorspace_settings.name, bool(normal), flush=True)
    ob.evaluated_get(depsgraph).to_mesh_clear()
