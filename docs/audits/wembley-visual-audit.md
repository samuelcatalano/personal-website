# Auditoria visual: Wembley Stadium (parada Contact, desktop)

Data: 2026-11-23. Escopo: identificar e documentar. Nenhum código, GLB, CSS ou asset foi alterado.
Cena 3D congelada visualmente (CLAUDE.md): toda correção abaixo marca se é **FIDELIDADE** (inconsistência verificada) ou **ESTILO** (sugestão), e se exige **AUTORIZAÇÃO DO DONO**.

## Legenda de evidência

- [V] verificado visualmente em captura. [C] verificado só no código. [H] hipótese, não verificada em runtime.
- Capturas (todas em `/private/tmp/claude-503/-Users-samuel-catalano-Projects-samuelcatalano-personal-website/a75476bd-917b-4af2-8dd5-9b6fe0cb0a0c/scratchpad/wembley/`):
  - `11-day.png` (dia), `11-night.png` (noite), `rain/11-day.png` (chuva). Todas em Wembley, desktop, parada Contact.
  - `nohalo/11-day.png`: **saiu em Glasgow**, portanto inútil. `nobeam/`, `rain-after/`, `9.5-day.png` não foram reabertas (não usadas como evidência).
  - Referência do estádio real usada: `assets/models/source/ref/wembley.png` (imagem do repositório; sem acesso externo a fotos reais nesta etapa).

## Limitações

- Não gerei capturas novas: reutilizei as três existentes. Não rodei testes nem benchmarks.
- A causa dos pontos flutuantes é **hipótese** (nenhum teste isolando `vehicle-fx` foi feito; as capturas `nohalo`/`nobeam` saíram em Glasgow).
- Sem medições de FPS/draw calls novas. Performance só pelo código e por `docs/architecture/rendering-budget.md` e `tools/landmarks/wembley/README.md`.
- Mobile, WebGL desligado, reduced-motion, EN/PT e mudança de câmera ao longo do scroll não foram verificados.
- Câmera é fixa na parada; não avaliei a transição de aproximação.

## A. Resumo executivo

O Wembley é reconhecível em dois segundos, quase só pelo arco: tubular, branco, inclinado, com cabos, é o sinal mais forte da cena [V]. O resto do estádio é genérico: uma bacia cinza opaca com painéis, dois telões verdes e pilares azul-acinzentados. Em relação à referência do repositório, falta o vidro azul-esverdeado da fachada, o anel treliçado do teto e o podium em degraus [V].

O maior problema de fidelidade é a **inconsistência dia/noite**: de dia a fachada é cinza chumbo opaca; à noite vira azul-claro quase branco e os telões trocam de verde para ciano [V]. Parecem materiais diferentes.

O ambiente comunica Londres (cabines vermelhas, ônibus, prédios de tijolo/estuque, lampiões), mas o estádio flutua num plano largo de pavimento cinza, com pouca vegetação e sem a escala de multidão característica [V]. Os pontos brancos sobre a rua à esquerda do ônibus são, com boa probabilidade, partículas de vapor de escapamento do ônibus herói (`vehicle-fx.js`), não halos nem feixes [H].

## B. Scorecard (0 a 10)

| Critério | Nota | Justificativa |
|---|---|---|
| Fidelidade | 6,0 | Arco, inclinação, cabos e telões corretos [V]. Falta vidro da fachada, anel do teto, podium em degraus; telões com "arco" no lugar do logotipo [V vs ref]. |
| Art direction | 6,5 | Estilo low/mid-poly coerente com a cidade [V]. Dia e noite divergem em tom da fachada [V]. |
| Materiais | 5,5 | Bacia lisa, faceta "papelão" nos painéis cinza, pilares chapados [V]. Baias de 3 m com variação de 5% quase invisíveis em dia [C: `authored-landmarks.js:65-79`, V]. |
| Iluminação | 6,5 | Sombras longas e coerentes de dia [V]. Noite boa no arco e cabines [V], mas a fachada acende em azul pálido sem fonte justificável [V]. |
| Ambiente | 7,0 | Cabines, ônibus, lampiões, bancos, árvores, NPCs; denso e legível [V]. Praça frontal vazia e ampla; vegetação rala [V]. |
| UI | n/d | Não há UI sobreposta nas capturas (a captura não mostra o painel HTML); não avalio concorrência com o 3D. |
| UX | 6,0 | O arco é destaque, mas é cortado no topo pelo quadro em 1440x900 [V]. Nenhuma microinteração no landmark encontrada [C: não busquei hotspots]. |
| Storytelling | 7,0 | NPC "Beatles" acenando e ônibus 19 contam Londres [V]. O estádio em si não tem gesto narrativo (evento, bandeiras). |
| Performance | 7,0 [C] | LOD0 7.744 / LOD1 3.948 tris, 3 draws (README do asset). Custo do shader de landmark por loop de 8 bounds por fragmento [C: `landmark-materials.js:29`]. Sem medição nova. |
| Qualidade geral | 6,5 | Cidade sólida; o landmark principal é o elo mais fraco depois do arco. |

