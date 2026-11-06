# Swap plaza guardrails

Status: approved by the owner in chat on 2026-11-06; implemented and validated with scoped checks.

## Intent and scope

Make the two exposed plaza edges above the tunnel portals read as protected pedestrian edges. Follow the two green lines in the owner's screenshot. Keep the adjoining sidewalk entrances open.

## Approaches

- **Graphite metal railings — selected by the owner:** vertical bars and a continuous top rail. Matches the existing central lamp/signpost and preserves views into the tunnel.
- **Low masonry parapet with railing:** stronger solid silhouette, but hides more of the tunnel entrances and adds visual weight. Not selected.

## Proposed dimensions and finish

- Height: 1.10 m above the existing paving.
- Square vertical bars, approximately 0.035 m thick, with clear gaps no greater than 0.10 m; substantial end/support posts and a continuous top rail.
- Two straight runs spanning the plaza's width, following its existing local frame at the portal edges (`x = ±half`). Position their thickness inside the existing 0.30 m coping strips.
- Reuse the existing graphite iron material (`#23262b`). Keep the shared lamp material unchanged; use geometry to give the railings a restrained finish.
- No spikes, decorative finials, new textures, lights or dependencies.

Exact member thicknesses may be adjusted during visual validation to remain legible from the normal camera. These dimensions describe scene geometry, not a certified physical installation.

## Implementation boundary

Add the railings to `js/world/swap-plaza.js`, reusing its material ownership and disposal lifecycle. Batch repeated members with shared geometry or merged geometry rather than creating a draw call per bar. Preserve the plaza footprint, paving, signpost, lighting, tunnel geometry and vehicle route.

The plaza walkers already turn inside the protected edges; verify that their simulated positions and separation offsets clear the railings. No new collision system is planned. If clearance fails, make only the local adjustment needed for the plaza walkers.

## Validation

- Focused geometry tests: two protected edges, height, bar spacing, open sidewalk access, and resource disposal.
- Check plaza walker clearance against the inside faces of both rails, including separation offsets.
- Inspect desktop and 375 px mobile captures at the tunnel, including daytime and nighttime visibility.
- Run related tests and `git diff --check`; use scoped visual checks rather than a full performance benchmark.

## Approval

The owner selected the metal-railing approach and approved this short design before implementation.
