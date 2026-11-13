# Website visual & art-direction audit — 2026-11-13

**Escopo:** http://localhost:8000/ · desktop 1440×900 · tema dia e noite · paradas 5 (São Paulo, Mira 2017), 9.5 (Londres) e 11 (Glasgow) · UI com painel visível em carregamento e na parada 5.
**Fora de escopo:** mobile, tablet, benchmarks, alterações de código, commits.
**Convenção:** achados marcados **(H)** são hipóteses não confirmadas. Itens que tocam iluminação global, câmera, intro, Copan, casas ou lotes estão sinalizados (ver §2 e §8).

**Evidências** (captures em scratchpad, não versionadas):
- E1 `/private/tmp/claude-503/-Users-samuel-catalano--claude-spares-spare-JmrIO7/123ecf4b-2331-4bce-99cf-de62d58654bf/scratchpad/audit/shots/5-day.png`
- E2 `…/scratchpad/audit/shots/5-night.png`
- E3 `…/scratchpad/audit/shots/9.5-day.png`
- E4 `…/scratchpad/audit/shots/9.5-night.png`
- E5 `…/scratchpad/audit/shots/11-day.png`
- E6 `…/scratchpad/audit/shots/11-night.png`
- E7 `…/scratchpad/audit/ui/ui-load-day.png` (cartão de embarque)
- E8 `…/scratchpad/audit/ui2/ui-stop5-day.png` (painel, parada 5)
- Grade: `…/scratchpad/audit/shots/grid.png`

(Prefixo completo: `/private/tmp/claude-503/-Users-samuel-catalano--claude-spares-spare-JmrIO7/123ecf4b-2331-4bce-99cf-de62d58654bf/scratchpad/`)

---

## 1. Executive Summary

- **Base sólida.** A direção "stylized realism" está coerente: volumes limpos, fachadas saturadas (menta, creme, tijolo), telhas laranja. Cada cidade é reconhecível: torres e MASP em São Paulo, Parlamento, Big Ben, Eye e ônibus vermelho em Londres, arenito, Riverside e University em Glasgow. A noite funciona bem: poços de luz de poste, janelas quentes, contraste com o céu azul.
- **Nenhum P0** (objeto ausente, flutuando, atravessando geometria ou erro de renderização) apareceu nas seis cenas nem nos dois estados de UI.
- **Perdas de qualidade percebida, por frequência:**
  1. Céu e nuvens em faixas com silhuetas em degraus. Ocupam o topo de quase todas as cenas (E1, E3, E5, E6).
  2. Sombras diurnas longas, escuras e de borda dura cobrem ruas e calçadas (E1, E3).
  3. Tâmisa com cinza-ardósia liso, sem brilho do céu (E3, E4).
  4. Painel de ~420 px cobre parte do MASP e da rua na parada 5 (E8).
  5. A primeira impressão é um cartão de embarque sobre a cidade desfocada (E7).
  6. Piso plano em grandes áreas e árvores pequenas e esparsas no nível da rua (E3, E5).
- **Limite de decisão:** o que mais melhora a imagem (luz global, câmera, intro) está fora de autorização direta. Ver §2 e §8.

## 2. Top 10 Visual Improvements

