# CLAUDE.md

Portfolio for Samuel Catalano: a voxel London where a red double-decker bus drives through his career as the visitor scrolls. Static site on GitHub Pages, served from `main` (repo root). `AGENTS.md` is the Codex counterpart; keep both aligned.

## Source of truth

- `docs/PRD.md`: original product brief. Its content, privacy and accessibility requirements still apply.
- `docs/product/3d-city-north-star-prd.md`: current 3D city direction and release gate.
- `docs/TRD.md`: runtime, interfaces and file layout.
- `docs/architecture/3d-city.md`: validated architecture and rollout boundary.
- `docs/architecture/rendering-budget.md`: budgets, measured evidence and measurement limits.
- `docs/art-direction.md`: approved visual language. `docs/art/asset-quality-spec.md`: asset budgets.
- `ASSET_SOURCES.md`: every shipped asset, with its source, licence and approval.
- `docs/handoff/` and `docs/handoffs/`: status log and agent handoffs. Read the latest one before changing an area.
- Plans under `docs/plans/` and older records are history. They do not authorize new work.

## Rules

- No build step and no npm in the shipped site. Plain HTML/CSS/ES modules; Three.js is pinned in the import map in `index.html`. `tools/pipeline/` is a dev-only npm package and is not shipped.
- All user-facing copy lives in `js/content.js`, in `en` and `pt`. No copy hardcoded in other modules.
- The HTML panel is the source of truth; the 3D world is decoration. The site must work with WebGL off and with `prefers-reduced-motion`.
- Privacy: never publish a home address or phone number. Contact = email, LinkedIn, GitHub. Any shipped CV is redacted.
- Relative URLs only (the site is served under `/personal-website/`).
- Small, single-purpose modules. Ask before adding a dependency or framework.
- Prefer the simplest thing that works. Mark deliberate shortcuts with a `ponytail:` comment naming the ceiling.
- Graphics quality never drops at runtime. Do not propose quality selectors or adaptive downgrades.
- Mobile work is paused by the owner (2026-11-16): no mobile tests or checks. Shipped mobile behaviour is unchanged.
- Push to `main` deploys. Work on feature branches; do not merge into `main` until the owner releases it.

## Commands

```bash
python3 -m http.server 8000      # local preview at http://localhost:8000; reuse the owner's server if it is running
node --test tests/               # content, route/camera, geometry and audio checks (CI runs it on every push)
node tools/preload-list.mjs      # modulepreload tags for index.html; tests/preload.test.mjs fails when they drift
OUT=<dir> SHOTS="5:day,11:night" GRID=1 browser-harness < tools/capture.py   # scene capture (QUERY=weather=rain optional)
```

Capture stops: 5 São Paulo, 9.5 London, 11 Glasgow (ids in `js/content.js`).

## Verification

- Claim only checks that actually ran. Say what was skipped.
- Small edits: directly related tests, plus one visual capture when the change is visible.
- Milestones: full Node regression, relevant browser suites, desktop checks, and Lighthouse accessibility at least 95 when applicable.
- Matrix: desktop, day/night, EN/PT, WebGL disabled, reduced motion, no console errors. Mobile is excluded while it is paused.
- Do not repeat full benchmarks for small adjustments.

## 3D city rules

- The 2026-10-21 visual freeze was reopened for the North Star full-scene upgrade (`docs/plans/north-star-full-scene-upgrade.md`). Work outside that scope needs explicit authorization.
- The townhouse visual language, batching, LOD0/LOD1, hysteresis and culling are approved. Do not redesign townhouses without an explicit request.
- Citywide rollout of the approved archetypes is complete (`docs/handoff/status-log.md`). Other archetypes and regions need explicit owner approval. Architectural validation alone is not rollout approval.
- Preserve the map, lot footprints and heights, routes, landmark sightlines, pedestrians and existing logic unless explicitly in scope.
- Lot data stays the source of truth. No new engine or framework without concrete need and authorization.
- Reuse materials and geometries; batch by spatial chunk into mass / trim / glass.
- External assets: CC0 or public domain first, then clearly permissive licences. Sketchfab and NC/SA assets only with the owner's approval of the specific asset. Record every asset in `ASSET_SOURCES.md`. An ambiguous licence means do not use it.

## Working in the tree

- Edit only files in scope. Preserve working-tree changes you did not make; never use destructive git commands (`reset`, `restore`, `clean`) to discard them.
- Do not commit or push unless asked.
- Keep responses concise: what changed, files changed, checks run, GO/NO-GO, known issues.

## Model routing (Claude)

Default is Haiku. Move up only when the tier below cannot do the task, and say which tier you used and why.

- **Fable**: not the default. Use only when the user asks for it.
- **Opus**: orchestrator, or complex tasks Sonnet cannot handle.
- **Sonnet**: complex tasks Haiku cannot handle.
- **Haiku**: conventional tasks, and every task it can perform.

Subagents are off by default. Use them only for clearly independent work the user has authorized, never because a skill exists. Respect any model the user has set.

## Codex

- Codex follows the ladder in `AGENTS.md` (Luna, Terra, Sol, Astra). Its configuration is `.codex/config.toml`.
- Coordinate through handoffs in `docs/handoff/`. Read Codex-owned work before changing its area, and do not overwrite it.

## Skills and tools

Check that a skill or plugin is installed before relying on it. Use only what is available and relevant.

- `superpowers:using-superpowers` at the start of a session; `superpowers:brainstorming` before new features or unclear scope.
- `superpowers:test-driven-development` and `superpowers:verification-before-completion` for code changes and before any "done" claim.
- `superpowers:subagent-driven-development` and `superpowers:dispatching-parallel-agents`: only when subagents are authorized.
- `ponytail:ponytail` for minimal code; `caveman:caveman` for terse prose.
- `frontend-design:frontend-design` and `product-frontend-design` for UI work.
- `ctx_execute` for large command output and data analysis.
