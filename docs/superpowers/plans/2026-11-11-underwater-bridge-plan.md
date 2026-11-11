# Viaduto sob a água Implementation Plan

> Superseded by the owner request on 2026-11-11: both crossings stay at the 7.5 m arch crest through the far bank, with only the land entry and far-bank exit ramps. The owner explicitly approved 7.5 m to preserve bus clearance. Low emissive parapet lamps reuse the existing lamp system; no new dynamic lights or render passes. See `docs/audits/2026-11-11-river-bridges.md` for the implemented correction.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the execution method you listed) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nas pontes de arco de Londres e Glasgow, o viaduto continua além da extremidade e desce sob a água do rio; o trânsito some debaixo da água.

**Architecture:** O arco e a passagem do ônibus ficam como estão (são o gatilho da troca de libré). Um segmento novo, de perfil puro e testável, continua o tabuleiro sobre o rio e desce abaixo da superfície da água (y = 0.1). A água é opaca, então esconde o segmento sem corte nem camada nova. O tráfego do viaduto segue o mesmo perfil.

**Tech Stack:** three.js (geometria), Node `--test` (perfil puro), browser-harness (verificação visual e de estado).

**Spec:** Descrição aprovada em chat em 2026-11-11 (sumir sob a água; Estaiada de São Paulo intocada; Tower Bridge intocada). Correção a essa descrição: o arco e a passagem do ônibus NÃO saem, porque são o gatilho da troca; o que desce é o viaduto além da margem.

## Global Constraints

- Estaiada (São Paulo) e Tower Bridge: geometria e posição inalteradas.
- Ônibus, rota, paradas, mapa e disparo da troca (`archCross`, `underpass.passes`): inalterados.
- Sem dependência nova, sem build step, sem passe de renderização nem luz nova.
- Materiais e geometrias compartilhados; sem clone por ponte.
- Rio: `RIVER_Z = -45`, largura 22 m (`scene.js:247`), superfície `Y = 0.1` (`water.js:150`).
- Viaduto: `UNDERPASS.end = 33`, altura `H = 7.5` (`underpass.js:9`, `layout.js:6`).
- Preservar EN/PT, teclado, WebGL desligado e `prefers-reduced-motion`.
- Não commitar.

## Review Focus

1. Passagem que não encontra o rio: o viaduto termina no ar. Teste: o segmento só é criado quando a extremidade cai na faixa do rio.
2. Carro cruzando a borda da água: pop ou clipping. Teste: o trânsito fica sobre o tabuleiro ou o perfil, sem salto de altura.
3. Ônibus sob o arco: a troca continua disparando. Teste: as varreduras rápida e lenta de troca dão os mesmos números de antes.
4. Perfil no ponto de junção (|az| = 33): salto de altura. Teste: continuidade de `y` e de inclinação na junção.
5. Mobile 375 px sem regressão (desviado por enquanto). Teste: adiado; registrar como pendência.

---

### Task 1: Levantamento: qual passagem encontra o rio

**Files:**
- Modify: `js/world/scene.js` (sonda QA `__qaUnderpass`, só com `?qa`)
- Test: nenhum arquivo novo; script de sonda em `scratchpad/`

**Interfaces:**
- Consumes: `underpass.passes` (`{ t, tc, x, z, tx, tz, half }`, de `underpass.js`); `RIVER_Z`, `riverStart`, `riverEnd` (`layout.js`).
- Produces: `globalThis.__qaUnderpass` com a lista de passagens. Tarefas 2 e 3 usam o resultado: `riverPasses` (índices).

- [ ] **Step 1: Expor as passagens em modo QA**

Em `scene.js`, logo após `const underpass = createUnderpass(...)`: `if (qa) globalThis.__qaUnderpass = underpass.passes;`

- [ ] **Step 2: Sondar, para cada passagem, a extremidade em |az| = 33**

Para cada passagem, calcular o ponto da extremidade (centro + 33 m ao longo do eixo transversal) e registrar `x`, `z`, e se `z` cai em `[RIVER_Z - 11, RIVER_Z + 11]` e `x` em `[riverStart, riverEnd]`.
Expected: uma lista com os índices que encontram o rio. Se nenhuma encontrar, parar e voltar ao usuário.

- [ ] **Step 3: Registrar `riverPasses` na tarefa**

Anotar os índices na descrição de Task 2 antes de seguir. Não há commit.

---

### Task 2: Perfil puro do segmento sob a água

**Files:**
- Create: `js/world/underwater-profile.js` (sem import de three)
- Test: `tests/underwater-profile.test.mjs`

