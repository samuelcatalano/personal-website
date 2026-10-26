# Wellington — city-camera statue replacement

## Intent and approved direction

Replace the primitive-based Wellington statue with original Blender-authored geometry exported as GLB. The user selected silhouette quality at the existing normal city camera as the priority. Keep the stylized-realism language of the city.

## Approaches

- Refine current spheres/cylinders: smaller change, but limited anatomical quality.
- Original Blender GLB focused on silhouette: selected by the user; follows the successful vehicle asset workflow without treating the statue as a vehicle.
- Detailed sculpt: rejected for this scope; close-up microdetail is not the target.

## Visual requirements

- Recognizable horse anatomy: curved neck, shaped head/muzzle, articulated legs and hooves, readable tail and saddle.
- Upright rider with coherent proportions, bicorne, coat, boots and reins where visible at normal distance.
- One orange/white traffic cone on the rider's head, following the supplied references.
- Dark bronze with restrained patina/highlights; shaped stone pedestal with simple mouldings. Avoid shiny plastic and disconnected primitive joints.
- Prioritize silhouette, proportions and negative space over medals, facial detail or sculpted relief panels.

## Constraints and integration

- Preserve existing world position, orientation, overall scale, pedestal footprint, paths and landmark sightlines.
- Change only Wellington and its asset integration; preserve all preexisting working-tree changes and other landmarks.
- Original geometry; supplied photos are visual references only. No stock photo pixels or external geometry enter the asset.
- Reuse the existing GLB loading/resource patterns where appropriate; keep the current statue as a load-failure fallback. No dependencies or renderer changes.
- Use a few merged semantic material groups for bronze, pedestal and cone. No new lights or costly render passes.
- Start with a modest geometry budget; add detail only when it improves the normal-camera result. This is not a citywide triangle ceiling.

## Acceptance and economical validation

- Review front, side and three-quarter views for anatomy and complete geometry before integration.
- Main acceptance evidence: before/after in the same normal Glasgow camera; statue must read as horse + rider + cone at that distance.
- Check day/night readability and unchanged bounds/placement; run only the directly related asset/integration check, syntax and git diff --check.
- Record basic triangles, renderables and materials. No broad benchmark, full regression, rollout, automatic commit or push.
- Stop after this statue; do not expand to other landmarks.

## Builder choices

Exact topology, segment counts and subtle bronze roughness are implementation decisions, judged from the normal-camera captures. A close view may diagnose defects but cannot establish visual acceptance by itself.
