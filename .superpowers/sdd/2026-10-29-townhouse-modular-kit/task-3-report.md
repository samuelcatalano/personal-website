# Task 3 — Desktop quality pass and lossless optimization

## Result

**Visual GO for the nine-lot pilot using the raw GLB.** The captured LOD0 facade details read clearly; the established roof silhouette, facade rhythm, lot bounds and grounding remain intact. No z-fighting was visible in the desktop views. LOD1 remains the procedural fallback-style geometry and preserves the existing roof/facade rhythm. The optimized candidate is **NO-GO**: it drops an attribute the runtime needs and is not equivalent, so the repository keeps the raw kit.

## Compared revisions and captures

- Pre-integration baseline: `fe6b720da45189a2faffa3d658aadc82f33ac98e`.
- Integrated raw-kit state at start of this pass: `7c715258c5fd9b59576cf900478a43ea65ca6ff7`.
- Full-scene desktop Chrome captures at stops 5/day and 11/night were captured and inspected for both baseline and current source. They retain the application camera and lighting.
- A fixed desktop comparison scene used the same lot descriptors, camera and 1440×900 renderer for the nine-lot experiment. LOD0 and LOD1 were selected through the existing update hook, with day and night lighting settings. The three-lot control group was measured in both revisions.
- The focused captures are machine-local under `/private/tmp/townhouse-evidence/baseline/`, `/private/tmp/townhouse-evidence/current/`, and `/private/tmp/townhouse-evidence/optimized/`. Full-scene baseline captures are under `/private/tmp/townhouse-baseline-capture/`; current captures are under `/private/tmp/townhouse-evidence/current-scene/`.

## Measurements

| State | Baseline draws | Current raw draws | Baseline triangles | Current raw triangles |
|---|---:|---:|---:|---:|
| Nine lots, LOD0 | 6 | 6 | 6,572 | 104,270 |
| Nine lots, LOD1 | 6 | 6 | 3,226 | 3,226 |
| Three-lot control | 3 | 3 | 2,334 | 2,334 |

The nine-lot experiment occupies two spatial chunks, each with three active `mass`, `trim`, and `glass` renderables. Normalized by chunk, it submits 3 calls against the control's 3 calls: **0% draw-call delta**, within the 10% gate. The table's triangle counts come from the isolated renderer's one-pass `renderer.info` readings and are measurements only; they are not full-scene, multipass counts or a triangle gate.

`node tools/pipeline/check.mjs` reports the shipped raw kit at **1,812,724 bytes (1.73 MiB), 24,780 source triangles, 3 source materials, and 0 textures**. Runtime townhouse resources remain 2 shared materials and 4 generated maps (~4.33 MiB).

## Optimization decision

Ran the required command:

```sh
node tools/pipeline/optimise.mjs assets/processed/buildings/townhouse-kit.glb /private/tmp/townhouse-kit-optimized.glb 1
```

It produced a 688,108-byte candidate while retaining 24,780 source triangles. The GLB still parses, but the optimizer prunes `TEXCOORD_0`/UV because it is not referenced by the GLB's source materials. The browser pilot then fails to adopt the kit geometry when merging it with procedural geometries that carry UV attributes, and keeps the procedural fallback. The candidate therefore loses the authored facade detail in the application and is not visually equivalent. The raw file was retained.

The current CLI exposes `ratio`, `error`, and a `smooth` mode, but no UV-preservation option. `smooth` removes and recalculates normals, so it is not a lossless equivalent variant. No pipeline or runtime code was changed to work around this.

## Checks

- `node tools/pipeline/check.mjs` — passed; raw asset measurements recorded above.
- `node --test tests/` — **116/116 passed**. Node emitted the existing `MODULE_TYPELESS_PACKAGE_JSON` warning for ES modules.
- `tests/building-slice.browser.py` — passed; asynchronous adoption, fallback, LOD transitions, bounds and unchanged control verified.
- `tests/building-kit.browser.py` — passed.
- `tests/citywide.browser.py` — passed unchanged. The default 5-second browser-harness IPC timeout occurred once in the first tab and again in a fresh tab. With the harness IPC timeout increased to 30 seconds for that run, the test passed (630 lots, 555 renderables, 796,456 triangles, 2 materials/4 maps).
- `tests/zfight.browser.py` — passed; checked 29,802 world-box entries. Its analytic check covers the existing box-world representation; module geometry received visual inspection rather than a new face-pair assertion.
- No mobile checks, Lighthouse, physical-device testing, full performance benchmark, deployment, or changes to runtime/test code.

## Approval boundary

The raw-kit nine-lot pilot is approved by this visual pass. Obtain owner approval before extending the kit to additional lots. Revisit compression only if an approved optimizer path preserves the runtime UV contract and the resulting application capture remains visually unchanged.

## Fix round — preserve deterministic modular window lighting

The final runtime review found that the modular window path assigned every authored glass role `S.glass`, losing the procedural night-light variation. The fix restores the existing per-facade opening index and formula, `(index + (frontFace ? 1 : 0) + recipe.windowSeed) % 3 === 0`, and maps matching window panes to `S.litGlass`. Module selection, three role buckets, and LOD behavior are unchanged.

A focused browser assertion derives the expected lit-window count from the existing recipes/openings and verifies the modular `aSurface` data contains exactly 132 lit-glass vertices per expected pane. The shuffled-input fingerprint now includes `aSurface` so the lighting assignment is covered by the determinism check.

### Files

- `js/world/building-slice.js`
- `tests/building-slice.browser.py`

### Checks and evidence

- `node --check js/world/building-slice.js` — passed.
- `python3 -m py_compile tests/building-slice.browser.py` — passed.
- `git diff --check` — passed.
- `browser-harness < tests/building-slice.browser.py` — passed in desktop Chrome. The pilot assertion found 17 expected lit windows (2,244 lit-glass vertices); bounds, module adoption, fallback/disposal, LOD, determinism, and three-lot control assertions also passed.
- `OUT=/private/tmp/townhouse-evidence/fix SHOTS="13.5:night" browser-harness < tools/capture.py` — captured `/private/tmp/townhouse-evidence/fix/13.5-night.png`; visual inspection confirmed warm lit panes on the townhouse row.

Runtime fix commit: `f73f34de23aa06b155345a0e56c2013c2db3679b`.
