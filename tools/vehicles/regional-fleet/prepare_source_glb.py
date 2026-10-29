"""Normalize a supplied Sketchfab car GLB for the Three.js traffic catalog.

Run from Blender's Python console or with Blender's GLTF importer/exporter enabled:
    blender -b -P prepare_source_glb.py -- <source.glb> <output.glb> <length_m>

The source files are user-provided, so this script deliberately preserves their
meshes/materials and only normalizes axes, scale, origin, image size and batching.
"""
import bpy
import math
import sys
from collections import defaultdict
from mathutils import Vector


def main(source, output, target_length):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=source)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError('GLB imported without mesh objects')

    # Flatten the imported node hierarchy into Blender's Z-up world coordinates.
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.data.transform(matrix)
        obj.parent = None
        obj.matrix_world.identity()
    bpy.context.view_layer.update()

    points = [Vector(c) for obj in meshes for c in obj.bound_box]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    source_length = hi[1] - lo[1]  # glTF import maps the cars' +Z nose direction to Blender -Y
    if source_length <= 0.01:
        raise RuntimeError(f'unexpected source length: {source_length}')
    scale = target_length / source_length

    # Blender source axes: width X, nose -Y, up Z. Export contract: nose +X,
    # width +Y (becomes Three.js Z), up Z (becomes Three.js Y via export_yup).
    from mathutils import Matrix
    transform = Matrix(((0, -scale, 0, scale * (lo[1] + hi[1]) / 2),
                        (scale, 0, 0, -scale * (lo[0] + hi[0]) / 2),
                        (0, 0, scale, -scale * lo[2]),
                        (0, 0, 0, 1)))
    for obj in meshes:
        obj.data.transform(transform)
        obj.data.update()
    bpy.context.view_layer.update()

    # A single object per source material keeps Blender's scene manageable and
    # reduces renderer submissions without merging unrelated surfaces together.
    by_material = defaultdict(list)
    for obj in meshes:
        if len(obj.data.materials) != 1:
            raise RuntimeError(f'{obj.name}: expected one material per source mesh')
        by_material[obj.data.materials[0].name].append(obj)
    output_objects = []
    for name, group in by_material.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1:
            bpy.ops.object.join()
        merged = bpy.context.view_layer.objects.active
        merged.name = 'source_' + name
        output_objects.append(merged)

    # Cars appear as small ambient traffic. Keep source detail while bounding
    # texture memory at 1024 px; smaller source maps are left untouched.
    for image in bpy.data.images:
        if image.source == 'FILE' and max(image.size) > 1024:
            w, h = image.size[:]
            ratio = 1024 / max(w, h)
            image.scale(max(1, round(w * ratio)), max(1, round(h * ratio)))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in output_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = output_objects[0]
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_materials='EXPORT',
                              export_texcoords=True, export_normals=True, export_tangents=False,
                              export_cameras=False, export_lights=False, export_extras=True)
    print('PREPARED', output, 'meshes', len(output_objects), 'triangles',
          sum(len(o.data.polygons) for o in output_objects), 'materials', len(by_material),
          'dimensions', [round((hi[0]-lo[0])*scale, 4), round(target_length, 4), round((hi[2]-lo[2])*scale, 4)])


args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
if len(args) != 3:
    raise SystemExit('usage: prepare_source_glb.py <source.glb> <output.glb> <length_m>')
main(args[0], args[1], float(args[2]))
