# Maquete arquitetônica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira cena de Londres como maquete arquitetônica, com ônibus proporcional, painel editorial e navegação completa, para revisão visual antes de expandir o acabamento pela rota.

**Architecture:** Evoluir os módulos atuais, mantendo o progresso compartilhado entre mundo e painel e o HTML como fonte de conteúdo. Usar geometria procedural e materiais compartilhados; acabamento detalhado concentrado no enquadramento do hero e na transição para a primeira experiência. O conteúdo e a rota completa permanecem utilizáveis.

**Tech Stack:** HTML/CSS, ES modules nativos, Three.js 0.169.0 por importmap, Node test runner e browser-harness existente.

**Spec:** `docs/superpowers/specs/2026-10-16-architectural-maquette-design.md` — aprovada pelo usuário no chat em 2026-10-16.

## Global Constraints

- Sem build, npm, novas dependências, modelos externos, pós-processamento ou publicação nesta entrega.
- `three@0.169.0`; todo texto visível em `js/content.js`, em inglês e português do Brasil.
- URLs relativas para navegação e recursos locais; preservar links externos aprovados e privacidade.
- HTML acessível, todas as seções, dez entradas de carreira, hashes, teclado, idioma e tema preservados.
- WebGL opcional; movimento reduzido sem animação ociosa; pausa quando a aba estiver oculta.
- Pedra clara `#E8E0D2`, `#C9BDAA`, `#8E8375`; ônibus vermelho próximo de `#C9252B`, mesma escala na frota.
- Renderização com antialiasing, sem ampliação pixelada; DPR inicial limitado a 1,5 desktop e 1 mobile.
- Inter existente no painel, cabeçalho e navegação; nenhum novo download de fonte.
- Metas: JS próprio <60 KB, draw calls <150, instâncias <60 mil, conteúdo útil <2 s em 4G, Lighthouse a11y ≥95 e performance desktop ≥80. São verificações pendentes.
- Sol organiza, decide e revisa; Luna implementa. Não usar Sol para implementar tarefas menores. Um responsável por arquivo por vez.
- Preservar e revisar o working tree existente, incluindo arquivos ainda não rastreados; nunca usar reset, restore ou clean para preparar a execução.

## Review Focus

- PT-BR e texto longo a 375 px/zoom 200%: controles e conteúdo continuam alcançáveis — tarefa 1.
- Mudança de idioma/experiência com foco na cronologia: foco permanece válido e revelar a linha ativa não move o documento — tarefa 1.
- Rota invertida e execução longa: todos os ônibus compartilham dimensões e o tráfego conserva as correções de posição — tarefa 2.
- Reversão rápida do scroll/retorno de aba oculta: sem salto artificial, segunda suavização ou enorme delta de tempo — tarefa 4.
- Falha de WebGL/CDN e movimento reduzido: navegação, contato e dez experiências funcionam — tarefa 5.

## Mapa de arquivos e execução

Reutilizar `index.html`, `css/style.css`, `js/content.js` e `js/ui.js` para a interface; `bus.js` para o veículo compartilhado; `city.js` para a maquete; `scene.js`, `sky.js`, `camera.js` e `signs.js` para composição/renderização. Não renomear `voxel.js`: seu agrupamento de caixas por material continua útil sem pixel art. Nenhuma nova biblioteca de materiais ou camada de componentes.

Executar tarefas 1–5 nesta ordem para que cada revisão use uma base estável. Subagents não fazem commits nem editam fora dos arquivos atribuídos. Sol revisa o diff e resultados antes de liberar a próxima tarefa. Testes de navegador usam uma única sessão, sem trabalhadores concorrentes.

Antes da primeira edição, registrar `git status --short`, HEAD e cópias de `git diff --binary` e dos arquivos não rastreados em uma pasta temporária fora do repositório. Ler os diffs existentes dos arquivos da tarefa. Ao concluir cada tarefa, stage somente os arquivos/hunks revisados daquela tarefa; mudanças anteriores nesses arquivos precisam entrar explicitamente na revisão. Não incluir os demais arquivos sujos. Commits locais por tarefa, sem push.

### Tarefa 1: Painel editorial e navegação responsiva

