# Handoff — NPC realista de Samuel — 2026-11-04

## Estado real

**Trabalho interrompido pelo usuário para continuidade no Claude. NÃO está concluído nem aprovado para publicação.** A junção cabeça/pescoço/camiseta continua defeituosa. Os candidatos locais, arquivos Blender e GLBs do runtime representam revisões diferentes. Não tratar nomes como `master-final` ou `npc_game_ready` como aprovação de qualidade.

- Repositório: `~/Projects/samuelcatalano/personal-website`.
- Branch verificada: **`feat/site-gamefication`**.
- HEAD: **`3d388e3`**, `test(city): thames overflow share tolerates the round-robin leftover after dropping a strip`.
- **Nenhum commit, push ou deploy desta implementação.** O trabalho está no working tree, inclusive muitos arquivos ainda untracked. `git diff` sozinho não mostra esses arquivos.
- O fluxo padrão do site continua usando o NPC pack anterior. O novo personagem só entra com **`?referenceNpc=1`**, substituindo um slot masculino do pool, não a multidão inteira.
- Último problema visual: `assets/models/source/realistic-npc-20261104/handoff/three-neck-static5.png`. Ainda há superfícies/triângulos sobrepostos e uma borda irregular no pescoço. A captura anterior `three-albedo-only.png` mostra que não se trata apenas de iluminação/normal map.

Este documento prevalece sobre o status antigo do plano e dos arquivos `STATUS` anteriores.

## Pedido original e decisões do usuário

O pedido completo está em `~/.codex/attachments/88303a50-9c76-4bd4-9ed4-83a61f16828a/Texto colado.txt`. É uma especificação do usuário: reconstrução fiel em Blender, master e versão game-ready, rig, animação natural, três LODs, integração inicial de um NPC no Three.js, benchmarks 0/1/10/30 e evidências visuais. Não basta editar uma imagem de apresentação.

Referências originais em `~/Desktop/`:

- `Screenshot 2026-11-02 at 11.41.23 pm.png`: costas.
- `Screenshot 2026-11-02 at 11.42.58 pm.png`: 3/4, também referência da última correção da barriga.
- `Screenshot 2026-11-02 at 11.43.13 pm.png`: 3/4 oposto.
- `Screenshot 2026-11-02 at 11.47.02 pm.png`: frente.
- `Screenshot 2026-11-02 at 11.47.16 pm.png`: A-pose e T-pose.

Decisões que não devem ser reabertas sem necessidade:

1. O usuário aceitou a semelhança geral da **terceira cabeça**, preservada em `handoff/head3-photo-aligned.glb`, ressalvando os olhos. Não substituir por cabeça procedural genérica nem regenerar cabelo, barba, nariz ou expressão para tentar resolver a junção.
2. No screenshot anotado de 2026-11-04 14:06, o olho **à esquerda da imagem, circulado em verde, foi explicitamente aprovado**. O da direita, vermelho, precisava correção.
3. O usuário mostrou no Photoshop o resultado desejado: copiar/espelhar o olho bom e alinhar o outro. As primeiras tentativas com íris de tamanhos diferentes/olhar convergente foram rejeitadas. A última tentativa implementa a cópia; **não houve aprovação explícita do usuário dessa versão final de olhos**.
4. A última correção corporal foi: **“Minha barriga não é tão saliente assim! Diminua um pouco ela.”** O acréscimo artificial de projeção abdominal no montador foi reduzido de 6,5 cm para **2 cm**, cerca de 4,5 cm menos no ponto máximo, sem estreitar a largura do corpo. Comparação preservada: `handoff/abdomen-comparison.png`. Não interpretar o pedido original de corpo volumoso como licença para exagerar a barriga.
5. Imagens devem permanecer locais. O usuário autorizou apenas o pacote adicional **Real-ESRGAN x4plus, 63,9 MB, BSD-3-Clause** e contagens anônimas do AssetFurnace. Não autoriza outros downloads, instalações ou uploads.

## O que está no working tree

Arquivos existentes modificados:

| Arquivo | Alteração |
| --- | --- |
| `js/world/npc3d.js` | +36 linhas: import do novo loader, instalação assíncrona de um único slot por flag, atualização de velocidade/LOD e descarte. Rotas/simulação e NPC pack original preservados. |
| `ASSET_SOURCES.md` | Proveniência dos candidatos, referências do usuário, ferramentas locais, rig MPFB e animação Quaternius. Registro não significa aprovação visual. |

Arquivos novos, ainda untracked:

| Arquivo/diretório | Função / estado |
| --- | --- |
| `.agents/skills/blender-realistic-npc/` | Skill curta, oito referências progressivas e três validadores reais de geometria, rig e GLB. |
| `docs/plans/2026-11-04-realistic-npc.md` | Plano e histórico experimental. Algumas entradas descrevem tentativas superadas; este handoff define o estado atual. |
| `js/world/reference-npc.js` | Loader dos três GLBs, validação de rig/bind pose, clone com um skeleton e mixer por personagem, geometria trocada entre LODs, materiais compartilhados, Idle/Walk com crossfade. |
| `tools/npc/reference-review.html` | Página isolada de QA, câmera de rosto/corpo, dia/noite, LOD forçado, transições, medição de pés e benchmark. Foi usada para capturas; benchmark completo ainda não executado. |
| `tests/reference-npc.test.mjs` | Três testes: histerese de LOD, retorno do culling e limpeza quando um carregamento falha. |
| `tools/npc/fix_reference_eyes.py` | Preserva cabeça e olho aprovado; copia/espelha a superfície e cores do olho bom. Limita profundidade para evitar raycast até o fundo do crânio. |
| `tools/npc/assemble_reference_npc.py` | Monta Body/Head/ReferenceEyes com transformação fixa; reduz barriga. **Recorte/junção do pescoço permanece inadequado.** |
| `tools/npc/reference_lods.py` | Replay local Pixal3D, transferência de albedo original, normal bake, redução e verificação de UVs. Última revisão suaviza normais entre posições duplicadas nas emendas UV sem remover faces. |
| `tools/npc/reference_rig.py` | MPFB como doador de rig/pesos; adapta antebraços à pose escaneada, retarget Idle/Walk, dedos relaxados, calibração das solas. Sem doador visível de rosto. |
| `tools/npc/prepare_reference_master.py` | Staging separado em Blender, escala inferida 1,78 m, `.blend` com texturas empacotadas e 12 renders de corpo/cabeça. |
| `tools/npc/render_reference_motion.py` | Renderiza quadros reais de Idle/Walk de um `.blend` rigado. |
| `tools/npc/compress_reference_glb.py` | Geometria byte a byte preservada, albedo WebP q92 e normal maps WebP lossless, `EXT_texture_webp`. |
| `assets/npc/reference/` | Três GLBs candidatos e relatórios de compressão. **Estão desatualizados em relação aos últimos rigs locais.** |
| `docs/handoffs/` | Este handoff e prompt do Claude. |

Há também `:memory:.ses` untracked, 51 bytes. Origem não estabelecida; foi deixado intacto. Não incluir automaticamente em commit, não apagar nem atribuir autoria.

## Preservação dos artefatos

O diretório temporário original é `/private/tmp/realistic-npc-20261104/` (~1,9 GB de experiências). **Não depender da sobrevivência de `/tmp`.** Para este handoff foram copiados 70 arquivos importantes (461.884.897 bytes, com hashes) para:

`~/Projects/samuelcatalano/personal-website/assets/models/source/realistic-npc-20261104/handoff/`

O diretório pai `assets/models/source/` já é ignorado pelo Git. Isso preserva os arquivos localmente e evita publicá-los no GitHub Pages. **Não usar `git add -f` nesses arquivos nem commitar fotografias, pesos ou grandes masters.**

`handoff/manifest.json` registra tamanho e SHA-256 de cada cópia. Principais arquivos preservados:

