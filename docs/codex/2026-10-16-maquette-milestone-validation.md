# Maquette milestone validation

Date: 2026-10-16
Preview: `http://localhost:8001/`
Scope: integrated hero and first-career milestone, with route and fallback checks.

## Result

The integrated hero is ready for visual review. At desktop 1350×940 and mobile 375×812, the red bus and principal terrace remain visible beside the editorial panel; the panel and navigation remain usable. The first-career state contains all ten entries and one active detail. Day/night and EN/PT states were captured. The aesthetic direction still needs the user's visual acceptance before work expands to other views.

I inspected the desktop EN/day and mobile EN/day hero captures. I generated the remaining captures in the matrix; those were state-checked but not individually inspected at full resolution.

## Checks and evidence

- `browser-harness < tests/interface.browser.py` rerun: passed. It reported mobile navigation and focus checks, ten career rows, EN/PT copy, zero document overflow, and the 800px header fit. The WebGL-unavailable path in that suite passed.
- The Task 4 report records the four passing browser suites. City and vehicle checks were rerun after the final ground change; the world suite passed after the continuous closing-sign fix, and the interface suite passed after the accessible-control fixes. Integration reran `node --test tests/` on the final source: 24 passed. The existing MODULE_TYPELESS_PACKAGE_JSON warning comes from the parent workspace configuration; no package dependency or build was added.
- Separate CDN-blocked session: the Three.js import failure entered `no-webgl`; all seven sections, all ten career entries, and the email contact remained usable. The captured warning was `3D world unavailable: Failed to fetch dynamically imported module`, as expected for the injected network failure.
- Keyboard: Tab moved focus to Journey, Enter activated it and set `#journey`, and the existing `j` / `k` keys moved the active career row from 1→2→1.
- Reduced motion: after initial rendering, no new scene draw frames appeared during a 700 ms idle sample. A theme change woke one render frame. The page reported the reduced-motion preference as active.
- Input: CDP wheel events produced a down/reversal/down scroll. Touch emulation moved scroll from 370 to 4,277 and back to 552 on reversal. Physical trackpad and touchscreen hardware were not tested.
- A temporary WebGL API sampler at desktop 1350×940, DPR 1.5 (canvas 2025×1410), measured 76–80 draw submissions per rendered frame (median 80) and 10,359–10,361 instance submissions summed across instanced draw calls. The latter is submitted instance work per rendered frame, not a count of unique scene instances. Both samples are below the 150-call and 60,000-instance targets. Across 100 rendered frames after synthetic wheel movement, median frame interval was 8.3 ms and p95 was 8.4 ms. This is a short sample on this browser/display, not a smoothness guarantee.
- The browser user agent was Chrome 155 on macOS (host Darwin 25.6.0). The instrumented normal load and scroll sample captured zero JS console errors.
- Final own JavaScript totals 57,773 bytes across `js/*.js` and `js/world/*.js`, below the 60,000-byte target.
- One cache-disabled 4G simulation (150 ms RTT, 1.6 Mbps down, 750 Kbps up) found the useful panel title and contact links at DOMContentLoaded, 866.5 ms after navigation start. The Three.js CDN resource took 1,583 ms. This is one simulated timing sample, not a Lighthouse result.

## Visual captures

All 16 viewport, language, theme, and state captures are stored outside the published site in `/Users/samuel.catalano/.codex/visualizations/2026/10/16/01a14247-4a44-7c00-a3b9-e523aa7810f2/maquette/`:

- Desktop 1350×940, DPR 1.5: `desktop-{en,pt}-{day,night}-{hero,career}.png`
- Mobile 375×812, DPR 1: `mobile-{en,pt}-{day,night}-{hero,career}.png`

The desktop EN/day hero is [desktop-en-day-hero.png](/Users/samuel.catalano/.codex/visualizations/2026/10/16/01a14247-4a44-7c00-a3b9-e523aa7810f2/maquette/desktop-en-day-hero.png); the mobile EN/day hero is [mobile-en-day-hero.png](/Users/samuel.catalano/.codex/visualizations/2026/10/16/01a14247-4a44-7c00-a3b9-e523aa7810f2/maquette/mobile-en-day-hero.png).

## Remaining verification and review

No full `lighthouse` executable is installed. The cached helper provides a valid Accessibility category, but filters metrics needed for a valid Performance score. The final accessibility-only audit returned 100 with zero failed automated audits, after including the visible language target in its accessible name and replacing the textual theme glyph with a decorative SVG. Full result: [lighthouse-a11y.json](/Users/samuel.catalano/.codex/visualizations/2026/10/16/01a14247-4a44-7c00-a3b9-e523aa7810f2/maquette/lighthouse-a11y.json). This is an automated sample, not a guarantee of accessibility. Full desktop Performance ≥80 and three complete Lighthouse runs remain unverified; physical mobile/trackpad testing remains outstanding.

The final stop's year sign now lifts continuously over the last route segment. Its regression check failed at a 4 m jump before the fix and passed at 0.0001801 world units afterward; the endpoint remains Y=12.5. Hero/career geometry and end-state composition are unchanged by this fix. Runtime measurements above were sampled at baseline 14d59c1, before these small label/sign corrections; they were not rerun as a benchmark afterward. The final source was reviewed and the covering browser suites rerun. Visual acceptance remains with the user before expanding the route's detailed finish.

## Execution decisions

The existing feat/london-bus checkout was retained, with baseline changes backed up and committed separately; concurrent external edits would need reconciliation. Luna implemented and supplied focused review evidence, with Sol controlling scope and final review; missed smaller-model findings required Sol's review. The plan's task headings were normalized for the task extractor, with no product effect. Water palette changes were included to match the approved sober direction; their cost if rejected is color retuning. The final fix scope was extended to a concrete accessibility finding from late QA; its cost is a small localized control change. No dependencies, push or deployment were added.

QA used only temporary browser instrumentation and network/emulation overrides. The overrides were removed, temporary tabs were closed, and the preview was restored to WebGL-enabled EN/day hero at `http://localhost:8001/`.
