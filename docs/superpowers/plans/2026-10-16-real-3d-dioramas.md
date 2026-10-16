# Dioramas com modelos 3D reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a cidade procedural por dioramas com modelos 3D reais (São Paulo → Heathrow → Westminster → Tower Bridge → estrada → Wembley), mantendo painel, navegação, scroll e contratos de runtime.

**Architecture:**
- Um manifesto puro (`js/world/models.js`) descreve cada GLB otimizado: arquivo, altura-alvo e crédito.
- `js/world/layout.js` passa a descrever a rota reta e os capítulos (paradas, rio, posicionamento de modelos).
- `js/world/loader.js` carrega e normaliza os GLBs com o `GLTFLoader` do three.
- `js/world/dioramas.js` monta bases, estrada, rios e modelos, carregando o capítulo atual e o seguinte.
- `scene.js` mantém o contrato `createWorld → { setProgress, jump, setTheme, dispose }`.

**Tech Stack:** HTML/CSS/ES modules, `three@0.169.0` + `three/addons` (GLTFLoader) via importmap, `@gltf-transform/cli` só em desenvolvimento (npx), Node test runner e browser-harness.

**Spec:** `docs/superpowers/specs/2026-10-16-real-3d-dioramas-design.md`, aprovada pelo usuário em 2026-10-16. Os requisitos preservados estão em `CLAUDE.md`, `docs/PRD.md` e `docs/TRD.md`.

## Global Constraints

- Sem build no site e sem `package.json`. `@gltf-transform/cli` roda só por `npx` em desenvolvimento.
- Importmap fixado: `three` em `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js` e `three/addons/` em `https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/`.
- Sem Draco, meshopt nem KTX2. Quantização (`KHR_mesh_quantization`) e WebP (`EXT_texture_webp`) são permitidos, porque o GLTFLoader e o navegador os decodificam sem módulo extra.
- Orçamento de assets:
  - até 1,5 MB por GLB;
  - até 8 MB no total;
  - menos de 150 draw calls e menos de 300 mil triângulos visíveis por frame.
- Orçamento de código JS próprio, sem three e sem o texto de `js/content.js`: menos de 60.000 bytes.
- Licenças permitidas: `CC Attribution`, `CC0 Public Domain` e o pacote de props declarado CC0 pelo autor. Nada CC-BY-SA, NonCommercial ou "Free Standard".
- Todo texto visível fica em `js/content.js`, em EN e PT-BR. Hex sempre minúsculo.
- Nunca publicar endereço ou telefone; o teste de privacidade varre os arquivos servidos.
- Escalas: ônibus de cerca de 11 m e figura Memoji de 2,2 m. Não exagerar.
- WebGL opcional (`no-webgl`). Movimento reduzido sem animação ociosa. Pausa com a aba oculta.
- Os originais baixados ficam em `assets/models/source/`, ignorado pelo git.
- Commits locais sem push. Implementadores nunca usam a porta 8000 nem rodam browser-harness: o controlador roda as suítes de browser.
- Modelos: Opus 5.5 orquestra e revisa, Sonnet 5.5 implementa, Haiku 5.5 faz tarefas mecânicas.

## Review Focus

1. **Um GLB que falha** (404 ou corrompido) não pode quebrar o mundo: o diorama mostra só a base e há um `console.warn`. Teste browser na Tarefa 3 (rejeição) e na Tarefa 5 (cena continua renderizando).
2. **Primeira carga:** o painel e o hero aparecem antes dos modelos pesados, e a câmera não espera downloads. Só São Paulo e o ônibus são carregados no início (Tarefa 5).
3. **Saltar direto para `#contact`:** Wembley precisa carregar mesmo pulando todos os capítulos intermediários. O carregamento acompanha o capítulo ativo, não a ordem (Tarefa 5).
4. **Modelos com pivô ou escala arbitrários** (Sketchfab costuma exportar em cm ou com o pivô fora da base). A normalização usa a bounding box: altura-alvo, base em y = 0, centro em x/z (Tarefa 3).
5. **Créditos completos e corretos:** cada arquivo publicado tem título, autor, licença e URL na seção Contact, em EN e PT (Tarefas 1 e 6).

---

## Mapa de arquivos

```
.gitignore                      + assets/models/source/                       (Task 0)
assets/models/source/*.glb      originais baixados pelo usuário (fora do git) (Task 0)
js/world/models.js              NEW manifesto + créditos (puro)               (Task 1)
tools/model-credits.mjs         NEW preenche créditos via API pública         (Task 1)
js/content.js, js/ui.js         rótulos e lista de créditos no Contact        (Task 1)
tools/optimize-models.sh        NEW otimização com gltf-transform (dev)       (Task 2)
assets/models/*.glb             GLBs otimizados (versionados)                 (Task 2)
index.html                      importmap three/addons                        (Task 3)
js/world/loader.js              NEW loadModel(id) normalizado                 (Task 3)
js/world/layout.js              rota reta + CHAPTERS + FRAME_LIFT             (Task 4)
js/world/camera.js              lift mais alto para marcos reais              (Task 4)
js/world/dioramas.js            NEW bases, estrada, rios, modelos, lazy load  (Task 5)
js/world/scene.js               integra dioramas, ônibus e avião reais        (Task 5)
js/world/ambient.js             tráfego com modelos reais                     (Task 6)
remove: city.js landmarks.js bus.js voxel.js palette.js + testes obsoletos    (Task 6)
tests/models.test.mjs           NEW manifesto, créditos, arquivos, tamanhos   (Tasks 1–2)
tests/models.browser.py         NEW carga e escala de cada GLB                (Task 3)
tests/dioramas.browser.py       NEW cena, falha de GLB, salto para Wembley    (Task 5)
```

