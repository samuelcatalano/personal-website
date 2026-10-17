# Pedestrians

**Status:** design approved in chat on 2026-10-17 (approach A).

## Goal

People walk in both directions on the sidewalks and on the large paved areas, so the city feels alive. They are men, women and children with realistic proportions (not Minecraft's large heads), varied skin tones including Black people, and varied hair (short for most men, long for most women) in brown, black, blonde and grey. Children have the same variety.

## Look

- Blocky "Minecraft-style" people with real proportions. An adult is about 1.75 m tall (1.6–1.9 m) and a child about 1.1–1.3 m.
- Body parts: head, hair, torso, 2 arms, 2 legs and shoes.
- **Hair:**
  - Short hair is a cap.
  - Long hair is the cap plus a block down the back, reaching the shoulders or below.
  - Some men are bald or grey, and some women have a bun or ponytail.
- **Skin:** at least 6 tones, from very light to very dark.
- **Clothes:** varied, from palette or neutral colours.
- **Walking:** legs and arms swing in opposite phase, with a light vertical bob. In reduced motion, people stand still and do not swing.

## Placement

- **Sidewalks:** both sides of the road, in two lanes per side (one for each direction), along the whole route. They walk on the paving, never on the road, and keep clear of the stop signs and plaques.
- **Plazas:** walkers loop on the large paved areas the user marked:
  - the MASP plaza;
  - the new Paulista stretch before the Copan;
  - the Thames riverside between the river and the road;
  - the Wembley plaza.

  They never cross buildings, landmarks, water or the road.
- **Count:** about 160 people (roughly 70% adults and 30% children), split between São Paulo and London.

## Technique (approach A)

- One `InstancedMesh` per body part. Each part carries per-instance colour (`setColorAt`) and is drawn with a shared unit box and the existing triplanar block material, so there are roughly 9 draw calls in total.
- Each frame the CPU updates each instance matrix from the person's path position and the walk phase.
- People outside a radius around the camera are not updated. Their matrices are left as they are, which keeps the update to O(visible).
- Everything is deterministic: placement and looks come from a seeded `rng`.
- New module `js/world/people.js` exposes `createPeople(scene, { curve, pts, stops, reducedMotion }) → { update(dt, camPos) }`. It is wired into `scene.js` like `createAmbient`.

## Out of scope

Collisions between people, crossings at traffic lights, interaction, and faces.

## Tests

- **Node:** tests for the pure data, which are look generation (each person has proportions in range, children shorter, hair matching the profile, at least 6 skin tones used) and paths (no point on the road band; plaza paths stay inside their rectangles).
- **Browser** (`tests/people.browser.py`):
  - instances exist;
  - they move after `update`;
  - they are frozen under reduced motion;
  - none sits on the road;
  - draw calls rise by at most 12.
- **Visual:** a check by the controller at a São Paulo stop, a London stop and Wembley, day and night.
