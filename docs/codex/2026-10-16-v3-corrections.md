# Correções visuais v3

Data: 2026-10-16. Branch `feat/london-bus`; alterações locais, sem commit ou push.

## Feedback e ajustes

O feedback posterior às capturas apontou proporções incoerentes, tráfego sobreposto e acabamento gráfico ainda pouco controlado. O ônibus principal e os veículos de ambiente agora compartilham a mesma frota voxel: ônibus com cerca de 11,08 × 4,6 × 2,55 m, rodas no chão e avatar ajustado à janela superior. Os táxis medem cerca de 4,3 × 1,7 × 1,8 m.

- Tráfego reduzido a quatro veículos, em faixas centradas em ±1,75 m numa pista de 8,5 m. Ônibus e táxi seguem o progresso do ônibus principal com intervalos de −0,16 e +0,22 da rota; dois táxis circulam na faixa oposta, à mesma velocidade e separados por meia rota. O módulo positivo mantém o ciclo após longos períodos.
- A placa do ano foi reposicionada para 6,8 m acima do ônibus. A resolução de renderização passou a viewport/2 no desktop e viewport/1,5 no mobile.
- Sombras usam PCFSoftShadowMap, `bias` −0,0002 e `normalBias` 0,05 para reduzir acne sem remover sombras de contato.
- A rota acompanha o progresso de rolagem linear; as transições de enquadramento usam easing. Câmera follow: y+24k/z+58k, alvo y+5; closing: y+18k, alvo y+10. A cidade ganhou sobrados com frentes e vãos de fachada mais coerentes, variação de recuo e espaço livre no enquadramento final.

## Verificação e limites

- `node --test tests/`: 23/23 passaram; checagens de sintaxe e `git diff --check` passaram. Node ainda emite avisos preexistentes de tipo de módulo.
- `tests/world.browser.py` e `tests/vehicles.browser.py` passaram. Vinte amostras limitadas de tempo/progresso mantiveram os dois veículos reversos visíveis e espaçados, e as dimensões do ônibus de tráfego coincidiram com as do principal. As dez poses da jornada foram verificadas visualmente no desktop e a 375 px.
- Amostra QA de iteração a 1350×940, 90 frames, antes do ajuste final da câmera: mediana 8,3 ms, p95 10,6 ms, máximo 11,7 ms e máximo de 122 comandos GL (<150). É uma amostra de iteração, não um benchmark desktop final. JavaScript próprio: aproximadamente 51,7 KB.
- Os testes cobrem as amostras de rota indicadas; não constituem prova exaustiva contra todas as colisões possíveis.
- Lighthouse não forneceu FCP/LCP/TBT suficientes para validar a meta de performance ≥80. Não houve teste em aparelho físico.

O documento [polish-validation](2026-10-16-polish-validation.md) é histórico: a pausa de 8% por trecho foi substituída pelo mapeamento linear da rota.
