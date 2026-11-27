# Visual realism audit, 2026-11-24 (desktop only, no code changed)

Historical audit only. Its owner-approval labels and proposed gates describe that review's process; current user requests set active scope, with no standing visual freeze or rollout approval policy.

Evidence: 12 renders at 1440x900 (stops 5 São Paulo, 7, 9.5 London, 11 Glasgow; day and night; a `?npcnear` pavement camera; Glasgow re-shot with `weather=clear` because the first Glasgow "day" came out rainy), plus `tools/perf/route-profile.py` runs. Tags: **[O]** observed in a render, **[H]** technical hypothesis (read in code, not proven), **[X]** experiment to prototype. **Not observed:** walk cycles, foot contact and any motion quality (only stills were taken), Wembley, Tower Bridge close-up, a true dusk state, Lighthouse/a11y. Run on Sonnet 5.5 with no subagents: I chose not to dispatch them because the inspection was one camera path and the weekly-usage cap was not checked, so this is a disclosed substitution for the four requested specialists. Priorities P0 on findings 1 and 3 are reclassified below as OA (owner approval) after checking the approved docs.

Constraints honoured: no quality selector or runtime downgrade ("LOD adaptativo" is read as *static* distance LOD at fixed quality), townhouse language untouched, no new regions/archetypes without owner approval (marked **OA**), whole-city reflection stays off (measured +8.4 ms), no new dependency.

## A. Executive diagnosis

The scene is competent but reads as a **well-lit diorama**, not a city. Light, shadow, atmosphere and vehicles are already good. What gives it away is *surface and colour*: every facade is a clean, saturated, evenly-gridded plane; glass is one flat cyan; ground is uniformly clean; trees are small and sparse; and the far field is a few rows of toy boxes. Nothing is weathered, nothing is dirty, nothing is dissimilar to its neighbour except by hue. Under it sits an unresolved performance question (below) that must be settled before adding anything.

Top blockers, in order: (1) translucent stepped "ghost" skyline inside the clouds, (2) flat glass, (3) saturated pastel facades with zero weathering, (4) uniform ground/grass, (5) undersized, sparse vegetation, (6) toy-block far field in Glasgow, (7) no bounce/indirect light on shadow sides.

## B. Scorecard (0-10)

| Area | Score | Why |
|---|---|---|
| Overall realism | 5.5 | Strong light, weak surfaces |
| Art direction | 7 | Coherent voxel-London identity, palette too candy |
| Lighting | 7 | Good sun/shadow/ACES; no indirect, shadow sides flat |
| Materials | 4.5 | Clean, tiled, plastic; glass one hue |
| Architecture | 6.5 | Landmarks good, ordinary lots repetitive in colour |
| Vegetation | 4 | Small, sparse, thin crowns |
| Atmosphere | 6.5 | Clouds and fog good in the pavement view; ghost skyline in aerial |
| Animation | n/a | Not observed |
| Composition | 7 | Aerial framing reads, foreground roofs heavy |
| Immersion | 6 | Crowds and traffic help; ground-level dead |
| Visual consistency | 5.5 | Glasgow far field far more saturated than near blocks |
| Performance | unresolved | See section 6 |
| Identity | 8.5 | Bus, landmarks, three cities are distinctive |

## 6. Performance baseline (re-measured)

Documented baseline (`rendering-budget.md`): 16.7 ms median at 1440x900, DPR 1.5, dedicated Chrome. I reproduced the documented configuration (`CONFIG=qa=1 TIER=high WIDTH=1440 HEIGHT=900 DPR=1.5`, drawing buffer 2160x1350) in the owner's everyday Chrome and got:

| Segment | Median | p95 | Draw calls | Submitted tris/frame (all passes) | JS heap peak |
|---|---|---|---|---|---|
| 4.5-6 São Paulo | 25.0 ms | 33.4 | 1033 | 18.1 M | 1971 MB |
| 10.5-11.5 Glasgow | 33.3 ms | 58.4 | 1444 | 35.7 M | 2021 MB |

Caveat: not a dedicated instance, other tabs and the Browser pane were open, so this is **not** a proven regression. **Gate 0 (P0): re-run on an idle dedicated Chrome (`BU_NAME`/`BU_CDP_URL`) before any visual work.** If it reads ~17 ms the setup was the cause; if ~25-33 ms it is a real regression since the last baseline. Separately, **[H]** the ~2 GB JS heap needs a heap snapshot (chrome-devtools `take_heapsnapshot`) before anyone calls it a leak or a cost. Glasgow at 35.7 M submitted triangles is 2x São Paulo, so it is the budget worst case and the first place to make changes net-negative.

## 9. Findings

Impact = visual impact 1-10. Perf: + positive, 0 neutral, L/M/H cost. Files are starting points, unverified beyond what I grepped.

