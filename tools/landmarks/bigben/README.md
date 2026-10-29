# Big Ben + Palace of Westminster river frontage

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures.

```bash
blender -b --python tools/landmarks/bigben/build_bigben.py            # -> assets/models/source/bigben/bigben.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/bigben/render_views.py [-- night]  # -> tools/landmarks/bigben/renders/*.png
```

- Local origin: ground at the tower river-side axis; Y up, metres. Tower at x=0, z=+1.5; frontage runs along +x (3..37), Victoria-style end tower at x~35.
- One mesh and one opaque material per LOD (`BigBen_LOD0` ~7.7k tris, `BigBen_LOD1` ~2.7k tris), material `BigBenAtlas`, UV0 only.
- Textures 1024x1024 embedded: baseColor, ORM (R = baked AO, G = roughness, B = metalness; used for occlusion + metallicRoughness), emissive (night windows, louvres, gold, faint stone flood). LOD1 has its own bake with the same material/texture names.
- The clock recesses are empty by design (runtime draws the dial plane at 3.06 m from the axis; bezel rim reaches 3.07 m).
- Tower follows the owner reference: dark base block, slim shaft with 6x4 rows of narrow recessed slits between tan bands, large light-tan clock surround (bezel R 2.15/1.75, rim at 3.07 m), teal copper hip + dormers, brown belfry, steep spire, pole to y=34. Parliament windows have 25-30 cm reveals; LOD1 turns openings into flat decals and drops merlons.
- Intermediate bake PNGs: `assets/models/source/bigben/tex/`. `processed/` GLBs are produced by the pipeline (Meshopt/KTX2), not here.