| # | Prio | Onde | Problema observado | Melhoria proposta | Impacto | Esforço | Risco / autorização |
|---|---|---|---|---|---|---|---|
| 1 | P1 | Céu, todas as cenas | Nuvens em faixas com silhuetas em degraus. A doc diz "feathered" (`js/world/sky.js:89`). **(H)** silhuetas formadas por blobs sobrepostos com corte duro | Suavizar a borda (feather) e variar altura e largura dos blobs. Testar 1–2 variantes | Alto | Baixo | Céu/clima já foram aprovados em 2026-10-26 e 11-12. Nova mudança precisa de OK |
| 2 | P1 | Composição com painel | Painel de ~420 px (x 24–443) cobre a esquerda do quadro. MASP e rua ficam parcialmente atrás dele na parada 5 (E8) | Deslocar o ponto de fuga (`setViewOffset`) para centralizar o alvo na área livre; ou reduzir o painel para ~360 px | Alto | Baixo | Câmera: "desktop framing" foi autorizado em 11-12, mas deslocamento é extensão. Pedir OK |
| 3 | P1 | Luz diurna, ruas | Sombras longas e escuras de borda dura (E1, E3). `scene.js:96-100`: hemi 1.0 + direcional 2.4, mapa 2048 PCFSoft | Clarear sombra com preenchimento (hemi/fill) e tingir a sombra de azul-violeta suave. Manter sol e mapa | Alto | Baixo | Iluminação global é tarefa separada (art-direction). Exige autorização explícita |
| 4 | P1 | Cartão de embarque | Cartão de ~560 px no centro (x 433–992) cobre a cidade. Fundo desfocado; prévia de ~490×220 (E7) | Prévia maior ou scrim menos opaco / blur menor, sem cortar a cena | Alto (1ª impressão) | Baixo–médio | Intro/boarding excluído de redesign em 11-12. Pedir OK |
| 5 | P2 | Tâmisa | Água cinza-ardósia, sem brilho do céu (E3, E4). Reflexo de cidade inteira é opt-in e está desligado por orçamento (`rendering-budget.md:57`) | Fresnel + tom do céu + espuma nas margens, sobre a superfície atual, sem reflexo planar | Médio | Baixo | Ajuste de material de água; confirmar faixa aprovada |
| 6 | P2 | Ruas, árvores | Copas pequenas e espaçadas no nível da rua (E3, E1) | Aumentar copa e densidade dentro das pegadas de plantio existentes | Médio | Baixo | Vegetação aprovada em 10-31 e 11-03. Densidade extra = plantio dentro das pegadas. Confirmar |
| 7 | P2 | Glasgow noite, Riverside | Fachada de vidro do museu brilha amarelo-limão saturado (E6), destoando da paleta | Trocar o tint/emissivo noturno do vidro para azul-esverdeado frio, com reflexo do céu | Médio | Baixo | Material noturno; sem novo passe |
| 8 | P2 | Pisos planos | Glasgow, primeiro plano esquerdo (E5): grande área cinza lisa, ~25% do quadro inferior. Londres: praça de piso liso | Juntas, variação de tom por módulo, bancos e floreiras (vocabulário do streetscape 11-10) | Médio | Baixo | Streetscape aprovado em 11-10 (juntas e tons regionais). Expandir a Glasgow pede OK |
| 9 | P2 | Vidro de torres e prédios | Reflexo só analítico do céu (E1, E3). Landmarks já usam PMREM (`js/world/landmark-env.js:28`) | Estender o ambiente PMREM aos vidros de torres, com intensidade baixa | Médio–alto | Alto | Conflita com a restrição do North Star ("no cubemaps"). Decisão do dono |
| 10 | P2 | Glasgow dia | Céu nublado + neblina deixa tudo cinza-claro. Contraste baixo (E5). Clima de chuva não capturado | Mais contraste em janelas e telhados; tom quente no horizonte; capturar `?weather=rain` | Médio | Baixo | Overcast de Glasgow é intencional (doc). Ajuste de contraste pede OK |

## 3. Art Direction Review

- **Identidade:** coesa. Volumes limpos, paleta saturada e legível, mesma linguagem de telhado e janela entre bairros. Não parece colagem de assets.
- **Diferenciação entre cidades:** boa. São Paulo é vertical e colorida (torres, MASP vermelho). Londres é horizontal, com rio diagonal, vermelho de ônibus e cabines. Glasgow é cinza-creme, com arenito e céu nublado. O clima reforça a identidade de cada uma.
- **Composição:** a diagonal do rio (Londres) e a fila de fachadas (Glasgow) funcionam. Em São Paulo (E1), o Copan domina o centro. **Fora de escopo:** Copan é do track da Codex.
- **Repetição:** fileiras de sobrados e terraços com a mesma forma (Londres, E3; Glasgow, E5). Há variação de cor, mas pouca variação de forma. **Track da Codex** (densidade e casas).
- **O que parece protótipo:**
  - piso liso em grandes áreas;
  - céu em blocos;
  - árvores pequenas;
  - um lote cinza liso à direita do Copan (E1). **(H)** lote ou praça não finalizada. Fora de escopo (Codex).
- **Atmosfera:** a neblina de Londres desbota o fundo com eficácia (E3). A noite é o melhor momento da direção: janelas quentes, poços de luz, contraste de temperatura.

## 4. Graphics & Three.js Review

**Verificado no código:**
- `WebGLRenderer` com `antialias: true`, ACES Filmic, saída sRGB (`js/world/scene.js:85-86`).
- Sombra PCFSoft, mapa 2048, frustum ±80 m, texel ~7,8 cm (`scene.js:89,100`). Sombra desligada só em mobile.
- Duas luzes: hemisfério (1.0) e direcional (2.4) (`scene.js:96-97`). Sem fill separado.
- Névoa 240–900, cor `0xa8d0f2` (`scene.js:92`).
- Pixel ratio no desktop limitado a 1.5 (`scene.js:320`).
- Ambiente PMREM só nos landmarks (`js/world/landmark-env.js`). Demais materiais PBR sem mapa de ambiente.
- Céu e nuvens: shader com fbm e `smoothstep` (`js/world/sky.js` ~89–110).

