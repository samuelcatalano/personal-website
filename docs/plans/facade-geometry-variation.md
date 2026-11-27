# Plan: facade geometry variation (audit item 10)

Status: plan only, nothing implemented. Needs owner approval before any code. Camera is out of scope and must not change (`camera.js` 16a37aa, `scene.js` 5c408f4).

## What exists (verified in code)
- Shader variation is already shipped: per-pane tone and roughness, dark cells on towers, night blind variation (`building-slice-materials.js`).
- Geometry variation is also shipped, per lot and deterministic, via kit overlays (`facade-kit.js`, `midriseOverlay`): four window styles (Juliet rails / balcony ledges / planters + shutters / hood surrounds with loggia), 3 lobby doors, 3 canopies, 3 cornices, 2 parapets, 4 roof-equipment sets. `KIT_RADIUS` covers every midrise.
- Base window grid is uniform: `columns = floor(w / 2.4)` evenly spaced, one window size per building, one size per floor (`building-kit.js:178-186`). Overlays dress the grid but do not change its rhythm.

So the remaining repetition is the grid rhythm, not the lack of detail.

## Options
| | Change | Risk | Cost |
|---|---|---|---|
| A (recommended) | Per-lot rhythm in `building-kit.js`: hash picks column spacing 2.1-2.8 m, window width 0.42-0.52 of bay, one blank structural bay on wide facades, ground-floor taller bay. Same opening count class, no new meshes. | Low: openings still feed overlays (`h.userData.openings`); only u/width values change | Small |
| B | Style 3 midrises (bare except top-floor hoods) get a second accent (every third floor sill band) via existing kit piece names | Low; adds instances, needs a draw-call check | Small |
| C | New archetypes or new kit pieces (Blender) | High; owner-gated per CLAUDE.md, new assets need `ASSET_SOURCES.md` | Large; not recommended |

## Steps for A
1. Read `building-kit.js:170-200` and the opening consumer (`midriseOverlay` uses `o.u`, `o.w`, `o.h`; `cols` is derived from distinct `u`).
2. Add a seeded rhythm (reuse the existing lot hash; no `Math.random`, so layout stays deterministic).
3. Test first: a node test that two lots with different seeds get different column sets, openings stay inside the facade width, and the same seed is stable.
4. Visual check: SP, London, Glasgow at the same journey positions, day and night, same viewport. Compare before/after frames.
5. Gates: `node --test tests/` green; draw calls and triangles unchanged within noise (read `__qaRenderer` info); camera hashes unchanged; no console errors.

## Out of scope
Townhouse visual language (approved), lot footprints and heights, routes, landmarks, urban densification owned by Codex (read its latest handoff in `docs/handoff/` before touching `building-kit.js`).
