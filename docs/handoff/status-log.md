# Handoff status log

## 2026-10-29 — Codex continuation

- **Repository:** `feat/site-gamefication` is clean at `8e23dbc` and matches `origin/feat/site-gamefication`. `8e23dbc` adds the 2026-10-29 handoff document on top of `cdff284`; the handoff's stated HEAD is therefore one commit behind, and its “none pushed” note is stale for the current tracking ref. No history was rewritten.
- **Scope:** read the handoff, `CLAUDE.md`, and the current city references (`3d-city.md`, `rendering-budget.md`, `art-direction.md`). No implementation, asset, or visual changes made in this continuation.
- **Graphics TODO:** the handoff records Phases 1–4 as complete and Phase 5 (mobile) as intentionally skipped. The visual atlas predates those later graphics commits. The graphics TODO's GLB-pedestrian item is stale: that experiment was abandoned, and its future direction remains undecided.
- **Asset pipeline observed:** Phase 0 tooling, Phase 1 processed vehicle assets, and Phase 2 Big Ben assets/runtime are present in the current tree. The project architecture page still says “plan, nothing implemented”; the roadmap still presents Big Ben as a future POC and processed loading as flag-gated. The handoff's Big Ben triangle figures also differ from the committed baseline; reconcile those records before treating either set as authoritative. Sketchfab/NC-SA sourcing approval is recorded in the handoff and `ASSET_SOURCES.md`, while older architecture text still frames sourcing as an open decision.
- **Carry-forward issues:** the handoff reports failures in `tests/underpass.browser.py`, `tests/london-cab.browser.py`, `tests/hero-facades.browser.py`, and `tests/world.browser.py`; it also says `tests/zfight.browser.py` skips yawed boxes. These were not rerun here. The handoff reports 116/116 Node tests at its stated implementation handoff; no tests were run in this continuation, per instruction.
- **Environment:** local server was stopped; no browser capture, test, deployment, or mobile work was performed.
- **Next step:** wait for explicit owner approval before starting Phase 3 (the townhouse modular kit). Further landmark phases, Phase 6 lighting, moving/deleting raw GLBs, CI, and the pedestrian experiment also remain approval-gated as described in the handoff.

## 2026-10-29 — Townhouse kit rollout to all UK terraces

- **Scope (owner approved):** every UK terraced townhouse in the citywide rollout (x>0: London, countryside villas, Glasgow; 343 lots, 87 of 194 cells; São Paulo, landmarks and the `frontage-gap-olm-135--1--9` exclusion untouched). Rollback: `?kit=off`.
- **How:** `city-rollout.js` builds the procedural LOD0/LOD1 as before; kit LOD0 per cell is built lazily from 140 m (max 3 near / 1 far cells per update), replaces and frees the procedural LOD0, and is dropped beyond 180 m. LOD1 and the 120/129/111 hysteresis are unchanged; 3 meshes per chunk, same 2 materials. Variety: per-lot FNV hash picks window family (ground floor and side faces shifted), door (4 houses doors), cornice (5) and roof detail (5; chimneys/vents/finial on side/hip ridges, dormer only on gables).
- **Kit rebuild:** one bevel segment, no bevel on parts <0.1 m, 8-sided knobs: GLB 1.81 MB -> 0.53 MB, window ~1,300 -> ~170-230 triangles. The building-slice browser test constant for lit-glass vertices changed 132 -> 36 per pane (glass box is now 12 triangles).
- **Measured (desktop, 60 rAF ticks, stops 9.5/10/11, kit=off vs on):** draw calls 1247/1144/1265 -> 1263/1153/1265 (+1.3/+0.8/0%); triangles 9.80/9.07/10.28M -> 9.98/9.17/10.37M (+1.9/+1.1/+0.8%). Rollout LOD0 triangles if every kit cell were resident: 845k -> 1.37M; camera sweep along the route: resident geometry 154 -> peak 183 -> 133 MiB at the end. No console errors.
- **Validation:** `node --test tests/` 116/116; desktop building-slice, townhouse-lod, building-kit, citywide, zfight, trees, vehicles, bigben-asset browser tests pass. No mobile checks.

## 2026-10-29 — Townhouse modular kit desktop quality pass

