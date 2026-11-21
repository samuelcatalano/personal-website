# Samuel spoken wave greeting

Implemented the owner-approved design in `docs/superpowers/specs/2026-11-21-samuel-wave-audio-design.md`. The owner supplied `sam_here.m4a` and requested the speech on every wave while the visitor stays in front of Samuel.

## Implementation

- Local mono MP3, 44.1 kHz, 80 kbps, 4.33068 seconds, 43,930 bytes. Original source preserved; provenance and processing in `ASSET_SOURCES.md`.
- The existing Wave action is returned by `actor.wave()`. `figure.userData.greeting` publishes sequence, visibility and animation phase. Within 60 horizontal metres and the camera frustum, entry resets the action and emits one cue; actual mixer loops emit subsequent cues (7.5-second clip). Departure ends the encounter; re-entry restarts it. No independent repetition timer.
- Scene exposes a read-only `samuelGreeting` getter. The existing 10 Hz driver consumes cues even while muted. `js/audio/voices/samuel.js` fetches/decodes once and plays through the shared people bus, replacing any previous greeting. Cues older than 0.2 seconds, loading/muted cues and failed assets remain silent; no catch-up. Departure fades over 80 ms.
- Reduced motion retains the static raised-hand pose and greets once per entry. Disposal removes the mixer listener. Model, rig, lighting and graphics settings remain unchanged.
- After audition the owner requested successive volume reductions of **15%, 15%, then 20%**. Voice gain changed from 0.75 to 0.6375 to 0.541875 to 0.4335 (**42.2%** below the initial gain), without re-encoding the asset or changing other sounds.

## Verification

- Voice regression first failed with the missing module; actor regression first failed with no greeting cue. Both passed after implementation.
- `node --test tests/`: **318 passed, zero failures**. The four voice tests cover repetitions, overlapping replacement/stale completion callbacks, mute/unmute, late/loading cues, departure/re-entry and HTTP/decode failure. The full suite was rerun before committing at the final approved gain (0.4335): 318 passed, zero failures.
- `tests/samuel-wave.browser.py`: real GLB/AnimationMixer and camera; first entry, 7.5-second repeat, offscreen suppression, re-entry, paused updates and reduced motion passed.
- `tests/samuel-audio.browser.py`: real MP3 decode and shared OfflineAudioContext graph; two scheduled wave cues, silence between recordings, master mute and rainy city/crowd headroom passed. After the first 15% gain reduction, rerun passed: solo peak -3.04 dBFS; combined peak -2.62 dBFS, under the -1 dBFS limit; master mute output zero and the solo inter-wave gap remained silent. Browser checks were not repeated for the subsequent gain-only reductions.
- `tests/samuel-greeting.browser.py`: real click unlock, real actor and 10 Hz driver; stationary encounter produced two recordings for two wave starts, then skipped the third wave with sound muted; no driver error. Long running browser checks use a polled promise to avoid CDP evaluation timeouts.
- `tests/audio.browser.py`: offline reference peak -2.43 dBFS; live Sound on/off, persisted preference and audio signal passed. Whole-route driver observed every expected sound family without errors.
- Self-review covered all wave callers, cue lifecycle, silence paths, disposal, source cleanup and unchanged graphical settings.

The owner auditioned and approved the final volume, then requested a local commit on 2026-11-21. No mobile checks, new FPS benchmark, push or deployment.