| # | Problem (tag) | Evidence | Cause | Fix | Alternatives | Impact | Cmplx | Perf | Conf. | Files | Prio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ghost stepped silhouettes inside clouds in every day shot [O]. **OA: this is a deliberate, recent design** (`skyline.js` comments: silhouettes blend over clouds "so cloud edges continue through"; commits bf5f6c5, 07ffd02), so the finding is "approved design reads as an artifact at stops 5, 7, 9.5" | 9.5-day, 7-day, 5-day sky: translucent blocky shapes under cloud | `skyline.js` alpha-blends 3 unfogged box batches (AIR 0.6-0.76 of sky) over the cloud shell, so they read as semi-visible cut-outs | Composite the far rows as fog-matched opaque colour (same inverse-tone as dome) with height-based fade into sky; or drop row 3 | Merge 3 rows into 1 texture-ed band | 8 | Low | 0/+ | High | `world/skyline.js`, `sky.js` | P0 |
| 2 | Glass is one flat cyan tile with black grid, same on every tower, day and night [O] | 5-day, 9.5-day crop; night towers uniformly white panes | Single `glass` surface in the metric atlas, no per-window variation | Per-window hash in the facade shader: brightness, slight hue shift, vertical sky-gradient fresnel from the existing env map, a few open/blinded windows; night: per-window lit probability like Copan | Bake variation into atlas rows | 8 | Med | 0 | High | `building-atlas.js`, `building-finish.js`, `building-slice-materials.js` | P0 |
| 3 | Facade colours are candy: mint, mustard, salmon, powder blue, on top of a clean surface [O]. **Scope: mid/high-rise and backdrop lots only; townhouse palette excluded (approved language). Changing `palette.js` globally is OA** | 5-day, 9.5-day, 7-day | Palette hues chosen per lot with no desaturation or ageing | Pull chroma ~15-25% toward London stock/stone; add world-space weathering in the shader: dark base band, vertical streaks under sills/parapets, per-lot hash tint | Vertex-colour ageing at mesh build | 8 | Low-Med | 0 | High | `palette.js`, `building-finish.js`, `lot-tint.js` | P0 |
| 4 | Ground uniformly clean: grey flagstone with no wear, flat saturated grass strips, no puddles/stains [O] | 5-day foreground, c_trees_day | Single tiling texture per material, no macro variation | Large-scale (50-100 m) noise tint on ground/grass in the shader, kerb-edge darkening, a few stain/patch decals via the existing detail map; grass colour variance | Decal instances (more draw cost) | 7 | Low | 0 | High | `textures.js`, `urban-roads.js`, `wet-surfaces.js` | P1 |
| 5 | Trees small, thin, one-per-gap, crowns tiny next to 6-10 storey buildings [O] | c_trees_day, 9.5-day | Crown diameter capped by `placement.crown`; scale and density tuned for trunk clearance | Raise crown scale on avenues, cluster 2-3, add street-line rows and fuller plane/london-plane crowns; **[H]** shadow cost of larger crowns unmeasured (shadow proxies exist, not checked). Note the North Star plan already shipped "larger fuller trees"; they still read small at 1440x900, so this is a scale retune, not new work | Add 1 larger species | 7 | Low-Med | L | Med | `trees.js`, `tree-mesh.js`, `authored-trees.js` | P1 |
| 6 | Glasgow far field = toy blocks: saturated red/blue/yellow boxes with decal windows, much more colourful than the near houses [O] | 11-day (clear), 11-night blue band | `backdrop.js` row palette includes brick/redBrown/roof at full chroma; 3 skyline bands step abruptly in night blue | Desaturate far rows by depth (ramp chroma down with z); roof-height variance, a few chimneys/pitched roofs; smooth night tone ramp | Replace first row with chunked LOD1 of real lots (OA) | 7 | Low | + | High | `backdrop.js`, `skyline.js`, `palette.js` | P0 |
| 7 | Shadow sides flat: only hemisphere + sun, no bounce [O] | 5-day facades in shade, 9.5 foreground houses | No indirect | Warm ground-bounce term in the facade/ground shaders (normal.y-weighted tint from sun colour, ~0.1), cheaper than any probe; AO pass already runs | Baked per-chunk vertex AO | 6 | Low | 0 | Med | `scene.js`, `building-slice-materials.js` | P1 |
| 8 | River foam looks like white sheets and wedges; reflections smear [O] | 7-day water by the pier | Foam mask is high-contrast opaque | Lower foam alpha, break with noise, tint with water, soften edges | Remove foam on pier | 5 | Low | 0 | Med | `water.js`, `water-math.js` | P1 |
| 9 | Day sky is warm-pink at all stops and smeared in aerial views vs crisp cumulus at pavement level [O]; whether golden hour is a per-stop narrative choice is **unverified [H]**, treat as a question for the owner, not a defect | 9.5-day vs npc camera | Cloud raymarch resolution/blend at grazing angles; glow term | Keep golden hour as an intentional stop mood, but add a neutral midday state; check cloud LOD at low elevation | Per-stop grade | 5 | Low | 0 | Med | `sky.js`, `mood.js`, `post.js` | P2 |
| 10 | Facade grid too even: ordinary mid-rises show a regular window lattice with identical recess depth [O] | 7-day mid-rises | Facade kit repeats one pattern per archetype | Stagger pane bays, vary sill/lintel per floor via the hash, occasional balcony/AC unit/shutters (shader or detail instances) | Per-lot attachments (OA for new archetypes) | 6 | Med | L | Med | `facade-kit.js`, `facade-articulation.js` | P2 |
| 11 | (dropped) The `?npcnear` debug camera clips inside a parked car; not a model defect and not on the shipped camera path | npc camera | Debug camera placement | none | n/a | 0 | n/a | n/a | n/a | n/a | dropped |
| 12 | Walk cycles, foot contact, pedestrian behaviour, vehicle motion | **Not observed** | n/a | Capture a short clip with `?npcnear=1` before judging | n/a | n/a | n/a | n/a | n/a | `npc-*.js` | open |
| 13 | Plane flies large and low, flat white, over rooftops [O] | 7-day | Prop sized for the hero shot | Reduce scale/altitude or add shading variance; low priority | Remove from that stop | 3 | Low | 0 | Med | `plane-path.js` | P3 |

