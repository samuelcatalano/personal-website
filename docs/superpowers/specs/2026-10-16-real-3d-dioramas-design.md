# Portfólio London Bus — Dioramas com modelos 3D reais

**Estado:** design aprovado pelo usuário no chat em 2026-10-16. Esta especificação substitui a direção de arte da maquete procedural (`2026-10-16-architectural-maquette-design.md`) para o **mundo 3D**. O painel editorial, a navegação, o conteúdo e os contratos de runtime continuam valendo.

## Objetivo

Trocar a cidade procedural por **modelos 3D reais** de São Paulo e Londres, no estilo das referências enviadas pelo usuário: Big Ben em pedra dourada e ardósia, Routemaster vermelho com faróis, London Eye, e Tower Bridge em diorama sobre base. O site inteiro deve ter essa linguagem.

A geografia deve ser honesta. Wembley não fica no Tâmisa; o rio aparece só em Westminster e na Tower Bridge.

## Fora do escopo

Seções ou conteúdo novos, backend, CMS, áudio e controle manual do ônibus também ficam de fora. Também não entram:

- pipeline de build no site;
- pacotes npm em runtime;
- modelos sem licença compatível;
- Draco, meshopt e KTX2, que exigiriam decodificadores extras.

## Direção visual

- **Dioramas sobre bases** de pedra clara (como a referência da Tower Bridge), ligados por uma estrada, sobre um **fundo neutro cinza-claro** com gradiente suave. Cada capítulo da carreira é um diorama.
- Os modelos mantêm as **cores e texturas próprias**. Não serão recoloridos para a paleta da maquete.
- Iluminação difusa com sombras suaves. O tema noturno escurece o fundo e as bases e acende as luzes de janelas e faróis quando o modelo as tiver.
- Escala: cada modelo recebe uma **altura-alvo no diorama** definida no manifesto (escala estilizada e consistente dentro de cada diorama). O ônibus mede cerca de 11 m em todas as cenas e a figura Memoji cerca de 2,2 m. Não exagerar escalas para dar destaque.

## Capítulos

| Diorama | Modelos | Paradas |
|---|---|---|
| Visão geral | Todos os dioramas vistos do alto | `hero` |
| São Paulo | Catedral da Sé, MASP, Ponte Estaiada | `puc` 2003, `arizona` 2011, `insane` 2012, `taqtile` 2014, `mira` 2017, `reclame` 2017. O ônibus percorre Sé → Paulista → Estaiada. |
| Voo | Avião low-poly cruzando o espaço vazio entre SP e Londres | Transição 2017 → 2020 |
| Heathrow | Terminal e pista simplificados; o avião pousa | `millimetric` 2020 |
| Westminster | Tâmisa, com Big Ben e London Eye em margens opostas | `xdesign` 2020, `olm` 2021 |
| Tower Bridge | A ponte sobre o Tâmisa | `tribal` 2024 |
| Estrada para Wembley | Rua neutra com táxi e cabine telefônica (pacote CC0) | `stack`, `articles`, `repos`, `recs` |
| Wembley | Estádio e arco, **sem rio**; Memoji acenando ao lado do ônibus | `contact` |

## Modelos candidatos

Fonte: Sketchfab, todos baixáveis em GLB. O usuário baixa com a própria conta. A escolha final passa pela revisão visual de cada diorama.

| Modelo | Candidato principal | Alternativa | Licença |
|---|---|---|---|
| Big Ben | https://sketchfab.com/models/b5f82ba2e3614be2a69755a2a613579a | https://sketchfab.com/models/9a1c691fac774bcca4e2ba565c4c9d9b | CC-BY |
| London Eye | https://sketchfab.com/models/74eaf18882314264b474861d564fca36 | — | CC-BY |
| Tower Bridge | https://sketchfab.com/models/0021ac55a9d54c13b655a2ed430d01f6 | https://sketchfab.com/models/c6f6a570788d48a88383eb554eeb02ef | CC-BY |
| Wembley | https://sketchfab.com/models/fd20346281d04e0c8b62b8d2354b936e | — | CC-BY |
| Ônibus Routemaster | https://sketchfab.com/models/b809e5698e3444a3b62bb58654caac75 | https://sketchfab.com/models/3b413c4b43df44619824328311ae946c | CC-BY |
| Props de Londres (táxi, cabine etc.) | https://sketchfab.com/models/815ca9e4e85844d6b702cb65ebc7dac8 | — | CC0 (declarado pelo autor) |
| MASP | https://sketchfab.com/models/7eb9d1c77f9b43b088128fc5baa249bb | — | CC-BY |
| Catedral da Sé | https://sketchfab.com/models/a2e7c359bdbf4a4682dd165a2397fb36 | — | CC-BY |
| Ponte Estaiada | https://sketchfab.com/models/be0e5bf3b1c34e4da38d4b1a9a47d3f9 | — | CC-BY |
| Heathrow | https://sketchfab.com/models/1fed3793e2f94d6c9b22805b568119d1 | — | CC-BY |
| Avião | https://sketchfab.com/models/65cc7c4349174f7bbb20ed70206377b5 | — | CC-BY |

