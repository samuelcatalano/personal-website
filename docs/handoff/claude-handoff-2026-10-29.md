# Claude Handoff — Personal Website 3D City

Updated: 2026-10-29. Communicate with Samuel in Brazilian Portuguese. Keep code, comments, commit messages, and repository documentation in English.

## Read first

1. `AGENTS.md` / `CLAUDE.md` — repository rules and model/tool guidance.
2. `docs/architecture/3d-city.md`, `docs/architecture/rendering-budget.md`, and `docs/art-direction.md` — current city architecture, budgets, and approved look.
3. `docs/handoff/codex-handoff-2026-10-29.md` — broader implementation history and asset pipeline context. Treat current architecture docs as authoritative where older plans conflict.
4. `docs/handoff/status-log.md` — dated continuation record.

The older `docs/handoff/claude-3d-city-handoff.md` predates later work. Use it as historical context only where it conflicts with the current references or this update.

## Repository and runtime state

- Repository: `/Users/samuel.catalano/Projects/samuelcatalano/personal-website`
- Branch: `feat/site-gamefication`
- HEAD: `4d8ef2c` (`docs(handoff): record exact London Eye house fix`), tracking `origin/feat/site-gamefication`; the working tree was clean when this handoff was written.
- Local preview: `http://localhost:8000`, server PID `59036`. Samuel asked to keep it running for manual review. Do not start a duplicate server or stop this one without a reason.
- Static site, no build step or npm in the shipped site. Three.js is pinned in the import map. Use relative URLs.
- Desktop only for current work. Samuel explicitly said not to run mobile tests. Never push or deploy unless he asks.

## Latest issue and exact resolution

Samuel repeatedly reported that the yellow townhouse in front of/right of the London Eye was still visible. Earlier fixes were wrong: they hid Glasgow's `block-679--80-0`, then unrelated London Eye-adjacent rows. Those unrelated lots have been restored.

The marked house was identified by a desktop scene raycast, not inferred from its approximate position:

- Exact plot ID: `frontage-gap-olm-135--1--9`
- Source descriptor: `js/world/city.js` around lines 157–163, in the UK frontage-gap generation path.
- Render path: `buildCity` collects `onArchitecturePlot` descriptors → `scene.js` calls `buildRealCity` → `createCityBuildings` → `createCityRollout`.
- It was the only plot in chunk `architecture-cell-96--32` during the raycast capture.
- The final implementation skips only this exact ID in `js/world/building-kit.js`. The eight unrelated `block-120--80-*` and `lot-front-105--81.5-*` lots remain rendered.
- Fix commit: `75f85ef`. Handoff/status commit: `4d8ef2c`.

Desktop A/B at stop 10 confirmed that hiding only this target removes the matching yellow house (dark hipped roof, yellow walls, brick ground floor) while nearby houses remain. Captures from that verification were `/tmp/eye-exact-10.png`, `/tmp/eye-exact-10-hidden.png`, and `/tmp/eye-fixed-stop10.png`; these are temporary and may disappear.

## Verification actually run

- `tests/citywide.browser.py` through `browser-harness`, with a fresh tab and cache disabled: passed. It checks the exact target emits no mesh with `rollout` both enabled and disabled, and checks nearby house IDs remain in the rendered group.
- `node --check js/world/building-kit.js`: passed.
- `git diff --check`: passed.
- Desktop visual A/B at stop 10: inspected; exact marked house absent, nearby houses restored.
- The complete Node suite, mobile checks, Lighthouse, deployment, and push were not run.

## Guardrails for continuation

- The visual house-removal request is resolved at the exact plot ID above. Do not broaden the exclusion or remove neighboring rows again.
- If Samuel reports it still visible after the latest fix, first hard-reload the browser and disable cache in a fresh desktop tab; then raycast the visible pixels and trace the resulting mesh to its plot ID. Do not guess from x/z proximity or from a wide capture.
- Preserve the map, lot footprints/heights, routes, landmarks, sightlines, pedestrians, and existing movement/rendering logic unless Samuel explicitly reopens them.
- No further visual or asset-pipeline implementation is authorized by this handoff alone. Ask before starting another phase; Phase 4 props remain a separate potential slice.
- Preserve unrelated working-tree edits. Never use destructive `git reset`, `git restore`, `git clean`, or `git stash`.

## Copy-ready prompt for Claude

```text
Leia primeiro `docs/handoff/claude-handoff-2026-10-29.md` inteiro, depois `AGENTS.md`/`CLAUDE.md` e as três referências atuais de cidade indicadas no handoff. Use também `docs/handoff/status-log.md` para o estado recente.

Continue deste estado sem repetir a descoberta já registrada. O bug da casa amarela em frente/à direita da London Eye foi corrigido: o lote exato é `frontage-gap-olm-135--1--9`, confirmado por raycast; apenas esse ID é excluído. Os oito lotes vizinhos removidos por tentativas anteriores foram restaurados. A validação desktop direcionada passou e a captura A/B no stop 10 confirmou a remoção. Não reabra nem amplie essa alteração sem eu pedir.

Responda em português brasileiro. O preview local em http://localhost:8000 deve permanecer ativo. Não rode testes mobile, não faça deploy nem push. Preserve alterações preexistentes e nunca use `git reset`, `git restore`, `git clean` ou `git stash`. Não inicie outra fase visual/asset sem minha autorização explícita. Aguarde minha próxima tarefa; se eu disser que a casa ainda aparece, investigue em uma aba desktop nova com cache desabilitado e identifique a geometria por raycast antes de editar qualquer coisa.
```