**Observações visuais:**
- **Sombras:** a qualidade PCF está correta, mas as bordas ficam duras em distância média. **(H)** raio do PCF e bias não calibrados para a escala de rua.
- **Cor e tone:** dia saturado e legível. Sem estouro perceptível no céu.
- **Serrilhado:** não medido com zoom. Nas capturas a 1440×900 (DPR 1) não apareceram escadas nas fachadas.
- **Reflexo de água:** planar desligado por padrão. O rio fica plano. Aceitar como custo de orçamento, mas há ganho barato com Fresnel (item 5).
- **Vidro:** reflexo analítico do céu. Cinza-azulado de dia, aceitável.
- **Noite:** janelas e luzes funcionam. Vidro do museu de Glasgow (E6) é o único destaque errado.
- **Custo de GPU:** as recomendações são materiais, shaders e ajustes de luz. Nenhuma propõe novo passe, nova luz ou seletor de qualidade (regra do dono).
- **Desempenho:** não medido nesta passada. Os números de `rendering-budget.md` não foram recheckados.

## 5. UI/UX Review (desktop)

**Cartão de embarque (E7):**
- Hierarquia clara: "Next stop" em destaque, chip de parada, linha do tempo 2003–2024, instruções de teclado e "Board" como CTA.
- Metáfora de bilhete bem resolvida e tipografia consistente com a marca.
- **Problema principal:** cobre a cidade. Ela aparece só em miniatura desfocada, como fundo. Ver item 4.
- Progresso "Getting ready to depart · 77%" é informativo.

**Painel (E8):**
- Hierarquia boa: título, cartão da parada (ano, marca, papel, datas), linha do tempo com badges de marca, contador "1 of 12", próxima parada.
- Contraste medido em 11-11 passa WCAG AA. Não re-medido.
- **Problema:** largura de ~420 px (≈29% do quadro) e bloqueio de landmarks à esquerda. Ver item 2.
- O cartão da parada tem um único filete vermelho no DOM. Não confirmei um segundo filete, descartado.

**Barra superior:**
- Marca, chip de parada, pílula de navegação, cluster de 7 botões de ícone.
- No DOM, os 7 botões têm `aria-label`.
- Ícones sem rótulo visível. Olho e câmera são ambíguos. **Correção:** cinco dos sete botões já tinham `title` (`js/ui.js:232`). Faltavam tema e idioma; corrigido na Fase 1.
- O chip "83 2017 SÃO PAULO" tem estilo de display LED, legível e distinto.

**Não exercitados:** hover, focus, estados de loading além do cartão, transições entre telas, mobile (excluído).

## 6. Scene-by-Scene Findings

| Cena | Captura | Positivo | Negativo |
|---|---|---|---|
| São Paulo, dia (parada 5) | E1 | Torres de vidro, MASP vermelho legível, pedestres e carros densos | Céu em blocos; sombras duras; lote cinza à direita; Copan domina o centro (fora de escopo) |
| São Paulo, noite | E2 | Janelas quentes do Copan; poços de luz; contraste bom | MASP chapado em vermelho sem sombreamento; céu sem estrelas legíveis |
| Londres, dia (9.5) | E3 | Parlamento, Big Ben, Eye, ônibus vermelho, cabines; rio diagonal; neblina de fundo | Sombras longas e duras; Tâmisa liso; árvores pequenas; terraços repetidos |
| Londres, noite | E4 | Eye com pontos de luz; Parlamento iluminado; ônibus com brilho | Rio escuro sem brilho; fachadas de fundo quase pretas |
| Glasgow, dia (11) | E5 | Riverside em zigue-zague, University, estátua em George Square, ônibus roxo, arenito | Céu cinza chapado; piso liso no primeiro plano; contraste baixo |
| Glasgow, noite | E6 | Janelas quentes da University e da City Chambers | Vidro do Riverside em amarelo-limão, fora da paleta |
| Carregamento | E7 | Metáfora de bilhete coerente; hierarquia clara | Cobre a cidade; prévia pequena |
| Painel, parada 5 | E8 | Hierarquia clara; cartão bem resolvido | Cobre MASP e rua; ~420 px |

**Não capturado:** transições entre cidades, veículo em movimento, Heathrow, Wembley, close de Tower Bridge, estado de chuva (clima sorteado por carga).

## 7. Quick Wins

Baixo esforço, alto impacto. Itens 1–3 tocam materiais e não exigem decisão nova. Os demais pedem OK.

1. **Vidro do museu de Glasgow à noite** (item 7). Material noturno.
2. **Fresnel e tom do céu no Tâmisa** (item 5). Material de água.
3. **Tooltips nos botões de tema e idioma.** Feito na Fase 1; os outros cinco já tinham. Ver §5.
4. **Largura do painel 420 → ~360 px** (item 2, parte CSS). Pedir OK.
5. **Suavizar silhueta das nuvens** (item 1). Pedir OK.

