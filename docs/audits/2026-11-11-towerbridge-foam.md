# Tower Bridge stale pier foam correction

The owner reported white rectangular patches under Tower Bridge on both sides. The river shader still used the old procedural pier masks (centres at local z ±9.5 m) after the authored GLB moved the towers to ±14.6 m. Water over those now-empty masks became filled foam.

The initial masks now match the procedural fallback's actual half-extents (2.6×2.4 m). A successful authored upgrade calls the new water `setPiers` method with the authored waterline footprints: centres ±14.6 m, half-extents 4.704×3.504 m. These match `tools/landmarks/towerbridge/build_towerbridge.py`: K=.4, TZ=36.5, battered pier profile evaluated at scene water y=.1. Both sides update together; failed or forced procedural loads retain their fallback masks. Boat foam, bank foam, bridge geometry and the water shader are unchanged.

Validation: new Node regression failed before implementation; full Node suite **234 passed**. `tests/towerbridge-foam.browser.py` passed, covering fallback masks, authored masks, removal of old masks and live scene/model agreement. Live authored uniforms were `[205,-59.6,4.704,3.504]` and `[205,-30.4,4.704,3.504]`; zero failed shader programs. Desktop day/night at stop 10.54 and daylight close-ups of both banks were inspected: old detached rectangular patches are absent. `git diff --check` passed.

Local evidence: `/Users/samuel.catalano/.codex/visualizations/2026/11/11/01a1cbac-eeff-7523-9867-01876cdad409/towerbridge-foam/`.

No mobile matrix, GPU benchmark, or forced asset-load-failure browser run. The browser fixture verifies fallback data and switching separately. No new lights, geometry, assets or render passes. No commit or deployment.
