# Full-scene graphical reform — baseline evidence (2026-11-03)

Baseline captures and temporal clips for Task 1 of the [graphical reform plan](../../superpowers/plans/2026-11-03-full-scene-graphical-reform.md). The companion [design specification](../../superpowers/specs/2026-11-03-full-scene-graphical-reform-design.md) lists the observations and proposals. This index holds evidence only. It is not a GO/NO-GO and not a performance measurement.

## Provenance

| Item | Value |
|---|---|
| Revision | HEAD `e9225d4`, branch `feat/site-gamefication` |
| Working tree at start | Only untracked file: `docs/superpowers/plans/2026-11-03-full-scene-graphical-reform.md` (the plan). No tracked file was edited during capture. |
| Server | `python3 -m http.server 8000` (PID 60337), repository root, `http://localhost:8000/`. Left running. |
| Browser | Chrome attached through browser-harness 0.1.13. Viewport 1728×963 CSS px. Screenshots are device pixels (3456×1926). The renderer canvas measured 2592×1444 in-page. |
| Scene defaults | Desktop NPC3D on by default (`min-width: 768px` and fine pointer). `weather=clear` or `weather=rain` by query. Theme set through `localStorage`. |
| Tools | `tools/capture.py` unmodified. ffmpeg 8.1.2 (`/opt/homebrew/bin/ffmpeg`), libx264. PIL 12.3.0 in the browser-harness Python. `sips` for JPEG conversion. |
| Asset sources | Approved sources in [`ASSET_SOURCES.md`](../../../ASSET_SOURCES.md). Local `assets/`: `landmarks/`, `models/`, `npc/npc_pack.glb` (9.7 MB), `processed/` (`buildings`, `landmarks`, `vegetation`, `vehicles`), `trees/park-atlas.png`, `vehicles/`. No asset was downloaded or imported for this task. |
| Not run | Mobile 375 px, WebGL-off, reduced motion, EN/PT, Lighthouse, performance profiling. |

Full-resolution PNG originals (3456×1926) were kept outside the repository, because twelve of them come to about 65 MB. The committed images are 1728-px-wide JPEG derivatives (`sips`, quality 90), and the grid images are 2304 px wide (quality 88). Regenerate the originals with the commands below.

## Capture commands

Clear set (stops 5, 9.5 and 11, day and night):

```bash
cd <repo> && OUT=docs/evidence/full-scene-graphical-reform SHOTS="5:day,5:night,9.5:day,9.5:night,11:day,11:night" GRID=1 QUERY=weather=clear browser-harness < tools/capture.py
```

Rain set (same stops and framing, written to `rain/` so it does not overwrite the clear set):

```bash
cd <repo> && OUT=docs/evidence/full-scene-graphical-reform/rain SHOTS="5:day,5:night,9.5:day,9.5:night,11:day,11:night" GRID=1 QUERY=weather=rain browser-harness < tools/capture.py
```

`tools/capture.py` waits for `world-ready`, hides `#panel`, `.bar`, `header` and `nav`, scrolls to each stop, waits 7 s, and writes one screenshot per stop and theme. Stop 5 is São Paulo, 9.5 London and 11 Glasgow. The grid order follows the shot order: row 1 is 5-day and 5-night, row 2 is 9.5-day and 9.5-night, row 3 is 11-day and 11-night.

## Image index

| File | Stop | Theme | Weather | What it shows |
|---|---|---|---|---|
| [`5-day.jpg`](5-day.jpg) | 5 São Paulo | day | clear | MASP frame, curved office tower, Estaiada X and cable fan, bus lane with ambient cars, pearl Mini with a red roof near the crossing |
| [`5-night.jpg`](5-night.jpg) | 5 | night | clear | Lit windows, street lamps, moon, bright Estaiada edges |
| [`9.5-day.jpg`](9.5-day.jpg) | 9.5 London | day | clear | Big Ben and Parliament, London Eye, river, two red double-deckers, phone boxes, plaza |
| [`9.5-night.jpg`](9.5-night.jpg) | 9.5 | night | clear | Lit Eye rim and pods, lit Big Ben, warm lamp pools |
| [`11-day.jpg`](11-day.jpg) | 11 Glasgow | day | clear | City Chambers, equestrian Wellington statue, University spire, Riverside saw-tooth roof, purple StreetDeck, flags |
| [`11-night.jpg`](11-night.jpg) | 11 | night | clear | Riverside roof outline, bus headlight glare, lit sandstone windows |
| [`grid.jpg`](grid.jpg) | all six | day and night | clear | Contact sheet of the clear set |
| [`rain/5-day.jpg`](rain/5-day.jpg) | 5 | day | rain | Overcast sky, rain streaks, darker wet asphalt |
| [`rain/5-night.jpg`](rain/5-night.jpg) | 5 | night | rain | Wet lamp pools, Estaiada edges |
| [`rain/9.5-day.jpg`](rain/9.5-day.jpg) | 9.5 | day | rain | Eye rim against a pale sky |
| [`rain/9.5-night.jpg`](rain/9.5-night.jpg) | 9.5 | night | rain | Eye pods and rim at night |
| [`rain/11-day.jpg`](rain/11-day.jpg) | 11 | day | rain | Misted backdrop, wet street |
| [`rain/11-night.jpg`](rain/11-night.jpg) | 11 | night | rain | Riverside outline and bus headlight in rain |
| [`rain/grid.jpg`](rain/grid.jpg) | all six | day and night | rain | Contact sheet of the rain set. All six frames render. |

Defect crops, cut from the full-resolution originals at native resolution:

