# AGENTS.md

Instructions for Codex in this repository. `CLAUDE.md` holds the same project rules in more detail. Keep the two files aligned.

## Project

Portfolio for Samuel Catalano: a voxel London where a red double-decker bus drives through his career as the visitor scrolls. Static site on GitHub Pages, served from `main`.

## Rules

- `npm run dev` and `npm run build` are optional dev tools; GitHub Pages continues to serve the plain static site with no npm at runtime. Vite builds a self-contained static `dist/` preview; Three.js stays pinned in the import map. `tools/pipeline/` is a separate dev-only npm package.
- All user-facing copy lives in `js/content.js`, in `en` and `pt`.
- The HTML panel is the source of truth. WebGL stays on in the shipped site; WebGL off is a test scenario only. The site must work with `prefers-reduced-motion`.
- Never publish a home address or phone number. Use relative URLs only.
- Graphics quality never drops at runtime. Do not propose quality selectors or adaptive downgrades.
- Mobile work is paused by the owner: no mobile tests or checks.
- Feature branches stay off `main` until the owner releases them. Pushing to `main` deploys.
- Edit only files in scope. Do not revert or overwrite working-tree changes you did not make. No destructive git commands.
- Do not commit or push unless asked.
- 3D city: scope work from the current user request and preserve the camera, route, landmarks, scene scale, existing interactions, and established visual identity unless the request explicitly includes them. No standing visual freeze or rollout approval gate applies. Every external asset needs an entry in `ASSET_SOURCES.md`.

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

Check that a skill, plugin or MCP server is installed before relying on it. Use what is available and relevant. These are the default for Codex and Claude, when installed:

- `superpowers:using-superpowers`, `superpowers:brainstorming`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`.
- `superpowers:subagent-driven-development`, `superpowers:dispatching-parallel-agents`: only when subagents are authorized.
- `ponytail:ponytail` for minimal code; `caveman:caveman` for terse prose.
- `frontend-design:frontend-design` and `product-frontend-design` for UI work.
- `ctx_execute` for large command output and data analysis.
- `find-skills` (skill): discover and install a skill when a task needs a capability that is not installed yet.
- `browser-harness` (skill): direct browser control over CDP for interaction, logged-in sessions, JS-rendered or bot-protected pages. Plain fetch first for public pages.
- `serena` (MCP server): symbol-level code navigation and edits. Prefer it over reading whole files.
- `rea` (MCP server): reverse engineering of shipped artifacts, native binaries and browser targets. Analysis only; do not use it for ordinary source-repository architecture.

## Verification

Run the related tests before claiming a change is done: `node --test tests/`, plus browser suites for visual changes (desktop only). Report what was not run.