## C. Issues

Formato: ID, categoria, prioridade, evidência, localização, problema, impacto, causa, solução, complexidade, impacto em performance, aceitação.

**W-01 | Fidelidade/Materiais | P1 | FIDELIDADE | AUTORIZAÇÃO**
- Evidência: `11-day.png` vs `11-night.png` vs `assets/models/source/ref/wembley.png`.
- Local: `js/world/authored-landmarks.js:53-79` (Glass, Mass); `js/world/landmark-materials.js:11,20`; geometria em `tools/landmarks/wembley/build_wembley.py`.
- Problema: de dia a fachada lê como parede opaca cinza; a referência é vidro azul-esverdeado contínuo. À noite a mesma faixa fica azul-clara, quase branca, e os telões passam de verde a ciano.
- Impacto: quebra a leitura "mesmo edifício"; o estádio perde identidade.
- Causa [H, parcialmente C]: de dia o emissivo é zero e o vidro recuado fica em sombra; à noite `glowK 0.28` + `finish[2]=1` para `P.glass` (reflexo de céu, `landmark-materials.js:38`) clareia tudo.
- Solução: reduzir o brilho noturno da faixa e dar ao vidro de dia um tom azul-esverdeado com reflexo de céu mais fraco; alinhar o matiz dos telões entre dia e noite.
- Complexidade: média. Perf: nula (parâmetros de shader). Aceitação: lado a lado dia/noite, mesma família de matiz na faixa de vidro (inspeção visual com a mesma câmera) e telões com o mesmo matiz.

**W-02 | Bug visual | P1 | FIDELIDADE | sem autorização se for correção de efeito**
- Evidência: pontos brancos/cinza sobre a rua, esquerda do ônibus, em `11-day.png` (~x 210-520, y 820), `11-night.png` (~x 165-860, y 810-830, mais fracos) e `rain/11-day.png` (~x 330-950, y 820-855).
- Local: `js/world/vehicle-fx.js:25,39-41` (Points), `js/world/scene.js:691`.
- Causa [H]: vapor de escapamento. Em `scene.js:691`, `cold = min(1, (1-rs)*0.8 + night*0.4)`; com tempo limpo (`rs` ~0) cold ≈ 0,8, então o vapor é emitido quase sempre em Londres. As partículas nascem no canto traseiro (y 0,34), com cor cinza-clara, tamanho 0,28 e alfa 0,5, e ficam no mundo atrás do ônibus, que anda para a direita. Combina com a posição observada.
- Descartados por código [C]: halos de lampiões (`lamp-mesh.js:63`) usam `uNight` e ficam invisíveis de dia; feixes e luzes de freio (`beams.js:55,67`) multiplicam por `night`. Em chuva, as partículas de respingo (`vehicle-fx.js:44-47`) somam-se ao efeito.
- Impacto: lê como sujeira/artefato, não como vapor, porque os discos são pequenos, nítidos, espaçados e sem rastro contínuo.
- Solução (decisão do dono): (a) manter o vapor, mas só abaixo de uma temperatura/horário (ex.: noite e tempo frio, não dia limpo); ou (b) fazê-lo mais suave, maior e mais transparente; ou (c) desligar em dia limpo.
- Para confirmar: capturar `QUERY` com vapor desligado (ex.: `update` com `cold:0`) e comparar. Não feito.
- Complexidade: baixa. Perf: nula ou levemente positiva. Aceitação: nenhum ponto cinza isolado visível atrás do ônibus em dia limpo, 3 capturas.

