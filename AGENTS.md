# AGENTS.md

Instructions for Codex in this repository. `CLAUDE.md` holds the same project rules in more detail. Keep the two files aligned.

## Project

Portfolio for Samuel Catalano: a voxel London where a red double-decker bus drives through his career as the visitor scrolls. Static site on GitHub Pages, served from `main`.

## Rules

- No build step and no npm in the shipped site. Plain HTML/CSS/ES modules; Three.js is pinned in the import map. `tools/pipeline/` is a dev-only npm package.
- All user-facing copy lives in `js/content.js`, in `en` and `pt`.
- The HTML panel is the source of truth. The site must work with WebGL off and with `prefers-reduced-motion`.
- Never publish a home address or phone number. Use relative URLs only.
- Graphics quality never drops at runtime. Do not propose quality selectors or adaptive downgrades.
- Mobile work is paused by the owner: no mobile tests or checks.
- Feature branches stay off `main` until the owner releases them. Pushing to `main` deploys.
- Edit only files in scope. Do not revert or overwrite working-tree changes you did not make. No destructive git commands.
- Do not commit or push unless asked.
- 3D city: follow the freeze and rollout limits in `CLAUDE.md`. Townhouses are not redesigned without a request. Every external asset needs an entry in `ASSET_SOURCES.md`.

## Model ladder (Codex)

Default is Luna. Move up only when the tier below cannot do the task, and say which tier you used and why.

- **Astra**: not the default. Use only when the user asks for it.
- **Sol**: orchestrator, or complex tasks Terra cannot handle.
- **Terra**: complex tasks Luna cannot handle.
- **Luna**: conventional tasks, and every task it can perform.

## Codex setup

- `.codex/config.toml` enables agents, with up to 6 concurrent threads per session.
- Codex reports live in `docs/codex/`. Handoffs live in `docs/handoff/`. Read the latest handoff for an area before changing it.
- Shared skills live in `.agents/skills/` (for example `blender-realistic-npc`).

## Skills and tools

Check that a skill or plugin is installed before relying on it. Use what is available and relevant:

- `superpowers:using-superpowers`, `superpowers:brainstorming`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`.
- `superpowers:subagent-driven-development`, `superpowers:dispatching-parallel-agents`: only when subagents are authorized.
- `ponytail:ponytail` for minimal code; `caveman:caveman` for terse prose.
- `frontend-design:frontend-design` and `product-frontend-design` for UI work.
- `ctx_execute` for large command output and data analysis.

## Verification

Run the related tests before claiming a change is done: `node --test tests/`, plus browser suites for visual changes (desktop only). Report what was not run.
