# Site Audit Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the six low-effort fixes from the 2026-11-07 full-site audit: panel latency after menu jumps, stale hash, nav label mismatch, no-JS fallback content, a `THREE.Material` console warning, and a CV download plus availability line.

**Architecture:** No new modules or dependencies. Pure logic goes in `js/scroll.js` (already unit-tested), copy in `js/content.js`, wiring in `js/main.js` and `js/ui.js`. Every task ends with `node --test tests/` green; browser-only behaviour is checked in the local preview.

**Tech Stack:** Plain ES modules, `node --test`, `python3 -m http.server 8000`. No build step.

**Spec:** The audit findings below (the audit report lived in chat; nothing else to read). Project rules: `CLAUDE.md`. 3D scope stays frozen except the North Star plan: this plan touches no scene art, lots or landmarks.

## Audit evidence each task answers

| Task | Observed on 2026-11-07 (desktop, 1024x768 pane) |
|---|---|
| 1 | EN nav says "Recommendations", panel title says "Kind words"; PT already matches ("Recomendações"). |
| 2 | After clicking brand/home the URL kept `#recs`. |
| 3 | Clicking "Stack" from London: after 4 s the panel still showed the 2024 Tribal stop; the panel only follows the bus (`onProgress`). |
| 4 | `index.html:63` `<noscript>` holds one line; with JS off crawlers see no stack, articles or repos. |
| 5 | Console shows 3x `THREE.Material: parameter 'color' has value of undefined` on cold load. |
| 6 | Contact has Email/LinkedIn/GitHub only; PRD lists a CV PDF download; no availability line anywhere. |

## Global Constraints

- All user-facing copy lives in `js/content.js` with both `en` and `pt` (`tests/content.test.mjs` enforces equal keys and no empty strings).
- Privacy: never publish home address or phone. The CV must be a privacy-scrubbed export (see Task 6). The existing test `no private data in served files` scans `index.html`, `css/style.css`, `README.md` and `js/`.
- Relative URLs only (site is served under `/personal-website/`).
- No new dependency, no build step. Mark deliberate shortcuts with a `ponytail:` comment naming the ceiling.
- Work on `feat/site-gamefication`. Do not push and do not merge to `main`.
- Do not touch `js/world/` art files except where Task 5's diagnosis points (one-line fix only).

## Review Focus

- Two menu clicks in quick succession: the panel must follow the latest target, not the first.
- User wheels or touches the page mid-transit: the panel must resume following the bus, not stay frozen on the clicked target.
- Clicked target never reached (clamped scroll, marks that never match): the panel must unfreeze on its own (8 s fallback).
- Language or theme toggled mid-transit: render must keep the pinned section.
- No-JS fallback must not leak private data and must not drift from `content.js` links.

---

### Task 1: EN nav label matches the panel title

**Files:**
- Modify: `js/content.js:55` (`i18n.en.ui.nav.recs`)
- Test: `tests/content.test.mjs`

**Interfaces:**
- Consumes: `i18n` from `js/content.js`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing test** in `tests/content.test.mjs`: `test('recommendations nav label equals its panel title in both languages')` asserting `i18n[lang].ui.nav.recs === i18n[lang].sections.recs.title` for `en` and `pt`.
- [ ] **Step 2: Run** `node --test tests/content.test.mjs`. Expected: FAIL on `en` ("Recommendations" vs "Kind words").
- [ ] **Step 3: Change** `i18n.en.ui.nav.recs` to `'Kind words'` (shorter, matches the panel, leaves PT untouched).
- [ ] **Step 4: Run** `node --test tests/content.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(copy): EN nav label for recommendations matches the panel title`.

---

### Task 2: Brand/home click clears the stale hash

**Files:**
- Modify: `js/ui.js` (click handler branch for `[data-nav-home]`)

**Interfaces:**
- Consumes: `history.replaceState`.
- Produces: nothing.

