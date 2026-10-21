# 3D City — Claude Handoff

Handoff date: 2026-10-21. Continue communicating with the user in Portuguese.

Read this file, `AGENTS.md` (symlink to `CLAUDE.md`), then the current architecture/art/budget references. The visual design is approved and frozen. This handoff is not authorization to implement a fix during the closing Codex task, or to push/deploy.

## 1. Current status

| Gate | Current result |
|---|---|
| VISUAL | **GO** — approved by the user; final smoke views preserve it |
| PERFORMANCE | **GO in the tested runtime** |
| FUNCTIONAL | **NO-GO** — consolidated browser gate fails |
| PRODUCTION-READY | **NO** |

**Current blocker:** the z-fighting guard reports **327 coplanar face pairs** in its generated fixture. A separate probe reports **191 pairs in live production box batches**, including public realm/planter geometry. **31/32 browser suites passed;101/101 Node tests passed.** No waiver or geometric correction was applied. Do not describe this state as production-ready.

Other UI/route/fallback/reduced-motion contracts passed; that does not override the failing consolidated gate. These counts are geometric guard findings, not a count of independently observed visible flickers.

## 2. What has been implemented

- Procedural real-time 3D city in the existing static portfolio; native ES modules and pinned Three.js0.169.0. No npm/build step or replacement renderer.
- Distinct townhouse/terrace, shop/mixed low-rise, midrise, office and tower geometry. These are approved families, not townhouses stretched to different heights.
- Deterministic architectural variation: recipes, bays, entries/storefronts, plaster/brick balance, roofs/crowns, palettes and window/emissive states. Towers have straight, stepped and asymmetric silhouette families; the initial Hero Zone shops have four composition families.
- Spatial32×32 chunking/merging into mass/trim/glass buckets; shared architectural materials/maps and metric UVs/vertex colors/`aSurface`.
- Cached LOD0/LOD1 where supported, AABB hysteresis, standard per-pass Three.js frustum culling and owned-geometry disposal.
- Compatible citywide rollout, controlled diversity/completion, cheaper distant backdrop and explicitly retained special plots.
- Hero public realm, coherent paving/curbs, furniture/planters, rounded vegetation/low understory and final lighting/atmosphere pass.
- Shared opaque analytic glass reflection and continuous tinted water with restrained wave/highlight motion; no SSR, realtime cubemaps or new heavy passes.
- Landmark geometry modernization: **Wembley**, **Big Ben/Parliament**, **MASP**, preserving anchors and envelopes. Dedicated merged geometry reuses the existing atlas; Big Ben keeps its four clock faces.

**Known accepted visual limit:** London Eye remains segmented. Do not change it as part of this continuation.

## 3. Final citywide architecture

```text
plot
→ archetype classification
→ deterministic recipe
→ geometry family / archetype-specific local geometry
→ spatial chunk
→ mass / trim / glass
→ merged batches + shared materials/maps
→ supported LOD
→ per-pass culling
→ render
```

Existing lot data remains the source of truth: ID, kind, position, footprint and maximum height. Generators expose descriptors through callbacks while preserving layout RNG consumption. `building-kit.js` keeps approved controls/allowlists, then dispatches compatible plots through `city-rollout.js`. Unclassifiable special plots retain their existing representation. Production replaces each chosen plot once; never layer a second building over it.

Archetypes retain their own geometry builders. The shared pipeline does not mean a universal building mega-builder. Landmarks/public realm retain appropriate dedicated rendering. Ordinary architecture totals483 descriptors plus8 decorative Paulista envelopes;439 ordinary +6 decorative envelopes use the citywide pipeline,35 previously approved buildings are retained controls, and11 special generic lots remain preserved.

## 4. Important architectural rules

