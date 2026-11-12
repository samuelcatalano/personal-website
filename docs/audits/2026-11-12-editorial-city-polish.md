# Editorial city polish — 2026-11-12

## Authorized boundary

The owner requested implementation of review items **3, 4, 5, 6 and 7**: panel hierarchy, consistent visual language, desktop framing, atmospheric depth and selected-stop emphasis. Items **1 (mobile redesign) and 2 (intro redesign) were explicitly excluded**. This authorization reopens only the systems described here, without moving lots, landmarks, routes or pedestrians and without new assets or dependencies.

## Changes

- Hero reading order is name, role, specialization/experience, value and contact; humour and availability are secondary. Existing fonts, copy and avatar remain. Desktop secondary contact links lose their large bordered cards.
- Desktop reading surfaces use 8px radii, controls 4px and a shared lighter shadow. Red identifies primary actions; route/country and stack colours retain their existing meanings. The reading ticket no longer tilts with pointer movement.
- The selected career ticket precedes the timeline and the compact current-role summary. Its company, role, dates, location and contribution come from the existing EN/PT stop data. The desktop timeline is a bounded navigation list which reveals the selected row, keeping keyboard focus visible alongside the leading ticket. Progress, filtering, next-stop actions and visit punches remain connected to the same stop indices.
- Desktop hero/follow/high shots aim lower to reserve vehicle margin. London xDesign/OLM shots use +18m lateral camera offset and +20m/+8m aim offsets for parallax; Glasgow gets an additional 0.8 lift. Shot blending uses both endpoint stop IDs, maintaining interpolation. All 84 checked mobile shot combinations exactly match HEAD.
- The skyline retains three instanced row batches, the same boxes and shared geometry. One shared shader program blends the silhouette bases into the live sky/fog horizon, with decreasing row contrast. It follows clear/rain and day/night palettes without applying scene fog twice.
- Existing fog starts at `(150 - 10 × night) × regional fogK` and ends at `(740 - 100 × night) × regional fogK`. Night hemisphere fill is 0.68 rather than 0.60. The existing grade uses lower contrast/saturation. No new lights, textures, geometry or postprocessing passes.
- Desktop medium now retains 2× MSAA on the existing composer targets; high stays at 4×, mobile medium stays at zero. Resize reapplies the viewport policy. This uses extra multisample storage/bandwidth on desktop medium; physical VRAM was not measured.
- The 800px header already extended its controls to x=959.6px on baseline CSS. Allowing its existing navigation strip to shrink and scroll fixes this overflow without changing mobile navigation.

## Verification

- **235 Node tests passed**, including mobile camera invariance and desktop framing logic. `git diff --check` passed.
- `tests/panel-focus.browser.py`: selected ticket precedes timeline/current role, content matches the selected stop, humour follows contact actions, selection/translation retain visible focus, repository/contact/credits focus survives rebuilds; an aborted theme-transition ready promise is handled without an unhandled rejection.
- `tests/interface.browser.py`: 375px overflow/navigation, EN/PT content and labels, career selection, contact access and 800px header bounds. Its state assertions now use reduced motion: the old scroll check raced an ongoing navigation glide, reproduced without any language change (scrollY 58.5 → 82.5). Production glide timing was not changed.
- `tests/camera-framing.browser.py`: real Three.js projection of a conservative 13m × 4.5m × 4m vehicle envelope across eight desktop shots, inside the viewport and clear of the 420px panel/header. Clock-face placement and the Copan roof also clear the viewport/header. This checks projection, not world-geometry occlusion.
- `tests/city-depth.browser.py`: clear/rain at day, transition and night, live horizon binding, three instanced skyline rows and real shader compilation/WebGL error checks.
- `tests/sky-weather.browser.py`: sky/fog seam, celestial occlusion, static reduced-motion clouds/stars and shader compilation.
- `tests/render-resources.browser.py`: high/medium rendering and single disposal at 1280px and 375px; verified 4/2 desktop samples and 4/0 for explicitly constructed high/medium mobile fixtures. Normal mobile startup selects medium.
- Preexisting water files/tests are byte-for-byte unchanged relative to their starting diff. Existing Tower Bridge water integration in `scene.js` is preserved; this task only changes the camera call and skyline horizon update there.

Browser checks use the local preview, bypass the service worker for current source and use real Three.js. The interface checks intentionally disable WebGL; standalone rendering checks restore the original context factory. An initial stale service-worker capture was discarded and recaptured with network/service-worker bypass.

## Local performance evidence

One eight-second medium-tier route sample at 1280×800 DPR 1, clear weather, stops 8.5–11.5 measured **17.2ms median / 33.4ms p95 before**, versus **24.6 / 34.2ms** at an intermediate checkpoint. Median submitted calls changed from 1,517 to 1,928 as the camera exposed different geometry. The checkpoint precedes the final Glasgow framing adjustment. These runs are **not an isolated shader/MSAA comparison or a final performance GO**.

To isolate MSAA, a stationary Glasgow camera compared 0/2/2/0 samples in one settled scene, two short runs each. All four medians were **25.0ms**; p95 was **33.3–33.4ms**. Sample counts varied (121/87/48/64 frames), so this establishes no measurable difference in the sampled median/p95, not equal GPU cost or a general FPS guarantee. The existing full-scene and hardware limitations still apply.

Raw local captures, logs and performance samples: `/tmp/editorial-city/`. Retained evidence:

- [São Paulo, London and Glasgow — desktop day/night](../evidence/editorial-city-polish/desktop-day-night.jpg), rows in that order.
- [Hero PT](../evidence/editorial-city-polish/hero-pt-day.jpg), [London PT day](../evidence/editorial-city-polish/london-pt-day.jpg), [London PT night](../evidence/editorial-city-polish/london-pt-night.jpg).
- [Browser checks](../evidence/editorial-city-polish/browser-checks.txt), [MSAA comparison](../evidence/editorial-city-polish/aa-profile.json), [route before](../evidence/editorial-city-polish/route-before.json), [intermediate route](../evidence/editorial-city-polish/route-intermediate.json), [final PT capture/console record](../evidence/editorial-city-polish/console-check.txt).

Final desktop captures cover the hero and stops 5, 9, 9.5, 10 and 11, including day/night in all three cities and PT hero/London views. Captures were visually inspected. Final PT capture recorded no browser errors. An intermediate hidden-tab theme transition exposed an existing rejected `ready` promise; the handler now catches that expected reveal abort and has a regression check.

**Scoped result:** implemented and verified locally. Existing water work is preserved. No deployment or global performance/production-readiness GO.

## Limits

No Lighthouse, physical mobile, rain route capture or full performance benchmark. Mobile received regression/resource checks, not a redesign. No global production-readiness claim, commit, push or deployment.
