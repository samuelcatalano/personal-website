# Visual refinement round 4 (checkpoint)

Source: the owner's "Round 4 — Revisão crítica das propostas visuais" doc (Claude Docs). Camera lock unchanged (`camera.js` 16a37aa, `scene.js` 5c408f4).

## Batch B: night light hierarchy and monument gradient (done, uncommitted)
- **Big Ben vertical gradient** (`js/world/bigben-asset.js`): the lit tower read as one evenly gold column. Emissive now scales with world height: +30% at the base (0-16 m), -22% toward the spire (14-32 m); clock faces stay clearly lit. Shader math on the one authored material (`bigben-flood-gradient-1`), no draw calls, geometry or textures; day unaffected (emissive is 0 by day). Verified on the same night view (Eye, Big Ben, Tower Bridge): modest, natural gradient; no console errors. Tests 364/364.
- **Tower Bridge**: already splits its flood in two tiers (`TowerBridgeFloodLow` k0.5, `TowerBridgeFloodHigh` k0.18); left as is.
- **Lamp pools on the ground**: already visible under lamps at night (`lamp-field.js`); not changed.
- **Darken ambient between lights**: not done. Night hemisphere is ~0.74 (measured earlier, smooth along the route); changing it moves every material at night, so it needs its own before/after and owner sign-off.

## Next
Batch C (ground bounce, height darkening, cloud shadows) and D (MASP, glass towers, SP water) from the doc. Batch A (cache fix and comparison harness) is not started: the stale-module-cache symptom is real in the Browser pane (old modules after edits) and could hit returning visitors on GitHub Pages; a `?v=` bump on module imports is the lever, owner decision.
