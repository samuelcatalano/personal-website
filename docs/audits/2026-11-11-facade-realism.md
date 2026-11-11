# Ordinary city facade realism — 2026-11-11

## Scope and implementation

Owner authorization: [facade contract](../plans/2026-11-11-facade-realism.md). Ordinary buildings are reopened citywide, including the townhouse language. Lot descriptors, map, routes, landmarks, vegetation, pedestrians, camera and global lighting remain unchanged.

- **Townhouses:** exposed east and rear elevations gain real shallow window openings. Touching neighbors suppress east/west/rear openings. Existing authored front/west modules remain; the new return/rear windows use economical frames, reveals and glazing. Inset sash bars, bounded gutters and downpipes give the street frontage construction detail. Both LODs preserve pane positions.
- **Shops and midrises:** sash transoms and projected front lintels; midrises also gain rear windows, with touching rear neighbors retaining solid walls. Existing entrances, authored modules and silhouettes remain.
- **Offices and towers:** ordinary office structural planes project 0.12 m and transoms 0.16 m within the existing 0.2 m facade margin; end piers/bands meet at corners. Existing tower ribs deepen from 0.10 to 0.18 m. Shared vertex tints give commercial trim restrained silver, graphite or champagne finishes across procedural and authored geometry.
- **Glazing:** shared room shading gains pane-edge shadow and distance-filtered curtain/blind folds. Authored facade rebuilds now preserve room coordinates, fixing an existing loss at the merge boundary. Upper-wall runoff and plaster relief are reduced to avoid blotchy facades; ground dampness remains.
- **Legacy/fallback paths:** ordinary legacy panes are brought in front of their opaque core, rear/side framing is completed, and duplicated side-window instances are removed. Standalone house frames stop covering the glass. Distant backdrop glass now sits ahead of its shadow backing, with restrained near-row sash/sill detail. Atmospheric skyline silhouettes remain economical at their existing distant viewing scale.

The townhouse/midrise wall builders now emit horizontal wall spans between the openings active in each row. This removes redundant coplanar subdivisions from the former global X/Y grid, retaining metric UVs, material bands, real openings and normals. No indexing scheme, engine, material family, texture, dependency, light or render pass was added. The existing mass/trim/glass buckets, culling and LOD switching remain.

## Structural comparison

[Raw A/B measurements](evidence/2026-11-11-facade-resources.json), against preserved pre-change HEAD `698bd51`. These are calculated geometry attribute payloads, **not measured physical GPU memory or frame-time benchmarks**.

| Metric | Before | After |
|---|---:|---:|
| Initial procedural resident geometry | 189.174 MiB | 185.719 MiB |
| Initial active triangles | 892,282 | 870,418 |
| Loaded-kit resident geometry, fixed camera | 384.104 MiB | 380.113 MiB |
| Loaded-kit active geometry | 138.636 MiB | 136.590 MiB |
| Loaded-kit active triangles | 926,524 | 911,196 |
| Rollout lots / chunks / renderables | 698 / 194 / 582 | 698 / 194 / 582 |
| Shared rollout materials / maps | 2 / 4 | 2 / 4 |

The loaded comparison explicitly awaits all 317 facade-kit lots (21 shops, 252 midrises, 32 offices, 12 towers; 140 rebuilt chunks), loads townhouse modules, and settles existing LOD/lazy-kit updates at camera `[115,30,60]`. Initial figures cover the procedural LOD buffers before asynchronous upgrades. Neither figure is a universal live-scene memory bound; lazy townhouses depend on camera position. The scripts used are `/tmp/facade-resource.py` (initial/envelope diagnostic) and `/tmp/facade-loaded-resource.py` (loaded comparison).

The unchanged citywide test's 180 MiB initial geometry guard already fails on pre-change HEAD. Its footprint check also finds 2,610 out-of-envelope vertices in both versions, including pre-existing shop rooftop elements. Diagnostics counted these separately to complete the structural comparison; this is **not** a passing citywide regression test. No guard was relaxed and no unrelated rooftop/layout fix was made.

## Validation

- Full Node regression: **225 passed, 0 failed**. Includes standalone-house glass visibility and backdrop support/visibility contracts.
- `git diff --check`: passed.
- `tests/facade-realism.browser.py`: passed. Outdoor raycasts confirm exposed glass and closed opaque wall spans, solid townhouse/midrise party walls, closed projecting office corners, unchanged LOD pane positions, authored-kit room coordinates and the original 4096-vertex scratch capacity on a synthetic nine-house fixture. Its pre-change run fails at the missing exposed elevations, as expected.
- `tests/building-kit.browser.py`, `tests/office-facade.browser.py`, `tests/facade-interiors.browser.py`: passed.
- The first standalone block of `tests/building-slice.browser.py` passes, including its unchanged 1,132-triangle guard: **1,116 triangles**, 3 renderables, 2 materials and 4 maps (4.333 MiB texture payload with mipmaps). The full script then fails at missing historical pilot descriptors (`pilots: 0`), exactly as baseline.
- Historical `townhouse-lod.browser.py` and `midrise-slice.browser.py` fail at descriptor drift and exact allowlist respectively on both baseline and current source. Their guards were not weakened. The new focused fixture independently validates the affected geometry/LOD/party-wall behavior.
- Matched five-family authored-kit closeups: `/tmp/facade-closeups-before-final/grid.png` and `/tmp/facade-closeups-final/grid.png`. Complete model framing, oblique office/tower views; all fixture console error arrays empty and WebGL error code 0. Primary visual review: **GO for the scoped facade refinement**.
- Clear-weather route captures at stops 5, 9.5 and 11: baseline daytime grid `/tmp/facade-before-clear/grid.png`; final six-view day/night grid `/tmp/facade-final/grid.png`. All final captures report empty console/error arrays.
- Mobile emulation, 375×812 CSS px at DPR 2: London day and Glasgow night in `/tmp/facade-final-mobile/grid.png`; both report empty console/error arrays. These are emulated viewport checks, not physical-phone performance measurements.
- `tests/startup-smoke.browser.py`: passed EN and PT with WebGL disabled, plus PT with WebGL enabled and reduced motion. Content remained populated (553/588 characters in the tested initial panel), correct locale/fallback/ready state, and empty error arrays in all three cases.

## Limits

No deployment or commit. No physical mobile/GPU/FPS validation or Lighthouse run. The inherited citywide memory/envelope gates prevent a production-readiness claim; facade delivery and visual review are scoped separately.

## Local reproduction

The task used a dedicated local Chrome profile (`/tmp/codex-facade-final-chrome`) through browser-harness at port 9224. A plain Python server serves the working tree at 8000; a preserved `git archive` of baseline `698bd51` is served at 8001. The main image workflow is `tools/capture.py` with `QUERY=weather=clear`, stops `5`, `9.5`, `11`, and day/night themes. `MOBILE=1` uses a 375×812 CSS-pixel viewport at DPR 2.

```sh
rtk test node --test tests/
BU_NAME=facadefinal BU_CDP_URL=http://127.0.0.1:9224 browser-harness < /tmp/facade-final-checks.py
BU_NAME=facadefinal BU_CDP_URL=http://127.0.0.1:9224 browser-harness < /tmp/facade-final-resource.py
BU_NAME=facadefinal BU_CDP_URL=http://127.0.0.1:9224 browser-harness < /tmp/facade-final-captures.py
```

The temporary check runner opens a fresh same-origin fixture document with the repository import map and disables network caching. It executes the repository test assertions unchanged. The capture wrapper executes `tools/capture.py` with error listeners and closes each finished task tab. These local runners/artifacts are supporting evidence, not application dependencies.