- Preserve footprint and height envelope, IDs and source lot data. Do not move landmarks or modify map, routes, pedestrian circulation, camera or skyline composition.
- Share materials/maps; avoid material/texture/uniform clones per building. Variation belongs in stable vertex/recipe data.
- Batch spatially by chunk, preserving mass/trim/glass policies and all geometry attributes/bounds. Never replace batching with building-count × three meshes.
- Architecture mass (including principal roofs) casts shadows; trim/glass do not. Do not turn trim/glass into extra shadow casters via an indiscriminate merge.
- Compute architectural exposure from actual neighbors before chunk partitioning; chunk borders are not party-wall boundaries.
- Variation is deterministic and does not consume layout RNG. Preserve diversity; do not homogenize the city into clones.
- LOD switch changes the geometry on stable meshes **before any render pass**. Do not rebuild/merge on a switch, clone materials, crossfade or render both LODs simultaneously. Dispose active and inactive owned geometry once; shared materials are not chunk-owned.
- Existing distance is camera-to-chunk AABB: initial <120 → LOD0, otherwise LOD1; outward >129 → LOD1; inward <111 → LOD0;111–129 retains the level. No LOD2. Only supported townhouse detail currently simplifies; other families keep their detail in cached states.
- Standard `frustumCulled=true` and geometry bounds remain. Do not reuse camera visibility to suppress light-frustum shadows; no `group.visible=false` camera-only gate.
- Preserve existing renderer/postprocessing/light budgets. No new engine/framework/assets/renderer architecture without a concrete need and explicit authorization.
- Preserve other working-tree edits. Never use destructive `git reset`, `git restore` or `git clean` to clear somebody else's work.

## 5. Current scale / metrics

Latest recorded milestone, **not a new measurement during this handoff**:

| Scenario | Median | p95 | Full-pipeline calls/frame | Submitted triangles/frame | Resident renderables | Unique materials/textures |
|---|---:|---:|---:|---:|---:|---:|
| Desktop high,1440×900, DPR1.5, day |16.7ms|17.7ms|493–536|857,365–858,989|932|148/25|
| Mobile medium emulated,375×812, DPR1, day |16.7ms|17.6ms|168–180|234,554–235,066|929|148/25|

- **488 architectural mesh objects** were preserved in the last visual validations. Citywide groups contribute148 occupied cells/444 meshes; controls/special groups are additional.
- Architecture shares **2 materials/4 maps/~4.33MiB**. Do not confuse that with the whole scene's148 materials/25 referenced textures.
- Citywide groups contain530,826 unique LOD0 triangles/~94.07MiB cached attribute payload. Submitted multi-pass triangles in the table are a different measure.
- Both measured scenes contained294 InstancedMeshes and580 geometry objects. Cloud counts vary across reloads; resident objects are not all visible submissions.
- Clean desktop p95 across the final passes was approximately17.7–18.5ms; emulated mobile approximately17.6–18.6ms. Zero console errors in final validations.
- Samples:2s warmup +10s sampling, fixed high/medium tiers in temporary validation snapshots; Chrome155 Headless/ANGLE Metal on AppleM3Max. Some earlier runs had substantial outliers; all retained evidence records them.

These are operational browser/WebGL frame intervals, including scheduling and host load. They are **not scientific/calibrated A/B results**, isolated GPU timings, physical VRAM measurements or universal FPS guarantees. Physical mobile has not been validated. Lighthouse was not rerun at the final milestone.

## 6. Validation status

**PASS at the final milestone:**

- 101/101 Node tests.
- 31/32 browser suites (the other suite fails, not skipped).
- Syntax:54 ES modules/32 Python suites; no build step exists.
- `git diff --check`.
- Five visual smoke views: main, skyline, Wembley, London, MASP.
- Console clean; real day/night glass uniforms reach1/0.
- UI navigation, EN/PT, WebGL fallback, reduced motion, resize, lot/batching/resource/LOD and route-clearance contracts.

**FAIL:** `tests/zfight.browser.py` —327 coplanar pairs. A live-scene diagnostic also finds191 pairs in production box batches. Production readiness remains **NO**.

Final validation evidence on this machine (supporting evidence, not runtime dependencies):

`/Users/samuel.catalano/.codex/visualizations/2026/10/19/01a153a6-7011-7870-8f7b-5467c83be5a6/city-final-milestone-freeze-2026-10-21/`

Useful files there: `browser-tests.json`, `zfight.log`, `coplanar-production.json`, `metrics.json`, `node-tests.log`, `scope-audit.json`, `theme-smoke.json`, five PNGs and `README.md`. The saved diagnostic contains counts and representative pairs, **not a fully classified list of all327 causes**. Reproduce/export the complete failing-pair list when investigating. The current source/test alone can reproduce the guard; machine-local artifacts are optional evidence.