| Crop | Source frame | What it shows |
|---|---|---|
| [`defects/estaiada-night-bloom.jpg`](defects/estaiada-night-bloom.jpg) | `5-night` | Estaiada pylon edges bloom to white strokes |
| [`defects/eye-pods-night-overexposure.jpg`](defects/eye-pods-night-overexposure.jpg) | `9.5-night` | Eye pods and rim clip to near-white |
| [`defects/riverside-roof-emissive-outline.jpg`](defects/riverside-roof-emissive-outline.jpg) | `11-night` | Saw-tooth roof outlined by an emissive stroke |
| [`defects/glasgow-road-glare-pool.jpg`](defects/glasgow-road-glare-pool.jpg) | `11-night` | Flat elliptical glare pool beside the bus headlight |
| [`defects/masp-underside-dark-band.jpg`](defects/masp-underside-dark-band.jpg) | `5-day` | Unmodelled dark band under the MASP frame |

The crops do not establish root causes. The specification states which items are hypotheses.

## Stops not covered

The clear and rain sets cover stops 5, 9.5 and 11 only. Copan, Sé, Tower Bridge and Wembley are not shown in any baseline frame.

## Temporal clips

Both clips come from the running build, with `?qa=1` for in-page telemetry. That flag only adds NPC diagnostics and frame counters (`js/world/npc3d.js`, `js/world/scene.js`); it does not change the scene. Frames were captured with CDP `Page.captureScreenshot` at the browser's pace, roughly 5 per second. They were then assembled with ffmpeg (libx264) using the measured frame intervals, so each mp4 plays at real time with uneven frame spacing.

| | A: fixed camera | B: tracking camera (NEAR) |
|---|---|---|
| Video | [`clips/fixed-stop5-day.mp4`](clips/fixed-stop5-day.mp4), 8.2 s, 0.8 MB | [`clips/npc-tracking-stop11-k0.mp4`](clips/npc-tracking-stop11-k0.mp4), 5.9 s, 3.2 MB |
| Contact sheet | [`clips/fixed-stop5-day-contact.jpg`](clips/fixed-stop5-day-contact.jpg) | [`clips/npc-tracking-stop11-k0-contact.jpg`](clips/npc-tracking-stop11-k0-contact.jpg) |
| Metadata and samples | [`clips/fixed-stop5-day-meta.json`](clips/fixed-stop5-day-meta.json) | [`clips/npc-tracking-stop11-k0-meta.json`](clips/npc-tracking-stop11-k0-meta.json) |
| Query | `?npc3d=1&qa=1&weather=clear` | `?npc3d=1&npcnear=1&qa=1&weather=clear&npcshot=0` |
| Stop, theme, weather | 5 São Paulo, day, clear | 11 Glasgow, day, clear |
| Camera | Fixed at (−19.26, 39.00, 58.27). Maximum drift over the clip: 0.000 m | Tracking: 6 m behind walker 0, 1.6 m high, looking at 1.0 m. The camera moves with the walker: its maximum displacement from the first sample is 4.60 m, as expected for tracking |
| Frames | 41 in 7.97 s. 5.02 fps achieved. Mean screenshot 185 ms | 32 in 5.93 s. 5.23 fps achieved. Mean screenshot 175 ms |
| In-page render counter | 678 world frames during the clip, about 85 fps | 355 world frames during the clip, about 60 fps |
| Subject | Traffic in the lower lane and pedestrians at distance. No wheel close-up | Walker 0, a light-blue top and jeans, centred in the frame. Walker rendered in all 32 frames; median distance to camera 6.19 m |
| Speed | Vehicles: base speeds in `js/world/ambient.js` `SPEED` (m/s): mini 13, car 13.5 (scaled 0.9–1.1 per vehicle), London, Glasgow and São Paulo buses 10, cab 13. Not measured per vehicle | Walker 0: measured world speed from telemetry, median 0.78 m/s, 90th percentile 0.80 m/s |
| Lighting | Day, clear. Same scene as [5-day](5-day.jpg) | Day, clear. Same scene as [11-day](11-day.jpg) |

Limits:

- About 5 fps is too coarse for stride timing or foot contact. Task 2 needs a faster capture before judging gait.
- In several frames of clip B a tree canopy crosses the upper frame, because the tracking camera passes beneath a street tree. That is an occlusion by vegetation, not a walker defect.
- The "blue-shirt" identity is from visual inspection of the contact sheet. It is not read from the material data.
- No audio. No mobile or WebGL-off variant.

## NEAR camera at stop 5 (no usable walker)

The same tracking camera at stop 5 failed to show a walker. The contact sheet covers walkers 0–9 ([`clips/npc-near-stop5-failed-scan-contact.jpg`](clips/npc-near-stop5-failed-scan-contact.jpg)). Indices 1, 2, 4, 7 and 8 show canopy foliage across the centre. Indices 0, 3, 5 and 6 show sky and facades. Index 9 is dark. No walker is centred in any of them. The telemetry still reported each walker at 6.18 m, so the camera's line of sight was blocked by trees and buildings. The close-up clip therefore uses stop 11.

## Method notes

- `tools/capture.py` was not modified. Its screenshots are of the viewport after scrolling, so the clip issue below does not affect them.
- A first attempt at the clips produced blank white frames. `Page.captureScreenshot` takes its `clip` in document coordinates. After scrolling to a stop, the clip has to start at `scrollX` and `scrollY`, otherwise it grabs the white top of the page. The clips above were recorded with that correction.
- The capture loop and the assembly script stay in the session scratchpad and are not committed. Their steps are described above, and the telemetry they wrote is in the metadata files.
