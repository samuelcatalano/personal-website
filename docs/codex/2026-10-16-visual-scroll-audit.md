# Diagnóstico visual e scroll — 2026-10-16

Estado inspecionado: `feat/london-bus`, HEAD `add7580`, 30 commits após `main`. Árvore limpa antes desta investigação. Nenhum arquivo de produto foi alterado. Este relatório é independente dos documentos do Claude e não substitui o design aprovado.

## Entendimento do pedido

Melhorar o acabamento gráfico e a fluidez da viagem por Londres, preservando o ônibus, a identidade voxel, o conteúdo acessível em HTML e o trabalho já entregue. Restrições: sem build/npm/dependências novas, Three.js fixado, EN/PT, dia/noite, mobile, WebGL opcional, movimento reduzido e privacidade.

Fontes lidas: `CLAUDE.md` (`AGENTS.md` é o alias), `docs/PRD.md`, `docs/TRD.md`, designs aprovados inicial e v2, plano v2, histórico e fontes atuais. A preferência de modelos desta sessão (Sol na organização, Terra/Luna nas tarefas menores) substitui a tabela Claude para esta solicitação. Auditoria auxiliar executada por Luna, somente leitura.

## O que já foi entregue

- Conteúdo EN/PT: hero, formação e nove empregos, stack, três artigos, seis repositórios, recomendações e contato.
- Painel HTML independente da cena; navegação por seções e paradas, atalhos j/k, anúncios acessíveis, foco preservado, preferências locais e links diretos.
- Cena Three.js carregada por import dinâmico, ônibus com avatar, estrada curva, trecho brasileiro, Londres, Thames e marcos (Heathrow/avião, Big Ben, Eye, Tower Bridge, Wembley).
- Geometria instanciada por cor; render pixelado, tone mapping, câmera por seção com transições em arco e mola de progresso de 0,32 s.
- Dia/noite gradual, estrelas, janelas emissivas, shader de água, tráfego, barcos, pássaros e luz piscante.
- Placas de ano e monogramas no mundo, badges no painel e figura no final.
- Correções recentes de colisões visuais, estrada, posicionamento de placas/figura, contraste e salto inicial por hash.
- PDF com dados privados removido. Download de CV continua pendente de versão apropriada.

## Evidência da referência

Referência: https://www.bridglabs.com/en/ . Navegação, scroll e capturas feitos com browser-harness; observação passiva de DOM/scripts feita com REA.

- Descoberta REA: `ev_94c2a6ab9ec10d50f68ce35ee7dd0c2702ebbc0964261fb69234eb77a59d72a9`.
- Captura REA: `ev_f29dd18e624bad62726107597bfe51fa900a2e6f5c3f3eb912ad1039b1b21edf`.
- Bundle observado: `https://www.bridglabs.com/assets/World-D9fwKn29.js` (558.658 caracteres capturados).
- Observado na imagem: hero com ponte dominante, camadas de relevo e água; na seção intermediária, construções próximas com fachadas, telhados e vegetação mais variados.
- Observado no código entregue: renderer sem antialias, pixel ratio 1 e divisão da resolução por 2/3; mola 0,32 s; câmera com FOV adaptado ao aspecto (38–66°), deslocamento dependente do plano e fator mobile 1,25. Progresso calculado a partir das regiões HTML e suavizado antes de selecionar os planos.
- Não se conclui desempenho/FPS pelo tamanho do bundle nem por leitura estática. A captura passiva não cobre rede ou console anteriores à conexão e não prova execução de cada função. Não copiamos código ou assets.

## Achados priorizados