- [ ] **Step 1:** In the `[data-nav-home]` branch, after `onGoto(0)`, call `history.replaceState(null, '', location.pathname + location.search)` so the URL drops `#section` (the section branch already writes the hash; this is its mirror).
- [ ] **Step 2: Verify in preview** (`preview_start` site, `http://localhost:8000/#recs`): click the brand; run `location.hash` in the console. Expected: `''`.
- [ ] **Step 3: Run** `node --test tests/`. Expected: all pass (no unit test: DOM-only, one line).
- [ ] **Step 4: Commit** `fix(ui): brand click clears the section hash`.

---

### Task 3: Panel follows the clicked target immediately

**Files:**
- Modify: `js/scroll.js` (add `navLock`)
- Modify: `js/main.js` (wire lock into `goto`, `onProgress`, input events)
- Test: `tests/scroll.test.mjs`

**Interfaces:**
- Consumes: `nearestStop(progress, n, marks)` from `js/scroll.js`; `ui.setActive(i)` from `initUI`.
- Produces: `export function navLock(): { set(i: number): void; clear(): void; filter(nearest: number): number | null }`.
  - `filter` with no target returns `nearest`.
  - `filter` with a target returns `null` until `nearest === target`, then clears the target and returns `nearest`.

- [ ] **Step 1: Write the failing tests** in `tests/scroll.test.mjs`:
  - `navLock passes nearest through when idle`: `filter(3) === 3`.
  - `navLock holds back intermediate stops until the target is reached`: after `set(7)`, `filter(2) === null`, `filter(5) === null`, `filter(7) === 7`, then `filter(8) === 8`.
  - `navLock keeps only the latest target`: `set(7)`, `set(4)`: `filter(7) === null`, `filter(4) === 4`.
  - `navLock.clear releases the hold`: `set(7)`, `clear()`, `filter(2) === 2`.
- [ ] **Step 2: Run** `node --test tests/scroll.test.mjs`. Expected: FAIL (`navLock` not exported).
- [ ] **Step 3: Implement** `navLock` in `js/scroll.js` per the interface above (closure over one `target`, no class).
- [ ] **Step 4: Run** `node --test tests/scroll.test.mjs`. Expected: PASS.
- [ ] **Step 5: Wire in `js/main.js`:**
  - Create `const lock = navLock()`.
  - `goto(i)`: `lock.set(i)`, `ui.setActive(i)`, then the existing `scrollTo`; `setTimeout(lock.clear, 8000)` as the unreachable-target fallback (`// ponytail: 8 s is longer than the slowest observed jump (~6 s); make it distance-based if routes grow`).
  - The world's `onProgress` and the pre-world `watchScroll` callback both call `ui.setActive` only with `lock.filter(nearestStop(p, n, marks))` when it is not `null`.
  - `addEventListener('wheel', lock.clear, { passive: true })` and the same for `touchstart`.
- [ ] **Step 6: Verify in preview:** open `/#journey`, click "Stack" then immediately "Code". Expected: panel shows Code within one bus travel and never flashes Tribal/Stack on the way; wheeling mid-transit resumes normal panel updates.
- [ ] **Step 7: Run** `node --test tests/`. Expected: all pass.
- [ ] **Step 8: Commit** `fix(ui): panel jumps to the clicked section immediately`.

---

### Task 4: No-JS fallback carries the real content

**Files:**
- Modify: `index.html:63` (`<noscript>` block)
- Test: `tests/content.test.mjs`

**Interfaces:**
- Consumes: `links`, `articles`, `repos`, `stack` from `js/content.js`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test** `test('noscript fallback lists every link, article and repo from content.js')` in `tests/content.test.mjs`: read `index.html`, take the text between `<noscript>` and `</noscript>`, and assert it contains the email address (without `mailto:`), `links.linkedin`, `links.github`, `links.medium`, every `articles[].url` and every `repos[].url`.
- [ ] **Step 2: Run** `node --test tests/content.test.mjs`. Expected: FAIL (only email/LinkedIn/GitHub text present, no URLs).
- [ ] **Step 3: Rewrite the `<noscript>` block** in `index.html` as plain HTML: one `<h1>`, the role line from the hero copy, a stack paragraph, and three `<ul>` lists of anchors (links, articles, repos). `// ponytail:` equivalent as an HTML comment: this duplicates `content.js` and is guarded by the test above.
- [ ] **Step 4: Run** `node --test tests/`. Expected: all pass, including `no private data in served files`.
- [ ] **Step 5: Verify:** `curl -s http://localhost:8000/ | grep -c "<a "` inside the noscript region is at least 14.
- [ ] **Step 6: Commit** `feat(seo): no-JS fallback lists links, articles and repos`.

