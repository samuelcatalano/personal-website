# Final independent botanical review — 2026-11-14

What this change does: Replaces the one-family authored forest with five original botanical families, coherent physical mesh levels and larger silhouettes. Replaces coarse low plants and adds restrained turf detail while retaining the existing placement source and circulation exclusions.

## Specification compliance verdict: APPROVE for inspected source/assets

Reviewed the baseline-736377d package, connected runtime, new authoring source/tests, actual delivered GLB JSON, author manifest/report and independent ground review. All ten delivered meshes have bark then leaves primitives, compatible attributes and the expected two-material order; both LODs share exact bounds/radii. Existing scene creation passes the actual treeRegion callback through createTrees. Original texture × vertex colour is preserved; leaves retain MASK 0.42, depth writing and double-sided rendering. Standard shadow proxies retain the alpha map via their source materials. The existing frozen reduced-motion clock reaches the wind shader unchanged.

Source centres, base offset, height/crown caps and low-plant normalized envelopes remain intact. The source diff changes neither roads nor lot descriptors, route, pedestrians, architecture, weather, global lighting or HTML. Scoped ground ownership and derivative corrections match the previously approved ground review. Load failures still return the procedural forest; successful authored resource disposal is idempotent and separates cloned materials from shared original textures.

No source-level blocker found. This does not certify whole-city visual or temporal behavior from static code.

## Quality verdict: APPROVE authored morphology; final runtime visual GO remains with primary

Directly inspected the contact sheet (five families, front/opposite/three-quarter/LOD1) and birch/spruce close details. They show connected branching, visible canopy depth, small attached foliage and distinct silhouettes. The author report substantiates finite normalized export, unit normals, exact read-back triangle counts, matching LOD envelopes and verified lossless delivery. Its strict-mask silhouette comparisons are relevant evidence and do not substitute for runtime transitions.

No new dependency, external production photograph or unlicensed copied model appears in the inspected generation path. Reference photographs inform original procedural geometry/maps; species accuracy is appropriately described as an approximation. Costs are explicit: 19,618,964-byte GLB plus 1,337,825-byte atlas, 56,340–69,196 LOD0 triangles/family, substantially heavier ground planting. These are accepted quality costs, not an FPS gain.

## Should fix before claiming runtime completion

1. **Retain mid/far transition regression evidence** (`tests/botanical-trees.browser.py`, `tests/authored-trees.browser.py`). The initial replacement dropped the previous rendered brightness comparison, atlas-foot/UV and far-facing checks while changing the atlas to five tiles and the billboard to MeshStandardMaterial. The leaf shader still modifies normals/backlight while the billboard does not. Passing the initial fixture only establishes compilation/level selection, not similar brightness/coverage at transition. The primary has acknowledged this and is adding the guards; review their resulting evidence before final runtime GO. No visual defect is asserted without that evidence.

## Known limits, not additional change requests

- One morphology per family; placement yaw/scale/tint varies it. Branch forks intersect rather than form watertight sculpted joints.
- Alpha-cutout needles/leaves and a single-view far atlas can shimmer or change silhouette with motion. The static author views do not measure temporal antialiasing.
- LOD1 shadow workload is roughly 56–58% of LOD0 geometry, not the inherited “~1/4” code comment. Use actual author counts for reporting, not that stale comment.
- Quality-first cost is intentional; full-city frame time, loading impact and physical VRAM are not established by this independent source review.

Verdict: Source/asset integration approved. Resolve item 1 with the primary’s in-progress checks and retain whole-city day/night visual acceptance as a separate gate.

Not checked independently: browser rendering, moving transitions, full-city captures, tests already passed by primary, performance, mobile, accessibility or deployment. No source edits, browser interaction or repeated suites were performed; only this requested review artifact was written.


## Scoped final physical-LOD revision review

Reviewed `final-physical-fix.diff`, current `tests/botanical-trees.browser.py`, `physical-far-green.log`, current composer MSAA settings and remaining authored-batch consumers. No browser or suite was rerun.