- `head3-photo-aligned.glb`: cabeça aceita antes das correções de olhos e de enxerto; base visual a preservar.
- `head-eyes-matched.glb` e `eyes-copy-review/`: última tentativa de olhos copiados, com cabeça inteira intacta. As vistas 3/4 desta pasta não têm o espigão de uma tentativa anterior. Não usar `eyes-matched-review` antigo de `/tmp`, que contém esse defeito.
- `reference-master.json`: matriz 4×4 fixa de alinhamento da cabeça; alguns parâmetros de corte antigos já não são utilizados pelo montador atual. Tem caminho antigo para `head3-views`; essa pasta também foi preservada.
- `references.json`: hashes dos cinco originais.
- `parts-smooth/{body,head}/lod{0,1,2}.glb`, albedo, normal maps e `summary.json`: últimas peças com normais suavizadas/rebake. Body: 17.456 / 6.500 / 2.000 tris; Head: 11.502 / 3.999 / 700, antes do enxerto/olhos.
- `game-lod{0,1,2}.glb`: montagem anterior à última tentativa de recorte; 26.433 / 10.207 / 3.447 tris. Sem rig.
- `rig-work/{npc_game_ready.blend,rigged.glb,rig-report.json}`: LOD0 rigado da montagem anterior. 53 ossos deformadores, três meshes, Idle/Walk. **A barba apresenta a linha de corte daquela montagem; candidato não aprovado.**
- `rig-lod1/` e `rig-lod2/`: equivalentes dos níveis menores.
- `master-final.glb` e `master-final-review/candidate_master.blend`: master de 1.604.978 tris e 12 renders, também da montagem anterior. O nome `final` é enganoso: o render frontal ainda tem uma descontinuidade na barba. **Não entregar como resultado concluído.**
- `UAL1_Standard.glb` e `UAL1_License.txt`: biblioteca CC0 original preservada para o retarget não depender do antigo caminho em `/private/tmp/claude-503/`.
- `walk-fit-front/` e `walk-fit-side/`: quatro quadros por vista de uma revisão anterior do ajuste de braços; não são validação final da animação atual.
- `three-neck-static5.png`, `three-neck-current.png`, `three-albedo-only.png`: evidência dos defeitos, não imagens de aprovação.

O corpo de origem projetado pelas fotos já está preservado em `assets/models/source/realistic-npc-20261104/body-front-back.glb`.

A **tentativa mais recente**, ainda sem rig, é `assets/models/source/realistic-npc-20261104/candidate-unrigged.glb` (27.419 tris). Foi renderizada em `handoff/three-neck-static5.png` e continua com problema no pescoço. Ela corresponde ao montador atual, mas **não** aos `game-lod*`, `rig-*`, master ou runtime existentes.

### GLBs atualmente servidos pelo runtime — conferidos no encerramento

| Arquivo | Bytes | Tris | Clips | SHA-256 |
| --- | ---: | ---: | --- | --- |
| `assets/npc/reference/npc_lod0.glb` | 6.591.652 | 27.558 | Idle, Walk | `e7966888168f1d6c8f5f6107ac83e759da76062bcb71c78921323d0ca5e30626` |
| `assets/npc/reference/npc_lod1.glb` | 6.016.700 | 10.785 | Idle, Walk | `6bcf90bd42dda38c31eace297f08299df909606b5a2039b3ba14c8ecf3cbd952` |
| `assets/npc/reference/npc_lod2.glb` | 5.618.132 | 3.536 | Idle, Walk | `3e039a49714f163763fab75bcb01604ba43033aebc5604d61026cc882328df7c` |

Esses três arquivos não receberam a última revisão de suavização/recorte. Estar dentro do orçamento não significa que a aparência esteja aprovada. Os relatórios `.compression.json` referem-se à versão do GLB ao lado, não aos rigs mais recentes.

## O que funcionou e o que falhou

### Reconstrução / aparência

