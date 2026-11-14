# Ground and low planting review

Scope: supplied ground-review.diff, connected low-plant consumers, hero merge/ownership, turf shader and supplied browser-test sources/logs. Read-only; no source edits, browser interaction, mutation testing or duplicate test runs.

## Spec compliance verdict: APPROVE (source scope)

The supplied slice implements deterministic curved grass/leaves/stems/petals, normalized ground-origin envelopes and smooth normals. All four actual consumers use the coherent nonmetal, double-sided plant material. Exclusion inputs and placement centres are preserved; lower lawn height is the authorized quality choice. Turf changes are gated by the existing grass/patch palette set, leaving paving, asphalt and the pale skirt on the previous map/shader branches. No dependency or external photo texture is added. The required derivative correction below was inspected after implementation and is resolved. This source verdict does not establish the eventual visual GO.

## Code-quality verdict: APPROVE

No unresolved actionable findings in the reviewed ground slice.

### Resolved [P2]: footprint-dependent fade inside differentiated height

File: `js/world/textures.js:139–145`.

The original diff made `turfDetail` depend on `dFdx(vWP.xz)` / `dFdy(vWP.xz)`, then included it in `turfHeight`; subsequent `dFdx(turfHeight)` / `dFdy(turfHeight)` introduced undefined higher-order screen derivatives. That was a real stability defect even if compilation passed.

Scoped re-review of the current source confirms `turfHeight` now samples only `map.g * .014`; `turfDetail` multiplies the finished first-derivative gradient contribution. The additional `max(abs(turfDet),1e-8)` preserves a finite base normal when the projected differential degenerates. The concrete source defect is resolved. Moving-camera fade quality still needs the primary agent's desktop visual check; successful compilation alone does not establish visual stability.

## Reviewed paths without actionable defects

- Hero planting contains compatible position/normal/color attributes before merge. Source plant geometries are disposed after merging; merged geometry and the new material are owned by the idempotent hero disposer. Existing shared architecture/glass materials survive disposal.
- Understory owns its new geometry/material and the existing tree disposer releases both. Voxel plant geometry/material remain shared caches; swap plaza registers its new plant material and geometry with the existing resource owner.
- No unrelated tree/runtime implementation was reviewed.

## Cost and verification limits

Existing supplied `plants-green.log` and `ground-gates.log` record 288 triangles per grass clump, 5,820 per shrub, 7,372 per hedge and 1,460 per flower; the planting fixture records 10,157 grass instances / 2,925,216 grass triangles. Hero records five renderables, 203,076 triangles, four materials and four unchanged maps. These are material geometry increases, consistent with the owner's quality-first instruction; they are not an independent performance verdict. In particular, grass geometry grows 14.4× over the former 20-triangle clump. The new 512×512 shared RGBA turf map also has approximately 1.33 MiB decoded mip payload; this is not measured physical VRAM.

I did not independently run tests, inspect captures, use the browser, test mobile, benchmark or validate visual realism. Browser gates and the eventual visual GO remain the primary agent's responsibility.
