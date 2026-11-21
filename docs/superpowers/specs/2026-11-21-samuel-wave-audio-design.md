# Samuel's spoken wave greeting

## Intent and approved behaviour

Play the owner-provided `sam_here.m4a` when the Samuel NPC waves. The owner explicitly wants the speech repeated on every wave while the visitor remains in front of Samuel, and selected synchronization with the actual animation cycle. Current Wave duration: 7.5 seconds. Provided recording duration: 4.330667 seconds.

## Approaches

- **Selected by owner: actual animation-cycle cue.** The existing Three.js animation drives the sound trigger. Rendering pauses and animation timing remain authoritative; there is no independent repetition timer.
- A fixed audio timer was considered and rejected because it can drift from the gesture during pauses, loading and changes in visibility.

## Approved small-change design

1. Use a compact local copy of the supplied recording, preserving the owner's source file and documenting provenance in `ASSET_SOURCES.md`.
2. Loading Samuel at a distance is preparation only. On entering the camera's visible encounter, start a wave and publish its greeting cue; publish another cue at the start of each subsequent 7.5-second wave cycle.
3. Pass the cue through the existing world-to-audio interface. The audio driver plays the recording once per cue through the existing shared audio graph and Sound control. Never overlap recordings or queue missed greetings.
4. Leaving the visible encounter fades out an active greeting. Returning starts a new wave/greeting. Enabling sound halfway through a wave waits for the next wave, rather than playing the recording late.
5. Preload/decode in advance of playback. A failed or late load remains silent for that cycle, with playback possible on the next cue. Hidden-tab suspension follows the existing scene/audio lifecycle.
6. Reduced-motion behaviour: one greeting when the visitor reaches Samuel's static raised-hand pose; no artificial repeating wave or speech timer.
7. Keep the current model, rig, gesture, lighting, existing soundscape and graphics settings. This is greeting playback only; no lip sync or new interface controls.

The owner approved this design on 2026-11-21.

## Verification and scope

Test first-visible greeting, repeated cycles, overlap prevention, mute/unmute, departure/re-entry, load failure and reduced motion. Run `node --test tests/` and relevant desktop browser audio/figure checks, including recording duration and mix headroom. No mobile checks. No commit or push unless requested.

Status: approved and implemented; verification recorded in `docs/codex/2026-11-21-samuel-wave-audio.md`.
