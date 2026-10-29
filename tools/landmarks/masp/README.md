# MASP (Sao Paulo)

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures. Same pipeline as `tools/landmarks/towerbridge`.

```bash
blender -b --python tools/landmarks/masp/build_masp.py            # -> assets/models/source/masp/masp.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/masp/render_views.py [-- night]  # -> tools/landmarks/masp/renders/*.png
for l in 0 1; do tools/pipeline/landmark.sh $PWD/assets/models/source/masp/masp.lod$l.raw.glb $PWD/assets/processed/landmarks/masp.lod$l.glb; done  # absolute paths (KTX2 + Meshopt)
```

- Local frame = the procedural `createMasp` group: origin at the footprint centre on the ground, x along the long side, z across it, Y up, metres. Envelope (frozen) x +-20, z +-6.5, y 0..15.6.
- One mesh and one opaque material per LOD (`MaspAtlas`, UV0 only; LOD0 1024 px, LOD1 512 px, own bake). Textures: baseColor, ORM (R = baked AO, G = roughness, B = metalness), emissive.
- Content: two red portal frames (4 columns with shoes and haunches, transverse beams), two long red beams over the roof, 8 slim hangers per side to the floor slab, the lifted glass box (concrete floor and roof slabs and end walls, glass with steel grid; LOD1 bakes the grid), plaza slab, front stairs, rear lower block with slits.
- Night: emissive bake = warm lit gallery box with scattered brighter cells, uplit red frames (brighter at the foot), lit soffit under the box, faintly lit plaza; scaled by the night factor (`glowK`) at runtime.
