# London Bus Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-page CV at samuelcatalano.github.io/personal-website with a scroll-driven voxel London where a red double-decker bus drives through Samuel's career.

**Architecture:** Static site, no build. An HTML side panel (`js/ui.js`) renders all content from `js/content.js` and is fully usable without 3D. Scroll position → progress 0..1 (`js/scroll.js`) → active stop for the panel and bus/camera pose for the lazily-imported Three.js world (`js/world/*`). Pure logic (content, scroll math, layout, prefs) is DOM/three-free so `node --test` can check it.

**Tech Stack:** HTML, CSS, native ES modules, `three@0.169.0` via jsDelivr importmap, Google Fonts (Silkscreen, Inter), Node ≥ 18 built-in test runner (dev only), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-london-bus-portfolio-design.md` (with `docs/PRD.md`, `docs/TRD.md`). Conventions and model orchestration: `CLAUDE.md`.

## Global Constraints

- No build step, no npm, no `package.json`. Push to `main` = deploy.
- `three` pinned exactly: `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js`.
- Every user-facing string lives in `js/content.js` with both `en` and `pt`. EN is the default.
- All URLs relative (site is served under `/personal-website/`).
- Never publish home address or phone. Contact = `samuel.catalano@gmail.com`, `https://www.linkedin.com/in/samuelcatalano`, `https://github.com/samuelcatalano`.
- Site must work with WebGL unavailable and with `prefers-reduced-motion: reduce`.
- Keep favicons, `site.webmanifest`, `robots.txt`, `sitemap.xml`, `social-preview.png`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Models: Opus 5.5 orchestrates/reviews; Sonnet 5.5 implements Tasks 4–8; Haiku 5.5 does Task 1 PT copy review and Task 9 link checks.

## Review Focus

1. Scroll at the very top / very bottom, or a page shorter than the viewport → progress clamps to 0/1, first/last stop active, no NaN (test in Task 2).
2. `localStorage` throws (Safari private mode, blocked storage) → defaults `en`/`day`, no crash (test in Task 3).
3. three CDN unreachable or WebGL missing → `no-webgl` class, static sky, panel fully works, no uncaught promise rejection (manual check in Task 8).
4. Reload mid-page or open with `#contact` hash → panel and bus start at the real scroll position, not at stop 0 (step in Task 3 + Task 8 check).
5. Resize / phone rotation mid-scroll → renderer size, camera aspect and active stop recomputed (resize listener in Task 2 `watchScroll` and Task 5 `scene.js`).

---

## File map

```
index.html                 shell, importmap, header/nav, #panel, #track, #world canvas, #year-sign
css/style.css              tokens (day/night), layout, panel, mobile bottom sheet, fallback sky
js/content.js              stops[], SECTIONS, i18n {en,pt}, links, articles, repos, stack
js/scroll.js               pure scroll math + watchScroll()
js/ui.js                   prefs, panel render, nav, toggles, keyboard
js/main.js                 boot + lazy world
js/world/layout.js         pure: routePoints(), landmark → stop mapping, rng
js/world/voxel.js          box collector + InstancedMesh builder
js/world/scene.js          renderer, camera, lights, theme, loop, createWorld()
js/world/city.js           ground, Thames, road, buildings, Brazil houses, props
js/world/landmarks.js      Heathrow, Big Ben, London Eye, Tower Bridge, Wembley, plane
js/world/bus.js            double-decker + avatar sprite
assets/avatar.png          Samuel's Memoji
tests/content.test.mjs     content integrity
tests/logic.test.mjs       scroll, layout, prefs
.claude/launch.json        local preview server
```

---

### Task 1: Content data + integrity test

**Files:**
- Create: `js/content.js`, `tests/content.test.mjs`, `assets/avatar.png`

**Interfaces:**
- Produces: `SECTIONS: string[]`; `stops: Array<{id, section, year, country:'BR'|'UK'}>`; `i18n: {en, pt}` each `{ui, sections, stops}`; `links`, `articles`, `repos`, `stack`; `sectionStart(section) → index of first stop in that section`.

- [ ] **Step 1: Copy the avatar**

```bash
mkdir -p assets && cp "/private/tmp/claude-503/-Users-samuel-catalano-Projects-samuelcatalano-personal-website/e7c2f567-1afb-4671-9c70-c80fd708e1da/images/1.png" assets/avatar.png
```
(If that temp path is gone, use `Sammy.png` from the repo root.)

- [ ] **Step 2: Write the failing test** — `tests/content.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { stops, SECTIONS, i18n, sectionStart } from '../js/content.js';

const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]).sort();

test('en and pt have identical keys', () => {
  assert.deepEqual(keys(i18n.pt), keys(i18n.en));
});

test('no empty strings', () => {
  for (const lang of ['en', 'pt']) {
    const walk = (o) => Object.values(o).forEach(v =>
      typeof v === 'string' ? assert.ok(v.trim(), `empty string in ${lang}`) : v && typeof v === 'object' && walk(v));
    walk(i18n[lang]);
  }
});

test('every stop has a known section and journey stops have copy', () => {
  for (const s of stops) {
    assert.ok(SECTIONS.includes(s.section), s.id);
    if (s.section === 'journey') assert.ok(i18n.en.stops[s.id]?.title, s.id);
  }
});

test('journey is chronological and stop ids unique', () => {
  const years = stops.filter(s => s.section === 'journey').map(s => +s.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  assert.equal(new Set(stops.map(s => s.id)).size, stops.length);
});

test('sections appear in SECTIONS order', () => {
  const starts = SECTIONS.map(sectionStart);
  assert.ok(starts.every(i => i >= 0));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});

test('no private data in served files', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const files = ['index.html', 'css/style.css', 'README.md', ...walk('js')].map(f => join(root, f));
  const bad = [/\+?44[\s\d]{9,}/, /tel:/i, /\bFlat\s*\d/i, /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/];
  for (const f of files) for (const re of bad) assert.ok(!re.test(readFileSync(f, 'utf8')), `${f} matches ${re}`);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '.../js/content.js'`

- [ ] **Step 4: Write `js/content.js`**