- **Baseline/integration:** visual baseline `fe6b720da45189a2faffa3d658aadc82f33ac98e`; raw asset milestone `fe6b720da45189a2faffa3d658aadc82f33ac98e`; runtime integration `7c715258c5fd9b59576cf900478a43ea65ca6ff7`.
- **Visual result:** GO for the nine-lot raw-kit pilot. Fixed desktop views show readable facade relief, preserved roof silhouette and facade rhythm, grounded placement, and no visible z-fighting. LOD1 keeps the existing procedural facade. Full-scene desktop day/night captures at stops 5 and 11 were also inspected.
- **Measurements:** baseline/current nine-lot pilot LOD0: 6/6 draws, 6,572/104,270 triangles; LOD1: 6/6 draws, 3,226/3,226 triangles. The three-lot control remains 3 draws and 2,334 triangles. Normalized by chunk, pilot draw calls equal control (3 versus 3, 0% delta; 10% gate passes). Raw asset: 1,812,724 bytes, 24,780 source triangles, 3 source materials, no textures. Triangle counts are evidence, not gates.
- **Optimization:** exact required command produced 688,108 bytes and retained 24,780 source triangles, but pruned UV attributes required when merging module and procedural geometry. The candidate failed to adopt into the pilot and displayed fallback geometry. It was discarded; raw GLB remains. CLI has no UV-preservation option; `smooth` is not equivalent because it recalculates normals.
- **Validation:** `node tools/pipeline/check.mjs`; `node --test tests/` (116/116); desktop `building-slice.browser.py`, `building-kit.browser.py`, `citywide.browser.py`, and `zfight.browser.py` passed. Citywide required increasing the harness IPC timeout after its default 5-second client timeout; test source was unchanged. No mobile checks or deployment.
- **Evidence/limitations:** fixed-stage screenshots are machine-local under `/private/tmp/townhouse-evidence/`; full-scene baseline captures under `/private/tmp/townhouse-baseline-capture/`. No full-pipeline timing benchmark, physical-device check, or mobile validation was performed. The zfight suite checks the existing box-world representation; the module pilot received visual inspection rather than a new analytic face-pair assertion.
- **Next approval-gated step:** obtain owner approval before extending the kit beyond the nine pilot lots. Investigate a UV-preserving optimizer path only if another optimization phase is approved.

## 2026-10-29 — Townhouse night-window lighting fix

- **Fix:** `f73f34de23aa06b155345a0e56c2013c2db3679b` restores the existing deterministic emissive-window assignment to modular townhouse glazing; `6ba6389d4182177316aec5796b3539a51d1d6ea2` records fix evidence.
- **Verification:** desktop `building-slice.browser.py` passed with 17 lit panes / 2,244 lit-glass vertices; a desktop night capture at stop 13.5 showed warm lit panes. `node --test tests/` rerun after the fix: 116/116 passed (existing `MODULE_TYPELESS_PACKAGE_JSON` warning only). Scoped fix review found no new breakage.
- **State:** working tree clean after this entry is committed; branch remains local and the preview server is stopped. No mobile checks or deployment.
- **Next step:** use the nine-lot pilot as the approved scope. Further rollout and any UV-preserving asset optimization require a new owner decision.

## 2026-10-29 — London Eye townhouse correction and Phase 4 tree LOD

- **House:** the initial attempts removed unrelated lots (`41b6f17`, `60ed913`, `5e1a25a`, `26f5e08`). A desktop raycast matched the marked yellow townhouse to `frontage-gap-olm-135--1--9` in `architecture-cell-96--32`. The final fix `75f85ef` excludes only that ID; it restores the eight unrelated `block-120--80-*` and `lot-front-105--81.5-*` houses.
- **House verification:** desktop `citywide.browser.py` passes, asserting the exact target emits no geometry in both renderer modes and nearby houses remain. A/B desktop capture at stop 10 shows the marked house removed. No mobile checks.
- **Trees:** commit `429c2ea` adds per-160 m chunk LOD0/LOD1/LOD2. LOD2 is a two-triangle camera-facing billboard using a procedural 512×128 atlas; LOD transitions use AABB distance with hysteresis. Existing lamp/phone-box instancing and merged park furniture remain unchanged. No Blender tree/prop GLB or public-prop atlas was added; that remains a Phase 4 gap if the owner wants authored props.
- **Verification:** desktop browser contracts passed for `building-slice`, `townhouse-lod`, `citywide`, and `trees`; `node --test tests/` passed 116/116 (pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warnings). Desktop captures at stops 9.5 and 11 by day were inspected. No mobile tests, deployment, or push.
- **Environment:** the local preview remains running at `http://localhost:8000` because the owner asked to keep it available for testing.
- **Next step:** if Phase 4 continues, author and review a public-realm prop atlas as a separate vertical slice; current props already use instancing or shared geometry batches.

