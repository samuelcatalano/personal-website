# Desktop graphics audit — 2026-11-01

Scope: desktop only (1600x900), whole route, day + night. Baseline commit `cf05803`, final `feat/site-gamefication` (see commits below).
Method: reproducible route captures (`tools/qa/route-capture.mjs`, stops 0-13, `?qa=1&weather=clear`), six parallel system audits with
file ownership (render, world, landmarks, vehicles, props, stats), lead integration, full before/after re-capture of the route day and night,
GL-call metrics (`tools/qa/scene-stats.mjs`). Rendering here is SwiftShader (CPU): frame times are relative only.

## Counts
| P | found | fixed | open |
|---|---:|---:|---:|
| P0 | 0 | 0 | 0 |
| P1 | 8 | 8 | 0 |
| P2 | 16 | 13 | 3 |
| P3 | 17 | 2 | 15 |

## Fixed (by system)
- Vehicles: bus destination boards upside down (UV); bus head/tail lamp roles lost to a trailing comment (neon tail bars at noon, Caio headlamps dark at night); Caio tail-lamp quads facing inward.
- Landmarks: London Eye A-frame feet stood in the Thames (now on the bank); Big Ben procedural dial square over the GLB bezel (now round); University plinth read as a canal (now paving); procedural Sé fallback tint.
- Vegetation/props: hairline spikes on every crown (atlas tile bleed); lamps in parks/plazas/Glasgow had no night pool; trunk-bend wedge; park lamp arms all east; phone boxes black at night; plaque pole through stripe; conifers black at night; understory shrubs read as pale boulders.
- World: road lamp inside the Eye's new feet; phone kiosk against the underpass embankment.
- Rendering: moon read as a smiley; anisotropy 16 on noise and building window/facade maps (moire at distance); sun shadow map 1024 -> 2048 (desktop priority; also applies to phones).
- NPC (`?npc3d=1`): hair/brow cards alpha-tested instead of blended (sorting flicker); 16 nearest walkers cast sun shadows; bodies re-assigned at once after a camera jump.

## Open (deliberate)
- P2 W2: two 40+ floor glass towers among low Glasgow rows (stops 12-13): lot heights are data (CLAUDE.md: preserve heights) -> owner decision.
- P2 understory/impostor lighting in trees.js partly done; P2 MASP LOD0/LOD1 texture mismatch.
- P3: shadow coverage ±80 m only; window night blocks on glass towers; cab panel slivers, cab glass facets, bus arch lining, black bus glass by day; Wembley mask bounds; roof tile dots; Copan blank back wall (approved).
- Load cost: raw vehicle GLBs ~130 MB cold (owner choice, `?glb=raw` default kept); orphan `assets/processed/vehicles/mini-cooper-2011.lod1.glb`.

## Performance (GL calls per frame, day, before -> after)
| stop | draws | tris (k) | frame ms median (SwiftShader, relative) |
|---|---|---|---|
| 1 | 495 -> 497 | 3516 -> 3544 | 8250 -> 9266 |
| 3 | 631 -> 631 | 5192 -> 5185 | 9766 -> 10916 |
| 5 | 816 -> 817 | 8112 -> 8121 | 10033 -> 10783 |
| 7 | 578 -> 611 | 4655 -> 4968 | 10000 -> 11133 |
| 9.5 | 732 -> 720 | 6959 -> 6834 | 9533 -> 10316 |
| 11 | 686 -> 684 | 5826 -> 5828 | 8600 -> 5750 (noisy) |
Draw calls and triangles are flat (±2%, stop 7 +6% from extra lamp pools/traffic seed). CPU-rendered frame time rose ~8-12%,
consistent with the 2048 shadow map and more lamp pools; measure on a real desktop GPU before deciding further budget work.

## Not covered
Real-GPU timing, Lighthouse, browser test suites (browser-harness not available in this container), EN/PT, WebGL-off, reduced motion.
