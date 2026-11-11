# City facade realism

## Owner request

On 2026-11-11 the owner requested more realistic facades for all houses and buildings and explicitly selected Astra with light reasoning effort. This reopens ordinary architecture facade work, including the previously approved townhouse language, within existing building envelopes.

## Visual contract

Make architecture read as constructed buildings: visible glazing behind frames, physical opening depth, credible sills and facade relief, restrained masonry finish, and variation consistent with each region. Treat exposed rear and side elevations as designed facades. Preserve solid party walls where buildings meet.

Cover the existing townhouse, shop, midrise, office and tower families, authored kit and procedural fallback paths, legacy building controls, standalone houses and the distant urban backdrop. Distant detail may remain economical and should be reviewed at its actual viewing distance.

## Runtime contract

- Preserve lot descriptors, footprints, height envelopes, routes, roads, landmark positions and sightlines, pedestrians, planting, camera and global lighting.
- Retain shared materials/maps, deterministic variation, mass/trim/glass batching and existing LOD/culling/disposal behavior.
- Keep valid fallback geometry when authored kits cannot load.
- Use existing Three.js and browser APIs; add no dependencies or rendering passes.
- Keep the accessible HTML content and EN/PT copy unchanged.

## Validation

Before implementation, capture the existing scene and run the Node suite. After implementation, run focused geometry/material contracts, the complete Node suite and applicable browser checks. Review matching route captures for Sao Paulo, London and Glasgow by day and night, plus facade close-ups and a 375 px viewport. Inspect console errors and measure the structural resource change. Check affected reduced-motion and WebGL-disabled behavior; do not infer physical mobile/GPU performance from desktop emulation.

Record the final implementation, exact commands, metrics and any unverified cases in the facade audit. Visual acceptance depends on rendered evidence, not only geometry counts or passing tests. Do not push or deploy as part of this request.
