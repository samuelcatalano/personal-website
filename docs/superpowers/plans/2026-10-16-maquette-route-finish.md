# Acabamento da rota — Maquete arquitetônica, etapas 2–5

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender a direção visual aprovada no hero (maquete arquitetônica em pedra clara) às vistas restantes da rota, em etapas com revisão visual do usuário entre elas.

**Architecture:** Evoluir `palette` → `city.js` / `landmarks.js` / `signs.js` / `camera.js`, sem mudar contratos públicos (`createWorld`, `buildCity`, `buildLandmarks`, `createSigns`, `shotFor`). Uma paleta compartilhada (`js/world/palette.js`, pura, sem three) passa a ser a fonte única de cor. Um teste Node impede regressão de cor. Cada etapa termina num ponto de controle: capturas enviadas ao usuário e aceite antes da etapa seguinte.

**Tech Stack:** HTML/CSS, ES modules, three@0.169.0 por importmap, Node test runner, browser-harness (`tests/*.browser.py`).

**Spec:** `docs/superpowers/specs/2026-10-16-architectural-maquette-design.md`. O aceite visual da primeira cena foi dado pelo usuário no chat em 2026-10-16 ("I approve the visual direction of the first scene"). Contexto de continuidade: `docs/codex/2026-10-16-claude-handoff.md`.

## Global Constraints

- Sem build, npm, dependências novas, modelos externos, pós-processamento, push ou deploy.
- `three@0.169.0` (`three.module.min.js`). Todo texto visível em `js/content.js`, EN e PT-BR.
- Paleta da spec: marfim `#e8e0d2`, pedra `#c9bdaa`, taupe `#8e8375`; ônibus `#c9252b`, na mesma escala da frota (≈11 × 4,6 × 2,5 m). Nunca escalar o ônibus nem a figura para dar destaque.
- Hex sempre minúsculo: o regex de CEP do teste de privacidade só casa maiúsculas.
- Em `createBoxes`/`buildMeshes`, Y é a base da caixa. Não mudar essa convenção.
- Cores de glow em `scene.js` (`'#e8d7b3', '#ffd86b', '#fff7c2'`) devem continuar iguais aos valores emissivos.
- A London Eye está aprovada: não alterar `londonEye()`.
- Preservar o painel HTML, as 7 seções, as 10 experiências, hashes, teclado, idioma/tema, fallback sem WebGL, `prefers-reduced-motion` sem frames ociosos, pausa com aba oculta e privacidade.
- Metas: JS próprio < 60.000 bytes (**hoje 64.960, já acima**), < 150 draw calls, < 60 mil instâncias. Não relatar uma meta como resultado sem medir.
- Modelos: Opus 5.5 orquestra e revisa, Sonnet 5.5 implementa um módulo por tarefa, Haiku 5.5 faz tarefas mecânicas. Nunca dois agentes no mesmo arquivo.
- Servidor de preview do controlador na porta 8000. Implementadores usam 8001 e nunca matam processos alheios.

## Review Focus

1. **Recolorir quebra testes que fixam cores antigas:** `tests/landmarks.browser.py` seleciona caixas por `#d8c08a`/`#6b8fb5`. A Tarefa 1 atualiza esses seletores junto com a mudança.
2. **Heathrow reposicionado não pode invadir a rua, as calçadas nem a margem do Tâmisa.** O novo bloco fica entre z(rua)−8,75 e `RIVER_Z+13,1`. Há um teste browser na Tarefa 1.
3. **Maquette em todas as paradas não pode estourar o orçamento:** medir draw calls e instâncias na Tarefa 2 e manter < 150 / < 60 mil.
4. **Elevar a câmera nos marcos não pode alterar as tomadas sem marco.** Com `lift=0`, o resultado de `shotFor('follow')` é idêntico ao atual. Há um teste Node na Tarefa 4.
5. **Brasil continua legível** (palmeiras e varandas) com o acabamento maquette. O `br` passa a valer para paradas brasileiras a partir do índice 2, enquanto o hero continua lendo-se como Londres (Tarefa 2).

---

## Etapa 2 — Paleta e marcos (ponto de controle A)

### Task 1: Paleta compartilhada e marcos recoloridos

