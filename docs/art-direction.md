# 3D city art direction

## Sky and weather — 2026-10-26

The owner reopened sky/weather in the [five-slice brief](prompts/2026-10-26-sky-weather-upgrade.md). Sky uses an art-directed zenith/mid/haze gradient aligned to the visible upper frame, warm directional glow and purple/orange theme transitions. Horizon and fog share the exact colour. All authored sky colours pass through the existing ACES inverse; puddles and river consume the dome's final palette, including sunset and storm-night dimming.

Feathered procedural density billboards replace flattened sphere clusters: blue-grey bases, illuminated tops/rims, high cirrus and a continuous low overcast layer. Sun has a restrained soft halo; the always-full moon has smooth maria and limb shading. Stars vary in brightness, size and tint. Overcast veils celestial objects; rain completely hides them.

Weather rolls independently once per page: São Paulo 25%, London 45%, Glasgow 70%. Clear rolls retain regional cloud variety. São Paulo gets warmer, heavier/faster rain; London steady grey drizzle; Glasgow cold persistent drizzle. `?weather=rain` and `?weather=clear` override all regions. Rain darkens the sky/key and shortens fog while keeping cool fill and bus readability. Three depth layers use camera-following ribbons, bounded gust motion and actual nearby lamp/headlight influence. Distant sheet lightning is a single restrained 0.45-second cloud patch at intervals of at least 20 seconds, gated by regional storm strength.

Shared upward-facing ground/roof materials darken and become smoother when wet. World-space puddle masks reflect the current analytic sky and nearby lamp/bus highlights. Exponential wetting/drying time constants are 1.2 / 7 seconds. Ground impact rings/splash glints and river rings run only on high. High uses four reflected lamps; lower tiers use two and fewer drops. Wet air broadens existing lamp pools; no new lights, passes, external assets or dependencies. Reflections approximate sky/lights and cannot reflect scene geometry or model occlusion.

Reduced motion keeps the regional roll and static wet/storm appearance, with no falling drops, drifting clouds, twinkle, lightning or rain ripples. [Validation record](audits/2026-10-26-sky-weather.md) tracks measured gates separately from art direction.

> **2026-10-21 update:** the user reopened the visual freeze for the North Star full-scene upgrade. Current state: [visual atlas](audits/full-scene-visual-atlas.md), [plan](plans/north-star-full-scene-upgrade.md). Vehicles, all landmarks (London Eye now continuous), lighting, roads and vegetation were upgraded; approved building families are unchanged. The coplanar-face blocker below is resolved (0 pairs).

**FINAL VISUAL GO — approved and frozen2026-10-21.** Stylized realism, polished city-builder quality, low/mid-poly architecture. The user approved all five building families, citywide architecture/diversity, lighting/atmosphere, vegetation/public realm, glass/water and Wembley/Big Ben-Parliament/MASP. No further visual development is authorized. London Eye's segmented geometry is an accepted limitation and remains unchanged.

