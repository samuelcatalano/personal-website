# Graphics pass handoff — 2026-10-17

## Current state

- Branch: `feat/london-bus`
- Base commit: `26fc31b` (`Update portfolio product and technical docs`)
- No commit was created for this graphics pass.
- The working tree changes are in `js/world/blocks.js` and `tests/glasgow-clearance.test.mjs`. `.superpowers/` was already untracked before this pass; leave it untouched.

## Astra change

The Glasgow camera shot placed the London Eye and Big Ben against tall generic towers, making the landmarks and pale skyline compete. In `js/world/blocks.js`, buildings behind the landmarks from Big Ben through Glasgow (far-side rows at `z <= -65`) are capped at about 16 m. Their omitted floors still consume the existing random draws, so later districts keep their procedural layout. Towers outside that corridor remain unchanged. Camera, scroll, landmark geometry, and render passes were not changed.

`tests/glasgow-clearance.test.mjs` now checks that this backdrop stays below the London Eye hub while other skyline districts retain taller towers.

## Evidence

- `node --test tests/`: 50 passed, 0 failed.
- `git diff --check`: passed.
- Browser preview was visually inspected at the Glasgow stop after bringing its hidden tab to the foreground. The skyline reads lower and leaves more open sky around the landmarks. The full browser test matrix was not rerun for this pass.
- Screenshot: `/Users/samuel.catalano/.codex/visualizations/2026/10/16/01a14247-4a44-7c00-a3b9-e523aa7810f2/glasgow-astra-final.png`.

## Continue from here

Review the screenshot and the two uncommitted files before changing the scene further. The London Eye's voxel ring and supports still read as separated pieces at this distance; this is a possible next polish item, but Samuel previously said the Eye was okay. Keep it unchanged unless a future review establishes a clear defect and preserves the approved architectural palette, red bus emphasis, existing route, camera behavior, and scroll feel.

Do not commit or push without Samuel's instruction. Keep all interface copy in `js/content.js` with EN/PT strings. Follow `CLAUDE.md` and keep the HTML panel usable without WebGL and with reduced motion.
