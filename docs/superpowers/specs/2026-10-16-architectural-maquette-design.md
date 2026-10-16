# Portfólio London Bus — Direção de maquete arquitetônica

**Estado: proposta para revisão de design.** Este documento define a próxima direção visual; não é um plano de implementação nem registra uma aprovação final.

## Objetivo e âmbito

Substituir a apresentação pixel/voxel por uma maquete arquitetônica 3D estilizada de Londres. A experiência combina uma cena contínua guiada pelo scroll com um painel editorial HTML e navegação real. O visitante deve encontrar rapidamente o nome, a especialidade e os contatos de Samuel, e conseguir consultar a carreira e as demais seções sem depender do WebGL.

O primeiro marco é uma única cena de hero, polida em desktop e mobile. Deve incluir uma vista representativa da cidade, o ônibus, a navegação completa e o painel completo, mostrando a seção de hero e um estado representativo da carreira através da navegação existente. A rota e o conteúdo continuam navegáveis, mas a expansão do acabamento visual ao longo de toda a rota só começa depois da revisão e aceitação visual deste marco.

Ficam fora do escopo: novas seções, novos recursos de produto, controle manual do ônibus, áudio, backend, CMS, novas dependências, modelos 3D externos ou mudança da arquitetura estática.

## Direção visual

A referência é uma maquete arquitetônica contemporânea, sóbria e tátil, em vez de pixel art. A cidade usa pedra clara e quente como base — marfim calcário `#E8E0D2`, pedra `#C9BDAA`, sombra taupe `#8E8375` — com telhados e pavimentos em castanho acinzentado e vegetação verde discreta. O vermelho londrino do ônibus, próximo de `#C9252B`, é o principal acento saturado. O vidro é azul acinzentado pálido; luzes de janela têm tom âmbar suave. Cores são referências práticas, ajustáveis na revisão, e devem permanecer coerentes entre elementos.

Volumes simples, cornijas, vãos, caixilhos e alguns elementos de fachada dão escala arquitetônica; detalhe fino não deve competir com a silhueta nem com o texto. Plantas aparecem em grupos pequenos como contraponto à pedra, sem cobrir fachadas ou vistas. Luz diurna difusa e sombras macias definem os volumes sem contraste duro. O tema noturno reutiliza as mesmas formas e paleta, escurecendo céu e pedra e acrescentando luz quente contida às janelas e ao ônibus. Renderizar com antialiasing e resolução nítida; remover a ampliação pixelada e `image-rendering: pixelated`. Começar com DPR limitado a 1,5 no desktop e 1 no mobile, ajustável a partir de medições. Não adicionar pós-processamento.

O ônibus conserva dimensões e proporções comuns em toda a cena e na circulação: cerca de 11 m de comprimento, 4,6 m de altura e 2,5 m de largura, conforme o modelo atual. Não aumenta para se tornar herói. A composição, distância focal e enquadramento fazem com que se leia claramente sem distorcer sua escala em relação às ruas, portas e edifícios.

## Composição e navegação

No hero, a maquete oferece contexto suficiente para reconhecer uma rua londrina e ler a fachada, enquanto o ônibus vermelho conduz o olhar. O painel não cobre o ônibus nem o principal detalhe arquitetônico; a navegação não cobre o nome, a especialidade ou os contatos. O HTML mantém prioridade visual e contraste suficientes sobre a cena. Painel, cabeçalho e navegação usam a fonte Inter já disponível, sem Silkscreen; anos e placas devem harmonizar com a tipografia editorial, sem letreiros gigantes.

No desktop, conservar a navegação superior discreta e o painel editorial fixo, com largura máxima de 400–420 px; enquadrar a cena numa área segura que exclua cabeçalho e painel. No mobile, manter identidade e controles de idioma/tema no topo, com uma linha compacta de seções que possa rolar horizontalmente e continue acessível por teclado; o painel fica fixo embaixo, limitado a cerca de 45% da altura e com rolagem interna, deixando a cena enquadrada na área restante. Todas as seções existentes (`hero`, `journey`, `stack`, `articles`, `repos`, `recs`, `contact`) devem ter acesso direto, incluindo recomendações. Reutilizar os controles de idioma e tema já presentes; não introduzir menu sobreposto ou novo fluxo.

