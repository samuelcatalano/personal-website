# RTS-Inspired City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Keep one owner per source module; orchestrator owns design decisions, integration, and final verification.

**Goal:** Improve the city’s depth and visual variety with classic RTS map cues while preserving the current bus journey, accessible HTML content, landmark views, and walking paths.

**Architecture:** Keep the current perspective Three.js scene, route, and X/Y/Z coordinate system. Extend procedural parks, building silhouettes, and the existing distant backdrop; compare a few CC0 assets but add only files that fit the existing renderer without a new dependency.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Three.js 0.169 via the existing import map, Node’s built-in test runner, existing browser-harness tests. No build step or npm.

**Spec:** `docs/superpowers/specs/2026-10-19-rts-inspired-city-design.md`

## Global Constraints

- Keep the existing oblique perspective, continuous bus ride, route, coordinate system, and Three.js renderer.
- No buildings, trees, or props obstruct landmark views or pedestrian paths; clearance tests pass.
- Use rounded trees at varied heights and no pines.
- Do not change the HTML panel, EN/PT copy, or add dependencies.
- Any incorporated external asset is checked at file level for license, contents, dimensions, and size; CC0 is preferred, and any CC-BY use includes attribution.
- Verify desktop and 375 px mobile, day/night, EN/PT, WebGL disabled, reduced motion, no browser console errors, and Lighthouse accessibility score at least 95. Preserve the PRD's desktop Lighthouse performance goal of at least 80.

## Review Focus

- **Landmark foreground:** any new raised geometry must remain outside protected views. Pin this in `tests/scenery.browser.py` for the named landmark regions and desktop/mobile camera shots.
- **Walk paths:** park borders, tree canopies, and props must not intrude into walking loops. Pin in `tests/parks.test.mjs` and `tests/trees.browser.py`.
- **Procedural determinism:** seeded scenery must produce identical placement and geometry across runs. Pin in `tests/parks.test.mjs` and `tests/backdrop.test.mjs`.
- **Asset loading and license:** any imported file must be local, reviewed, and have a recorded source/license; no runtime network dependency. Verify file/source correspondence in the asset task and browser console/network behavior in the final task.
- **Accessibility and reduced capability:** scenery must not become required content when WebGL is unavailable or motion is reduced. Verify using the existing page and browser workflow in the final task; the HTML panel remains unchanged.

---

## File Map

- `js/world/parks.js` — park ground and edge geometry, using the existing `buildParks(add, stops, pts, curve, occ, onTree)` interface; river water remains owned by `water.js` and is not reworked.
- `js/world/houses.js` — low-poly Georgian building silhouette, using the existing `house(add, q, x, z, o, w, d, n, fh, lo)` interface.
- `js/world/backdrop.js` — deterministic distant-city and countryside geometry, using `buildBackdrop(add, stops, pts)`.
- `js/world/layout.js` — existing seeded RNG and landmark/route coordinates; change only if a test demonstrates a missing clearance boundary.
- `assets/third-party/` and `assets/THIRD_PARTY.md` — create only if a candidate asset passes review and is actually integrated; keep only used files and record license/source.
- `tests/parks.test.mjs`, new `tests/houses.test.mjs`, `tests/backdrop.test.mjs`, and existing browser-harness scripts — regression coverage for the corresponding module.

## Tasks

### Task 1: Add restrained park-edge transitions

**Files:**
- Modify: `js/world/parks.js`
- Test: `tests/parks.test.mjs`

**Interfaces:**
- Consumes: `buildParks(add, stops, pts, curve, occ, onTree)` and the existing `PALETTE` values.
- Produces: the same geometry callback interface and unchanged park/tree placement callback behavior.

