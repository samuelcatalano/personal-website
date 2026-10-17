# Graphics pass handoff 2 — 2026-10-17

Stopped early at 83% of the weekly usage limit (the stop rule was 85%). Item 4 changes building layout, and the browser pane was hidden so new work could not be checked visually.

## State

- Branch `feat/london-bus`. Nothing pushed.
- `node --test tests/`: 70 pass, 0 fail. `git diff --check` clean.
- Commits from this session (oldest first): `6f851e0` Glasgow trip/livery/statue, `144aa7b` uniform scroll + Tower Bridge + Glasgow landmarks, `92cf6eb` outskirts + flags + night lighting, `61e0f05` tilt-shift + regional mood + drizzle + voxel edges. This handoff commit adds the "ideas round 2" work below.

## Ideas round 2: done in this commit

1. **Richer night**
   - **Staggered windows:** glow materials get a per-instance hash threshold, and their emissive ramps up with `uNight`, so lights switch on progressively. This is in `js/world/textures.js`; `uNight` is written by `js/world/sky.js`.
   - **Lamp pools:** new `js/world/lamps.js` is one additive InstancedMesh of radial gradients under every street lamp. Lamp positions come from `buildCity` (`city.js`), and opacity is `night * 0.7`.
   - **Not done:** raising the share of lit windows. `P.glass` is shared with water, the bus and parks.
2. **Ambient motion** (new `js/world/motion.js`, driven by the scene clock, so it is static under reduced motion)
   - **Chimney smoke:** `houses.js` exports `chimneys`. About 30% of houses get one, chosen by a position hash, with no RNG draws. 27 chimneys smoke in total, which is sparse.
   - **Flag cloth:** `flags.js` exports `cloth` and the cloth is now its own waving mesh. The wave amplitude is 0.16, and the motion is barely visible at gameplay distance. Raise it in `motion.js` if wanted.
3. **Livelier ground** (`textures.js`, `water.js`)
   - **Grass and road:** value-noise tint on lawns (±6%, yellow-green shift) and wear patches on the road (±4%).
   - **Water:** a sun-glint sparkle, scaled by (1 − night).
   - **Visual check:** the lawn variation was seen in the browser; the river glint and the night look were not.
4. **Tilt-shift softened** in `js/world/post.js` (`FOCUS_Y 0.3, HALF_BAND 0.22, FALLOFF 0.45, MAX_R 3.5`). The old values (0.25 / 0.15 / 0.33 / 7) blurred the Tower Bridge flags away and hid São Paulo detail.

## Follow-up round (same day, stopped at 84% weekly / 83% 5-hour)

- **Tilt-shift removed entirely** (`post.js`). Samuel didn't like the background blur.
- **Chimney smoke removed entirely** (`motion.js`, `houses.js`). The current houses don't have chimneys. The flag waving stays.
- **Journey→Stack jump:**
  - **Cause:** `fit()` in `scene.js` snapped `camera.setViewOffset` when the panel resized at the section change. It was most visible on mobile.
  - **Fix:** the offset now eases toward its target in the frame loop (300 px/s via `approach`), and snaps under reduced motion. A test is in `tests/scroll.test.mjs`.
  - **Not verified:** whether this is the jump Samuel sees on desktop. The agent measured no scroll teleport and a constant desktop offset. Recheck on desktop by scrolling slowly across tribal→stack. If it still jumps, look at the `SECTION_SHOT` change between 'journey' and 'stack' in `camera.js`/`scene.js`.
- **Visual check:** none for this round. The pane was hidden. The console is clean and `node --test` shows 71 pass.

## Not done (next round)

- **4. Building variety:** rooftop details (chimneys, water tanks in SP, AC units, antennas) and per-district facade palettes. Watch out: `blocks.js` placement relies on seeded RNG streams, so add details without new `r()` draws, or put them after all placements (like `parks.js`).
- **5. Performance:** adaptive DPR when FPS drops, a tighter shadow frustum near the bus, and LOD for far blocks. FPS read ~75 (display cap), so it has not been measured properly.

## Verify first when resuming

- **River glint and night:** London stop (`[data-goto="10"]`) in the Browser pane, day and night.
- **Smoke and flags:** smoke over the terraces next to Tower Bridge (scroll about +2600 px from stop 10); flags on the Tower Bridge pinnacles (scroll about +1500 px).
- **Not yet checked:** mobile 375px, reduced motion, WebGL off.

## Browser pane tips

- Modules are cached heavily. Run `await fetch(url, {cache: 'reload'})` for each changed module, then reload.
- A black or blank canvas means the pane is hidden: the render loop pauses on `document.hidden`. Open a fresh foreground tab.
- One agent saw a `ui.js:63` `setAttribute` on null after loading with a stale `localStorage` theme. It reproduced without that agent's changes. Clearing `localStorage` fixes it, but it is worth a guard in `ui.js`.
