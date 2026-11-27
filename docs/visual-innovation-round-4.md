# Visual innovation round 4 — checkpoint

## Confirmed findings

- The earlier blank capture was a readiness/capture issue: in a fresh desktop page, the journey CTA appeared after loading; starting the journey reached `world-ready` and rendered normally. No source defect required a loading fix.
- Inspected São Paulo, London and Glasgow in daylight and at night at the existing camera framing. Existing sky, water, wet-surface, vegetation-wind, fog, lighting and landmark work is already present; no world-space cloud-shadow system was found.
- Cloud modulation is the highest-value focused improvement: moving soft light variation adds depth over broad architecture, roads and foliage without changing scene structure.

## Implemented

- Added a deterministic, tileable, five-scale 128×128 single-channel cloud field and a shared world-space shader modulation for existing `MeshStandardMaterial`s.
- Cloud cover controls softness/strength, night removes the effect, and weather wind controls slow drift. Diffuse response is capped at 18%; no geometry, render pass, dependency or camera change.
- Shared texture is disposed with the world. Existing material compile hooks and cache keys are preserved.
- Follow-up desktop UI refinement: the shared LED blind now uses a monospaced face and a denser dot mask, making stop and service messages legible while preserving the amber/red transit-sign treatment.
- Modified: `css/style.css`, `js/world/cloud-shadow-field.js`, `js/world/cloud-shadows.js`, `js/world/scene.js`, `tests/cloud-shadow-field.test.mjs`.

## Evidence and verification

- São Paulo before/after captures at `/tmp/visual-round4-sp-before.png` and `/tmp/visual-round4-sp-after.png`; visible soft world-space cloud shading is present in the after image.
- LED before/after desktop captures: `/var/folders/rw/vbxv7phs4yq67dltswqtrt240000gq/T/chrome-devtools-mcp-v6FjxO/screenshot.png` and `/var/folders/rw/vbxv7phs4yq67dltswqtrt240000gq/T/chrome-devtools-mcp-3fmIRY/screenshot.png` (same viewport and scene; after capture reloaded CSS without cache).
- Live desktop browser verification: 205 cloud-shadow shader variants in the renderer cache after route compilation; WebGL `getError()` was 0 and no console errors were observed.
- Full `node --test tests/`: 365/365 passed (7.5 s) after the UI refinement.
- `tests/weather-art.browser.py` could not run its page assertion because its CDP evaluation could not resolve the import-map specifier `three`. The actual site was separately loaded and visually inspected in Chrome DevTools. No mobile checks.
- Equivalent São Paulo desktop samples: before median 26.6 ms / p95 26.7 ms; first after median 26.6 ms / p95 27.5 ms; repeat after median 26.7 ms / p95 40 ms. Browser timings are noisy and are not GPU timer measurements; median was effectively unchanged, while p95 varied. Texture cost is about 22 KiB including mipmaps; no geometry or draw pass was added.
- Camera confirmation: only `js/world/scene.js` and the two new cloud-shadow modules are source changes; camera code and configuration were not touched.

## Evaluated / deferred

- Interior mapping was not selected: existing building facade detail is already legible at this camera distance, with higher shader complexity and uncertain visible gain.
- Further atmosphere, wetness and landmark changes deferred to avoid combining unrelated batches.

## Round 4 deferred performance follow-up (historical)

Repeat paired frame-time sampling on the owner's desktop GPU at the same route position, viewport, time and weather. The LED refinement is CSS-only and adds no GPU or draw-call cost. For a later visual batch, inspect city-specific facade/material variation only where a clear gain is visible at the locked camera.

## User-directed desktop refinement — 2026-11-27

- **Scope:** apply the five highest-impact opportunities from the general review. No camera, route, landmark position, global scale, interaction mechanism, mobile behavior, dependency, geometry, draw call, or rendering pass changed.
- **Completed:** show the existing attributed recommendation on the first profile view; identify each city change inline on the journey and lightly mark its next career stop; give existing stone surfaces deterministic per-region material tones; tighten and increase the opacity of the desktop header surfaces at 1101–1365 px and reclaim 20 px of panel width there.
- **Already covered:** local landmark/night illumination already uses `landmark-materials.js`, `landmark-env.js`, and existing floodlights. No duplicate lights or emissive system added.
- **Freeze policy:** removed active freeze/rollout approval gates from `AGENTS.md`, `CLAUDE.md`, and the linked city guidance. Dated audit/handoff/architecture entries remain as history and now state that their former gates are superseded.
- **Modified:** `AGENTS.md`, `CLAUDE.md`, `css/style.css`, `docs/architecture/3d-city.md`, `docs/audits/visual-realism-audit-2026-11-24.md`, `docs/handoff/status-log.md`, `docs/plans/north-star-full-scene-upgrade.md`, `docs/product/3d-city-north-star-prd.md`, `js/ui.js`, `js/world/building-character.js`, `js/world/lot-tint.js`, `tests/lot-tint.test.mjs`.
- **Verification:** `node --test tests/` passes 366/366; desktop Chrome at 1280×900 visually inspected the journey, next-stop cue, city labels, scene, night lighting, and translated profile endorsement in English and Portuguese. Header groups remained separated. No mobile checks.
- **Performance:** no GPU pass, geometry, or frame-loop work added; region tones use existing vertex-color materials. No fresh frame-time benchmark taken.
- **Limits:** browser-harness's second visual run timed out while evaluating the live 3D page; the actual scene was inspected and interacted with in Chrome DevTools. No paired before/after capture was saved for this UI refinement.
- **Exact next task:** owner reviews the uncommitted desktop changes and screenshot evidence in this thread; make only requested refinements before any commit.