```js
// All site copy. Every user-facing string exists in en and pt (tests/content.test.mjs enforces it).
export const SECTIONS = ['hero', 'journey', 'stack', 'articles', 'repos', 'recs', 'contact'];

export const stops = [
  { id: 'hero', section: 'hero', year: 'HELLO', country: 'BR' },
  { id: 'puc', section: 'journey', year: '2003', country: 'BR' },
  { id: 'arizona', section: 'journey', year: '2011', country: 'BR' },
  { id: 'insane', section: 'journey', year: '2012', country: 'BR' },
  { id: 'taqtile', section: 'journey', year: '2014', country: 'BR' },
  { id: 'mira', section: 'journey', year: '2017', country: 'BR' },
  { id: 'reclame', section: 'journey', year: '2017', country: 'BR' },
  { id: 'millimetric', section: 'journey', year: '2020', country: 'UK' },
  { id: 'xdesign', section: 'journey', year: '2020', country: 'UK' },
  { id: 'olm', section: 'journey', year: '2021', country: 'UK' },
  { id: 'tribal', section: 'journey', year: '2024', country: 'UK' },
  { id: 'stack', section: 'stack', year: 'STACK', country: 'UK' },
  { id: 'articles', section: 'articles', year: 'WRITE', country: 'UK' },
  { id: 'repos', section: 'repos', year: 'CODE', country: 'UK' },
  { id: 'recs', section: 'recs', year: 'KIND', country: 'UK' },
  { id: 'contact', section: 'contact', year: 'NOW', country: 'UK' },
];

export const sectionStart = (section) => stops.findIndex(s => s.section === section);

export const links = {
  email: 'mailto:samuel.catalano@gmail.com',
  linkedin: 'https://www.linkedin.com/in/samuelcatalano',
  github: 'https://github.com/samuelcatalano',
  medium: 'https://medium.com/@samuelcatalano',
};

export const articles = [
  { title: 'Mastering the Art of Backend Hiring', url: 'https://medium.com/thefreshwrites/mastering-the-art-of-backend-hiring-essential-questions-for-interviewers-and-candidates-e0deb436f8ff' },
  { title: 'Quarkus and the MicroProfile Fault Tolerance API', url: 'https://medium.com/thefreshwrites/quarkus-and-a-microprofile-fault-tolerance-api-fee82de09616' },
  { title: 'Mapping Entities to DTOs and vice versa in Java', url: 'https://medium.com/thefreshwrites/mapping-entities-to-dtos-and-vice-versa-in-java-fe126f6bb6b2' },
];

export const repos = [
  { name: 'quarkus-fault-tolerance', lang: 'Java · Quarkus' },
  { name: 'quarkus-mongo-crud', lang: 'Java · Quarkus · MongoDB' },
  { name: 'kerno-kotlin-challenge', lang: 'Kotlin' },
  { name: 'neo4j-tech-challenge', lang: 'Java · Neo4j' },
  { name: 'bookstore-basic-golang', lang: 'Go' },
  { name: 'groovy-rest-crud-sample', lang: 'Groovy' },
].map(r => ({ ...r, url: `https://github.com/samuelcatalano/${r.name}` }));

export const stack = ['Java 17', 'Spring Boot', 'Quarkus', 'Kafka', 'Debezium', 'AWS Lambda', 'SNS/SQS',
  'Docker', 'Kubernetes', 'PostgreSQL', 'MySQL', 'MongoDB', 'Cassandra', 'ActiveMQ', 'Terraform', 'JUnit · Mockito'];

export const i18n = {
  en: {
    ui: {
      nav: { journey: 'Journey', stack: 'Stack', articles: 'Writing', repos: 'Code', contact: 'Contact' },
      theme: 'Switch between day and night', lang: 'Switch language', scroll: 'Scroll to ride',
      beforeLondon: 'Before London', present: 'Present', skip: 'Skip to content', footer: 'Designed and built by Samuel Catalano.',
    },
    sections: {
      hero: { title: 'Samuel Catalano', role: 'Senior Software Engineer', tagline: 'Ranked #1 Software Engineer in the world according to my parents.', meta: '17+ years · Java · Backend · London' },
      journey: { title: 'Journey', intro: 'Every stop is a chapter. Hop on the bus through my career.' },
      stack: { title: 'Stack', intro: 'The tools I reach for when a system has to keep working after launch.' },
      articles: { title: 'Writing', intro: 'Practical engineering notes on Medium.', more: 'All articles' },
      repos: { title: 'Code', intro: 'A few public repositories worth a look.', more: 'All repositories' },
      recs: { title: 'Kind words', intro: 'What people I worked with say.' },
      contact: { title: 'Last stop: Wembley', intro: 'Always glad to talk about backend and platform work.', email: 'Email', linkedin: 'LinkedIn', github: 'GitHub' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'BSc Computer Science', dates: '2003 – 2008', place: 'São Paulo', body: 'Computer Science degree with a specialisation in software development.' },
      arizona: { title: 'Arizona Premedia', role: 'Java Web Developer', dates: 'May 2011 – Feb 2012', place: 'São Paulo', body: 'Built Arizona.Retail, which creates and lays out tabloids for large Brazilian retailers and sends them to print.' },
      insane: { title: 'Insane Games', role: 'Mobile Application Developer', dates: 'Mar 2012 – Oct 2013', place: 'São Paulo', body: 'Built iOS and Android apps with Appcelerator Titanium and managed them in the stores.' },
      taqtile: { title: 'Taqtile', role: 'Mobile Software Engineer', dates: 'Jan 2014 – Feb 2016', place: 'São Paulo', body: 'Operations team for US clients: fixes, improvements and new features in shipped iOS and Android apps.' },
      mira: { title: 'Mira Educação', role: 'Software Engineer', dates: 'Jan 2017 – Aug 2017', place: 'São Paulo', body: 'Built APIs for the mobile team of a public-education platform. My first microservices with Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Software Engineer', dates: 'Dec 2017 – Apr 2020', place: 'São Paulo', body: "Backend for Brazil's largest consumer-complaint platform, with automated company rankings." },
      millimetric: { title: 'Millimetric.ai', role: 'Senior Java Engineer', dates: 'Apr 2020 – Nov 2020', place: 'London', body: 'Arrived in London. Real-time anomaly detection on business metrics with Spring Boot and Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Senior Java Software Engineer', dates: 'Nov 2020 – May 2021', place: 'London', body: "Integrated Onfido document verification into FanDuel's US onboarding flow on AWS." },
      olm: { title: 'OLM Systems', role: 'Software Developer III', dates: 'Jul 2021 – Feb 2024', place: 'London / Glasgow', body: 'CP-IS: secure information sharing that helps health and social care protect vulnerable children. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Senior Software Developer', dates: 'Jun 2024 – Present', place: 'London', body: "Stock archiving, import, export and API services for Volkswagen's vehicle stock data. Spring Boot, MongoDB, ActiveMQ." },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager at UOL', quote: 'Samuel is a committed, serious and extremely responsible professional, always striving for excellence.' },
      { name: 'Decio di Napoli', role: 'Architect at Estudio Arquitetural', quote: 'The kind of professional whose knowledge and performance result in extreme quality. Reliable and very serious.' },
    ],
  },
  pt: {
    ui: {
      nav: { journey: 'Trajetória', stack: 'Stack', articles: 'Artigos', repos: 'Código', contact: 'Contato' },
      theme: 'Alternar entre dia e noite', lang: 'Trocar idioma', scroll: 'Role para embarcar',
      beforeLondon: 'Antes de Londres', present: 'Atual', skip: 'Pular para o conteúdo', footer: 'Projetado e construído por Samuel Catalano.',
    },
    sections: {
      hero: { title: 'Samuel Catalano', role: 'Engenheiro de Software Sênior', tagline: 'Eleito o melhor engenheiro de software do mundo pelos meus pais.', meta: '17+ anos · Java · Backend · Londres' },
      journey: { title: 'Trajetória', intro: 'Cada parada, um capítulo. Embarque no ônibus pela minha carreira.' },
      stack: { title: 'Stack', intro: 'As ferramentas que uso quando um sistema precisa continuar funcionando depois do lançamento.' },
      articles: { title: 'Artigos', intro: 'Notas práticas de engenharia no Medium.', more: 'Todos os artigos' },
      repos: { title: 'Código', intro: 'Alguns repositórios públicos que valem a visita.', more: 'Todos os repositórios' },
      recs: { title: 'Recomendações', intro: 'O que dizem pessoas que trabalharam comigo.' },
      contact: { title: 'Última parada: Wembley', intro: 'Sempre feliz em conversar sobre backend e plataforma.', email: 'E-mail', linkedin: 'LinkedIn', github: 'GitHub' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'Bacharelado em Ciência da Computação', dates: '2003 – 2008', place: 'São Paulo', body: 'Ciência da Computação com especialização em desenvolvimento de software.' },
      arizona: { title: 'Arizona Premedia', role: 'Desenvolvedor Java Web', dates: 'mai 2011 – fev 2012', place: 'São Paulo', body: 'Construí o Arizona.Retail, que cria e diagrama tabloides para grandes varejistas e envia para a gráfica.' },
      insane: { title: 'Insane Games', role: 'Desenvolvedor Mobile', dates: 'mar 2012 – out 2013', place: 'São Paulo', body: 'Apps iOS e Android com Appcelerator Titanium, publicados e mantidos nas lojas.' },
      taqtile: { title: 'Taqtile', role: 'Engenheiro de Software Mobile', dates: 'jan 2014 – fev 2016', place: 'São Paulo', body: 'Time de operações para clientes dos EUA: correções, melhorias e novas features em apps iOS e Android.' },
      mira: { title: 'Mira Educação', role: 'Engenheiro de Software', dates: 'jan 2017 – ago 2017', place: 'São Paulo', body: 'APIs para o time mobile de uma plataforma de educação pública. Meus primeiros microsserviços com Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Engenheiro de Software', dates: 'dez 2017 – abr 2020', place: 'São Paulo', body: 'Backend da maior plataforma de reclamações do Brasil, com rankings automáticos de empresas.' },
      millimetric: { title: 'Millimetric.ai', role: 'Engenheiro Java Sênior', dates: 'abr 2020 – nov 2020', place: 'Londres', body: 'Chegada a Londres. Detecção de anomalias em métricas em tempo real com Spring Boot e Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Engenheiro de Software Java Sênior', dates: 'nov 2020 – mai 2021', place: 'Londres', body: 'Integração da verificação de documentos Onfido no onboarding da FanDuel nos EUA, na AWS.' },
      olm: { title: 'OLM Systems', role: 'Software Developer III', dates: 'jul 2021 – fev 2024', place: 'Londres / Glasgow', body: 'CP-IS: compartilhamento seguro de informações para a saúde e assistência social protegerem crianças vulneráveis. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Desenvolvedor de Software Sênior', dates: 'jun 2024 – atual', place: 'Londres', body: 'Serviços de arquivamento, importação, exportação e API para o estoque de veículos da Volkswagen. Spring Boot, MongoDB, ActiveMQ.' },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager na UOL', quote: 'Samuel é um profissional comprometido, sério e extremamente responsável, sempre buscando a excelência.' },
      { name: 'Decio di Napoli', role: 'Arquiteto no Estudio Arquitetural', quote: 'O tipo de profissional cujo conhecimento e desempenho resultam em qualidade extrema. Confiável e muito sério.' },
    ],
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/`
Expected: 6 tests PASS.

- [ ] **Step 6: Haiku review of PT copy** — dispatch a Haiku 5.5 subagent: "Read `js/content.js`. Check the `pt` strings are natural Brazilian Portuguese and match the `en` meaning. Report suggested edits only; do not edit." Apply accepted edits, re-run tests.

- [ ] **Step 7: Commit**

```bash
git add js/content.js tests/content.test.mjs assets/avatar.png
git commit -m "feat: add bilingual portfolio content and integrity test"
```

---

### Task 2: Scroll math

**Files:**
- Create: `js/scroll.js`, `tests/logic.test.mjs`

**Interfaces:**
- Produces: `clamp01(v)`, `progressFromScroll(scrollY, scrollHeight, viewport) → 0..1`, `nearestStop(progress, n) → int`, `routeT(progress, n) → 0..1` (with dwell at stops), `scrollYForStop(i, n, scrollHeight, viewport)`, `watchScroll(cb: (progress) => void)`.

- [ ] **Step 1: Write the failing test** — `tests/logic.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressFromScroll, nearestStop, routeT, scrollYForStop } from '../js/scroll.js';

test('progress clamps and handles short pages', () => {
  assert.equal(progressFromScroll(0, 5000, 1000), 0);
  assert.equal(progressFromScroll(4000, 5000, 1000), 1);
  assert.equal(progressFromScroll(9999, 5000, 1000), 1);
  assert.equal(progressFromScroll(-50, 5000, 1000), 0);
  assert.equal(progressFromScroll(0, 800, 1000), 0); // page shorter than viewport
  assert.equal(progressFromScroll(2000, 5000, 1000), 0.5);
});

test('nearestStop maps ends to first and last', () => {
  assert.equal(nearestStop(0, 16), 0);
  assert.equal(nearestStop(1, 16), 15);
  assert.equal(nearestStop(0.5, 3), 1);
  assert.equal(nearestStop(2, 16), 15);
  assert.equal(nearestStop(0, 1), 0);
});

test('routeT dwells at stops and is monotonic', () => {
  const n = 5, seg = 1 / (n - 1);
  assert.equal(routeT(0, n), 0);
  assert.equal(routeT(1, n), 1);
  assert.equal(routeT(seg * 0.1, n), 0);            // still parked at stop 0
  assert.equal(routeT(seg * 0.9, n), seg);          // already parked at stop 1
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.01) { const t = routeT(p, n); assert.ok(t >= prev); prev = t; }
});

