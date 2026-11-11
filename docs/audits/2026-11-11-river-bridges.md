# River bridge continuity and parapet lamps

## Owner scope

Continue the existing uncommitted Claude work on the two Glasgow-livery arch crossings. Remove the valley between each arch and its river bridge; add low night lamps to the existing parapets. The owner explicitly approved retaining the 7.5 m arch crest through the far bank because lowering the arch to 4.5 m would compromise bus clearance. The earlier underwater-road plan is superseded.

## Implementation

- `underwater-profile.js`: constant 7.5 m height through the opposite bank, followed by the existing 14 m eased exit. Asphalt is 0.12 m above this nominal height.
- `underpass.js`: river-facing wing and road use the same height function as the river extension. The opposite land ramp, arch opening, pass centres and swap offsets are preserved.
- `underpass-traffic.js`: cars and projected headlights follow that same profile; no descent/reclimb at 33 m.
- `lamp-mesh.js`: optional base height and uniform scale preserve existing street-lamp callers. Both bridges share one instanced UK lamp group: 20 posts, scale 0.38 (approximately 1.64 m high), on existing parapet caps. `setNight` drives warm head emission and the existing halo shader. No dynamic lights, additional render pass or ground-level lamp pools were added.
- `scene.js`: forwards the existing night factor; underpass disposal releases its lamps. `index.html` includes the newly static lamp module in its preload graph.

Pre-existing camera, lot-clearance and livery-swap edits were retained; this pass did not redesign them. Tower Bridge, Estaiada, river geometry and boat placement are unchanged by this correction.

## Verification

- Regression reproduced before implementation: expected 7.5 m, received 4.2 m.
- `node --test tests/`: **231 passed**, no failures. Node emits its existing module-type warning from the parent package configuration.
- `browser-harness < tests/river-bridge.browser.py`: **passed**. Raycasts check actual road geometry every 0.5 m from arch centre through the far bank on both bridges; verifies ground-level ends, retained arch clearance, elevated lamp transforms, day/night emission and zero dynamic lights. The river slab underside is 7.22 m; using the existing 2.78 m maximum boat-top envelope leaves 4.44 m calculated clearance.
- Desktop captures inspected at `10.54:day`, `10.54:night`, `11.48:day`, `11.48:night`, clear weather, 1728×907 CSS viewport. Both decks remain continuous; warm low lanterns are visible at night.
- Runtime scroll probe crossed both arch centres forward and backward: one London/Glasgow change per crossing, zero sampled frames without a visible hero vehicle (384 frames total). First observed post-change centre offsets: +2.87/-2.31 m and +1.71/-1.40 m. This is a sampled runtime check, not a pixel-level guarantee of occlusion for every scroll speed.
- No `Runtime.exceptionThrown` or error-level `Log.entryAdded` entries were returned during the runtime probe.
- `git diff --check`: passed.

Local visual evidence: `/Users/samuel.catalano/.codex/visualizations/2026/11/11/01a1cbac-eeff-7523-9867-01876cdad409/bridges/` (four full-size PNGs and `grid.png`).

## Limits

No mobile/device matrix, Lighthouse, GPU benchmark or exhaustive fast-scroll sweep was run. Lanterns provide emissive heads and halos; they do not cast new dynamic light onto the deck. The existing short far-bank exit footprint is retained. No commit, push or deployment.

## Owner correction of the approach sides

The owner rejected the wide inclined concrete skirts at the river approaches. Both sides of both river extensions now use vertical stone retaining walls within the existing deck width. Removed the corresponding triangular bank end pieces. Deck profile, channel slab, arch, traffic, boat clearance and lamps remain unchanged. The eight targeted profile/preload tests pass; `git diff --check` passes.

### Continuous approach wall correction

The first skirt correction left the older arch-to-33 m wing inclined, producing a visible change in width and material at the join. The river-facing wing now uses the same vertical plane (±3.6 m) and stone material as the river approach, on both sides of both bridges. The browser regression now raycasts the lateral walls before and after the join to verify alignment.

### Central parapet completion

Extended the river parapets and walkway back to the arch edge, including corner connectors and matching 1 m cap height. Existing approach asphalt and retaining walls are not duplicated. Low lamps now also cover the previously unguarded central span. The browser regression checks parapet presence on both sides before and after the old 33 m join.

### Parapet alignment correction

Removed the offset corner patches: the arch parapets now share the river extension's exact inner/outer planes (3.3/3.6 m), cap planes (3.25/3.65 m), height and material. Lamp centres follow that same alignment. The browser check samples the cap before and after the arch join on both sides of both bridges.


The later owner-authorised masonry finish, elevated night spill and 28 m exit supersede the earlier finish/14 m exit notes above. See [current bridge finish](2026-11-11-bridge-finish.md).