---

## Etapa A — Modelos

### Task 0: Download dos modelos (usuário) e preparo

**Files:**
- Modify: `.gitignore`
- Create: `assets/models/source/` (local)

- [ ] **Step 1 (controlador):** acrescentar ao `.gitignore` a linha `assets/models/source/`. Criar a pasta com `mkdir -p assets/models/source`. Fazer commit:

```bash
git add .gitignore
git commit -m "chore: ignore raw downloaded 3D model sources"
```

- [ ] **Step 2 (usuário): baixar cada modelo em formato GLB.** Na página do modelo, clicar em **Download 3D Model → "glb" (Autoconverted format)** e salvar com o nome exato abaixo em `assets/models/source/`.

| Salvar como | Modelo | Link |
|---|---|---|
| `bigben.glb` | Big Ben | https://sketchfab.com/models/b5f82ba2e3614be2a69755a2a613579a |
| `londoneye.glb` | London eye | https://sketchfab.com/models/74eaf18882314264b474861d564fca36 |
| `towerbridge.glb` | London Tower Bridge | https://sketchfab.com/models/0021ac55a9d54c13b655a2ed430d01f6 |
| `wembley.glb` | WEMBLEY_MKIV | https://sketchfab.com/models/fd20346281d04e0c8b62b8d2354b936e |
| `bus.glb` | Low Detail London Bus | https://sketchfab.com/models/b809e5698e3444a3b62bb58654caac75 |
| `london-props.glb` | london_mobile_game_assets (CC0) | https://sketchfab.com/models/815ca9e4e85844d6b702cb65ebc7dac8 |
| `masp.glb` | MASP (simplificado) | https://sketchfab.com/models/7eb9d1c77f9b43b088128fc5baa249bb |
| `se.glb` | Catedral da Sé de São Paulo | https://sketchfab.com/models/a2e7c359bdbf4a4682dd165a2397fb36 |
| `estaiada.glb` | Ponte Octavio Frias de Oliveira — Estaiada | https://sketchfab.com/models/be0e5bf3b1c34e4da38d4b1a9a47d3f9 |
| `heathrow.glb` | London heathrow [LHR] | https://sketchfab.com/models/1fed3793e2f94d6c9b22805b568119d1 |
| `plane.glb` | Low-poly Airplane | https://sketchfab.com/models/65cc7c4349174f7bbb20ed70206377b5 |

Se algum principal não servir, use a alternativa da spec com o mesmo nome de arquivo e avise qual UID usou.

- [ ] **Step 3 (controlador):** conferir os 11 arquivos com `ls -la assets/models/source/`. Para cada um, `npx -y @gltf-transform/cli@4 inspect assets/models/source/<id>.glb | head -40` deve abrir sem erro. Registrar no ledger o UID usado por arquivo.

### Task 1: Manifesto, metadados de crédito e créditos no Contact

**Files:**
- Create: `js/world/models.js`, `tools/model-credits.mjs`, `tests/models.test.mjs`
- Modify: `js/content.js` (rótulos), `js/ui.js` (lista no Contact)

**Interfaces:**
- Produces: `MODELS: Array<{ id, file, chapter, height, node?, credit: { title, author, license, url } }>`, `ALLOWED_LICENSES: string[]` e `creditsFor(): Array<credit>` (sem duplicar arquivos, na ordem do manifesto).

- [ ] **Step 1: Escrever o teste que falha** — `tests/models.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, ALLOWED_LICENSES, creditsFor } from '../js/world/models.js';

test('manifest ids are unique and complete', () => {
  assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length);
  for (const m of MODELS) {
    assert.match(m.file, /^[a-z0-9-]+\.glb$/, m.id);
    assert.ok(m.height > 0, m.id);
    for (const k of ['title', 'author', 'license', 'url']) assert.ok(m.credit?.[k], `${m.id} credit.${k}`);
    assert.ok(ALLOWED_LICENSES.includes(m.credit.license), `${m.id} license ${m.credit.license}`);
    assert.match(m.credit.url, /^https:\/\/sketchfab\.com\/3d-models\//, m.id);
  }
});

test('credits list each published file once', () => {
  const files = new Set(MODELS.map((m) => m.file));
  assert.equal(creditsFor().length, files.size);
});

test('bus and figure scales stay human', () => {
  assert.ok(Math.abs(MODELS.find((m) => m.id === 'bus').height - 4.6) < 0.01);
});
```

- [ ] **Step 2:** rodar `node --test tests/`. Deve falhar com `Cannot find module '.../js/world/models.js'`.

