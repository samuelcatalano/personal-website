# Everyday rain refinement — 2026-11-16

Owner selected everyday, discreet rain and authorized all six proposed refinements.

## Design and scope

Retain the city, content, camera, existing weather states, three rain depth layers and budgets. Refine seeded drop lengths/widths/visibility, exposed ground impacts, irregular pooled water, neutral daylight drops and local night lighting, a mild distant rain veil, and shared gentle wind gusts across drops and water. No dependency, texture, render pass, quality downgrade or UI changes. Reduced motion remains static; dry weather removes rain effects; roof exposure remains authoritative.

## Implementation plan

1. Primary: add a bounded deterministic `weatherGust(time, wind)` in `weather.js`, test calm/finite/continuous output. Share velocity with rain and water; no city RNG consumption.
2. Primary: refine `rain.js` shader, retaining one draw and budgets. Exercise real pixel output, HDR finiteness, light response, depth and shelter behavior in existing rain browser tests.
3. Independent agent: only `wet-surfaces.js` and its browser test. Add sparse jittered impacts on exposed damp ground, off-grid puddle ripples, irregular pool edges and softer damp-road response. Share gust input and retain registration/disposal contracts.
4. Primary: tune distant atmospheric rain in `sky.js`, with clear/near-sightline tests; share water gust and test reduced motion.
5. Primary: review agent diff, integrate, run related Node/browser tests and desktop day/night rain/drizzle captures. Check mobile and accessibility fallback behavior proportionate to this multi-system change; no full performance claim without matched timings. Record evidence and limits here.

## Validation ledger

Implemented all six refinements. The main route supplies real sampled kerb segments (20 m intervals); each surface update selects four nearest segments. Irregular pooling is biased within 0.65 m of these kerbs. Other neighbourhood streets retain procedural basin placement. This is an artistic approximation, not a hydrological drainage simulation.

- Related Node checks: 16/16 pass (`weather`, `weather-math`, `water-math`, `preload`).
- Full Node regression: 301/302 pass. The existing `urban-infill` baseline hash fails with actual `e089dc...` vs expected `ffdac0...`. Reproduced the identical failure from an untouched `git archive HEAD` copy; rain changes do not cause it. No snapshot weakened or updated.
- Real browser: rain, wet-surfaces, sky-weather, water-weather and weather-art suites pass. Verified finite HDR/MSAA pixels, neutral daylight drops, greater visibility near night lights, shelter, actual kerb pixel response, dry walls/ground, shared regional wind, reduced motion, disposal and reflection feedback safety.
- Desktop: London drizzle day/night and final rain day/night inspected. Final rain runtime probe: no captured console errors/unhandled rejections and no failed renderer shader programs.
- Review caught ripple-cell clipping and absent curb input; both corrected and retested.
- Mobile: 375 px daytime drizzle inspected; no captured console errors or failed shader programs. EN/PT with WebGL disabled and reduced motion passed; PT with WebGL enabled and reduced motion passed, all with nonempty HTML content and no runtime errors.
- Nearest-kerb influence fades before segment replacement to avoid camera-driven pool popping; a fixed-view pixel continuity test covers the selection boundary.

## Cost and limits

Rain remains one draw, with existing high/medium/low maxima of 1,080/450/210 ribbons. No new render pass, texture or dependency; wet surface shaders add four bounded kerb-distance calculations and procedural impact math. No full-scene FPS or GPU-memory claim: matched frame timings were not measured. Existing medium/reduced-motion animation policies remain; surface impacts are shading effects, not airborne splash meshes. Weather probabilities and storm presets remain unchanged.
