# Cidade 3D — Especificação do benchmark visual

## Objetivo e limites

Transformar a referência fornecida em um benchmark 3D executado pela cena Three.js existente. O benchmark serve para aprovar um nível visual antes de expandi-lo. Preserva a rota guiada pela rolagem, o mapa e os dados de lotes existentes, as landmarks, as rotas de pedestres, o ônibus e a população atual. A imagem é direção de arte, nunca um fundo estático.

Esta especificação não autoriza expansão para o restante da cidade. A primeira implementação altera somente os lotes e superfícies listados para o benchmark abaixo. Não adicionar dependências, frameworks, novos pontos de parada ou novos lotes. Nenhum asset será baixado antes da etapa de sourcing e da aprovação da fase correspondente.

## Área benchmark escolhida

**Wembley/Contact: praça, aproximação do estádio e quadras laterais.** É a região que melhor combina os elementos de composição da referência: landmark central ao fundo, área pública aberta, fachadas urbanas nos lados, passeio e avenida no primeiro plano. O centro é o stop `contact`, hoje em `(x=795, z=-7)` com os dados de rota atuais.

O envelope de avaliação é `x=[660, 880]`, `z=[-113, -25]`, mas ele não autoriza ocupar o envelope inteiro. A implementação poderá remodelar apenas os footprints existentes e os pavimentos/percursos já gerados. O conjunto local encontrado no gerador inclui fachadas de terraço, mid-rise e office, fileiras de casas, volumes de fundo e os dois lotes `wembley-side-*`; esse conjunto fornece ao menos três arquétipos distintos sem criar novos lotes. O parque existente em `PARKS` fica no mesmo enquadramento e é parte da validação visual.

O estádio permanece no centro de sua reserva existente. Nenhum prédio novo, árvore alta ou mobiliário poderá entrar na faixa da fachada/visão do Wembley, atualmente cortada em `blocks.js` por `H('wembley', 30, 30, -49, -33)`. As árvores baixas já presentes na praça ficam nos mesmos pontos e dentro do limite atual; caminhos, loop de pedestres e travessias permanecem desimpedidos. A avenida e suas áreas de circulação permanecem nas posições atuais. A geometria dos prédios deve caber integralmente em cada lote de origem. A praça/estádio permanece visível a partir do shot de `contact` e dos shots adjacentes.

O limite de edição da primeira fase é o conjunto de lotes já existentes dentro do envelope mais as áreas de praça, passeio e rua já geradas ali; mudanças de pavimentação ou mobiliário não podem alterar a topologia da rota. A fase não altera builders de landmark.

Arquivos que definem ou participam desta região:

- `js/world/layout.js`: pontos de rota, stop IDs, limites e posições das landmarks.
- `js/world/blocks.js`: footprints de edifícios, reserva frontal do Wembley e lotes laterais.
- `js/world/city.js`: estrada, calçadas, meio-fio, marcações, mobiliário de rua e coleta de árvores.
- `js/world/parks.js`: parque, caminhos, árvores, bancos, postes, canteiros e cercas.
- `js/world/landmarks.js`: forma e posição atual do Wembley; fica protegido nesta fase.
- `js/world/building-kit.js` e `js/world/real-city.js`: aparência e montagem dos prédios comuns.
- `js/world/trees.js`, `js/world/people.js` e `js/world/crowd.js`: árvores renderizadas e rotas/pessoas existentes.
- `js/world/scene.js`, `js/world/voxel.js`, `js/world/textures.js`, `js/world/palette.js` e `js/world/post.js`: integração da cena, materiais compartilhados, iluminação/pós-processamento e lotes de mesh.
- `tests/real-city.test.mjs`, `tests/real-city.browser.py`, `tests/building-kit.browser.py`, `tests/parks.test.mjs`, `tests/parks.browser.py`, `tests/public-walks.browser.py` e `tests/world.browser.py`: determinismo, limites, caminhos, landmarks e renderização.

**Pendência visual identificada:** a referência mostra uma ponte/passarela elevada vermelha. A inspeção do código atual não encontrou um objeto com essa identidade ou cor; `landmarks.js` constrói o Wembley claro e a Tower Bridge separadamente. Portanto, a primeira fase preserva o Wembley atual e não inventa nem substitui uma landmark. A comparação de composição deverá registrar essa diferença; adicionar a passarela vermelha exige decisão explícita de escopo antes de implementação.

## Baseline anterior à benchmark

Estado do código e da cena antes desta especificação:

- Edifícios comuns já são gerados por lote e passam por um kit procedural compartilhado, mas a geometria-base e muitos detalhes ainda são caixas. Há variação de fachada, janelas, molduras e alguns telhados, porém a silhueta geral permanece cúbica e o resultado continua visualmente distante da referência.
- Estradas, meios-fios, calçadas e landmarks continuam usando o construtor de caixas; parques combinam caixas e árvores billboard instanciadas. Pedestres já são sprites animados em batches; carros e ônibus mantêm o estilo low-poly atual. Céu e água têm sistemas próprios.
- O navegador verificado anteriormente mostrou **483 lotes de edifício em 16 `InstancedMesh` compartilhados** no renderer de arquitetura. O kit usa uma `BoxGeometry` compartilhada e materiais de fachada/telhado/detalhe reutilizados; os lotes são agrupados por material. Esse número descreve apenas o subsistema de prédios, não a cena inteira.
- `node --test tests/` foi executado nesta etapa: **95 passaram, 0 falharam**.

| Métrica de baseline | Evidência disponível agora | Como fechar a medição antes da fase 1 |
|---|---|---|
| Estado visual | Cena atual descrita acima e evidência de inspeção anterior; aspecto geral ainda blocky | Captura do shot `contact` em 1440×900 e 375×812, com data/hora e URLs/flags fixos |
| FPS e frame time | Não registrados; `scene.js` mede FPS internamente para reduzir o tier de pós-processamento, mas não expõe a série | Capturar 10 s depois de 2 s de aquecimento, com câmera/progresso, DPR e tier fixos; reportar mediana e p95 |
| Draw calls / triângulos | Não há valores de `renderer.info` guardados; total da cena não medido | Amostrar `renderer.info.render.calls` e `.triangles` no frame do benchmark por instrumentação temporária de teste, sem hook no produto |
| Meshes e materiais | Prédios: 483 plots e 16 batches no browser; contagem total da cena e instâncias por batch não registrada | Contar `scene.traverse()` e materiais únicos no shot; separar meshes visíveis, instâncias e grupos |
| Gargalos já conhecidos | 483 lotes; detalhe de fachada repetido; renderização de pós-processamento high tier no desktop; sombras direcionais de 1024² | Medir CPU/GPU p95 na máquina disponível; identificar se o gargalo é draw calls, geometria, sombras ou pós-processamento |

O browser-harness não conseguiu iniciar nesta etapa: seu lock de runtime em `~/.config/browser-harness/` está fora das raízes graváveis desta sessão. Assim, não há medição ao vivo de FPS, frame time, total de draw calls, triângulos ou meshes para registrar sem inventar valores. Esses campos são obrigatórios na captura baseline imediatamente antes da implementação e antes de qualquer alteração visual da benchmark. Se a baseline ao vivo não puder ser coletada, a fase 1 é **NO-GO** para mudança de geometria/material.

## Visual Acceptance Criteria

A validação usa o mesmo enquadramento de `contact`, na luz diurna, com uma captura de referência e as mesmas dimensões antes/depois. A inspeção final também cobre noite e mobile.

