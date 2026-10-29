# MASP (Sao Paulo)

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures. Same pipeline as `tools/landmarks/towerbridge`.

```bash
blender -b --python tools/landmarks/masp/build_masp.py            # -> assets/models/source/masp/masp.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/masp/render_views.py [-- night]  # -> tools/landmarks/masp/renders/*.png
for l in 0 1; do tools/pipeline/landmark.sh $PWD/assets/models/source/masp/masp.lod$l.raw.glb $PWD/assets/processed/landmarks/masp.lod$l.glb; done  # absolute paths (KTX2 + Meshopt)
```

- Local frame = the procedural `createMasp` group: origin at the footprint centre on the ground, x along the long side, z across it, Y up, metres. Envelope (frozen) x +-20, z +-6.5, y 0..15.6 (GLB reaches z +-6.5 at the glass front). No hangers: the columns carry everything.
- One mesh and one opaque material per LOD (`MaspAtlas`, UV0 only; LOD0 1024 px, LOD1 512 px, own bake). Textures: baseColor, ORM (R = baked AO, G = roughness, B = metalness), emissive.
- Content: four chunky red columns (2.8 x 2.6 m at x +-17.2..20, outer faces inset to z +-5.6) and two deep red girders (z +-3.6..5.6) on top of the concrete fascia; the glass box (raw-concrete floor slab with open lit soffit, two-storey glass wall reaching down to a thin 0.4 m slab edge, fascia band, 22 skylight ribs) runs between the columns with recessed glazed ends and no cantilever; the long glass wall, fascia and slab edge sit at z +-6.5, outboard of the girders and columns; slender panes at a 0.65 m pitch with thin dark mullions and a mid rail (the grid is also baked into the albedo; LOD1 widens the baked lines so the rhythm survives 512 px, and glass UV islands get 2.2x texel area); terracotta plaza slab with steps, dark bench slabs and a rear parapet.
- Night: the emissive bake holds only the uplit red columns, girders (brighter at the foot); the glass, soffit and plaza stay dark. The runtime scales it by the night factor (`glowK`).