## 7. Current blocker — z-fighting

The guard scans box records produced by the existing builders, including city/landmarks/vehicles, for same-direction coplanar top/side faces of **different colors** with overlap >0.02 and plane tolerance0.001. It was made to finish by sorting X intervals and skipping impossible candidate pairs; its face predicates and hard failure remain intact. Do not relax those predicates to obtain green tests.

The327 fixture count and191 live-scene count come from different assembly paths. The fixture uses generator fallbacks; production uses plot/tree/public-realm callbacks and dedicated geometry. Inspect both, rather than treating either total as an exhaustive rendering proof. The guard does not cover arbitrary triangle intersections in the merged architectural geometry.

**Concrete first lead:** `buildParks()` in `js/world/parks.js`, the flower-bed loop. The soil strip and stone rim can share outer planes:

```js
B(u, v, 0.05, 2.6, 0.12, 1.2, SOIL);
for (const f of [-1, 1]) {
  B(u, v + f * .54, .05, 2.6, .16, .12, STONE);
  B(u + f * 1.24, v, .05, .12, .16, .96, STONE);
}
```

One production example: soil centered(-215.50896777049638,-25.467321390286088), y0.05,2.6×0.12×1.2, color `#86603e`; a stone rim centered at the same X/Z−0.54,2.6×0.16×0.12, color `#9b9b99`. Their outer side planes overlap. The helper transforms local U/V into world coordinates. This identifies a real shared-builder lead, **not proof that every remaining pair has that cause**.

Recommended investigation/fix strategy for the subsequent Claude task:

1. Export/classify all327 pairs by builder, record type, face orientation and production presence.
2. Find root causes; fix shared generation instead of editing individual coordinates per planter/lot.
3. Correct geometry at its source; remove duplicate/hidden faces where practical.
4. Resolve adjacent edges/bounds that share unintended planes while preserving the approved visible surface, footprint, scale and circulation.
5. Use a small geometric offset only where separation is actually required; avoid global `polygonOffset` or shader/material changes masking the issue.
6. Keep the guard active and demanding. Do not exclude public realm/builders wholesale, disable errors or merely increase overlap tolerance.

Target: **zero problematic coplanar production pairs**, or a minimal, explicit allowlist only for intentional cases with a technical justification and regression coverage. The two headline totals remain unresolved in this handoff.

## 8. Suggested Claude first task

> **Investigate and fix the z-fighting guard failure without changing the approved visual result.**
>
> Read this handoff and current rules. Start from the327-pair report and191-pair production probe; reproduce and group by root cause. Prioritize shared builders, starting with the confirmed parks.js soil/rim case. Preserve approved buildings, landmarks, layout, camera, lighting, materials and batching. Run the failing guard first; after a bounded source fix, run relevant browser regressions; only then run full relevant validation and compare the same five smoke views. Keep the test strict. Do not add visual features, another polish pass, citywide rollout, new assets/frameworks or broad performance optimization. Report any genuinely new architectural conflict before changing the established design. No push/deploy without authorization.

This is a prepared follow-up task, not work performed by the closing Codex session.

## 9. Files / modules to inspect first

All paths below exist in this repository:

