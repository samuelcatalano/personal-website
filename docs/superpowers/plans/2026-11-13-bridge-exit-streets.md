# Bridge Exit Streets Implementation Plan

**Goal:** Replace the trial portals with curved streets behind the London/Glasgow rear blocks, concealing traffic recycling.

**Spec:** [Selected street design](../specs/2026-11-13-bridge-exit-streets-design.md).

**Architecture:** Pure surveyed route data and two cottage relocations in `bridge-exits.js`; Three.js centerline/merged road geometry in `bridge-street.js`; `underpass.js` assembles the same buckets and shares street metadata with `underpass-traffic.js`. `country.js` applies only the explicit two-lot relocation without changing RNG order.

**Constraints:** No new dependencies/lights/passes, no mobile, preserve main route/deck and existing bridge clearances. Keep unrelated loading/theme work. No commit/push.

**Review focus:** Tight London gap and facade overhangs; vehicle body/turn swept width; road contact and lamp projection; full-body occlusion before wrap; immutable neighbouring lots and unchanged deterministic IDs/counts.

- [x] Survey rear block envelopes; choose two cottage relocations in London and clear route in Glasgow.
- [x] Replace portal regressions with road continuity, lot clearance, wrap occlusion and steering checks; observe red.
- [x] Build centerlines and merged streets, relocate the two cottages and steer traffic using shared curves.
- [x] Extend the owner's selected concept to Estaiada; preserve its 65 bridge stations and two deck material meshes, adjust four source centres and share traffic stations.
- [x] Validate Node and related browser suites, desktop day/night, actual scene lots and route-camera occlusion; capture evidence.
- [x] Scoped review and audit; remove superseded portal artifacts and leave work uncommitted.

Owner's later Estaiada request extends the initial two-city scope. Implementation choices: four bounded São Paulo source-centre shifts open its corridor; all building counts/envelopes remain. The common curve builder generates geometry only when its owning road assembly asks for it.

Independent review approved with no actionable findings. [Results and known inherited Wembley test mismatch](../../audits/2026-11-13-bridge-exit-streets.md).

After desktop review, the owner requested committing all pending site refinements, including loading/theme work. No push requested.