1. **Silhueta e estilo:** prédios benchmark deixam de parecer pilhas de cubos. Nenhuma fachada principal pode ser apenas um retângulo liso com janelas coladas. Silhuetas devem variar por perfil de telhado, recuos, cornijas, sacadas, platibandas ou volumes de cobertura; os prédios mantêm baixa/média contagem poligonal e escala coerente.
2. **Arquétipos:** pelo menos três arquétipos visualmente distinguíveis aparecem simultaneamente no enquadramento. O renderer compartilhado mantém suporte a cinco: terrace, shop, midrise, office e tower. Cada arquétipo tem proporção, ritmo de fachada e tratamento de cobertura próprios; não vale somente trocar cor.
3. **Fachadas:** portas e janelas têm profundidade legível, moldura/reveal e proporções coerentes com pavimentos de aproximadamente 2,6–3,4 m. Fachadas térreas comerciais distinguem vitrine e entrada. Mullions, cornijas e varandas usam repetição compartilhada, sem uma chamada de desenho por janela.
4. **Materiais:** tijolo, reboco/pedra, concreto, vidro, metal, telhado e asfalto são distinguíveis à distância normal de câmera. Roughness e metalness são consistentes por família; mapas são tileáveis/compartilhados. Variação de cor deve ser determinística e contida, sem ruído pixelado ou aparência de textura Minecraft.
5. **Rua:** asfalto tem variação sutil, marcações de faixa e borda permanecem visíveis, meios-fios conectam com o piso e travessias ficam niveladas. Calçadas são contínuas e mantêm pelo menos 2,4 m de largura livre onde a geometria existente permite; nenhum detalhe atravessa a faixa de veículos ou o caminho de pedestres.
6. **Praça:** a área pública lê como pavimento urbano de pedra/concreto, com caminhos geométricos contínuos, gramado em porções moderadas, canteiros e espaço aberto central. A praça não fica saturada de props e não encobre o estádio.
7. **Vegetação:** mostrar pelo menos três classes de altura e duas formas de copa distinguíveis, com pequenas variações de escala/rotação. Árvores altas ficam fora dos corredores e das linhas visuais da landmark. O plano de placement preserva todas as rotas e não repete uma grade uniforme.
8. **Mobiliário:** bancos, postes e canteiros/vasos têm peças completas e legíveis em escala humana; ficam junto aos caminhos e não bloqueiam a passagem. Postes não criam uma PointLight cada.
9. **Luz e sombra:** leitura de fim de tarde quente, com sol direcional, sombras consistentes na mesma direção e ambiente sem fachadas lavadas. A composição diurna conserva a paleta da referência e o tema noturno continua funcional.
10. **Composição e escala:** no shot de `contact`, volumes baixos/médios enquadram o espaço aberto, massas mais altas formam profundidade no fundo, avenida/passeios ocupam primeiro plano e Wembley continua reconhecível. Portas, janelas, árvores, bancos e pessoas dão escala coerente. A falta da passarela vermelha é documentada como diferença da referência até haver decisão sobre ela.
11. **Landmarks e caminhos:** 100% dos lotes permanecem dentro de seus footprints; nenhum edifício novo é inserido. Nenhuma landmark ou corredor protegido é coberto. As distâncias mínimas e máscaras de proteção existentes continuam passando e ganham teste de não regressão para o limite benchmark.
12. **Regressão funcional:** rolagem/rota do ônibus, câmera e stop `contact`, pedestres de dia e de noite, EN/PT, WebGL desligado, `prefers-reduced-motion`, resize mobile/desktop e tema claro/escuro continuam operacionais. Zero erro no console.

O critério visual final precisa de aprovação humana a partir de capturas comparáveis. Testes de geometria não substituem essa aprovação.

## Procedural e assets

| Elemento | Procedural | Asset externo | Híbrido | Justificativa |
|---|---|---|---|---|
| Low-rise buildings | **Sim** | Opcional: textura tileável CC0 | **Preferido** | Silhuetas/fachadas derivam dos lotes; textura CC0 só entra se melhorar tijolo/reboco sem quebrar repetição ou peso. |
| Towers | **Sim** | Não no benchmark | — | Recuos, curtain wall e módulos variam por lote; manter proporções e instancing é mais importante que um modelo único. |
| Windows/doors | **Sim** | Não | — | Elementos modulares instanciados; não justificam asset separado. |
| Roofs | **Sim** | Não | — | Formas e materiais devem responder ao arquétipo e aos limites do footprint. |
| Trees | **Sim** | Potencial CC0 para copa/tronco | **Preferido** | Geometry-first no benchmark; testar asset CC0 apenas se trouxer copa claramente superior e puder ser instanciado. |
| Benches | **Sim** | Não | — | Geometria simples, reutilizável e repetida; asset acrescentaria custo sem ganho relevante. |
| Lamps | **Sim** | Não | — | Modelagem curta; emissive para noite e sem luz dinâmica por poste. |
| Vehicles | **Sim** | Potencial modelo CC0 low-poly | **Preferido mais tarde** | Fora do primeiro benchmark; só substituir se houver ganho visual demonstrável e contagem/pivôs compatíveis com a animação existente. |
| Pedestrians | **Não nesta fase** | Não | **Sistema atual** | Reutilizar sprites e movimentos existentes, preservando densidade, sentidos e acessibilidade. |
| Road details | **Sim** | Textura CC0 opcional | **Preferido** | Marcas, meio-fio, tampas e transições são dados locais; mapas tiling podem contribuir no asfalto/pedra. |
| Bridge | **Sim** | Não no benchmark | — | A Tower Bridge existente deve manter seu builder e sua identidade; geometria de estrutura é específica e deve respeitar o vão do rio. |
| Red landmark da referência | **Sim, se for aprovada como elemento novo** | Asset não recomendado | — | É uma silhueta icônica da referência, mas não foi localizada no código atual. Primeiro mapear sua identidade/posição; se aprovada, geometria procedural dá melhor controle de vãos, cor e clearances. |

Assets externos são candidatos, não compromisso. Nenhum download ocorre nesta etapa. Antes de usar qualquer asset, a fase correspondente deve aplicar `city-asset-sourcing`, verificar fonte/licença/atribuição e registrar nome, autor, licença, URL e uso em `ASSET_SOURCES.md`. Prioridade CC0. Se não houver candidato compatível, manter geometria e materiais procedurais.