**Interfaces:**
- Consumes: nada (puro).
- Produces: `export function riverProfile(az: number): number` (altura em metros; `az` em metros a partir do centro do viaduto, com `az` ≥ 33), e `export const RIVER_EDGE = 33`, `export const RIVER_DEPTH = 2.4`.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riverProfile, RIVER_EDGE } from '../js/world/underwater-profile.js';
test('the viaduct meets the bank at 0 m and dips below the water surface', () => {
  assert.equal(riverProfile(RIVER_EDGE), 0);
  assert.ok(riverProfile(RIVER_EDGE + 12) < 0.1 - 1);
});
test('the profile is continuous and monotone across the bank', () => {
  let prev = riverProfile(RIVER_EDGE);
  for (let az = RIVER_EDGE + 0.5; az <= RIVER_EDGE + 24; az += 0.5) {
    const y = riverProfile(az);
    assert.ok(y <= prev + 1e-9 && prev - y < 0.6, `step at ${az}`);
    prev = y;
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/underwater-profile.test.mjs`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `riverProfile`**

Rampa suave de 0 em `RIVER_EDGE` até `-RIVER_DEPTH` na margem oposta, com derivada zero na junção (smoothstep), mesmo padrão de `crest` em `underpass.js:16`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/underwater-profile.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Não commitar (regra do projeto).

---

### Task 3: Geometria do viaduto sob a água

**Files:**
- Modify: `js/world/underpass.js` (segmento por passagem em `riverPasses`)
- Modify: `js/world/underpass-traffic.js:14` (`y` do tráfego usa `riverProfile` além da borda)

**Interfaces:**
- Consumes: `riverPasses` (Task 1); `riverProfile`, `RIVER_EDGE` (Task 2); `crest`, `ROAD_HW`, `UNDERPASS` (`underpass.js`).
- Produces: `underpass.group` contém, por passagem em `riverPasses`, um grupo `underpass-river-<i>` com malhas `stone`/`road` compartilhadas.

- [ ] **Step 1: Teste de integração (browser) que falha**

Sonda: para cada passagem em `riverPasses`, a altura do segmento em `az = 40` é menor que `0.1 - 1` e a inclinação na junção não salta mais que `0.6`.

- [ ] **Step 2: Rodar e ver falhar** (sem o grupo, a altura não existe)

- [ ] **Step 3: Implementar**

Gerar a malha com `riverProfile` ao longo de `az` de `RIVER_EDGE` a `RIVER_EDGE + 24` e largura `2 * ROAD_HW`; mats `road` e `stone` já existentes. Só nos índices de `riverPasses`.

- [ ] **Step 4: Rodar e ver passar**

Run: sonda da Task 3 no browser; `node --test tests/` sem regressão.
Expected: PASS; 225/225 (ou mais, com os testes novos).

---

### Task 4: Verificação visual e da troca

**Files:** nenhum arquivo de código.

- [ ] **Step 1: Capturas antes/depois, desktop, dia e noite, Londres e Glasgow**

Usar `tools/capture.py` com a interface visível (copiar sem o `hide`, como em `scratchpad/capture_ui.py`).
Expected: a pista some sob a água no viaduto; o arco e a passagem do ônibus continuam.

- [ ] **Step 2: Varreduras de troca (lenta 0,0015 e rápida 0,02)**

Run: `probe_swap.py` antes e depois.
Expected: os números de atraso são os mesmos da correção anterior (lenta: 5 frames; rápida: 6); nenhum frame sem veículo visível.

- [ ] **Step 3: Erros de console**

Expected: nenhum erro novo em desktop.

---

### Task 5: Limites e entrega

- [ ] **Step 1:** Registrar em `docs/architecture/3d-city.md` o que mudou (viaduto sob a água em Londres/Glasgow), com o que não foi testado (mobile, hardware real).
- [ ] **Step 2:** Entregar com capturas, testes e a correção da descrição aprovada.

---

## Self-Review

- Cobertura: sumir sob a água (Tarefas 2–3), passagem certa (Tarefa 1), troca preservada (Tarefa 4), Estaiada e Tower Bridge fora (Global Constraints).
- Tipos: `riverProfile(az)`, `RIVER_EDGE`, `RIVER_DEPTH` usados igual em Tarefas 2 e 3.
- Pendência: Tarefa 1 pode mostrar que só uma passagem encontra o rio. Se for assim, o escopo cai para uma ponte e a Glasgow fica como pendência.
