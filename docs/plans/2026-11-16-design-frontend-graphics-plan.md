# Plano — design, front-end e gráficos (2026-11-16)

**Status:** análise e plano. Nada implementado, nada commitado. HEAD `318796a`, branch `feat/site-gamefication`.
**Origem:** lista de 40 itens em `docs/prompts/2026-11-16-fable-design-frontend-graphics.md`.
**Este plano não autoriza implementação.** Cada lote precisa do OK do dono; itens **[OK]** precisam de antes/depois aprovado.

## 1. Como foi verificado

- Capturas desktop, `weather=clear`: `9.5:day`, `17:day`, `11:night` (`tools/capture.py`, fora do repo, em scratchpad).
- Código: trechos citados como `arquivo:linha`.
- Console e service worker: uma carga no painel de browser embutido.
- **Não verificado:** mobile (proibido nesta sessão), chuva, movimento/transições, Lighthouse, FPS, Chrome real. Itens de mobile foram lidos só no CSS/JS.

Legenda de status: **C** confirmado (captura ou código) · **CP** confirmado em parte · **NC** não confirmado · **NV** não verificado nesta sessão.
Custo: S (≤1 h) · M (meio dia) · L (1 dia ou mais).

## 2. Achados que mudam a lista original

1. **A12 parte de premissa errada.** Já existe pós-processo: `js/world/post.js:55-68` monta `EffectComposer` com MSAA 4×, AO próprio (`ao-pass.js`), raios de sol, `UnrealBloomPass(0.10, 0.2, 0.95)`, `OutputPass` e grade. O item vira "afinar bloom noturno", não "adicionar bloom/SMAA".
2. **A1 tem causa provável diferente.** Os "degraus voxel" no horizonte de 9.5 são caixas de prédio distantes lavadas para a cor do horizonte, não o shader de nuvem. Evidência: as mesmas silhuetas em degrau aparecem em `11:night` com janelas acesas. As nuvens de fato (lobos rosados acima) já são suaves (`sky.js:110-120`). A correção principal é do fundo (A2), não do céu. Hipótese forte, falta um teste de isolamento (ver A1).
3. **Existe rebaixamento automático de qualidade.** `scene.js:654-659` + `camera.js:61`: abaixo de 40 FPS em duas janelas de 2 s o tier cai de `high` para `medium` e nunca volta. `medium` perde AO, raios e depth texture (`post.js:59`). Isso contraria "qualidade sempre máxima". **Decidido pelo dono em 2026-11-16: remover; a qualidade nunca diminui** (item novo N1).
4. **`prefers-reduced-motion` também reduz qualidade.** `scene.js:461`: reduced motion inicia em `medium`. Movimento reduzido não deveria tirar AO. Item novo N2.
5. **C1 confirmado, mas provavelmente é do ambiente.** `navigator.serviceWorker.register('sw.js')` rejeita com "An unknown error occurred when fetching the script" no painel embutido, embora `sw.js` responda 200, `text/javascript`, sintaxe válida e `fetch('sw.js')` da própria página funcione. `main.js:173` já engole a rejeição. Falta reproduzir em Chrome real antes de mexer.
6. **Erro novo de WebGL com viewport 0×0.** Com a aba em 0×0 px o console enche de `GL_INVALID_FRAMEBUFFER_OPERATION ... Attachment has zero size` (258 avisos). Item novo N3.
7. **C9 confirmado como lacuna.** Não há nenhum listener de `webglcontextlost`/`webglcontextrestored` em `js/`. Só existe o fallback de falha na criação (`main.js:167-169`).

## 3. Decisões que aguardam o dono