- [ ] **Step 1: Write a failing park-edge test.** Add `test('larger lawn parks have a low paved edge outside walking loops', ...)`. Collect boxes from `buildParks`; assert the `PARKS[0]` lawn has four edge strips in `PALETTE.pave` at `y = 0.02`, `h = 0.05`, with a `0.45 m` border width and non-overlapping corners. Assert every strip remains at least `2.4 m` from pedestrian loop rectangles.
- [ ] **Step 2: Run `node --test tests/parks.test.mjs` and confirm the new assertion fails because the edge strips are absent.** Existing tests must remain green.
- [ ] **Step 3: Add the four low edge strips in `buildParks` for non-plaza lawn parks.** Keep `PLAZAS`, `PARKS` coordinates, seeded RNG calls, fountain/pond placement, walking paths, and `onTree(x, z, shape)` unchanged. Build strips from each park's final lawn rectangle and existing `P.pave`; end the side strips at the lawn corners so they do not overlap the front/back strips.
- [ ] **Step 4: Run `node --test tests/parks.test.mjs`; confirm the new edge test and existing park/path/tree-placement tests pass.**
- [ ] **Step 5: Commit** with `git add js/world/parks.js tests/parks.test.mjs && git commit -m "feat: add subtle park edging"`.

### Task 2: Vary townhouse roof silhouettes

**Files:**
- Modify: `js/world/houses.js`
- Create: `tests/houses.test.mjs`

**Interfaces:**
- Consumes: `house(add, q, x, z, o, w, d, n, fh = 3.1, lo = false)`; `q` is the existing deterministic RNG callback.
- Produces: same `add(x, y, z, w, h, d, color)` output interface; no caller changes.

- [ ] **Step 1: Add `test('house roof profiles vary deterministically within the existing footprint', ...)`.** Render the same `9 m × 7 m`, three-floor house twice for seeds `0..31` and assert each output is identical for the same seed. Assert at least one roof cap has a `0.6 ×` footprint ratio, absent in the current profile. For `lo = true`, assert roof geometry ends no higher than `1.06 m` above the wall top.
- [ ] **Step 2: Run `node --test tests/houses.test.mjs`; confirm the `0.6 ×` roof-cap assertion fails on the current profile.**
- [ ] **Step 3: Extend the existing roof branch in `house()` with one additional stepped roof-cap profile, selected only through `q()`.** Reuse existing `ROOFS` colors and current dimensions; keep doors/windows, `lo` treatment, `9 m × 7 m` wall footprint, and the current maximum roof height unchanged. Do not add per-house materials or assets.
- [ ] **Step 4: Run `node --test tests/houses.test.mjs tests/scenery-fill.test.mjs`; then run `tests/city.browser.py` through browser-harness.** Confirm deterministic output, footprint, neighborhood clearance, and plaque/sign clearance pass.
- [ ] **Step 5: Commit** with `git add js/world/houses.js tests/houses.test.mjs && git commit -m "feat: vary townhouse roof profiles"`.

### Task 3: Give the distant skyline a stronger depth rhythm

**Files:**
- Modify: `js/world/backdrop.js`
- Test: `tests/backdrop.test.mjs`
- Test: `tests/scenery.browser.py`

**Interfaces:**
- Consumes: `buildBackdrop(add, stops, pts)`, `regions(stops, pts)`, and `glasgowSites(stops, pts)`.
- Produces: same deterministic box geometry callback; no scene or camera API changes.

- [ ] **Step 1: Add `test('near backdrop has an extra stepped roof tier while far rows stay muted', ...)`.** From two `buildBackdrop` runs, assert identical output. Match near-row walls to roof blocks at the same x/z and assert at least one uses `0.38 ×` wall width, `0.45 ×` wall depth, `0.28 m` height, starting at `wall.h + 1.1`. Assert far-row walls use only `stone`, `concreteMid`, `taupe`, or `steel`, and keep the overall box count at or below `2500`.
- [ ] **Step 1a: Extend `tests/scenery.browser.py` to require at least one new backdrop roof tier and assert each tier remains outside the existing landmark-view corridor for desktop and mobile shots.**
- [ ] **Step 2: Run `node --test tests/backdrop.test.mjs`; confirm the new `0.38 ×` tier assertion fails while existing determinism, backdrop-size, countryside, and museum-clearance checks pass. Run `tests/scenery.browser.py` through browser-harness and confirm the new-tier existence assertion fails before implementation.**
- [ ] **Step 3: Add the extra roof tier to every third near neighborhood building in `buildBackdrop` using its existing seeded RNG.** Keep far rows muted, city geometry behind `z = -110`, buildings below `22 m`, country-region gaps, the full ground plane, and the Glasgow museum corridor unchanged. Do not add more rows or exceed the existing box budget.
- [ ] **Step 4: Run `node --test tests/backdrop.test.mjs tests/scenery-fill.test.mjs`; run `tests/scenery.browser.py` through browser-harness.** Confirm all tests pass and no added cap enters a landmark view.
- [ ] **Step 5: Commit** with `git add js/world/backdrop.js tests/backdrop.test.mjs tests/scenery.browser.py && git commit -m "feat: add depth to distant skyline"`.