**Status da Fase 1 (2026-11-13):**
- **Tooltips (item 3):** feito. Tema e idioma agora têm `title` (`js/ui.js`). Testado no DOM.
- **Vidro noturno do museu (item 7):** feito. A causa era um wash aditivo amarelo-limão de autoria própria, tom `[.95, 1, .18]`, em `js/world/landmark-geometry.js` (`createRiverside`, comentário "yellow-green wash"). Trocado por `[.66, .86, 1]` (azul-branco frio) nas duas peças que o usavam. O metal do zigue-zague também foi resfriado. Não era o ambiente de landmarks (`landmark-env.js`), que está azul-frio. Só o museu muda; os demais landmarks não foram recapturados. Vidro noturno pode ficar um pouco pálido; afinar depois se preciso.
- **Rio (item 5):** testado `REFLECT_FLOOR` 0.16 → 0.28. Ficou marrom-amarelado por refletir o horizonte quente do golden hour. Revertido para 0.16. Melhoria real pede cor própria para a água, não só mais reflexo.

## 8. Strategic Improvements

- **S1 — Reflexo de ambiente para vidro (item 9).** Estender o PMREM dos landmarks às torres. Conflita com "no cubemaps" do North Star. Precisa de decisão do dono.
- **S2 — Iluminação global como tarefa própria (item 3).** Sombra, preenchimento e tom. Exige A/B desktop e autorização explícita.
- **S3 — Enquadramento cinematográfico.** `setViewOffset`, transições de câmera e a primeira cena do intro. Afeta câmera e intro, ambos sob controle do dono.
- **S4 — Detalhe de piso e vegetação.** Juntas, variação, planta em instancing. Expande o streetscape aprovado.
- **S5 — Diversidade de fachadas.** Track da Codex. Não tocar agora.

## 9. Recommended Execution Roadmap

**Fase 1 — correções e quick wins**
- Vidro noturno de Glasgow (Q1).
- Fresnel do Tâmisa (Q2).
- Tooltips (Q3).
- Nuvens e painel, após OK (Q4, Q5).

**Fase 2 — direção de arte e qualidade gráfica**
- Clarear sombras, após autorização de luz (item 3).
- Copas e densidade de árvores (item 6).
- Pisos planos (item 8).
- Prévia e scrim do embarque, após OK (item 4).

**Fase 3 — avançado e cinematográfico**
- Reflexo de ambiente para vidro, após decisão (item 9).
- Enquadramento com `setViewOffset` (S3).
- Estado de chuva e contraste de Glasgow (item 10).

**Dependências e paralelismo:**
- Materiais (vidro, água) são independentes de câmera e de luz. Podem ir em paralelo.
- Sombra e céu tocam a mesma iluminação. Fazer em sequência.
- `scene.js` tem edição não commitada (`compileAsync`) e `sw.js` tem bump de cache (`catalano-v4`). Coordenar antes de tocar `scene.js`.

## 10. Verification & Limitations

**Inspecionado:**
- 6 cenas (3 cidades × dia/noite) nas paradas fixas 5, 9.5 e 11.
- UI em carregamento e na parada 5, após "Board".
- DOM do painel (bordas e `aria-label`).
- Código: `scene.js` (luz, sombra, névoa, pixel ratio), `landmark-env.js` (PMREM), `sky.js` (nuvens).
- Docs: `art-direction.md`, `north-star-full-scene-upgrade.md`, `rendering-budget.md` (títulos), `full-scene-visual-atlas.md`.
- Método: `tools/capture.py` em cópia de scratchpad com override de viewport 1440×900. O arquivo do repo não foi alterado.

**Não verificado:**
- Mobile (excluído).
- Console errors (não coletados nesta passada).
- FPS e desempenho (não medidos).
- Movimento e transições (sem vídeo; só quadros estáticos).
- Hover, focus e tooltips visíveis.
- Heathrow, Wembley, Tower Bridge em close.
- Estado de chuva (clima sorteado por carga; nenhuma captura de `?weather=rain`).
- Serrilhado com zoom.

**Estado do working tree durante as capturas:** `js/world/scene.js` (+1 linha `compileAsync`) e `sw.js` (`catalano-v4`) não commitados. Não A/B; não afetam o visual medido.

**Hipóteses (H):** causa das nuvens em degraus (item 1); lote cinza (§3); tooltips (§5); cor do vidro noturno (item 7); calibração do PCF (§4).

**Limites de decisão:**
- Itens que tocam iluminação global, câmera, intro, Copan, casas ou lotes precisam de autorização ou pertencem ao track da Codex.
- Nenhuma proposta de seletor ou degradação de qualidade gráfica.
