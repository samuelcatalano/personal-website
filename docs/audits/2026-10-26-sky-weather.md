# Sky and weather validation — 2026-10-26

Scope: [owner brief](../prompts/2026-10-26-sky-weather-upgrade.md), [implementation ledger](../plans/2026-10-26-sky-weather.md). Baseline: `7bd38b8`. Local work only; no push. Map, lot geometry, routes, camera, UI and content unchanged.

## Delivered slices

1. `b6bf620`: analytic zenith/mid/horizon, fog seam and directional glow. Projected sky bands preserve the existing downward-looking camera.
2. `ce8aee8`: shaded feathered cumulus, high cirrus and overcast deck; fewer cloud drawables than sphere clusters.
3. `4618d04`: soft sun halo, always-full moon with maria/limb shading, varied stars and overcast veiling.
4. `73573e0`: independent stable regional weather, deterministic overrides, storm lighting/fog, camera-following tiered rain and restrained sheet lightning.
5. Shared wet-surface shader, ground puddles, nearest lamp/bus reflection streaks, impact rings/glints, river rings, slower drying and broader wet-air lamp pools. Validated locally after the scoped performance optimizations below.

No new lights, shadow maps, post passes, external assets or dependencies. Weather resources are procedural. Rain uses one draw with 1,080 / 450 / 210 ribbons at high / medium / low. Reflected lamp count is four on high and two below high. Ground/river rain animation is high-only. Cached material hooks are restored after their last owning scene disposes.

## Checks and captures

- Full Node regression: 115 passed, zero failures.
- Browser suites exercised: `rain`, `sky-weather`, `wet-surfaces`, `water-weather`, `material-polish`, `interface`, `world`. Includes real shader compilation, changed wet-floor pixels with unchanged wall pixels, instancing, cached-material ownership/cleanup, actual nearest lamp positions, exact final dome palette in reflections, WebGL-off, EN/PT, mobile overflow and reduced-motion idle behaviour.
- Final clear/rain captures: São Paulo 5, London 9.5, Glasgow 11, day/night; transition and 375 px mobile. Fractional London capture interpolates marks 9/10; `scrollYForStop` itself accepts integer indices.
- A new HDR regression reproduces non-finite rain pixels under HalfFloat + 4x MSAA. Clamping the tail's fractional-power input fixes it. Disabling bloom revealed black speckles; hiding rain restored the scene; AO/rays were not the cause. Rain/water HDR regressions pass after the fix; corrected São Paulo daytime rain capture is readable.
- Browser runs use cache disabled before navigation. Pixel comparisons use float buffers to avoid quantizing subtle dark-surface changes away. Console errors were absent in the accepted captures. The final actual-app matrix additionally covers Glasgow night, London clear night in PT, 375 px Glasgow day/night in PT, and reduced-motion rain; the static view requested no further animation frames during the idle check.

## Performance

Same seed, scene/camera, EN, theme, resolution/DPR and locked tier in temporary snapshots only. Desktop 1440×900 DPR1.5 high; mobile emulated 375×812 DPR1 medium. Two-second warmup, ten-second samples, three paired repeats per day/night scenario. Frame intervals include browser scheduling and GPU work; they are not isolated GPU timings or a physical-phone guarantee.

| Series | Maximum paired desktop p95 regression | Maximum paired mobile p95 regression | Gate |
|---|---:|---:|---|
| Slice 4, hero day/night | +0.2 ms | +0.5 ms | PASS (+1 / +2 ms limits) |
| Final accepted checks, hero day/night plus Glasgow night | +0.9 ms | +0.2 ms | PASS (+1 / +2 ms limits) |

The first final series exposed a desktop-night paired spike of +7.0 ms; its confirmation included +8.2 ms. Reducing reflected lights to four/two preserved the desktop limits, but a mobile Glasgow pair still regressed +7.5 ms. These failed series are retained. The overcast shader was then found to evaluate cumulus and cirrus before overwriting their results; zero-opacity cirrus also kept drawing. Branching by layer and suppressing those invisible draws preserves the image and removes that work. The affected mobile Glasgow scenario was repeated: paired deltas −7.9 / +0.2 / +0.1 ms.

Accepted checks by scenario (three pairs each, no outliers removed within a listed series):

| Device / shot / theme | A p95 ms (3 runs) | B p95 ms (3 runs) | Largest paired delta |
|---|---|---|---:|
| desktop / 0 / day | 24.3 / 17.3 / 18.0 | 17.9 / 18.1 / 17.7 | +0.8 ms |
| desktop / 0 / night | 25.0 / 23.2 / 25.0 | 25.0 / 17.5 / 25.0 | +0.0 ms |
| desktop / 11 / night | 25.0 / 24.9 / 25.0 | 17.6 / 25.8 / 25.3 | +0.9 ms |
| mobile / 0 / day | 9.2 / 9.5 / 9.4 | 9.4 / 9.5 / 9.2 | +0.2 ms |
| mobile / 0 / night | 9.1 / 8.9 / 9.1 | 8.8 / 8.8 / 9.1 | +0.0 ms |
| mobile / 11 / night | 16.8 / 9.0 / 8.9 | 8.9 / 9.2 / 9.0 | +0.2 ms |

Day rows come from `perf5-verified.json`; night hero/desktop Glasgow rows from `perf5-four-lamps.json`; mobile Glasgow from `perf5-cloud-pruning.json`. After the initial full series, only affected cases were remeasured. The last cloud change removes redundant work with the same visual formulas; it adds no quality tier, pass or render work. Baseline/new frame medians vary with the host scheduling regime (desktop roughly 16.6 ms, mobile 8.3 ms), so only paired comparisons are claimed; large individual frame maxima are retained in the raw files.

Raw local evidence: `/tmp/sky-weather-evidence`. `perf4-clean.json` retains all 24 accepted samples, including mobile scheduling variation and outliers. `perf4-contaminated.json` is explicitly invalidated because earlier preview tabs rendered concurrently. `perf5-final.json` is the interrupted pre-fix series and is not a release comparison. Corrected series and subsequent scoped optimization/confirmation data: `perf5-verified.json`, `perf5-night-confirm.json`, `perf5-four-lamps.json`, `perf5-cloud-pruning.json`. Benchmark hooks/tier locks never enter shipped source.

The integrated source, light-count changes and numerical fixes received independent reviews. The primary agent checked formula equivalence for the final cloud optimization and its red/green browser regression. A bounded Terra review checked branch initialization and cirrus visibility recovery; it did not rerun tests or compare the prior shader. The earlier extra Sol review hit its usage limit and is not counted as a completed review.

## Limits

Agent visual assessment: sky/clouds B+, weather B+. Owner visual acceptance is not assumed. Puddle/river reflections approximate sky and nearby lights without buildings or occlusion; puddles are restricted to ground level to avoid wet patches on shared roof faces. Static wet roofs still respond to roughness/albedo. Physical mobile, Lighthouse, a fresh whole-city architecture regression, and calibrated cold-start timings were not run; this change preserves UI/layout and geometry. Optional lens flare, Milky Way and rain shafts were omitted.

**LOCAL WEATHER GO.** Accepted scoped checks meet the requested p95 ceilings. This is not a universal frame-rate, physical-mobile or whole-site production-readiness guarantee.

## Files

Runtime: `js/world/sky.js`, `mood.js`, `weather.js`, `rain.js`, `wet-surfaces.js`, `water.js`, `lamps.js`, `scene.js`. Tests: weather/mood Node tests; sky/rain/wet/water browser tests plus the existing material-polish water assertion. Art direction, this audit, the visual atlas, implementation ledger and asset-source record document the result.
