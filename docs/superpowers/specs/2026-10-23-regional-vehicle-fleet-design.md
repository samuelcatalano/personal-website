# Regional vehicle fleet and exclusive player Mini

## Intent and decisions

The user selected ten original Blender-authored traffic models representing vehicles commonly seen during 2020–2026, including earlier generations still circulating. They should be recognizable and realistically proportioned within the approved stylized city, with less detail than the player Mini, cab and buses. The white/cream Mini belongs exclusively to the player. Improve that Mini further, particularly glazing and its surrounding geometry.

The ten-model selection was approved in conversation. Exact representative generations below are proposed builder choices, not claims that each generation leads local registrations.

## Approaches considered

- Seven models: Onix, Corolla, T-Cross, Fiorino, Fiesta, Qashqai and Transit Custom. Less authoring, but less variety.
- Ten models: add HB20, Golf and Corsa. Selected by the user for broader regional character and less repetition.
- Retinting generic body shapes is insufficient: each selected model needs its own recognizable proportions, silhouette, greenhouse and front/rear identity.

## Vehicle selection

| Region | Model | Representative generation / appearance |
|---|---|---|
| São Paulo | Chevrolet Onix hatch | Second generation, circa 2020 |
| São Paulo | Hyundai HB20 hatch | Second generation, 2023 facelift |
| São Paulo | Toyota Corolla sedan | Twelfth generation, circa 2020 |
| São Paulo | Volkswagen T-Cross | First generation, circa 2020 |
| São Paulo | Fiat Fiorino | Brazilian second generation, 2022 facelift |
| UK | Ford Fiesta | Mk8, circa 2018 |
| UK | Volkswagen Golf | Mk7 facelift, circa 2017 |
| UK | Vauxhall Corsa | Corsa F, circa 2020 |
| UK | Nissan Qashqai | J11 facelift, circa 2017 |
| UK | Ford Transit Custom | First-generation facelift, circa 2018 |

This is a representative visual selection, not a complete popularity ranking. Existing registration evidence supports the selection across the period; manufacturer references must establish each chosen model's actual dimensions and visible features before modeling. Do not substitute another generation silently.

Research starting points:

- [DfT/DVLA 2020 vehicle licensing](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/917501/vehicle-licensing-statistics-april-to-june-2020.pdf): circulating UK models, distinct from new sales.
- [DfT/DVLA 2025 release](https://www.gov.uk/government/statistics/vehicle-licensing-statistics-2025/vehicle-licensing-statistics-united-kingdom-2025): fleet age and stock context.
- [SMMT facts 2026](https://smmtweb.lon1.cdn.digitaloceanspaces.com/wp-content/uploads/2026/02/SMMT-FACTS-2026-FINAL.pdf): 2025 new registrations.
- [Fenabrave December 2025](https://www.fenabrave.org.br/portal/files/2025_12_02.pdf): Brazilian new registrations; not a verified São Paulo municipal stock ranking.

## Asset quality and production

- Deterministic Blender scripts, original geometry, GLB export; visual references only, no copied photographic textures or downloaded third-party meshes.
- Complete front/rear/both sides/roof/underside where visible. Proper outward normals; no DoubleSide workaround for missing surfaces.
- Prioritize silhouette, greenhouse/pillars, bonnet and boot/roof shapes, wheelbase/stance, grille/headlights and tail lamps. Clear glass/body/trim separation; minimal interior silhouettes.
- Regional steering position and plate treatment where visible: UK right-hand drive and yellow rear plate; Brazilian left-hand drive and appropriate neutral plate treatment. No complex signage or individually authored registrations.
- Preserve the player's cream body/red roof/stripes identity. Review window fit, curvature, normals, pillar borders, reflections, interior contrast and day/night readability. Fix asset-level defects before compensating with material settings.
- Traffic Minis may share the improved geometry, but never receive a white/cream body. White paint remains allowed on other vehicle models.
- Do not modify the approved cab, London bus, Glasgow bus or A330 assets/materials.
- No arbitrary triangle ceiling. Spend geometry on visible recognition, while retaining few material groups, efficient resource sharing and measured rendering cost.

## Runtime integration

- Extend existing GLTF loading, semantic material mapping and ambient wheel-merging patterns rather than creating another engine or asset framework.
- Load/cache each model once; share geometry/material resources across ambient instances and cache paint finishes by palette.
- Preserve routes, lanes, speeds, crossing behavior, following distance logic, player vehicle transitions and vehicle lifecycle. Update model-specific dimensions/axles/light anchors from authored metre-scale measurements where required.
- Keep the existing traffic population. Select models deterministically from regional pools; ten models need not be visible simultaneously. Ensure every model can be exercised in validation without adding a new UI or changing production traffic rules.
- Current procedural bodies remain load-failure fallbacks. Ambient Mini fallbacks must also obey player paint exclusivity.
- No renderer redesign, global lighting adjustment, new light system or new dependency. Existing night lamp/reflection conventions remain.

## Incremental work and validation

1. Record current vehicle assets, player/ambient color assignments and narrowly scoped baseline captures. Preserve all preexisting working-tree changes.
2. Establish dimensions and multi-angle visual references for each representative generation; record URLs/provenance in existing asset documentation.
3. Author one representative hatch to validate the shared authoring/export/material conventions; then finish the remaining selected models using those conventions with model-specific body geometry.
4. Review complete standalone views in compact contact sheets before runtime adoption. Iterate observed silhouette/identity defects; reject generic recolored shells.
5. Improve the player Mini and verify exclusive body paint across both GLB and fallback paths. Keep protected vehicle assets unchanged.
6. Integrate regional pools, run related asset/traffic contracts and compare normal São Paulo/London/Glasgow cameras. Validate Mini and traffic by day/night, plus multiple instances and loading/disposal/fallback behavior.
7. Measure one representative desktop-high and mobile-medium A/B after integration: frame median/p95, calls, triangles and shared resources. No arbitrary triangle pass/fail cap; investigate material runtime regressions rather than repeatedly benchmarking small edits.
8. Finish with concise evidence, counts per model, remaining issues and visual/performance verdicts. No automatic commit, push or expansion beyond these vehicles.

## Acceptance and limits

- No ambient white/cream Mini, including its fallback; player Mini identity retained.
- All ten models recognizably distinct, regionally assigned and fully modeled; Mini glass clearly improved in the normal camera.
- Cab/bus/A330 protected assets unchanged, no route or global city visual regression, shared loading/resource ownership intact.
- Performance measured under a stated browser/runtime, not inferred from triangle count or guaranteed for physical phones.
- Registration sources do not establish a complete 2020–2026 municipal São Paulo ranking. Model selection is representative, supported by available registration data and generation-specific manufacturer references.
- Small distant vehicles remain limited by the existing renderer's pixel density; no promise of removing all aliasing through mesh changes alone.
