"""Add subtle eye surfaces to the accepted reference head without editing its mesh.

blender -b --factory-startup --python-exit-code 1 --python tools/npc/fix_reference_eyes.py -- accepted-head.glb corrected-head.glb
Pixel guides refer to the matched 700px hero_blender.py head review, head-share .95.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


EYES = (
    ((306, 304), 8, ((285, 307), (294, 302), (305, 298), (315, 298),
                     (325, 302), (319, 308), (307, 310), (295, 309))),
    ((429, 306), 8, ((450, 309), (441, 304), (430, 300), (420, 300),
                     (410, 304), (416, 310), (428, 312), (440, 311))),
)


def inside(x, y, polygon):
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def eye_colour(x, y, centre, radius):
    dx, dy = x - centre[0], y - centre[1]
    r = math.hypot(dx, dy) / radius
    if r < .43:
        return (.004, .004, .004, 1)
    if r < 1:
        # Dark brown is an explicit inference; the source does not resolve iris colour.
        fibre = 1 + .12 * math.sin(math.atan2(dy, dx) * 37 + r * 9)
        edge = .35 if r > .88 else 1
        return (.09 * fibre * edge, .065 * fibre * edge, .036 * fibre * edge, 1)
    return (.34, .32, .29, 1)


def correct(source, output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    head = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
    original = [v.co.copy() for v in head.data.vertices]
    points = [head.matrix_world @ v.co for v in head.data.vertices]
    top, bottom = max(p.z for p in points), min(p.z for p in points)
    chosen = [p for p in points if p.z > top - (top - bottom) * .95]
    centre = sum(chosen, Vector()) / len(chosen)
    size = max(max(p[i] for p in chosen) - min(p[i] for p in chosen) for i in range(3))
    camera = bpy.data.objects.new('Eye fitting camera', bpy.data.cameras.new('Eye fitting camera'))
    bpy.context.scene.collection.objects.link(camera)
    camera.location = centre + Vector((0, -size * 2.2, 0))
    camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    vertices, faces, colours = [], [], []
    hit_counts = []
    approved_grid = None
    for eye_index, (pupil, radius, polygon) in enumerate(EYES):
        grid = {}
        if eye_index == 1:
            gaps, rays = [], {}
            depths = sorted(vertices[i].y for i in approved_grid.values())
            middle = depths[len(depths) // 2]
            for (left_x, left_y), original_i in approved_grid.items():
                x, y = 735 - left_x, left_y + 2
                direction = camera.matrix_world.to_quaternion() @ Vector(((x - 350) / 700 * .72, (350 - y) / 700 * .72, -1))
                direction.normalize()
                hit, point, normal, _, obj, _ = bpy.context.scene.ray_cast(graph, camera.location, direction)
                if not hit or obj != head:
                    raise ValueError(f'Eye guide misses the accepted head at {x},{y}')
                # Scanner rays through tiny holes can hit the back of the skull.
                copied_y = max(middle - size * .015, min(middle + size * .015, vertices[original_i].y))
                rays[x, y] = (direction, original_i, copied_y)
                gaps.append(copied_y - point.y)
            # Reuse the approved eye; only seat the copy in the other socket.
            shift = max(0, sorted(gaps)[int(len(gaps) * .9)]) + size * .0005
            for (x, y), (direction, original_i, copied_y) in rays.items():
                depth = (copied_y - shift - camera.location.y) / direction.y
                grid[x, y] = len(vertices)
                vertices.append(camera.location + direction * depth)
                colours.append(colours[original_i])
        else:
            for y in range(min(p[1] for p in polygon), max(p[1] for p in polygon) + 1):
                for x in range(min(p[0] for p in polygon), max(p[0] for p in polygon) + 1):
                    if not inside(x, y, polygon):
                        continue
                    direction = camera.matrix_world.to_quaternion() @ Vector(((x - 350) / 700 * .72, (350 - y) / 700 * .72, -1))
                    direction.normalize()
                    hit, point, normal, _, obj, _ = bpy.context.scene.ray_cast(graph, camera.location, direction)
                    if not hit or obj != head:
                        raise ValueError(f'Eye guide misses the accepted head at {x},{y}')
                    grid[x, y] = len(vertices)
                    vertices.append(point - direction * size * .0015)
                    colours.append(eye_colour(x, y, pupil, radius))
            approved_grid = dict(grid)
        for (x, y), a in grid.items():
            corners = ((x + 1, y), (x + 1, y + 1), (x, y + 1))
            if all(p in grid for p in corners):
                # Counter-clockwise in world camera view (image Y points down).
                faces.append((a, grid[corners[2]], grid[corners[1]], grid[corners[0]]))
        hit_counts.append(len(grid))
    assert all(n > 80 for n in hit_counts)
    assert hit_counts[0] == hit_counts[1]
    assert colours[:hit_counts[0]] == colours[hit_counts[0]:]
    mesh = bpy.data.meshes.new('Eye surfaces')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    color = mesh.color_attributes.new(name='EyeColor', type='FLOAT_COLOR', domain='POINT')
    for item, rgba in zip(color.data, colours):
        item.color = rgba
    eyes = bpy.data.objects.new('ReferenceEyes', mesh)
    bpy.context.scene.collection.objects.link(eyes)
    material = bpy.data.materials.new('Subtle moist eyes')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .28
    shader.inputs['Coat Weight'].default_value = .2
    vertex = nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'EyeColor'
    material.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    mesh.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = True
    assert all(a == b.co for a, b in zip(original, head.data.vertices)), 'Accepted head geometry changed'
    bpy.ops.object.select_all(action='DESELECT')
    head.select_set(True)
    eyes.select_set(True)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_yup=True)
    print('EYE_CHECK', json.dumps({'head_vertices_unchanged': len(original), 'eye_surface_vertices': hit_counts,
                                 'eye_quads': len(faces), 'iris_colour': 'inferred dark brown',
                                 'visual_review_required': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    correct(args.source.resolve(strict=True), args.output.resolve())
