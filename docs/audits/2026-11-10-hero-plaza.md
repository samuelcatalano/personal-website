# Initial plaza — 2026-11-10

Owner authorised all seven suggestions for the pictured initial plaza. [Scope](../plans/2026-11-10-hero-plaza.md). This pass preserves prior NPC/streetscape edits; no commit or push.

## Result

1. Dark paving strips become narrow neutral-stone joints. Existing longitudinal and transverse paths remain in place.
2. Shaped stone fountain basin: proper inner wall/depth, bevelled coping, low central nozzle and six low arcs. A single opaque water mesh adds restrained moving ripples and analytic sky reflection, without a reflection capture. Its private material uses the existing scene clock and night uniform.
3. Six benches form two centre-facing pairs and one shaded pair. Their rotated obstacle footprints remain clear of the original walking corridors and retained tree trunks.
4. Low green clusters and pale flowers enrich the existing lawn beds; tree positions and the flowering tree are preserved.
5. A circular stone apron distinguishes the fountain area without adding raised obstructions to the paths.
6. Four peripheral plaza posts remain, moved away from the central flow. The six old park posts are no longer emitted when this specific park is replaced. Matching warm ground pools reuse the existing instanced lamp-pool mesh. A thin warm band accents the fountain coping at night. No dynamic lights added.
7. The existing tunnel portal receives warm stone finish, a coping cap and narrow plinth. Low planters sit at the plaza-side outer ends. Ramp profile, road markings, soffit and vehicle opening remain unchanged.

Files: `hero-realm.js`, new `plaza-water.js`, the hero-only lamp guard in `parks.js`, portal finish in `route-tunnel.js`, lamp-pool integration in `scene.js`, and the module preload. Other city regions, building descriptors, the thirteen original plaza trees, crowd routes and NPC simulation are unchanged.

## Verification

- `node --test tests/`: **224 passed, 0 failed**. Updated only the obsolete bench/lamp literal expectations in the existing hero test to match the authorised arrangement; kept its zone/RNG/tree preservation checks.
- `tests/hero-plaza.browser.py`: passed in real Chrome with WebGL active. Includes the existing `hero-realm.browser.py` contract: deterministic geometry, exact bounds, shared resources, idempotent disposal including the private fountain material, and the original 12,000-triangle ceiling.
- 25 recorded furniture/planting footprints: no overlap with each other or either existing hero-garden pedestrian route. Bench/portal planter footprints also clear retained tree trunks. Portal geometry below the soffit stays outside the existing vehicle opening.
- Water animation: 2,998 changed pixels within the projected fountain region between t=2 and t=3 in the fixture. Static vertex positions do not change; animation uniforms share the scene clock, which already freezes under reduced motion. No WebGL disabling is introduced or used in these captures.
- Coping regression: the close visual review found inward/downward-facing lathe geometry; a new orientation assertion failed before the fix and passed after reversing the profile. The upper stone rim now faces upward.
- Final integrated city: start view/day and night, WebGL active, no recorded JS errors, unhandled rejections or console errors. Mobile checks use a 375 px fixture/day+night and the normal integrated start camera/day.
- `git diff --check`: passed.

## Scoped workload

[Before/after component counts](../evidence/hero-plaza/component-budget.json): **3 → 4 meshes**, **4,920 → 9,000 triangles**, **2 → 3 materials**. Four shared textures remain; no new texture asset, dependency, dynamic light or render pass. The only additional plaza draw is its water mesh. Ground illumination stays in the existing lamp-pool batch, and obsolete pole instances are removed.

The controlled neighbourhood fixture returned 37 day / 38 night calls after the change versus 36 / 37 before; these include nearby buildings, trees and existing lamp pools, rather than only the plaza. This is workload evidence, not a full-city FPS benchmark. The extra 4,080 plaza triangles remain below the pre-existing 12,000 local limit.

Baseline snapshots are identified by [hashes](../evidence/hero-plaza/baseline-sha256.json). They were saved at the start of this plaza task, including the previous uncommitted streetscape changes.

## Images and limits

- [Final city detail](../evidence/hero-plaza/plaza-detail.jpg), [integrated day](../evidence/hero-plaza/integrated-day.jpg), [integrated night](../evidence/hero-plaza/integrated-night.jpg).
- [Controlled day comparison](../evidence/hero-plaza/day-comparison.jpg), [night comparison](../evidence/hero-plaza/night-comparison.jpg): before on the left, after on the right. This isolated fixture omits NPCs and uses controlled lighting; integrated images show the actual city.
- [375 px day](../evidence/hero-plaza/mobile-day.jpg), [375 px night](../evidence/hero-plaza/mobile-night.jpg), [integrated mobile/day](../evidence/hero-plaza/integrated-mobile-day.jpg).

No physical-phone, Lighthouse or full-city FPS benchmark repeated for this local change. Existing broader browser-suite issues recorded in the [preceding streetscape audit](2026-11-10-streetscape.md) were not reclassified as passing. Ready for owner visual review; no release-wide GO is implied.