**W-03 | Ambiente/Reflexos | P2 | ESTILO (já mexido pelo dono)**
- Evidência: `rain/11-day.png`, manchas brancas no asfalto à direita do ônibus (~x 1520, y 770; 1400-1620, y 930-960).
- Local: `js/world/wet-surfaces.js:110-115`. O dono já reduziu `reflectionAmount` (.08→.05 e .30→.24).
- Causa [H]: reflexo planar `uWetReflection` (linha 111) e céu `wetSky` acima de 0,5 no `mix` de poça; o clamp 0,65 deixa o branco do céu dominar o asfalto em poças. A forma segue o céu/prédio refletido.
- Impacto: manchas lidas como "neve" ou "papel" de dia.
- Solução: baixar o clamp de 0,65 para ~0,45 ou escurecer `uWetHorizon` de dia. Verificar após a redução já feita antes de mexer mais.
- Complexidade: baixa. Perf: nula. Aceitação: poças refletem forma, não branco chapado; capturas chuva dia/noite.

**W-04 | Enquadramento | P2 | ESTILO**
- Evidência: as três capturas: o arco sai do quadro no topo.
- Local: câmera da parada Contact (`js/world/layout.js`, não analisado em detalhe).
- Problema: o ícone mais forte é cortado; o estádio fica no terço médio, com muita rua em primeiro plano.
- Solução: afastar/levantar a câmera ou deslocar o alvo; avaliar com o painel HTML aberto. AUTORIZAÇÃO (rota/câmera preservadas por regra).
- Complexidade: média. Perf: nula. Aceitação: arco inteiro visível em 1440x900 com painel.

**W-05 | Fidelidade | P2 | AUTORIZAÇÃO**
- Evidência: `11-day.png` bacia vs `ref/wembley.png`.
- Problema: sem anel treliçado de teto visível, sem podium em degraus, sem logotipo "WEMBLEY"; os telões verdes mostram o símbolo de arco.
- Local: `tools/landmarks/wembley/build_wembley.py`. Direção de arte registrada: teto elíptico aberto e vidro recuado (`docs/art-direction.md:139`); o anel treliçado não está lá.
- Solução: pequeno anel/treliça no beiral do teto e degraus no podium; texto "WEMBLEY" no telão. Atenção a marca registrada: confirmar com o dono antes de gravar texto.
- Complexidade: alta (nova geometria + reexportar GLB). Perf: +alguns centenas de tris, mesmos 3 draws. Aceitação: anel visível a 1440x900, tris dentro do orçamento do asset.

**W-06 | Materiais | P3 | ESTILO**
- Evidência: `11-day.png`: painéis cinza com faces planas e juntas em losango.
- Local: `authored-landmarks.js:65-79`.
- Problema: variação de 5% e junta de 4% são quase imperceptíveis à distância; a bacia parece papelão.
- Solução: aumentar levemente a variação por baia e adicionar leve gradiente vertical de sujeira/AO. Complexidade baixa. Perf: nula. Aceitação: baias distinguíveis a 1440x900 sem parecer xadrez.

**W-07 | Ambiente | P3 | ESTILO | AUTORIZAÇÃO (nova geometria)**
- Evidência: `11-day.png`: praça frontal.
- Problema: grande plano de pavimento cinza entre o estádio e a rua, bancos e cercas pretas repetitivos, árvores pequenas e esparsas. Falta sinalização de dia de jogo (bandeiras, bilheteria, multidão concentrada na entrada).
- Local: `js/world/parks.js:33` (`wembley: trees 2, beds 1`), `js/world/crowd.js:55-60`.
- Solução: mais árvores/vasos, faixas e bandeiras; multidão maior na entrada. Perf: baixo (instâncias). Aceitação: praça sem região vazia maior que X (definir com o dono).

