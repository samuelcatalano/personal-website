# Task 2 — São Paulo regional traffic integration

## Result

The primary hero remains Mini → London bus → Glasgow bus → London bus → Mini. São Paulo is not in the hero candidate set. One secondary oncoming London bus starts just across the UK/Brazil boundary and adopts the authored São Paulo traffic LOD as it crosses into Brazil; its own route motion, heading, speed, wheel roll, and beams are retained. The São Paulo livery remains latched through Brazil; a fresh page visit initializes the bus as London.

The swap fades the existing traffic model out, loads the regional GLB into the same vehicle root, refreshes its measured length and headlight beams, and fades it back in. The runtime checks `visualAsset` so a failed load cannot be mistaken for the requested model. Both regional GLBs are preloaded before the secondary transition.

The authored São Paulo GLB now preserves 52,588 triangles across 8 role meshes, with no triangle cap or decimated LOD. Hero and secondary traffic share the same full-resolution asset.

## Files changed

- `js/world/ambient.js` — secondary regional bus and in-place regional model swap.
- `js/world/layout.js` — primary selector and secondary asset boundary helper.
- `js/world/scene.js` — primary hero no longer selects São Paulo.
- `js/world/vehicle-assets.js` — ambient asset registration, successful-asset tracking, shared wheel roll.
- `tests/vehicles.browser.py` — desktop browser assertions for primary route, secondary boundary/model adoption, asset bounds, geometry preservation, and wheel pivots.
- `tools/vehicles/caio-millennium-volvo-b10m/` — full-resolution asset builder/validator documentation and source attribution.
- `assets/vehicles/sao-paulo-bus.glb` — full-resolution asset shared with secondary traffic.

## Validation status

- `git diff --check` passed.
- Targeted desktop browser assertions passed before the final wheel-roll helper change; rerun after the final LOD is reviewed.
- Desktop visual validation is pending the LOD correction.
- Mobile checks intentionally not run.
