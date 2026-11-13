# Sistema de som (plano)

Status: F1 a F8 implementadas em 2026-11-13 (ver *Registro de execução* no fim). Sem commit. Branch de trabalho: `feat/site-gamefication`. Não fazer merge na `main`.

## Estado atual

- `js/sound.js`: sons sintetizados (sino de Londres, chiado de porta), sem arquivos de áudio. Só tocam após clique ou toque. `releaseSounds()` fecha o contexto quando a intro fecha. Usado por `js/intro.js`. Pré-carregado em `index.html`.
- `docs/PRD.md:58` lista "sound" em *Out of scope*. Implementar exige o dono remover isso antes.
- O site não tem nenhum arquivo de áudio.

## Emissores e estado já existente

| Domínio | Arquivos | Estado que já existe |
|---|---|---|
| Clima (chuva, vento, tempestade, relâmpago) | `js/world/weather.js`, `rain.js` | `rain`, `wind`, `storm` por região; `createLightning()` |
| Humor por parada | `js/world/mood.js` | `createMood(stops)` |
| Ônibus e carros do herói | `vehicles.js`, `buses.js`, `vehicle-fx.js`, `wheel-roll.js` | progresso vindo de `scroll.js` |
| Tráfego no underpass | `underpass-traffic.js` | veículos com pose |
| Barcos no Tâmisa | `ambient.js` (`createBoat`) | — |
| Avião A330 | `plane-path.js` | função pura de `d` (distância) |
| Pedestres e NPCs | `crowd.js`, `people.js`, `npc3d.js`, `npc-motion-state.js` | plano de multidão |
| Big Ben | `bigben-asset.js` | — |
| Cabines e quiosques | `phone.js`, `kiosk-mesh.js` | sem som |
| UI | `ui.js` (cliques), `postcard.js`, `intro.js` | — |
| Dia e noite | `sky.js` | — |
| Scroll e auto-ride | `scroll.js`, `autoride.js`, `main.js` | progresso |

## Decisões do dono (aprovadas em 2026-11-13: valores padrão)

1. **PRD:** "sound" removido de *Out of scope* em `docs/PRD.md:58` (feito em 2026-11-13). `docs/TRD.md` ainda a atualizar na F8.
2. **Fonte dos sons:** síntese procedural por padrão (sem licença, sem KB). Amostras CC0 só onde a síntese ficar ruim (buzina, pássaros, multidão). Cada amostra vai para `ASSET_SOURCES.md` com licença.
3. **Padrão:** mudo. Um botão "Som" liga o áudio. A escolha fica em `localStorage` (preferência local, não dado de servidor).
4. **Textos:** rótulo do botão e legendas em `js/content.js`, em en e pt.

## Arquitetura proposta

- `js/audio/engine.js`: um `AudioContext`. Grafo: buses (`ambience`, `weather`, `traffic`, `vehicles`, `people`, `landmarks`, `ui`) → compressor → master → destination. Suspende com `document.hidden`. Substitui o contexto de `sound.js`; `sound.js` vira fachada com `ding()` e `hiss()` iguais, para a intro não mudar.
- `js/audio/state.js`: função pura `state(data)` → ganhos, pans e taxas. Sem three.js, testável em `node --test` (padrão do repo).
- `js/audio/voices/*.js`: uma família por arquivo (chuva, vento, motor, buzina, sino, multidão, avião, UI).
- Atualização de ~10 Hz, fora do loop de `requestAnimationFrame`. Sem alocar nós por frame. Limite de vozes simultâneas por família.
- Degradação: sem WebGL, só a ambiência do painel. Falha de áudio vira silêncio, sem erro no console (`try/catch`, como em `sound.js`).

## Fases

- **F0. Decisões:** dono responde os itens acima.
- **F1. Engine:** contexto, buses, toggle, desbloqueio após gesto, migração de `sound.js`. Intro sem mudança audível.
- **F2. Clima:** chuva (ruído granular, intensidade de `rain`), vento, trovão com atraso pela distância do relâmpago.
- **F3. Cenário por parada:** cama de cidade por região (Londres, São Paulo, Glasgow), com crossfade para a parada mais próxima; dia e noite via `mood`.
- **F4. Veículos:** motor do ônibus pela velocidade do scroll; carros que passam (pan e Doppler simples); abafado no underpass; porta pneumática nas paradas (`hiss`); barco.
- **F5. Avião e multidão:** avião com ganho e pan sobre `plane-path`; murmúrio da multidão pela densidade perto da câmera; passos opcionais com teto de vozes.
- **F6. Landmarks:** sino do Big Ben (parciais, como `ding()`), sinos de Glasgow se houver ponto no conteúdo, atenuação por distância.
- **F7. UI e mix:** cliques de navegação, postcard, níveis (pico abaixo de −1 dBFS, sem clipping).
- **F8. Verificação e docs:** ver abaixo; atualizar PRD, TRD e `ASSET_SOURCES.md`.

## Verificação

- `node --test tests/`: `state.js`, limites de voz, curvas de ganho.
- Browser: desbloqueio após gesto, toggle, sem erro de console, WebGL desligado, reduced motion, EN e PT, 375 px.
- `OfflineAudioContext`: renderiza uma cena de referência; checa que não está em silêncio e que não há clipping.
- Desempenho: A/B de frame time com e sem áudio. Medir com `preview_start`, uma aba por corrida (o painel oculto pausa o rAF).
- Lighthouse a11y ≥ 95 quando aplicável.

## Economia de tokens

