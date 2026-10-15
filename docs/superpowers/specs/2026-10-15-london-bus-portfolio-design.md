# London Bus Portfolio — Design (approved 2026-10-15)

Full product detail: `docs/PRD.md`. Full technical detail: `docs/TRD.md`. This file records the decisions.

## Decisions
| Topic | Decision | Alternatives rejected |
|---|---|---|
| Visual fidelity | 3D voxel world in Three.js, like bridglabs.com | 2D pixel parallax; hybrid |
| Stack | Vanilla ES modules + three via jsDelivr importmap, no build | Vite + TS; Vite + React/R3F |
| Route | Single London route, chronological; Brazil jobs (2011–2020) are early "Before London" stops with 🇧🇷 sign; plane flyover at 2020; ends at Wembley "Now" | Two scenes (São Paulo + London); Brazil only in panel |
| Content | Journey (9 jobs + PUC-SP), Stack, Articles (3), GitHub repos (curated), Recommendations (2), Contact | — |
| Languages | EN default + PT toggle | EN only |
| Career data | CV (Mar/2026) is current; LinkedIn not scraped (login wall) | — |
| Privacy | No home address or phone on the site | — |

## Units
`content.js` (data) → `ui.js` (panel) and `scroll.js` (progress) → `world/*` (decoration). The world only consumes `stops[]` and `progress`; removing it leaves a working site.

## Risks
- Voxel modeling time for landmarks: start with blocky silhouettes, refine later.
- three from CDN: pinned version; if the CDN fails, the WebGL fallback path covers it.
- `RESUME - Full_Version.pdf` currently committed contains address/phone: replace with a redacted PDF or remove from the repo.

## Done when
PRD success criteria pass and the CLAUDE.md verification matrix is green.
