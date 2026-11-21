# Wembley crowd ambience

Owner approved a generic distant stadium audience: real crowd recording, applause and occasional collective reactions, no club-specific chant or music. Reuse the existing native Web Audio graph and Sound toggle; preserve the pending 15% wind reduction. No visual change, mobile checks, commit or push.

1. Source a CC0 recording and record provenance/processing in ASSET_SOURCES.md.
2. Add a tested Wembley proximity gain to audioState and wire the existing route landmark index into the driver.
3. Load/decode one compact local sample when the sound driver starts; loop it through a distance filter and the existing people bus. Fetch/decode failure stays silent. Reuse the same source while travelling, with smooth gain transitions.
4. Verify Node regression, real offline audio signal/mute/failure paths and desktop route proximity. Expose a standalone preview for owner listening.

Asset: Bansemer, Large crowd applause.wav, Freesound #160493, CC0 1.0. Derivative of the public HQ MP3 preview: source seconds 10–42, highpass 160 Hz/lowpass 2800 Hz, loudness normalization, 2-second tail/head crossfade, 30-second mono MP3 at 32 kHz/64 kbps. Reactions come from the recording itself; no extra timers/voices or visual changes are required.
