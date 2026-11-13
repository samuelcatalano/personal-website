# Loading ticket refinement

Implemented the owner's selected recommendations 2–5 and Mouse leve direction. Desktop scope; no new dependencies, scene assets or changes to the 3D loading pipeline.

## Result

- Ready state: separate visible loading percentage, followed by “Ready to depart.” / “Tudo pronto para partir.” and the enabled “Board” / “Embarcar” CTA. The existing readiness gate remains; progress stays below 100 until ready.
- Destination blind: stable city label before interaction, career stop while practicing, STOP REQUESTED during boarding. Removed the rotating greeting, loading stage and London-clock interval.
- Previews: 220 px at the validated 1280×900 desktop viewport, up from 174 px; compact-height maximum 184 px, up from 140 px. Existing city captions and route select one settled real-city image. Removed continuous image drift; illustrated fallback remains.
- Ticket: localized owner, travel-ticket stamp and passenger/number stub; fine paper lines, restrained perforation and thinner photo frame.
- Mouse: thinner outline/divider, one directional arrow and no sonar. Wheel animation remains; ready-button pulse finishes after two cycles. Keyboard focus remains visible, and reduced-motion behavior is preserved.

Files: `index.html`, `css/style.css`, `js/content.js`, `js/intro.js`, `tests/intro-ticket.browser.py`, `tests/intro.browser.py`. `js/main.js` and the scene snapshot API are unchanged.

## Validation

- Controlled browser regression first failed on the original hidden loading status, then passed with actual intro markup/styles/module in EN day and PT night. Checks cover loading/finishing/ready gating, destination, ticket copy, decoded previews, settled photo selection, desktop fit, keyboard focus and final text contrast ≥4.5:1.
- Real startup at 1280×900 passed in EN day with normal motion and PT night with reduced motion: three real city previews decoded, CTA enabled only when ready, Space boarded, focus returned to content, no observed console errors and WebGL `getError() = 0` in both runs.
- Existing desktop EN intro browser suite passed, including practice controls and boarding transition. Replaced fixed-delay transition sampling with requestAnimationFrame sampling; assertions still require opaque sliding doors followed by a partial-opacity fade.
- Related Node tests: 26 passed. Full Node regression: 242 passed, 0 failed, 0 skipped. JavaScript/Python syntax and diff whitespace checked.
- Loading and ready states visually inspected. Ready card fits the 900 px viewport (top 46.8 px, bottom 853.2 px).

Evidence: [ready comparison](../evidence/loading-ticket/ready-comparison.jpg), [EN day](../evidence/loading-ticket/en-ready.jpg), [PT night](../evidence/loading-ticket/pt-ready.jpg), [controlled red](../evidence/loading-ticket/controlled-red.log), [controlled green](../evidence/loading-ticket/controlled-green.log), [real startup](../evidence/loading-ticket/real-startup.log), [boarding](../evidence/loading-ticket/boarding-en.log), [Node summary](../evidence/loading-ticket/node-summary.log).

Browser capture runs foreground the test tab and wait for the optional city snapshots before taking a full-page PNG, to avoid competing with those snapshots during their existing timeout. No production snapshot behavior was changed.

GO for desktop review. Mobile was excluded by the owner; Lighthouse and performance benchmarks were not run. No loading-speed improvement or complete accessibility audit is claimed. After desktop review, the owner requested committing the pending site refinements. No push requested.

Copy follow-up: the owner noted that the journey starts in the Mini. The English CTA is now “Board”; readiness copy is vehicle-neutral in EN/PT. Captures above predate this wording-only adjustment.

Progress-layout follow-up: the owner requested that the dots use the full ticket width. The status now stacks a 48-dot progress line across the available card width above its centered message, replacing the short left-hand cluster. Real progress and readiness behavior are unchanged. Related Node tests passed (26); see [updated browser evidence](../evidence/loading-ticket/dots-startup.log) and [updated ready comparison](../evidence/loading-ticket/dots-comparison.jpg).

The updated EN real-startup capture passed with three previews. PT night layout was checked separately and passed (full-width dots, text below, card fits); that run used the existing illustrated fallback after optional snapshots did not arrive. The stricter three-preview capture assertion failed for PT in this run, so this follow-up does not claim a new all-preview pass for both languages.
