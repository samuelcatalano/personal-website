#!/usr/bin/env python3
"""Reimport and validate the exported São Paulo bus GLB."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TRIANGLE_BUDGET = 12_000
ROLES = {
    "BusBody", "BusAccent", "BusStripe", "BusSweep", "BusSkirtF", "BusTrim",
    "BusGlass", "BusRubber", "BusMetal", "BusHeadlight", "BusTaillight",
    "BusDisplay", "BusInterior",
}
PIVOTS = {"FL", "FR", "ML", "MR", "RL", "RR"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("asset", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    asset = args.asset.resolve()
    if not asset.is_file():
        raise FileNotFoundError(asset)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise AssertionError("No mesh objects were imported")
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    dimensions = hi - lo
    triangles = sum(sum(max(0, p.loop_total - 2) for p in o.data.polygons) for o in meshes)
    roles = {m.name for o in meshes for m in o.data.materials}
    pivots = {o.name: o for o in bpy.context.scene.objects if o.type == "EMPTY" and o.name in PIVOTS}
    images = [i.name for i in bpy.data.images if i.source not in {"VIEWER", "GENERATED"}]
    print(f"MEASURED_BOUNDS lo={tuple(round(v,3) for v in lo)} hi={tuple(round(v,3) for v in hi)} dimensions={tuple(round(v,3) for v in dimensions)} triangles={triangles} pivots={sorted(pivots)} images={images}")

    assert triangles <= TRIANGLE_BUDGET, f"{triangles} triangles exceeds {TRIANGLE_BUDGET}"
    assert "Object_12" not in {o.name for o in meshes}, "source plane survived"
    assert max(dimensions) < 20, f"stray geometry enlarged bounds: {tuple(dimensions)}"
    assert abs(lo.z) < 0.02, f"ground origin is {lo.z:.3f} m"
    assert abs(dimensions.x - 16.758) < 0.05 and abs(dimensions.y - 3.251) < 0.05 and abs(dimensions.z - 3.101) < 0.05
    assert roles <= ROLES, f"unexpected material roles: {sorted(roles - ROLES)}"
    assert {"BusBody", "BusGlass", "BusSweep", "BusTrim"} <= roles
    assert not images, f"unexpected external or embedded images: {images}"
    assert set(pivots) == PIVOTS, f"wheel pivot markers missing: {sorted(PIVOTS - set(pivots))}"
    assert all(pivots[n].get("wheel_pivot") and abs(pivots[n].get("wheel_radius", 0) - 0.52) < 1e-6 for n in PIVOTS)

    print(f"VALIDATION_OK asset={asset}")
    print(f"triangles={triangles}/{TRIANGLE_BUDGET} dimensions_m=({dimensions.x:.3f},{dimensions.y:.3f},{dimensions.z:.3f}) grounded_z={lo.z:.3f}")
    print(f"material_roles={','.join(sorted(roles))} images={len(images)} pivots={','.join(sorted(pivots))}")


if __name__ == "__main__":
    main()
