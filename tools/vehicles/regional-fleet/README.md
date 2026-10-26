# Regional ambient fleet

Three original Blender-authored traffic cars, one dedicated build script each (same approach as the Mini):

| Car | Builder | Regions |
|---|---|---|
| Toyota Corolla (E210 sedan) | `tools/vehicles/toyota-corolla/` | BR, UK |
| Volkswagen T-Cross | `tools/vehicles/vw-t-cross/` | BR, UK |
| Nissan Qashqai (J11 facelift) | `tools/vehicles/nissan-qashqai/` | UK |

Each car folder holds the build/render scripts, `record.json` (dimensions, axles, beam anchors, sources, hash) and review renders. After rebuilding a car, regenerate the catalog:

```sh
python3 tools/vehicles/regional-fleet/catalog.py
```

## Contract

Metres; GLB +X forward, +Y up; centred ground origin. Six meshes, one primitive/material each: FleetBody, FleetGlass, FleetTrim, FleetRubber, FleetLights, FleetInterior, each with POSITION, NORMAL and COLOR_0; backface culling; merged static wheels; ≤ 20k triangles. Body vertex colour is white (runtime paint multiplies it). `region` is `"uk"`, `"br"` or a list. Blueprints and brochures are visual references only; none is shipped.