- AssetFurnace 0.5.4, Pixal3D single-view nativo local, BiRefNet e Real-ESRGAN aprovado. Nenhuma imagem enviada a serviço externo.
- Corpo da A-pose limpa: run `efae72778be242aabaebc731d1766e57`, 951.298 tris; cerca de 207,4 s reportados pelo Studio. As fotos frontal/traseira foram projetadas depois para recuperar o logo frontal e remover um glifo branco inventado nas costas. **Isso não é reconstrução multiview.**
- Primeira cabeça isolada rejeitada por defeitos/baixa semelhança. Terceira cabeça: run `80e6fda9327d4e888c5d86b8591a86e9`, 951.750 tris, cerca de 527,7 s. O upscale condicionou a geometria; a textura final usa pixels da foto original.
- Cabeça aceita é a melhor base disponível. Não reiniciar reconstrução por hábito.
- Tentativas de superfície procedural dos olhos produziram aspecto de adesivo, tamanhos diferentes e olhar convergente; foram rejeitadas. A cópia do olho bom foi mais adequada. Um espigão lateral por raycast atravessando buraco da malha foi corrigido limitando a profundidade.
- **O principal bloqueio atual é o enxerto cabeça/pescoço/camiseta.** Recortes por cor/pixels ou altura criaram bordas de triângulos, duplicação de pele, retalhos de camiseta e, em uma revisão, corte visível na barba. Não há costura/ponte real entre as duas superfícies.
- Uma tentativa de weld real por distância no script de LOD foi abandonada após a asserção detectar alteração de faces. A versão atual só calcula normais compartilhadas por posição; preserva a topologia e os UVs.

Revisão independente apontou: preservar o pescoço/colar contínuo do corpo, remover o pescoço duplicado do retrato e esconder a junção sob a barba, **sem cortar seu contorno aprovado**; revisar geometria em vários ângulos antes de rigar novamente. Isso é uma recomendação, não uma solução já executada com sucesso. O montador atual ainda usa um recorte diferente e falho; ler antes de reutilizar.

### Rig / movimento

- Blender 5.2.3 LTS; Python 3.13.13 embutido; MPFB 2.0.18 e Rigify presentes.
- MPFB doador `game_engine`, 53 ossos; nenhum rosto do doador aparece no personagem.
- A-pose do doador foi ajustada aos punhos do scan; sem isso os braços caminhavam para trás. Dedos do scan permanecem relaxados; a animação original de dedos causava membranas/estiramento.
- Reutilizado `tools/npc/npc_retarget.py` sem alteração. Idle: 2,5 s; Walk: 1,333 s a 24 fps. Velocidade de passada inferida do scan ~0,6643 m/s, usada para ajustar cadence ao movimento existente.
- Solas calibradas por geometria avaliada no Blender: erro mínimo próximo de zero nos quadros amostrados. Em uma revisão carregada no Three.js, 32 fases deram mínimo −1,4 mm e máximo +5,8 mm para a sola mais baixa. **Não representa aprovação de foot sliding ou naturalidade.**
- Existem apenas **Idle e Walk**. Start/stop são crossfades de 0,25 s no runtime; turning usa a direção suavizada da navegação existente. Não há clips separados de start/stop/turn, respiração ou weight shifting aprovados.

### Runtime / desempenho

- GLTFLoader real da versão Three.js **0.169.0** carregou os três GLBs então servidos sem erro JS capturado.
- Cada instância usa um skeleton e mixer; três meshes, três materiais do personagem. No QA isolado: quatro draw calls com chão, quatro texturas de material e uma bone texture por instância. Esses dados são de um personagem, não benchmark 0/1/10/30.
- LOD geométrico com histerese de 10% em 14/32/100 m, nível 3 culled. Atlas compartilhado entre LODs/instâncias; texturas duplicadas dos GLBs menores descartadas após carregar.
- Última página de QA também permite inspeção de modelo estático inserido manualmente pelo browser. **Recarregar a página** antes de medir; essa cena diagnóstica alterada não é baseline.
- Não houve benchmark completo, comparação controlada de performance, teste efetivo do piloto na cidade ou validação final das trocas de LOD animadas.
- Pequeno bug pendente de revisão: `js/world/npc3d.js` catch do carregamento, em torno da linha 425, pode recriar `__referenceNpcError` depois de `dispose()`. Recomendação: condicionar a publicação ao mundo ainda estar aberto. **Não corrigido no encerramento, pois o usuário pediu parar e fazer handoff.**

## Verificações efetivamente executadas

