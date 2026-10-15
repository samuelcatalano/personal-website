# CLAUDE.md

Gamified portfolio for Samuel Catalano: a voxel London where a red double-decker bus drives through his career as the visitor scrolls. Hosted on GitHub Pages (`main` branch, repo root). `AGENTS.md` is a symlink to this file.

Read first: `docs/PRD.md` (what/why), `docs/TRD.md` (how), `docs/superpowers/specs/2026-10-15-london-bus-portfolio-design.md` (approved design).

## Model orchestration

- **Orchestrator: Opus 5.5 (`claude-opus-5-5`).** Owns planning, design decisions, task breakdown, integration, code review, and final verification. Never delegates decisions about scope or architecture.
- **Subagents, implementation: Sonnet 5.5 (`claude-sonnet-5-5`).** One self-contained module per task (e.g. `js/bus.js`, a landmark builder, `js/ui.js`). Brief must name the files, the interface from the TRD, and what done looks like.
- **Subagents, small/mechanical: Haiku 5.5 (`claude-haiku-5-5`).** Lookups, content translation EN↔PT, copy edits, asset renames, link checks, running the content test.
- Two subagents never edit the same file at the same time. The orchestrator reviews every subagent diff before it lands.

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

Desktop + mobile (375px), day/night, EN/PT, WebGL disabled, reduced motion, no console errors, Lighthouse a11y ≥ 95.
