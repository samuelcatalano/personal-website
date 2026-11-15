# Eastern stadium pocket — 2026-11-14

The owner selected the still-empty area east of Wembley in the 22:44:36 crop. Ninety-three appended lots join the existing eastern and foreground blocks: 61 two-floor terraces and 32 three-floor midrises. Every footprint is 9×9 m and height is at most 9.6 m. Centres are bounded by x880..1010 and z−107..19. Ten stagger-free rows retain the existing 13 m horizontal rhythm; occupied old cells, gardens and walking loops remain.

The stadium footprint is approximately 51.5×33.25 m around (835,−71). Its new-lot guard includes an 8 m setback (rounded out to x±34/z−96..−46); the closest new western plot edge is x875.5, leaving at least 14.75 m to the stadium's east wall. No stadium, arch, garden, route, pedestrian area, tree, prior lot, material, asset, quality setting or production-camera change. No Astra or subagents used.

## Checks

- `node --test tests/`: 272 passed. New row coverage, stadium-envelope/setback checks and a preservation hash for all previous 626 infill descriptors pass. Original lot/tree/prop hashes and public-area guards remain.
- `tests/urban-infill.browser.py`: passed for all 719 surveyed infill lots, with 692 recent additions checked against real-route existing plots, trees, props and walking areas. Road/river/bridge guards, finite near/far attributes, envelopes, shared buckets/materials and fallback construction pass.
- Desktop aerial review: passed for the original regional framing and a focused view beside the stadium at 2400×1400/DPR1.5. Both the stadium and existing gardens remain readable and clear; the selected empty pocket now connects to the surrounding blocks. Final QA reports 1,431 retained plots, all 317 botanical trees and zero JavaScript errors, failed shaders or WebGL errors. Temporary inspection-camera/fog changes were confined to the closed QA tab. Local evidence: `/tmp/stadium-after/`; durable session artifacts in `stadium-east/`.
- `git diff --check`: passed.

## Cost and limits

The isolated procedural `kits:false` infill fixture grows 626→719 plots, 153→176 chunks, 3,769,786→4,279,102 accumulated near triangles and 106.83→120.37 MiB initial far-attribute arrays. Two shared materials remain. This is a geometry/CPU-array count, not full-frame timing, physical VRAM or authored-kit geometry. No mobile, Lighthouse, nighttime repeat or frame-time benchmark for this scoped extension.
