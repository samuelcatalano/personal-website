# Handoff status log

## 2026-10-29 — Codex continuation

- **Repository:** `feat/site-gamefication` is clean at `8e23dbc` and matches `origin/feat/site-gamefication`. `8e23dbc` adds the 2026-10-29 handoff document on top of `cdff284`; the handoff's stated HEAD is therefore one commit behind, and its “none pushed” note is stale for the current tracking ref. No history was rewritten.
- **Scope:** read the handoff, `CLAUDE.md`, and the current city references (`3d-city.md`, `rendering-budget.md`, `art-direction.md`). No implementation, asset, or visual changes made in this continuation.
- **Graphics TODO:** the handoff records Phases 1–4 as complete and Phase 5 (mobile) as intentionally skipped. The visual atlas predates those later graphics commits. The graphics TODO's GLB-pedestrian item is stale: that experiment was abandoned, and its future direction remains undecided.
- **Asset pipeline observed:** Phase 0 tooling, Phase 1 processed vehicle assets, and Phase 2 Big Ben assets/runtime are present in the current tree. The project architecture page still says “plan, nothing implemented”; the roadmap still presents Big Ben as a future POC and processed loading as flag-gated. The handoff's Big Ben triangle figures also differ from the committed baseline; reconcile those records before treating either set as authoritative. Sketchfab/NC-SA sourcing approval is recorded in the handoff and `ASSET_SOURCES.md`, while older architecture text still frames sourcing as an open decision.
- **Carry-forward issues:** the handoff reports failures in `tests/underpass.browser.py`, `tests/london-cab.browser.py`, `tests/hero-facades.browser.py`, and `tests/world.browser.py`; it also says `tests/zfight.browser.py` skips yawed boxes. These were not rerun here. The handoff reports 116/116 Node tests at its stated implementation handoff; no tests were run in this continuation, per instruction.
- **Environment:** local server was stopped; no browser capture, test, deployment, or mobile work was performed.
- **Next step:** wait for explicit owner approval before starting Phase 3 (the townhouse modular kit). Further landmark phases, Phase 6 lighting, moving/deleting raw GLBs, CI, and the pedestrian experiment also remain approval-gated as described in the handoff.

