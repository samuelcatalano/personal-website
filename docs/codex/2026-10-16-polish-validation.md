# Polimento visual e scroll — implementação e validação

Data: 2026-10-16. Branch: `feat/london-bus`, alterações locais sobre `add7580`. Direção aprovada pelo Samuel em conversa após o diagnóstico. Sem commit, push ou deploy.

## Alterações

- `js/world/camera.js`: hero olha ao longo da rota, com ônibus em primeiro plano e Londres ao fundo. Fator mobile reduzido de 1,8 para 1,15; follow mais elevado e afastado; plano final mobile mira mais à direita para incluir a figura.
- `js/world/scene.js`: FOV adaptado ao aspecto, névoa 180–650, arco de transição menor, sombras atualizadas no resize e mola de 0,18 s. Callback opcional `onProgress` comunica o progresso exibido. Movimento reduzido salta entre poses de paradas e renderiza somente quando há mudança. Visibilidade do documento pausa/retoma o loop.
- `js/main.js`: remove segunda suavização dos saltos de navegação; painel acompanha o progresso exibido pela cena. Sem mundo, o HTML continua respondendo diretamente ao scroll.
- `js/scroll.js`: pausas de 8% em cada ponta do trecho, antes 20%.
- `js/ui.js`: mudança de parada revela a linha ativa dentro do painel, inclusive no mobile; teste confirma que a página não se desloca por causa disso.
- `js/world/city.js`: janelas individuais, portas, variação de telhados/chaminés/copas e passeios com postes/bancos nas margens. Mesmo builder, instancing e RNG determinístico.
- `tests/logic.test.mjs` e `tests/world.browser.py`: regressões do deslocamento inicial, sincronização, pose inicial, salto por deep link, linha ativa visível, render estático, resize, tema, visibilidade e descarte.

Sem dependências, textos novos ou alteração dos documentos do Claude. PRD/TRD/designs anteriores permanecem como estavam; este registro documenta os parâmetros ajustados nesta sessão.

## Evidência de validação

| Verificação | Resultado |
| --- | --- |
| `node --test tests/` | 21/21 passaram |
| `git diff --check` | Sem erros |
| `browser-harness < tests/world.browser.py` | Passou; linha ativa visível em 375 px e posição da página preservada |
| Cena em movimento reduzido | 5 frames por mudanças explícitas; 0 frames durante intervalo ocioso |
| Desktop 1350×940 e mobile 375×812 | Hero, journey, stack, articles, repos, recs e contact inspecionados em EN/dia e PT/noite; sem overflow horizontal ou erros de execução capturados |
| Teclado no mobile com movimento reduzido | Dez entradas de carreira alcançadas por `j`; botão ativo visível em todas |
| WebGL2 indisponível | `no-webgl`, painel e links de contato operacionais |
| CDN Three.js bloqueado | Falha tratada; `no-webgl`, painel operacional |
| Console | 0 eventos de erro capturados durante a sessão monitorada |
| Amostra de 90 frames durante scroll | Mediana 8,3 ms; p95 9,3 ms; máximo 9,4 ms nesta máquina |
| Desenho em uma pose desktop | 143 comandos GL, incluindo sombras; orçamento <150 |
| JavaScript próprio | Aproximadamente 51 KB, abaixo dos 60 KB do TRD |
| Lighthouse desktop disponível | Acessibilidade 100; boas práticas 100; SEO 100 |
| Revisão por Luna | Sem achados acionáveis na revisão final; ajuste do evento de visibilidade incluído e testado |

Comando do teste de navegador: iniciar o servidor com `python3 -m http.server 8001`, abrir essa prévia via browser-harness e executar `browser-harness < tests/world.browser.py`. O teste usa a cena real e não exige npm.

## Limitações e achados preexistentes

- **A nota de performance 100 retornada pelo Lighthouse embarcado foi descartada.** O bundle filtra FCP/LCP/TBT; só CLS tem peso nessa categoria. Não comprova o requisito de performance ≥80 nem conteúdo em <2 s sob 4G. A medição de frames acima é uma amostra local, não um benchmark comparativo com a versão anterior.
- Lighthouse mantém um achado experimental `label-content-name-mismatch` nos botões de idioma e tema, já existentes; as categorias pontuadas acima continuam em 100. Não foram alterados os rótulos neste trabalho.
- Accesslint não conseguiu anexar à aba via seu endpoint. Foi executado sobre o HTML renderizado capturado pelo browser-harness: um achado moderado `keyboard-accessible/focus-order` em `main#panel[tabindex=0]`, preexistente. O foco do painel foi preservado porque permite navegação por teclado; não foi declarado um audit live limpo.
- Mobile foi emulado no Chrome, sem teste em aparelho físico ou Safari. Retomada por visibilidade tem teste do evento do documento; não houve benchmark de troca de aba pelo sistema operacional.
- O Node continua emitindo o aviso preexistente `MODULE_TYPELESS_PACKAGE_JSON`, vindo da configuração acima do repositório. Não foi criado `package.json`.
- Skyline no fallback e PDF de CV continuam fora desta alteração, conforme registrados no diagnóstico.

Capturas finais e resultados brutos foram preservados no diretório de artefatos da sessão, fora dos assets publicados do site.
