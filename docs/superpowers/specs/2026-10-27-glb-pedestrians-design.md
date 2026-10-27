# Pedestres genéricos derivados dos quatro GLBs

Status: desenho aprovado em conversa em 2026-10-27; implementação autorizada com agentes, na branch atual por escolha do usuário.

## Intenção e escopo

Substituir a aparência dos pedestres genéricos por pessoas em 3D real derivadas dos quatro modelos fornecidos pelo usuário em `assets/glb/`: dois homens e duas mulheres. Preservar a modelagem reconhecível e criar variedade de roupas, cores de cabelo e penteados. Não recriar pessoas genéricas do zero nem converter os modelos em sprites como resultado final.

Preservar os 1.000 registros do plano atual, posições, alturas de piso, rotas, direções e velocidades. Preservar mapa, ônibus, veículos, arquitetura, iluminação, personagens especiais e conteúdo. População e diversidade continuam determinísticas; não consumir o RNG global da cidade. `prefers-reduced-motion` mantém todas as pessoas paradas. O HTML continua utilizável sem WebGL.

## Evidência atual

- `people.js` usa sprites instanciados e sombras, com `crowd.js` como fonte de posições e aparência. `scene.js` cria o sistema e chama `update(dt, camera.position)`. Existem testes de movimento, piso, redução de movimento e distância da via.
- Os quatro GLBs somam aproximadamente 115 MB e têm entre 219 mil e 301 mil triângulos cada. Cada arquivo tem três malhas, um material e quatro imagens PNG 2048×2048. Não há esqueleto, animação ou morph targets. As malhas não identificam cabelo/roupa como peças independentes.
- Blender 5.2.3 LTS está instalado, mas a primeira tentativa de importação em batch encerrou/crashou. Metadados indicam altura de aproximadamente 15,5–16,4 mil unidades, sem transforms nos nós; normalização e ferramenta de preparação ainda precisam ser verificadas. A etapa de assets começa resolvendo essa execução, sem instalar outra dependência automaticamente.
- Seus metadados indicam autor `restore50`, origem Sketchfab e CC-BY-4.0. O usuário pediu esses arquivos e confirmou o caminho após receber esse conflito com a regra geral do projeto. Tratar a autorização como exceção limitada a estes quatro arquivos; não buscar outros modelos no Sketchfab. Registrar fontes, licença e alterações nos derivados antes de entrega; verificar evidência da licença antes de publicação. A aprovação deste desenho não autoriza push/publicação.

## Abordagens

1. Clonar GLBs originais diretamente: preserva detalhe, mas multiplica malhas pesadas, não resolve caminhada nem penteados e transfere 115 MB. Rejeitada.
2. Gerar sprites a partir dos GLBs: reaproveita o renderizador atual, mas perde o 3D real solicitado. Rejeitada como resultado final.
3. Preparar cópias otimizadas em 3D, com regiões semânticas e caminhada, e integrar primeiro uma amostra: escolhida em conversa. Exige preparação de assets, mas mantém os quatro modelos como base e permite medir custo antes da expansão.

## Preparação dos assets

- Nunca sobrescrever os quatro originais. Derivados e preparação reproduzível ficam em `assets/people/` e `tools/people/`; os originais não são carregados pelo site.
- Normalizar orientação, origem nos pés e escala humana, mantendo proporções e detalhes reconhecíveis. Usar a ferramenta local disponível; nenhuma nova dependência sem autorização.
- Reduzir geometria/texturas com inspeção visual. Meta inicial proposta pelo coordenador: até 8 mil triângulos no nível próximo por pessoa e até 1 mil no nível distante; até 12 MiB de download total dos quatro derivados, contando texturas. São critérios de preparação, não autorização para degradar rostos ou silhuetas. Se forem incompatíveis com qualidade, registrar a medição e rever o desenho antes de expansão.
- Identificar regiões de roupa, cabelo e pele com máscaras/atributos semânticos. Mudar roupa e cabelo de forma independente, sem tingir rosto, mãos e calçados inadvertidamente. Preservar detalhes das texturas.
- Oferecer pelo menos três combinações de cores por base e dois penteados geometricamente distintos por base. Penteado deve mudar silhueta, não somente cor. Editar apenas regiões necessárias dos derivados; não presumir que as três malhas originais sejam peças intercambiáveis.
- Preparar ciclo de caminhada com braços/pernas em oposição e pés coerentes com deslocamento. Rig, pesos e técnica de deformação ficam a cargo do implementador após inspeção dos modelos. Não aceitar personagens rígidos deslizando, membros atravessando corpo ou corpo balançando inteiro como substituto de caminhada.

