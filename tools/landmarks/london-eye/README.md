# London Eye source asset

Run from the repository root with `blender -b --python tools/landmarks/london-eye/build_london_eye.py`. The script reproducibly writes this directory's `london-eye.blend` and the two `assets/processed/landmarks/london-eye.lod*.glb` files, then imports each GLB back into Blender and checks node names, orientation, bounds, capsule count, materials, triangle count and geometry validity.

The GLBs preserve the runtime pivot contract: `eye-wheel` is centered at its origin in the XY plane, with its axle along +Z; `eye-frame` is separate and rests at local Y=0, with its bearing at Y=18. The radius is 16 game units and the wheel keeps 32 capsules. The local dimensions adapt the [official 120 m diameter / 135 m height reference](https://www.londoneye.com/about-us/history/) to the established scene envelope; geometry is original and procedural.

Each LOD uses six mesh nodes and only `Mass`, `Trim` and `Glass`. No textures, baked lighting, external assets or animation are included. The Blender file stores both LOD collections with suffixes; each GLB exports the required unsuffixed names.

Blender 5.2.3 validation: LOD0 3,576 triangles / 81,828 bytes; LOD1 2,308 triangles / 55,076 bytes. Both imports preserve 32 capsules and six draw calls, with finite normals, zero degenerate or duplicate triangles, and no textures or animation.
