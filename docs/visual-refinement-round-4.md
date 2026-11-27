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

## Batch D: MASP (done, uncommitted) and the rest
- **MASP red variation** (`js/world/masp-asset.js`, material `masp-red-variation-1`): the red frame read as one flat saturated volume. For strongly red texels only (glass and concrete untouched): a low-frequency +-9% value drift across the frame, soft vertical streaks (+-4%) and a darker foot (-16% at ground, fading by 7 m). Albedo math only; no draw calls, geometry or textures. Verified on the SP stop (clear weather): top beam brighter, legs darker toward the ground, subtle drift; modest but visible. Tests 364/364, camera hashes unchanged.
- **MASP chamfered edges and real glass-band reflection: not done.** The chamfer is geometry (the Blender GLB pipeline, `tools/landmarks/masp`, owner-gated asset regeneration); the glass band shares one atlas material (`MaspAtlas`) with the red frame, so a reflection needs a texel mask or a separate glass material; the band currently renders near-black. Left as an asset task.
- **Glass towers (grid repetition)** and **SP water**: not touched. Towers already vary per pane/floor (tone, roughness, blinds, night cells), and the doc's "same blue grid" is the geometric grid (see `docs/plans/facade-geometry-variation.md`). SP water not reviewed this round.

## Next
Remaining from the doc: MASP glass-band reflection and chamfer (asset task), SP water review. Batch A (cache fix and comparison harness) is not started: the stale-module-cache symptom is real in the Browser pane (old modules after edits) and could hit returning visitors on GitHub Pages; a `?v=` bump on module imports is the lever, owner decision.