## Arquitetura proposta

Evoluir o fluxo sem substituir a rota, lotes, RNG ou scene graph existentes:

```text
Hoje:
layout/lot data -> callback de caixas -> batelada de BoxGeometry

Alvo:
layout/lot data -> building definition -> archetype
               -> facade / roof / reusable modules
               -> shared material families / optional tileable maps
               -> instanced and batched mesh -> scene
```

O dado atual (`id`, `kind`, `x`, `z`, `width`, `depth`, `height`) continua sendo a fonte espacial. O renderer deriva uma definição estável a partir do `kind` e do ID/semente: número de andares, perfil de telhado, ritmo de janelas, material de fachada e módulos. Não migrar todos os lotes para um novo formato nem criar um sistema genérico de distritos. `building-kit.js` permanece o dono dos arquétipos e gera módulos compartilhados; `real-city.js` monta e agrupa geometria por geometria/material; `scene.js` integra uma saída separada para a região benchmark. Lotes fora dela continuam exatamente com o renderer atual até a aprovação da expansão.

Rua, praça e mobiliário continuam definidos nos geradores espaciais (`city.js`, `parks.js`), com materiais/meshes compartilhados. Landmarks ficam em builders próprios e não passam pelo `building-kit.js`. O sistema existente de árvores, pessoas, água e céu continua separado e é reaproveitado.

## Baseline e orçamento de performance

Primeiro capturar baseline com o código atual, depois benchmark com o mesmo navegador, dispositivo, shot, DPR, tema e tamanho. Usar desktop 1440×900 com DPR efetivo 1,5 e tier high; mobile 375×812 com DPR efetivo 1 e tier medium. Aquecer 2 s, medir por 10 s com progresso/câmera estáveis; guardar mediana e p95 de tempo de frame e FPS, `renderer.info.render.calls`, `renderer.info.render.triangles`, geometrias, texturas e materiais. Repetir dia e noite. A implementação de teste pode instrumentar o renderer sem adicionar telemetria permanente ao produto.

Limites da benchmark:

- **Draw calls:** no máximo +12 chamadas no shot benchmark em relação à baseline do mesmo shot; alvo +8. O total da cena nesse enquadramento não pode exceder `baseline + 12`.
- **Triângulos:** no máximo `min(40.000, 15% da baseline do shot)` triângulos adicionais visíveis na benchmark. Registrar o valor absoluto e a proporção; não esconder aumentos no número de lotes.
- **Meshes/drawables:** até 12 novos objetos renderizáveis na área benchmark, preferencialmente `InstancedMesh`/lotes compartilhados; não criar um objeto por janela, folha, pedra ou risco da via.
- **Materiais/texturas:** até 10 novas instâncias de material para a benchmark; reutilizar família de material e atlas. Textura nova deve ser tileável e compartilhada, dimensão máxima 1024² por atlas; preferir material procedural e textura noise atual quando suficiente.
- **Instancing:** fachadas repetidas, vegetação e mobiliário repetido compartilham geometria/material; lotes ficam agrupados, sem materiais únicos por prédio gerados à toa.
- **LOD:** alta definição somente no primeiro plano visível até aproximadamente 100 m; detalhe reduzido entre 100 e 240 m; skyline distante continua no `backdrop` simplificado/fog atual. Não implementar infraestrutura geral de LOD na fase benchmark, a menos que a medição mostre necessidade.
- **Sombras:** manter uma única sombra direcional de 1024² no desktop; desativada no mobile como hoje. Só silhuetas importantes recebem sombras; evitar sombras em cada detalhe de fachada.
- **Luzes dinâmicas:** nenhuma nova PointLight por poste/janela. Manter sol direcional e hemisphere light existentes; até uma luz adicional de área/efeito para toda a benchmark, e só com prova de ganho/performance.
- **Frame time:** p95 não pode crescer mais de 2 ms desktop ou 4 ms mobile contra baseline. Alvo mínimo de 50 FPS desktop e 30 FPS mobile na máquina medida. Se a baseline já estiver abaixo, a benchmark não pode piorar p95; registrar degradação existente e corrigir antes de expandir. O fallback adaptativo de pós-processamento permanece.

Se algum limite falhar, reduzir detalhe/efeitos ou simplificar instâncias e repetir as medições; não compensar adicionando draw calls, materiais ou luzes.

## Arquivos e estado local pendente

O inventário foi capturado antes de criar esta especificação. Os itens abaixo já estavam no working tree; não é possível inferir autoria (usuário ou agente anterior) apenas pelo Git. Nenhum deles foi editado ou revertido durante esta etapa.

