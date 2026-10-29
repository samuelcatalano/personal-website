# MASP (Sao Paulo)

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures. Same pipeline as `tools/landmarks/towerbridge`.

```bash
blender -b --python tools/landmarks/masp/build_masp.py            # -> assets/models/source/masp/masp.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/masp/render_views.py [-- night]  # -> tools/landmarks/masp/renders/*.png
for l in 0 1; do tools/pipeline/landmark.sh $PWD/assets/models/source/masp/masp.lod$l.raw.glb $PWD/assets/processed/landmarks/masp.lod$l.glb; done  # absolute paths (KTX2 + Meshopt)
```

- Local frame = the procedural `createMasp` group: origin at the footprint centre on the ground, x along the long side, z across it, Y up, metres. Envelope (frozen) x +-20, z +-6.5, y 0..15.6. No hangers: the columns carry everything.
- One mesh and one opaque material per LOD (`MaspAtlas`, UV0 only; LOD0 1024 px, LOD1 512 px, own bake). Textures: baseColor, ORM (R = baked AO, G = roughness, B = metalness), emissive.
- Content: four massive red columns (2.8 x 2.6 m, x 15..17.8, outer faces flush at z +-6.5) and two deep red girders on top of the concrete fascia; the box (raw-concrete floor slab with open lit soffit, two-storey glass wall, fascia band, 22 skylight ribs) runs between the columns and cantilevers 2.2 m past them to x +-20; the long glass faces sit at z +-6.4, proud of the girders' inner faces and nearly flush with their outer faces, with ~1.2 m mullion pitch (LOD1 bakes the grid); glazed ends; terracotta plaza slab with steps, dark bench slabs and a rear parapet.
- Night: emissive bake = warm lit gallery box with scattered brighter cells, uplit red frames (brighter at the foot), lit soffit under the box, faintly lit plaza; scaled by the night factor (`glowK`) at runtime.
