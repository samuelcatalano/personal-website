# Tower Bridge

Procedural Blender build; no external meshes, textures or baked lighting.

```bash
blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
blender -b --python tools/landmarks/towerbridge/render_views.py [-- night]
```

The builder writes `assets/processed/landmarks/towerbridge.lod{0,1}.glb` directly. Each LOD is one mesh with one primitive per material:

- `TowerBridgeAtlas`: vertex-colour PBR for piers, steel, slate, trim, deck and the upper stonework.
- `TowerBridgeLights`: windows, walkway glazing, lamp heads, gilt tips and light strips (roof, footway edges, parapet outline). Glows at night.
- `TowerBridgeFloodLow` and `TowerBridgeFloodHigh`: tower stone below and above 15 m above road, floodlit at night in two bands. Piers stay plain.

The loader marks the three light materials with `glow`; `sky.update` drives their emissive by night. The old procedural light strips and wash sit on the old geometry, so they are hidden while the GLB is active.

Scale: the bridge is authored in real metres (road level = 0) from the 1900 elevation and the official dimensions (towers about 63 m above road, walkways about 38 m above road, 61 m central span). `V()` applies one factor, K = 0.40, so every part keeps the same proportions. The result fits the frozen envelope of `createTowerBridge`: origin at the river centreline, x across the carriageway, z along the crossing, Y up. Towers stand at z = ±14.6, the carriageway top is at y = 5.2, and the walkway floor is at y ≈ 20.4.

Bounds: x ±3.92, z ±17.36, y −0.8..30.68. The loader's envelope is x ±4.1, z ±17.6, y −1..35.3. Approach spans beyond the envelope are not modelled, so the cables that the old procedural lights drew at night are not lit.

Features: four corner turrets with pinnacles per tower, a pitched slate roof, Gothic lancets, a carriageway portal on the road faces, two glazed blue walkways, and two bascule leaves with a centre seam, hinge shafts, footways, rails and lamps (LOD0 only).

Validated export: LOD0 4,396 triangles / 285,540 bytes; LOD1 1,084 triangles / 84,192 bytes; 4 primitives per LOD (one per material), so 4 draw calls. The builder reimports both files and checks bounds (inside the envelope), triangle budgets, finite unit normals, colour variation, indices and that no texture is embedded.

The browser test checks that both LODs load, that the atlas is opaque vertex-colour PBR without maps, that the light and floodlit materials glow without maps, the envelope, the triangle budgets, the LOD swap, and that the procedural fallback stays untouched when the GLB fails.

References and sources are recorded in `ASSET_SOURCES.md`.
