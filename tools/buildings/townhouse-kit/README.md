# Townhouse modular kit

Rebuild the original, texture-free module library with Blender 5.2 or newer:

```sh
blender -b --factory-startup -P tools/buildings/townhouse-kit/build_townhouse_kit.py
```

The script exports `assets/processed/buildings/townhouse-kit.glb` and asserts module names, category counts, non-empty geometry, semantic roles, finite non-degenerate bounds, plus the exported GLB hierarchy.

The GLB root is `TownhouseKit`. Each named module is a child node with `category` and `anchor` extras. Its role nodes are named `<module>__mass`, `<module>__trim`, or `<module>__glass` and carry a `semantic_role` extra with the exact value `mass`, `trim`, or `glass`. Role nodes contain mesh objects whose `semantic_role` extra matches the node. A module only exports role nodes that contain geometry.

GLB coordinates use metres: +Y is up, +Z faces outward from the facade, and X runs left to right. Window origins sit at the opening's sill center on the wall plane; door origins sit at threshold center; cornice origins sit at the wall-run center and lower datum; roof-detail origins sit at the center of their roof-contact footprint. Geometry extends outward into positive Z and inward into negative Z where needed. The generator bakes Blender's Z-up export conversion into mesh vertices, so the kit, module, role, and mesh nodes all keep identity transforms. Runtime can merge a role's mesh geometry directly relative to the module anchor.

There are 9 window, 8 door/storefront, 6 cornice/string-course, and 6 roof-detail variants. The last of each category (window_grille_08, window_balconette_09, door_gated_07, door_rollshutter_08, cornice_parapet_06, roof_water_tank_06) are the Sao Paulo variants, appended so UK module indices never change. All meshes and simple role materials are project-authored; no source meshes, textures, or third-party dependencies are used. The export has no decimation pass, but boxes use a single bevel segment and slim parts are unbeveled (rollout budget: ~130-300 triangles per window, ~2k per house).
