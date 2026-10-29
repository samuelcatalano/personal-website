# Codex handoff: 3D city graphics + Blender asset pipeline (2026-10-29)

You are continuing work that Claude (Opus/Sonnet 5.5) was doing with the owner, Samuel Catalano. Claude will take the work back later, so leave the repo and the status log in a state it can resume from. Read this whole file first, then `CLAUDE.md` (= `AGENTS.md`, symlink) and the three references it lists. Do not redo discovery that is already documented.

## 0. Ground rules (owner's standing instructions)

- Reply to the owner in **pt-BR**, concise. Code, comments and commits in **English**. Commit per milestone after the related tests pass. **Never push** unless the owner asks. Never `git reset/restore/clean/stash`; preserve any unrelated working-tree changes. Branch: `feat/site-gamefication` (HEAD at handoff: `cdff284`; `main` is the deployed old site and must not receive this work).
- End commit messages with a `Co-Authored-By:` line for yourself, not Claude's.
- Desktop only: the owner explicitly said to **ignore mobile optimisation and mobile tests** for now. No tests/deploy work unless asked; the current focus is visual quality.
- Subagent/model economy rules in `CLAUDE.md` are Claude-specific; follow your own workflow but keep reads targeted and outputs short.
- Safety: no purchases, no accounts, no credentials, no paywall/login bypass, no VPN/proxy tricks, no uploading the owner's content anywhere. Never publish the home address or phone number from the CV.
- Asset policy (owner decision 2026-10-27): CC0/permissive preferred; **Sketchfab and NC/SA assets are allowed only with the owner's approval of the specific asset**, recorded in `ASSET_SOURCES.md` with licence obligations. Ambiguous licence = do not use. Reference photos are visual reference only.
- Map, lot footprints/heights, routes, landmark sightlines are frozen unless the owner authorises a change (they authorised: road widening with parking lanes, Estaiada ramps, concrete overpasses).
- Claude's "weekly usage cap" the owner set is a Claude session limit; it does not apply to you.

## 1. Project in one paragraph

Static site (GitHub Pages, no build step, no npm in the shipped site): a Three.js 0.169 (pinned jsDelivr importmap) 3D city where a bus drives through São Paulo, London and Glasgow as the visitor scrolls. The HTML panel is the content source of truth; WebGL off and reduced motion must keep working. Landmarks/vehicles/buildings are mostly procedural plus authored GLBs.

## 2. Working tools

```bash
python3 -m http.server 8000                       # local preview (currently stopped: start it in the background, never twice)
node --test tests/                                # Node regression: 116/116 pass at handoff
OUT=<dir> SHOTS="9.5:day,9.5:night" QUERY="weather=clear" GRID=1 WAIT=10 browser-harness < tools/capture.py   # scene capture (tools/capture.py header documents env)
```

- Stops: 5 São Paulo (MASP/Estaiada), 9.5 London (Big Ben/Eye), 11 Glasgow. `?weather=rain|clear` forces weather (otherwise rolled per visit and per region). `?glb=raw` forces raw vehicle GLBs; `?landmarks=procedural` forces the procedural Big Ben.
- Capture hygiene: one Chrome at a time. A hidden tab renders blank; `tools/capture.py` re-fronts the tab per shot. Disable cache in test tabs (`Network.setCacheDisabled`) or you will see stale modules and false failures. Check a capture is not blank (grayscale std dev > 20) and look at it.
- Browser tests run as `browser-harness < tests/X.browser.py` in a fresh cache-disabled tab (pattern: `new_tab('about:blank'); activate_tab(...); cdp('Network.enable'); cdp('Network.setCacheDisabled', cacheDisabled=True); goto_url('http://localhost:8000/'); wait_for_load(); exec(open('tests/X.browser.py').read())`).
- Pipeline tools (dev only, never deployed): `tools/pipeline/` (`README.md` there). `@gltf-transform/cli` 4.5.1 is pinned in `tools/pipeline/package.json` (`npm install` there). The `ktx`/`toktx` 4.4.2 binaries live in git-ignored `tools/pipeline/bin/` and `tools/pipeline/lib/` (re-create from the signed Khronos pkg if missing, steps in the README; the `sudo installer` route was killed by macOS, the expand-and-copy route works). Blender 5.2 LTS at `/opt/homebrew/bin/blender` (headless `-b --python`).