O painel de carreira destaca uma experiência de cada vez e apresenta as dez entradas existentes de formação e trabalho numa linha do tempo compacta, com ano e entidade. Reutilizar o conteúdo atual, sem omitir entradas nem inventar texto. A seleção continua usando a navegação por seção e os controles existentes. A rota segue contínua ao scroll: uma única fonte de suavização controla progresso, posição do ônibus e enquadramento; não aplicar easing duplicado nem interceptar a rolagem nativa. Validar roda, trackpad e toque, incluindo reversões rápidas de direção, sem saltos ou encaixes inesperados. Pausar animação ociosa com movimento reduzido e manter a pausa quando a aba estiver oculta. O conteúdo permanece como HTML acessível e fonte de verdade; a maquete é decoração.

## Implementação compatível

Manter HTML/CSS/ES modules estáticos, `three@0.169.0` fixo no import map, sem build e sem npm. Todo o texto visível continua em `js/content.js`, em inglês e português do Brasil. Preservar hashes de navegação, teclado, preferências de idioma/tema, URLs relativas para navegação e recursos locais, os links externos aprovados já existentes, privacidade e os caminhos sem WebGL e com movimento reduzido.

Reutilizar o contrato runtime atual de `createWorld(canvas, stops, { reducedMotion, onProgress })` em `js/world/scene.js`, que retorna `{ setProgress, jump, setTheme, dispose }`. `main.js` carrega o mundo depois do painel e sincroniza o estado ativo do painel via `onProgress` do mundo suavizado; no fallback, `watchScroll` fornece o progresso diretamente. Este comportamento implementado prevalece sobre descrições antigas do TRD que já não correspondam ao runtime. `ui.js` renderiza e navega o painel a partir do mesmo conteúdo. `layout.js` continua fornecendo pontos de rota e escala compartilhada. O novo estilo deve evoluir módulos e unidades existentes (`city.js`, `landmarks.js`, `bus.js`, `camera.js`, céu e materiais) sem alterar contratos públicos sem necessidade.

A geometria procedural Three.js e materiais compartilhados são a base de produção dos elementos da maquete. Reutilizar materiais por família de superfície e manter a construção em módulos existentes. Não se assume pipeline de modelos, arquivos de modelos externos nem dependência nova. Manter como alvos de desempenho o JavaScript próprio abaixo de 60 KB (sem Three.js), menos de 150 draw calls e menos de 60 mil instâncias. O painel deve apresentar conteúdo útil em menos de 2 s numa conexão 4G. Medir Lighthouse em configuração documentada e repetível; não registrar metas como resultados antes de medir.

As alterações mais recentes ainda não commitadas no working tree são baseline de trabalho a preservar e revisar durante implementação; não são consideradas integradas por esta especificação. Nenhuma delas deve ser sobrescrita ao implementar esta direção.

## Critérios de revisão visual

O marco de hero fica pronto para revisão quando, em desktop e viewport de 375 px:

- a composição mostra uma cena arquitetônica coerente em pedra clara, detalhes de fachada e vegetação contida;
- o ônibus tem escala compartilhada e plausível, rodas alinhadas no eixo correto e carroceria proporcional, com os dois andares e janelas legíveis;
- rodas e chassi assentam na estrada, sem flutuar nem penetrar o pavimento;
- painel e navegação não ocultam o ônibus, a fachada principal ou informações essenciais, e o painel permanece confortável de ler;
- navegação alcança todas as seções e uma experiência da linha do tempo; inglês e português do Brasil cabem sem cortes nem sobreposições;
- scroll atravessa o hero e a carreira com progressão visual gradual e previsível em roda, trackpad e toque, sem easing duplicado, saltos ou encaixes após mudança rápida de direção.

A revisão também deve percorrer tema diurno/noturno, navegação por teclado/hash, WebGL indisponível e `prefers-reduced-motion`, além de confirmar ausência de animação ociosa nesse modo e pausa com a aba oculta. As metas de qualidade continuam sendo as documentadas no projeto: acessibilidade Lighthouse ≥ 95, desempenho ≥ 80 no desktop e conteúdo útil do painel antes da carga do mundo. Medir em configuração registrada (servidor local do site estático, cache limpo, viewport desktop definido, throttling móvel/4G documentado, três execuções e mediana); são alvos a verificar, não resultados já medidos.

Após esta revisão, a decisão de aceitar a direção visual e estendê-la às demais vistas da rota fica pendente.

## Relação com os documentos existentes

Esta direção substitui apenas decisões de arte e composição de interface que conflitem com este documento nos designs anteriores de 2026-10-15. Mantém os requisitos e contratos de conteúdo, navegação, tecnologia, privacidade, acessibilidade, fallback e desempenho de `CLAUDE.md`, `docs/PRD.md` e `docs/TRD.md`.