| # | Decisão | Por quê |
|---|---|---|
| A1 | Mexer no shader de nuvem (céu aprovado) | Só se o teste de isolamento mostrar que ainda precisa |
| A3 | Suavizar/clarear sombra e (opcional) elevação do sol | Luz global |
| A10 | Material/brilho noturno do Wembley | Landmark |
| A11 | Céu noturno, estrelas, preenchimento lunar | Luz global e céu |
| A12 | Subir bloom noturno | Pós-processo aprovado |
| A13 | PMREM nas torres | Conflita com "no cubemaps" |
| A16 | Height fog e cor de horizonte por cidade | Luz global |
| A5 | Fechar a rua em Wembley ou recuar a parada | Mapa/rota preservados por regra |
| A2 | Quem é dono das "lajes flutuantes" em 17 | Podem ser de `urban-infill.js` (track da Codex) |
| A6/A7 | Paleta mais sóbria em praças e toldos | Paleta aprovada |
| B8 | Reduzir famílias tipográficas (serif do bilhete) | Identidade do bilhete aprovada |
| C7 | Upgrade de `three@0.169.0` | Dependência |
| C2 | Self-host de fontes (novos arquivos binários no repo) | Registro em `ASSET_SOURCES.md` (OFL) |

## 4. Itens — causa, solução mínima, checagem

### 4.1 Gráficos 3D

