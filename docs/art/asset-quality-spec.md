# Asset quality spec

Budgets are set by **screen size × importance**, not by maximizing resolution. Goal: perceived quality of the North Star at realtime cost. Measure: visual information per cost.

## Principles

- Silhouette, depth and occlusion → geometry. Microdetail → shared maps / vertex tint.
- No per-object materials. Vehicles and landmarks share materials by colour/surface (`voxel.js` block materials or the architecture atlas from `building-slice-materials.js`).
- Round things are round: wheels, Eye rim, fuselage, domes use cylinders/lathes/tori with segment counts below — never stacked cubes.
- Deterministic variation (stable hash of position/id); never the layout RNG.
- Textures: generated canvases or CC0 only; mipmaps on; anisotropy ≤ 8; power-of-two.

## Budgets

| Class | Typical screen height @1440×900 | Triangles | Draw calls | Textures | Round segments |
|---|---|---|---|---|---|
| Hero asset (player Mini/bus) | 60–200 px, always visible | ≤ 12k | ≤ 12 (per-colour groups) | shared only | wheels 20–24, lamps 12 |
| Landmark | 150–600 px | ≤ 8k (Eye/Estaiada ≤ 4k) | 3–8 | shared atlas / block mats | rims 64–96, tubes 6–8 |
| Vehicle (ambient) | 20–80 px | ≤ 3k | ≤ 8, shared across all cars | none / shared | wheels 12–16 |
| Airplane | 80–300 px, brief | ≤ 4k | ≤ 6 | none | fuselage 16 |
| Standard building | 50–400 px | existing archetype budgets (see rendering-budget) | chunk mass/trim/glass | 2 mats / 4 maps | — |
| Public realm prop | 5–40 px | ≤ 200 each, instanced | per type batch | none | 6–8 |
| Vegetation | 15–120 px | billboard 2 tris, instanced | 1–2 | 1254² painted atlas | — |
| Background object | < 30 px | boxes | instanced buckets | none | — |

## Resolution

- Architecture atlas 512² at metric UVs: sufficient (texel ≈ 2 cm/px at 1 m tiling). Keep.
- Tree atlas 1254² (≈ 570×585 px per sprite): sufficient for crowns up to ~250 px on screen. Do not upscale.
- Clock faces 256²: sufficient (≤ 60 px on screen).
- Pedestrian atlas: existing HD path; keep.
- No 4K textures. No new texture unless a measured surface shows pixelation at its normal shot.

## Lighting/material targets (North Star)

- Golden-hour key: warm `#ffd7a0`-ish, key/fill ≥ 2.2:1, crisp but soft shadows.
- Sky: saturated zenith blue → warm pale horizon; haze warm, starting farther away.
- Glass: blue/cyan with sky reflection; never grey.
- Asphalt: warm dark grey (not black), painted lines visible at normal shot.

## Acceptance per asset

Recognizable at its normal shot within 1 s (Mini reads as Mini; Eye as wheel, Estaiada as X cable-stayed bridge), no stair-stepping on curved silhouettes, no z-fighting, within budget above, no new console errors.