## 2026-10-29 — Claude handoff refresh

- **Handoff:** commit `1f4f572` adds `docs/handoff/claude-handoff-2026-10-29.md` with current branch/runtime state, exact London Eye house root cause and fix, verified desktop-only checks, guardrails, and a copy-ready prompt for Claude.
- **State:** `feat/site-gamefication` was clean at `4d8ef2c` before this documentation change. Preview server remains running at `http://localhost:8000`; no code, tests, deployment, push, or mobile work was performed for this handoff.

## 2026-10-29 Claude continuation (owner approved all 5 next steps)

- **Step 1, tests fixed (`0053563`):**
  - `underpass` was a real bug: parks and trees ignored the overpass corridor. Fixed in `city.js` via `onOverpass` for trees and `buildParks(addOff)`.
  - `london-cab`: `castShadow` could be undefined; now a boolean.
  - `hero-facades`: stale test, rewritten to build plots via `buildCity`.
  - `zfight` now also checks yawed boxes with an oriented-rectangle test (6,088 yawed boxes, 0 pairs).
- **Step 2, townhouse kit (merge `6427f99`, cache bust `26a8d83`):**
  - The kit now covers 343 UK terraced townhouses (was 9 pilot lots).
  - Lazy per-cell kit LOD0 is built within 140 m and dropped beyond 180 m. Variants are hash-driven. `?kit=off` is the rollback.
  - Kit rebuilt with 1-segment bevels: 1.81 MB -> 0.53 MB.
  - Measured calls +1.3% / +0.8% / 0% and triangles +1.9% / +1.1% / +0.8% at stops 9.5 / 10 / 11.
  - Simulated sweep peak: 183 MiB resident, about 3 MiB over the 180 MiB ceiling in `tests/citywide.browser.py` (sweep only).
- **Step 3, trees (`79a7951`, merge `184cd8d`):**
  - Five crown families (round, columnar, spreading, flowering, conifer) chosen from region (`treeRegion` in `layout.js`) and a stable position hash, with per-region palettes and per-family LOD2 impostor tiles.
  - Fixed black LOD2 billboards (vertex colours without a colour attribute).
  - 333 -> 322 trees; the overpass corridor filter removed 11.
  - Canopy 198k triangles (budget 250k).
- **Step 4, street props (`299e35e`, merge `4df0a11`):**
  - New `js/world/street-props.js` and `street-props-mesh.js`: 226 instanced props (128 bollards, 45 UK Belisha beacons that glow at night, 38 bins, 2 BR hydrants, 6 UK hydrant marker posts, 7 bike racks).
  - Covered by `tests/street-props.browser.py`.
  - Lamps are already instanced (196 lamps, 4 calls, about 0.4% of triangles) and benches are batched, so no extra LOD was added.
  - Cost at stop 5: about +26 to 31 draw calls and about +70k triangles per frame.
- **Step 5, shop and midrise kits (`b36cef2`, merge `da56e40`, cleanup `463cd3f`):**
  - Blender-authored shop kit (27 modules) and midrise kit (25 modules) via `tools/buildings/{shop-kit,midrise-kit,kit-common}`.
  - Covers all 18 rollout shops and all 217 midrises. Procedural geometry stays as LOD1.
  - Modules are at most 0.19 m deep (lot margin).
  - Office, tower and townhouse paths are untouched. Hero shops `block--295--34` and `block--282--34` keep their bespoke path.
  - Rollback: `?kits=0` or `createCityBuildings(plots, {kits: false})`.
  - Cache-bust params: `?v=2` (townhouse kit), `?v=1` (facade kits).
  - Calls within +/-1%; triangles up to +0.8% at stops 3 / 5 / 9.5 / 10.
- **Known issues / not verified:**
  - `tests/final-art.browser.py` fails: the 'bounded vegetation batches' check sums LOD0 + LOD1 chunk batches (24 vs 12). It already failed before the tree work because of an earlier LOD change; the assertion is stale.
  - LOD switch popping and z-fighting at switches were not checked in motion.
  - London and Glasgow shop crops were not inspected.
  - Variety was judged by eye only.
  - Frame times (p95) were not measured; only calls and triangles, via a WebGL hook.
  - The shared user Chrome hung under load during final verification, so the final capture and console check ran in an isolated headless Chrome (console: 0 errors day and night).