**W-08 | Iluminação noite | P3 | ESTILO**
- Evidência: `11-night.png`: facade azul-clara, arco branco, praça escura.
- Problema: o brilho do estádio não ilumina a praça nem as pessoas; falta spill de luz no chão.
- Solução: leve pool de luz azulada no pavimento em frente (mesmo padrão de `beams.js`, quad com mistura aditiva). Perf: 1 draw barato. Aceitação: gradiente de luz no chão visível à noite.

**W-09 | UX | P3 | ESTILO**
- Problema: nenhuma microinteração no landmark foi encontrada [C, busca limitada]. Idéia: hover/clique no arco com destaque e texto do contato.
- Autorização: sim (nova interação). Complexidade: média.

## D. Top 10

1. W-02 Pontos flutuantes (vapor do ônibus em dia limpo).
2. W-01 Inconsistência dia/noite da fachada e telões.
3. W-05 Detalhes ausentes de fidelidade (vidro, anel do teto, podium).
4. W-04 Arco cortado no enquadramento.
5. W-03 Manchas brancas de reflexo na chuva.
6. W-07 Praça frontal vazia e sem sinais de dia de jogo.
7. W-08 Spill de luz noturno no chão.
8. W-06 Materiais da bacia sem micro-variação.
9. W-09 Microinteração no landmark.
10. Anel de luz do arco em dia (reflexo de sol no aço) como realce, ESTILO.

## E. Quick wins (sem geometria nova)

- W-02: limitar vapor a noite/tempo frio (uma linha em `scene.js:691`). Confirmar a hipótese antes.
- W-03: baixar o clamp 0,65 de `wet-surfaces.js:115`.
- W-01: alinhar `glowK` e matiz noturno do vidro (`authored-landmarks.js:58`).
- W-06: aumentar o contraste de baias (`authored-landmarks.js:76`).

## F. Melhorias arquiteturais

- Gravar a cor do vidro como vertex color próprio no GLB e remover a derivação por canal (`authored-landmarks.js:61`): evita depender de assinaturas `r==g` (linha 83).
- Substituir o loop de 8 bounds do shader de landmarks por um atributo de máscara no GLB ou por um uniforme por material [H]; hoje roda por fragmento em todos os materiais com acabamento (`landmark-materials.js:29`). Só vale após medir.
- Pipeline: o README fala de 7.744/3.948 tris; manter um teste de orçamento no GLB regenerado.

## G. Oportunidades criativas

- Dia de jogo: bandeiras, torcedores com camisas, fumaça de sinalizador (um Points já existe).
- Arco que acende em sequência ao se aproximar do contato.
- Telão com o nome do Samuel / "Contact" (cópia em `js/content.js`, en e pt).
- Áudio de multidão já existe (`assets/audio/wembley-crowd.mp3`); ligar a um destaque visual.

## H. Roadmap

1. Fase 0, confirmar: capturar W-02 com vapor desligado; confirmar W-03 após a redução do dono. Sem dependências.
2. Fase 1, quick wins (E). Depende da fase 0.
3. Fase 2 (autorização): enquadramento (W-04) e praça (W-07).
4. Fase 3 (autorização, GLB): vidro/anel/podium (W-01 estrutural, W-05). Depende de W-04 para saber o que a câmera mostra.
5. Fase 4: spill noturno e microinteração (W-08, W-09).

## I. Antes e depois (expectativas, não resultados)

- Fase 1: sem pontos soltos atrás do ônibus; poças menos brancas; fachada de dia e de noite no mesmo matiz.
- Fase 3: estádio reconhecível também sem o arco; silhueta do teto mais próxima da referência.
- Perf esperada: neutra nas fases 1 e 2; fase 3 com centenas de tris a mais e mesmos 3 draws. Nada medido.

## O que um Senior Art Director criticaria

- "O arco é lindo e o resto é uma lata de lixo cinza." A bacia é o 80% da imagem e não tem vidro, ritmo nem anel de teto.
- "Dia e noite não são o mesmo prédio." Cinza chumbo vs. azul-gelo.
- "Por que há sujeira flutuando na rua?" Vapor lido como artefato.
- "A câmera corta o seu melhor ativo."
- "A praça é um estacionamento." Sem vida, sem evento, sem vegetação.
- "Reflexo branco no asfalto molhado parece neve."
- "O telão mostra um desenho de arco em vez de uma marca clara; parece placeholder."