| Area | Files |
|---|---|
| Failing guard / likely source | `tests/zfight.browser.py`, `js/world/parks.js` |
| Box records / scene assembly | `js/world/voxel.js`, `js/world/city.js`, `js/world/scene.js`, `js/world/layout.js` |
| Plot dispatch / citywide integration | `js/world/building-kit.js`, `js/world/real-city.js`, `js/world/city-rollout.js` |
| Townhouse geometry / recipes / chunk LOD | `js/world/building-slice.js` |
| Archetype-specific geometry | `js/world/shop-slice.js`, `js/world/midrise-slice.js`, `js/world/office-slice.js`, `js/world/tower-slice.js` |
| Hero / public realm | `js/world/hero-realm.js`, `js/world/hero-integration.js`, `js/world/hero-background.js` |
| Materials | `js/world/building-slice-materials.js`, `js/world/glass-reflection.js`, `js/world/textures.js`, `js/world/palette.js` |
| Other plot generators / background | `js/world/blocks.js`, `js/world/country.js`, `js/world/glasgow.js`, `js/world/backdrop.js` |
| Landmarks | `js/world/landmarks.js`, `js/world/landmark-geometry.js`, `js/world/landmark-materials.js`, `js/world/saopaulo.js`, `js/world/riverside.js`, `js/world/university.js` |
| Frozen environment | `js/world/trees.js`, `js/world/sky.js`, `js/world/mood.js`, `js/world/water.js`, `js/world/post.js` |
| Focused regression | `tests/parks.test.mjs`, `tests/public-walks.browser.py`, `tests/hero-realm.browser.py`, `tests/final-art.browser.py`, `tests/citywide.browser.py`, `tests/landmark-geometry.browser.py` |
| Other integration | `tests/architecture-migration.test.mjs`, `tests/building-kit.browser.py`, `tests/real-city.browser.py`, `tests/townhouse-lod.browser.py`, `tests/world.browser.py`, `tests/interface.browser.py` |

Current references: `docs/architecture/3d-city.md`, `docs/architecture/rendering-budget.md`, `docs/art-direction.md`, `docs/product/3d-city-north-star-prd.md`, `docs/architecture/3d-city-rollout-tdr.md`, `docs/plans/3d-city-fast-track-roadmap.md`, `docs/TRD.md`. Older specs/plans under `docs/superpowers/` are history, not a new execution queue.

## 10. Commands for Claude

Run from the repository root. There is **no project package.json, npm script, dependency installation or build step**. Node tests use the standard test runner; browser suites are Python snippets executed by the installed `browser-harness`, not standalone Python test files.

Preview (currently one server is already serving the live working tree on8000; do not start a duplicate):

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory "$PWD"
```

Browser prerequisite: a running Chrome/Chromium with an authorized CDP connection. Use the installed browser-harness skill (`/Users/samuel.catalano/.codex/skills/browser-harness/SKILL.md`). A named isolated daemon/profile was used for earlier validation; it was shut down. Do not attach to another task's daemon or close the user's browser. For connection diagnosis:

```bash
browser-harness --doctor
```

Select/open the live preview before running a suite:

```bash
browser-harness <<'PY'
new_tab('http://localhost:8000/')
wait_for_load()
PY

# Expected to fail with327 pairs until the subsequent fix:
browser-harness < tests/zfight.browser.py

# Relevant browser regression after that fix, on the same local preview:
for suite in public-walks hero-realm final-art citywide landmark-geometry landmarks; do
  browser-harness < "tests/$suite.browser.py" || break
done
```

For expensive async contracts, CDP's synchronous RPC can time out before the contract completes. The following is the same deferred-evaluation/polling approach used in the final milestone; it retains actual test assertions and exceptions. Run it instead of treating an RPC timeout as a passing test. Initially keep only `zfight` in the list; expand to relevant suites after the fix.

```bash
browser-harness <<'PY'
from pathlib import Path
import json, time
raw_js = js

def contract_js(expression):
    if 'async' not in expression and 'Promise' not in expression:
        return raw_js(expression)
    raw_js('window.__handoffResult=null;setTimeout(()=>{' +
           'Promise.resolve().then(()=>(' + expression + ')).then(' +
           'value=>window.__handoffResult={value},' +
           'e=>window.__handoffResult={error:String(e.stack)})},0);true')
    for _ in range(90):
        time.sleep(.4)
        result = raw_js('window.__handoffResult')
        if result:
            if 'error' in result:
                raise RuntimeError(result['error'])
            return result.get('value')
    raise RuntimeError('Browser contract timeout')

js = contract_js
for suite in ['zfight']:
    exec(Path('tests/' + suite + '.browser.py').read_text(), globals())
