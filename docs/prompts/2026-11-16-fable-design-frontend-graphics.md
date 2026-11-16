# Prompt para Fable — melhorias de design, front-end e gráficos (2026-11-16)

Cole o bloco abaixo numa nova sessão (modelo Fable), na raiz deste repositório.

---

Você vai trabalhar no portfólio 3D do Samuel Catalano (repo `personal-website`, branch `feat/site-gamefication`). Responda em português do Brasil; código, comentários e commits em inglês.

## ⚠️ RESTRIÇÕES DESTA SESSÃO (prevalecem sobre tudo abaixo)

- **NÃO IMPLEMENTE NADA.** Não edite código, CSS, HTML, shaders nem assets. Não faça commit. A entrega é **só análise e plano**: verificar os itens, priorizar, desenhar a solução de cada um e escrever o plano em `docs/plans/2026-11-16-design-frontend-graphics-plan.md` (único arquivo que você pode criar/editar).
- **NÃO FAÇA TESTES EM MOBILE.** Nada de `MOBILE=1`, `resize_window` para mobile ou emulação de 375 px. Itens de mobile (A14, B2–B5, C8) são analisados só pelo código (CSS/JS) e pelas capturas já descritas aqui.
- **Economize tokens.** Leia por trechos (Serena / `offset`+`limit`), nunca arquivos grandes inteiros; saída grande de comando sempre via `ctx_execute` imprimindo só o resultado; poucas capturas (desktop, paradas mínimas para confirmar P1); chat curto, detalhe vai para o arquivo do plano.
- **Use estas skills** (invoque pelo Skill tool no momento em que se aplicam):
  - `superpowers:using-superpowers` — no início, para o fluxo de skills.
  - `superpowers:brainstorming` — antes de desenhar as soluções.
  - `superpowers:subagent-driven-development` e `superpowers:dispatching-parallel-agents` — para estruturar o plano em tarefas independentes que poderão rodar em paralelo depois (o dono autoriza subagentes **somente para análise/leitura**, nunca para editar).
  - `superpowers:test-driven-development` — para definir, no plano, o teste/checagem que cada tarefa deverá ter quando for implementada (não escreva os testes agora).
  - `superpowers:verification-before-completion` — antes de afirmar qualquer coisa como confirmada.
  - `ponytail:ponytail` — para cada solução escolher o caminho mais simples que resolve.
  - `caveman:caveman` — para comunicação curta no chat.
  - `ui-ux-pro-max`, `anthropic-skills:ui-ux-design-system`, `frontend-design:frontend-design`, `product-frontend-design` — para as decisões de UI, tokens, tipografia, hierarquia e layout (seções B e C).
  - `anthropic-skills:canvas-design` — só se precisar de um esboço visual estático de layout proposto (PNG em scratchpad, opcional).
  - `ctx_execute` — para toda saída grande (grep, testes, listagens, logs).

## Antes de tudo

1. Leia `CLAUDE.md` inteiro e siga-o à risca (sem build, sem npm, `three` pinado via importmap, toda copy em `js/content.js` com `en` e `pt`, URLs relativas, privacidade do CV, subagentes desligados por padrão, validação proporcional à mudança).
2. Leia só o necessário de: `docs/art-direction.md`, `docs/architecture/rendering-budget.md`, `docs/audits/WEBSITE_VISUAL_ART_DIRECTION_AUDIT.md` (§7 tem o que já foi feito nas Fases 1–3 de 2026-11-13) e `docs/audits/full-scene-visual-atlas.md`.
3. Rode `git status` e preserve qualquer mudança que já esteja na árvore.

## Regras do dono (não negociáveis)

- **Qualidade gráfica sempre máxima.** Nunca proponha seletor de qualidade, tier "low" nem degradar desktop para ganhar FPS. Ganho de desempenho só sem perda visual.
- **Fora de escopo (track da Codex):** densificação urbana, casas/sobrados, lotes (pegadas e alturas), landmarks em si e o Copan. Não altere geometria desses; materiais/luz globais que os afetem pedem OK.
- Preserve mapa, rotas, linhas de visada dos landmarks, pedestres e lógica existente.
- Veículos: modelos reais em GLB cru (padrão); nada de kits estilizados gerados por script.
- Assets externos: CC0/permissivo primeiro; registre em `ASSET_SOURCES.md`. Licença ambígua = não usar.
- **Nada de merge/push na `main`.** Não faça commit sem o dono pedir.
- Medição de FPS: use `preview_start` (painel visível), uma aba por corrida; painel oculto pausa o rAF.
- Itens marcados **[OK]** abaixo mexem em algo já aprovado (luz global, câmera, intro, céu, paleta): apresente antes/depois e peça aprovação antes de manter.

## Método (só análise e plano)

