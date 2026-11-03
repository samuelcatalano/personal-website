import bpy
import json
import math
import os
import sys
from array import array
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source_dir, raw_dir, out_dir = args
os.makedirs(raw_dir, exist_ok=True)
os.makedirs(out_dir, exist_ok=True)

SOURCES = [
    ('realistic_tree.glb', 'realistic-tree'),
]
LOD_TARGETS = {
    'realistic-tree': [(0, 4200), (1, 1100)],
}
MAX_TEXTURE = 512
TILE = 128
atlas_tiles = []
build_rows = []


def triangles(mesh):
    return sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)


def alpha_mask_foliage():
    for material in bpy.data.materials:
        name = material.name.lower()
        if not any(key in name for key in ('leaf', 'leaves', 'foliage', 'cluster', 'vine', 'prune')):
            continue
        if hasattr(material, 'blend_method'):
            material.blend_method = 'CLIP'
        if hasattr(material, 'alpha_threshold'):
            material.alpha_threshold = 0.42
        material.use_backface_culling = False


def resize_source_textures():
    for image in bpy.data.images:
        width, height = image.size[:]
        if image.source == 'FILE' and max(width, height) > MAX_TEXTURE:
            factor = MAX_TEXTURE / max(width, height)
            image.scale(max(1, round(width * factor)), max(1, round(height * factor)))


def join_tree(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name

    coords = [v.co for v in obj.data.vertices]
    x0, x1 = min(v.x for v in coords), max(v.x for v in coords)
    y0, y1 = min(v.y for v in coords), max(v.y for v in coords)
    z0, z1 = min(v.z for v in coords), max(v.z for v in coords)
    height = max(z1 - z0, 1e-5)
    cx, cy = (x0 + x1) * 0.5, (y0 + y1) * 0.5
    for vertex in obj.data.vertices:
        vertex.co = ((vertex.co.x - cx) / height, (vertex.co.y - cy) / height, (vertex.co.z - z0) / height)
    obj.data.update()
    return obj


def duplicate_mesh(source, name):
    obj = source.copy()
    obj.data = source.data.copy()
    bpy.context.collection.objects.link(obj)
    obj.name = name
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    return obj


def make_lod(source, variant, level, target):
    name = f'{variant}-LOD{level}'
    obj = duplicate_mesh(source, name)
    obj.data.name = name
    count = triangles(obj.data)
    if count > target:
        modifier = obj.modifiers.new('LOD reduction', 'DECIMATE')
        modifier.ratio = target / count
        modifier.use_collapse_triangulate = True
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def render_impostor(source, variant, index):
    hidden = []
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj != source:
            hidden.append((obj, obj.hide_render))
            obj.hide_render = True
    source.hide_render = False
    bpy.context.view_layer.update()

    pts = [source.matrix_world @ Vector(corner) for corner in source.bound_box]
    zmax = max(p.z for p in pts)
    width = max(max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts), 1.0)
    center = Vector((0, 0, zmax * 0.5))
    bpy.ops.object.camera_add(location=center + Vector((0.12, -2.8, 0.08)))
    camera = bpy.context.object
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = max(zmax, width) * 1.16
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type='SUN', location=(2, -3, 4))
    sun = bpy.context.object
    sun.data.energy = 2.2
    sun.rotation_euler = (Vector((0, 0, 0.45)) - sun.location).to_track_quat('-Z', 'Y').to_euler()

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = TILE
    scene.render.resolution_y = TILE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.world = scene.world or bpy.data.worlds.new('Tree atlas world')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (0.36, 0.42, 0.31, 1)
    background.inputs['Strength'].default_value = 0.85
    render_path = os.path.join(raw_dir, f'{variant}.impostor.png')
    scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(render_path, check_existing=False)
    pixels = array('f', [0.0]) * (TILE * TILE * 4)
    image.pixels.foreach_get(pixels)
    atlas_tiles.append((index, pixels))
    bpy.data.images.remove(image)

    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(sun, do_unlink=True)
    for obj, was_hidden in hidden:
        obj.hide_render = was_hidden


def export_file(filename, slug):
    path = os.path.join(source_dir, filename)
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    resize_source_textures()
    alpha_mask_foliage()
    mesh_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    variants = [(slug, mesh_objects)]

    output_objects = []
    for variant, objects in variants:
        if not objects:
            raise RuntimeError(f'No meshes found for {variant} in {path}')
        source = join_tree(objects, f'{variant}-source')
        render_impostor(source, variant, len(atlas_tiles))
        counts = {}
        for level, target in LOD_TARGETS[slug]:
            lod = make_lod(source, variant, level, target)
            counts[f'lod{level}'] = triangles(lod.data)
            output_objects.append(lod)
        build_rows.append({'variant': variant, 'source': filename, **counts})
        bpy.data.objects.remove(source, do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in output_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = output_objects[0]
    raw_path = os.path.join(raw_dir, f'{slug}.raw.glb')
    bpy.ops.export_scene.gltf(filepath=raw_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False)
    print(f'EXPORTED {raw_path} ' + json.dumps([r for r in build_rows if r['source'] == filename], separators=(',', ':')))


for source_file, slug in SOURCES:
    export_file(source_file, slug)

width = TILE * len(atlas_tiles)
pixels = array('f', [0.0]) * (width * TILE * 4)
for index, tile in atlas_tiles:
    for row in range(TILE):
        src = row * TILE * 4
        dst = (row * width + index * TILE) * 4
        pixels[dst:dst + TILE * 4] = tile[src:src + TILE * 4]
atlas = bpy.data.images.new('tree-impostors', width=width, height=TILE, alpha=True)
atlas.pixels.foreach_set(pixels)
atlas.filepath_raw = os.path.join(out_dir, 'tree-impostors.png')
atlas.file_format = 'PNG'
atlas.save()

with open(os.path.join(raw_dir, 'build-manifest.json'), 'w') as f:
    json.dump({'blender': bpy.app.version_string, 'variants': build_rows, 'impostorAtlas': 'tree-impostors.png', 'tile': TILE}, f, indent=2)
print('MANIFEST', json.dumps({'variants': build_rows, 'impostorAtlas': os.path.join(out_dir, 'tree-impostors.png')}, separators=(',', ':')))