PY
```

For the full32-suite consolidation, use the actual files from `tests/*.browser.py`; reload the page between batches to avoid retaining generated worlds/geometries. One special fixture is required: `tests/hero-facades.browser.py` reads `window.__cityAudit.plots`. Populate that **only in the test page**, from the real generator, before executing it:

```js
(async () => {
  const T = await import('three');
  const { stops } = await import('./js/content.js');
  const { routePoints, routeCurve } = await import('./js/world/layout.js');
  const { buildCity } = await import('./js/world/city.js');
  const pts = routePoints(stops.length), plots = [];
  buildCity(() => {}, stops, pts, routeCurve(T, pts), undefined, undefined,
    plot => plots.push(plot));
  window.__cityAudit = { plots };
})();
```

There is intentionally no `__cityAudit` API in production. Historical `/private/tmp/city-final-freeze/site` and its runner were instrumented snapshots: **do not validate a new fix against that stale snapshot**. Recreate any required instrumentation outside the source tree using the new code. The milestone's interface run retained its assertions and omitted extra screenshot-only calls; only the five agreed smoke views were captured.

Node, syntax and whitespace checks:

```bash
node --test tests/*.test.mjs

python3 - <<'PY'
import ast, subprocess
from pathlib import Path
for path in Path('js').rglob('*.js'):
    subprocess.run(['node', '--input-type=module', '--check'],
                   input=path.read_bytes(), check=True)
for path in Path('tests').glob('*.py'):
    ast.parse(path.read_text(), filename=str(path))
PY

git diff --check
```

For a later justified performance comparison, preserve the approved desktop/mobile settings in section5 and the same shot,2s warmup/10s sample. Fix the tier only in test instrumentation; set viewport/DPR **before scene initialization** (setting high after medium initialization does not construct missing GTAO passes). Keep one active test scene, retain outliers and do not run CPU-heavy checks during sampling. Do not repeat large benchmark matrices for a small geometric fix.

## 11. Do not redo

Claude must not:

- Repeat architecture discovery or reopen approved design/renderer decisions.
- Redesign townhouse, shop, midrise, office or tower families.
- Redo citywide rollout/diversity, hero composition, landmark modernization or art/material passes.
- Change the approved visual design, camera, North Star, footprints or circulation to silence the z-fighting guard.
- Substitute the renderer, add external assets/frameworks or implement new LODs without a real need and explicit authorization.
- Apply global polygon offset, remove tests, ignore entire builders or broaden tolerances as a substitute for a source fix.
- Infer that historical plans or a saved artifact authorize more work, or that a local commit means release approval.

### Working-tree preservation and closing commit

The closing audit started at branch `feat/site-gamefication`, base commit `3eb04b3` (`Batch procedural city buildings`), with an empty Git index. The76 pending files were inspected by scope/diff and matched this sequence: plot migration/builders, archetype/chunk/LOD systems, citywide/diversity/art/landmark work, related tests, rules and city documentation (including three historical2026-10-19 city specs/plans). No personal/content/CV/other-product changes or ambiguous paths were identified. They are included with this new handoff in one explicit-path commit; no blanket staging, destructive reset/restore/clean, push or deploy.

The staged whitespace check found one extra EOF blank line in the historical city implementation plan; only that blank line was removed. No runtime source was changed in this closing task.

No unrelated/ambiguous files were identified to leave uncommitted. The existing `AGENTS.md` symlink remains intact. If the later `git status` shows new changes, treat those as new/unattributed working-tree state and preserve them; this paragraph is not permission to discard them.

A single preview serves current source at `http://localhost:8000/`; the historical validation servers/headless browser instances were stopped. Local artifact and `/private/tmp` evidence are not source-tree dependencies and are not included as binary dumps in this commit.

## 12. Definition of done

Do not mark the follow-up complete until:

- The z-fighting guard passes, with zero problematic production pairs or only an explicitly justified minimal intentional allowlist.
- 32/32 browser suites pass, including the original strict coplanar-face guard.
- The full relevant Node suite continues to pass (currently101 tests).
- Zero console errors; syntax and `git diff --check` pass.
- Same main/skyline/Wembley/London/MASP views show no regression, and approved envelopes/layout/resources/batching/LOD remain intact.
- Performance remains GO in the tested runtime; do not upgrade physical-mobile or universal-performance claims without new evidence.

Only then may the technical status be updated to:

```text
VISUAL: GO
FUNCTIONAL: GO
PERFORMANCE: GO
PRODUCTION-READY: YES
```

That update requires fresh evidence; **it is not the current state**. Keep mobile-real/runtime/London-Eye limitations visible even after the blocker is resolved. No automatic push/deploy or further visual work.