## 3. What has been done (all committed locally, none pushed)

**Graphics TODO** (`docs/plans/2026-10-27-graphics-todo.md`; owner asked for Phases 1-4, Phase 5 mobile skipped):
- Phase 1: hero frame edge/ground (`afd1a59`), round dense trees + avenue rows (`ffbd12f`), plaza paving/planters/stalls (`836423d`, `e6980d5`), denser regional traffic + parked cars (`c641338`), regional bus liveries + no overlaps (`8d9d5dd`), **road widened with parking bays on both sides** (`789f43d`, single `ROAD` constant in `js/world/layout.js`, bays in `js/world/bays.js`), z-fighting sweep (`f6b1430`), yawed continuous kerbs/slabs (`81891bb`), zebra line cuts (`5c00ec1`, `2483767`).
- Phase 2: layered unfogged skyline (`js/world/skyline.js`), per-building glass/roof variety (`02ca669`), seeded regional clouds (`6781eb4`).
- Phase 3: sky-tinted puddles (`56cf91f`), night lamps/halos/headlight cones/asphalt (`f588e7d`, `4a05bf5`).
- Phase 4: lighter day asphalt (`2a014f7`).
- Vehicles: London cab TX4 (`d48a73c`, CC-BY, Nieve5677), DD bus + London red + **First Glasgow livery** (`aed9a86`, `6e2b9e2`, `b0db502`; Glasgow bus in Glasgow only via `reskinBus`), automotive glass/paint pass (`648469a`), hero Mini↔London bus **scale morph** (`4f9fc8c`), ambient vehicles fade **only** at screen edges/hero swap (`d41416e`; owner rejected the dither fade), road overpasses with two-way traffic and no rails, concrete, no houses on them (`7eed8b7`, `59f4169`), Estaiada bridge without trees (`db26023`).
- Earlier (before this handoff, also in history): sky/clouds/moon/rain/wet surfaces (yours), pedestrians proportions, A330, Estaiada ramps.

**Blender asset pipeline** (`docs/architecture/blender-asset-pipeline.md`, roadmap `docs/plans/3d-asset-pipeline-roadmap.md`; the owner approved the plan and Big Ben as the first POC):
- Phase 0 (`f924735`, `f5cc4f8`): `tools/pipeline/{check.mjs,budgets.json,README.md}`; baselines `baseline-2026-10-29*.txt`. `node tools/pipeline/check.mjs` reports bytes/tris/materials/textures per GLB, unreferenced GLBs and budget breaches.
- Phase 1 (`989a919`, `ce2f6d9`, `2f3fb85`): `tools/pipeline/optimise.mjs` (weld/dedup/prune/simplify/reorder + Meshopt). Processed GLBs in `assets/processed/vehicles/` (+ `manifest.json`), loaded **by default** with the raw GLB as automatic fallback (`js/world/vehicle-assets.js`, `PROCESSED`, `PIPELINE_V`). Mini 19.6→2.0 MB, fleet total 80→19 MB. Honda HR-V (47 MB) left raw: its triangles share no vertices so it cannot be simplified.
- Phase 2 (`8508839` + retunes `114c114`, `b24569b`, `a73614d`, `98ed25a`, `718447b`, `4ec0f6a`, cache bumps up to `cdff284`): authored **Big Ben + Westminster frontage** built by `tools/landmarks/bigben/build_bigben.py`; `tools/pipeline/landmark.sh` does KTX2 (ETC1S) then Meshopt; processed `assets/processed/landmarks/bigben.lod{0,1}.glb` (LOD0 11.6k tris/740 KB, LOD1 3.3k/536 KB, one atlas material, baked AO and emissive). Runtime: `js/world/glb-loader.js` (Meshopt + KTX2, transcoder resolved through the importmap), `js/world/bigben-asset.js` (LOD swap 140/170 m with hysteresis, `GLB_V` cache bust, procedural Big Ben kept hidden as fallback, `metalness 0.2` because the scene has no env map), `sky.track()` for late glow materials, `tests/bigben-asset.browser.py`. The owner reviewed and approved the final look ("100%").

