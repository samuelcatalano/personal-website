# Task 1 report: townhouse modular kit

**Status:** Complete; authored and exported the project-owned townhouse module library.

## Deliverables

- `tools/buildings/townhouse-kit/build_townhouse_kit.py` — deterministic Blender generator, Blender-side assertions, raw GLB export, and exported-node inspection.
- `tools/buildings/townhouse-kit/README.md` — rebuild command, semantic hierarchy, axes, anchors, and runtime merge contract.
- `assets/processed/buildings/townhouse-kit.glb` — generated module library.
- `ASSET_SOURCES.md` — project-owned asset provenance and rebuild command.

All 23 module node names are explicit:

- Windows (7): `window_sash_6light_01`, `window_sash_4light_02`, `window_tall_8light_03`, `window_paired_sash_04`, `window_slim_sash_05`, `window_shop_upper_06`, `window_broad_sash_07`.
- Doors/storefronts (6): `door_recessed_panel_01`, `door_glazed_top_02`, `door_sidelight_03`, `door_double_leaf_04`, `storefront_timber_05`, `storefront_pilaster_06`.
- Cornices/string courses (5): `cornice_classical_01`, `cornice_bracketed_02`, `string_course_03`, `cornice_stepped_04`, `cornice_terrace_05`.
- Roof details (5): `roof_chimney_brick_01`, `roof_chimney_stone_02`, `roof_dormer_sash_03`, `roof_ridge_vent_04`, `roof_ridge_finial_05`.

## GLB interface and inspection

Hierarchy: `TownhouseKit` → named module → `<module>__mass`, `<module>__trim`, and/or `<module>__glass` role nodes → mesh nodes. Module nodes carry `category` and `anchor` extras. Role groups and meshes carry `semantic_role` extras with the exact role value. Empty role groups are omitted. Module, role, and mesh transforms are identity; Blender's Z-up conversion is baked into mesh vertices so runtime can merge geometry directly relative to each module anchor.

Coordinates are metres in glTF convention: +Y up, +Z outward from the facade, and +X across the facade. Window anchors are the sill-center point on the facade plane; door anchors are threshold-center points; cornice anchors are the center of the wall run at its lower datum; roof anchors are the center of the roof-contact footprint.

The exported GLB was independently parsed and loaded into Blender for a geometry contact-sheet inspection. It contains 23 module nodes, 243 non-empty mesh nodes, 24,780 triangles, 3 simple role materials, and no textures. The resulting file is 1,812,724 bytes. No decimation or triangle ceiling was applied.

SHA-256:

- GLB: `881c8b6ba8d35cc2ed78cb4540ab1d7ac59be81f0c9b5cb915dd7d7ca533cfc8`
- Generator: `864e28aa47b96133334d03f66b3a0cdee6bf0f408c71746a94895a6c98d7a9cc`

## Validation

1. `blender -b --factory-startup -P tools/buildings/townhouse-kit/build_townhouse_kit.py`
   - Passed. Assertions confirmed 23 modules, expected category counts, unique names, non-empty mesh geometry, role assignment, finite non-degenerate Blender bounds, exported hierarchy, and identity mesh transforms (243 mesh nodes, 322 GLB nodes).
2. Independent inline Python GLB inspection
   - Passed. Confirmed GLB v2 header and length, category counts 7/6/5/5, `mass`/`trim`/`glass` role extras, identity module and mesh transforms, 243 non-empty meshes, finite non-degenerate exported bounds, 24,780 triangles, and zero textures.
3. Blender import and temporary contact-sheet render at `/tmp/townhouse-kit-contact.png`
   - Passed for geometry inspection. The render shows the window, door/storefront, cornice, and roof-detail families. This is an asset preview, not a capture in the website runtime.
4. `git diff --check`
   - Passed before staging.

## Self-review and limits

- The generator uses only project-authored geometry and three simple semantic materials. No external source meshes, textures, packages, or site dependencies were added.
- The output remains a raw authoring export, as requested. Runtime batching/material replacement and in-city visual acceptance belong to Task 2 and were not validated here.
- No known export blocker remains. The GLB hierarchy and anchor conventions are documented for the next task.