- `rtk test node --test tests/`: regressão Node passou, zero falhas, skips ou cancelamentos, ~2,85 s no último run. Isso não valida o modelo visualmente.
- `tests/reference-npc.test.mjs` + `tests/npc-loading.test.mjs`: 14 testes relacionados passaram na revisão. Nenhum cenário novo de browser/dispose foi executado pelo revisor.
- `validate_gltf.py --self-test`: 1 caso válido passou, 11 casos malformados rejeitados.
- Validadores Blender exercitados com fixtures válidas/inválidas; pesos/ossos de revisões anteriores passaram. Últimos rigs emitiram relatórios sem vértices sem peso, mas **não houve nova execução independente dos validadores sobre todo o conjunto após a última mudança**.
- `reference_lods.py`: seis peças reimportadas no Blender; UVs, texturas ≤2K, contagens e bounds conferidos. Normal bake tem 1 ray miss amostrado no corpo e 3 na cabeça; não é cobertura por texel nem certificação de bake perfeito.
- Compressão existente: buffers geométricos preservados; pixels de normal maps lossless conferidos; albedo WebP q92. Esse resultado vale para os GLBs comprimidos existentes, não para arquivos que ainda não foram reexportados.
- `python3 -m py_compile` executado durante implementação; `git diff --check` sem erro no último check.
- Renders Blender em múltiplos ângulos e capturas Three.js realmente inspecionados. Eles revelaram os problemas documentados; **NO-GO visual**.

**Não executado/concluído:** benchmark 0/1/10/30, GPU/performance final, matriz completa desktop/mobile 375px dia/noite EN/PT WebGL-off/reduced-motion, Lighthouse, prova final de foot sliding/clipping/transições/turns, validação visual do piloto na cidade, sincronização final dos assets, entrega final dos dois `.blend`, commit/push/deploy. Não declarar GO com base apenas nos testes de código.

## Ambiente e retomada prática

- Blender: `/opt/homebrew/bin/blender`, aplicativo em `~/Applications/Blender.app/`. Headless no sandbox pode falhar na detecção Metal; processos separados com escalonamento funcionaram. Nunca usar a cena aberta do usuário.
- Python com bibliotecas já instaladas: `~/image-to-3dlab/.venv/bin/python` (numpy, trimesh, Pillow etc.). Não instalar pacotes novos sem autorização.
- AssetFurnace: `~/image-to-3dlab`. Outputs originais em `output/a-pose-clean__efae7277__pixal3d__20261104-131834/` e `output/head-front-esrgan__80e6fda9__pixal3d__20261104-133512/`, incluindo `.post.bin` para replay; não é necessário gerar de novo.
- Preview iniciado em `http://127.0.0.1:8000/`, via `python3 -m http.server 8000 --bind 127.0.0.1`. Confirmar se ainda está vivo.
- QA: `http://127.0.0.1:8000/tools/npc/reference-review.html?count=1&portrait=1&speed=0`. Para benchmark: `?count=0&bench=1`, depois 1/10/30, mesma câmera/configuração, aguardar `window.__bench`.
- **Usar browser-harness para browser.** Foi criado Chrome **isolado, sem contas**, perfil `/private/tmp/realistic-npc-20261104/isolated-chrome-profile`, CDP `127.0.0.1:9335`. Conectar com `BU_NAME=reference-npc-local BU_CDP_URL=http://127.0.0.1:9335 browser-harness`. A aba precisa estar ativa para rAF; foi confirmado `document.hidden=true` antes de ativá-la. Desabilitar cache ao substituir GLBs e aguardar término da gravação/compressão antes de recarregar.
- **A revisão automática rejeitou aprovar depuração do Chrome pessoal**, por risco de expor abas autenticadas/dados da sessão. Não repetir `mac-approve` nessa sessão pessoal nem contornar a rejeição. A instância temporária separada foi a alternativa autorizada e usada.

## Próximas etapas recomendadas

