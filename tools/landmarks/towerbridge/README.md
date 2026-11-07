# Tower Bridge

Procedural Blender build; no external meshes, textures or baked lighting.

```bash
blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
blender -b --python tools/landmarks/towerbridge/render_views.py [-- night]
```

The builder writes `assets/processed/landmarks/towerbridge.lod{0,1}.glb` directly. Each file is one mesh, one PBR material (`TowerBridgeAtlas`) and vertex colours, with no UVs or textures.

Scale: the bridge is authored in real metres (road level = 0) from the 1900 elevation and the official dimensions (towers about 63 m above road, walkways about 38 m above road, 61 m central span). `V()` applies one factor, K = 0.40, so every part keeps the same proportions. The result fits the frozen envelope of `createTowerBridge`: origin at the river centreline, x across the carriageway, z along the crossing, Y up. Towers stand at z = ±14.6, the carriageway top is at y = 5.2, and the walkway floor is at y ≈ 20.4.

Bounds: x ±3.92, z ±17.36, y −0.8..30.68. The loader's envelope is x ±4.1, z ±17.6, y −1..35.3. Approach spans beyond the envelope are not modelled.

Features: four corner turrets with pinnacles per tower, a pitched slate roof, Gothic lancets, a carriageway portal on the road faces, two glazed blue walkways, and two bascule leaves with a centre seam, hinge shafts, footways, rails and lamps (LOD0 only).

Validated export: LOD0 4,256 triangles / 269,244 bytes; LOD1 944 triangles / 69,368 bytes; one draw call per LOD. The builder reimports both files and checks bounds (inside the envelope), triangle budgets, finite unit normals, colour variation and indices.

The browser test checks that both LODs load, that each LOD has one atlas material with vertex-colour PBR and no baked maps, the envelope, the triangle budgets and the LOD swap. The export has no textures, so no KTX2 maps are expected. The single material does not glow over the whole bridge at night.

References and sources are recorded in `ASSET_SOURCES.md`.
