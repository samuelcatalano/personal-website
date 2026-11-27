# Visual refinement round 3 (checkpoint)

Camera lock: `camera.js` 16a37aa, `scene.js` 5c408f4 (unchanged). Round 2 state: commits 3f5a74f, c4c4117; see `docs/visual-refinement-round-2.md`.

## Backlog (confirmed vs rejected)

| # | Finding | Evidence | Priority | Status |
|---|---|---|---|---|
| 1 | Wembley glazing read as one flat luminous slab at night | Zoomed night capture of the final stop | P2 | Fixed (batch 1) |
| 2 | Three progress readouts (nav chip "Journey N/12", LED sign "Stops N/12", panel "N of 12 career stops visited") | Strings in `content.js`/`ui.js` | P3 | Not a defect: different surfaces (HUD, diegetic bus sign, panel); same number |
| 3 | "Warming up the vehicle…" with content available | `#loading` text is overwritten by "Loading <stage> · N%" and hidden outside `phase=loading` | none | Not a defect: stale default string, never visible |
| 4 | 83 vs N83 | `ui.js:127` comment: night runs as N83 on purpose | none | Intentional |
| 5 | Pill "Hide the Interface" visible on desktop | Seen once in a fresh tab | none | Stale cached `ui.js` in that tab; after forced reload it is hidden. Static hosts cache modules, nothing to fix in code |
| 6 | "An unknown error occurred when fetching the script" (2-4 console entries) | Not reproduced: 203 resources, none failed | unconfirmed | Likely aborted loads on reload; left |
| 7 | Language switch, theme toggle, completion text, restart button, professional profile skip | Exercised live: all work, no new errors | ok | Verified |

## Batch 1 (done, uncommitted)
`js/world/authored-landmarks.js`: Wembley glass material gets the same 3 m polar bays as the drum cladding: hashed +-22% glow per bay and a dark mullion line at each bay edge (`wembley-glass-hue-glow-bays`). Visual before/after verified on the same night frame at the final stop: the wall now has rhythm instead of a uniform pale-cyan slab. Shader math only on one material: no new draw calls, geometry or textures. Tests 364/364. Camera hashes unchanged.

## Batch 2: day pass (audit only, no change)
Day captures at the locked camera: São Paulo (Sé, Copan/Estaiada), London (Eye, Big Ben, Tower Bridge), Glasgow (Riverside, University). No clear repetition defect found: trees vary by family/tint/proportion, roofs and facades vary per lot, vehicles vary in colour. One weak signal: the Glasgow left-hand block cluster is a bit more colourful than the backdrop (mean saturation 0.21 vs 0.14 in a canvas sample); picked by raycast as `citywide-architecture` cells (per-lot vertex colours, `slice-architecture`), not `distant-neighborhoods`. Not changed: weak evidence, the lot palette is shared with the approved townhouse language, and the earlier `city.js` muting already applies to `wall`. If the owner still sees candy blocks in Glasgow, the lever is the Glasgow lot tint in `building-slice.js` palettes, with owner approval.

## Batch 3: night pass (done, uncommitted)
Night captures at SP (Sé, Copan, Estaiada) and Glasgow (Riverside, University): landmarks, streetlights and towers read well. Confirmed weakness: foreground townhouses were almost entirely dark at night (30% dark, 35% very dim, only ~35% clearly lit) next to richly lit towers, so the street read as dark houses plus glowing objects. Fix: `js/world/building-character.js` `windowOccupation`, residential thresholds [22,50,80] instead of [30,65,88] (about 50% of rooms clearly lit); offices and towers unchanged. Verified on the same SP night frame: more warm windows on the foreground houses, Copan unchanged. Tests 364/364 (bounds .04-.85 and variety still hold). Camera hashes unchanged. Cost: constants only.
Not changed: Glasgow/SP streetlight reach and vehicle lights looked adequate; no pixel-identical before/after beyond the house crop.

## Remaining priorities (next session)
1. (done in batch 2, nothing confirmed) Day pass over the stops.
2. Nighttime pass at the São Paulo and Glasgow stops (streetlight reach, window variation); London and Wembley seen.
3. Performance regression: needs the owner's own Chrome (the Browser pane runs ~1 fps). Also Big Ben LOD0-only cost.
4. Audio and passport/postcard micro-feedback not reviewed this round.

## Known limitations
Browser pane is 800x600 and slow; no mobile checks; no pixel-identical before/after except the Wembley crop.

## Exact next task
Audio and passport/postcard micro-feedback review, then performance in the owner's own Chrome (Big Ben LOD0, Wembley glass, window occupancy).
