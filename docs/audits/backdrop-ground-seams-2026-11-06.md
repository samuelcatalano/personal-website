# Backdrop paving seams — 2026-11-06

The pale/white grid between buildings was uncovered ground showing the sky background. An overhead diagnostic made the same gaps blue. This was missing coverage rather than a texture-resolution or antialiasing defect.

- The main ground ended at z=-100; backdrop paving started at z=-110, leaving a 10 m strip.
- Map stretching transformed paving centres without transforming both edges, opening seams between adjacent tiles near the SP/London gap.
- Building-clearance omissions also removed their surrounding paving, and the western backdrop extension had no paving of its own.

`backdrop.js` now joins the main ground at z=-100 and preserves paving through the empty-lot/landmark clearance areas and western extension. `scene.js` maps both edges of paving rectangles through the existing stretch function. Buildings keep the original point mapping and footprints.

Validation: seven related Node tests passed. The real-browser regression checks 3,480 sample points plus continuous interval coverage across six depth bands, including the western and museum areas. It failed before the fix and passed afterward. All 177,110 non-paving generation records match the pre-change implementation exactly. Paving grows from 622 to 657 instances within the existing shared material/batch; no new materials or render batches.

Before/after overhead captures: `/tmp/ground-overhead-before.png`, `/tmp/ground-overhead-after.png`. Normal-camera desktop captures: `/tmp/ground-fixed-desktop/`. Mobile capture: `/tmp/ground-fixed-mobile/`. No full regression or new performance benchmark was required for this floor-only correction.