Ideas rejected after thinking: SSR/whole-city reflection (measured +8.4 ms, already shipped off), full GI or probes (compat/complexity far above the gain of a bounce term), WebGPU port (compat risk, no visual gain here), adding high-res textures (the problem is variation, not resolution), adaptive quality (forbidden).

## C. Top 10 (value / cost)

1. Fix skyline ghosts (finding 1).
2. Desaturate and age facades (3).
3. Per-window glass variation and night lit-probability (2).
4. Glasgow far-field chroma ramp (6).
5. Ground and grass macro variation (4).
6. Ground-bounce term (7).
7. Bigger, clustered street trees (5).
8. River foam softening (8).
9. Facade bay stagger and small attachments (10).
10. Neutral midday sky state (9).

## D. Quick wins (hours, shader/palette only, perf 0)

Owner-free candidates: 6 (backdrop chroma ramp, backdrop lots only) and 8 (foam alpha). Need owner approval first: 1 (skyline blend is a deliberate recent design) and 3 (palette; townhouses excluded). None touches geometry or lights.

## E. Structural

Facade shader ageing as one shared pass in the slice materials (3, 7, 10 together); a ground macro-variation texture shared by roads, pavement and grass; tree crown/placement rework (5).

## F. Experimental [X]

- World-space weathering gradient driven by one 3D noise texture shared by all building materials (prototype on the 9 townhouses' neighbours only after approval).
- Baked per-chunk vertex AO for ordinary mid-rises.
- Impostor billboards for the third backdrop row (would cut Glasgow triangles; verify no visible pop at fixed quality).

## G. Roadmap with gates

| Phase | Scope | Acceptance (visual) | Budget | GO/NO-GO |
|---|---|---|---|---|
| 0 | Re-baseline on dedicated Chrome, heap snapshot | Numbers recorded in `rendering-budget.md` | n/a | GO only when baseline is understood and ≤ documented +1 ms p95 |
| 1 | Quick wins 6, 8 now; 1 and 3 after owner approval | Day/night stops 5, 9.5, 11 compared before/after; no ghost shapes; no new console error | 0 ms, 0 draw calls, 0 tris | NO-GO if p95 regresses > +0.3 ms or the identity changes |
| 2 | Glass + facade ageing + bounce (2, 3, 7) | Glass reads varied at 1440x900; townhouse language unchanged; night lit windows varied | ≤ +0.3 ms p95, no extra pass or texture > 1 MiB | Owner approves 3 side-by-side captures |
| 3 | Ground macro variation, trees (4, 5) | Avenues feel shaded; grass no longer one flat green | ≤ +0.5 ms p95, trees ≤ +10% triangles | Owner approval of tree scale |
| 4 | Facade stagger/attachments, midday sky (9, 10) | Mid-rises read as individuals | ≤ +0.5 ms p95 | Owner approval (OA if new geometry) |
| 5 | Experiments (F) as spikes only | Throwaway captures | n/a | Back through the gate |

## H. Proposed art direction

Keep the voxel-London toy-bus premise, but move the whole city from **candy diorama** to **miniature model-maker's city**: slightly desaturated stone, brick and render; dark weathered bases, streaked sills, varied glass reflecting a real sky gradient; warm bounce under eaves; tree avenues with real canopy; the far field fading into aerial haze rather than coloured boxes. The golden-hour grade stays as a deliberate mood, with one neutral midday state for contrast. Landmarks (Big Ben, Eye, Tower Bridge, Glasgow hall, Copan, MASP) stay the saturated hero accents because everything around them is calmer.
