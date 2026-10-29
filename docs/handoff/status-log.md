# Handoff status log

## 2026-10-29 — Codex continuation

- **Repository:** `feat/site-gamefication` is clean at `8e23dbc` and matches `origin/feat/site-gamefication`. `8e23dbc` adds the 2026-10-29 handoff document on top of `cdff284`; the handoff's stated HEAD is therefore one commit behind, and its “none pushed” note is stale for the current tracking ref. No history was rewritten.
- **Scope:** read the handoff, `CLAUDE.md`, and the current city references (`3d-city.md`, `rendering-budget.md`, `art-direction.md`). No implementation, asset, or visual changes made in this continuation.
- **Graphics TODO:** the handoff records Phases 1–4 as complete and Phase 5 (mobile) as intentionally skipped. The visual atlas predates those later graphics commits. The graphics TODO's GLB-pedestrian item is stale: that experiment was abandoned, and its future direction remains undecided.
- **Asset pipeline observed:** Phase 0 tooling, Phase 1 processed vehicle assets, and Phase 2 Big Ben assets/runtime are present in the current tree. The project architecture page still says “plan, nothing implemented”; the roadmap still presents Big Ben as a future POC and processed loading as flag-gated. The handoff's Big Ben triangle figures also differ from the committed baseline; reconcile those records before treating either set as authoritative. Sketchfab/NC-SA sourcing approval is recorded in the handoff and `ASSET_SOURCES.md`, while older architecture text still frames sourcing as an open decision.
- **Carry-forward issues:** the handoff reports failures in `tests/underpass.browser.py`, `tests/london-cab.browser.py`, `tests/hero-facades.browser.py`, and `tests/world.browser.py`; it also says `tests/zfight.browser.py` skips yawed boxes. These were not rerun here. The handoff reports 116/116 Node tests at its stated implementation handoff; no tests were run in this continuation, per instruction.
- **Environment:** local server was stopped; no browser capture, test, deployment, or mobile work was performed.
- **Next step:** wait for explicit owner approval before starting Phase 3 (the townhouse modular kit). Further landmark phases, Phase 6 lighting, moving/deleting raw GLBs, CI, and the pedestrian experiment also remain approval-gated as described in the handoff.

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

- **House:** the first removal targeted Glasgow's `block-679--80-0` by mistake (`41b6f17`). After the owner supplied the London Eye reference, commit `60ed913` restored that Glasgow pilot lot and excludes only `lot-front-105--81.5-2` in `createCityBuildings`; all source plot descriptors and surrounding layout remain.
- **Trees:** commit `429c2ea` adds per-160 m chunk LOD0/LOD1/LOD2. LOD2 is a two-triangle camera-facing billboard using a procedural 512×128 atlas; LOD transitions use AABB distance with hysteresis. Existing lamp/phone-box instancing and merged park furniture remain unchanged. No Blender tree/prop GLB or public-prop atlas was added; that remains a Phase 4 gap if the owner wants authored props.
- **Verification:** desktop browser contracts passed for `building-slice`, `townhouse-lod`, `citywide`, and `trees`; `node --test tests/` passed 116/116 (pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warnings). Desktop captures at stops 9.5 and 11 by day were inspected. No mobile tests, deployment, or push.
- **Environment:** the local preview remains running at `http://localhost:8000` because the owner asked to keep it available for testing.
- **Next step:** if Phase 4 continues, author and review a public-realm prop atlas as a separate vertical slice; current props already use instancing or shared geometry batches.

