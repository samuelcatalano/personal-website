# River Boats Visual Design

## Intent

Improve the seven existing river boats so their silhouettes and details read clearly in the wide city view, while matching the approved stylized-realism art direction.

## Goals

- Give the seven existing boats three recognizable procedural silhouettes: passenger launch, cabin cruiser, and service boat.
- Add restrained hull, deck, rail, roof, and window details using the existing shared mass/trim/glass materials.
- Preserve the seven placements, their existing palette variation, and their current bob/rock animation.
- Keep the models light enough for the existing city scene and readable by day and night.

## Non-goals

- Add boats to Pinheiros or any other river; do not change boat count, placement, heading, movement, or animation.
- Change river geometry, shader, colors, banks, bridges, routes, landmarks, lighting, or water effects.
- Add external assets, textures, dependencies, render passes, or lights.
- Add or run mobile tests; user requested normal desktop validation only.

## Approaches

- One upgraded silhouette for all seven: smallest change, but keeps the repeated outline that limits the current view.
- Three procedural silhouettes with shared materials and bounded details: chosen. It improves distance readability while preserving the existing procedural pipeline and resource sharing.
- Imported unique boats: rejected because assets add licensing, loading, and resource costs without being needed for this stylized scene.

## Constraints and acceptance

- Keep all seven boats inside the existing Tower Bridge opening and below its road deck.
- Test must verify seven instances, all three styles represented, and three different geometry signatures.
- Validate desktop captures around London in day and night, and run relevant existing regression checks. No mobile validation.
- User request reopens visual work only for these seven boats; other frozen city visuals remain out of scope.

## Builder decisions

Use the existing boat geometry builder and landmark mass/trim/glass buckets. Choose the exact low-poly details and which existing boat receives each style, keeping the style distribution balanced and preserving the current four paint palettes/scales where practical.