| # | P | St | Causa (`arquivo:linha`) | Solução mais simples | Arquivos | Risco | Custo | Checagem futura |
|---|---|---|---|---|---|---|---|---|
| A1 | P1 [OK] | CP | Silhuetas em degrau vêm das caixas distantes (`backdrop.js:108-141`, `skyline.js:4-25`), não de `sky.js:110-120` | 1º isolar: esconder `skyline` via probe `?qa` e recapturar 9.5. Se sumir, resolver em A2. Só se sobrar degrau: domain warp de 1 linha em `sky.js:110` (`p += (fbm(p*2.0)-.5)*.25`) | `skyline.js`, talvez `sky.js` | Baixo; céu é aprovado | S | Captura 9.5/14/17 antes/depois; `tests/sky-weather.browser.py` |
| A2 | P1 | C | Dia: coroas em degrau e lajes de topo com cor contrastante e beiral (`backdrop.js:50,77,119-120`). Noite: janelas em grade fixa 4,2 × 3,4 m, ~1/3 acesas, mesma cor (`skyline.js:19-25`) | Linhas distantes: topo na cor da parede, sem beiral; puxar cor para o horizonte por distância (uniform `uSilhouette` já existe). Noite: razão de acesas por prédio via hash (10–60%), andares inteiros apagados, 2 tons (quente/frio) | `backdrop.js`, `skyline.js` | Médio: `tests/backdrop.test.mjs` e `diversity-backdrop.test.mjs` fixam contagens/seed. Não mudar a sequência do RNG | M | Esses 2 testes verdes + captura 17 dia e 11 noite |
| A3 | P1 [OK luz] | C | Sol baixo: `SUN_DIR (110,45,40)` ≈ 21° de elevação (`sky.js:22`) → sombra ≈ 2,6× a altura. Borda dura: `PCFSoftShadowMap`, texel 7,8 cm, sem raio (`scene.js:108,120-122`) | Passo 1: `sun.shadow.intensity` ~0,8 (clareia sombra sem tocar hemi/céu). Passo 2: A/B `PCFShadowMap` + `shadow.radius` 2–3 para penumbra. Passo 3 (opcional, OK à parte): elevação do sol. Contato: afinar `AOPass` existente (`ao-pass.js:60`, strength .85, radius 1.6) em vez de novo passe | `scene.js`, `ao-pass.js` | Médio. Conferir na doc do three r169 se `radius` vale para o tipo escolhido e se `shadow.intensity` existe nessa versão | M | Captura 9.5 e 1 dia; A/B de frame time (contrato em `rendering-budget.md`) |
| A4 | P1 | CP | Sintoma visto: dois pontos brancos à frente do ônibus de dia (17) e manchas à noite (11). Poças de farol e brilho traseiro são travados por `night` (`beams.js:66-68`), então a origem diurna **não foi localizada**. Suspeitos: material `glow` dos faróis (`buses.js:29,279-294`) passando do limiar do bloom, ou `wet-surfaces.js:101-105` | 1º isolar com `?qa` (`__qaPost.passes.bloom.enabled=false`, depois esconder lâmpadas). Corrigir na origem: escalar `glowK` por `night` ou baixar a emissão diurna | `buses.js` ou `post.js` | Baixo | S | `tests/headlight-pool.browser.py`, `tests/beams.browser.py`; captura 17 dia |
| A5 | P1 | CP | Visto em 17: o asfalto acaba na faixa e vira calçada; ônibus parado na junção. A rua da rota é gerada ao longo da curva e termina no último ponto (`city.js:114-117`). Ligação com `urban-roads.js` não investigada | Preferida: estender o asfalto ~1 quadra além do fim e ligar à malha de `urban-roads.js` (cruzamento em T). Alternativa de 1 linha: recuar a marca da parada 17 alguns metros | `city.js` ou `layout.js`, `roadmarks.js` | Médio: mapa/rota são preservados por regra; pede OK | M | `tests/urban-roads.test.mjs`; captura 17 |
| A6 | P2 | C | Xadrez 4 × 4 m alternando `tileCream`/`tileTerra` (`parks.js:55,257`) | Trocar xadrez por módulo único com junta e variação de tom por hash (±6%); terracota só em faixa de borda | `parks.js` | Baixo; contagem de caixas tem guarda (`architecture-migration.test.mjs`) | S | Captura 9.5; teste de migração verde |
| A7 | P2 | C | Guarda-sóis e toldos são caixas chapadas com cores cheias (`parks.js:55,214-215,281-283`: `UMB`, `AWN`) | Dois tons listrados já existem em `AWN`; aplicar o mesmo par aos guarda-sóis, tirar violeta/tulipa cheios, dar 2 caixas inclinadas (caimento) em vez de 1 plana | `parks.js` | Baixo | S | Captura 9.5 |
| A8 | P2 | C | Espuma: `FOAM_WIDTH = 1.4` m e mistura 0,55 de quase-branco (`water.js:9,126-134`). Cor própria já existe (`uDeep/uShallow/uBed`, absorção em `water.js:93-96`), mas é coberta pelo reflexo do céu quente | `FOAM_WIDTH` 1,4 → ~0,6 e mistura 0,55 → ~0,3. Depois, se preciso, subir o peso de `body` frente ao reflexo no meio do rio | `water.js` | Baixo. Não repetir `REFLECT_FLOOR` (testado e revertido na Fase 1) | S | `tests/water.test.mjs`, `boat-foam.test.mjs`; captura 9.5 |
| A9 | P2 | CP | Dois verdes fixos (`palette.js:3`, `parks.js:91`); variação de baixa frequência já existe (`textures.js:41-45,84`), mas fraca | Aumentar a amplitude do ruído de tom para `kind 1` (grama) e dessaturar `grass` ~8% | `textures.js`, `palette.js` | Baixo; mexe em paleta global de grama | S | Captura 9.5 e 17 |
| A10 | P2 [OK] | C | Tambor cinza uniforme em 17. Materiais do GLB tratados em `authored-landmarks.js:53-75`; luz noturna `FLOOD.wembley` em `landmark-geometry.js:29` | Só material: variação de painéis por ruído em world-space no material do tambor e intensidade do flood 0,5 → ~0,7. Sem geometria | `authored-landmarks.js`, `landmark-geometry.js` | Baixo | S | Captura 17 dia/noite |
| A11 | P2 [OK luz] | CP | Em 11 a cena não está escura demais, mas não há estrela legível e o céu é quase chapado. Estrelas: opacidade `night*1.15-.4` e faixa de altura estreita (`sky.js:168,239`). `NIGHT.zen/hor` próximos (`sky.js:21`) | Abrir contraste `NIGHT.hor` vs `zen`; estrelas +opacidade e tamanho mínimo. Preenchimento lunar: `NIGHT.hemi` 0,68 → ~0,75. Janelas: resolvido em A2 | `sky.js` | Médio (luz global). Fazer depois de A3, nunca junto | S | Captura 11 e 5 noite; `tests/mood.test.mjs` |
| A12 | P2 [OK] | NC | Premissa errada: bloom, MSAA 4× e AO já existem (`post.js:55-68`). Bloom é contido de propósito (0,10) após estouro em Estaiada/Eye | Não adicionar passe. Se o dono quiser mais halo: bloom dependente de `night` (0,10 dia → ~0,22 noite) na função que já ajusta a grade (`post.js:83-91`). SMAA não é necessário com MSAA 4× | `post.js` | Baixo; conferir Estaiada/Eye à noite | S | Captura 11 e 9.5 noite; sem estouro nos dois landmarks |
| A13 | P2 [OK] | CP | `scene.environment` já recebe o PMREM dos landmarks com `CITY_ENV = 0.2` (`scene.js:339-340,652`). Vidro das torres tem roughness 0,38 (`building-kit.js:26`), então o ambiente quase não aparece | Antes da decisão de cubemap: baixar roughness do `tower-glass` para ~0,15 e medir. É a opção sem asset novo | `building-kit.js` | Baixo; torres são kit aprovado | S | Captura 5 e 14 |
| A14 | P2 | C (código) | `scene.js:484` DPR ≤ 1 e `scene.js:488` sombras desligadas abaixo de 768 px; `post.js:59` sem AO em `medium` | Fora desta sessão (sem testes mobile). Plano: DPR até 1,5 e sombra do sol 1024, medindo em aparelho real | `scene.js`, `post.js` | Alto sem medição | M | Matriz D2 |
| A15 | P3 | NV | Não auditado; pedestres 3D vistos em 17, sem defeito evidente nessa escala | Adiar; pertence à frente NPC | — | — | — | — |
| A16 | P3 [OK luz] | C | Névoa linear única `Fog(0xa8d0f2, 240, 900)` (`scene.js:113`), escalada por `fogK` (`mood.js:6-9`) | Cor de horizonte por cidade já existe (`mood.hor`). Height fog exigiria patch em todos os materiais: **não fazer agora** (YAGNI); A2 resolve a leitura de profundidade | — | — | — | — |
| A17 | P3 | NV | — | Na implementação: uma captura `QUERY=weather=rain` em 5/9.5/11 e listar defeitos | — | — | S | A própria captura |
| A18 | P3 | NV | — | Na implementação: um clipe da rota (`browser-harness recordings`) e listar pops | — | — | M | O clipe |
| N1 | P1 | C | Rebaixamento automático de tier (`scene.js:654-659`, `camera.js:61`) | **Decidido (dono, 2026-11-16): remover.** Apagar o bloco de medição de FPS e `nextTier`; o tier nunca cai em tempo de execução | `scene.js`, `camera.js` | Máquinas fracas ficam lentas em vez de mais simples (aceito pelo dono) | S | Teste unitário de `nextTier`; `?qa` mostra tier estável |
| N2 | P2 | C | `scene.js:461`: reduced motion → tier `medium` | Separar: reduced motion desliga animação, não AO | `scene.js` | Baixo | S | Captura com reduced motion mostra AO ligado |