---

### Task 5: Find and fix the `Material color undefined` warning

**Files:**
- Modify: one file under `js/world/` named by the diagnosis (expected: a material built from a palette key that does not exist).
- Test: `tests/palette.test.mjs` if the cause is a missing palette key; otherwise none.

**Interfaces:**
- Consumes/Produces: none.

- [ ] **Step 1: Locate the source.** The warning fires during cold load, so a console patch after load is too late (an in-page re-run of `createWorld` did not reproduce it). Make an untracked scratch copy of `index.html` named `index.local.html` whose first `<script>` wraps `console.warn` to call `console.trace()` when the message contains `color`; load `http://localhost:8000/index.local.html`. Expected: three stack traces naming the file and line that builds a material with `color: undefined`.
- [ ] **Step 2: Write a failing test** if the cause is a missing key in `js/world/palette.js` (assert every palette key used by that builder is defined); if the cause is an optional parameter, skip the test and note why in the commit.
- [ ] **Step 3: Fix** at the source in one line (define the key, or default the parameter). Do not silence the warning with a filter.
- [ ] **Step 4: Verify:** reload `http://localhost:8000/`, `read_console_messages` with pattern `color`. Expected: none. Run `node --test tests/`. Expected: all pass.
- [ ] **Step 5: Commit** `fix(world): material colour is never undefined`. Delete the scratch `index.local.html`.

---

### Task 6: CV download and availability line (needs two inputs from the owner)

**Blocked until the owner provides:** (a) a privacy-scrubbed CV PDF (no home address, no phone), (b) the availability sentence in EN and PT (for example whether to say "open to new roles"). Do not invent either.

**Files:**
- Create: `assets/samuel-catalano-cv.pdf` (owner supplied)
- Modify: `js/content.js` (`links.cv`, `i18n.*.sections.contact.cv`, `i18n.*.sections.hero.availability`)
- Modify: `js/ui.js` (`contact()` helper and hero markup), `css/style.css` only if the new button needs spacing
- Test: `tests/content.test.mjs`

**Interfaces:**
- Consumes: `links`, `i18n` from `js/content.js`.
- Produces: `links.cv: string` (relative path `assets/samuel-catalano-cv.pdf`).

- [ ] **Step 1: Write the failing tests:** `links.cv` starts with `assets/` and the file exists and starts with the bytes `%PDF`; `i18n.en` and `i18n.pt` both define `sections.contact.cv` and `sections.hero.availability` (the existing key-parity test then enforces equality).
- [ ] **Step 2: Run** `node --test tests/content.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Add** the file and copy; in `js/ui.js` render a fourth `btn` in `contact()` (`<a class="btn" href="${links.cv}" download>`) and the availability sentence under the hero tagline. Contact also gets it; hero stays as is apart from the sentence.
- [ ] **Step 4: Owner check (manual):** open the PDF and confirm it has no address or phone. Tests cannot prove this.
- [ ] **Step 5: Run** `node --test tests/`. Expected: all pass. Preview EN and PT, day and night: button fits, no overflow at 420 px panel width.
- [ ] **Step 6: Commit** `feat(contact): CV download and availability line`.

---

## Explicitly out of scope (needs the owner)

- Removing `docs/`, `.superpowers/`, `.agents/` or raw `assets/vehicles/*.glb` from the published repo, and rewriting git history (audit items 9, 10): destructive and needs approval.
- Progressive GLB loading, car size reduction, shader pre-compile (audit items 1-4): High-impact plan, separate document, needs a before/after measurement protocol first.

## Self-review

- Coverage: all six audit quick wins have a task; items 9 and 10 are deliberately excluded and named.
- Types: `navLock` signature is identical in Tasks 3's interface, tests and wiring; `links.cv` is defined in Task 6 only.
- Proportion: one test or one browser check per task; no function bodies written out.
