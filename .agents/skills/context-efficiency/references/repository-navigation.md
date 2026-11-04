# Repository navigation

Read when you must find code or decide what to read in this repository. Project facts live in `AGENTS.md` (symlink of `CLAUDE.md`); do not copy them here.

## Search order

1. Identify the area from the task: `js/world/*` (3D scene modules), `js/content.js` (all copy), `tools/*` (Blender/Python pipelines), `tests/*` (Node `*.test.mjs`, browser `*.browser.py`), `docs/*`.
2. Symbol or file lookup first: the symbol-aware tool the project prefers (see `AGENTS.md`), else `rg -n "<symbol>" js tools tests`, `rg --files <dir> | rg <name>`.
3. Read the matched lines with context (`rg -n -C 3`) or a bounded range. Open a whole file only when it is short or you must restructure it.
4. Follow imports one hop at a time (`rg -n "from './x.js'"`) instead of reading the dependency tree.
5. For tests, find the owner by name: `rg --files tests | rg <topic>`.

## Exclusions by default

Skip unless the task needs them: `node_modules`, build output, `docs/evidence/**` and other image folders, `assets/**` binaries (GLB, PNG, KTX2), lockfiles, `.git`, minified or vendored files.

## Choosing which doc to open

`AGENTS.md` lists the current references. Open only the one matching the change:

- city architecture or rollout: `docs/architecture/3d-city.md`
- budgets and measurements: `docs/architecture/rendering-budget.md`
- visual language: `docs/art-direction.md`
- assets and licences: `docs/art/asset-quality-spec.md`, `ASSET_SOURCES.md`
- product or runtime interfaces: `docs/PRD.md`, `docs/TRD.md`

Dated files under `docs/superpowers/`, `docs/handoff/` and `docs/codex/` are history; read one only when the task points to it.

## Before editing

Confirm the owner of the file (other agents or the user may be editing the same tree), run `git status --short` once, and stage only your explicit paths when committing.
