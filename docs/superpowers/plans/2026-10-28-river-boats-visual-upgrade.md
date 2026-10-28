# River Boats Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the seven existing river boats visually distinct and more legible at city scale.

**Architecture:** Extend the existing procedural boat builder with three low-poly hull/superstructure styles. Assign the seven existing instances across those styles in the ambient builder, retaining shared landmark materials and current placements/animation.

**Tech Stack:** Plain JavaScript ES modules, Three.js already pinned in `index.html`, browser-harness desktop capture.

**Spec:** `docs/superpowers/specs/2026-10-28-river-boats-visual-design.md`

## Global Constraints

- “No build step, no npm. Plain HTML/CSS/ES modules. `three` comes from jsDelivr via the importmap in `index.html` with an exact pinned version.”
- “Keep modules small and single-purpose; the TRD lists them. Ask before adding a new dependency.”
- “Prefer the simplest thing that works; mark deliberate shortcuts with a `ponytail:` comment naming the ceiling.”
- “Preserve the map, lot footprints/heights, routes, landmark sightlines, pedestrians and existing logic unless explicitly in scope. Keep paths clear.”
- “Reuse materials, textures and geometries; batch by spatial chunk, with at most three conceptual architecture buckets: mass / trim / glass.”
- Boat-only visual work is reopened by the user. Keep the existing seven boat placements, water, route, bridge, lighting, and animation unchanged; add no external assets, dependencies, lights, or render passes.
- Run desktop validation only. Do not run mobile tests or mobile captures.

## Review Focus

- Shape variants remain visually distinct after the existing geometry merge and shared-material path: test distinct boat geometry signatures and at least 0.45 m separation between low/mid/high profiles.
- The seven boats continue fitting between Tower Bridge towers and under its road deck through the full 0.25 m bob and ±0.04 rad roll: test transformed bounds at both roll extremes.
- New details stay low-poly and use only existing shared materials: inspect the builder diff and desktop captures.
- Day/night lighting keeps hull, trim, and windows readable: capture both themes at London stops.
- Existing palette and scale variety remains represented alongside the three styles: inspect the seven instance definitions and capture.
- A day/night city frame should separate profiles at existing camera scale; keep hull footprint and placements fixed, and check the desktop captures.

---

### Task 1: Upgrade the seven procedural Thames boats

**Files:**
- Modify: `js/world/landmark-geometry.js` (`createBoat`)
- Modify: `js/world/ambient.js` (`boat`, seven instance definitions)
- Modify: `tests/landmarks.browser.py` (existing bridge clearance test)
- Modify: `docs/art-direction.md` (record boat-only visual reopening)

**Interfaces:**
- `createBoat(hullColor, cabinColor, style)` returns a cloned boat group using existing mass/trim/glass material buckets and records the selected style in `userData.boatStyle`.
- `boat(hull, cabin, sx, style)` keeps existing color/scale inputs and creates named/tagged style instances for browser validation.
- `createAmbient(...).update()` keeps existing behavior and continues updating the same seven boats.

- [x] **Step 1: Extend `tests/landmarks.browser.py` first.** Assert exactly seven ambient boats, three represented `userData.boatStyle` values (`launch`, `cruiser`, `service`), and three distinct signatures made from mesh position-attribute counts; retain Tower Bridge width and road-deck clearance assertions.
- [x] **Step 2: Run the desktop browser test and confirm the new style/signature assertion fails against the current single-style implementation.**

Run: `browser-harness < tests/landmarks.browser.py`

- [x] **Step 3: Implement the three procedural styles in `js/world/landmark-geometry.js`.** Preserve current hull footprint envelope; distinguish passenger deck/rail silhouette, enclosed cruiser cabin, and low service-boat superstructure with restrained existing-bucket details. Cache by style and hull/cabin colors.
- [x] **Step 4: Assign a balanced distribution of the three styles across the existing seven boats in `js/world/ambient.js`.** Preserve seven positions, `RIVER_Z` offsets, palette/scales, heading, and bob/rock behavior. Keep `boatStyle` metadata available to the browser assertion.
- [x] **Step 5: Record the user-approved boat-only scope in `docs/art-direction.md`.** State that only seven existing boats may change; all rivers/water and other frozen city visuals stay unchanged.
- [x] **Step 6: Run the desktop browser test again; expect all seven boats to pass style, silhouette, and bridge-clearance assertions.**

Run: `browser-harness < tests/landmarks.browser.py`

- [x] **Step 7: Run existing Node regression and desktop visual captures only.**

Run: `node --test tests/`

Run: `OUT=/private/tmp/river-boats SHOTS="9.5:day,9.5:night,10:day,10:night,11:night" GRID=1 browser-harness < tools/capture.py`

Expected: tests pass; no mobile test/capture; day/night captures show three boat silhouettes, readable at existing camera scale, without changing river, bridges, or city composition.

- [x] **Step 8: Review diff for scope, shared materials, bounds, and authored data preservation; summarize checks and any remaining visual limits.**

#### Fix round 2: strengthen city-scale silhouettes

- [x] Add desktop assertions for the exact seven-style order and at least 0.45 m height separation between cruiser, launch, and service profiles; confirm RED before changing boat geometry.
- [x] Strengthen profile heights and style-specific trim contrast, using existing buckets while preserving hull footprint, locations, water, and bridge clearance.
- [x] Run the focused desktop browser test and review day/night captures; run no mobile tests or captures.

#### Fix round 3: make launch legible and preserve animated clearance

- [x] Add a desktop assertion for both ±0.04 rad roll extremes plus the existing 0.25 m bob; confirm RED before lowering profiles.
- [x] Give the passenger launch a distinct, high-contrast striped canopy top using the existing trim bucket; keep hull footprint and seven placements fixed.
- [x] Keep the three ordered profile heights at least 0.45 m apart, lower service and neighboring profiles for full animated deck clearance, and recapture desktop day/night frames.
- [x] Run the focused desktop browser test and Node regression only; no mobile checks/captures.