test('scrollYForStop is the inverse of nearestStop', () => {
  const n = 16, H = 16000, V = 1000;
  for (let i = 0; i < n; i++) assert.equal(nearestStop(progressFromScroll(scrollYForStop(i, n, H, V), H, V), n), i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '.../js/scroll.js'`

- [ ] **Step 3: Write `js/scroll.js`**

```js
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function progressFromScroll(scrollY, scrollHeight, viewport) {
  const max = scrollHeight - viewport;
  return max <= 0 ? 0 : clamp01(scrollY / max);
}

export const nearestStop = (progress, n) => (n <= 1 ? 0 : Math.round(clamp01(progress) * (n - 1)));

// Bus parks for the first and last 20% of each segment so the reader can read the stop.
const DWELL = 0.2;
const smooth = (x) => x * x * (3 - 2 * x);
export function routeT(progress, n) {
  if (n <= 1) return 0;
  const s = clamp01(progress) * (n - 1);
  const i = Math.min(Math.floor(s), n - 2);
  const f = s - i;
  const moved = f <= DWELL ? 0 : f >= 1 - DWELL ? 1 : smooth((f - DWELL) / (1 - 2 * DWELL));
  return (i + moved) / (n - 1);
}

export const scrollYForStop = (i, n, scrollHeight, viewport) =>
  (n <= 1 ? 0 : i / (n - 1)) * Math.max(0, scrollHeight - viewport);

export function watchScroll(cb) {
  const emit = () => cb(progressFromScroll(scrollY, document.documentElement.scrollHeight, innerHeight));
  addEventListener('scroll', emit, { passive: true });
  addEventListener('resize', emit);
  emit(); // reflect real position on load (reload mid-page, #hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/scroll.js tests/logic.test.mjs
git commit -m "feat: add scroll-to-route math with stop dwell"
```

---

### Task 3: Shell, panel UI and boot (works with no 3D)

**Files:**
- Replace: `index.html` (old one-page CV)
- Create: `css/style.css`, `js/ui.js`, `js/main.js`, `.claude/launch.json`
- Modify: `tests/logic.test.mjs` (append prefs tests)

**Interfaces:**
- Consumes: everything from Task 1; `watchScroll`, `nearestStop`, `scrollYForStop` from Task 2.
- Produces: `loadPrefs(storage) → {lang:'en'|'pt', theme:'day'|'night'}`; `savePref(storage, key, value)`; `initUI({ onGoto(i), onTheme(theme) }) → { setActive(i), theme, goto(i) }`. DOM ids used by Task 5: `#world` (canvas), `#year-sign` (div). Body classes: `no-webgl`, `world-ready`, `theme-night`.

- [ ] **Step 1: Append failing prefs test** to `tests/logic.test.mjs`

```js
import { loadPrefs, savePref } from '../js/ui.js';

test('prefs default and survive throwing storage', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadPrefs(throwing), { lang: 'en', theme: 'day' });
  assert.deepEqual(loadPrefs(undefined), { lang: 'en', theme: 'day' });
  assert.doesNotThrow(() => savePref(throwing, 'lang', 'pt'));
  const mem = new Map([['lang', 'pt'], ['theme', 'night']]);
  assert.deepEqual(loadPrefs({ getItem: k => mem.get(k) ?? null }), { lang: 'pt', theme: 'night' });
  assert.deepEqual(loadPrefs({ getItem: () => 'garbage' }), { lang: 'en', theme: 'day' });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '.../js/ui.js'`

- [ ] **Step 3: Write `js/ui.js`** (no DOM access at import time, so node can import it)

```js
import { stops, i18n, links, articles, repos, stack, sectionStart } from './content.js';

export function loadPrefs(storage) {
  try {
    return {
      lang: storage?.getItem('lang') === 'pt' ? 'pt' : 'en',
      theme: storage?.getItem('theme') === 'night' ? 'night' : 'day',
    };
  } catch { return { lang: 'en', theme: 'day' }; }
}
export function savePref(storage, key, value) { try { storage?.setItem(key, value); } catch { /* storage blocked */ } }

const store = () => { try { return localStorage; } catch { return undefined; } };
const flag = (c) => (c === 'BR' ? '🇧🇷' : '🇬🇧');

// ponytail: innerHTML from our own static content.js only; no user input reaches it.
function sectionHTML(section, t, active) {
  const s = t.sections[section];
  const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  switch (section) {
    case 'hero': return `
      <img class="avatar" src="assets/avatar.png" alt="" width="96" height="96">
      <h1>${s.title}</h1><p class="role">${s.role}</p><p class="meta">${s.meta}</p>
      <p class="tagline">${s.tagline}</p><p class="hint">${t.ui.scroll} ↓</p>`;
    case 'journey': return `
      <h2>${s.title}</h2><p>${s.intro}</p><ol class="stops">${stops.map((st, i) => {
        if (st.section !== 'journey') return '';
        const c = t.stops[st.id], on = i === active;
        return `<li class="${on ? 'on' : ''}"><button data-goto="${i}" aria-expanded="${on}">
          <span class="yr">${st.year}</span> <span aria-hidden="true">${flag(st.country)}</span> ${c.title}</button>
          ${on ? `<div class="detail"><strong>${c.role}</strong><small>${c.dates} · ${c.place}</small><p>${c.body}</p></div>` : ''}</li>`;
      }).join('')}</ol>`;
    case 'stack': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="chips">${stack.map(x => `<li>${x}</li>`).join('')}</ul>`;
    case 'articles': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="list">${articles.map(a => `<li>${ext(a.url, a.title)}</li>`).join('')}</ul><p>${ext(links.medium, s.more + ' ↗')}</p>`;
    case 'repos': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="list">${repos.map(r => `<li>${ext(r.url, r.name)} <small>${r.lang}</small></li>`).join('')}</ul><p>${ext(links.github + '?tab=repositories', s.more + ' ↗')}</p>`;
    case 'recs': return `<h2>${s.title}</h2><p>${s.intro}</p>${t.recs.map(r => `<blockquote><p>“${r.quote}”</p><footer>${r.name} · ${r.role}</footer></blockquote>`).join('')}`;
    case 'contact': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="list contact">
      <li><a href="${links.email}">${s.email}</a></li><li>${ext(links.linkedin, s.linkedin)}</li><li>${ext(links.github, s.github)}</li></ul>
      <p class="footer">${t.ui.footer}</p>`;
  }
}

export function initUI({ onGoto, onTheme }) {
  const prefs = loadPrefs(store());
  const panel = document.getElementById('panel');
  const sign = document.getElementById('year-sign');
  let active = -1;

  const applyTheme = () => {
    document.body.classList.toggle('theme-night', prefs.theme === 'night');
    onTheme(prefs.theme);
  };
  const render = () => {
    const t = i18n[prefs.lang];
    document.documentElement.lang = prefs.lang === 'pt' ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-nav]').forEach(a => { a.textContent = t.ui.nav[a.dataset.nav]; });
    document.querySelector('[data-lang]').textContent = prefs.lang === 'en' ? 'PT' : 'EN';
    document.querySelector('[data-lang]').setAttribute('aria-label', t.ui.lang);
    document.querySelector('[data-theme]').setAttribute('aria-label', t.ui.theme);
    const st = stops[Math.max(active, 0)];
    panel.innerHTML = sectionHTML(st.section, t, active);
    panel.dataset.section = st.section;
    sign.textContent = st.year;
    sign.dataset.country = st.country;
  };

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); onGoto(+go.dataset.goto); }
    if (e.target.closest('[data-nav-home]')) { e.preventDefault(); onGoto(0); }
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); onGoto(sectionStart(nav.dataset.nav)); history.replaceState(null, '', '#' + nav.dataset.nav); }
    if (e.target.closest('[data-lang]')) { prefs.lang = prefs.lang === 'en' ? 'pt' : 'en'; savePref(store(), 'lang', prefs.lang); render(); }
    if (e.target.closest('[data-theme]')) { prefs.theme = prefs.theme === 'day' ? 'night' : 'day'; savePref(store(), 'theme', prefs.theme); applyTheme(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey) return;
    if (e.key === 'j') onGoto(Math.min(active + 1, stops.length - 1));
    if (e.key === 'k') onGoto(Math.max(active - 1, 0));
  });

  applyTheme();
  return {
    get theme() { return prefs.theme; },
    setActive(i) { if (i !== active) { active = i; render(); } },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: all PASS.

- [ ] **Step 5: Write `js/main.js`**

```js
import { stops, SECTIONS, sectionStart } from './content.js';
import { watchScroll, nearestStop, scrollYForStop } from './scroll.js';
import { initUI } from './ui.js';

const n = stops.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.getElementById('track').style.height = `${n * 100}vh`;

let world = null;
let progress = 0;
const goto = (i) => scrollTo({
  top: scrollYForStop(i, n, document.documentElement.scrollHeight, innerHeight),
  behavior: reducedMotion ? 'auto' : 'smooth',
});
const ui = initUI({ onGoto: goto, onTheme: (t) => world?.setTheme(t) });

const hash = location.hash.slice(1);
if (SECTIONS.includes(hash)) goto(sectionStart(hash));

watchScroll((p) => {
  progress = p;
  ui.setActive(nearestStop(p, n));
  world?.setProgress(p);
});

const hasWebGL = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (hasWebGL()) {
  import('./world/scene.js')
    .then((m) => m.createWorld(document.getElementById('world'), stops, { reducedMotion }))
    .then((w) => { world = w; w.setTheme(ui.theme); w.setProgress(progress); document.body.classList.add('world-ready'); })
    .catch((err) => { console.warn('3D world unavailable:', err); document.body.classList.add('no-webgl'); });
} else {
  document.body.classList.add('no-webgl');
}
```

- [ ] **Step 6: Replace `index.html`**

Keep the existing `<head>` meta/OG/favicon tags from the old file (title, description, og:*, twitter:*, icons, manifest, canonical), updating `<title>` and descriptions to "Samuel Catalano — Senior Software Engineer, London". Then:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Samuel Catalano — Senior Software Engineer, London</title>
  <meta name="description" content="Ride a London double-decker through 17 years of backend engineering: Java, Spring Boot, Quarkus, Kafka, AWS.">
  <meta name="theme-color" content="#a9d8f5">
  <!-- keep existing og:/twitter:/icon/manifest/canonical tags from the previous index.html here -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Silkscreen&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js" } }</script>
  <script type="module" src="js/main.js"></script>
</head>
<body>
  <a class="skip" href="#panel">Skip to content</a>
  <canvas id="world" aria-hidden="true"></canvas>
  <div id="year-sign" aria-hidden="true"></div>
  <header class="bar">
    <a class="brand" href="#hero" data-nav-home>SAMUEL<span>/</span>CATALANO</a>
    <nav aria-label="Sections">
      <a href="#journey" data-nav="journey">Journey</a>
      <a href="#stack" data-nav="stack">Stack</a>
      <a href="#articles" data-nav="articles">Writing</a>
      <a href="#repos" data-nav="repos">Code</a>
      <a href="#contact" data-nav="contact">Contact</a>
      <button type="button" data-lang>PT</button>
      <button type="button" data-theme>☀︎</button>
    </nav>
  </header>
  <main id="panel" class="panel" aria-live="polite" tabindex="-1"></main>
  <div id="track" aria-hidden="true"></div>
  <noscript><p class="panel">Samuel Catalano — Senior Software Engineer, London. samuel.catalano@gmail.com · linkedin.com/in/samuelcatalano · github.com/samuelcatalano</p></noscript>
</body>
</html>
```

- [ ] **Step 7: Write `css/style.css`**

```css
:root {
  --sky: #a9d8f5; --sky2: #e8f4fb; --ink: #1d1d1f; --muted: #5b6270;
  --card: rgba(255,255,255,.92); --line: #1d1d1f; --red: #d6211f; --accent: #d6211f;
  --pixel: 'Silkscreen', monospace; --sans: 'Inter', system-ui, sans-serif;
}
body.theme-night { --sky: #0d1b3a; --sky2: #1b2c55; --ink: #f2f2f2; --muted: #aab3c5; --card: rgba(18,24,40,.92); --line: #f2f2f2; }
* { box-sizing: border-box; }
html { scroll-behavior: auto; }
body { margin: 0; font: 15px/1.5 var(--sans); color: var(--ink); background: linear-gradient(var(--sky), var(--sky2)); min-height: 100vh; }
#world { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; }
#track { width: 1px; }
.skip { position: absolute; left: -999px; } .skip:focus { left: 16px; top: 16px; z-index: 10; background: var(--card); padding: 8px; }

.bar { position: fixed; top: 16px; left: 16px; right: 16px; display: flex; justify-content: space-between; gap: 8px; z-index: 5; pointer-events: none; }
.bar > * { pointer-events: auto; }
.brand, .bar nav { background: var(--card); border: 2px solid var(--line); box-shadow: 3px 3px 0 var(--line); padding: 6px 10px; font: 12px var(--pixel); color: var(--ink); text-decoration: none; }
.brand span { color: var(--accent); }
.bar nav { display: flex; gap: 12px; align-items: center; }
.bar nav a, .bar nav button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; text-decoration: none; padding: 2px; }
.bar nav a:hover, .bar nav button:hover { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.panel { position: fixed; top: 80px; left: 16px; width: min(400px, calc(100vw - 32px)); max-height: calc(100vh - 110px); overflow: auto;
  background: var(--card); border: 2px solid var(--line); box-shadow: 4px 4px 0 var(--line); padding: 20px; z-index: 4; }
.panel h1 { font: 34px/1.1 var(--pixel); margin: 8px 0; }
.panel h2 { font: 24px var(--pixel); margin: 0 0 8px; }
.panel .role { font-weight: 600; margin: 0; } .panel .meta, .panel small { color: var(--muted); }
.panel .tagline { font-style: italic; } .panel .hint { font: 11px var(--pixel); }
.avatar { border: 2px solid var(--line); background: var(--sky); image-rendering: auto; }
.stops { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--line); }
.stops li { border-bottom: 1px solid color-mix(in srgb, var(--line) 25%, transparent); }
.stops button { width: 100%; text-align: left; background: none; border: 0; padding: 10px 4px; font: inherit; color: inherit; cursor: pointer; }
.stops .yr { font: 12px var(--pixel); color: var(--muted); }
.stops li.on { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.stops li.on .yr { color: var(--accent); }
.detail { padding: 0 8px 12px; } .detail small { display: block; }
.chips { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.chips li { border: 2px solid var(--line); padding: 2px 8px; font: 11px var(--pixel); }
.list { padding-left: 18px; } .list a, .panel a { color: var(--accent); }
blockquote { margin: 12px 0; padding-left: 12px; border-left: 4px solid var(--accent); }
blockquote footer { font-size: 12px; color: var(--muted); }
.footer { font-size: 12px; color: var(--muted); margin-top: 24px; }

#year-sign { position: fixed; left: 0; top: 0; z-index: 3; font: 28px var(--pixel); color: #fff; background: var(--red);
  border: 3px solid #111; padding: 4px 12px; pointer-events: none; transform: translate(-50%, -100%); white-space: nowrap; display: none; }
#year-sign[data-country="BR"]::after { content: ' 🇧🇷'; }
body.world-ready #year-sign { display: block; }

body.no-webgl { background: linear-gradient(var(--sky), var(--sky2) 70%, #6aa86a 70%); }
body.no-webgl #world { display: none; }

@media (max-width: 767px) {
  .bar nav a { display: none; }
  .panel { top: auto; bottom: 12px; left: 12px; width: calc(100vw - 24px); max-height: 45vh; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

- [ ] **Step 8: Add `.claude/launch.json`**

```json
{ "version": "0.0.1", "configurations": [
  { "name": "site", "runtimeExecutable": "python3", "runtimeArgs": ["-m", "http.server", "8000"], "port": 8000 } ] }
```

- [ ] **Step 9: Verify in browser**

`preview_start` name `site` → `http://localhost:8000`. Expected (3D not built yet, so the dynamic import fails → `no-webgl` class with a console warning, which is expected here):
- Hero card shows avatar, name, role.
- Scrolling changes the panel: journey list highlights 2003 → … → 2024, then Stack, Writing, Code, Kind words, Contact.
- Nav links jump to sections; `j`/`k` step stops; PT toggle swaps all copy; theme toggle switches palette; reload keeps both.
- `http://localhost:8000/#contact` opens on Contact.
- Width 375px: panel is a bottom sheet, no horizontal scroll.

- [ ] **Step 10: Commit**

```bash
git add index.html css/style.css js/ui.js js/main.js tests/logic.test.mjs .claude/launch.json
git commit -m "feat: scroll-driven bilingual panel shell"
```

---

### Task 4: Pure world layout + voxel builder

**Files:**
- Create: `js/world/layout.js`, `js/world/voxel.js`
- Modify: `tests/logic.test.mjs` (append)

**Interfaces:**
- Produces (layout.js, no three import): `STOP_SPACING = 30`; `routePoints(n) → Array<{x, z}>`; `LANDMARKS: {heathrow, bigben, eye, towerbridge, wembley} → stop id`; `stopIndex(stops, id) → int`; `rng(seed) → () => [0,1)`; `RIVER_Z = -45`.
- Produces (voxel.js): `createBoxes() → { add(x, y, z, w, h, d, color), list }` where `(x, z)` is the box centre and `y` its base; `buildMeshes(list, { glow = [] }) → THREE.Group` (one `InstancedMesh` per colour; colours in `glow` get `material.userData.glow = true`).

- [ ] **Step 1: Append failing tests**

```js
import { routePoints, LANDMARKS, stopIndex, rng, STOP_SPACING } from '../js/world/layout.js';
import { stops } from '../js/content.js';

test('route has one point per stop, increasing x', () => {
  const pts = routePoints(stops.length);
  assert.equal(pts.length, stops.length);
  pts.slice(1).forEach((p, i) => assert.equal(p.x - pts[i].x, STOP_SPACING));
});

test('every landmark is anchored to an existing stop', () => {
  for (const id of Object.values(LANDMARKS)) assert.ok(stopIndex(stops, id) >= 0, id);
});

test('rng is deterministic', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '.../js/world/layout.js'`

- [ ] **Step 3: Write `js/world/layout.js`**

```js
// Pure layout data: no three import, so node tests can load it.
export const STOP_SPACING = 30;
export const RIVER_Z = -45;

export const routePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: (i - (n - 1) / 2) * STOP_SPACING,
  z: Math.round(12 * Math.sin(i * 0.7)),
}));

export const LANDMARKS = {
  heathrow: 'millimetric', // landing in London, 2020
  bigben: 'xdesign',
  eye: 'olm',
  towerbridge: 'tribal',
  wembley: 'contact',      // Samuel lives in Wembley: last stop
};

export const stopIndex = (stops, id) => stops.findIndex((s) => s.id === id);

export function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Write `js/world/voxel.js`**

```js
import * as THREE from 'three';

export function createBoxes() {
  const list = [];
  return { list, add(x, y, z, w, h, d, color) { list.push({ x, y, z, w, h, d, color }); } };
}

// One InstancedMesh per colour; each box is a scaled unit cube, so a 4x30x4 tower is one instance.
export function buildMeshes(list, { glow = [] } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const byColor = new Map();
  for (const b of list) (byColor.get(b.color) ?? byColor.set(b.color, []).get(b.color)).push(b);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [color, boxes] of byColor) {
    const mat = new THREE.MeshLambertMaterial({ color });
    mat.userData.glow = glow.includes(color);
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d))));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/world/layout.js js/world/voxel.js tests/logic.test.mjs
git commit -m "feat: world layout and instanced voxel builder"
```

---

### Task 5: Scene, route, bus (first visible 3D)

**Files:**
- Create: `js/world/scene.js`, `js/world/bus.js`

**Interfaces:**
- Consumes: `routeT` (Task 2), `routePoints`, `RIVER_Z` (Task 4), `createBoxes`, `buildMeshes` (Task 4), `#year-sign` (Task 3). Calls `buildCity(add, stops, pts)` and `buildLandmarks(add, stops, pts) → { eye: THREE.Group, plane: THREE.Group, planeAt: number }` from Tasks 6–7; until those exist, use the stub imports given in Step 1.
- Produces: `createWorld(canvas, stops, { reducedMotion }) → Promise<{ setProgress(p), setTheme('day'|'night'), dispose() }>`; `buildBus() → THREE.Group` (faces +x, length 11, top at y≈8).

- [ ] **Step 1: Create temporary stubs** so this task runs alone (Tasks 6–7 replace them):

`js/world/city.js`
```js
export function buildCity(add, stops, pts) {
  add(0, -1, 0, pts.length * 40, 1, 160, '#7cb66b');
}
```
`js/world/landmarks.js`
```js
import * as THREE from 'three';
export function buildLandmarks() { return { eye: new THREE.Group(), plane: new THREE.Group(), planeAt: -1 }; }
```

- [ ] **Step 2: Write `js/world/bus.js`**

```js
import * as THREE from 'three';
import { createBoxes, buildMeshes } from './voxel.js';

const RED = '#d6211f', DARK = '#1b1b1b', GLASS = '#bfe3ff', CREAM = '#f3ead2', YELLOW = '#ffd23f';

export function buildBus() {
  const { add, list } = createBoxes();
  add(0, 0.8, 0, 11, 6.6, 3.6, RED);                  // body, both decks
  add(0, 7.4, 0, 10.6, 0.5, 3.4, RED);                // roof
  add(0, 4.0, 0, 11.05, 0.4, 3.65, CREAM);            // between-deck stripe
  for (const deck of [1.9, 4.9]) {                    // window rows, both sides
    for (let i = -4; i <= 3; i++) {
      add(i * 1.25 + 0.3, deck, 1.81, 1, 1.4, 0.05, GLASS);
      add(i * 1.25 + 0.3, deck, -1.81, 1, 1.4, 0.05, GLASS);
    }
  }
  add(5.51, 4.9, 0, 0.05, 1.6, 3, GLASS);             // upper front window (avatar sits here)
  add(5.51, 1.9, 0.6, 0.05, 1.6, 1.8, GLASS);         // driver window
  add(5.52, 3.6, 0, 0.05, 0.4, 2.4, YELLOW);          // destination board
  add(5.52, 1.0, 1.4, 0.06, 0.4, 0.4, '#fff7c2');     // headlights
  add(5.52, 1.0, -1.4, 0.06, 0.4, 0.4, '#fff7c2');
  for (const x of [-3.5, 3.5]) for (const z of [1.7, -1.7]) add(x, 0, z, 1.6, 1.6, 0.6, DARK); // wheels
  const bus = buildMeshes(list, { glow: ['#fff7c2', YELLOW] });

  const tex = new THREE.TextureLoader().load('assets/avatar.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  avatar.scale.set(1.8, 1.8, 1);
  avatar.position.set(4.6, 5.7, 0);
  bus.add(avatar);
  return bus;
}
```

- [ ] **Step 3: Write `js/world/scene.js`**

```js
import * as THREE from 'three';
import { routeT } from '../scroll.js';
import { routePoints } from './layout.js';
import { createBoxes, buildMeshes } from './voxel.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildBus } from './bus.js';

const THEMES = {
  day: { sky: 0xa9d8f5, fog: 0xcfe8f7, sun: 1.6, hemi: 1.1, glow: 0x000000 },
  night: { sky: 0x0d1b3a, fog: 0x14244a, sun: 0.25, hemi: 0.35, glow: 0xffc85a },
};
const CAM_OFFSET = new THREE.Vector3(-22, 20, 30);

export async function createWorld(canvas, stops, { reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 767px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = !mobile;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe8f7, 80, 260);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 600);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 300 });
  scene.add(hemi, sun, sun.target);

  const pts = routePoints(stops.length);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const { add, list } = createBoxes();
  buildCity(add, stops, pts, curve);
  const { eye, plane, planeAt } = buildLandmarks(add, stops, pts);
  const world = buildMeshes(list, { glow: ['#ffd86b', '#fff7c2'] });
  const bus = buildBus();
  scene.add(world, eye, plane, bus);

  const sign = document.getElementById('year-sign');
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let target = 0, current = 0, raf = 0;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const place = (t, snap) => {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    bus.position.copy(p);
    bus.rotation.y = Math.atan2(-tan.z, tan.x);
    const wantCam = tmp.copy(p).add(CAM_OFFSET);
    if (snap) { camPos.copy(wantCam); look.copy(p); } else { camPos.lerp(wantCam, 0.12); look.lerp(p, 0.12); }
    camera.position.copy(camPos);
    camera.lookAt(look);
    sun.position.set(p.x + 40, 80, p.z + 30);
    sun.target.position.copy(p);
  };

  const updateSign = () => {
    tmp.copy(bus.position).setY(11).project(camera);
    sign.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  };

  const updatePlane = (p) => {
    const d = (p - planeAt) * (stops.length - 1); // -1..1 around the 2020 stop
    plane.visible = planeAt >= 0 && Math.abs(d) < 1;
    if (plane.visible) plane.position.set(bus.position.x + d * 60, 30 - Math.max(0, d) * 18, -20);
  };

  const loop = (time) => {
    current = reducedMotion ? target : current + (target - current) * 0.1;
    place(routeT(current, stops.length), reducedMotion);
    if (!reducedMotion) eye.rotation.z = time * 0.0001;
    updatePlane(current);
    renderer.render(scene, camera);
    updateSign();
    raf = requestAnimationFrame(loop);
  };

  return {
    setProgress(p) { target = p; },
    setTheme(name) {
      const t = THEMES[name] ?? THEMES.day;
      scene.background = new THREE.Color(t.sky);
      scene.fog.color.set(t.fog);
      sun.intensity = t.sun;
      hemi.intensity = t.hemi;
      scene.traverse((o) => { if (o.material?.userData?.glow) o.material.emissive.set(t.glow); });
      if (!raf) { current = target; place(routeT(target, stops.length), true); raf = requestAnimationFrame(loop); }
    },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
  };
}
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:8000`. Expected: body gets `world-ready`; sky-coloured background, green ground, the red bus with avatar in the upper front window; scrolling moves the bus along the route and the camera follows; the bus parks at each stop; the red year sign floats above the bus and changes 2003 → 2024 → STACK … NOW; BR stops show 🇧🇷. Theme toggle darkens the sky and lights the headlights. No console errors. Resize the window: no stretching.

- [ ] **Step 5: Commit**

```bash
git add js/world/scene.js js/world/bus.js js/world/city.js js/world/landmarks.js
git commit -m "feat: three.js scene with scroll-driven double-decker"
```

---

### Task 6: City — ground, Thames, road, buildings, Brazil stretch

**Files:**
- Replace stub: `js/world/city.js`

**Interfaces:**
- Consumes: `add(x, y, z, w, h, d, color)` (Task 4), `stops`, `pts` from `routePoints`, `curve` (`THREE.CatmullRomCurve3`), `RIVER_Z`, `rng` (Task 4).
- Produces: `buildCity(add, stops, pts, curve)` — returns nothing; adds boxes. Window colour `#ffd86b` (glows at night).

- [ ] **Step 1: Write `js/world/city.js`**

```js
import { RIVER_Z, rng } from './layout.js';

const GRASS = '#7cb66b', ROAD = '#3b3f46', LINE = '#f4f4f4', WATER = '#4f86b8', BANK = '#b9a98a';
const UK_WALLS = ['#c9b79c', '#b8a48a', '#d9cdb8', '#9c7b65', '#e2d6c2', '#8d8f94'];
const BR_WALLS = ['#f4d35e', '#ee964b', '#4ecdc4', '#f95738', '#90be6d', '#f7f7f2'];
const ROOF = '#5b4b49', WINDOW = '#ffd86b', TRUNK = '#7a5230', LEAF = '#3f8f3f', PALM = '#2f9e44';

export function buildCity(add, stops, pts, curve) {
  const r = rng(2026);
  const span = pts.length * 30 + 120;

  add(0, -1, 0, span, 1, 200, GRASS);                       // ground
  add(0, -0.9, RIVER_Z, span, 1, 22, WATER);                // Thames
  add(0, -0.95, RIVER_Z + 12, span, 1, 2, BANK);
  add(0, -0.95, RIVER_Z - 12, span, 1, 2, BANK);

  // Road: overlapping square tiles along the curve keep the blocky look.
  const N = pts.length * 20;
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    add(p.x, -0.2, p.z, 7, 0.2, 7, ROAD);
    if (i % 3 === 0) add(p.x, -0.05, p.z, 1.2, 0.06, 0.3, LINE);
  }

  // Buildings beside each stop. Brazil stops are low and colourful with palms; London is taller and stone-coloured.
  pts.forEach((p, i) => {
    const br = stops[i].country === 'BR';
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const x = p.x - 12 + k * 5 + r() * 2;
      const z = p.z + side * (12 + r() * 10);
      if (Math.abs(z - RIVER_Z) < 16) continue;
      const w = 4 + Math.floor(r() * 3), d = 4 + Math.floor(r() * 3);
      const h = br ? 3 + Math.floor(r() * 4) : 6 + Math.floor(r() * 12);
      const walls = br ? BR_WALLS : UK_WALLS;
      add(x, 0, z, w, h, d, walls[Math.floor(r() * walls.length)]);
      add(x, h, z, w + 0.4, 0.6, d + 0.4, ROOF);
      for (let y = 1.5; y < h - 1; y += 2.5) {               // window strips facing the road
        add(x, y, z - side * (d / 2 + 0.02), w - 1, 1, 0.05, WINDOW);
      }
    }
    for (let k = 0; k < 3; k++) {                            // trees / palms
      const x = p.x - 10 + r() * 20, z = p.z + (r() > 0.5 ? 1 : -1) * (6 + r() * 3);
      if (br) { add(x, 0, z, 0.6, 5, 0.6, TRUNK); add(x, 5, z, 3.5, 0.6, 1, PALM); add(x, 5, z, 1, 0.6, 3.5, PALM); }
      else { add(x, 0, z, 0.6, 2, 0.6, TRUNK); add(x, 2, z, 2.4, 2.4, 2.4, LEAF); }
    }
    if (!br && i % 2 === 0) {                                // red phone box
      add(p.x + 4, 0, p.z + 5.5, 1.2, 2.6, 1.2, '#c8102e');
      add(p.x + 4, 2.6, p.z + 5.5, 1.4, 0.3, 1.4, '#a00d25');
    }
  });
}
```

- [ ] **Step 2: Verify in browser**

Expected: river runs behind the road the whole way; early stops (2003–2017) show colourful low houses and palms; from 2020 on, taller stone buildings and red phone boxes; windows glow at night. FPS stays smooth (Chrome DevTools performance overlay ≥ 50fps on desktop).

- [ ] **Step 3: Commit**

```bash
git add js/world/city.js
git commit -m "feat: voxel city with Thames and Brazil stretch"
```

---

### Task 7: Landmarks and the 2020 plane

**Files:**
- Replace stub: `js/world/landmarks.js`

**Interfaces:**
- Consumes: `add` (Task 4), `stops`, `pts`, `LANDMARKS`, `stopIndex`, `RIVER_Z` (Task 4), `createBoxes`, `buildMeshes` (Task 4).
- Produces: `buildLandmarks(add, stops, pts) → { eye: THREE.Group (rotate on z), plane: THREE.Group, planeAt: number /* progress 0..1 of heathrow stop */ }`.

- [ ] **Step 1: Write `js/world/landmarks.js`**

```js
import { createBoxes, buildMeshes } from './voxel.js';
import { LANDMARKS, stopIndex, RIVER_Z } from './layout.js';

const STONE = '#d8c08a', SLATE = '#2f3b45', WHITE = '#f4f4f4', GOLD = '#e0b84a', STEEL = '#6b8fb5';

const at = (stops, pts, key) => pts[stopIndex(stops, LANDMARKS[key])];

function bigBen(add, { x }) {
  const z = RIVER_Z + 20;
  add(x, 0, z, 5, 26, 5, STONE);
  add(x, 26, z, 6, 6, 6, STONE);                 // clock section
  for (const [dx, dz] of [[3.02, 0], [-3.02, 0], [0, 3.02], [0, -3.02]]) add(x + dx, 27, z + dz, dx ? 0.05 : 4, 4, dz ? 0.05 : 4, WHITE);
  add(x, 32, z, 5, 2, 5, SLATE);
  add(x, 34, z, 3.5, 2, 3.5, SLATE);
  add(x, 36, z, 2, 3, 2, SLATE);
  add(x, 39, z, 0.5, 3, 0.5, GOLD);
  add(x + 14, 0, z, 22, 10, 8, STONE);           // Parliament block
}

function towerBridge(add, { x }) {
  for (const dx of [-9, 9]) {
    add(x + dx, -1, RIVER_Z, 6, 24, 6, STONE);
    add(x + dx, 23, RIVER_Z, 6.6, 3, 6.6, SLATE);
    for (const c of [-2.5, 2.5]) add(x + dx + c, 26, RIVER_Z + c, 1, 3, 1, SLATE);
  }
  add(x, 4, RIVER_Z, 12, 1.2, 6, STEEL);         // road deck
  add(x, 19, RIVER_Z - 1.5, 12, 1.5, 1.2, STEEL); // high walkways
  add(x, 19, RIVER_Z + 1.5, 12, 1.5, 1.2, STEEL);
}

function wembley(add, { x, z }) {
  const cz = z - 32;
  for (let a = 0; a < 360; a += 15) {            // stadium bowl
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 16, 0, cz + Math.sin(r) * 11, 5, 9, 5, '#c7c9cc');
  }
  add(x, 0, cz, 22, 0.5, 14, '#4c9a4c');         // pitch
  for (let a = 0; a <= 180; a += 6) {            // the arch
    const r = (a * Math.PI) / 180;
    add(x + Math.cos(r) * 20, Math.sin(r) * 34, cz, 1.4, 1.4, 1.4, WHITE);
  }
}

function heathrow(add, { x, z }) {
  const rz = z + 34;
  add(x, -0.15, rz, 70, 0.2, 8, '#2e3238');
  for (let i = -30; i <= 30; i += 6) add(x + i, -0.05, rz, 3, 0.06, 0.5, WHITE);
  add(x - 8, 0, rz - 12, 20, 6, 8, '#8fb8d8');   // terminal glass
  add(x + 10, 0, rz - 12, 2, 14, 2, '#d9d9d9');  // control tower
  add(x + 10, 14, rz - 12, 4, 2.5, 4, '#8fb8d8');
}

function londonEye(x) {
  const { add, list } = createBoxes();
  for (let a = 0; a < 360; a += 6) {
    const r = (a * Math.PI) / 180;
    add(Math.cos(r) * 16, Math.sin(r) * 16, 0, 1, 1, 1, WHITE);
    if (a % 30 === 0) add(Math.cos(r) * 17.5, Math.sin(r) * 17.5, 0, 1.6, 1.4, 1.6, '#bfe3ff'); // capsules
  }
  for (let a = 0; a < 360; a += 45) {
    const r = (a * Math.PI) / 180;
    for (let k = 2; k < 16; k += 2) add(Math.cos(r) * k, Math.sin(r) * k, 0, 0.4, 0.4, 0.4, WHITE);
  }
  const eye = buildMeshes(list);
  eye.position.set(x, 18, RIVER_Z + 13);
  return eye;
}

function plane() {
  const { add, list } = createBoxes();
  add(0, 0, 0, 12, 2, 2, WHITE);                 // fuselage
  add(1, 0.6, 0, 3, 0.4, 14, '#d0d4da');         // wings
  add(-5.5, 1, 0, 1.5, 3, 0.4, '#1e3a8a');       // tail
  add(-5.5, 1.5, 0, 1.5, 0.3, 5, '#d0d4da');
  return buildMeshes(list);
}

export function buildLandmarks(add, stops, pts) {
  heathrow(add, at(stops, pts, 'heathrow'));
  bigBen(add, at(stops, pts, 'bigben'));
  towerBridge(add, at(stops, pts, 'towerbridge'));
  wembley(add, at(stops, pts, 'wembley'));
  const i = stopIndex(stops, LANDMARKS.heathrow);
  return {
    eye: londonEye(at(stops, pts, 'eye').x),
    plane: plane(),
    planeAt: i / (stops.length - 1),
  };
}
```

- [ ] **Step 2: Verify in browser**

Expected: arriving at 2020 the plane descends past the bus towards the Heathrow runway; Big Ben by xDesign; the Eye turns slowly by OLM (static with reduced motion, via DevTools → Rendering → emulate `prefers-reduced-motion`); Tower Bridge spans the Thames at Tribal; the Wembley arch frames the last stop. All recognisable from the default camera angle; adjust `CAM_OFFSET` in `scene.js` or landmark offsets if one is hidden by buildings.

- [ ] **Step 3: Commit**

```bash
git add js/world/landmarks.js
git commit -m "feat: London landmarks and 2020 arrival plane"
```

---

### Task 8: Robustness pass (fallbacks, mobile, a11y)

**Files:**
- Modify only if a check fails: `js/main.js`, `js/world/scene.js`, `css/style.css`, `js/ui.js`

- [ ] **Step 1: Run the Review Focus checks** in the browser at `http://localhost:8000`:
  1. Scroll to top and bottom quickly: hero/contact active, no NaN in sign transform (`document.getElementById('year-sign').style.transform`).
  2. DevTools console: `localStorage.setItem = () => { throw new Error() }` then toggle lang/theme: no errors.
  3. Block `cdn.jsdelivr.net` (DevTools → Network request blocking) and reload: `no-webgl` class, static sky, panel works, only one console warning.
  4. Open `/#journey` and reload at mid-page: bus and panel match the scroll position.
  5. Resize 1280 → 375 → 1280 while mid-route: no stretched canvas, panel switches to bottom sheet and back.
- [ ] **Step 2: Accessibility audit** — run the `accesslint:scan` skill against `http://localhost:8000`. Fix any violations (common ones: contrast of `--muted` at night, button names). Target: zero serious/critical.
- [ ] **Step 3: Lighthouse** — via chrome-devtools `lighthouse_audit` on desktop: a11y ≥ 95, performance ≥ 80. If performance is low, lower `N` road tiles in `city.js` (e.g. `pts.length * 12`) and shadow map to 1024.
- [ ] **Step 4: Run tests** — `node --test tests/` → all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A js css
git commit -m "fix: fallback, mobile and accessibility pass"
```

---

### Task 9: Privacy cleanup, metadata, README

**Files:**
- Delete: `RESUME - Full_Version.pdf` (contains home address and phone)
- Modify: `README.md`, `sitemap.xml` (lastmod), `social-preview.html` only if it references removed content
- Keep: `Sammy.png` only if still referenced (`grep -r Sammy.png .`), otherwise delete.

- [ ] **Step 1: Remove the PDF from the working tree**

```bash
git rm "RESUME - Full_Version.pdf"
```
Note for Samuel: the file remains in git history and was already public. Purging it needs a history rewrite + force push (`git filter-repo`); only do that on his explicit instruction.

- [ ] **Step 2: Rewrite `README.md`** — one paragraph on what the site is, the local preview command (`python3 -m http.server 8000`), test command (`node --test tests/`), deploy (push to `main`, Pages from root), and a pointer to `CLAUDE.md` and `docs/`.

- [ ] **Step 3: Link check (Haiku 5.5 subagent)** — "Fetch every external URL in `js/content.js` and report any non-200 status. Do not edit files."

- [ ] **Step 4: Final verification** — full CLAUDE.md matrix: desktop + 375px, day/night, EN/PT, WebGL blocked, reduced motion, no console errors; `node --test tests/` passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove CV with private data, update README"
```

- [ ] **Step 6: Ask Samuel before pushing** (push to `main` deploys publicly).
