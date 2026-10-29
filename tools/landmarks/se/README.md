# Catedral da Se (Sao Paulo)

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures. Same pipeline as `tools/landmarks/bigben`.

```bash
blender -b --python tools/landmarks/se/build_se.py [-- 0|1]         # -> assets/models/source/se/se.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/se/render_views.py [-- night]   # -> tools/landmarks/se/renders/*.png
for l in 0 1; do tools/pipeline/landmark.sh $PWD/assets/models/source/se/se.lod$l.raw.glb $PWD/assets/processed/landmarks/se.lod$l.glb; done  # absolute paths (KTX2 + Meshopt)
```

- Local origin = the procedural `se` group in `js/world/landmark-geometry.js` (centre of the nave footprint, ground y=0, +z = front steps); Y up, metres. Envelope x +-15.8, z -7.3..10.9, y 0..39.3 (map, lot, sightlines are frozen).
- One mesh and one opaque material per LOD (`Se_LOD0` ~4.5k tris, `Se_LOD1` ~1.3k tris), material `SeAtlas`, UV0 only. Textures: baseColor, ORM (R = baked AO, G = roughness, B = metalness), emissive. LOD0 1024 px, LOD1 512 px (own bake).
- Content: nave with 5 buttresses + pinnacles per side, lean-to aisle roofs, clerestory, slate gable roof, front facade with pointed portal (dark door), two lancets, rose window with stone tracery, string courses, 5 descending steps; two 26 m towers with corner turrets, belfry lancets, string courses and 8-sided green copper spires with gold crosses; 32-sided drum with 8 lancets, ribbed green copper dome, lantern, gold cross. Lancets have archivolts and mullions (LOD0); LOD1 turns openings into flat decals and drops ribs/tracery.
- Night: the emissive bake holds amber lit lancets and rose window (mottled glass), a faint sodium-gold flood on the stone (stronger low, fading with height) and a hint on copper; the runtime scales it by the night factor (`glowK`).
- Stone coursing (ashlar) and weathering are baked into the albedo from object-space coordinates; hidden faces (floors, tops under roofs) are omitted.