### 4.2 Interface

| # | P | St | Causa (`arquivo:linha`) | Solução mais simples | Arquivos | Risco | Custo | Checagem futura |
|---|---|---|---|---|---|---|---|---|
| B1 | P1 | C (código) | Três cápsulas independentes com `align-items: flex-start` e paddings próprios (`style.css:16-21,31,35`); entre 768 e 1050 px a nav rola na horizontal (`style.css:462-467`) | Uma faixa: `align-items: center`, mesma altura (48 px) e raio. Nav com `flex-wrap` fora de questão; usar "Mais" nativo: `<details>` com os 2 últimos links quando faltar espaço (container query na `.bar`) | `style.css`, `index.html`, `ui.js` (fechar ao navegar), `content.js` (rótulo "More/Mais") | Médio: testes `desktop-polish.browser.py`, `panel-focus.browser.py` | M | Teste browser: em 900 px nenhum link cortado, `nav.scrollWidth <= clientWidth` |
| B2 | P1 | C (código) | `.bar { flex-wrap: wrap }` com nav em linha própria (`style.css:444-447`); painel `max-height: 45vh` / 58vh no hero (`style.css:449,451`) | Barra de uma linha (marca + controles), nav vira o mesmo "Mais" de B1. Sheet em 2 estados por classe (`peek` ~28vh / aberto 60vh) com alça `<button>`; sem arrastar (toque alterna) | `style.css`, `index.html`, `ui.js` | Médio; mobile não foi testado aqui | M | Matriz D2 em 375 px |
| B3 | P1 | C (código) | Texto fixo com "(H)" (`content.js:78,120`, `ui.js:174-176`); botão fixo `right/bottom: 18px` sobre o sheet (`style.css:579`), compensado com 72 px de padding (`style.css:449`) | Texto sem "(H)" + `<kbd>` escondido em `(pointer: coarse)`. No mobile, mover o botão para dentro dos controles da barra e remover o padding de 72 px | `content.js`, `ui.js`, `style.css` | Baixo | S | `content.test.mjs` (en/pt); teste DOM do rótulo |
| B4 | P2 | C (código) | Hovers fora de `@media (hover: hover)`: `.panel a.btn:hover` inverte para fundo escuro (`style.css:96,98`); nenhuma ocorrência de `hover: hover` no arquivo | Envolver as regras `:hover` de botões em `@media (hover: hover)`; manter `:active` e `:focus-visible` | `style.css` | Baixo | S | grep: `:hover` de `.btn` só dentro do media |
| B5 | P2 | CP | Controles são só ícone, 36 × 36 px (`style.css:38`), abaixo de 44 px; rótulos existem mas escondidos (`.control-label { display: none }`, `style.css:36`) | `min-width/min-height: 44px` em `pointer: coarse`; mostrar `.control-label` dentro do menu "Mais" do mobile | `style.css` | Baixo | S | Lighthouse tap targets (D1) |
| B6 | P2 | C (código) | Rolagem dupla: `.panel { overflow: auto }` (`style.css:41`) e `.stops { max-height: 176px; overflow-y: auto }` (`style.css:440`, `:349`) | Tirar `max-height/overflow` de `.stops`; o painel rola sozinho. "Current role" duplicado: conferir em `ui.js` na implementação | `style.css`, talvez `ui.js` | Baixo; `panel-focus.browser.py` | S | Teste: `.stops` com `scrollHeight == clientHeight` |
| B7 | P2 | CP | "· Trees": a fase fica num span separado com `::before { content: ' · ' }` (`style.css:634-635`, `intro.js:63-64`), e quebra sozinho de linha. Botão: preenchido pelo progresso com `--fill` mesmo desabilitado (`intro.js:61`, `style.css:544`). Anos duplicados: um nó por parada mostra `st.year` (`intro.js:31`); o filtro só esconde pares abaixo de 480 px (`style.css:564`) | Fase: `white-space: nowrap` no conjunto status+fase. Anos: não renderizar `<b>` quando o ano é igual ao do nó anterior. Botão: manter o preenchimento, texto "Loading · 17%" já existe; reforçar com `cursor: progress` e contorno tracejado | `style.css`, `intro.js` | Baixo; `intro.test.mjs`, `intro-ticket.browser.py` | S | Teste unitário: lista de rótulos de ano sem repetição adjacente |
| B8 | P2 | C (código) | 64 hex distintos contra ~15 custom properties (`style.css:2-6,115-116`); 4 famílias (Inter, Hammersmith One, serif `style.css:152`, mono `style.css:133`) | Passo 1 (sem mudança visual): tokens de raio/sombra/espaço e mapear os hex repetidos para variáveis. Passo 2: escala tipográfica com `clamp`. Serif do título do bilhete é decisão do dono | `style.css` | Médio: refactor largo; fazer por seção, com capturas | L | Diff visual zero no passo 1 (capturas de UI antes/depois) |
| B9 | P3 | NV | Painel já é quase opaco: `--card: rgba(248,246,241,.97)` (`style.css:3,42`). Risco real está na barra (90%, `style.css:19`) e no `#ui-restore` (88%) | Provavelmente nada a fazer no painel; medir só a barra sobre céu claro | — | — | S | accesslint/Lighthouse contraste |
| B10 | P3 | — | Polimento | Adiar até B1–B7 fecharem | — | — | — | — |

