# Graphics improvement TODO (2026-10-27)

Graphics only (no tests/deploy work in this list). Source: fresh captures of 18 shots (11 stops by day, 4 at night, 3 in rain, 2 on mobile)
and a per-system audit against the North Star (`docs/audits/full-scene-visual-atlas.md`). Order = visual impact over effort.
Each item becomes its own brief/prompt when picked; map, routes, lot footprints and landmark sightlines stay frozen.

## Current grades

Sky B+ · Rain B- · Distant skyline C+ · Building variety B · Houses B · **Trees C+** · Pedestrians B- (GLB in progress) ·
Vehicles B · Landmarks day B+ / night B+ · **Plazas & furniture C+** · Roads B- · Water B · Night lighting B- · **Mobile framing C**

## Phase 1: first impression (hero + everywhere)

1. **Hero frame (stop 0)**: the city edge floats (sky visible under the buildings on the left) and a bare beige slab fills the
   foreground. Close the edge (ground/backdrop under the skyline), dress the slab (trees, planters). M · high.
2. **Trees**: the foreground trees are spiky shard billboards and the mid-distance ones are thin lollipops. Make the crowns round
   and dense, and plant many more along the SP avenues and plazas (North Star: dense round street trees). M · high.
3. **Plazas & street furniture**: the plazas are empty slabs. Add planters, rows of benches, kiosks, paving inlays and flowerbeds
   (instanced, data-driven). M · high.
4. **Traffic density**: only 1–3 vehicles show on screen and the SP streets look dead. Raise the ambient density and add parked
   cars at the kerbs (reuse the Mini/cab/fleet GLBs). S–M · med-high.

## Phase 2: depth and variety

5. **Distant skyline**: it reads as a flat grey band of boxes. Add 2–3 layered silhouettes with a tint and haze gradient and a few
   taller towers per city. M · med-high.
6. **Glass & roofs**: every tower has the same teal-navy glass, the London east towers repeat as clones, and the roofs are
   near-black. Vary the glass tint and roof colour per building (deterministic, shared materials). S–M · med.
7. **Clouds**: the same 3 puffs appear in every shot. Seed the shapes and positions per region and stop. S · low-med.

## Phase 3: night and weather

8. **Night roads & lamps**: the asphalt is pure black, the lamp pools are hard-edged discs with no halo, and the headlight beam is
   a smeared blob. Lift the road albedo at night, soften the pool falloff, add bloom on the lamp heads and fix the headlight cone.
   M · high.
9. **Rain puddles**: the blotchy black masks read as ink stains on the roads and as camouflage on the pavements. Soften and break
   up the mask, tint it with the sky, and cap the near-camera rain streaks. S–M · high in rain.

## Phase 4: ground detail

10. **Kerbs & asphalt**: the kerb edges are serrated with black gaps and the daytime asphalt is too dark. Use a continuous kerb
    strip and a lighter, slightly textured asphalt. S–M · med.

## Phase 5: mobile

11. **Mobile portrait framing**: the bus is tiny or out of frame and rooftops fill about 40% of the frame. Add a portrait camera
    preset (closer, lower tilt) and check the facade texture filtering (texels show as stair-steps). M · high on mobile.

## In progress elsewhere (do not duplicate)

- **Pedestrians → source-derived GLB figures**: `docs/superpowers/specs/2026-10-27-glb-pedestrians-design.md` and the plan
  under `docs/superpowers/plans/`. Working tree: `assets/glb/`, `tools/people/`.

## Small known vehicle leftovers

- Mini: a black wedge in the headlamp reflector and lumpy roof shading (close-ups only).
- Bus: the door frames sit flush rather than recessed; the bus is 0.4 m longer; the far-side blind shows through the upper glass.

Evidence: scratchpad audit (`audit/diagnosis.md`, `audit/{day,night,rain,mobile}/`), regenerate with `tools/capture.py`.
