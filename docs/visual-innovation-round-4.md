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

## Exact next task

Repeat paired frame-time sampling on the owner's desktop GPU at the same route position, viewport, time and weather. The LED refinement is CSS-only and adds no GPU or draw-call cost. For a later visual batch, inspect city-specific facade/material variation only where a clear gain is visible at the locked camera.