**Files:** Modify `index.html`, `css/style.css`, `js/ui.js`, `js/content.js`; Create `tests/interface.browser.py`; preservar `tests/content.test.mjs` e `tests/logic.test.mjs`.

**Interfaces:** Consome `stops`, `SECTIONS`, `i18n`, `links`, `sectionStart(section)`. Preserva `initUI({onGoto,onTheme}) → {theme,setActive(i)}`, IDs `world/panel/announce/track` e hooks `data-nav-home`, `data-nav`, `data-goto`, `data-lang`, `data-theme`, `.skip`.

- [ ] Escrever e executar primeiro o teste de navegação mobile: a 375×812, para cada seção de `SECTIONS`, encontrar link direto (`data-nav-home` para hero), revelar horizontalmente, ativar e verificar `panel.dataset.section`. Em `journey`, exigir dez botões `data-goto` e exatamente um detalhe ativo. O teste deve falhar hoje porque `recs` não possui link e o CSS esconde a navegação mobile.
- [ ] Implementar cabeçalho com identidade e controles, linha de seções rolável no mobile e painel fixo inferior com máximo de 45vh; desktop com painel até 420px. Usar Inter, fundo marfim opaco, separadores discretos, espaços de leitura e vermelho como acento. Remover bordas/sombras de estética pixel. Manter todos os painéis existentes, aprimorando a hierarquia, sem novos conteúdos de carreira.
- [ ] Adicionar `recs` e seu rótulo EN/PT à navegação. Usar identidade como retorno ao hero; todos os outros links usam `data-nav`. Hero inclui links de contato vindos de `links` e rótulos já localizados do contato. Mostrar seção ativa com `aria-current`; preservar foco, anúncios e preferências. Usar a cronologia existente: dez linhas compactas e somente o detalhe selecionado aberto.
- [ ] Acrescentar ao teste trocas EN/PT em hero e carreira, foco antes/depois da renderização e visibilidade da linha ativa sem alterar `scrollY`. Verificar overflow horizontal do documento (nav interna pode rolar), todos os controles alcançáveis e contato acessível a 375px; repetir inspeção visual com zoom 200%.
- [ ] Executar `node --test tests/`, `browser-harness < tests/interface.browser.py` e o teste existente `tests/world.browser.py`. Capturar hero e carreira em desktop e mobile, EN/PT, dia/noite. Revisar leitura e espaço da cena antes do commit local da interface.

### Tarefa 2: Modelo compartilhado de ônibus

**Files:** Modify `js/world/bus.js`, `tests/vehicles.browser.py`. `js/world/ambient.js` é consumidor para leitura, não requer edição prevista.

**Interfaces:** Preservar `buildBus({avatar:withAvatar=true}={}) → THREE.Group`. Eixo X = comprimento, Y = altura, Z = largura; origem no chão. Hero e tráfego usam o mesmo builder, sem multiplicador de escala. `buildMeshes` usa Y como base das caixas, não centro.

- [ ] Executar primeiro o teste atual da frota como baseline. Ampliar as asserções para a caixa do ônibus sem avatar: comprimento próximo de 11 m, altura 4,6 m, largura próxima de 2,5 m, tolerância de 0,15 m nos detalhes; mínimo Y zero. Preservar comparação entre hero/frota e os 20 cenários de tempo/progresso existentes. Não inventar teste que “prove” qualidade artística.
- [ ] Substituir a silhueta rígida por carroceria com arestas suavizadas usando geometria nativa Three.js, dois andares de vidro emoldurado, teto, portas e detalhes contidos. Rodas cilíndricas com eixo em Z, base no chão e sem aumentar a altura total. Reutilizar materiais por superfície dentro do builder; sem transparência cara, textos novos ou textura externa. Preservar avatar frontal discreto e luzes noturnas coletadas por `createSky`.
- [ ] Executar `browser-harness < tests/vehicles.browser.py`. Inspecionar capturas laterais, frontais e três-quartos do mesmo modelo, com e sem avatar; conferir eixos das rodas, dois andares e ausência de superfícies sobrepostas piscando.
- [ ] Sol revisa proporções e compartilhamento pelo tráfego antes do commit local do ônibus. As dimensões e os cenários existentes não podem regredir para melhorar a silhueta.

