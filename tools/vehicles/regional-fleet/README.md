# Regional ambient fleet

Three user-supplied, high-detail traffic cars, normalized and batched in Blender by `prepare_source_glb.py`:

| Car | Builder | Regions |
|---|---|---|
| Toyota Corolla 2020 | `tools/vehicles/toyota-corolla/` | BR, UK |
| Volkswagen T-Cross 2021 | `tools/vehicles/vw-t-cross/` | BR, UK |
| Nissan Qashqai 2018 | `tools/vehicles/nissan-qashqai/` | UK |
| Honda HR-V e:HEV 2022 | `tools/vehicles/honda-hr-v/` | BR, UK |
| Land Rover Range Rover Supercharged 2008 | `tools/vehicles/land-rover-range-rover/` | BR, UK |
| Mercedes-Benz E63 AMG S Wagon 2018 | `tools/vehicles/mercedes-e63-amg-s-wagon/` | BR, UK |

Each car folder holds `record.json` (dimensions, axles, beam anchors, source/license and output hash). The input GLBs were supplied by the site owner. The preparation script preserves their geometry and materials, normalizes orientation and scale, joins meshes by material, and caps embedded maps at 1024 px. After rebuilding, regenerate the catalog:

```sh
python3 tools/vehicles/regional-fleet/catalog.py
```

## Contract

Metres; GLB +X forward, +Y up; centred ground origin. Source materials, geometry and textures are retained, with images capped at 1024 px; meshes are batched per source material. Current assets contain 155k–497k triangles and 6–31 materials. `paintMaterials` names the body finishes tinted to the metallic traffic palette. At runtime ambient cars split wheel triangles from the source materials in `axles.wheelMaterials` using axle/radius data, then spin those pivots. `region` is `"uk"`, `"br"` or a list. Preserve attribution and share-alike terms in `ASSET_SOURCES.md`.