### 4.3 Front-end técnico

| # | P | St | Causa (`arquivo:linha`) | Solução mais simples | Arquivos | Risco | Custo | Checagem futura |
|---|---|---|---|---|---|---|---|---|
| C1 | P1 | CP | Registro do SW rejeita no painel embutido (`main.js:173`); servidor e script estão corretos | 1º reproduzir em Chrome real. Se não reproduzir: sem correção, documentar. Se reproduzir: investigar com `chrome://serviceworker-internals` | `main.js`, `sw.js` | Baixo | S | Console limpo em Chrome real; `getRegistrations().length === 1` |
| C2 | P2 | C (código) | CSS do Google Fonts bloqueia render (`index.html:41-43`) | woff2 com subset latin em `assets/fonts/`, `@font-face` com `font-display: swap`, `preload` só da Inter 400/600. O SW já cacheia `woff2` (`sw.js:6`). Registrar OFL em `ASSET_SOURCES.md` | `index.html`, `style.css`, `ASSET_SOURCES.md` | Baixo | S | Rede: zero pedidos a `fonts.googleapis.com` |
| C3 | P2 | C (código) | Breakpoints: 480, 640, 767/768, 1050, 1100/1101, 1600 e `max-height: 820` (`style.css:30,272,347,403,442,443,462,515,557,564`) | Fixar 3: 480, 768, 1100. 640 → 768; 1050 → resolvido por B1 (container query); 1600 fica como exceção documentada | `style.css` | Médio | M | grep de `@media` lista só os 3 + exceções comentadas |
| C4 | P2 | C (código) | 673 linhas, 7 `!important` (`style.css:108,247,468,542,547,663`) | Remover os 5 de especificidade (`.footer`, `[data-intro-skip]`); manter os de reduced motion. `@layer` só se B8 for feito (mesmo refactor) | `style.css` | Baixo | S | grep: `!important` só em reduced motion |
| C5 | P2 | C (código), custo NV | 9 `backdrop-filter` (`style.css:19,42,120,251,257,285,286,579`). O painel é 97% opaco: o blur ali é quase invisível | Remover o blur do `.panel` (linha 42) primeiro, é o maior e o menos visível. Medir A/B de frame time antes de tocar barra/intro | `style.css` | Baixo | S | A/B `preview_start`, uma aba por corrida; captura sem diferença visível |
| C6 | P3 | CP | `Sammy.png` (72 KB) não é referenciado em `index.html`, `js/` nem CSS; é cópia byte a byte em tamanho de `assets/avatar.png`. `memoji-wave.png` 133 KB | Apagar `Sammy.png` se nada externo apontar para ele (confirmar com o dono). WebP para avatar e memoji com `<picture>`. `social-preview.png` fica PNG (crawlers) | `ui.js`, assets | Baixo | S | `content.test.mjs`; rede |
| C7 | P3 [OK] | C | `index.html:45` | Adiar. Sem necessidade concreta hoje; risco alto nos patches `onBeforeCompile` | — | Alto | L | — |
| C8 | P3 | C (código) | Zero ocorrências de `dvh` ou `safe-area`; tudo em `vh` (`style.css:11,12,41,284,349,449`) | `100dvh` com fallback `vh` em `#world` e `.panel`; `padding-bottom: env(safe-area-inset-bottom)` no sheet; `viewport-fit=cover` na meta | `style.css`, `index.html` | Baixo; validar em aparelho | S | Matriz D2 |
| C9 | P3 | C | Sem handler de contexto perdido em `js/` | No canvas: `webglcontextlost` → `preventDefault()` + classe `no-webgl` (o fallback HTML já existe). Restauração = recarregar a página; não reconstruir a cena | `scene.js` ou `main.js` | Baixo | S | Teste browser com `WEBGL_lose_context.loseContext()` |
| N3 | P2 | C | Render com viewport 0×0 gera 258 avisos de framebuffer incompleto (alvos de `post.js:100`, `water.js:256`, `wet-surfaces.js:178`) | Um guarda no loop: pular o frame quando `innerWidth` ou `innerHeight` for 0 | `scene.js` | Baixo | S | Console limpo com aba em 0×0 |