Modelos CC-BY-SA, NonCommercial ou "Free Standard" sem permissão de redistribuição ficam fora, salvo nova decisão do usuário.

## Implementação

**Carregamento.**
- O importmap ganha `"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"`, e o `GLTFLoader` vem do próprio three na versão fixada. É a única exceção à regra de "sem dependências novas", aprovada pelo usuário junto com este design.
- O GLTFLoader não conta no orçamento de código próprio.

**Assets.**
- Os arquivos ficam em `assets/models/<id>.glb`, otimizados antes do commit com `npx @gltf-transform/cli` (ferramenta de desenvolvimento, fora do site): simplificação de malha, texturas redimensionadas para no máximo 1024 px em JPEG/PNG, `dedup` e `prune`. Sem compressão que exija decodificador.
- Os originais baixados ficam em `assets/models/source/`, ignorado pelo git.
- Metas:
  - até 1,5 MB por modelo;
  - até 8 MB no total;
  - até 2 MB para mostrar o hero (o hero usa silhuetas leves até os modelos carregarem);
  - menos de 150 draw calls e menos de 300 mil triângulos visíveis por frame.

**Manifesto `js/world/models.js`** (puro, sem three, testável em Node):

```js
{ id, file, chapter, height, credit: { title, author, license, url } }
```

**Unidades:**
- `js/world/models.js`: manifesto e créditos.
- `js/world/loader.js`: carrega um GLB por id e normaliza a escala para `height`, com a base em y = 0 e o centro em x/z. Devolve uma Promise e faz cache.
- `js/world/dioramas.js`: bases, estrada, rio só onde houver, e posicionamento dos modelos de cada capítulo. Carrega o capítulo atual e o seguinte.
- `js/world/route.js`, ou a evolução de `layout.js`: pontos da estrada passando pelos dioramas e mapeamento das paradas para os capítulos.
- `scene.js` mantém o contrato `createWorld(canvas, stops, { reducedMotion, onProgress }) → { setProgress, jump, setTheme, dispose }`, a câmera com mola única e as tomadas.

**Sai:** a cidade, os marcos e o ônibus procedurais (`city.js`, o procedural de `landmarks.js` e `bus.js`), a água procedural fora dos dioramas com rio, e a paleta da maquete onde ela não for usada.

**Fica:** painel, `ui.js`, `content.js`, `scroll.js`, `camera.js` (tomadas, `spring`, `FRAME_LIFT` reajustado), as placas em `signs.js`, a figura Memoji, o céu e a noite em `sky.js`, e o tráfego em `ambient.js` (que passa a usar o modelo de ônibus e do táxi).

**Créditos.** A seção Contact ganha a lista "Modelos 3D" / "3D models", gerada do manifesto, com título, autor, licença e link. Os rótulos ficam em `content.js` (EN/PT). É obrigatório para CC-BY.

**Fallbacks.**
- Sem WebGL ou com falha de CDN: `no-webgl`, painel completo, como hoje.
- Se um GLB falhar: o diorama mostra só a base, com um aviso no console e sem quebrar o resto.
- Movimento reduzido: sem animação ociosa.
- Aba oculta: pausa.

## Testes

**Node.**
- O manifesto tem `id` único, arquivo existente em `assets/models/`, `height > 0` e crédito completo, e a licença está na lista permitida.
- Os capítulos cobrem todas as paradas, em ordem.
- Os testes de privacidade e de conteúdo continuam passando.

**Browser.**
- Cada GLB carrega.
- Depois da normalização, a altura fica dentro de ±2% da altura-alvo, com a base em y ≈ 0.
- O ônibus fica entre 10,5 e 11,5 m.
- Menos de 150 draw calls no percurso completo.
- Falha simulada de um GLB não quebra a cena.

**Visual.** Um ponto de controle do usuário por diorama, com capturas desktop e 375 px, de dia e de noite.

## Riscos

- **Estilos diferentes entre autores.** As bases e o fundo neutro isolam cada diorama, e a revisão visual pode trocar pelo candidato alternativo.
- **Modelos pesados** (London Eye 214 mil faces, Wembley 385 mil, Heathrow 115 mil). A simplificação pode degradar a forma; nesse caso o usuário decide entre aceitar, buscar outra fonte ou usar um procedural melhorado.
- **Licença declarada versus real.** Registrar no manifesto a licença mostrada na página do modelo no momento do download.