- [ ] **Step 3: Criar `js/world/models.js`.** Os campos `credit` vêm do Step 4. Escrever primeiro com `uid` e preencher depois:

```js
// Optimised 3D models (assets/models/*.glb). Heights are target scene heights in metres (stylised, consistent per diorama).
export const ALLOWED_LICENSES = ['CC Attribution', 'CC0 Public Domain', 'CC0 (author declared)'];

export const MODELS = [
  { id: 'se', file: 'se.glb', chapter: 'saopaulo', height: 45, uid: 'a2e7c359bdbf4a4682dd165a2397fb36' },
  { id: 'masp', file: 'masp.glb', chapter: 'saopaulo', height: 12, uid: '7eb9d1c77f9b43b088128fc5baa249bb' },
  { id: 'estaiada', file: 'estaiada.glb', chapter: 'saopaulo', height: 60, uid: 'be0e5bf3b1c34e4da38d4b1a9a47d3f9' },
  { id: 'plane', file: 'plane.glb', chapter: 'flight', height: 4, uid: '65cc7c4349174f7bbb20ed70206377b5' },
  { id: 'heathrow', file: 'heathrow.glb', chapter: 'heathrow', height: 16, uid: '1fed3793e2f94d6c9b22805b568119d1' },
  { id: 'bigben', file: 'bigben.glb', chapter: 'westminster', height: 60, uid: 'b5f82ba2e3614be2a69755a2a613579a' },
  { id: 'londoneye', file: 'londoneye.glb', chapter: 'westminster', height: 70, uid: '74eaf18882314264b474861d564fca36' },
  { id: 'towerbridge', file: 'towerbridge.glb', chapter: 'towerbridge', height: 40, uid: '0021ac55a9d54c13b655a2ed430d01f6' },
  { id: 'wembley', file: 'wembley.glb', chapter: 'wembley', height: 70, uid: 'fd20346281d04e0c8b62b8d2354b936e' },
  { id: 'bus', file: 'bus.glb', chapter: 'all', height: 4.6, uid: 'b809e5698e3444a3b62bb58654caac75' },
  { id: 'taxi', file: 'london-props.glb', node: null, chapter: 'roadtowembley', height: 1.7, uid: '815ca9e4e85844d6b702cb65ebc7dac8' },
  { id: 'phonebox', file: 'london-props.glb', node: null, chapter: 'roadtowembley', height: 2.5, uid: '815ca9e4e85844d6b702cb65ebc7dac8' },
].map((m) => ({ ...m, credit: CREDITS[m.uid] }));

export function creditsFor() {
  const seen = new Set();
  return MODELS.filter((m) => !seen.has(m.file) && seen.add(m.file)).map((m) => m.credit);
}
```

  Acima de `MODELS`, declarar `const CREDITS = {...}` com o objeto gerado no Step 4. Os `node` de `taxi` e `phonebox` são definidos na Task 2, Step 2.

- [ ] **Step 4: Gerar os créditos reais com `tools/model-credits.mjs`.** O script usa a API pública, sem token:

```js
// Usage: node tools/model-credits.mjs <uid>... → prints a CREDITS object literal for js/world/models.js
const out = {};
for (const uid of process.argv.slice(2)) {
  const m = await (await fetch(`https://api.sketchfab.com/v3/models/${uid}`)).json();
  let license = m.license?.label ?? 'unknown';
  if (/CC0/i.test(m.description ?? '') && license === 'CC Attribution') license = 'CC0 (author declared)';
  out[uid] = { title: m.name, author: m.user?.displayName ?? m.user?.username, license, url: `https://sketchfab.com/3d-models/${m.slug ?? 'model'}-${uid}` };
}
console.log(`const CREDITS = ${JSON.stringify(out, null, 2)};`);
```

  Rodar com os 11 UIDs únicos do manifesto e colar a saída em `models.js`. Se alguma licença vier fora de `ALLOWED_LICENSES`, **parar e reportar ao controlador**.

- [ ] **Step 5: Mostrar os créditos no Contact.**
  - Em `js/content.js`, acrescentar `credits: '3D models'` em `i18n.en.sections.contact` e `credits: 'Modelos 3D'` em `i18n.pt.sections.contact`.
  - Em `js/ui.js`, importar `{ creditsFor }` de `./world/models.js`. No `case 'contact'`, antes de `<p class="footer">`, inserir:

```js
      <details class="credits"><summary>${s.credits}</summary><ul class="list">${creditsFor().map((c) =>
        `<li>${ext(c.url, c.title)} — ${c.author} · ${c.license}</li>`).join('')}</ul></details>