- Localizar com grep ou Serena (símbolos); não ler arquivo inteiro.
- Haiku para inventário, renomeações e tabelas de licença. Sonnet para implementar. Opus só para o contrato do grafo de áudio, uma vez, com `OPUS REVIEW RECOMMENDED` no plano.
- Subagentes desligados por padrão. Antes de lançar qualquer um, checar `get_usage` (trava semanal na memória).
- Uma fase por sessão curta. A próxima sessão lê este arquivo, não o histórico.
- Testes `node` a cada fase; browser só ao fim de cada marco.
- Saídas grandes resumidas (rtk, headroom).

## Regras do repo

- Sem build e sem npm. Sem dependência nova sem perguntar. URLs relativas. Copy em `js/content.js`.
- Módulos pequenos. Não alterar mapa, rotas, landmarks nem lógica existente fora do escopo.
- Não propor seletor de qualidade de áudio nem versões degradadas.
- Commit só quando pedido. Sem merge na `main`.
- Sem dados pessoais em requisições externas.

## Registro de execução (2026-11-13)

Feito, numa sessão (todas as fases; o código foi escrito de uma vez e verificado nos marcos):

- **F1** `js/audio/engine.js` (contexto único, buses, filtro `outside`, mix, compressor, master, suspende com aba oculta e com som desligado), `js/audio/state.js` (puro), `js/sound.js` como fachada. `ding`/`hiss` da intro saem por `direct`, fora do toggle e do compressor (o compressor aplica ganho de compensação; assim a intro não muda). Botão `[data-sound]` em `index.html`, rótulo em `content.js` (en/pt), preferência em `localStorage.sound`.
- **F2** chuva (chiado + grãos com teto de 8 vozes), vento, trovão no flanco de subida de `world.flash` (getter novo em `scene.js`, única mudança na cena), atraso = distância sorteada (0,4 a 3,4 km) / 343 m/s.
- **F3** três camas de cidade com crossfade pelos pesos `rs/rl/rg` do `createMood`; noite mais baixa e mais escura; pássaros (SP, dia), gaivotas (Glasgow, dia), grilos (SP, noite), buzinas distantes (SP).
- **F4** motor e pneus pela velocidade do scroll; carros passando (pan + queda de tom); filtro `outside` nos túneis; porta ao parar numa parada; buzina de barco.
- **F5** avião sobre `plane-path` (ganho, pan, corte, Doppler); murmúrio e passos (teto de 4).
- **F6** Big Ben (Mi, 3 badaladas) e torre da Universidade de Glasgow (2 badaladas), uma vez por aproximação, com atenuação contínua pela distância.
- **F7** clique de UI em botões e links, obturador no postcard, `MASTER = 0.8`.
- **F8** `docs/TRD.md`, `ASSET_SOURCES.md` (nenhuma amostra usada), `tests/audio-state.test.mjs`, `tests/audio.browser.py`.

Desvios do plano (deliberados):

- `voices/` tem dois arquivos (`beds.js` contínuas, `shots.js` disparos) em vez de um por família: as famílias compartilham os mesmos três blocos (ruído, filtro, envelope).
- Sem revisão Opus do grafo: o grafo é linear e pequeno.
- Carros que passam, multidão e túneis são dirigidos pela posição na rota, não pelos objetos da cena (comentários `ponytail:` em `js/audio/index.js` dizem o teto e o caminho de upgrade). Buzinas, barco e pássaros são sorteados por taxa.

Verificado: `node --test tests/` (254/254); `tests/audio.browser.py` (render offline sem silêncio e sem clipping, toggle com clique real, percurso inteiro com todas as famílias, sem erro de console); página sem WebGL + reduced motion + PT + preferência lembrada.

Não verificado: escuta humana (timbre e equilíbrio só foram medidos, não ouvidos), 375 px (dono pediu sem mobile), A/B de frame time, Lighthouse, Safari/Firefox.

### Ajuste da mistura (2026-11-13, depois do feedback do dono)

Medido offline (OfflineAudioContext pelo grafo real, 8 s, taxas do driver) antes de mexer. Causas confirmadas: (1) chuva moderada (rain 0,5) a -16,8 dBFS RMS contra a cama de SP a -31,4: 14 dB acima; o compressor derrubava 2,2 dB (5,6 dB em tempestade), efeito secundário; (2) tempo seco: motor do ônibus (-24,7 RMS) acima da cama (-31,4); pássaros com pico de -31 dBFS, carros -26, passos -42, buzina -28: abaixo da cama.
Depois: chuva `0,06 * rain^0,8` (grãos pela metade, vento da chuva 0,14), camas x1,8, motor pela metade, pássaros/gaivota/buzina/barco/passos/carros de +6 a +16 dB, `MASTER` 1,2. Chuva moderada fica 6 a 7 dB sob a cama; compressor sem derrubar (0 a -0,1 dB); pico da cena mais alta -2,6 dBFS.
Teste de potência contínua passou de 0,6 para 0,4 (pior canto atual 0,35); o limite real é o pico medido no teste de browser, que agora também checa chuva abaixo da cama e derrubada do compressor. Cache do service worker `catalano-v2`. Não ouvido por humano: os níveis são medidos, o equilíbrio fino é decisão do dono.

- 2026-11-13: plane timed from the scene's own route position (`world.routeS`, fine knots) instead of the coarse stop marks, gain 0,26 and a brighter low-pass (3800 to 900 Hz); Board opens only after the still tour and a second settle; chuva forte (cama + vento) cortada ~10 dB (-31,9 dBFS RMS, 9 dB abaixo da cidade); gaivotas e buzinas mantidas (decisão do dono).
