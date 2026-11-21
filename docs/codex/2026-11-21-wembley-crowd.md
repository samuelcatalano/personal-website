# Wembley crowd ambience

Added a generic recorded audience near Wembley, with the existing Web Audio graph. The loop contains applause and collective cheering, filtered for a distant exterior perspective. The source is not represented as a recording of Wembley.

## Implementation

- `js/audio/state.js`: `stadium` gain, bounded by Wembley proximity, 3D presence and tunnel attenuation. Existing pending 15% wind reduction retained.
- `js/audio/index.js`: Wembley uses its existing `LANDMARKS.wembley` stop, with a 0.75-stop approach/fade radius. Updates follow the existing 10 Hz driver.
- `js/audio/voices/stadium.js`: one local fetch/decode and looping buffer source; 1800 Hz low-pass; smooth 0.6-second gain response; routes through the people bus, outside filter, master mute and existing visibility/context suspension. Missing or invalid audio resolves silently.
- `assets/audio/wembley-crowd.mp3`: 30 seconds, mono 32 kHz, 64 kbps, 240,812 bytes. Decoded PCM approximately 3.84 MB. Source/CC0 licence/edits recorded in `ASSET_SOURCES.md`.
- No graphics, renderer, quality settings, dependencies or external runtime API calls added.

Skills: local `find-skills` and `brainstorming`; remote `game-audio` (PlayableIntelligence/game-creator) and `sound-design-foley` (calesthio/generative-media-skills) read as implementation references in the preceding discovery. No global skill installation.

## Validation

- Failing proximity regression observed before implementation; `node --test tests/`: 314 pass, zero failures after implementation. The mix power check now includes maximum Wembley gain.
- `tests/stadium-audio.browser.py`: actual local MP3 decode; expected 30-second reusable loop; audible solo RMS 0.0491; zero output when distant or muted; rainy London mix peak 0.3522. HTTP and decode failures both resolve silently.
- `tests/audio.browser.py`: offline worst-case reference peak 0.7688 / -2.28 dBFS (limit -1 dBFS); live sound unlock, persisted on/off, signal and mute passed. Whole-route driver saw every expected family including stadium, with no tick errors. The existing test was updated to open Options before clicking the now-nested Sound button, and handle an already-dismissed intro.
- `git diff --check`: passed.
- Audio metadata checked with ffprobe; decoded sample peak -5.66 dBFS and RMS -18.81 dBFS from ffmpeg astats.

These are signal, integration and clipping checks, not a claim of subjective listening approval. Owner can audition the sample or enable Options > City sound near Wembley. No mobile checks or new FPS benchmark, commit or push.

SHA-256 of shipped MP3: `f4c8239d8dead9638682a070f7f761226250057bf1936371493c6e99a0896542`.