### Tarefa 3: Rua de maquete no hero

**Files:** Modify `js/world/city.js`; Create `tests/city.browser.py`. Ler `layout.js`, `voxel.js`, `landmarks.js`; não alterar suas interfaces.

**Interfaces:** Preservar `buildCity(add,stops,pts,curve)` sem retorno necessário; `add(x,y,z,w,h,d,color)` registra caixa com Y na base. Consumir `routePoints(stops.length)` e a mesma `THREE.CatmullRomCurve3` da cena. Manter seed determinística.

- [ ] Registrar a lista de caixas gerada pelo builder atual. Criar teste browser que chama o builder duas vezes e exige listas iguais, todas as coordenadas finitas e dimensões positivas. Testar a presença de superfícies da paleta aprovada no conjunto do hero; essa última asserção falha com a paleta atual.
- [ ] Concentrar a composição detalhada nos dois primeiros pontos da rota: fachadas de pedra em módulos contíguos, cornijas, janelas com caixilhos e peitoris, portas proporcionais, cobertura discreta, calçada e pequenos grupos de vegetação. Evitar árvores/volumes no corredor entre câmera e ônibus. Preservar dimensões e a trajetória da estrada, o rio, pontos de landmarks e edifícios do restante da rota.
- [ ] Aplicar tons sóbrios às grandes superfícies visíveis no hero, incluindo terreno e vegetação; não transformar gramado saturado em fundo dominante. Não redesenhar os landmarks distantes ou toda a rota neste marco. Reutilizar agrupamento por cor de `buildMeshes`, sem acrescentar malhas independentes por janela.
- [ ] Executar `browser-harness < tests/city.browser.py` e os testes de frota. Inspecionar as duas fachadas e contato da rua/calçada em hero e primeira experiência; conferir que a escala das portas permanece plausível frente aos 4,6 m do ônibus. Registrar número de caixas e cores, sem confundir isso com draw calls reais.
- [ ] Sol revisa fachadas, cor, escala e áreas livres antes do commit local da cidade.

### Tarefa 4: Renderização, luz e enquadramento integrados

**Files:** Modify `js/world/scene.js`, `js/world/sky.js`, `js/world/camera.js`, `js/world/signs.js`, `tests/world.browser.py`, `tests/logic.test.mjs`. Ler `main.js`, `scroll.js`, `css/style.css` como contratos; alteração adicional somente se um defeito demonstrado exigir integração, com responsável único.

**Interfaces:** Preservar `createWorld(canvas,stops,{reducedMotion,onProgress}) → Promise<{setProgress,jump,setTheme,dispose}>`, `createSky(scene,{hemi,sun}) → {update(night)}`, `shotFor(kind,bus,{mobile})`, `blendShots(a,b,t,arc)`, `spring(state,target,dt,smoothTime)`, `createSigns(scene,{stops,curve}) → Promise<{update(frame)}>`.