1. Ler AGENTS.md/CLAUDE.md e este handoff, conferir `git status`, inspecionar cabeça aceita, resultado Photoshop do usuário e evidência da falha. Não gastar tempo refazendo descoberta do ambiente.
2. Resolver a geometria da junção em uma **única malha candidata estática**, preservando face/olhos/barba e barriga reduzida. Conferir frente, perfil, 3/4 e costas antes de rig/LOD/export. Parar de encadear recortes aproximados sem revisão visual.
3. Só após resolver isso, sincronizar master, três montagens, três rigs/GLBs e runtime a partir da mesma revisão. Conferir hashes/proveniência; não misturar os arquivos desta entrega.
4. Validar deformações e animação reais em Blender e Three.js, preservar roupa/contatos e implementar o que faltar da solicitação original sem fingir clips que não existem.
5. Testar um NPC na cidade, medir 0/1/10/30 em condições equivalentes e registrar recursos/CPU/GPU quando disponíveis. Respeitar os limites da medição rAF e estimativas de memória.
6. Só então apresentar resultado/limitações ao usuário. Sem npm/build, dependências novas ou substituição automática dos outros NPCs; sem commit/push não solicitado.

## Atualização — sessão Claude, 2026-11-04

Prevalece sobre as seções acima no que conflitar. Sem commit, push ou deploy. Aparência estática aprovada pelo dono em 2026-11-04, antes da correção dos braços e da troca do memoji; a versão final animada ainda não foi aprovada.

- **Objetivo corrigido pelo dono:** o NPC substitui o memoji de `js/world/figure.js` (fim do percurso, Wembley), e não um slot da multidão. Baixa só o LOD0 (4,8 MB) a menos de 400 m. O memoji fica como reserva: não é baixado nem desenhado, salvo se o NPC falhar (`showMemoji`). Altura de 2,2 m (escala 1,236), na calçada, em primeiro plano. O corpo fica fixo, virado para a câmera da última parada (`figure.userData.facing`), e tronco, pescoço e cabeça olham para a câmera (`LOOK_CHAIN`). A posição e o canto sem grama nem árvores (`clearClosingCorner`, em `scene.js`) foram marcados pelo dono em captura. Com reduced motion, mantém a mão erguida sem animar. O piloto `?referenceNpc=1` foi removido de `npc3d.js`; o diff está em `handoff/pilot-npc3d.diff`, na pasta ignorada.
- **Luz noturna, sem luz real na cena (`lightCharacter` em `figure.js`):** preenchimento com o próprio albedo (emissive 0,04 de dia, 0,22 à noite) e poça quente aditiva no chão. O contorno por Fresnel foi rejeitado pelo dono: marcava as facetas da malha com branco.
- **Referência visual:** `handoff/eyes-copy-review/head_front.png`, a melhor versão segundo o dono.
- **Montador (`tools/npc/assemble_reference_npc.py`):** o pescoço visível é o da cabeça, cortado na linha da gola medida no corpo (`collar_field`). A pele abaixo da barba é alongada na frente para entrar sob a camiseta. Retalhos laterais são puxados para o pescoço, sem abrir buracos. `symmetric_eyes` espelha o retalho direito íntegro; `socket_backing` cobre o furo do olho. `smooth_normals` suaviza as normais da cabeça e o normal map dela foi removido.
- **Rig (`tools/npc/reference_rig.py`):** o pescoço do `Head` mistura pesos do doador com o osso `head` (`neck_share`); antes a cabeça inteira era rígida. `clear_arms_from_torso` abre os braços 16 graus em Idle e Walk (`ARM_CLEARANCE_DEGREES`). `build_wave` cria `Wave` (7,5 s, 3 ciclos do Idle) só no LOD0: ergue a mão direita, acena 3,9 s com amplitude irregular, punho atrasado e cotovelo acompanhando, abaixa e descansa. O tronco inclina de leve; dedos estendidos com leque pequeno e polegar aberto; mão esquerda na cintura; coxas 5 graus mais juntas (`LEG_CLOSE_DEGREES`), com solas recalibradas; quadril e pernas congelados em todo o clipe, por pedido do dono. O clipe é procedural.
- **Artefatos da mesma revisão:** `candidate-neck-seam{,-lod1,-lod2}.glb` (28.149 / 11.016 / 3.726 tris), `handoff/rig-seam/lod{0,1,2}/` (inclui `npc_game_ready.blend`) e `assets/npc/reference/npc_lod{0,1,2}.glb` (4,8 / 4,0 / 3,6 MB; o site usa só o LOD0, e LOD1/LOD2 ficaram com o `Wave` anterior, sem uso). GLBs anteriores em `handoff/reference-glb-previous/`.
- **Master estático:** `master-neck-seam.glb` (1.700.994 tris) e `handoff/master-seam-review/candidate_master.blend` (97 MB) com 12 renders, da mesma revisão de montagem. Sem rig; a correção dos braços vive apenas nos rigs.
- **Benchmark, Chrome isolado, M3 Max, 1280x713, 120 Hz, todos em LOD0 (pior caso), cena isolada:**

