# Samuel Catalano - Portfolio

A scroll-driven voxel London where a red double-decker bus rides through Samuel Catalano's career. GitHub Pages serves the static HTML, CSS and JavaScript modules directly; npm is not needed at runtime.

- Preview: `python3 -m http.server 8000`
- Dev server: `npm ci && npm run dev`
- Static bundle preview: `npm run build`, then `python3 -m http.server 8001 --directory dist`
- Tests: `node --test tests/`
- Deploy: push to `main`; GitHub Pages serves from the repo root.

The Vite build bundles the world code into a lazy static chunk and copies runtime assets into `dist/`. The 8.7 GB `assets/models/source/` archive is retained in the repository and excluded from the build output.

See `CLAUDE.md` and `docs/` for architecture and conventions.
