# Weather art-direction refinement — 2026-11-12

Owner authorization: implement all seven recommendations in the current chat. The map, architecture, routes and UI layout remain fixed. No dependency, external asset, additional light or render pass was introduced.

## Result

1. Continuous zenith/horizon colour and a diffuse opening in overcast skies; storm palettes remain readable.
2. Existing cloud billboards gain varied proportions, smooth lobe shading, directional illumination and wind-dependent drift. Alpha clouds composite locally over celestial objects, while city geometry retains depth occlusion.
3. Sun diameter falls from 150 to 100 world units and its halo is restrained. Viewport/header-aware framing also applies at 375 px. The framed astro azimuth drives the existing key, texel-snapped shadows and water glint. Key elevation is bounded above ground: this is artistic camera composition, not an astronomical elevation model.
4. Moon diameter falls from 100 to 64; its generated texture uses a fixed gibbous phase, dim unlit limb and existing maria. Stars have less twinkle and fade toward the horizon. Dense overcast hides celestial objects; partial cloud alpha provides local occlusion.
5. Rain uses shorter/finer ribbons, depth/intensity-dependent density and existing lamp/headlight illumination. Existing high/medium/low maxima remain 1080/450/210 ribbons in one batch.
6. Asphalt and pavement get different wet roughness, patchiness and puddle thresholds. Reflections and the night moon glint are restrained. One shared roof/deck field suppresses falling drops, ground impacts and river rings under cover. Existing wetting/drying constants remain 1.2/7 seconds.
7. `clear`, `cloudy`, `drizzle` and `rain` states retain independent visit rolls and regional rain probabilities (25/45/70%). São Paulo favours heavier showers; London and Glasgow favour drizzle. Existing clear/rain override values are preserved; `?weather=cloudy` and `?weather=drizzle` make the other states reviewable. Palettes, precipitation and wind ease at separate rates. Reduced motion keeps the static climate without falling drops, drift, twinkle, flashes or impact animation. Existing rare lightning remains bounded.

## Evidence and checks

- Full Node regression: **240 tests passed**, no failures or skipped tests. New tests cover moon/framing/visibility math, oriented overlapping shelter envelopes, four weather states and temporal/reduced-motion mood behaviour. Modulepreload integrity passes.
- Final browser suites: `weather-art`, `sky-weather`, `rain`, `water-weather`, `wet-surfaces`; all passed. [Raw component output](../evidence/weather-art-direction/browser-final.log).
- Real-pixel assertions: sun RGB sum **607 → 0 → 607** as a cloud covers and leaves it; falling-rain RGB sum **9728 → 0** under the test roof. Shared texture identity, idempotent disposal, moon phase, shader compilation and desktop/mobile header clearance pass.
- Supplemental browser suites: panel focus, interface EN/PT and fallback, camera framing, city depth, render resources at desktop/375 px; all passed. [Raw regression output](../evidence/weather-art-direction/regression-final.log).
- Integrated capture matrix: São Paulo/London/Glasgow, day/night, all four weather states, 375 px and reduced motion. No captured console/runtime errors or failed renderer programs. Final cloud shading was subsequently checked in four standalone rendered sky fixtures and a fresh integrated London cloudy capture; a fresh London rain/night capture checks the final source too. These are local browser/emulation checks, not physical-device certification.
- Reviewable generated images: [final sky fixtures](../evidence/weather-art-direction/sky-fixtures.jpg), [London cloudy](../evidence/weather-art-direction/london-cloudy.jpg), [London rain/night](../evidence/weather-art-direction/london-rain-night.jpg).

## Resources and performance limits

One shared **512×256 R8** data texture adds **131,072 bytes (128 KiB)** without mipmaps/downloads. Integrated field occupancy is 24,249 cells. Rain, wet materials and water reuse it; scene teardown disposes it once. No new renderable is added for shelter. Roof heights are quantized to 0.5 m; horizontal precision depends on the whole-city bounds.

Short local route samples use medium tier, 1280×800/DPR 1, day/rain, route 8.5–11.5, 8-second scroll, cache disabled and service-worker bypass. Baseline is clean commit `afebd55`, served from an archive with unchanged shared assets; after uses the current source. Samples retain all timing outliers.

| Sample | Frames | Median / p95 ms | Max ms | Calls median | Triangles median |
|---|---:|---:|---:|---:|---:|
| Baseline rain | 272 | 25.1 / 34.3 | 841.6 | 2204 | 16.46 M |
| After rain | 249 | 33.3 / 41.7 | 74.6 | 2834 | 20.25 M |

The baseline recorded a hidden-tab interval; after recorded none. The changed key orientation also changes shadow-caster workload. These single runs indicate a **possible slowdown**, but do not isolate shader cost or establish a stable A/B percentage. Earlier samples with unpinned theme/background pauses were rejected. Raw samples: [baseline](../evidence/weather-art-direction/baseline-rain-final.json), [after](../evidence/weather-art-direction/after-rain-final.json).

**Local functional/visual GO; performance approval remains open.** No FPS guarantee or production-readiness claim. Physical mobile, GPU memory, repeated undisturbed performance pairs and Lighthouse were not measured in this scoped weather pass. No push/deployment performed.

## Known approximations

- Shelter uses existing lot envelopes plus underpass, MASP and Tower Bridge deck bounds. It is not mesh collision: pitched roofs, eaves, holes, moving objects, wind-driven side entry and unlisted small canopies are approximate. Road reflections under shelter retain a small residual dampness; direct puddles/impacts are blocked.
- Fixed moon phase and above-ground key elevation are deliberate art direction. Skyline geometry may legitimately hide the framed sun/moon.
- Existing analytic/planar reflections remain approximate and do not gain arbitrary scene reflection or weather physics.
