# Tower Bridge

Procedural Blender build; no external meshes, textures or baked lighting.

```bash
blender -b --python tools/landmarks/towerbridge/build_towerbridge.py
blender -b --python tools/landmarks/towerbridge/render_views.py [-- night]
```

The builder writes `assets/processed/landmarks/towerbridge.lod{0,1}.glb` directly. Each file is one mesh, one PBR material (`TowerBridgeAtlas`) and vertex colours, with no UVs or textures. The local frame matches `createTowerBridge`: origin at the river centreline, x across the deck, z along the crossing, towers at z = ±9.5, Y up; deck top 5.2, walkways y = 19–20.3. Bounds are x ±3.87, z ±17.53, y −0.8..35.2. The two bascules have a centre seam and visible hinge shafts; LOD1 keeps the tower silhouette, roof, walkways and cables.

Validated export: LOD0 7,964 triangles / 478,524 bytes; LOD1 2,178 triangles / 155,468 bytes; one draw call per LOD. The builder reimports both files and checks bounds, triangle counts, finite unit normals, colour variation and indices.

The current browser test still asserts KTX2 base-colour, ORM and emissive maps. This direct PBR export has no textures; runtime loading works, but that assertion needs reconciliation when test/runtime integration is authorized. Until then, the existing glow hook treats the single material as uniformly emissive at night.
