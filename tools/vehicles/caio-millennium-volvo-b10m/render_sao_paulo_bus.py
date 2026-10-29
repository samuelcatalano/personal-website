#!/usr/bin/env python3
"""Render the exported GLB from three desktop review angles."""

import argparse
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("asset", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    asset, output = args.asset.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (lo + hi) * 0.5
    target = (center.x, center.y, lo.z + (hi.z - lo.z) * 0.55)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 1200, 750
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.15, 0.15, 0.15)

    for name, location, power, size in (
        ("Key", (center.x + 2, center.y - 6, hi.z + 6), 1500, 7),
        ("Fill", (center.x - 4, center.y + 5, hi.z + 3), 1000, 8),
        ("Rim", (center.x - 7, center.y - 2, hi.z + 4), 1200, 5),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.object
        lamp.name = name
        lamp.data.energy, lamp.data.shape, lamp.data.size = power, "DISK", size
        look_at(lamp, target)

    floor_mat = bpy.data.materials.new("ReviewFloor")
    floor_mat.diffuse_color = (0.09, 0.10, 0.11, 1)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(center.x, center.y, lo.z - 0.02))
    floor = bpy.context.object
    floor.name = "ReviewFloor"
    floor.data.materials.append(floor_mat)

    camera = bpy.data.objects.new("ReviewCamera", bpy.data.cameras.new("ReviewCamera"))
    scene.collection.objects.link(camera)
    camera.data.lens = 50
    scene.camera = camera
    length = hi.x - lo.x
    views = {
        "front-34.png": ((center.x + length * 0.95, center.y - length * 0.95, center.z + 0.45 * length), 35),
        "side.png": ((center.x, center.y - length * 1.45, center.z + 0.18 * length), 35),
        "rear-34.png": ((center.x - length * 0.95, center.y - length * 0.95, center.z + 0.45 * length), 35),
        "left-front-34.png": ((center.x + length * 0.95, center.y + length * 0.95, center.z + 0.45 * length), 35),
        "left-rear-34.png": ((center.x - length * 0.95, center.y + length * 0.95, center.z + 0.45 * length), 35),
        "front-close.png": ((hi.x + 7.5, lo.y - 3.5, 2.6), 50, (hi.x - 1.0, center.y, 1.5)),
        "rear-close.png": ((lo.x - 7.5, lo.y - 3.5, 2.6), 50, (lo.x + 1.0, center.y, 1.5)),
        "top.png": ((center.x, center.y - 0.5, 28), 35, (center.x, center.y, 1.5)),
        "joint-close.png": ((-1.4, -9.0, 3.2), 50, (-1.4, 0, 1.5)),
    }
    only = [v for v in os.environ.get("VIEWS", "").split(",") if v]  # e.g. VIEWS=front-close,rear-close
    for filename, spec in views.items():
        if only and filename.split(".")[0] not in only:
            continue
        location, lens = spec[0], spec[1]
        camera.location = location
        camera.data.lens = lens
        look_at(camera, spec[2] if len(spec) > 2 else target)
        scene.render.filepath = str(output / filename)
        bpy.ops.render.render(write_still=True)

    print(f"SAO_PAULO_BUS_RENDER_SET={output}")


if __name__ == "__main__":
    main()
