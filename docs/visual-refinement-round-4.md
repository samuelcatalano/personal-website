# Visual refinement round 4 (checkpoint)

Source: the owner's "Round 4 — Revisão crítica das propostas visuais" doc (Claude Docs). Camera lock unchanged (`camera.js` 16a37aa, `scene.js` 5c408f4).

## Batch B: night light hierarchy and monument gradient (done, uncommitted)
- **Big Ben vertical gradient** (`js/world/bigben-asset.js`): the lit tower read as one evenly gold column. Emissive now scales with world height: +30% at the base (0-16 m), -22% toward the spire (14-32 m); clock faces stay clearly lit. Shader math on the one authored material (`bigben-flood-gradient-1`), no draw calls, geometry or textures; day unaffected (emissive is 0 by day). Verified on the same night view (Eye, Big Ben, Tower Bridge): modest, natural gradient; no console errors. Tests 364/364.
- **Tower Bridge**: already splits its flood in two tiers (`TowerBridgeFloodLow` k0.5, `TowerBridgeFloodHigh` k0.18); left as is.
- **Lamp pools on the ground**: already visible under lamps at night (`lamp-field.js`); not changed.
- **Darken ambient between lights**: not done. Night hemisphere is ~0.74 (measured earlier, smooth along the route); changing it moves every material at night, so it needs its own before/after and owner sign-off.

## Batch C: ground bounce, height darkening, cloud shadows (investigated, no change)
- **Ground bounce and height darkening already ship:** `GROUND_BOUNCE` (`textures.js`, applied in `textures.js` ground/blocks and `building-slice-materials.js` for mid/high-rise) and the dark street-level band plus per-pane height gradient on facades (2026-11-24 realism pass). Nothing to add without a measured gap.
- **Cloud shadows: tried and rejected.** A world-anchored value-noise alpha plane (`weather-cloud-shadow`, drift ~5 m/s, daytime/no rain only) in `sky.js`. Works technically (rendered, occluded by buildings, hidden at night/rain, disposed with the sky), but at the locked camera it is not perceptible: at 150 m patches the view sits inside one patch; at 60 m patches and 0.26 strength still no visible edges in a captured frame; stronger values read as a blue-dark overlay on streets and cars. Reverted (`git checkout` of the file, only my edit). A convincing version needs the real cloud layer and sun direction, i.e. a shadow-map pass, which is not worth the cost without an owner request.
- **Note for QA:** the world renders on demand; after changing state in the page, nudge the scroll (`scrollBy`) to force a frame before capturing.

## Next
Batch D (MASP, glass towers, SP water) from the doc. Batch A (cache fix and comparison harness) is not started: the stale-module-cache symptom is real in the Browser pane (old modules after edits) and could hit returning visitors on GitHub Pages; a `?v=` bump on module imports is the lever, owner decision.
