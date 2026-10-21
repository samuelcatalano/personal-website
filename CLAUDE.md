# CLAUDE.md

Gamified portfolio for Samuel Catalano: a 3D city where a red double-decker bus drives through his career as the visitor scrolls. Hosted on GitHub Pages (`main` branch, repo root). `AGENTS.md` is a symlink to this file.

For city work, start with the three current references below; consult other documents only when relevant:

- `docs/architecture/3d-city.md`: validated architecture and rollout boundary.
- `docs/architecture/rendering-budget.md`: budgets, measured evidence and measurement limits.
- `docs/art-direction.md`: approved visual language.

`docs/PRD.md` covers product goals; `docs/TRD.md` covers interfaces/runtime. Dated specs/plans under `docs/superpowers/` are historical context. The current references supersede their older city art, model, budget and rollout proposals; historical plans do not authorize further implementation.

## Model orchestration

Model selection follows **Model Usage** below. The primary agent owns planning, scope, architecture, integration, review and final verification; do not delegate scope or architectural decisions.

If independent subagent work is selected, give each agent one self-contained module, named files, the relevant TRD interface and a clear completion contract. Two agents must not edit the same file concurrently. The primary agent reviews every subagent diff before integration.

## Rules

- **No build step, no npm.** Plain HTML/CSS/ES modules. `three` comes from jsDelivr via the importmap in `index.html` with an exact pinned version. Push to `main` = deploy.
- All copy lives in `js/content.js` with `en` and `pt` for every user-facing string. No copy hardcoded in other modules.
- The HTML panel is the source of truth for content; the 3D world is decoration. Site must be fully usable with WebGL off and with `prefers-reduced-motion`.
- **Privacy:** never publish the home address or phone number from the CV. Contact = email, LinkedIn, GitHub.
- Use relative URLs only (site is served under `/personal-website/`).
- Keep modules small and single-purpose; the TRD lists them. Ask before adding a new dependency.
- Prefer the simplest thing that works; mark deliberate shortcuts with a `ponytail:` comment naming the ceiling.

## Commands

```bash
python3 -m http.server 8000      # local preview at http://localhost:8000
node --test tests/               # content integrity check
```

## Verify before claiming done

Use **Validation Strategy** below; claim only checks actually run. At milestones/before expansion, preserve the product matrix: desktop + mobile (375px), day/night, EN/PT, WebGL disabled, reduced motion, no console errors, Lighthouse a11y ≥ 95 when applicable. This is not a requirement to run the full matrix for each small edit.

## 3D City Development Rules

- The 2026-10-21 visual freeze was reopened by the user on 2026-10-21 for the North Star full-scene upgrade (`docs/plans/north-star-full-scene-upgrade.md`). Work inside that plan's scope; anything outside it still needs explicit authorization. Visual state per system lives in `docs/audits/full-scene-visual-atlas.md`; asset budgets in `docs/art/asset-quality-spec.md`.
- External assets: CC0/public domain first, then clearly permissive free licences; record every one in `ASSET_SOURCES.md`. Ambiguous licence = do not use; model procedurally from reference instead. Never use Sketchfab.
- Subagents are OFF by default. Use them only for clearly independent tasks; a smaller task alone does not justify delegation.
- Preserve the map, lot footprints/heights, routes, landmark sightlines, pedestrians and existing logic unless explicitly in scope. Keep paths clear.
- Keep architecture data-driven: lot data remains the source of truth. No new engine/framework without concrete need and authorization.
- Reuse materials, textures and geometries; batch by spatial chunk, with at most three conceptual architecture buckets: mass / trim / glass.
- Townhouse visual language, batching, LOD0/LOD1, hysteresis and standard culling are approved. Do not redesign townhouses or repeat resolved discovery/architecture without an explicit request.
- Architectural validation is not citywide rollout approval. Work only on explicitly authorized lots/regions; other archetypes and expansion require approval.
- Do not repeat full benchmarks for small adjustments. Use the validation level matching the change.
- Edit only in-scope files. Preserve all preexisting working-tree changes; do not infer authorship from Git status. Never use destructive git reset/restore/clean to discard them.

## Response Budget

- Be concise by default. Do not repeat complete documented specifications or generate large reports unless requested.
- Default final response: what changed, files changed, checks run, key metrics when relevant, GO/NO-GO, and a known issue if any.
- Prefer maintaining project documentation and linking to it over repeating its contents in chat.

## Validation Strategy

### During implementation

Run directly related tests, the relevant check/build if one exists, and one visual capture when applicable. This repository has no build step. Documentation-only work needs documentation checks. Do not run full regression automatically.

### Vertical slice ready

Run directly related tests, visual validation and a simple A/B when performance is relevant.

### Milestone / before expansion

Run full Node regression, relevant browser suites, desktop/mobile checks, repeated A/B when performance is relevant, Lighthouse when applicable, and broader review. Apply the product matrix above to affected behavior.

Avoid Lighthouse, 20+ measurements and every browser suite for small edits. Broaden checks only for changed behavior, failures or a specific unresolved concern; report what was skipped without implying it passed.

## Model Usage

Choose by function, not by model marketing.

- **Default: Claude Sonnet** — implementation, investigation, debugging, refactoring, browser/rendering work, integration, tests, tactical planning and task coordination. Sonnet does most of the work.
- **Claude Haiku** — only cheap, independent work: file inventories, mechanical search, reference/licence tables, locating usages, renames, boilerplate, simple tests, small docs, repetitive asset classification. Never for important visual decisions.
- **Claude Opus** — reserved for genuinely new architectural decisions, subsystem conflicts, major renderer redesign, high-risk art-direction decisions, structural problems risking significant rework, or critical review of a complex strategy. Not routine implementation.
- If Opus seems necessary and the decision is not destructive, log `OPUS REVIEW RECOMMENDED` in the plan/ledger, use Opus only for that analysis/review, then return to Sonnet to implement. Avoid long Opus sessions. Respect any model lock the user has set; do not auto-switch to satisfy this list.
