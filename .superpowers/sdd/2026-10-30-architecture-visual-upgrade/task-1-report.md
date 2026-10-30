# Task 1 report: standalone regional houses

## Findings

- `house(add, q, x, z, o, w, d, n, fh = 3.1, lo = false)` is called from `blocks.js`, `country.js`, `glasgow.js`, and `city.js`; those call sites and layouts were left unchanged.
- Each caller passes a seeded `q` stream shared across sequential house/detail generation in that region. `blocks.js` and `glasgow.js` also pass their respective stream into other building detail generation. The implementation adds no `q()` calls, so subsequent seeded choices retain their existing alignment.
- The established house body, floor count, input dimensions, position, low-roof behavior, roof maximum height, and facade orientation are unchanged.
- Reviewed the current architecture, rendering-budget, art-direction, and visual-atlas references. They call for stylized realism, human-scale facade hierarchy, recessed glass, restrained profiles, and palette/material reuse.

## Changes

- `js/world/houses.js`: added a shallow brick ground-floor face behind openings; made door leaves sit further into their surrounds and added two dark door panels; recessed window glass behind existing surrounds and added projecting sills; added a narrow roof ridge inside the former roof's maximum height.
- `tests/houses.test.mjs`: added assertions for facade/door/window/roof details, the unchanged body dimensions, determinism, and existing geometry bounds. The bound allows the existing 0.9 m balcony rail projection.
- No caller, layout, external asset, dependency, or package changes.

## Checks

- Baseline `node --test tests/houses.test.mjs`: passed before implementation.
- Final `node --test tests/houses.test.mjs`: passed (1 test).
- Final `node --test tests/glasgow.test.mjs`: passed (4 tests), because Glasgow uses this generator.
- `git diff --check`: passed.
- Node emitted the existing `MODULE_TYPELESS_PACKAGE_JSON` warning for this repository's ES modules.

## Self-review and concerns

- The test confirms the 9×7×9.3 body remains one box, added geometry stays within the prior bounds (including roof top 12.16 and balcony projection), and the low-roof path stays at its prior ceiling.
- All colors use the shared palette; geometry is still emitted through the existing `add` callback. No random draws were added.
- No visual capture, browser run, mobile check, or performance measurement was run; the requested focused Node suites were the validation boundary. The added facade/sill/panel/ridge boxes increase geometry emitted by this legacy generator, so their gameplay-scale appearance and runtime cost remain visually unmeasured.