**Specification verdict: APPROVE runtime revision.** Keeping authored LOD1 at every far distance is consistent with the owner's quality-first scope. The active authored renderer no longer imports/creates/downloads an impostor or atlas. It has exactly two physical meshes per chunk, 140 m initial selection and 130/150 m hysteresis. Both meshes use the same material array and retain world-root/crown constraints. Load failure still enters the procedural fallback; owned texture/material/geometry cleanup remains intact. Shadow proxies reuse physical LOD1 and are hidden in the colour pass. The obsolete quarter-size comment was corrected to approximately 57%.

**Visual/code quality verdict: APPROVE runtime revision, with downstream test/tool fixes below.** Removing the legacy crown-normal override preserves authored bent-leaf normals. Linear minification plus alpha-to-coverage avoids the reported mip-mask foliage loss; desktop composer targets actually use four MSAA samples. Supplied five-family flat/day checks show near/mid luminance differences below 3% and 93.99–97.11% projected coverage, with identical mid/far results. The mid/far measurements reuse the same physical geometry/material by construction, and the separate runtime selector assertion confirms LOD1 at 1500 m. This is valid evidence that the former representation switch was removed, not a test of moving distant subpixel foliage. Earlier item 1 (impostor transition evidence) is superseded and closed by removal of the active impostor path.

### Must fix for a complete integration

2. **Existing authored-tree checks still require the removed third level** (`tests/streetscape.browser.py:24`, `tests/loading-parallel.browser.py:66–80`, `tools/vegetation/lod_sweep.py:61–69`). Streetscape dereferences `b.lods[2].boundingSphere`, which now throws. The loading fixture intercepts the old GLB and waits for the removed atlas request, so it fails after its deadline; its later atlas-failure/disposal cases are also obsolete. The sweep forces LOD2 and hides its sampled batch, producing misleading frames/measurements. Update these consumers to the actual two-level/GLB-only authored contract. Keep the procedural `tests/trees.browser.py` three-level checks, because fallback remains three-level. Primary notified before this addendum was written.

### Material and cost limits

No-mip foliage can alias or shimmer at small projected sizes; MSAA smooths cutout coverage but is not temporal/signal prefiltering proof. Far trees now submit full LOD1 geometry and remain eligible shadow casters inside the light frustum. This is the declared quality tradeoff, not a performance optimization. The 1,337,825-byte atlas remains an authoring artifact and is no longer an active runtime download. Final whole-city day/night composition, moving-camera quality and performance remain primary-owned acceptance gates.


## Consumer-fix re-review — finding 2 closed

Read `consumer-fix.diff` and `consumer-fix-report.md`, limited to the three named consumers. **Specification compliance: APPROVE. Code/integration quality: APPROVE.** No remaining actionable finding in this scoped revision.

- Streetscape now selects both actual physical levels, verifies exactly one visible mesh and checks wind-bound padding without dereferencing a third level.
- Loading checks now hold/release the botanical GLB, require no external vegetation atlas, preserve the original worker decode checks, inject HTTP503, verify the real three-level procedural fallback and check idempotent disposal of unique geometry/material/embedded-texture resources. Monkey patches and held requests are restored/released in finally blocks.
- LOD sweep derives its two forced levels from the runtime, rejects fallback/invalid levels, switches all batches consistently and asserts both 130/150 m hysteresis transitions plus physical LOD1 at 1500 m. The camera change is explicitly documented; measurements must use the revised tool on both sides of any new A/B.

Finding 2 is closed by source inspection. The supplied report records syntax/embedded-JavaScript checks; primary-owned Chrome execution is still pending and is not claimed passed here. The subsequent leaf-density asset pass is outside this consumer-only re-review: earlier numeric transition/payload evidence remains candidate evidence until the primary reruns it against the final assets. No browser, tests, asset edits or additional scope expansion performed.


## Primary final integration evidence

After the source review, the bounded leaf-density pass retained all branch/leaf counts and normalized envelopes. Final delivery GLB19,683,804 bytes; five-family flat/day tests pass with max4.193% near/mid luminance difference, coverage94.96–97.56%, identical physical mid/far output. Updated streetscape/loading and both day/night camera sweeps pass. Four matched full-world views confirm317trees/739plots/botanicalrenderer, zero JS/shader/GL errors. EN/PT WebGL-off and PT reduced-motion checks pass;267Node tests pass. Live browser probe confirmsv9/noatlas/twophysicallevels. Final visual acceptance belongs to the primary; the independent review above remains a source/integration review, not a claim that its reviewer ran these browser checks.
