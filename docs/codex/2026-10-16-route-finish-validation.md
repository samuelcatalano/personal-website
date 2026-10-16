# Route finish validation

Date: 2026-10-16
Plan: `docs/superpowers/plans/2026-10-16-maquette-route-finish.md`
Branch: `feat/london-bus`. Local commits only; no push or deploy.
Preview: `http://localhost:8000/`, Chrome via browser-harness with the cache disabled.

## Result

All four stages are implemented and reviewed. The user approved checkpoints A (palette and landmarks), B (urban fabric and plaques) and C (landmark framing) from screenshots in chat.

| Stage | Commits | Content |
|---|---|---|
| 2 | `f741d65` | Shared palette `js/world/palette.js`. Big Ben, Tower Bridge, Wembley and the plane recoloured. Heathrow moved to the far side of the road. |
| 3 | `a54a80d`, `c4fc7fb`, `dc67295` | Maquette finish on every stop, keeping palms and balconies at the Brazilian stops. Chimneys and parapet on the near-side roofs. Ivory company plaques. |
| 4 | `92ba2d2` | `FRAME_LIFT` raises the follow camera at xDesign, OLM and Tribal. With `lift=0` the shot is identical to the approved one. |
| 5 | `bd3b0d1` | JS budget clarified (user decision, see below). |

## Checks and evidence

- `node --test tests/`: 28 passed, 0 failed. The two new suites are `tests/palette.test.mjs` and the `FRAME_LIFT` tests in `tests/logic.test.mjs`.
- Browser suites, run in sequence on the final state with the cache disabled. All passed:
  - `interface`;
  - `city`: 6,446 boxes; the hero uses only the three stone colours;
  - `landmarks`: includes the new check that Heathrow sits between the far sidewalk and the Thames bank;
  - `vehicles`: bus 11.05 × 4.6;
  - `figure`;
  - `world`: `idleFrames: 0`, buffers 2160×1350 → 375×812 → 2160×1350.
- With the CDN blocked (`Network.setBlockedURLs *cdn.jsdelivr.net*`), the page fell back to `no-webgl`, with 6 section links plus the home link and email contact present.
- `prefers-reduced-motion: reduce` together with `#contact`: the panel opens on `contact` and the world loads.
- PT-BR: `lang=pt-BR`, journey title "Trajetória", 10 entries.
- No console errors on the normal load (Browser pane).
- A temporary WebGL sampler at desktop 1350×940, DPR 1.5, ran 1,238 frames over a full scroll of the route. Draw calls were min 59, median 75, max 107. Instance submissions were median 13,430, max 13,976. Both are within the targets (< 150, < 60k). The sampler was injected with `addScriptToEvaluateOnNewDocument` and removed afterwards.
- Lighthouse desktop (chrome-devtools MCP): Accessibility 100, Best Practices 100, SEO 100, 0 audits failed.
- Local trace without throttling: LCP 111 ms, CLS 0.00. **This is not a Lighthouse Performance score.** The tool does not produce that category, so the ≥ 80 target remains unproven.

## JS budget

Measured own JS: 67,700 bytes in total, of which 12,006 bytes are EN/PT copy in `js/content.js`. Code alone is 55,694 bytes. gzip -9 of everything is 22,479 bytes.

The user decided to scope the 60 KB target to **code only**, excluding the text in `content.js`, which grows with the career. Under that rule the measurement is within the target. The spec, TRD and plan were amended in `bd3b0d1`.

## Captures

Saved outside the repository in the session scratchpad. They are not versioned and may disappear.

- `checkpointA2/`: Heathrow, Big Ben, Tower Bridge and Wembley, day and night, desktop.
- `checkpointB/`: 2012, 2017, 2020 and 2021, desktop and 375 px, day and night.
- `checkpointC/`: xDesign, OLM and Tribal, desktop and 375 px, day and night.

The first set for A was captured from cached JS modules and discarded. Every capture after that was taken with `Network.setCacheDisabled`.

## Limits and open items

- On mobile at 375 px, the top of the London Eye at OLM still sits under the header. The user approved checkpoint C with this noted.
- The closing shot at Wembley crops the top of the arch, and the "NOW" plaque is large and cropped at the top right. Both predate this stage; noted at checkpoint A.
- At 2017 a palm tree partly covers the "ME" plaque.
- Minors noted in reviews but not fixed:
  - the legacy random chimney can overlap the new chimney on the same side;
  - the `FRAME_LIFT` keys are not validated against the stop ids;
  - `paintPlaque` has a redundant `fillStyle`;
  - the browser test messages still say "blue" for steel.
- No testing on physical devices (touchscreen or trackpad). There is no Lighthouse Performance score.

## Final review (Opus) and fixes — `410f6d6`

The final review found two Important issues, both fixed:

1. The legacy random chimney sat in the same plane as the new near-side roof stacks, which caused z-fighting. The legacy chimney is now skipped where the stacks are built. Both `r()` draws are kept, so the random sequence is unchanged.
2. The new roof stacks also altered the hero the user had approved. The stacks now apply from stop 2 onwards (`roofStacks = i >= 2`). A script that generates the hero-area city boxes at `f741d65` and at HEAD confirmed **811 = 811 identical boxes**.

The following minor fixes were also applied:
- Heathrow comment corrected; geometry unchanged.
- "blue" → "steel" in test messages.
- Redundant `fillStyle` removed in `paintPlaque`.
- A test now checks that the `FRAME_LIFT` keys are stop ids.

After the fixes, `node --test` passed 28 tests and the city, landmarks and world browser suites all passed.
