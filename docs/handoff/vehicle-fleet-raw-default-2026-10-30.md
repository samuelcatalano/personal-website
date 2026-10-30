# Claude handoff: vehicle fleet raw GLBs by default (2026-10-30)

## Decision

The owner confirmed that `?glb=raw` fixes the visible car-body problem and reported that the processed versions still looked bad after a higher simplification ratio. Raw authored GLBs are now the browser default. Keep `?glb=processed` as an opt-in comparison path. Do not switch back to processed-by-default unless a visual fix is demonstrated to the owner.

The server is running at `http://localhost:8000` (HTTP 200 at handoff). Branch: `feat/site-gamefication`; starting HEAD was `1da8b4a`. Changes are uncommitted and have not been pushed.

## Cause and implementation

- `tools/pipeline/optimise.mjs` documents that simplification interpolates normals and can shade car panels with grey patches. The owner’s raw-vs-processed comparison held runtime materials constant and resolved the issue with raw assets, isolating the primary defect to processed geometry/normals.
- In `js/world/vehicle-assets.js`, browser URLs without a `glb` parameter now select raw source GLBs. `?glb=processed` opts into the Meshopt versions. Bus GLBs were already loaded from their source paths, and Honda HR-V was already raw; this switch primarily changes Mini and the five fleet models with processed files.
- A ratio `0.3` reprocess was tried while retaining original normals, but the owner still found the result visually bad. Those processed files remain available for the opt-in mode. No custom `smooth`/`crease=` regeneration was used because an earlier experiment blackened parts of the scene.
- Vehicle paint was also made less reflective: metalness `0.08`, clearcoat `0.35`, clearcoat roughness `0.16`, environment intensity `0.22`. Existing glass, rubber, lamps, wheels, and chrome retain their role-specific paths.
- The shared London/Glasgow bus GLB has the wheel-dish recess fix: 40 inset cavities with existing materials and wheel pivots. It does not change the bus route or animation code.

## Assets and workload

The six processed car assets at ratio `0.3` total 804,311 triangles / 25.9 MB, versus 454,131 / 19.7 MB in the previous processed set. The corresponding six raw sources total about 2.07M triangles / 84.2 MB. Honda remains a separate raw 497k-triangle, ~47 MB asset.

With raw as the default, one desktop profile on route segment 3–6 (`weather=clear`, 15-second scripted scroll) measured:

| Metric | Raw default |
|---|---:|
| Frames | 1,261 |
| Median / p95 / p99 frame time | 8.7 / 17.2 / 17.6 ms |
| Maximum frame / longest task | 50.9 / 54 ms |
| Median / p95 submitted triangles | 9.16M / 11.06M |
| Median draw calls | 840 |
| Peak JS heap | 733 MB |

An earlier single profile with `?glb=processed` on the same segment measured 8.3 ms median, 9.0 ms p95, 5.61M median triangles, 798 median calls, and 491 MB peak heap. These are local desktop readings, not a repeated paired benchmark; p95 exceeds the 16.7 ms frame budget in the raw profile. The owner explicitly chose visual quality after confirming raw fixes the issue, so retain raw default and make this cost clear. Do not describe performance as unchanged.

`node tools/pipeline/check.mjs` reports per-asset vehicle budget breaches among other existing breaches. The budgets were not changed.

## Verification performed

- `tests/regional-fleet.browser.py`: PASS, all six models load the raw source triangle counts; nine fleet slots; procedural fallback works when both source and processed requests are blocked.
- `tests/vehicles.browser.py`: PASS, bus and vehicle contracts; 20 traffic vehicles over 4,500 updates; the Mini loads its 993,601-triangle source by default; `?glb=processed` opt-in loads the 324,297-triangle Mini.
- Desktop capture covers São Paulo, London, and Glasgow in day and night: `/tmp/vehicle-fleet-raw-default/`. Cars are small in the full-scene capture; the owner’s direct raw-mode comparison is the visual evidence that raw resolves the close-up defect.
- `git diff --check` and processed GLB manifest hashes pass. No mobile checks, full test suite, commit, or push.

## Changed files

- `js/world/vehicle-assets.js`
- `assets/processed/vehicles/*.glb` (six cars) and `assets/processed/vehicles/manifest.json`
- `assets/vehicles/double-decker-bus.glb`
- `tools/vehicles/double-decker-bus-dd/build_bus_dd.py`
- `tests/vehicles.browser.py`, `tests/regional-fleet.browser.py`

Continue from the current working tree. Preserve raw-by-default behavior unless the owner explicitly changes this decision.