- [ ] Executar baseline Node/world antes das mudanças. Acrescentar teste de reversão da mola: partir de progresso intermediário, inverter alvo de 1 para 0 e exigir valores finitos dentro de [0,1] e convergência; manter verificações de 30/60/120 Hz e continuidade de transições existentes. Não escrever testes de valores exatos dos offsets da câmera.
- [ ] Habilitar antialias no renderer, substituir divisão artificial do drawing buffer por `setPixelRatio(Math.min(devicePixelRatio, mobile?1:1.5))` e `setSize(innerWidth,innerHeight,false)`. Remover pixelização CSS na tarefa 1. Preservar resize, descarte, tratamento de falhas e sombras desativadas no mobile inicialmente.
- [ ] Harmonizar céu/fog/hemisfério com pedra quente; luz principal suave e sombras com bias sem manchas. Manter janela iluminada e farol no tema noturno. Corrigir a lista de materiais glow caso a tarefa 2 tenha mudado suas cores; `createSky` deve ser criado depois desses materiais.
- [ ] Ajustar hero/follow e `setViewOffset` para as áreas reais da interface: ler limites atuais de `.bar` e `#panel` no resize, reservar painel lateral no desktop e painel inferior no mobile. Um `ResizeObserver` nativo nesses elementos atualiza o enquadramento quando idioma/seção muda sua altura; desconectar em `dispose`. Sem elementos HTML (teste isolado), usar o viewport inteiro. Preservar câmera perspectiva com aspecto correto; não impor câmera ortográfica a toda a rota. Manter ônibus e fachada principal visíveis; inspecionar também high/closing para evitar regressões.
- [ ] Harmonizar fonte, fundo e tamanho das placas com a interface editorial; não adicionar novos textos fora de `content.js`. Conservar posição/atualização por progresso e evitar placa cobrindo ônibus ou fachada.
- [ ] Preservar uma única mola de progresso (0,18 s como baseline), sem nova biblioteca de scroll ou segundo easing de progresso. Preservar `jump` para entrada por hash, sincronia de `onProgress`, pausa em aba oculta e renderização sob demanda com movimento reduzido. Não trocar constantes apenas para parecer mais fluido.
- [ ] Executar Node e os quatro testes browser. No teste world acrescentar resize desktop→mobile→desktop, validar tamanho físico do buffer segundo os caps, callback finito após reversão e convergência; aplicar timeout aos testes com RAF para não bloquear em aba oculta. Inspecionar manualmente retorno de aba e scroll real com roda/trackpad; registrar toque físico como não verificado se houver apenas emulação.
- [ ] Sol revisa capturas integradas, progresso e regressões antes do commit local de renderização.

### Tarefa 5: Verificação do marco e entrega para revisão visual

**Files:** Create `docs/codex/2026-10-16-maquette-milestone-validation.md`; corrigir somente defeitos demonstrados nos módulos responsáveis, devolvendo-os ao mesmo implementador Luna. Capturas fora do site publicado.

**Interfaces:** Site estático em `http://localhost:8001/` se o servidor existente continuar disponível; caso contrário iniciar `python3 -m http.server 8000` e usar sua URL. Browser-harness conforme sua skill; não instalar um novo runner.

- [ ] Executar `node --test tests/` e `browser-harness < tests/interface.browser.py`, `tests/vehicles.browser.py`, `tests/city.browser.py`, `tests/world.browser.py` separadamente com preview local aberto. Exigir sucesso e registrar falhas reais; não depender de números antigos de testes.
- [ ] Capturar hero e primeira experiência em 1350×940 e 375×812, EN/PT e dia/noite. Fixar explicitamente viewport para cada captura; limpar emulação anterior. Verificar ônibus integral, fachada principal, hierarquia do painel e acesso a navegação/contato. Percorrer também as dez experiências e seções restantes para garantir funcionalidade, sem exigir seu novo acabamento artístico.
- [ ] Verificar WebGL indisponível, falha de carregamento do CDN e movimento reduzido em sessões isoladas; exigir painel/contato e dez experiências navegáveis. Capturar erros do console durante a matriz. Restaurar configurações da sessão de teste ao terminar.
- [ ] Medir JS próprio, draw calls e instâncias reais, frames durante scroll e ausência de frames ociosos no modo reduzido. Documentar hardware/browser/viewport e distinguir amostragem de garantia. Executar Lighthouse completo sem filtrar métricas que compõem o score: três execuções, cache limpo, perfil desktop para performance ≥80/a11y ≥95; registrar throttling. Medir conteúdo inicial em perfil 4G separado para a meta de 2 s. Se a ferramenta não estiver disponível, registrar a lacuna; nenhum score substituto.
- [ ] Sol revisa o diff completo e resultados contra a especificação. Resolver problemas de funcionalidade/legibilidade identificados; não iniciar refinamento de toda a rota.
- [ ] Registrar evidências, limites de medição, capturas e o que ainda precisa de revisão visual humana. Commit local somente do relatório e correções revisadas. Apresentar a primeira cena ao usuário e aguardar aceitação visual antes de expandir o acabamento.

## Limite deste plano

Este plano entrega o primeiro marco completo. A expansão do novo acabamento para landmarks e demais trechos da cidade depende da aceitação visual desse marco; não está autorizada como continuação automática. Nenhum deploy ou push está incluído.