### 4.4 Acessibilidade e matriz

| # | P | St | Plano |
|---|---|---|---|
| D1 | P2 | NV | Rodar Lighthouse a11y depois dos lotes de UI. Achados já certos pelo código: alvos de 36 px (B5); foco visível existe globalmente (`style.css:40`) |
| D2 | P2 | — | Rodar no marco final: desktop + 375 px, dia/noite, EN/PT, WebGL off, reduced motion, console limpo |

## 5. Lotes e ordem

Regra TDD para a implementação: cada tarefa começa pela checagem da coluna "Checagem futura" falhando (teste em `tests/` quando há lógica; captura antes quando é visual) e só depois muda o código.

| Lote | Itens | Arquivos | Depende de | Paralelo? |
|---|---|---|---|---|
| L0 Decisões | Seção 3 | — | — | Bloqueia os lotes marcados |
| L1 UI barra e sheet | B1, B2, B3, B5 | `style.css`, `index.html`, `ui.js`, `content.js` | — | Não com L2/L3 (mesmo `style.css`) |
| L2 UI painel e bilhete | B4, B6, B7 | `style.css`, `intro.js` | L1 | Sequencial a L1 |
| L3 CSS técnico | C3, C4, C5, C8, depois B8 | `style.css`, `index.html` | L2 | Sequencial a L2 |
| L4 Carga e robustez | C1, C2, C6, C9, N3 | `main.js`, `sw.js`, `index.html`, `scene.js` (só o loop) | — | Sim, com L5 e L6. Coordenar `index.html` com L1 |
| L5 Materiais de chão e água | A6, A7, A8, A9 | `parks.js`, `water.js`, `textures.js`, `palette.js` | — | Sim, com L4 e L6 |
| L6 Fundo | A1 (isolamento), A2 | `backdrop.js`, `skyline.js` | — | Sim, com L4 e L5 |
| L7 Rua e faróis | A4, A5 | `buses.js`, `city.js` | OK de A5 | Sim, com L5/L6 |
| L8 Luz | A3, depois A11 | `scene.js`, `ao-pass.js`, `sky.js` | OK; depois de L6 (para julgar a noite com o fundo novo) | **Nunca em paralelo** com L9 ou L10 |
| L9 Céu | A1 (shader, se sobrar) | `sky.js` | L8 | Sequencial |
| L10 Pós e tier | A12, N1, N2, A13, A10 | `post.js`, `scene.js`, `camera.js`, `building-kit.js`, `authored-landmarks.js` | L8, L9 | Sequencial |
| L11 Auditorias | A17, A18, D1, D2, A14 | — | Tudo | Fim |