## Integração

- Preservar `crowdPlan` e extrair/reutilizar a lógica atual de posição quando necessário. Mudanças de aparência não alteram as trajetórias.
- Reaproveitar `GLTFLoader` da versão de Three.js já fixada, URLs relativas e padrão de carregamento/cache do projeto. Não adicionar engine, gerenciador de pacotes ou build do site.
- Compartilhar geometrias/texturas e materiais por combinação finita; evitar material/texture clone por pessoa. O implementador escolhe a representação animada compatível com esses requisitos e documenta seu custo.
- Manter culling e limitar trabalho ao entorno visível; LOD próximo/distante deve representar as mesmas bases, sem substituição por pessoas procedurais sem relação com os GLBs. Contagem lógica não significa renderizar as 1.000 pessoas simultaneamente.
- O sistema deve oferecer prontidão verificável. Falha de asset mantém fallback atual e não bloqueia conteúdo/site. Não deixar metade carregada, referências pendentes após teardown, nem recursos órfãos. Evitar sobreposição entre fallback e modelo adotado.
- A interface consumida por `scene.js` continua com `update(dt, camPos)` e contagem; atualizar consumidores/testes apenas quando exigido pela troca de representação. Asserções atuais específicas de sprites devem ser substituídas por contratos equivalentes de comportamento, não simplesmente removidas.

## Etapas e aceitação

1. Preparar os quatro derivados e demonstrar uma amostra de oito pessoas: cada base com dois penteados, cores de cabelo/roupa variadas e caminhada. Inspecionar perto e na escala real do site. Amostra é etapa de validação; a entrega final continua sendo o sistema genérico.
2. Verificar geometria, textura, carregamento, pés no piso, caminhada e variação independente. Preservar identidade visual das quatro bases. Só expandir após evidência satisfatória; falha exige correção, não rollout automático.
3. Integrar a população existente com diversidade determinística, LOD/culling e mesmos caminhos. Medir A/B com seed, câmera, tier, viewport e DPR iguais. Não contar redução automática de tier ou de população como ganho.
4. Para a amostra, executar testes relacionados e captura visual. Para expansão, executar regressão Node, testes de pedestres e matriz afetada: desktop/mobile 375px, dia/noite, EN/PT, WebGL desativado e movimento reduzido; console sem novos erros. Medir p95 em desktop e mobile emulado, com limites locais existentes de +1 ms/+2 ms contra baseline. Não prometer desempenho em celular físico sem teste real.

Revisão final inclui variedade legível, rostos/cabelos sem artefatos, caminhar sem deslizar e custo de carregamento/execução documentado. Não declarar GO com checks falhos ou não executados. Lighthouse apenas se a mudança afetar a interface HTML/acessibilidade.

## Arquivos previstos e exclusões

Área prevista: `js/world/people.js`, módulos pequenos de assets/animação quando necessários, ligação pontual em `scene.js`, testes de pedestres, derivados/scripts, `ASSET_SOURCES.md` e documentação técnica afetada. `crowd.js` mantém dados e comportamento salvo ajuste estritamente necessário de seleção visual. Toda nova cópia visível fica em `js/content.js`, EN/PT.

Fora de escopo: nova população, novos caminhos, interação, colisões, mudança de câmera/iluminação, roupas adicionais completas, compra/download de modelos, redesign do restante da cidade e publicação. Nenhum trabalho anterior guardado no stash/branch de segurança será reaplicado automaticamente.

## Decisões deixadas ao implementador

Algoritmo de simplificação, resolução final de texturas dentro do orçamento, máscaras por base, pesos do rig, compartilhamento de animação e limiares de LOD são decisões de implementação. Devem preservar os contratos acima e ser validadas visualmente, sem ampliar escopo. Se não houver ferramenta local para preparar os modelos, reportar a limitação antes de instalar dependências.
