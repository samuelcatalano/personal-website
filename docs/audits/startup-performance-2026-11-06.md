# Startup performance — 2026-11-06

**Local GO.** The measured startup bottleneck is fixed without lowering rendering quality. No deployment was performed.

## Findings and changes

1. `holes.js` probed the entire scene for each ray used to discover tunnel-cut materials. Every ray scanned every instance in city-wide batches. This caused an 8.65–8.76 s main-thread task before most vehicle/NPC requests even started. A conservative world-space bounds pass now selects nearby ground-level mesh/instance candidates once per hole; the original rays, height tests, material hooks and clipping shader remain unchanged. Nested tunnel exclusions and ray layers remain respected.
2. The default vehicle path downloaded full raw GLBs, even though Meshopt decoding already existed. Seven full-quality compressed derivatives now preserve vertex/image bytes, ordered triangles and winding (cyclic triangle-index rotations are equivalent), transforms and material/rig metadata. No weld, simplify, reorder, quantize, normal rebuild, image resize or image recompression is used. Original files remain the failure fallback. The older simplified GLBs still require explicit `?glb=processed`.
3. Ambient, parked and underpass traffic requested the large fleet before the startup NPCs and landmarks. At simulated 20 Mbps, the NPC deadline expired and the scene started without them. Startup NPCs now finish before bulk traffic requests; startup landmarks are requested ahead of bulk fleet downloads. All original models still load.

## Measurements

Chrome, local Python static server, 1440×900 at DPR 1, fixed existing rendering policy, network cache disabled. CPU sampling and diagnostic hooks were active in both before/after runs. The metric is navigation start to `world-ready`, with at least one rendered QA frame. It is not time until every background vehicle finishes loading.

| Stage | Runs | Ready range | Median | Completed GLB payload observed |
|---|---:|---:|---:|---:|
| Original | 3 | 11.176–11.345 s | 11.202 s | 147.15 MiB |
| Tunnel discovery fix only | 3 | 2.770–2.969 s | 2.918 s | 147.15 MiB |
| Plus lossless vehicle compression | 3 | 2.828–2.907 s | 2.893 s | 101.24 MiB |
| Plus critical-download priority, final | 3 | 2.460–2.525 s | 2.493 s | 101.24 MiB |

Final local median improves **77.7%** against the original. Longest startup task falls from about **8.7 s to 1.1 s**. All recorded profiling runs reported zero uncaught page errors/rejections. Payload figures use resource entries completed two seconds after readiness; they are not a complete hosted-session traffic budget.

Exploratory 20 Mbps / 40 ms latency check, cold cache: after the CPU/compression fixes but before request prioritization, **14.194 s with NPCs absent**; after prioritization, **11.658 s with NPCs installed**. This is one recorded before/after check, not a calibrated network benchmark. Incomplete background transfers are excluded from the resource-byte totals for these throttled runs.

The seven compressed vehicles total **81.33 MiB instead of 127.25 MiB**, saving **45.92 MiB / 36.1%** for those assets. Geometry/texture residency on the GPU is intentionally unchanged; this is not a VRAM or steady-state FPS optimization.

## Validation

- Full Node suite: **169 passed, zero failed**.
- `tests/vehicle-loading.test.mjs`: compressed-first selection, original-source fallback, shared in-flight cache, complete failure, and compatibility with buses/explicit simplified opt-in. Observed RED before implementation and GREEN afterward.
- `tests/holes.browser.py`: real Three.js compatibility with original ray material selection, translated/rotated parent transforms, excluded nested tunnel meshes, disabled layers, height rejection and multiple shared hole uniforms. 3,000-instance fixture makes zero whole-batch raycasts and reads each instance transform once per hole. Observed RED before the optimization.
- `tests/startup-priority.browser.py`: held NPC request prevents bulk fleet downloads; authored startup landmarks request before bulk fleet; full NPCs install and the world renders. Observed RED with the original request order.
- Seven generation round trips verified decoded vertex/image data and metadata. A regenerated Nissan derivative matches the shipped compressed file byte-for-byte.
- Real-GLB wheel audit: **19 static vehicle types and 10 moving types passed**, including raw-source geometry truth for the regional fleet.
- Desktop hero/tunnel day/night and 375 px mobile tunnel day/night captures inspected. No intentional visual or rendering-tier reduction.
- `tests/startup-smoke.browser.py`: EN/PT accessible HTML with WebGL disabled, and PT WebGL startup with reduced motion; all passed with zero uncaught page errors/rejections.
- Python/JavaScript syntax checks and `git diff --check` passed.

Raw timings and resource/CPU samples: [evidence directory](../evidence/startup-performance-2026-11-06/). Capture locations: `/tmp/startup-final-desktop/`, `/tmp/startup-final-mobile/`. Reproduce profiling with `CACHE=cold RUNS=3 OUT=/tmp/startup.json browser-harness < tools/perf/startup-profile.py`; add `MBPS=20` for the network check.

## Limits

About 101 MiB of GLBs still download across the complete local scene; source complexity, GPU memory and long-distance fleet loading remain substantial. No universal load-time/FPS promise, physical-phone test, hosted/CDN measurement, steady-state benchmark or Lighthouse run is claimed. An attempted NPC compression was rejected by its exact rig-transform check and was not retained; the original NPC asset and its rendering stay unchanged.

Some diagnostic attempts failed because of harness navigation timeouts or a test fetch wrapper that did not handle URL objects. Those checks were corrected and rerun; the measurements above use completed saved runs. Existing unrelated NPC/guardrail working-tree changes were preserved.