Technical release is separate: [final validation](architecture/rendering-budget.md#final-milestone-validation--2026-10-21) records the unresolved coplanar-face regression; do not interpret visual approval as a passing technical gate.

## River boats — 2026-10-28

The user reopened visuals only for the seven existing Thames boats. Their procedural silhouettes may change; all rivers and water, bridges, routes, lighting and other frozen city visuals remain unchanged.

**2026-11-09 initial owner update:** the seven Thames boats were replaced with the authored Mercury Clipper GLB at uniform 0.40 scale (14.148 m long, 3.454 m wide), initially keeping existing moorings and headings. River foam bounds follow the replacement envelope; the existing reflection pass and day/night environment are reused. Desktop day/night captures, shared-resource/fallback/disposal checks and Tower Bridge clearance passed. Mobile was not tested. See `assets/uber-boat/README.md` for evidence and visual limitations.

**2026-11-09 river placement correction:** the owner reduced the fleet to five, solely on the Thames. Three face east and two west in separate lanes at river centre ±4 m. Placement ends at London’s suburban edge; Pinheiros and Clyde remain boat-free. Scale, river geometry, camera, menu and loading are unchanged.

## Visual principles

- Believable proportions and human scale; clear facade hierarchy and clean silhouettes.
- Real depth in windows and doors; restrained architectural detail and consistent material identity.
- Use geometry when it affects silhouette, depth or occlusion. Prefer maps for microdetail.
- Shared materials, textures and geometry; controlled variation instead of unique resources per building.
- Preserve map composition, clear paths and unobstructed landmark views. Never place infill in front of protected landmarks.
- Global lighting is a separate task. This direction does not authorize changing the scene lighting, bus, pedestrians, routes or landmarks.

## Approved townhouse language

- Brick ground floor and plaster upper floors; three floors in the validated recipes.
- Human-scale entrance, recessed windows and lighter frames.
- Cornices and gable/slate roof; restrained profiles.
- Two structural recipes, three controlled palettes and subtle deterministic glass/emissive variation.
- The polished townhouse slice and subsequent batched family are the approved reference. Do not redesign them without an explicit request.
- LOD0 preserves the established depth and detail. LOD1 must read as the same building farther away, preserving silhouette, roof, facade rhythm and material identity.

The supplied city image remains **ART DIRECTION**, not a scene to copy literally, a replacement background or authorization to add a landmark. Follow the established [architecture](architecture/3d-city.md) and [resource budgets](architecture/rendering-budget.md). Historical visual proposals remain in docs/superpowers/; use this document for the current approved direction.

## Final citywide art pass — 2026-10-21

Buildings/recipes/chunks/LOD and skyline composition are frozen. The authorized art pass adjusts only existing sky/sun/hemi controls, exposure/fog, ground palette/curb geometry, vegetation and existing garden beds. Warm daylight is balanced by neutral-blue fill and a cooler horizon; Glasgow retains overcast/rain. Shadow maps/filter/resolution and sun direction stay unchanged: lighter shadows come from fill/key balance, not a claimed new penumbra system. Existing box clouds become low-poly rounded clusters.

Broadleaf atlas and tree centres stay unchanged; varied tint/size/atlas choice and one low understory batch enrich vegetation within original canopy footprints. New shrubs stay below1m and outside paths. Existing hero lawn ends gain low planting inside the same ground/furniture/water buckets. Ground greens are muted, paving warmer, asphalt cooler/darker; curb dimensions follow tangent extents instead of square blocks. No building material maps, assets, dynamic lights, camera or routes changed. Visual GO subsequently approved by the user; North Star remains direction, not a literal match.

## Material/landmark finish pass — 2026-10-21

The user approved the preceding buildings/rollout/art pass and froze geometry, recipes, batches, LOD, layout and cameras. This material-only pass adds analytic sky/ground reflection to the same opaque shared glass, brighter glass atlas albedo and preserved emissive window states. Day/night uniforms use existing controls. No cubemap, SSR, transparency, external asset or new pass. River checker cells become a continuous shallow/deep gradient, subtle moving normals and restrained sky/sun highlights on the same two-triangle plane.

`landmark-materials.js` tunes existing world material roughness/metalness/edge contrast for Wembley, Big Ben/Parliament and MASP envelopes; masks use existing world coordinates and preserve materials, geometry and transforms. Finish/night uniforms are updated before rendering. This does not redesign silhouettes.

Historical material-only result: landmark silhouettes were still NO-GO at this stage. The separately authorized geometry modernization below and final user approval supersede that visual gate; London Eye is explicitly excluded and accepted unchanged.


## Approved landmark geometry and final freeze

Wembley uses a continuous tapered bowl, open elliptical roof, recessed glazing/ground entrances and continuous tubular arch with structural supports. Big Ben retains four clock faces and gains a tapered roof/pinnacle hierarchy; Parliament has articulated major masses, recessed pointed openings and roof rhythm. MASP retains its suspended volume/free span, with two red portals and longitudinal edge girders. All preserve anchors/envelopes and reuse the existing shared atlas without another material polish, external assets or new lights.

The final five normal/diagnostic smoke views (main, skyline, Wembley, London, MASP) preserve the approved result. No new polish or rollout occurred during the final milestone. Physical mobile remains unvalidated; runtime-dependent metrics and the concrete technical blocker are tracked in the rendering budget.

## Glasgow and horizon update — 2026-10-23

The user reopened the rural Glasgow/country fill and distant horizon: replace farms, wind turbines and broad green backdrops with varied urban houses, sandstone tenements and midrise flats, paved streets and small bounded gardens. Preserve the route, roads, lot footprints, landmark sightlines, walking paths and roof shapes. The aggregate triangle-count ceiling was removed, so it is no longer a pass/fail gate; roof geometry remains unchanged. No GO is declared before root validation.

## Tree and planting refresh — 2026-10-31

The owner reopened the graphical quality of existing trees and plantings. Tree placement, centres, height/clearance envelopes, paths, garden footprints, and landmark views remain fixed. Five procedural crown families (round, columnar, spreading, flowering, conifer) now have distinct LOD0/LOD1 geometry and matching LOD2 impostor silhouettes. Existing park beds use shared instanced flowers, shrubs, and hedges; hero and rural pocket gardens reuse low planting within their existing lawns. Variation is deterministic; no external image assets or dependencies were added. This update supersedes the prior tree note only where it described a single billboarding style or a single understory batch.

## Owner-supplied tree models — 2026-11-03

The owner authorized replacing the five procedural tree silhouettes with deterministic authored trees. Desktop review found variants from the supplied Mighty Oak and Tree GN GLBs still read as sparse, fragmented foliage at game scale, so both are excluded from runtime. The full-canopy Realistic Tree is used at existing tree placements with two instanced geometry LODs and a single-tile impostor atlas. Existing tree centres, footprints, paths, height/landmark-clearance envelopes and understory planting remain fixed. Preparation, optimization and attribution are recorded in `tools/vegetation/README.md` and `ASSET_SOURCES.md`.


## Portfolio panel graphic pass — 2026-11-09

The owner requested a graphical refinement of the portfolio while preserving menu controls and the intro/loading screen. Panels retain the existing Hammersmith One/Inter typography, warm-paper and night palettes, and city accents. The profile uses a compact portrait/name lockup, a clearer professional statement and a separate status strip. Recent experience has its own hierarchy; project/article rows use editorial dividers and restrained technology badges; recommendations use lighter quote treatments. All new copy remains in EN/PT content data. Small labels use the theme's primary ink for contrast. No assets, dependencies, 3D geometry, camera or menu/loading styles were added or changed.

Desktop validation: 215 Node tests passed, including existing content contracts; the panel browser test passed at 1280px and now checks that the London clock is populated immediately after rebuilding the profile. Captures at 1440×900 covered profile, journey, projects, articles and recommendations, plus EN/PT and day/night profile states. The profile fits the tested viewport; checked panels have no horizontal overflow. No mobile viewport/emulation tests, Lighthouse or performance benchmark were run.

## Streetscape polish — 2026-11-10 owner authorisation

The owner requested all seven proposed refinements: subtle paving joints/perimeter bands, regional paving tones and module sizes, selected recessed shop displays and thresholds, small objects within existing cafe footprints, restrained paving-edge dirt, commercial/residential night hierarchy, and shared gentle wind for foliage and awnings. Preserve map, routes, building envelopes and landmark views. This pass does not reopen skyline composition or townhouse design. See [implementation and validation](audits/2026-11-10-streetscape.md).

## Initial plaza — 2026-11-10

Owner authorised the pictured plaza refinement: neutral stone joints replace dark rails in the paving; a circular stone apron and shaped basin establish the meeting point; low water arcs and restrained ripples animate the fountain. Six benches form paired seating, low green clusters and pale flowers enrich the existing beds, four peripheral posts replace the competing park/realm pole layout, and the existing tunnel portal gains warm stone coping and low outer planters. Preserve tree positions, the two walking corridors, road profile and tunnel clearance. [Validation](audits/2026-11-10-hero-plaza.md).

### Initial plaza — seating and planting polish, 2026-11-10

Owner authorised further refinement of the same plaza. Seating pockets, discreet stone sectors around the fountain, warmer timber, denser pale flowers and layered low greens reinforce the existing composition. Preserve the trees, routes, fountain/portal positions and the restrained night palette. [Validation](audits/2026-11-10-hero-plaza-polish.md).

### Fountain water — 2026-11-11

Owner authorised visibly moving, more realistic water. Keep low six-way jets and the existing basin: streams narrow and sway subtly, small waves spread from their landing points, pale foam stays near impacts, and shallow stone-floor detail appears refracted under angle-dependent reflections. Night keeps restrained warm rim bounce; reduced motion holds a still state while WebGL stays active. [Validation and motion preview](audits/2026-11-11-plaza-water.md).

## Ordinary facade realism — 2026-11-11 owner authorization

The owner requested more realistic facades throughout the city and reopened the previous townhouse restriction for this pass. Preserve architectural family identity and existing envelopes. Exposed side/rear elevations now have designed openings, frontages have clearer sash/lintel/drainage detail, commercial grids have bounded relief and quieter metal finishes, and glazing retains shallow interiors behind the frame. Upper-wall weathering is restrained; low-level dampness remains. Existing distant skyline silhouettes stay economical. Map, routes, landmarks, vegetation, pedestrians, camera and global lighting remain unchanged. [Rendered evidence and limits](audits/2026-11-11-facade-realism.md).

## River arch bridges — 2026-11-11 continuity correction

Owner approved a continuous 7.5 m crest from each livery-change arch through the far river bank, preserving bus and boat clearance. Only the land entry and far-bank exit descend to ground; the former intermediate valley is removed. Low heritage lanterns sit on the existing parapet caps, sharing instanced geometry and warm emissive night heads/halos through `setNight`, with no new dynamic lights or render pass. [Validation and limits](audits/2026-11-11-river-bridges.md).

## Bridge masonry finish — 2026-11-11 owner request

Both livery-change bridges gain restrained ashlar joints and shallow approach pilasters, lighter radial arch surrounds and coping, continuous deck cornices and discreet base courses. Existing aligned parapets and channel/bus clearance remain. Low lanterns pair with warm additive patches on the elevated level roadway through the existing night control, with no new dynamic lights or render pass. Far-bank exits extend from 14 to 28 m, halving peak grade. [Evidence and limits](audits/2026-11-11-bridge-finish.md).