**Modificados antes desta etapa (`M`):**

```text
docs/TRD.md
js/world/blocks.js
js/world/building-kit.js
js/world/city.js
js/world/country.js
js/world/glasgow.js
js/world/palette.js
js/world/real-city.js
js/world/scene.js
js/world/textures.js
tests/building-kit.browser.py
tests/real-city.browser.py
tests/real-city.test.mjs
```

**Não rastreados antes desta etapa (`??`):**

```text
docs/superpowers/plans/2026-10-19-stylized-city-system.md
docs/superpowers/specs/2026-10-19-stylized-city-system-design.md
tests/architecture-migration.test.mjs
```

Esta especificação é o único arquivo novo criado nesta etapa: `docs/superpowers/specs/2026-10-19-city-benchmark-visual-spec.md`. Antes de uma futura implementação, comparar `git status --short` com esse inventário, preservar todos esses conteúdos e manter os arquivos modificados separados dos novos. Não usar `git restore`, limpeza global ou commit amplo que inclua mudanças preexistentes. Nenhuma implementação futura foi feita nesta etapa.

## Plano incremental e gates

0. **Baseline:** destravar browser-harness/preview, capturar shot e medições de frame, render, geometrias, materiais e console em desktop/mobile; congelar os valores no relatório. **GO** somente com registro reproduzível.
1. **Uma benchmark Wembley:** fazer alterações apenas nos footprints e superfícies da região escolhida; manter exatamente os lotes e clearances atuais; implementar fachadas/telhados compartilhados, materiais, rua/praça, vegetação e mobiliário necessários; não migrar os demais lotes nem baixar asset sem sourcing. Rodar testes de bounds/clearance e browser.
2. **Validação visual:** comparar capturas baseline/benchmark em desktop/mobile, dia/noite, confirmar landmarks e rotas, EN/PT, reduced motion, WebGL fallback e console. Medir performance com a mesma configuração.
3. **Decisão do usuário:** mostrar a captura e os dados de performance; parar até aprovação explícita de que este é o nível visual a replicar. Se a composição exigir a passarela vermelha, decidir sua identidade/posição aqui.
4. **Expansão pós-aprovação:** migrar uma família/região por fase, sem alterar outra família até validação. Sequência proposta: fachadas e lotes comuns; torres; rua/calçadas; praças/vegetação; landmarks/ponte/água; veículos; polimento e acessibilidade/performance. Cada fase tem teste, captura e comparação próprios.

Não há transição automática do passo 2 para 4. Falha visual, de proteção ou de orçamento é NO-GO e exige correção dentro da benchmark atual antes de qualquer expansão.

## GO / NO-GO

**GO para implementação da fase 1 somente quando:** esta especificação for aprovada; a baseline visual e de desempenho estiver registrada; os três lotes e as proteções forem confirmados em browser; a diferença da passarela vermelha estiver explicitamente aceita ou resolvida; e existir um caminho verificável para manter a área isolada.

**GO para expansão somente quando:** a benchmark passar testes e matriz visual/funcional, respeitar os orçamentos, mantiver landmarks e caminhos visíveis e o usuário disser explicitamente que aquele é o nível a replicar.

**NO-GO quando:** não houver baseline reproduzível; o renderizador afetar lotes fora do envelope; uma landmark ou percurso perder visibilidade/continuidade; a composição exigir introduzir uma landmark ainda sem identidade aprovada; houver erro de console/regressão funcional; ou os limites de performance forem excedidos.

## Riscos e resposta

- **Aparência ainda distante apesar de mais detalhe:** medir por captura, avaliar silhueta/material primeiro e não expandir por contagem de props.
- **Mudança visual global acidental:** o renderer atual é citywide; a implementação precisa filtrar explicitamente o benchmark e manter o restante byte-for-byte ou visualmente idêntico. Testar lotes externos como controle.
- **Landmark vermelha ambígua:** não localizada no código. Nenhuma nova estrutura será adicionada sem decisão de identidade/posição.
- **Draw calls, sombras e pós-processamento:** medir antes/depois no mesmo shot e respeitar o orçamento acima.
- **Dependência de assets/licenças:** nenhum asset entra sem verificação de origem/licença e registro; fallback procedural é obrigatório.
- **Mudanças pendentes no workspace:** autoria não determinada e arquivos sem commit. Preservar o inventário e revisar diffs antes da implementação para evitar sobrescrever trabalho do usuário.
- **Limitação da medição atual:** a sessão não pôde iniciar browser-harness por acesso ao runtime lock; os números ao vivo permanecem NO-GO até serem coletados.