1. **Hero mobile sem composição legível — observado.** Em 375×812, o espaço acima do painel fica quase todo em céu/névoa, com pouca identidade de Londres. `camera.js` amplia a distância/altura em 1,8×, enquanto `scene.js` mantém fog 90–340. Relação causal entre distância e névoa é uma inferência apoiada pelo código e captura; ainda requer comparação após ajuste. Desktop também perde contraste e escala dos marcos no plano geral.
2. **Movimento com pausas extensas — confirmado no código.** `scroll.js` reserva 20% em cada extremidade do trecho: 40% de cada intervalo estacionário. Somam-se smoothstep do deslocamento, mola de 0,32 s e scroll suave nos saltos de navegação. Podem explicar sensação de atraso/arranca-e-para, mas não são evidência de frames perdidos. Preservar tempo de leitura e calibrar por observação.
3. **Texto e cena usam relógios distintos — confirmado no código.** `main.js` atualiza o painel pelo progresso real; `scene.js` posiciona ônibus/placa pelo suavizado. Divergência transitória é possível em movimentos rápidos. A solução deve manter o HTML funcionando imediatamente sem a cena.
4. **Cidade com pouca variedade — observado.** Construções pequenas e repetidas, gramado plano extenso e céu vazio; faltam detalhes de escala intermediária. Reutilizar os builders existentes para variar fachadas, telhados, árvores e margens, mantendo silhuetas de marcos livres e instancing.
5. **Loop contínuo mesmo em movimento reduzido — confirmado no código.** O relógio congela, mas render e atualizações continuam. Renderização sob demanda nesse modo evita trabalho sem mudança visual. Medição de custo ainda não realizada.

## Proposta delimitada para aprovação

Recomendação: evoluir os módulos atuais, sem reestruturar o site.

- Câmera e atmosfera: hero com Londres reconhecível e ônibus visível; enquadramentos específicos para desktop/mobile; ajustar FOV, offsets e névoa em conjunto. Prioridade ao espaço efetivamente livre acima do bottom sheet.
- Cidade: enriquecer as formas já presentes com fachadas/telhados/vegetação e margens mais variadas, dentro do orçamento de render. Sem novos marcos ou sistemas.
- Scroll: reduzir pausas e calibrar resposta da mola; evitar uma segunda suavização desnecessária nos saltos de navegação; manter coerência entre texto, ano e posição visual, preservando fallback imediato.
- Movimento reduzido: manter poses estáticas e atualizar a cena somente quando necessário.

Arquivos potencialmente envolvidos: `js/scroll.js`, `js/main.js`, `js/world/camera.js`, `js/world/scene.js`, `js/world/sky.js`, `js/world/city.js`, `js/ui.js` apenas se a sincronização exigir, `css/style.css` apenas para enquadramento mobile, e `tests/logic.test.mjs`. Confirmar alcance exato antes de editar. Sem alterar conteúdo ou interfaces públicas desnecessariamente.

Alternativas: somente câmera/scroll dá menor custo, mas mantém a cidade visualmente simples; reconstrução cinematográfica inteira teria mais risco e não é recomendada.

## Verificação e limites

- `node --test tests/`: 21/21 passaram, com aviso de módulos do Node.
- Capturas da prévia local em desktop 1728×907 (hero/journey) e mobile 375×812 (hero). Confirmação de `world-ready` e buffers reduzidos.
- Não medidos: FPS/frame times, draw calls, Lighthouse, accesslint, matriz completa EN/PT/dia/noite/WebGL desabilitado/reduced-motion e todos os planos. Não declarar esses critérios aprovados.
- TRD promete skyline no fallback, mas CSS entrega gradiente; checklists dos planos não registram com precisão o código já entregue. São divergências existentes, fora da proposta visual imediata.

Critérios para a futura implementação: matriz completa do projeto, testes de trajetória/transições e regressões, ausência de novos erros de console, a11y ≥95, performance desktop ≥80 e comparação visual antes/depois. Não aumentar a suavização para mascarar custo de render sem medir.

Próximo passo: aprovação do design curto em conversa, exigida pela skill brainstorming invocada pelo usuário. Este documento é um relatório de investigação, não uma implementação nem um novo design aprovado.