```

- [ ] **Step 6:** rodar `node --test tests/`. Tudo deve passar; o teste de privacidade varre `js/`, então mantenha o hex minúsculo. Commit:

```bash
git add js/world/models.js tools/model-credits.mjs tests/models.test.mjs js/content.js js/ui.js
git commit -m "feat: 3D model manifest with Sketchfab credits in Contact"
```

### Task 2: Otimizar os GLBs

**Files:**
- Create: `tools/optimize-models.sh`, `assets/models/*.glb`
- Modify: `js/world/models.js` (`node` de taxi/phonebox), `tests/models.test.mjs`
- Modify: spec, para registrar WebP e quantização

- [ ] **Step 1: Escrever `tools/optimize-models.sh`.**

```bash
#!/usr/bin/env bash
# Dev-only: optimise raw Sketchfab GLBs into the site's assets. Usage: bash tools/optimize-models.sh
set -euo pipefail
SRC=assets/models/source OUT=assets/models
CLI="npx -y @gltf-transform/cli@4"
# id simplify-ratio (1 = keep geometry)
while read -r id ratio; do
  if [ "$ratio" = "1" ]; then simp=(--simplify false); else simp=(--simplify-ratio "$ratio" --simplify-error 0.001); fi
  $CLI optimize "$SRC/$id.glb" "$OUT/$id.glb" --compress quantize --texture-compress webp --texture-size 1024 "${simp[@]}"
done <<'LIST'
se 1
masp 1
estaiada 1
plane 1
heathrow 0.3
bigben 1
londoneye 0.2
towerbridge 1
wembley 0.12
bus 1
london-props 1
LIST
ls -la "$OUT"/*.glb
```

- [ ] **Step 2: Identificar os nós do pacote de props.** Rodar `npx -y @gltf-transform/cli@4 inspect assets/models/source/london-props.glb --format md | sed -n '/MESHES/,/MATERIALS/p'`. Escolher o nó cujo nome casa `/taxi|cab/i` e o que casa `/phone|booth|telephone|kiosk/i`, e gravar esses nomes em `node` de `taxi` e `phonebox` em `models.js`. Se não houver correspondência clara, reportar a lista de nomes ao controlador.

- [ ] **Step 3: Acrescentar o teste de arquivos e tamanhos** em `tests/models.test.mjs`:

```js
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('optimised GLBs exist within the asset budget', () => {
  let total = 0;
  for (const file of new Set(MODELS.map((m) => m.file))) {
    const size = statSync(join(root, 'assets/models', file)).size;
    assert.ok(size <= 1.5 * 1024 * 1024, `${file} is ${size} bytes`);
    total += size;
  }
  assert.ok(total <= 8 * 1024 * 1024, `total ${total} bytes`);
});

test('props pack entries name their node', () => {
  for (const m of MODELS.filter((x) => x.file === 'london-props.glb')) assert.ok(m.node, m.id);
});
```

- [ ] **Step 4: Otimizar e medir.** Rodar `bash tools/optimize-models.sh` e depois `node --test tests/`.
  - Se um arquivo passar de 1,5 MB, baixar o `ratio` dele (ou `--texture-size 512`) e repetir. Registrar o ratio final no script.
  - Registrar no relatório o tamanho e o número de triângulos de cada arquivo (`gltf-transform inspect`).

- [ ] **Step 5: Atualizar a spec** (`docs/superpowers/specs/2026-10-16-real-3d-dioramas-design.md`, seção Implementação). Trocar "texturas redimensionadas para no máximo 1024 px em JPEG/PNG" por "texturas redimensionadas para no máximo 1024 px em WebP (`EXT_texture_webp`) e malhas quantizadas (`KHR_mesh_quantization`), ambas decodificadas nativamente pelo GLTFLoader/navegador".

- [ ] **Step 6: Commit.**

```bash
git add tools/optimize-models.sh assets/models/*.glb js/world/models.js tests/models.test.mjs docs/superpowers/specs/2026-10-16-real-3d-dioramas-design.md
git commit -m "feat: optimised GLB models within the asset budget"
```

### Task 3: Carregador com normalização

**Files:**
- Modify: `index.html` (importmap)
- Create: `js/world/loader.js`, `tests/models.browser.py`

**Interfaces:**
- Consumes: `MODELS` (Task 1).
- Produces: `loadModel(id) → Promise<THREE.Group>`. Cada chamada devolve um clone, com o original em cache. A escala leva a altura a `height`, com a base em y = 0 e o centro em x/z = 0. Sombras ficam ligadas. Rejeita a Promise para id desconhecido ou arquivo que falhe.

- [ ] **Step 1: Importmap.** Em `index.html`, trocar o importmap por:

```html
  <script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/" } }</script>
```

- [ ] **Step 2: Escrever `js/world/loader.js`.**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELS } from './models.js';

const gltf = new GLTFLoader();
const files = new Map(); // file → Promise<gltf.scene>
const box = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();

// Sketchfab exports arrive in arbitrary units and pivots: normalise by bounding box to the manifest height.
function normalise(object, height) {
  const holder = new THREE.Group();
  holder.add(object);
  box.setFromObject(object);
  box.getSize(size);
  const s = height / (size.y || 1);
  object.scale.multiplyScalar(s);
  box.setFromObject(object);
  box.getCenter(centre);
  object.position.x -= centre.x;
  object.position.z -= centre.z;
  object.position.y -= box.min.y;
  object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return holder;
}

export function loadModel(id) {
  const m = MODELS.find((x) => x.id === id);
  if (!m) return Promise.reject(new Error(`unknown model ${id}`));
  if (!files.has(m.file)) files.set(m.file, gltf.loadAsync(`assets/models/${m.file}`).then((g) => g.scene));
  return files.get(m.file).then((scene) => {
    const source = m.node ? scene.getObjectByName(m.node) : scene;
    if (!source) throw new Error(`node ${m.node} missing in ${m.file}`);
    return normalise(source.clone(true), m.height);
  });
}
```

- [ ] **Step 3: Escrever `tests/models.browser.py`** (estilo dos outros `.browser.py`: comentário de uso, assert de localhost e `print(js(r'''(async () => { ... })()'''))`). Ele deve verificar:
  - para cada `MODELS`, `loadModel(id)` resolve e, depois de `updateMatrixWorld(true)`, a `Box3` tem `|size.y − height| ≤ 0.02·height` e `|min.y| < 0.01`;
  - o ônibus tem altura entre 4,4 e 4,8 m e comprimento (maior de `size.x` e `size.z`) entre 10,5 e 11,5 m;
  - `loadModel('missing')` rejeita;
  - devolve `{ pass: true, models: [[id, size.x, size.y, size.z]...] }`.

  Se o comprimento do ônibus normalizado por altura sair de 10,5–11,5 m, **reportar** o comprimento obtido. O controlador decide entre normalizar o ônibus pelo comprimento ou aceitar.

- [ ] **Step 4:** rodar `node --check js/world/loader.js` e `node --test tests/`. O controlador roda `browser-harness < tests/models.browser.py`. Commit:

```bash
git add index.html js/world/loader.js tests/models.browser.py
git commit -m "feat: GLTF loader with bounding-box normalisation"
```

## Etapa B — Dioramas

### Task 4: Rota reta, capítulos e lift da câmera

**Files:**
- Modify: `js/world/layout.js`, `js/world/camera.js`, `tests/logic.test.mjs`

**Interfaces:**
- Produces:
  - `STOP_SPACING = 40`;
  - `routePoints(n) → [{x, z: 0}]`;
  - `CHAPTERS: Array<{ id, stops: string[], river: boolean, models: Array<{ id, at, dx, dz, rotY }> }>`;
  - `chapterOf(stopId) → chapter id`;
  - `RIVER_Z = -45`;
  - `FRAME_LIFT`.
- `LANDMARKS`, `stopIndex` e `rng` **continuam exportados** como legado até a Task 6, porque `city.js`, `landmarks.js` e `ambient.js` ainda os importam. A Task 6 os remove junto com esses módulos.

- [ ] **Step 1: Substituir os testes de layout** em `tests/logic.test.mjs`:
  - Trocar a linha `import { routePoints, LANDMARKS, stopIndex, rng, STOP_SPACING } from '../js/world/layout.js';` por `import { routePoints, STOP_SPACING, CHAPTERS, chapterOf } from '../js/world/layout.js';` e `import { MODELS } from '../js/world/models.js';`.
  - Apagar os testes `every landmark is anchored to an existing stop` e `rng is deterministic`.
  - Acrescentar:

```js
test('chapters cover every stop once, in route order', () => {
  assert.deepEqual(CHAPTERS.flatMap((c) => c.stops), stops.map((s) => s.id));
  for (const s of stops) assert.ok(chapterOf(s.id), s.id);
});

test('chapter models exist and anchor to their own stops', () => {
  for (const c of CHAPTERS) for (const m of c.models) {
    assert.ok(MODELS.some((x) => x.id === m.id), m.id);
    assert.ok(c.stops.includes(m.at), `${m.id} at ${m.at}`);
  }
});

test('the Thames runs only through Westminster and Tower Bridge', () => {
  assert.deepEqual(CHAPTERS.filter((c) => c.river).map((c) => c.id), ['westminster', 'towerbridge']);
  assert.equal(CHAPTERS.find((c) => c.id === 'wembley').river, false);
});
```

- [ ] **Step 2:** rodar `node --test tests/` e ver os testes novos falharem.

- [ ] **Step 3: Reescrever `js/world/layout.js`.**

```js
// Pure layout data: no three import, so node tests can load it.
export const STOP_SPACING = 40;
export const RIVER_Z = -45;

// A straight road; dioramas sit on bases along it.
export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * STOP_SPACING, z: 0 }));

// dz < 0 is the far side (away from the camera). rotY in radians; tuned at the visual checkpoint.
export const CHAPTERS = [
  { id: 'saopaulo', river: false, stops: ['hero', 'puc', 'arizona', 'insane', 'taqtile', 'mira', 'reclame'], models: [
    { id: 'se', at: 'puc', dx: 0, dz: -38, rotY: 0 },
    { id: 'masp', at: 'taqtile', dx: 0, dz: -26, rotY: 0 },
    { id: 'estaiada', at: 'reclame', dx: 0, dz: -48, rotY: 0 },
  ] },
  { id: 'heathrow', river: false, stops: ['millimetric'], models: [{ id: 'heathrow', at: 'millimetric', dx: 0, dz: -40, rotY: 0 }] },
  { id: 'westminster', river: true, stops: ['xdesign', 'olm'], models: [
    { id: 'bigben', at: 'xdesign', dx: 0, dz: -24, rotY: 0 },
    { id: 'londoneye', at: 'olm', dx: 0, dz: -72, rotY: 0 },
  ] },
  { id: 'towerbridge', river: true, stops: ['tribal'], models: [{ id: 'towerbridge', at: 'tribal', dx: 0, dz: -45, rotY: Math.PI / 2 }] },
  { id: 'roadtowembley', river: false, stops: ['stack', 'articles', 'repos', 'recs'], models: [
    { id: 'phonebox', at: 'stack', dx: 4, dz: 9, rotY: 0 },
    { id: 'taxi', at: 'repos', dx: 0, dz: 7, rotY: 0 },
  ] },
  { id: 'wembley', river: false, stops: ['contact'], models: [{ id: 'wembley', at: 'contact', dx: 0, dz: -75, rotY: 0 }] },
];

export const chapterOf = (stopId) => CHAPTERS.find((c) => c.stops.includes(stopId))?.id;

// legacy: still imported by city.js / landmarks.js / ambient.js; removed in Task 6 with those modules.
export const LANDMARKS = { heathrow: 'millimetric', bigben: 'xdesign', eye: 'olm', towerbridge: 'tribal', wembley: 'contact' };
export const stopIndex = (stops, id) => stops.findIndex((s) => s.id === id);
export function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much the follow camera rises at stops whose landmark would otherwise be cropped (0 = street shot).
export const FRAME_LIFT = { xdesign: 1, olm: 1, tribal: 0.8, puc: 0.6, reclame: 0.8 };
```

- [ ] **Step 4: Lift maior para marcos reais.** Em `js/world/camera.js`, no caso `follow`, trocar o corpo por:

```js
      const L = lift; // 0 keeps the approved street framing exactly
      return {
        position: [x + (20 + 10 * L) * k, y + (29 + 26 * L) * k, z + (50 + 40 * L) * k],
        target: [x + 2, y + 5 + 22 * L, z + 2 - 18 * L],
      };
```

  Os testes `follow shot is unchanged without lift` e `lift raises the aim...` continuam válidos, e `FRAME_LIFT` continua em (0, 1].

- [ ] **Step 5:** rodar `node --test tests/`. Todos passam, menos os que importam `palette.js`/`city.js`, que são tratados na Task 6. Se `palette.test.mjs` falhar por depender de `landmarks.js`, deixar como está e anotar no relatório. Commit:

```bash
git add js/world/layout.js js/world/camera.js tests/logic.test.mjs
git commit -m "feat: straight diorama route, chapters and higher landmark lift"
```

### Task 5: Dioramas e integração na cena

**Files:**
- Create: `js/world/dioramas.js`, `tests/dioramas.browser.py`
- Modify: `js/world/scene.js`

**Interfaces:**
- Consumes: `loadModel` (Task 3); `CHAPTERS`, `routePoints`, `RIVER_Z`, `chapterOf` (Task 4); `createWater({ span, z, width })` (existente).
- Produces: `createDioramas(scene, { stops, pts }) → { update(frame), ensure(chapterId) → Promise<void>, ready: Promise<void> }`.
  - `ready` resolve quando São Paulo terminar de carregar ou falhar.
  - `update` chama `ensure` para o capítulo ativo e o seguinte, e anima a água.

- [ ] **Step 1: Escrever `js/world/dioramas.js`.**

```js
import * as THREE from 'three';
import { CHAPTERS, RIVER_Z, STOP_SPACING, chapterOf } from './layout.js';
import { loadModel } from './loader.js';
import { createWater } from './water.js';

const BASE = '#d9d4ca', BASE_EDGE = '#b8b1a5', ROAD = '#45484b', LINE = '#f1ece2', GROUND = '#e4e2de';
const HALF = STOP_SPACING / 2 - 2; // a 4 m gap between neighbouring bases reads as separate dioramas

export function createDioramas(scene, { stops, pts }) {
  const at = (id) => pts[stops.findIndex((s) => s.id === id)];
  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), lambert(GROUND));
  ground.position.y = -1.25; ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.BoxGeometry(pts.at(-1).x - pts[0].x + 2 * HALF + 8, 0.1, 9), lambert(ROAD));
  road.position.set((pts[0].x + pts.at(-1).x) / 2, 0.05, 0); road.receiveShadow = true;
  scene.add(road);
  for (let x = pts[0].x - HALF; x < pts.at(-1).x + HALF; x += 6) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2, 0.02, 0.25), lambert(LINE));
    dash.position.set(x, 0.11, 0); scene.add(dash);
  }

  const waters = [], state = new Map(); // chapter id → Promise
  for (const c of CHAPTERS) {
    const xs = c.stops.map((id) => at(id).x), x0 = Math.min(...xs) - HALF, x1 = Math.max(...xs) + HALF;
    const base = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.2, 130), [BASE_EDGE, BASE_EDGE, BASE, BASE_EDGE, BASE_EDGE, BASE_EDGE].map(lambert));
    base.position.set((x0 + x1) / 2, -0.6, -40); base.receiveShadow = true;
    scene.add(base);
    if (c.river) {
      const water = createWater({ span: x1 - x0, z: RIVER_Z, width: 22 });
      water.mesh.position.x = (x0 + x1) / 2;
      scene.add(water.mesh); waters.push(water);
    }
  }

  function ensure(id) {
    if (state.has(id)) return state.get(id);
    const c = CHAPTERS.find((x) => x.id === id);
    const job = Promise.all(c.models.map((m) => loadModel(m.id).then((model) => {
      const p = at(m.at);
      model.position.set(p.x + m.dx, 0, p.z + m.dz);
      model.rotation.y = m.rotY;
      scene.add(model);
    }).catch((err) => console.warn(`3D model ${m.id} unavailable:`, err)))).then(() => {});
    state.set(id, job);
    return job;
  }

  const order = CHAPTERS.map((c) => c.id);
  return {
    ready: ensure('saopaulo'),
    ensure,
    update({ time, active, night = 0 }) {
      const id = chapterOf(stops[active].id), i = order.indexOf(id);
      ensure(id);
      if (order[i + 1]) ensure(order[i + 1]);
      for (const w of waters) w.update(time, night);
    },
  };
}
```

- [ ] **Step 2: Integrar em `js/world/scene.js`.**
  - **Imports:** remover `createBoxes, buildMeshes`, `buildCity`, `buildLandmarks`, `buildBus`, `createWater` e `RIVER_Z`. Acrescentar `import { createDioramas } from './dioramas.js';` e `import { loadModel } from './loader.js';`.
  - **Fundo e neblina:** `scene.background = new THREE.Color(0xe4e2de)` e `scene.fog = new THREE.Fog(0xe4e2de, 220, 900)`. A câmera usa far 1400.
  - **Construção do mundo:** substituir o bloco de `const { add, list } = createBoxes();` até `scene.add(buildMeshes(...), eye, details, plane, bus);` por:

```js
  const dioramas = createDioramas(scene, { stops, pts });
  const bus = new THREE.Group(), plane = new THREE.Group();
  scene.add(bus, plane);
  loadModel('bus').then((m) => { m.rotation.y = -Math.PI / 2; bus.add(m); wake(); }).catch((e) => console.warn('bus model unavailable:', e));
  loadModel('plane').then((m) => { plane.add(m); }).catch((e) => console.warn('plane model unavailable:', e));
  const planeAt = stops.findIndex((s) => s.id === 'millimetric') / (n - 1);
```

  `rotation.y` do ônibus é um palpite inicial para alinhar a frente com +x; o controlador ajusta no ponto de controle.

  - **Água e ambiente:** remover `const water = createWater(...)` e `scene.add(water.mesh)`. Trocar `units.push(createAmbient(scene, { curve, pts, stops }));` por `units.push(dioramas);` (o ambiente volta na Task 6).
  - **Frame:** remover `eye.rotation.z = clock * 0.1;` e `water.update(clock, night);`. Na montagem de `f`, acrescentar `night`: `const f = { time: clock, dt, progress: p, active: nearestStop(p, n), bus: busPos, night };`. Se a ordem do código exigir, mover o cálculo de `night` para antes de `f`.
  - **`updatePlane`:** o avião vem do lado de São Paulo e desce sobre Heathrow:

```js
  const updatePlane = (p) => {
    const d = (p - planeAt) * (n - 1); // -1..0 approach, 0 at the Heathrow stop
    plane.visible = d > -1 && d < 0.3;
    if (plane.visible) plane.position.set(busPos.x + d * 70, 6 + Math.max(0, -d) * 30, busPos.z - 22);
  };
```

  - **Wake e Memoji:** a função `wake` é usada pelos loaders antes de sua declaração atual, então mova `let disposed = false, raf = 0;` e `const wake = ...` para logo após a criação do renderer. A figura Memoji continua posicionada a partir de `curve.getPointAt(1)`.

- [ ] **Step 3: Escrever `tests/dioramas.browser.py`.** Ele deve verificar, com `createWorld` num canvas fora da tela como faz `world.browser.py`:
  - depois de `jump(0)` e alguns frames, existem meshes com sombra (`castShadow`) e não há erro lançado;
  - **salto para Wembley:** `jump(1)`, aguardar até 8 s; a cena contém um objeto cuja `Box3` tem altura ≥ 60 perto de `x = pts.at(-1).x`;
  - **GLB que falha:** importar `loader.js`, sobrescrever `MODELS.find(m => m.id === 'masp').file = 'missing.glb'` antes de `createWorld`, e então `ready` resolve, um frame renderiza e um `console.warn` é registrado;
  - devolve `{ pass: true }`.

- [ ] **Step 4:** rodar `node --check js/world/dioramas.js js/world/scene.js` e `node --test tests/`. O controlador roda `browser-harness` com `dioramas`, `world` e `models`. Commit:

```bash
git add js/world/dioramas.js js/world/scene.js tests/dioramas.browser.py
git commit -m "feat: real 3D model dioramas along a straight road"
```

- [ ] **Ponto de controle (controlador):**
  - Capturas desktop 1350×940 e 375 px, de dia e de noite, com o cache desativado, de: hero, Sé (2003), MASP (2014), Estaiada (2017), voo/Heathrow (2020), Big Ben (2020), London Eye (2021), Tower Bridge (2024), estrada (Stack) e Wembley (Contact).
  - Ajustar `rotY`, `dx`, `dz`, `height` e a rotação do ônibus em pequenos commits, cada um revisado.
  - Enviar ao usuário e aguardar aceite antes da Etapa C.

## Etapa C — Acabamento

### Task 6: Tráfego com modelos reais e remoção do procedural

**Files:**
- Modify: `js/world/ambient.js`, `js/world/scene.js`
- Delete: `js/world/city.js`, `js/world/landmarks.js`, `js/world/bus.js`, `js/world/voxel.js`, `js/world/palette.js`, `tests/palette.test.mjs`, `tests/city.browser.py`, `tests/landmarks.browser.py`, `tests/vehicles.browser.py`

**Interfaces:**
- `createAmbient(scene, { curve, stops }) → { update(frame) }`. Táxis e um ônibus de tráfego são clones de `loadModel`. Antes de carregar, nada aparece.

- [ ] **Step 1: Reescrever `js/world/ambient.js`.**

```js
import { loadModel } from './loader.js';
import { routeT } from '../scroll.js';

// Traffic made of the real bus and taxi models; vehicles appear once their models load.
export function createAmbient(scene, { curve, stops }) {
  const specs = [
    { id: 'bus', lane: 1.75, offset: -0.12, relative: true },
    { id: 'taxi', lane: 1.75, offset: 0.2, relative: true },
    { id: 'taxi', lane: -1.75, offset: 0.25, reverse: true },
    { id: 'taxi', lane: -1.75, offset: 0.7, reverse: true },
  ];
  const traffic = [];
  for (const s of specs) {
    loadModel(s.id).then((mesh) => { mesh.visible = false; scene.add(mesh); traffic.push({ ...s, mesh }); })
      .catch((e) => console.warn(`traffic ${s.id} unavailable:`, e));
  }
  return {
    update({ time, progress }) {
      const route = routeT(progress, stops.length);
      for (const v of traffic) {
        const t = v.relative ? route + v.offset : ((v.offset - time * 0.012) % 1 + 1) % 1;
        v.mesh.visible = t >= 0 && t <= 1;
        if (!v.mesh.visible) continue;
        const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        v.mesh.position.set(p.x + tan.z * v.lane, 0, p.z - tan.x * v.lane);
        v.mesh.rotation.y = Math.atan2(-tan.z, tan.x) + (v.reverse ? Math.PI : 0) - Math.PI / 2;
      }
    },
  };
}
```

  O `- Math.PI / 2` usa a mesma correção do ônibus herói. Se o ajuste final do ponto de controle mudou essa rotação, use o mesmo valor aqui.

- [ ] **Step 2:** em `scene.js`, voltar a registrar o ambiente com `units.push(createAmbient(scene, { curve, stops }));`, logo após `units.push(dioramas);`.

- [ ] **Step 3: Remover o procedural.**

```bash
git rm js/world/city.js js/world/landmarks.js js/world/bus.js js/world/voxel.js js/world/palette.js tests/palette.test.mjs tests/city.browser.py tests/landmarks.browser.py tests/vehicles.browser.py
grep -rn "city.js\|landmarks.js\|bus.js\|voxel.js\|palette.js" js tests && echo "STALE IMPORTS" || echo "clean"
```

  Deve imprimir `clean`. Depois, apague de `js/world/layout.js` o bloco `// legacy:` (`LANDMARKS`, `stopIndex`, `rng`) e rode `grep -rn "LANDMARKS\|stopIndex\|rng(" js tests`, que não deve retornar nada.

  `sky.js` ainda coleta materiais com `userData.glow`; sem eles, só o céu e a luz mudam à noite, o que é aceitável.

- [ ] **Step 4:** rodar `node --check js/world/*.js` e `node --test tests/`. O controlador roda `world`, `dioramas`, `models`, `figure` e `interface`. Commit:

```bash
git add -A js/world tests
git commit -m "refactor: real-model traffic; retire procedural city, landmarks and bus"
```

### Task 7: Verificação final (controlador)

- [ ] **Medir:**
  - `wc -c` do código próprio sem `js/content.js`, que deve ficar abaixo de 60.000 bytes;
  - `du -ch assets/models/*.glb`, até 8 MB no total;
  - o sampler WebGL do relatório anterior: draw calls abaixo de 150 e triângulos visíveis abaixo de 300 mil, medidos com `renderer.info.render.triangles`.
- [ ] **Matriz:**
  - desktop e 375 px, EN/PT, dia e noite;
  - `#contact` direto;
  - CDN bloqueado (`no-webgl`);
  - GLB bloqueado com `Network.setBlockedURLs *assets/models/masp.glb*`: a cena continua;
  - `prefers-reduced-motion` com zero frames ociosos;
  - console limpo, exceto o aviso esperado;
  - créditos visíveis e corretos no Contact, em EN e PT.
- [ ] **Auditorias:** Lighthouse com acessibilidade, best practices e SEO, mais um trace local. Registrar com honestidade a ausência de um score de Performance.
- [ ] **Relatório:** gravar `docs/codex/2026-10-16-dioramas-validation.md` e fazer commit local, sem push.