| NPCs | Tris | Calls | Frame med/p95 ms | CPU med ms | Mixer med ms | GPU med/p95 ms |
| ---: | ---: | ---: | --- | ---: | ---: | --- |
| 0 | 2 | 1 | 8,3 / 9,3 | 0,1 | 0,0 | 0,56 / 2,36 |
| 1 | 28.151 | 4 | 8,3 / 9,2 | 0,3 | 0,1 | 1,19 / 5,70 |
| 10 | 281.492 | 31 | 8,3 / 9,3 | 0,8 | 0,3 | 1,51 / 5,68 |
| 30 | 844.472 | 91 | 8,3 / 9,2 | 1,5 | 0,6 | 2,16 / 6,09 |

  Máquina topo de linha: não representa celular. Geometria 1,23 MB, texturas ~50 MB (estimativa, sem mipmaps), bone texture 4 KB por NPC.
- **Benchmark e `Wave`:** a tabela foi medida antes de `Wave` existir e com Walk. O `Wave` foi visto em quadros isolados no site (`wave-frames.png`), não como movimento contínuo.
- **Painel do navegador:** só anima com a janela do Claude em primeiro plano; números medidos nele não valem. Usar Chrome isolado.
- **Validado:** Node 163/163 (antes da correção dos braços; JS sem mudança depois), validador estrutural dos GLBs, Idle e Walk no Three.js em vistas de corpo inteiro, NPC carregando no site sem erro no console.
- **Não validado:** movimento contínuo do `Wave`, EN/PT, `tests/figure.browser.py`, Lighthouse, foot sliding em Walk. Noite e celular foram capturados com reduced motion, em quadro estático; dia, em movimento normal.
- **Defeitos conhecidos:** há pequenos cortes na gola nas laterais em close (Idle); furo escuro no cabelo, da cabeça aceita; pequena ponta na borda inferior da barba; o LOD2 tinha rachaduras em close no Blender, não reavaliadas depois de suavizar normais.
- **Tentativas rejeitadas:** recortes por triângulo inteiro; costura sobre a pele à vista; pescoço só do corpo com corte pela cor da barba, que abriu vãos; escala e contorno escuro nos olhos.
- **Estado em 2026-11-04 (teto do dono: 40%):** personagem no ponto marcado pelo dono no desktop recuado depois a pedido dele (`near * 9.6`, `tan * 10.8`); no celular fica em `tan * 7`, `near * 6`, porque o painel cobriria o canto. Grama e árvores do canto removidas por `clearClosingCorner` (aparar lawn por comprimento, filtrar plantas e árvores). `?qa` expõe `__qaFigure` para medir pontos na cena. Capturas válidas em reduced motion: `handoff/site-wembley.png`, `site-wembley-night.png`, `site-wembley-mobile.png`, `final-review.png`. Corpo girado `BODY_TURN` (0,42 rad) a pedido do dono. Sombra real do sol no personagem; o disco do memoji fica oculto depois que ele carrega, exceto no celular, que não renderiza sombras. No site, os olhos usam cor escura uniforme, sem verniz, porque cobrem cerca de um pixel e piscavam; o GLB mantém as cores detalhadas. Sem commit. Depois de aprovado: commit sem fotos nem masters.
- **Limpeza em 2026-11-04:** só `npc_lod0.glb` fica no repositório. LOD1 e LOD2 foram apagados de `assets/npc/reference/` e podem ser regerados com `compress_reference_glb.py` a partir de `handoff/rig-seam/`. O loader carrega só o LOD0 por padrão, inclusive na página `tools/npc/reference-review.html`, que por isso já não testa troca de LOD.