## 4. Pitfalls already learned (do not rediscover)

- gltf-transform 4.x shells out to **`ktx`** (not `toktx`); slot globs need braces, e.g. `--slots "{baseColor,emissive}*"`; the CLI rewrites files **without** Meshopt, so `optimise.mjs` must be the **last** writer.
- Do **not** quantize vehicle GLBs and do **not** dedup materials: runtime shaders read metre-space positions (lowAO) and the fleet catalog/wheel splitting address materials by source names. Unwelded flat-shaded sources need `smooth` mode then a re-weld so index-based wheel splitting works.
- Static hosts cache GLBs: bump `PIPELINE_V` (vehicles) or `GLB_V` (Big Ben) whenever processed files are regenerated.
- A material with full metalness renders black without an env map (only vehicles get the PMREM env).
- Tab hidden → blank captures; stale module cache → false test failures (trees budget, fleet).
- Subagent worktrees created by the harness from `main` lack the 3D code: create worktrees manually from `HEAD`.

## 5. Known open issues (not caused by the pipeline work)

- Browser tests failing at handoff: `tests/underpass.browser.py` (box overlaps near v≈-28, pre-existing), `tests/london-cab.browser.py` ("only cab shell casts shadows", introduced when the cab/fleet were reintegrated), `tests/hero-facades.browser.py` (reads an undefined `window.__cityAudit`), `tests/world.browser.py` (times out). `tests/zfight.browser.py` passes but **skips yawed boxes** (kerbs/slabs), so those are unchecked.
- GLB pedestrian experiment was abandoned and its files moved to `~/.Trash/personal-website-glb-pedestrians-20261028-030017/`; the spec/plan docs `docs/superpowers/*/2026-10-27-glb-pedestrians*` remain. Pedestrian quality (grade B-) is still an open item the owner has not re-decided.
- Small vehicle leftovers: Mini headlamp black wedge, bus doors flush instead of recessed, bus ~0.4 m longer than the previous one.
- `assets/vehicles/mini-cooper.glb` (F56, 3.4 MB) is no longer referenced; raw vehicle GLBs (and `a330`, `sao-paulo-bus`, DD bus) still exceed triangle budgets in `check.mjs`.
- Parked cars sit in bays on both kerbs; SP has few spots because of route bends.

## 6. Next steps (propose, then wait for the owner's go before each phase)

1. **Phase 3, modular building kit** (roadmap section): one archetype end to end (townhouse), authored window/door/cornice/roof modules in Blender, deterministic bay assignment, decide instancing vs merged buckets by measuring draw calls/memory; keep the existing LOD0/LOD1 hysteresis and the "mass/trim/glass" bucket rule; rollback = procedural recipe behind a flag. Needs the owner's explicit approval to start.
2. **Other hero landmarks** through the proven chain (Tower Bridge, Sé, Riverside Museum, Wembley, London Eye pods): same Blender → `landmark.sh` → loader pattern as Big Ben; one landmark per round, owner reviews day/night in scene.
3. **Vehicle clean-up:** rework Honda HR-V in Blender (or drop it), process the SP bus, decide on the unreferenced F56 file, then move/delete unreferenced raw GLBs (owner approval needed before deleting or moving to `sources/`).
4. **Phase 6 (lighting):** HDRI/PMREM env for landmarks (would let gold stay metallic), GTAO on the high tier only, AgX vs ACES decision with A/B images.
5. Fix or retire the failing browser tests listed above, then add a `--strict` budget gate and (later, separate approval) a CI check.
6. Measure what was never measured: frame p95 and renderer calls/tris before/after for the Big Ben and processed vehicles (the in-page `requestAnimationFrame` probe was unreliable in the harness; use the WebGL draw-call hook approach or a stable headless Chrome).

Pending owner decisions (ask, do not assume): `sources/` directory layout for raw files, moving/deleting raw GLBs, CI, the fate of the pedestrian GLB work, Sketchfab rule for the pipeline (currently "allowed per asset with approval").

## 7. Before you stop

Append a dated section to `docs/handoff/status-log.md` (create it if missing): what you did, commit hashes, tests run and their results, known problems, and what Claude should do next. Commit it. Keep the working tree clean and leave the local server stopped.
