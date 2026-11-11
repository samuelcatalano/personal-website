# Initial plaza — second refinement, 2026-11-10

Owner requested another improvement pass on the same plaza. [Design contract](../plans/2026-11-10-hero-plaza-polish.md). This supersedes only the finish/geometry counts in the [first plaza pass](2026-11-10-hero-plaza.md). No commit or push; earlier work is preserved.

## Delivered

- Six rounded stone seating pads and armrests on the existing benches, with warmer timber. At the two shaded benches the original raised bed border is interrupted around the seating pocket; raycasts verify the expected pad surface instead of the old curb.
- Six pale flowering clusters in two rows per existing end bed, with inset soil. Existing round planters gain soil and a fine stone rim.
- Three low shrubs with a ring of eight grass tufts per existing planting group. Its obstacle footprint expands to enclose that planting, inside the same lawns and away from both pedestrian routes.
- Sixteen subtly alternating stone sectors and a narrow outer band refine the fountain apron. All are passable flat detail in the existing ground batch.
- Smaller, less regular water-normal ripples and slightly reduced sky-reflection weight soften the previous concentric-ring appearance. The same shared scene clock and reduced-motion behaviour remain.

Production files: `js/world/hero-realm.js` and `js/world/plaza-water.js` only. Tree, bench and post positions; portal/road profile; crowd simulation; copy; WebGL behaviour and global lighting are unchanged. No dependency, external asset, texture, dynamic light or render pass added.

## Validation

- `node --test tests/`: **224 passed, 0 failed**.
- `tests/hero-plaza.browser.py`: passed, including the inherited zone/resource/determinism/disposal and upward-coping checks. New downward raycasts confirm both shaded seating pockets expose the pad at y=0.112 instead of the old curb.
- All 25 recorded physical footprints stay mutually clear and outside the two original hero walking routes; benches/portal planters clear retained trunks. Portal opening still passes its original clearance assertion.
- Actual fountain-region pixel comparison changes 4,522 pixels between t=2 and t=3 in the controlled fixture; static geometry stays unchanged. Shader compilation and WebGL error checks pass.
- Controlled desktop and 375 px day/night captures: WebGL active, no recorded console errors. Integrated city start/day+night captures: ready scene, no recorded console/JS errors or unhandled rejections.
- `git diff --check`: passed.

## Workload and evidence

[Component budget](../evidence/hero-plaza-polish/budget.json): **9,000 → 11,028 triangles**, below the original **12,000** ceiling. Still **4 meshes, 3 materials, 4 shared textures**. Controlled neighbourhood fixture stays at 37 day / 38 night draw calls; no additional draw compared with the preceding plaza version. These counts are workload evidence, not an FPS claim.

- [Integrated detail](../evidence/hero-plaza-polish/plaza-detail.jpg), [day](../evidence/hero-plaza-polish/integrated-day.jpg), [night](../evidence/hero-plaza-polish/integrated-night.jpg).
- Controlled comparisons: [day](../evidence/hero-plaza-polish/day-comparison.jpg), [night](../evidence/hero-plaza-polish/night-comparison.jpg). Before on the left, after on the right; same viewport and camera. This fixture omits NPCs and uses controlled lighting.
- 375 px fixture: [day](../evidence/hero-plaza-polish/mobile-day.jpg), [night](../evidence/hero-plaza-polish/mobile-night.jpg). [Integrated mobile/day](../evidence/hero-plaza-polish/integrated-mobile-day.jpg).
- [Baseline hashes](../evidence/hero-plaza-polish/baseline-sha256.json) identify the two pre-pass modules. The baseline includes previous uncommitted plaza/NPC/streetscape changes.

No physical-phone, Lighthouse or full-city FPS benchmark repeated for this local finish pass. Broader pre-existing browser failures in the earlier streetscape audit remain outside this verification. Ready for owner visual review; no release-wide GO implied.
