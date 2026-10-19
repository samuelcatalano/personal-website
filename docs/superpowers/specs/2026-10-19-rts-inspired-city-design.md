# RTS-Inspired City Visual Evolution

**Status:** Approved conversational design; awaiting written-spec review

**Date:** 2026-10-19

## Goal

Increase the visual depth, detail, and identity of the portfolio's city with visual cues from classic real-time strategy games, while preserving the existing bus journey, landmarks, and accessible portfolio experience. RTS titles are artistic references for composition, scale, map readability, and layering only; their protected sprites, models, and other assets will not be copied.

The project already has rounded trees at varied heights. Keep that treatment, remove/avoid pine trees, and preserve pedestrian routes and clear views of every landmark.

## Current state and diagnosis

The portfolio is a vanilla HTML/CSS/ES-module application. Three.js 0.169 is pinned in the import map; there is no build step or npm dependency. `js/world/scene.js` assembles a procedural Three.js world. The camera uses perspective and follows the bus along the route. World coordinates use X along the route, Y for height, and Z for lateral placement. Geometry is grouped/instanced through `voxel.js`; scenery, parks, trees, landmarks, water, people, and backdrop already have focused modules. The page's HTML panel remains the source of truth and works independently of WebGL.

The visual simplicity mainly comes from repeated box-like silhouettes and materials, broad uniform ground areas, and limited transitions between districts. Adding arbitrary objects would raise clutter without reliably improving depth. The highest-value changes are varied but consistent building silhouettes, better ground/material transitions, and a layered distant city, while guarding the landmarks and paths.

Existing reusable systems include procedural building and landmark builders, instanced geometry, deterministic world generation, tree sprites, route/layout clearance checks, and tests for layout, parks, trees, scenery, and backdrop. No full rewrite or new dependency is required.

## Artistic direction

Keep the existing oblique perspective and continuous bus ride. Borrow from classic RTS maps their readable layers, stable scale, varied silhouettes, restrained palette, and clear routes; do not change the camera into an orthographic/isometric view.

Use a coherent London-inspired urban palette of stone, brick, slate, glass, and controlled green. Keep green for parks and vegetation rather than filling all open ground. Build depth through differences in height and silhouette, ground transitions, shadows, and several layers of distant buildings. Use foreground elements sparingly and never in front of a landmark or across a walking route. Continue using only rounded trees at varied heights; do not add pines.

Scene layers, adapted to the current world rather than implemented as a tilemap:

1. Ground, roads, paths, parks, water, and subtle elevation.
2. Secondary buildings and district structures.
3. Landmarks, with existing visual and spatial priority.
4. Rounded trees and decorative props.
5. Pedestrians and vehicles.
6. Lighting, shadows, atmosphere, and distant backdrop.

## Asset research

All assets below were reviewed at their publisher/source pages. The design prefers CC0 for low-friction reuse. Do not download or include a pack until its individual files have been checked for style, actual dimensions, package contents, and performance in a small visual comparison.