Ordem recomendada: **L0 → (L1 → L2 → L3) em paralelo com (L4, L5, L6, L7) → L8 → L9 → L10 → L11.**

Três trilhas não se tocam em arquivo: UI (`style.css`/`ui.js`/`intro.js`), carga (`main.js`/`sw.js`) e mundo (`js/world/*`). Dentro do mundo, L5, L6 e L7 têm arquivos disjuntos. `scene.js` é tocado por L4 (guarda de frame), L8 e L10: esses três são sequenciais entre si.

Subagentes: autorizados pelo dono só para análise/leitura. Uso sugerido antes de cada lote: um agente de leitura por lote para levantar os testes existentes que fixam o comportamento (ex.: `backdrop.test.mjs` para L6). Edição fica com o agente principal.

## 6. Regra de qualidade (dono, 2026-11-16)

A qualidade gráfica **nunca diminui**, em nenhuma condição. Consequências neste plano:

- N1 e N2 são correções obrigatórias, não opções: sem rebaixamento por FPS e sem tier menor por reduced motion.
- C5 (`backdrop-filter`): só remover um blur se a captura antes/depois for visualmente idêntica. Qualquer diferença visível = não remover.
- A8 (espuma) e A12 (bloom) são ajustes de arte, não de custo; nenhum deles pode ser justificado por desempenho.
- Nenhuma tarefa pode trocar aparência por FPS. Ganho de desempenho só com resultado visual igual.