1. **Confirme os P1** com o mínimo de capturas desktop: `OUT=<scratchpad>/before SHOTS="9.5:day,17:day,11:night" GRID=1 QUERY=weather=clear browser-harness < tools/capture.py`. Nada de `MOBILE=1`. Os demais itens: confirme pelo código (trecho exato, `arquivo:linha`). Item que não se confirmar: marque "não confirmado".
2. Para cada item, localize a causa no código e escreva no plano: causa (`arquivo:linha`), solução mais simples (ponytail), arquivos afetados, risco, custo (S/M/L), se precisa [OK] do dono e a checagem que validará a implementação futura (TDD: qual teste em `tests/` ou qual captura/métrica).
3. Agrupe em lotes por sistema (UI/CSS → front-end técnico → materiais → luz/céu → pós-processo), P1 primeiro. Marque quais lotes são independentes (podem ir em paralelo por subagente) e quais são sequenciais (luz global e céu nunca em paralelo).
4. Grave tudo em `docs/plans/2026-11-16-design-frontend-graphics-plan.md`. Não repita o plano no chat.
5. Resposta final curta: link do plano, itens confirmados / não confirmados, lista de [OK] que aguardam o dono e a ordem de lotes recomendada. Pare e aguarde.

## Lista de melhorias (auditoria de 2026-11-16, HEAD `318796a`)

Prioridade: P1 alto impacto percebido · P2 médio · P3 polimento. "(H)" = hipótese a confirmar.

### A. Gráficos 3D

| # | P | Onde | Problema observado | Direção |
|---|---|---|---|---|
| A1 | P1 [OK] | Céu, quase todas as paradas (9.5, 14, 17) | Nuvens ainda leem como blocos/degraus "voxel"; o feather da Fase 3 foi modesto | Silhueta de nuvem contínua (fbm com domain warp, borda suave, variação de altura), sem novo passe. `js/world/sky.js` |
| A2 | P1 | Horizonte/fundo (17 Wembley, 14, noite) | Skyline distante = caixas planas com janelas soltas e lajes "flutuando"; à noite vira um cartão plano de pontos | Massa de fundo com perspectiva aérea mais forte, telhados coerentes, janelas noturnas com ritmo irregular. `js/world/backdrop.js` |
| A3 | P1 | Dia, ruas (9.5, 1) | Sombras longas, escuras e duras (Eye/Big Ben atravessam a avenida); prédios e veículos sem sombra de contato parecem "pousados" | Calibrar raio/bias do PCF para escala de rua; AO de contato barata (vertex AO / decal na base de prédios e sob veículos) ou GTAO leve se couber no orçamento [OK luz] |
| A4 | P1 | Rua em 17-day (perto do ônibus) e Glasgow noite | Manchas brancas elípticas no asfalto (poça/farol) lendo como artefato | Rever `wet-surfaces.js` / poça de farol: só com chuva/noite, borda suave, intensidade física |
| A5 | P1 | Parada 17 (Wembley) | Asfalto termina abruptamente na faixa; ônibus fica parado sobre a junção rua/praça (H: fim da rede viária) | Conferir `urban-roads.js`; fechar a rua com curva/retorno ou recuar a parada |
| A6 | P2 | Praças de Londres (9.5 primeiro plano) | Piso em xadrez vermelho/bege e áreas cinza lisas leem como placeholder | Paginação com junta, variação por módulo e borda/meio-fio; paleta mais sóbria |
| A7 | P2 | Barracas/toldos (9.5 primeiro plano) | Toldos roxo/amarelo chapados, sem espessura nem tecido | Toldo com caimento, listras e sombra; paleta alinhada à art direction |
| A8 | P2 | Tâmisa (9.5) | Espuma branca excessiva nas margens (lê como neve); água sem cor própria (Fase 1 mostrou que só mais reflexo puxa marrom) | Reduzir espuma; dar cor própria (absorção verde-acinzentada) e Fresnel. `js/world/water.js` |
| A9 | P2 | Gramados (todas) | Faixas de verde saturado e chapado, sem borda nem variação | Variação de tom por ruído, borda de canteiro, leve desaturação |
| A10 | P2 | Wembley (17) | Tambor cinza uniforme, telões verdes simples, cobertura sem leitura | Material com variação de painéis e brilho noturno do tambor; só material/luz (landmark = Codex para geometria) [OK] |
| A11 | P2 | Noite, Glasgow (11) e geral | Glasgow noite escura demais; céu noturno sem gradiente/estrelas legíveis; janelas noturnas em grade regular | Céu noturno com gradiente e estrelas; preenchimento lunar; variação de janelas acesas [OK luz] |
| A12 | P2 | Pós-processamento (nenhum hoje) | Sem bloom (luzes noturnas sem halo), cabos/mullions finos com serrilhado; Estaiada/Eye já tiveram overexposure à noite | Avaliar bloom seletivo noturno + SMAA via addons do three pinado, medindo A/B; sem tier de qualidade [OK] |
| A13 | P2 | Vidro das torres (5, 14) | Reflexo ainda analítico e chapado; `tower-glass` com k=0.22 não aparece | Decisão do dono sobre PMREM nas torres (conflito com "no cubemaps") [OK] |
| A14 | P2 | Mobile (375 px) | Sem sombras e DPR 1 no mobile: abismo visual vs desktop | Subir qualidade do mobile onde couber (sombra simples do sol, DPR até 1.5) medindo; nunca baixar desktop |
| A15 | P3 | Pedestres | Billboards visíveis em plano próximo; pouca variação de silhueta | Mais variação de altura/roupa no atlas; transição billboard→NPC 3D mais suave |
| A16 | P3 | Névoa/atmosfera | Horizonte cinza uniforme; sem névoa de altura | Height fog leve e cor de horizonte por cidade (mood.js) [OK luz] |
| A17 | P3 | Chuva | Estado `weather=rain` não revalidado desde 11-12 | Capturar 5/9.5/11 com chuva e listar defeitos |
| A18 | P3 | Transições entre cidades e câmera | Não auditadas em movimento | Gravar um clipe da rota e listar cortes/pops de LOD |

