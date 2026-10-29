# Tower Bridge (London)

Original procedural geometry (bmesh), baked in Blender Cycles (CPU), exported as raw glTF. No external meshes or textures.

```bash
blender -b --python tools/landmarks/towerbridge/build_towerbridge.py            # -> assets/models/source/towerbridge/towerbridge.lod{0,1}.raw.glb (git-ignored)
blender -b --python tools/landmarks/towerbridge/render_views.py [-- night]       # -> tools/landmarks/towerbridge/renders/*.png
tools/pipeline/landmark.sh <abs raw.glb> <abs out.glb>                            # raw -> assets/processed/landmarks/towerbridge.lod{0,1}.glb (KTX2 + Meshopt; absolute paths, the script cd's)
```

- Local frame = the procedural `createTowerBridge` group: origin on the river centreline, x across the deck, z along the crossing (towers at z = +-9.5), Y up, metres. Envelope x +-3.9, z +-17.5, y -0.8..35.2 (the old procedural one); deck top 5.2, tower height 35, walkways at y 19-20.5 (these frozen numbers feed traffic and sightlines).
- One mesh and one opaque material per LOD (`TowerBridge_LOD0` ~9.1k tris, `TowerBridge_LOD1` ~2.4k tris), material `TowerBridgeAtlas`, UV0 only. LOD0 1024 px textures, LOD1 512 px.
- Textures: baseColor, ORM (R = baked AO, G = roughness, B = metalness; blue steel 0.5, gilt 1), emissive (floodlit warm stone fading with height, lit windows with random dark ones, walkway glazing, cool-white chain beads, warm deck lamps).
- Tower: pier foot, road portals on the carriageway faces, five rows of pointed windows, white-capped string courses, merlon crown, steep slate pyramid with dormers, lantern and gilt finial, four corner turrets with lancet slits and gilt-tipped cones. Blue high-level walkways with glazed bays, bascule deck with footways, rail and lamps, blue chains with hangers down to stone anchor posts, abutments with blind arches. LOD1 turns openings into flat decals and drops posts, stiffeners and lamp poles.
- Runtime: `js/world/towerbridge-asset.js` (lazy load, LOD by distance with hysteresis, procedural group hidden but kept as fallback, `?landmarks=procedural` forces it). Test: `tests/towerbridge-asset.browser.py`.
