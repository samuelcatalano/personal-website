# Samuel Wave Audio Implementation Plan

> Executed inline using executing-plans without subagents. Owner approved the final volume and authorized a local commit on 2026-11-21; no push.

**Goal:** Play the supplied voice once at each visible Samuel wave cycle, including repeated waves while stationary.
**Architecture:** Figure publishes a stable cue state (sequence, visibility, animation phase); world exposes it read-only. The existing 10 Hz sound driver consumes fresh cues and plays one decoded local recording through the existing graph. Three.js owns timing.
**Tech Stack:** ES modules, Three.js r169, native Web Audio, ffmpeg (asset preparation only), node:test and desktop browser-harness.
**Spec:** `docs/superpowers/specs/2026-11-21-samuel-wave-audio-design.md` — owner approved 2026-11-21.

## Constraints

No model/rig/lighting/quality changes, new dependency, independent repetition timer, overlapping speech or late queued greetings. Preserve the original recording. Existing mute and visibility suspension apply. No mobile checks; commit only with owner authorization, no push.

## Tasks

- [x] Add failing voice tests for cue consumption, repeated cycles, stale/muted/late cues, departure, load failure and overlap prevention; implement the minimal voice and prepare the local MP3. Register owner-supplied provenance.
- [x] Add a browser figure regression before changes. Return the existing Wave action from actor.wave(), publish cues on visible entry and Wave loop events, and expose cue state through scene. Verify pause/offscreen/re-entry and reduced-motion behaviour without changing the visual model.
- [x] Wire voice updates before the sound driver's muted early return so skipped cues never replay. Run full Node regression, desktop figure/audio checks and source mix headroom. Update TRD and a concise evidence report; self-review the diff.

## Implementation rulings

- Use a conservative figure sphere in the camera frustum, within 60 horizontal metres, as the greeting encounter; loading at 400 m and rendering at 200 m remain unchanged. This avoids a tiny distant figure speaking before the closing encounter.
- The audio consumer accepts only cues within 0.2 s of the wave start (the existing sound tick is 0.1 s). Late loading/enabling consumes the cue and waits for the next animation cycle.
- Reduced motion emits once per visible entry; an offscreen or hidden actor creates no repeating cue.