### B. Design de interface

| # | P | Onde | Problema | Direção |
|---|---|---|---|---|
| B1 | P1 | Barra superior desktop (~800–1100 px) | Três cápsulas flutuantes com alturas/alinhamento diferentes; nav com scrollbar horizontal visível e "Recommendations" cortado | Uma barra coerente: altura e raio iguais, nav que colapsa em menu "Mais" em vez de rolar |
| B2 | P1 | Mobile, após embarcar | Três barras empilhadas ocupam ~25% da altura; nav cortada ("Code", sem "Recommendations"); bottom sheet cobre ~50%; cidade quase invisível | Barra única compacta; sheet com estados (recolhido/meio/cheio) e alça; ações secundárias num menu |
| B3 | P1 | Mobile | Botão "Hide the interface (H)" mostra atalho de teclado em touch e sobrepõe o sheet | Sem "(H)" em `pointer: coarse`; reposicionar fora do sheet |
| B4 | P2 | Mobile | Botão GitHub aparece preto (hover/focus preso no toque) enquanto LinkedIn/CV são claros | `:hover` só em `(hover: hover)`; estados consistentes |
| B5 | P2 | Ícones da barra (mobile) | Play, avanço, olho, câmera, som, chat sem rótulo visível; olho/câmera ambíguos | Rótulo curto ou tooltip ao toque longo; ícones mais explícitos |
| B6 | P2 | Painel Journey (desktop) | Rolagem aninhada (timeline com scroll próprio dentro do painel); "Current role" repete info | Uma só área de rolagem; hierarquia mais enxuta |
| B7 | P2 | Bilhete de carregamento | Rótulo órfão "· Trees"; anos duplicados na linha do tempo desktop ("2017 2017"); botão "Start the journey" parece ativo com 17% | Rótulo de fase legível; dedupe de anos; estado desabilitado claro até pronto (ou explicar que já pode partir) |
| B8 | P2 | Sistema visual | Só 7 custom properties para ~64 cores hex; 4 famílias tipográficas (Inter, Hammersmith One, serif Iowan/Palatino, mono) | Tokens de cor, raio, sombra, espaçamento e escala tipográfica fluida (`clamp`); reduzir famílias |
| B9 | P3 | Painéis translúcidos sobre cena clara | Contraste do texto sobre vidro varia com a cena (H) | Medir contraste nas paradas mais claras; scrim mínimo garantido |
| B10 | P3 | Microinterações | Transições de painel/stop podem ganhar coreografia (entrada do cartão, carimbo) | Só com `prefers-reduced-motion` respeitado |

### C. Front-end técnico

| # | P | Problema | Direção |
|---|---|---|---|
| C1 | P1 | Console: "An unknown error occurred when fetching the script" ao carregar (H: registro do `sw.js`) | Diagnosticar e corrigir; zero erros no console |
| C2 | P2 | Google Fonts bloqueia render (Inter + Hammersmith One) | Self-host woff2 com subset, `preload` e `font-display`; cache no SW |
| C3 | P2 | Breakpoints soltos (1100/1050/767/768/640/480, max-height 820) | Unificar em 3–4 breakpoints; container queries para o painel |
| C4 | P2 | `style.css` único de 673 linhas, 7 `!important` | Organizar com `@layer` e seções; remover `!important` onde der |
| C5 | P2 | 9 `backdrop-filter` sobre o canvas WebGL (custo de GPU, H) | Medir; trocar por fundo sólido translúcido onde não houver ganho visual |
| C6 | P3 | Imagens PNG (`Sammy.png`, `social-preview.png`) | WebP/AVIF com fallback e `srcset` |
| C7 | P3 | `three@0.169.0` | Avaliar upgrade pinado (pede OK por ser dependência) |
| C8 | P3 | Mobile: alturas e safe areas | Conferir `100dvh` e `env(safe-area-inset-*)` no sheet e na barra |
| C9 | P3 | Robustez WebGL | Confirmar tratamento de `webglcontextlost` e fallback HTML |

### D. Acessibilidade e matriz

| # | P | Direção |
|---|---|---|
| D1 | P2 | Lighthouse a11y ≥ 95 desktop e mobile; foco visível em todos os controles; ordem de tab lógica |
| D2 | P2 | Para a implementação futura (não rodar agora): matriz desktop + 375 px, dia/noite, EN/PT, WebGL off, reduced motion, console limpo |