**Files:**
- Create: `js/world/palette.js`, `tests/palette.test.mjs`
- Modify: `js/world/city.js:1-8`, `js/world/landmarks.js:1-5` e as funções `wembley`, `heathrow` e `plane`
- Modify: `tests/landmarks.browser.py` (seletores de cor e checagem de Heathrow)

**Interfaces:**
- Produces: `PALETTE` (objeto de hex minúsculos) em `js/world/palette.js`, sem import de three.
- Mantém `buildCity` e `buildLandmarks` com as mesmas assinaturas e o mesmo retorno `{ eye, details, plane, planeAt }`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/palette.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../js/world/palette.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('palette values are lowercase #rrggbb', () => {
  for (const [k, v] of Object.entries(PALETTE)) assert.match(v, /^#[0-9a-f]{6}$/, k);
});

// Cores fora da paleta só são permitidas onde já foram aprovadas: London Eye (cápsulas),
// mostrador do relógio (canvas) e duas variações de parede da cidade.
const APPROVED = new Set(['#bfe3ff', '#f4f0e2', '#4d4030', '#6d604b', '#493d30', '#392d24', '#d8d0c2', '#bdb3a4']);

test('landmarks and city only use palette or approved colours', () => {
  const allowed = new Set([...Object.values(PALETTE), ...APPROVED]);
  for (const f of ['js/world/landmarks.js', 'js/world/city.js']) {
    const used = readFileSync(join(root, f), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    for (const c of used) assert.ok(allowed.has(c.toLowerCase()), `${f} uses off-palette ${c}`);
  }
});
```

- [ ] **Step 2: Rodar e confirmar a falha.** `node --test tests/` falha com `Cannot find module '.../js/world/palette.js'`.

- [ ] **Step 3: Criar `js/world/palette.js`**

```js
// Shared maquette palette (spec 2026-10-16). Lowercase hex: the privacy test's postcode pattern is uppercase-only.
export const PALETTE = {
  cream: '#e8e0d2', stone: '#c9bdaa', taupe: '#8e8375', roof: '#6b655e',
  grass: '#899282', patch: '#7b8676', road: '#45484b', glass: '#a9bec3', lit: '#e8d7b3',
  leaf: '#788572', trunk: '#786b5d', red: '#c9252b',
  gilt: '#b39a64', steel: '#7f8b91', ink: '#46505b', white: '#f4f1ea',
};
```

- [ ] **Step 4: `js/world/city.js` lê a paleta (mesmos valores; nenhuma mudança visual).** Substituir as linhas 3–8 por:

```js
import { PALETTE as P } from './palette.js';

const GRASS = P.grass, PATCH = P.patch, ROAD = P.road, LINE = P.cream;
const BANK = P.taupe, PATH = P.stone, STONE = P.stone, CREAM = P.cream;
const UK_WALLS = [CREAM, '#d8d0c2', P.stone];
const BR_WALLS = [P.stone, '#d8d0c2', '#bdb3a4'];
const ROOF = P.roof, GLASS = P.glass, WINDOW_LIT = P.lit;
const TRUNK = P.trunk, LEAF = P.leaf, LEAF_SHADE = P.grass, PHONE = P.red;
```

- [ ] **Step 5: Recolorir os marcos em `js/world/landmarks.js`.**
  - Substituir a linha 5 por:

```js
import { PALETTE as P } from './palette.js';

const STONE = P.stone, SLATE = P.roof, WHITE = P.white, GOLD = P.gilt, STEEL = P.steel;
```

  - Em `wembley()`, trocar `'#c7c9cc'` por `P.cream` e `'#4c9a4c'` por `P.patch`.
  - Em `plane()`, trocar `'#d0d4da'` (duas vezes) por `P.stone` e `'#1e3a8a'` por `P.ink`.
  - Substituir `heathrow()` inteira. Ela passa para o lado distante, entre a rua e a margem, sem bloquear o primeiro plano:

```js
function heathrow(add, { x }) {
  // Far-side arrival vignette between the street (z ≥ RIVER_Z + 24) and the Thames bank (z ≤ RIVER_Z + 13).
  const rz = RIVER_Z + 20.5, tz = RIVER_Z + 15.5;
  add(x, -0.15, rz, 24, 0.2, 6, P.road);                                         // runway
  for (let i = -10; i <= 10; i += 4) add(x + i, 0.05, rz, 2, 0.06, 0.4, P.cream);  // centreline
  add(x - 4, 0, tz, 14, 4, 4, P.stone);                                           // terminal
  add(x - 4, 1, tz + 2.05, 13, 2.4, 0.1, P.glass);                                // glazed front
  add(x - 4, 4, tz, 14.6, 0.35, 4.6, P.roof);                                     // roof slab
  add(x + 9, 0, tz, 1.6, 9, 1.6, P.stone);                                        // control tower
  add(x + 9, 9, tz, 3.2, 1.8, 3.2, P.glass);
  add(x + 9, 10.8, tz, 3.6, 0.3, 3.6, P.roof);
}
```

  - A chamada em `buildLandmarks` (`heathrow(add, at(stops, pts, 'heathrow'))`) não muda.

- [ ] **Step 6: Atualizar `tests/landmarks.browser.py`.**
  - Trocar `'#d8c08a'` por `'#c9bdaa'` (linha 30), `'#6b8fb5'` por `'#7f8b91'` (linhas 38, 40 e 41) e `'#2f3b45'` por `'#6b655e'` (linha 43), e a frase `blue outer road railings` por `steel outer road railings`. Depois, `grep -n "d8c08a\|6b8fb5\|2f3b45" tests/` não deve imprimir nada.
  - Acrescentar antes do `print` final:

```python
  // Heathrow stays on the far side, clear of the street band and the Thames bank.
  const hIdx = stops.findIndex(stop => stop.id === 'millimetric'), hx = pts[hIdx].x, hz = pts[hIdx].z;
  const heathrow = boxes.filter(b => Math.abs(b.x - hx) <= 13 && b.z < hz - 5 && b.z > RIVER_Z + 10);
  check(heathrow.length >= 8, `Heathrow vignette missing near x=${hx}`);
  check(heathrow.every(b => b.z + b.d / 2 <= hz - 8.75 && b.z - b.d / 2 >= RIVER_Z + 13.1),
    'Heathrow must sit between the far sidewalk and the Thames bank');
```

  (Use o mesmo estilo de indentação e as variáveis `boxes`, `stops`, `pts`, `RIVER_Z` e `check` já definidos no script.)

- [ ] **Step 7: Rodar.** `node --test tests/` deve passar (24 + 2 = 26). Com o preview em `http://localhost:8001`, rodar `browser-harness < tests/landmarks.browser.py` e depois `browser-harness < tests/world.browser.py`, que devem passar. Se `hz − 8.75` colidir com `RIVER_Z + 20.5 + 3` na geometria real, reportar os números em vez de ajustar sozinho.

- [ ] **Step 8: Commit.**

```bash
git add js/world/palette.js tests/palette.test.mjs js/world/city.js js/world/landmarks.js tests/landmarks.browser.py
git commit -m "feat: shared maquette palette and recoloured landmarks"
```

- [ ] **Ponto de controle A (controlador):** capturar desktop 1350×940 nas paradas 2020 (Heathrow), xDesign (Big Ben), Tribal (Tower Bridge) e contact (Wembley), de dia e de noite. Enviar ao usuário e aguardar aceite antes da Etapa 3.

---

## Etapa 3 — Tecido urbano e placas (ponto de controle B)

### Task 2: Acabamento maquette em todas as paradas

**Files:** Modify `js/world/city.js` (`townhouse`, laço `pts.forEach`).

**Interfaces:** `buildCity(add, stops, pts, curve)` inalterada.

- [ ] **Step 1: Aplicar o acabamento a todas as paradas, mantendo o caráter brasileiro.** Em `buildCity`, substituir:

```js
    const maquette = i < 2, br = stops[i].country === 'BR' && !maquette;
```

  por:

```js
    // Every stop gets the maquette finish; Brazilian stops after the hero keep palms and balconies.
    const maquette = true, br = stops[i].country === 'BR' && i >= 2;
```

- [ ] **Step 2: Telhados vistos de cima ganham chaminés no lado da câmera.** Em `townhouse`, logo após a linha `if (!br && r() < 0.5) add(...)` (chaminé atual), acrescentar:

```js
  if (maquette && side === 1) {
    // The follow camera looks down on near-side roofs: paired stacks and a parapet keep them from reading as plain slabs.
    for (const dx of [-w / 2 + 1.2, w / 2 - 1.2]) {
      add(x + dx, h + 0.74, z, 0.9, 1.1, 0.7, BANK);
      add(x + dx, h + 1.84, z, 0.3, 0.35, 0.3, ROOF);
    }
    add(x, h + 0.74, z - side * (d * 0.36 - 0.12), w * 0.74, 0.28, 0.16, CREAM);
  }
```

- [ ] **Step 3: Medir.**
  - `node --test tests/` deve passar.
  - `browser-harness < tests/city.browser.py` e `browser-harness < tests/world.browser.py` devem passar. Se `city.browser.py` assumir `maquette` só nas duas primeiras paradas, reportar a asserção exata ao controlador; não editá-la sem decisão dele.
  - Medir draw calls e instâncias por frame com o mesmo método do relatório `docs/codex/2026-10-16-maquette-milestone-validation.md` (WebGL API sampler temporário, desktop 1350×940, DPR 1,5) e registrar os números no relatório da tarefa. Ambos devem ficar abaixo de 150 e de 60 mil.

- [ ] **Step 4: Commit.**

```bash
git add js/world/city.js
git commit -m "feat: extend maquette terrace finish along the whole route"
```

### Task 3: Placas de empresa em estilo editorial

**Files:** Modify `js/world/signs.js` (adicionar `paintPlaque`; trocar a pintura das placas de empresa).

**Interfaces:**
- `createSigns(scene, { stops, curve })` inalterada.
- Novo `paintPlaque(text, color) → THREE.CanvasTexture`.

- [ ] **Step 1: Acrescentar abaixo de `paintSign`:**

```js
// Ivory plaque with the brand colour as ink and a thin rule: the editorial counterpart of the panel badges.
export function paintPlaque(text, color, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8e8375'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#f8f6f1'; g.fillRect(4, 4, size - 8, size - 8);
  g.fillStyle = color; g.fillRect(14, size - 26, size - 28, 6);
  g.fillStyle = color;
  g.font = `600 ${Math.round(size * (text.length > 2 ? 0.3 : 0.38))}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, size / 2, size / 2 - 6);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

- [ ] **Step 2: Usá-la.** Em `createSigns`, trocar `paintSign(s.brand.initials, { bg: s.brand.color, w: 128, h: 128 })` por `paintPlaque(s.brand.initials, s.brand.color)`.

- [ ] **Step 3: Rodar** `node --check js/world/signs.js`, `node --test tests/` e `browser-harness < tests/world.browser.py`. Commit:

```bash
git add js/world/signs.js
git commit -m "feat: editorial ivory plaques for company monograms"
```

- [ ] **Ponto de controle B (controlador):** capturar desktop e 375 px nas paradas 2012 (Brasil), 2017, 2020 e 2021, de dia e de noite. Enviar ao usuário e aguardar aceite antes da Etapa 4.

---

## Etapa 4 — Enquadramento dos marcos altos (ponto de controle C)

### Task 4: Câmera eleva-se onde há marco alto

**Files:**
- Modify: `js/world/layout.js` (constante `FRAME_LIFT`), `js/world/camera.js` (`shotFor`, caso `follow`), `js/world/scene.js:124-126`
- Modify: `tests/logic.test.mjs` (dois testes novos)

**Interfaces:**
- `shotFor(kind, bus, { mobile, lift = 0 })`. Com `lift = 0`, o resultado é idêntico ao atual.
- `FRAME_LIFT: Record<stopId, 0..1>`.

- [ ] **Step 1: Escrever os testes que falham** (anexar a `tests/logic.test.mjs`):

```js
import { FRAME_LIFT } from '../js/world/layout.js';

test('follow shot is unchanged without lift', () => {
  const bus = { x: 5, y: 0, z: -3 };
  assert.deepEqual(shotFor('follow', bus, { mobile: false, lift: 0 }), shotFor('follow', bus, { mobile: false }));
});

test('lift raises the aim and pulls the camera back for tall landmarks', () => {
  const bus = { x: 0, y: 0, z: 0 };
  const flat = shotFor('follow', bus, { mobile: false }), tall = shotFor('follow', bus, { mobile: false, lift: 1 });
  assert.ok(tall.target[1] >= flat.target[1] + 8);
  assert.ok(Math.hypot(...tall.position) > Math.hypot(...flat.position));
  for (const v of Object.values(FRAME_LIFT)) assert.ok(v > 0 && v <= 1);
});
```

- [ ] **Step 2: Rodar e confirmar a falha.** `node --test tests/` falha com `FRAME_LIFT` não exportado.

- [ ] **Step 3: Em `js/world/layout.js`, acrescentar depois de `LANDMARKS`:**

```js
// How much the follow camera rises at stops whose landmark would otherwise be cropped (0 = street shot).
export const FRAME_LIFT = { xdesign: 1, olm: 0.6, tribal: 1 };
```

- [ ] **Step 4: Em `js/world/camera.js`:**
  - Mudar a assinatura para `export function shotFor(kind, bus, { mobile = false, lift = 0 }) {`.
  - Substituir o caso `follow` por:

```js
    case 'follow': {
      const L = lift; // 0 keeps the approved street framing exactly
      return {
        position: [x + (20 + 6 * L) * k, y + (29 + 10 * L) * k, z + (50 + 14 * L) * k],
        target: [x + 2, y + 5 + 9 * L, z + 2 - 10 * L],
      };
    }
```

- [ ] **Step 5: Em `js/world/scene.js`.**
  - Acrescentar `FRAME_LIFT` ao import de `./layout.js`.
  - Substituir as linhas 125–126:

```js
    const view = { mobile };
    const shot = blendShots(shotFor(ka, busPos, view), shotFor(kb, busPos, view), s - i, ka === kb ? 0 : ARC);
```

    por:

```js
    const la = FRAME_LIFT[stops[i].id] ?? 0, lb = FRAME_LIFT[stops[i + 1].id] ?? 0;
    const lift = la + (lb - la) * (s - i);
    const shot = blendShots(shotFor(ka, busPos, { mobile, lift }), shotFor(kb, busPos, { mobile, lift }), s - i, ka === kb ? 0 : ARC);
```

- [ ] **Step 6: Rodar** `node --test tests/` (todos passam) e `browser-harness < tests/world.browser.py`. Commit:

```bash
git add js/world/layout.js js/world/camera.js js/world/scene.js tests/logic.test.mjs
git commit -m "feat: lift follow camera to frame tall landmarks"
```

- [ ] **Ponto de controle C (controlador):** capturar desktop e 375 px em xDesign, OLM e Tribal. O topo de Big Ben, a Tower Bridge e a London Eye devem caber no quadro com o ônibus visível ao lado do painel. Enviar ao usuário e aguardar aceite.

---

## Etapa 5 — Orçamento e verificação final (controlador)

### Task 5: Orçamento de JS e verificação

**Files:** nenhum, salvo correções pontuais aprovadas.

- [ ] **Step 1: Medir JS próprio.** Rodar `wc -c js/*.js js/world/*.js | tail -1`. Se continuar acima de 60.000 bytes, listar as funções mais pesadas, sem minificar nem criar build. **Parar e pedir decisão ao usuário:** cortar código (com a lista do que sai) ou aceitar formalmente uma meta revisada na spec.
- [ ] **Step 2: Matriz.**
  - Desktop 1350×940 e 375×812, EN/PT, dia/noite, 10 experiências e 7 seções.
  - `#contact` direto, sem WebGL (CDN bloqueado), teclado.
  - `prefers-reduced-motion` com zero frames ociosos.
  - Rodar `tests/interface.browser.py`, `city`, `landmarks`, `world` e `figure`.
- [ ] **Step 3: Desempenho.**
  - Draw calls e instâncias com o mesmo sampler da Tarefa 2.
  - Lighthouse de acessibilidade ≥ 95.
  - Performance desktop só se houver ferramenta válida. Caso contrário, registrar a lacuna como no relatório anterior, sem score substituto.
- [ ] **Step 4:** Registrar evidências em `docs/codex/2026-10-16-route-finish-validation.md`, no mesmo formato do relatório do marco. Commit local sem push.
