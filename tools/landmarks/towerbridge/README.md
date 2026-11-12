# Tower Bridge

## Carriageway portals — 2026-11-12

Both main towers and both shore towers now have open stone barrel-vault passages. Front and back half-vaults meet at each tower centre; the road openings stay actual holes at both LODs. This replaces the flat dark backing panels without adding materials or textures. Current export: LOD0 **14,072 triangles / 919,556 bytes**, LOD1 **4,000 triangles / 296,696 bytes**, four material primitives each. Bounds, road height, spans, piers, lights and foam anchors remain fixed. Runtime cache version 12. Older figures below describe preceding model snapshots.


Procedural Blender build; no external meshes, textures or baked lighting.

```bash
blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
blender -b --python tools/landmarks/towerbridge/render_views.py [-- night]
```

The builder writes `assets/processed/landmarks/towerbridge.lod{0,1}.glb` directly. Each LOD is one mesh with one primitive per material:

- `TowerBridgeAtlas`: vertex-colour PBR for the steel (teal), slate and green-grey copper roofs, trim, and the deck.
- `TowerBridgeLights`: windows, walkway glazing, lamp heads, gilt tips, and light strips (roof, under the walkway, footway and carriageway edges, parapet outline). Glows at night.
- `TowerBridgeFloodLow`: piers and tower stone below 15 m above road, floodlit at night.
- `TowerBridgeFloodHigh`: upper tower stone, floodlit more weakly.

The stone is warm beige (day) and the steel is teal-blue, taken from the reference photographs. The loader marks the three light materials with `glow`; `sky.update` drives their emissive by night. The old procedural light strips and wash sit on the old geometry, so they are hidden while the GLB is active.

Scale: the bridge is authored in real metres (road level = 0) from the 1900 elevation and the official dimensions (towers about 63 m above road, walkways about 38 m above road, 61 m central span). `V()` applies one factor, K = 0.40, so every part keeps the same proportions. The result fits the frozen envelope of `createTowerBridge`: origin at the river centreline, x across the carriageway, z along the crossing, Y up. Towers stand at z = ±14.6, the carriageway top is at y = 5.2, and the walkway floor is at y ≈ 20.4.

Bounds: x ±3.92, z ±17.36, y −0.8..30.68. The loader's envelope is x ±4.1, z ±17.6, y −1..35.3. Approach spans beyond the envelope are not modelled, so the suspension cables are not in the GLB and are not lit at night.

Features: four corner turrets with pinnacles per tower, a pitched roof, Gothic lancets, a carriageway portal on the road faces, two glazed blue walkways, and two bascule leaves with a centre seam, hinge shafts, footways, rails and lamps (LOD0 only).

Validated export: LOD0 14,144 triangles / 925,316 bytes; LOD1 3,792 triangles / 287,964 bytes; 4 primitives per LOD (one per material), so 4 draw calls. Modelled from the owner's reference photographs: round corner turrets with banded stone spires and crosses, three-light mullioned windows with sills and hoods, balconies, round portals with archivolts, tall roofs in the same stone as the towers (owner request) with gilt cresting and dormers, stepped battered piers, side spans with teal/white lattice chains and hangers, shore abutment towers, a mid-span crest pavilion and two flags (a Union Jack built on the official 60x30 grid from clipped coloured polygons, and St George's cross). The owner released the old frozen envelope on 2026-11-07, so the extent is now x +-4.95, z +-29.4, top ~31.3 (scene metres), and the budgets are 16,000 / 6,000 triangles. The builder reimports both files and checks bounds, budgets, finite unit normals, colour variation, indices and that no texture is embedded.

The browser test checks that both LODs load, that the atlas is opaque vertex-colour PBR without maps, that the light and floodlit materials glow without maps, the envelope, the triangle budgets, the LOD swap, and that the procedural fallback stays untouched when the GLB fails.

References and sources are recorded in `ASSET_SOURCES.md`.