## 7. O que deliberadamente não entra

- Height fog (A16), SMAA (A12), novo passe de AO (A3), upgrade do three (C7), microinterações (B10): sem necessidade demonstrada.
- Geometria de casas, lotes, landmarks, Copan e densificação: track da Codex.
- Qualquer seletor ou tier de qualidade.

## 8. Execução — rodada 1 (2026-11-16, não commitada)

Feito: N1, N2, N3, C9 (principal); B1, B3, B4, B5, B6, B7, C4 parcial (Sonnet + ajuste do principal na nav em 768–900 px); A6, A7, A8, A9 (Sonnet); A2 dia/noite (Sonnet).
Verificado: `node --test tests/` 299 passam, 1 falha que já existe no HEAD (`urban-infill.test.mjs`, hash de árvores); capturas desktop 9.5 dia, 17 dia, 11 noite antes/depois; barra medida em 900 e 768 px.
Não verificado: mobile, chuva, Chrome real para C1, Lighthouse, FPS, contexto WebGL perdido em browser, dropdown "Mais" com teclado.
Pendente: B2, A14 (mobile); A3, A11, A1 shader, A12, A13, A10, A5, A4, C2, C3, C5, C6, C8, B8 e os OKs da seção 3.

## 9. Execução — rodada 2 (2026-11-16, aguardando aprovação visual, não commitada)

Feito: A3 passo 1 (`sun.shadow.intensity` 0,8; `scene.js`), A11 (horizonte noturno mais claro, `NIGHT.hemi` 0,68 → 0,74, estrelas maiores e em faixa mais baixa; `sky.js`), A12 (bloom 0,10 de dia → 0,20 à noite; `post.js`), A10 (painéis no material `Mass` do Wembley e flood 0,5 → 0,7), A13 (roughness do vidro das torres 0,38 → 0,16 e 0,34 → 0,2), C3 (breakpoints 480/768/1100 + exceções documentadas), C8 (`dvh`, safe areas, `viewport-fit=cover`).
Achados: A4 não é defeito — os pontos brancos são o vapor de escapamento de `vehicle-fx.js` (efeito intencional no frio). Em three r169 `PCFSoftShadowMap` ignora `shadow.radius`; suavizar a borda exigiria trocar para `PCFShadowMap` (17 amostras) — não feito, pede A/B próprio.
Verificado: `node --test tests/` 299 passam, 1 falha preexistente; capturas desktop 9.5 dia/noite, 17 dia, 11 noite. Eye e Big Ben sem estouro à noite.
Não verificado: mobile (C8 é só aditivo), chuva, FPS, Lighthouse.
Pendente: A5 (rua de Wembley, decisão), C2 (fontes: exige baixar arquivos), C5, C6, B2, B8, A14, A1 shader, A17, A18, D1, D2.

## 10. Execução — rodada 3 (2026-11-16, só Haiku, não commitada)

Feito: B8 passo 1 parcial — 6 hex repetidos 3+ vezes viraram variáveis `--c-*` em `css/style.css` (35 substituições, por script). Entradas de 2026-11-16 em `docs/art-direction.md` e `docs/architecture/rendering-budget.md`.
Verificado: revertendo as variáveis o CSS é idêntico ao do commit `8486771` (exceto a linha nova em `:root`); nenhuma variável dentro de `url()`; `node --test tests/` 299 passam, 1 falha preexistente.
Não verificado: captura da UI (a equivalência textual foi a prova usada).