### Task 4: Compare a small CC0 asset subset and use only a clear fit

**Files:**
- Create only if an asset is selected: `assets/third-party/<pack>/` and `assets/THIRD_PARTY.md`
- Test: existing browser-harness scene checks; no loader or dependency changes.

**Interfaces:**
- Consumes: the current `TextureLoader`, `BoxGeometry`/instanced mesh path, and the candidate packs linked in the spec.
- Produces: either a minimal local subset used by an existing renderer path, or a documented decision to keep the scene procedural. No external runtime URL.

- [ ] **Step 1: Inspect Kenney Nature Kit and one Kenney City Kit archive.** Verify the specific files' source, license, file type, dimensions, file sizes, rounded-tree suitability, and whether they can use the existing geometry/texture path without a new loader. Do not extract or copy unneeded files into the repository.
- [ ] **Step 2: Make a visual comparison in the local scene against the procedural baseline.** Reject assets with incompatible projection/materials, pines, excessive file size, or extra loader/dependency requirements.
- [ ] **Step 3: If a subset clearly fits, add only those files under `assets/third-party/<pack>/` and record pack URL, author, CC0 license, source date, and local filenames in `assets/THIRD_PARTY.md`; otherwise leave assets unchanged.**
- [ ] **Step 4: Run the existing relevant browser checks (`tests/trees.browser.py`, `tests/scenery.browser.py`) through browser-harness.** Confirm no missing local requests, no console errors, no pine silhouettes, and no landmark/path obstruction. If the subset fails any check, remove it and retain the procedural scene.
- [ ] **Step 5: Commit** only the selected asset files, manifest, and any renderer file actually needed, with `git add <selected files> && git commit -m "feat: add selected CC0 city props"`. If the pack is rejected, do not create a no-op commit.

### Task 5: Integrate, visually review, and run project verification

**Files:**
- Modify only if evidence requires it: `js/world/scene.js`, `js/world/camera.js`, or `js/world/layout.js`
- Test: existing Node and browser-harness suites; no new UI files.

**Interfaces:**
- Consumes: completed park, townhouse, skyline, and optional asset changes.
- Produces: final scene using the existing `createWorld` assembly and unchanged HTML fallback.

- [ ] **Step 1: Start the local preview with `python3 -m http.server 8000` and capture the same baseline viewpoints for Sé, London/Thames, Glasgow, and Wembley at desktop and 375 px mobile.**
- [ ] **Step 2: Compare day/night and EN/PT views.** Verify recognizable landmark silhouettes, open paths, tree canopies outside the routes, and no scenery in landmark foregrounds; change layout/camera only to fix a demonstrated regression.
- [ ] **Step 3: Run `node --test tests/` and existing browser-harness checks for `tests/scenery.browser.py`, `tests/trees.browser.py`, `tests/landmarks.browser.py`, and `tests/world.browser.py`.** Expected: all checks pass, no console errors, and no uncaught asset errors.
- [ ] **Step 4: Verify WebGL-disabled and reduced-motion modes, then run Lighthouse.** Expected: HTML panel remains usable; accessibility is at least 95; desktop performance is at least 80.
- [ ] **Step 5: Commit any evidence-driven integration fix** with a message describing the fixed regression; do not add a commit if no integration fix is needed.

## Implementation Notes

- Use subagents for the independent `parks.js`, `houses.js`, and `backdrop.js` tasks, with separate file ownership. The orchestrator reviews each diff and owns the asset choice, integration, and final QA.
- The rounded tree atlas already exists and is camera-facing/instanced. Leave `trees.js` unchanged unless the visual baseline shows a requirement not met by its existing two rounded variants and the tree/path tests can preserve clearance.
- Asset selection is optional. If no candidate fits the existing renderer cleanly, finish with procedural geometry only; the spec's goal does not require vendoring a pack.
- Capture before/after screenshots for visual review, but do not add screenshot files to the site unless explicitly requested.
