# Editorial city polish

**Authorization:** implement review items 3, 4, 5, 6 and 7 from this chat. Items 1 (mobile redesign) and 2 (intro redesign) are excluded. Execute in the existing checkout, preserving all existing water/scene work. No commit, deployment or dependency change is required.

**Design:** retain the transit identity and existing fonts/assets. LED belongs to destinations, tickets to career details, plain surfaces to reading. Desktop gets a quieter hierarchy and reserved space for the hero vehicle. Shared career content remains accessible in EN/PT, with reduced motion and without WebGL.

## Implementation

- [x] Panel: put the selected career ticket before the timeline. Keep the current role as a compact secondary summary. Preserve keyboard focus, filtering, visit punches and next-stop progress. Reorder hero around name, role, experience and contact; subordinate humour and secondary links.
  - Files: `js/ui.js`, `js/content.js`, `css/style.css`, `tests/panel-focus.browser.py`, `tests/panel-content.test.mjs`.
  - First add browser assertions for selected-ticket ordering, language changes and selection focus; verify failure, implement, rerun.
- [x] Visual language: use consistent desktop surface/control radii, lighter shadows and red accent. Retain meaningful country/stack colours. Do not change intro rules or mobile navigation/layout.
  - Files: `css/style.css`; verify desktop day/night, keyboard focus and 375px regression.
- [x] Framing: refine desktop follow-shot aim/orbit, including lifted landmark stops; preserve mobile shots, route and world coordinates. Keep bus bounds inside the visible scene area.
  - Files: `js/world/camera.js`, narrowly scoped integration in `js/world/scene.js`, `tests/logic.test.mjs`.
  - Add finite/continuous and unchanged-mobile checks; capture São Paulo, London and Glasgow.
- [x] Depth: blend existing skyline rows toward the live horizon, start atmospheric separation earlier, moderate the existing grade and lift night fill slightly. Reuse current materials/passes; no extra geometry, textures or lights.
  - Files: `js/world/skyline.js`, `js/world/sky.js`, `js/world/post.js`, skyline update call in `js/world/scene.js`; focused browser assertions on horizon colours, near/far bounds, shaders and render counts.
- [x] Verify: Node regression, panel/browser focus and interface checks, sky/resource checks, desktop EN/PT day/night captures, reduced motion and WebGL fallback. One short matched baseline/after render sample for the atmospheric pass; report limits. Inspect scoped diff and record evidence in an audit.

Results and limits: [audit](../../audits/2026-11-12-editorial-city-polish.md). 235 Node tests and six focused browser suites passed. The route sample has different visible geometry and is not an isolated cost comparison; stationary MSAA samples are recorded separately.

## Review focus

- Selected ticket stays visible when selecting a late career stop; focus stays on the selected control after rebuild.
- Current role is not mistaken for the historical selected stop; no fabricated outcomes or metrics.
- Mobile shot coordinates and navigation/intro CSS stay unchanged.
- Weather and reduced motion continue to share the sky/fog horizon without animation leaks.
- Existing uncommitted water and scene edits remain intact; no renderer-wide performance claim from one local sample.