| Asset | Source and type | License, commercial use, attribution, modification | Published resolution / size | Fit and caveats |
|---|---|---|---|---|
| [Nature Kit](https://kenney.nl/assets/nature-kit) | Kenney, 3D nature props; 330 files | CC0. Commercial use and modification allowed; attribution not required (optional) per [Kenney support](https://kenney.nl/support). | Page does not state model dimensions or total download size. | Best candidate for selectively replacing or supplementing procedural nature props. Use rounded trees only. |
| [City Kit: Commercial](https://kenney.nl/assets/city-kit-commercial), [Suburban](https://kenney.nl/assets/city-kit-suburban), [Industrial](https://kenney.nl/assets/city-kit-industrial), [Roads](https://kenney.nl/assets/city-kit-roads) | Kenney, 3D buildings and roads; separate packs | CC0. Commercial use and modification allowed; attribution optional per [Kenney support](https://kenney.nl/support). | Pages publish counts (50 commercial buildings, 40 suburban, 40 industrial, 90 road assets) but do not state file dimensions or total download sizes. | Strong potential fit with existing perspective and geometry. Review scale and material style before selecting; a whole pack is not required. |
| [Isometric City](https://opengameart.org/content/isometric-city) | Kenney via OpenGameArt, 2D urban sprites and spritesheet | CC0; commercial use and modification allowed; attribution optional. | “128x” sprites; exact sheet dimensions not stated; ZIP 990.6 KB. | Useful for reference or a few isolated 2D props. Its isometric projection may conflict with the current perspective if widely used. |
| [Isometric Tiles - Town Pack](https://screamingbrainstudios.itch.io/iso-town-pack) | Screaming Brain Studios, 2D town/building tiles; 443 tiles | CC0; commercial use and modification allowed; no attribution required. | Building sheets use 128 px / 64 px tiles; roof tiles 143×92 px; package about 3.9 MB. | Teal backgrounds and baked lighting require adaptation and may not match the scene. Keep as a comparison candidate, not a default dependency. |
| [City Game Tileset](https://withering-systems.itch.io/city-game-tileset) | Withering Systems, 281 monochrome 2D city/environment tiles | CC-BY; commercial use and modification allowed with attribution. | Individual PNGs 382×805 px with transparent padding; ZIP about 2.6 MB. | Excluded from the initial asset trial because its monochrome style and attribution add friction. |

No pack is selected as a dependency by this design. Prefer one or two CC0 packs only if they improve visual consistency in a small comparison. Do not use the 2D tile packs to replace the 3D city wholesale.

## Technical design

Keep the existing perspective camera, route, coordinate system, Three.js renderer, and procedural builders. `scene.js` remains the composition point. Improve the modules that already own each concern rather than introducing a tilemap, custom isometric coordinate conversion, painter's-order sorting, or new dependency.

Opaque geometry continues to use the Three.js depth buffer and existing instancing patterns. Use transparent sprites only where existing sprite patterns already work, and validate depth testing/overdraw. Keep world placement deterministic. Preserve and extend clearance checks in `layout.js` so buildings, trees, and props do not obstruct paths or landmark sightlines. Do not add UI copy or alter the HTML panel.

Likely implementation surface:

- `js/world/palette.js`, `textures.js`, `water.js`, `parks.js`: district materials and ground transitions.
- `js/world/city.js`, `houses.js`, `voxel.js`: building silhouettes, material variation, and instancing.
- `js/world/trees.js`, `backdrop.js`: rounded vegetation variety and depth layers.
- `js/world/layout.js`, `landmarks.js`: clearance rules and landmark visibility.
- `js/world/scene.js`, `camera.js`: composition/performance tuning only if tests show it is needed.
- Existing `tests/layout.test.mjs`, `parks.test.mjs`, `trees.browser.py`, `scenery-fill.test.mjs`, `backdrop.test.mjs`, and browser world/landmark tests provide the validation base. Add only focused tests for any new clearance invariant or behavior.

## Incremental implementation phases

### Phase 1 — Visual baseline and constraints

- **Goal:** Capture baseline views and establish path/landmark clearance as a hard constraint.
- **Likely files:** `layout.js` and existing layout/clearance tests only if a coverage gap exists.
- **Dependencies:** None.
- **Complexity:** Low.
- **Risk:** Poorly chosen clearance bounds could restrict valid scenery; validate against existing landmarks and routes.
- **Expected result:** Repeatable before/after views and a reliable guard against blocking important sightlines.

### Phase 2 — Ground and palette

- **Goal:** Replace broad uniform areas with restrained variation and clear transitions between street, park, and water; use subtle elevation only where it clarifies the scene.
- **Likely files:** `palette.js`, `textures.js`, `parks.js`, `water.js`.
- **Dependencies:** Phase 1 constraints.
- **Complexity:** Low to medium.
- **Risk:** Excess contrast, noisy textures, or extra geometry could reduce readability or performance.
- **Expected result:** More legible districts and stronger depth before adding more objects.

### Phase 3 — City silhouettes and selective assets

- **Goal:** Add architectural variety using existing procedural builders; compare a small number of CC0 assets and incorporate only assets that match the scene.
- **Likely files:** `city.js`, `houses.js`, `voxel.js`; optional local assets after license/content review.
- **Dependencies:** Phase 2 palette.
- **Complexity:** Medium.
- **Risk:** Scale/style mismatch, larger downloads, excess instance/material batches.
- **Expected result:** A less repetitive skyline and richer street-level buildings without changing landmark composition.

### Phase 4 — Vegetation and depth

- **Goal:** Improve the existing rounded tree variety and distant city layers, keeping routes and landmark views clear.
- **Likely files:** `trees.js`, `backdrop.js`, and clearance/layout tests if needed.
- **Dependencies:** Phase 1 clearance constraints; phases 2–3 style decisions.
- **Complexity:** Medium.
- **Risk:** Tree overdraw, expensive shadows, clutter, or landmark occlusion.
- **Expected result:** More natural parks and a fuller horizon while retaining open paths and recognizable landmarks.

### Phase 5 — Polish and validation

- **Goal:** Tune lighting/shadows and verify the experience across required modes and viewports.
- **Likely files:** `scene.js` and `camera.js` only if visual evidence justifies changes; existing browser tests.
- **Dependencies:** Prior phases.
- **Complexity:** Medium.
- **Risk:** Effects can be costly or can alter camera framing; revert any change that harms readability or smoothness.
- **Expected result:** A consistent finish without compromising the portfolio's primary content.

## Acceptance criteria

- Preserve the bus route, perspective view, and recognizable silhouettes/composition of all landmarks.
- No buildings, trees, or props obstruct landmark views or pedestrian paths; clearance tests pass.
- Use rounded trees at varied heights and no pines.
- Any incorporated external asset is checked at file level for license, contents, dimensions, and size; CC0 is preferred, and any CC-BY use includes attribution.
- Keep HTML content usable with WebGL disabled and `prefers-reduced-motion`; do not change EN/PT copy or add dependencies.
- Verify desktop and 375 px mobile, day/night, EN/PT, WebGL disabled, reduced motion, no browser console errors, and Lighthouse accessibility score at least 95. Preserve the PRD's desktop Lighthouse performance goal of at least 80.

## Explicitly out of scope

- Replacing the perspective scene with an orthographic/isometric map.
- Rewriting the renderer or building a tilemap/depth-sorting subsystem.
- Copying assets from Age of Empires, Age of Mythology, Rise of Nations, or Star Wars: Galactic Battlegrounds.
- Changing the accessible HTML panel, portfolio content, bus route, or adding unrelated scene features.
