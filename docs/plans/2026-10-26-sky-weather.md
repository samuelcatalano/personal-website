# Sky and weather implementation

Spec: [owner brief](../prompts/2026-10-26-sky-weather-upgrade.md). Owner explicitly requested execution in five vertical slices; no scope/design approval round is needed.

## Global constraints

Plain ES modules, pinned Three.js, no dependency/assets/pass/light additions. Preserve map, buildings, routes, camera, UI and copy. All sky colours pass through `untone`. Reduced motion freezes weather animation. Desktop p95 ceiling +1 ms; emulated mobile +2 ms. Commit locally per validated slice; never push.

## Design decisions

Use a custom analytic dome rather than Preetham: direct palette/ACES control, horizon exactly matching fog. Use procedural feathered cloud billboards (cumulus and cirrus) at existing NDC sky positions rather than many flattened spheres. Rain uses camera-centred layered ribbons, existing fog for mist, and shared-material wet shader injection. Puddles use analytic sky and actual nearest lamp positions; no scene reflection capture. Always-full procedural moon; restrained sheet lightning only while raining. No optional lens flare or Milky Way.

Weather lives in `weather.js`: roll once per region/page, independently, with `?weather=rain|clear` override; mood blends numeric fields. Surface uniforms remain shared and chain existing compile hooks. Water/lamp changes affect weather appearance only.

## Tasks / ledger

- [ ] 1. `sky.js`: analytic zenith/mid/horizon haze, sunset, warm directional halo. Node regression + same eight captures.
- [ ] 2. `sky.js`: soft shaded cumulus, high cirrus, low overcast. Node regression + eight captures.
- [ ] 3. `sky.js`: sun/full moon/varied stars, overcast occlusion. Node regression + eight captures.
- [ ] 4. `weather.js`, `mood.js`, `rain.js`, `scene.js`: stable regional weather, storm lighting/fog, tiered layered rain, subtle lightning. Test deterministic overrides, independent rolls, continuity and reduced motion. Captures + paired performance.
- [ ] 5. `wet-surfaces.js`, `water.js`, `lamps.js`, `scene.js`: lagging wetness, shared material wet response/puddles, nearest light reflections, ground/river rings and splashes, wet-air halos. Browser shader checks, product matrix, paired performance. Update art direction and atlas with evidence and limitations.

## Review focus

Invalid weather override falls back to one stable roll. Rapid scroll never rerolls; discontinuous camera movement never accumulates particles. Reduced motion renders still wet weather without recurring animation. Shader hooks preserve atlas, instancing and landmark finishes. Tier downgrade reduces weather cost immediately. Disposal must not leave world-specific uniforms on cached materials.

## Execution record

- Baseline: clean working tree on `feat/site-gamefication`; full Node regression passes. Baseline snapshot preserved in `/tmp/sky-weather-baseline` for A/B.
- Tools: browser-harness installed and CDP connects; chrome-devtools-mcp and Serena unavailable. RTK 1.0.1 available. Sol owns integration; Luna handles isolated deterministic weather data/tests. Terra is not exposed by the subagent tool.
