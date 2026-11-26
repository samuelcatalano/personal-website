import { stops, i18n, links, articles, repos, stackGroups, toolStops, toolSpan, credits, sectionStart, cityOf, QUICK, yearText, yearStack } from './content.js';
// Stored choice wins; first-time visitors get PT for pt-* browsers and a light theme.
export function loadPrefs(storage, env = {}) {
  const fallback = { lang: String(env.lang || '').toLowerCase().startsWith('pt') ? 'pt' : 'en', theme: 'day' };
  try {
    const lang = storage?.getItem('lang'), theme = storage?.getItem('theme');
    return { lang: lang === 'pt' || lang === 'en' ? lang : fallback.lang, theme: theme === 'night' || theme === 'day' ? theme : fallback.theme };
  } catch { return fallback; }
}
export function savePref(storage, key, value) { try { storage?.setItem(key, value); } catch { /* storage blocked */ } }
const store = () => { try { return localStorage; } catch { return undefined; } };
import { speak, hush, voiceSupported, hasVoice, whenDone } from './announce.js';
import { arrivalDing } from './sound.js';
import { QUICK_TOUR_S } from './autoride.js';
import { tripState } from './scroll.js';
// Roundel flags for the language switch (plain SVG: emoji flags do not draw on every system). Each fills a circle, cropped from its middle.
const FLAGS = {
  en: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="60" height="30" fill="#1b2d6b"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0 60 30M60 0 0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
  pt: '<svg viewBox="0 0 20 14" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#1a9a4b"/><path d="M10 1.3 18.5 7 10 12.7 1.5 7z" fill="#f7d417"/><circle cx="10" cy="7" r="3.4" fill="#1b2d6b"/><path d="M6.7 6.4q3.4-1.2 6.8 1.1" fill="none" stroke="#fff" stroke-width=".7"/></svg>',
};
const flag = (c) => (c === 'BR' ? '🇧🇷' : '🇬🇧');
const journeyTotal = stops.filter(st => st.section === 'journey').length;
const journeySeenCount = (seenSet) => tripState(stops, -1, seenSet).count; // the one count the header, the panel and the LED share
let postcardUrl = ''; // the thumbnail of the last stop's view, set by main.js once the bus has arrived
const FOUND = ['hide', 'postcard']; // small finds: hiding the interface, saving a postcard
// ponytail: 2 s of travel per stop; dwell values mirror main.js (3400 ms full auto-ride, 1600 ms quick tour)
const rideSeconds = (n, dwellMs) => Math.round(n * (dwellMs + 2000) / 1000);
const quickSeconds = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? rideSeconds(stops.length, 1600) : QUICK_TOUR_S); // the steady pass, or every stop snapped when motion is reduced
// ponytail: 3 s on a stop runs its ceremony (the spoken line, the punch, a new city's stamp). Counting does not wait for it: every stop the bus goes through is visited (passed).
function visitAfterMs() { return 3000; }
const cityStops = (c) => stops.flatMap((st, i) => (st.section === 'journey' && cityOf(st) === c ? [i] : [])); // the journey stop indices in one city
const clockNow = () => new Intl.DateTimeFormat(document.documentElement.lang.startsWith('pt') ? 'pt-BR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const journeyLine = (t, seenSet) => { // the counter the journey panel shows; rebuilt in place when a stop is confirmed
  const count = journeySeenCount(seenSet);
  // one stamp per stop, grouped by city; decorative, the count and the bar already say it
  const passport = Object.keys(t.ui.cities).map((c) => `<div class="jp-city"><b>${t.ui.cities[c]}</b><span class="jp-stamps">${cityStops(c).map((i) => `<i class="${seenSet.has(i) ? 'on' : ''}"></i>`).join('')}</span></div>`).join('');
  const validated = count === journeyTotal ? `<p class="validated-stamp">${t.ui.intro.validated.replace('{time}', clockNow())}</p>` : ''; // all 12 stops: the same stamp the intro ticket gets
  return `<div class="journey-progress"><span>${count ? t.ui.progress.replace('{count}', count).replace('{total}', journeyTotal) : t.ui.progressEmpty.replace('{quick}', quickSeconds())}</span><progress value="${count}" max="${journeyTotal}">${count}/${journeyTotal}</progress><div class="jp-passport" aria-hidden="true">${passport}</div>${validated}</div>`;
};
const ticketMeta = (t, tool) => { const s = toolSpan(tool); return `${t.ui.ticketSince.replace('{year}', s.since)} · ${t.ui.ticketStops.replace('{n}', s.count)}`; };
const QUICK_MS = 1500; // ponytail: just under the quick tour's 1600 ms stop, so quick stops count on that path only
const nextButton = (t, seenSet, at) => { // the career stop after the one the bus is at; past the last one, a plain "Final stop" line
  const i = tripState(stops, at, seenSet).next;
  return i < 0 ? `<p class="next-final"><span class="next-node" aria-hidden="true"></span><span class="next-text"><small>${t.ui.nextStop}</small><b>${t.ui.finalStop}</b></span></p>` : `<button type="button" class="next-stop" data-next="${i}"><span class="next-node" aria-hidden="true"></span><span class="next-text"><small>${t.ui.nextStop}</small><b>${stops[i].year} ${t.stops[stops[i].id].title}</b></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg></button>`;
};
const routeStrip = (t, route) => `<ol class="route-strip" aria-label="${t.ui.recap.route}">${stops.map((st, i) => (st.section === 'journey' ? `<li class="${st.country.toLowerCase()}${route.seen.has(i) ? ' seen' : ''}"><span class="sr-only">${t.stops[st.id].title}</span></li>` : '')).join('')}</ol>`;
const camera = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
const recap = (t, route) => { // the return ticket: the route as a strip of stops, the passport stamps on the stub, then the postcard of the last view
  const r = t.ui.recap, cityKeys = Object.keys(t.ui.cities), reached = journeySeenCount(route.seen);
  const line = !reached ? r.skipped.replace('{total}', journeyTotal) : reached === journeyTotal ? t.ui.finishComplete.replace('{total}', journeyTotal) : t.ui.finishContinue.replace('{count}', reached).replace('{total}', journeyTotal);
  return `<section class="ticket return" aria-label="${r.title}">
    <div class="ticket-head"><p class="ticket-title">${r.title}</p><p class="ticket-blind" aria-hidden="true">${t.ui.led.end}</p></div>
    <div class="ticket-body">${routeStrip(t, route)}<p class="route-line">${line}</p>${reached ? '' : `<p class="recap-reset"><button type="button" class="btn-lite" data-reset>${t.ui.reset}</button></p>`}</div>
    <div class="ticket-stub">
      <div class="passport" aria-label="${t.ui.passport} ${route.cities.size}/${cityKeys.length}">${cityKeys.map(c => `<span class="${route.cities.has(c) ? 'got' : ''}">${t.ui.cities[c]}</span>`).join('')}</div>
      <p class="ticket-label found-line">${r.found} <b>${route.found.size}/${FOUND.length}</b></p>
    </div>
  </section>
  <div class="postcard-card"><figure class="postcard-preview" data-postcard-preview${postcardUrl ? '' : ' hidden'}><img src="${postcardUrl}" alt="" width="320" height="200" decoding="async" draggable="false"></figure>
    <button type="button" class="postcard-btn" data-photo-link>${camera}${t.ui.photo}</button></div>
  ${reached ? `<p class="recap-reset"><button type="button" class="linkish" data-reset>${t.ui.reset}</button></p>` : ''}`;
};
// ponytail: innerHTML from static content.js only
function sectionHTML(section, t, active, tool = null, route = { seen: new Set(), stamped: new Set(), cities: new Set(), found: new Set() }) {
  const seenSet = route.seen;
  const s = t.sections[section], latest = t.stops[stops.findLast(st => st.section === 'journey').id];
  const ext = (href, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${href}" target="_blank" rel="noopener">${text}</a>`;
  const ic = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const mail = ic('M3 5h18v14H3zm2 2v.5l7 5 7-5V7zm14 3-7 5-7-5V17h14z');
  const inn = ic('M3 3h18v18H3zm3 6v9h3V9zm1.5-3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM11 9v9h3v-5c0-1.5 2-1.600 2 0v5h3v-6c0-3-3.300-3.200-5-1.600V9z');
  const gh = ic('M12 2a10 10 0 0 0-3.200 19.500c.5.100.7-.2.700-.5v-1.800c-2.800.6-3.400-1.200-3.400-1.200-.5-1.200-1.100-1.500-1.100-1.500-.9-.6.1-.6.1-.6 1 .1 1.500 1 1.500 1 .9 1.500 2.300 1.100 2.900.8.1-.7.4-1.100.6-1.300-2.200-.3-4.600-1.100-4.600-5 0-1.100.4-2 1-2.700-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.700 1a9.400 9.400 0 0 1 5 0c1.900-1.300 2.700-1 2.700-1 .5 1.400.2 2.400.1 2.700.6.700 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.300.7.900.7 1.800v2.700c0 .3.2.600.7.500A10 10 0 0 0 12 2z');
  const dl = ic('M11 3h2v9.200l3.600-3.600 1.400 1.400-6 6-6-6 1.400-1.400 3.600 3.600zM5 19h14v2H5z');
  const contact = (c) => `<li><a class="btn solid" href="${links.email}?subject=${encodeURIComponent(c.subject)}" data-bell>${mail}<span>${c.email}</span><span class="addr">${links.email.replace('mailto:', '')}</span></a></li><li>${ext(links.linkedin, inn + c.linkedin, 'btn')}</li><li>${ext(links.github, gh + c.github, 'btn')}</li><li><a class="btn" href="${links.cv}" download>${dl}${c.cv}</a></li>`;
  const list = (items, f, url) => `<h2>${s.title}</h2><p>${s.intro}</p><ul class="rows">${items.map(f).join('')}</ul><p>${ext(url, s.more + ' ↗', 'btn more')}</p>`;
  switch (section) {
    case 'hero': return `
      <p class="led board" aria-hidden="true"><b>83</b><span class="live"></span></p>
      <div class="profile-head"><img class="avatar" src="assets/avatar.png" alt="" width="96" height="96">
        <div><h1>${s.title}</h1><p class="role">${s.role}</p><p class="eyebrow">${s.kicker}</p></div></div>
      <p class="value">${s.value}</p><dl class="fact-sheet">${s.facts.map(f => `<div><dt>${f.label}</dt><dd>${f.value}</dd></div>`).join('')}</dl><ul class="hero-links contact">
        ${contact(t.sections.contact)}</ul>
      <div class="profile-status"><p class="avail">${s.availability}</p><p class="clock">${t.ui.clock} <time data-london></time></p></div>
        <details class="profile-more"><summary>${t.ui.more}</summary><p class="proof">“${s.proof}” <span>${t.recs[0].name}, ${t.recs[0].role}</span></p><p class="tagline">${s.tagline}</p></details><p class="hint">${matchMedia('(pointer: coarse)').matches ? t.ui.scrollTouch : t.ui.scroll} ↓</p>`;
    case 'journey': {
      const selected = stops[active], c = t.stops[selected.id];
      return `
      <p class="led board" aria-hidden="true"><b>83</b><span class="live"></span></p>
      <h2>${s.title}</h2><p>${s.intro}</p>
      <section id="career-detail" class="detail current-stop${route.stamped.has(active) ? ' seen' : ''}" data-stop="${active}" aria-labelledby="career-title">
        <span class="punch" aria-hidden="true"></span>
        <h3 id="career-title">${c.title}</h3><p class="role">${c.role}</p><small>${c.dates} · ${c.place}</small><p>${c.body}</p>
      </section>
      <aside class="recent-role"><p class="recent-company">${latest.title}</p><small>${latest.role} · ${latest.dates}</small></aside>
      ${tool ? `<p class="filter">${t.ui.usedAt} <b>${tool}</b><button type="button" data-tool-clear aria-label="${t.ui.clearFilter}">&times;</button></p>` : ''}<ol class="stops">${stops.map((st, i) => {
        if (st.section !== 'journey') return '';
        const c = t.stops[st.id], on = i === active, hit = tool && toolStops[tool].includes(st.id);
        return `<li class="${st.country.toLowerCase()}${st.id === 'move' ? ' hub' : ''}${on ? ' on' : ''}${seenSet.has(i) ? ' seen' : ''}${tool ? (hit ? ' hit' : ' dim') : ''}"><button data-goto="${i}" aria-controls="career-detail" aria-expanded="${on}"${on ? ' aria-current="step"' : ''}>
          <span class="yr">${yearStack(st, t.ui)}</span><span class="node" aria-hidden="true"></span>${st.brand ? `<span class="mono" style="--c:${st.brand.color}" aria-hidden="true">${st.brand.initials}</span>` : ''}<span class="name">${c.title}</span></button>
          </li>`;
      }).join('')}</ol>
      <p class="zones"><span class="z br">${t.ui.zones.br}</span><span class="z uk">${t.ui.zones.uk}</span></p>${journeyLine(t, seenSet)}${nextButton(t, seenSet, active)}`;
    }
    case 'stack': return `<h2>${s.title}</h2><p>${s.intro}</p><p class="svc-all"><i aria-hidden="true"></i><b>${t.ui.svcAll}</b><small>${t.ui.clock} <time data-london></time></small></p><div class="lines">${stackGroups.map(g => `<div class="line" style="--c:${g.color}"><h3>${s.groups[g.id]}</h3><ul>${g.items.map(x => `<li>${toolStops[x].length ? `<button type="button" class="station" data-tool="${x}" aria-pressed="${x === tool}"><span>${x}</span><small class="ticket-meta">${ticketMeta(t, x)}</small></button>` : x}</li>`).join('')}</ul></div>`).join('')}</div>`;
    case 'articles': return list(articles, a => `<li>${ext(a.url, `<b>${a.title}</b><small>${s.src} ↗</small>`, 'row')}</li>`, links.medium);
    case 'repos': return list(repos, r => `<li style="--c:${r.color}">${ext(r.url, `<code>${r.name}</code><span class="tags">${r.lang.split(' · ').map(x => `<i>${x}</i>`).join('')}</span><small>${s.descriptions[r.name]}</small><em aria-hidden="true">↗</em>`, 'row repo')}</li>`, links.github + '?tab=repositories');
    case 'recs': return `<h2>${s.title}</h2><p>${s.intro}</p>${t.recs.map(r => `<blockquote><span class="who" aria-hidden="true">${r.name.split(' ').filter((_, k, w) => k === 0 || k === w.length - 1).map(w => w[0]).join('')}</span><p>${r.quote}</p><footer><b>${r.name}</b><span>${r.role}</span></footer></blockquote>`).join('')}`;
    case 'contact': return `<h2>${s.title}</h2><p>${s.intro}</p>
      <p class="why" id="reach-why">${s.why}</p><ul class="reasons" aria-labelledby="reach-why">${s.reasons.map(r => `<li><a class="chip" data-bell href="${links.email}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}">${r.label}</a></li>`).join('')}</ul>
      <ul class="contact">${contact(s)}</ul>${recap(t, route)}
      <p class="footer">${t.ui.footer} <button type="button" class="linkish" data-credits>${t.ui.credits.link}</button></p>`;
  }
}
export function initUI({ onGoto, onTheme, onHold = () => {}, onFocusStop = () => {} }) {
  const prefs = loadPrefs(store(), { lang: navigator.language });
  const panel = document.getElementById('panel'), announce = document.getElementById('announce');
  const options = document.querySelector('[data-options]');
  const closeOptions = () => options.setAttribute('aria-expanded', 'false');
  let renderedLang = null, greeting = false; // greeting: the "calling at" line is still being read, so the first arrival waits for it
  let active = -1, tool = null; // tool: the stack station whose journey stops are highlighted
  // Spoken announcements: on unless the visitor turned them off (remembered on this device); the button hides where the browser has no speech synthesis.
  // ponytail: browsers only let a page speak after the visitor's first click or key press, so the first stops before that stay silent.
  let voiceOn = voiceSupported();
  try { if (localStorage.getItem('voice') === 'off') voiceOn = false; } catch { /* storage blocked */ }
  const voiceBtn = document.querySelector('[data-voice]');
  if (voiceBtn) { voiceBtn.hidden = !voiceSupported(); voiceBtn.setAttribute('aria-pressed', String(voiceOn)); }
  // After dark the 83 runs as the N83, like London's night buses: the blinds, the arrival banner and the postcard caption all follow the theme.
  const routeNo = () => (prefs.theme === 'night' ? 'N83' : '83');
  const paintRoute = () => { for (const b of document.querySelectorAll('.led b')) b.textContent = routeNo(); };
  const applyTheme = () => {
    document.body.classList.toggle('theme-night', prefs.theme === 'night');
    const b = document.querySelector('[data-theme]');
    const d = prefs.theme === 'night'
      ? 'M20.985 12.486A9 9 0 1 1 11.514 3.015a7 7 0 0 0 9.471 9.471z'
      : 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z';
    b.innerHTML = `<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
    b.setAttribute('aria-pressed', String(prefs.theme === 'night'));
    paintRoute();
    onTheme(prefs.theme);
  };
  // Header LED blind: names the current stop, with the occasional announcement (the gap, rain, the terminus, a pulled bell).
  const notes = { gap: false, rain: false, say: null };
  let sayTimer;
  const say = (key, ms = 2500) => { notes.say = key; led(); clearTimeout(sayTimer); sayTimer = setTimeout(() => { notes.say = null; led(); }, ms); };
  const baseText = () => {
    const t = i18n[prefs.lang], st = stops[Math.max(active, 0)];
    return st.section === 'journey' ? `${yearText(st, t.ui)} ${t.stops[st.id].place}` : st.section === 'hero' ? t.sections.hero.role : t.ui.nav[st.section]; // the route badge already shows 83, so the hero's text is only the role
  };
  // With the tab in the background the title becomes the blind: "83 · Waiting at Tribal Worldwide London".
  const pageTitle = document.title;
  const waitingTitle = () => {
    const t = i18n[prefs.lang], st = stops[Math.max(active, 0)];
    return t.ui.tabWaiting.replace('{route}', routeNo()).replace('{place}', st.section === 'journey' ? t.stops[st.id].title : st.section === 'hero' ? t.ui.intro.d1 : baseText());
  };
  document.addEventListener('visibilitychange', () => { document.title = document.hidden ? waitingTitle() : pageTitle; });
  const led = () => {
    const t = i18n[prefs.lang], st = stops[Math.max(active, 0)]; // the header blind and the journey board show the same text
    let text = st.section === 'hero' ? '' : baseText(), alert = false;
    if (notes.say) { text = t.ui.led[notes.say]; alert = true; }
    else if (notes.gap) { text = t.ui.led.gap; alert = true; }
    else if (st.section === 'contact') text = t.ui.led.end;
    else if (notes.rain && Math.floor(Date.now() / 4000) % 2) { text = t.ui.led.rain; alert = true; }
    else if (st.section !== 'contact' && st.section !== 'hero' && Math.floor(Date.now() / 4000) % 3 === 1) text = t.ui.led.eta.replace('{place}', t.ui.nav.contact).replace('{min}', Math.max(1, Math.ceil(rideSeconds(stops.length - 1 - Math.max(active, 0), 3400) / 60))); // the stop board's countdown to the terminus at the auto-ride pace
    else if (st.section !== 'contact' && st.section !== 'hero' && Math.floor(Date.now() / 4000) % 3 === 0) text = t.ui.led.count.replace('{count}', journeySeenCount(seen)).replace('{total}', journeyTotal); // rotating route counter
    if (document.hidden) document.title = waitingTitle(); // keeps the hidden tab's title on the stop the bus is at
    for (const el of document.querySelectorAll('.led .live')) {
      el.classList.toggle('alert', alert);
      if (el.textContent !== text) { el.textContent = text; el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); }
    }
  };
  const clock = () => { // London time for visitors elsewhere: "is he awake?"
    const el = document.querySelector('[data-london]');
    if (el) el.textContent = new Intl.DateTimeFormat(prefs.lang === 'pt' ? 'pt-BR' : 'en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date());
  };
  setInterval(() => { led(); clock(); }, 2000);
  let bannerTimer, dwellTimer, quickTimer, party = false, lastIdx = -1;
  const paintHide = () => { // one text button for both states: "Hide the interface (H)" while it is on, "Show the interface (H)" while it is off
    const t = i18n[prefs.lang].ui, on = document.body.classList.contains('ui-hidden'), r = document.getElementById('ui-restore'), b = document.querySelector('[data-hide]');
    r.hidden = false; r.replaceChildren(on ? t.show : t.hideShort, ' ', Object.assign(document.createElement('kbd'), { textContent: 'H' })); r.setAttribute('aria-pressed', String(on)); b?.setAttribute('aria-pressed', String(on));
  };
  const setHidden = (on) => { // hide the panel and bar to see only the city; the pill (or H / Esc) brings them back
    document.body.classList.toggle('ui-hidden', on);
    if (on) discover('hide');
    for (const el of [panel, document.querySelector('.bar')]) el.inert = on;
    paintHide();
  };
  // the route lives in memory only: a reload starts it again, so nothing is read from or written to storage
  const route = { seen: new Set(), stamped: new Set(), cities: new Set(), found: new Set(), quick: new Set() }; // seen: visited (counted as the bus passes); stamped: stayed long enough for the ceremony
  const seen = route.seen, stamped = route.stamped, cities = route.cities;
  const arrive = (label, name, stamped = false) => { // "Now arriving London": a short banner when the line crosses into another city, or a passport stamp
    const b = document.getElementById('arrival') || document.body.appendChild(Object.assign(document.createElement('p'), { id: 'arrival', role: 'presentation' }));
    b.innerHTML = `<i class="num">${stamped ? '✓' : routeNo()}</i><span class="txt"><small>${label}</small><b>${name}</b></span>`; b.classList.toggle('stamped', stamped); b.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2400);
  };
  const talk = (text) => speak(text, prefs.lang, prefs.theme === 'night' ? 0.85 : 0.95); // the N83 drives slower and quieter than the day bus
  // When the rain starts the conductor says so once (not while the intro is up, and not more than once a minute).
  let lastRain = 0;
  const rainLine = () => {
    if (!voiceOn || !introDone || document.body.classList.contains('intro-on') || Date.now() - lastRain < 60000) return;
    lastRain = Date.now();
    whenDone().then(() => talk(i18n[prefs.lang].ui.speakRain));
  };
  // What the bus says on a confirmed stop: the plain arrival, a change at the two moves, the terminus, or (auto-ride on) the role and dates as well.
  const announceLine = (idx) => {
    const st = stops[idx], L = i18n[prefs.lang], t = L.ui;
    if (st.section === 'contact') return prefs.theme === 'night' ? t.speakEndNight : t.speakEnd;
    if (st.section !== 'journey') return null;
    const c = L.stops[st.id], change = st.id === 'move' || st.id === 'glasgow' ? ` ${t.speakChange.replace('{place}', c.place)}` : '';
    if (document.querySelector('[data-auto]')?.getAttribute('aria-pressed') === 'true') {
      return t.speakTour.replace('{title}', c.title).replace('{role}', c.role).replace('{dates}', c.dates.replace(/\s[–-]\s/, ` ${t.dateTo} `)) + change;
    }
    return t.speak.replace('{title}', c.title) + change;
  };
  const confirmStop = (idx) => {
    if (document.body.classList.contains('intro-on')) return; // nothing runs while the intro is up, even a timer armed before it opened // the bus has stayed on a stop: speak it, punch its ticket, stamp a new city
    const city = cityOf(stops[idx]), newCity = !cities.has(city), t = i18n[prefs.lang].ui;
    stamped.add(idx); seen.add(idx); cities.add(city);
    const spoken = voiceOn && announceLine(idx);
    if (spoken) { if (greeting) whenDone().then(() => talk(spoken)); else talk(spoken); }
    const li = panel.querySelector(`[data-goto="${idx}"]`)?.closest('li');
    if (li) li.classList.add('seen');
    const ticket = panel.querySelector(`.current-stop[data-stop="${idx}"]`);
    if (ticket) { ticket.classList.add('seen'); ticket.querySelector('.punch')?.classList.add('fresh'); }
    refreshCounts();
    if (newCity && !document.body.classList.contains('intro-on')) { // passport: the first stay in each city stamps it
      arrive(`${t.passport} · ${cities.size}/${Object.keys(t.cities).length}`, t.cities[city], true);
      announce.textContent = `${t.passport}: ${t.cities[city]}`;
    }
  };
  const discover = (key) => { // small finds go in the recap, once each
    if (route.found.has(key)) return;
    route.found.add(key); paintNavCount();
    const foundNow = document.querySelector('.found-line b'); if (foundNow) foundNow.textContent = `${route.found.size}/${FOUND.length}`; // the return ticket, if it is on screen
    say('found', 3000); announce.textContent = i18n[prefs.lang].ui.found[key];
  };
  const paintNavCount = () => { // "Journey 2/12" in the bar, visible at every width (the LED hides below 1100 px)
    const a = document.querySelector('[data-nav="journey"]');
    if (!a) return;
    a.querySelectorAll('.nav-count').forEach((el) => el.remove());
    a.insertAdjacentHTML('beforeend', ` <small class="nav-count" aria-hidden="true">${journeySeenCount(seen)}/${journeyTotal}</small>${route.found.size ? ` <small class="nav-count nav-found" aria-hidden="true">★ ${route.found.size}/${FOUND.length}</small>` : ''}`);
  };
  // the header count, the journey line and Next stop read the same counts: refresh them together whenever a stop is reached
  const refreshCounts = () => {
    paintNavCount();
    const line = panel.querySelector('.journey-progress'); if (line) line.outerHTML = journeyLine(i18n[prefs.lang], seen);
    const nextEl = panel.querySelector('.next-stop, .next-final'); if (nextEl) nextEl.outerHTML = nextButton(i18n[prefs.lang], seen, active);
  };
  // the bus went through the stops from a to b (a fast scroll can skip some): each career stop on the way counts as visited
  // ponytail: nothing counts while the intro is up, so the loading ride does not fill the counters
  const passed = (a, b) => {
    if (!introDone || document.body.classList.contains('intro-on')) return;
    let changed = false;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (stops[i].section === 'journey' && !seen.has(i)) {
      seen.add(i); changed = true;
      panel.querySelector(`[data-goto="${i}"]`)?.closest('li')?.classList.add('seen'); // the stop list shows the same marks as the counts
    }
    if (changed) refreshCounts();
  };
  // Focus or hover on a stop in the panel list lights its landmark; on a Stack tool it lights every stop that uses the tool.
  // onFocusStop gets a list of stop indices (empty clears). Touch taps only focus, so they light nothing.
  const stopOf = (node) => node?.closest?.('[data-goto]') ?? null;
  const toolOf = (node) => node?.closest?.('[data-tool]') ?? null;
  const stopsOfTool = (tool) => (toolStops[tool] || []).map((id) => stops.findIndex((st) => st.id === id)).filter((i) => i >= 0);
  const litFor = (node) => (stopOf(node) ? [+stopOf(node).dataset.goto] : toolOf(node) ? stopsOfTool(toolOf(node).dataset.tool) : []);
  document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch' && litFor(e.target).length) onFocusStop(litFor(e.target)); });
  document.addEventListener('pointerout', (e) => { if (e.pointerType !== 'touch' && String(litFor(e.target)) !== String(litFor(e.relatedTarget))) onFocusStop(litFor(e.relatedTarget)); });
  document.addEventListener('focusin', (e) => { if (litFor(e.target).length) onFocusStop(litFor(e.target)); });
  document.addEventListener('focusout', (e) => { if (String(litFor(e.target)) !== String(litFor(e.relatedTarget))) onFocusStop(litFor(e.relatedTarget)); });
  // The bus has come to rest after a scroll (main.js calls this once scrolling pauses): the LED board blinks and the bell rings, if sound is on. Nothing during the intro.
  let restIdx = -1;
  const atRest = () => {
    if (!introDone || document.body.classList.contains('intro-on') || active < 0 || active === restIdx) return;
    restIdx = active;
    for (const el of document.querySelectorAll('.led .live')) { el.classList.remove('arrive'); void el.offsetWidth; el.classList.add('arrive'); }
    arrivalDing();
  };
  const resetRoute = () => { // "Start the route again": clears progress on this device, then redraws
    seen.clear(); stamped.clear(); cities.clear(); route.found.clear(); route.quick.clear();
    render();
    clearTimeout(dwellTimer); clearTimeout(quickTimer); // render() arms the stop under the bus; it counts only after the visitor moves on
  };
  // the visit timers belong to the stop under the bus, and run only once the intro is closed (the loading ride passes stops while the city loads)
  const arm = () => {
    const idx = Math.max(active, 0), st = stops[idx], live = introDone && !document.body.classList.contains('intro-on');
    clearTimeout(dwellTimer); // the ceremony (spoken line, punch, city stamp) runs once the bus has stayed on a stop; counting already happened as it passed
    if (live && !stamped.has(idx)) dwellTimer = setTimeout(() => confirmStop(idx), visitAfterMs());
    clearTimeout(quickTimer); // the quick tour keeps its own, shorter count, separate from the 3 s rule
    if (live && QUICK.includes(st.id) && !route.quick.has(idx)) quickTimer = setTimeout(() => { route.quick.add(idx); }, QUICK_MS);
  };
  let introWasOn = false, introDone = false; // introDone: the intro has opened and closed once, so visit timers may run from now on
  // the intro closing re-arms the stop already under the bus: it was active while the intro was still up, so no render follows
  new MutationObserver(() => { const on = document.body.classList.contains('intro-on'); if (introWasOn && !on) { introDone = true; arm(); } introWasOn = on; }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const render = () => {
    const t = i18n[prefs.lang];
    const st = stops[Math.max(active, 0)];
    document.documentElement.lang = prefs.lang === 'pt' ? 'pt-BR' : 'en';
    const city = cityOf(st);
    if (document.body.dataset.city && document.body.dataset.city !== city) arrive(t.ui.arriving, t.ui.cities[city]); // not on the first render
    document.body.dataset.city = city;
    const idx = Math.max(active, 0);
    arm();
    if (st.id === 'contact' && !party) { party = true; say('final', 4000); } // LED only: sounds stay behind a click or tap
    document.querySelector('.bar nav').setAttribute('aria-label', t.ui.navLabel);
    paintHide();
    document.getElementById('credits')?.setAttribute('aria-label', t.ui.credits.title); // the dialog is empty until opened, so it needs a name of its own
    const home = document.querySelector('[data-nav-home]');
    const cur = (el, on) => (on ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current'));
    cur(home, st.section === 'hero');
    const more = document.querySelector('[data-more]'); if (more) more.textContent = t.ui.more;
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.textContent = t.ui.nav[a.dataset.nav];
      cur(a, a.dataset.nav === st.section);
    });
    paintNavCount();
    led(); clock(); paintRoute();
    const nav = document.querySelector('.bar nav'), here = nav.querySelector('[aria-current]'); // on phones the menu scrolls: keep the current section in view
    if (here && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: here.offsetLeft - (nav.clientWidth - here.offsetWidth) / 2, behavior: 'smooth' });
    const toLang = prefs.lang === 'en' ? 'pt' : 'en'; // the button shows the flag of the language a press switches to
    for (const langButton of document.querySelectorAll('[data-lang]')) { // the header and the intro ticket each have one
      langButton.innerHTML = `<span class="flag">${FLAGS[toLang]}</span>`;
      langButton.setAttribute('aria-label', `${toLang.toUpperCase()} — ${t.ui.lang}`);
      langButton.title = `${toLang.toUpperCase()} — ${t.ui.lang}`;
    }
    if (renderedLang !== prefs.lang) { renderedLang = prefs.lang; document.dispatchEvent(new Event('langchange')); } // the intro repaints its own copy
    const themeButton = document.querySelector('[data-theme]');
    themeButton.setAttribute('aria-label', t.ui.theme);
    themeButton.title = t.ui.theme;
    for (const [sel, key] of [['[data-auto]', 'auto'], ['[data-quick]', 'quick'], ['[data-photo]', 'photo'], ['[data-hide]', 'hide'], ['[data-sound]', 'sound'], ['[data-voice]', 'voice']]) { const b = document.querySelector(sel); if (b) { b.setAttribute('aria-label', t.ui[key]); b.title = t.ui[key]; } }
    const stopBtn = document.getElementById('stop-request');
    if (stopBtn) { stopBtn.innerHTML = `${t.ui.stopRequest} <kbd>B</kbd>`; stopBtn.setAttribute('aria-label', `${t.ui.stopRequest} (B)`); }
    document.querySelector('.skip').textContent = t.ui.skip;
    const touch = matchMedia('(pointer: coarse)').matches; // phones get "swipe" copy (intro.t_*) instead of "scroll"
    const pick = (path) => path.split('.').reduce((o, k) => o[k], t.ui);
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n, tk = key === 'intro.hint' ? 'intro.t_hint' : key;
      el.textContent = touch && tk !== key ? pick(tk) : pick(key);
    });
    const prev = document.activeElement;
    const key = ['data-tool', 'data-goto', 'data-nav', 'data-nav-home', 'data-lang', 'data-theme'].find(a => prev?.hasAttribute?.(a));
    const keep = key && [key, prev.getAttribute(key)];
    const panelLinkIndex = panel.contains(prev) && prev.matches('a[href]') ? [...panel.querySelectorAll('a[href]')].indexOf(prev) : -1;
    const panelCredits = panel.contains(prev) && prev.matches('[data-credits]');
    const top = panel.dataset.section === st.section && !(st.section === 'journey' && idx !== lastIdx) ? panel.scrollTop : 0;
    const slide = lastIdx >= 0 && idx !== lastIdx && !matchMedia('(prefers-reduced-motion: reduce)').matches, sectionChanged = panel.dataset.section !== st.section, dir = idx >= lastIdx ? 1 : -1;
    lastIdx = idx;
    panel.innerHTML = sectionHTML(st.section, t, active, tool, route);
    if (slide) { // the ticket (or the whole pane when the section changes) slides in from the side the bus is heading to; CSS only, no page snapshot, so the 3D scene never stalls
      panel.style.setProperty('--sx', `${dir * 22}px`); panel.style.setProperty('--dir', dir);
      panel.classList.remove('swap-pane', 'swap-ticket'); void panel.offsetWidth; panel.classList.add(sectionChanged ? 'swap-pane' : 'swap-ticket');
    }
    panel.scrollTop = top;
    panel.dataset.section = st.section;
    led(); paintRoute(); // fills the journey board the markup above just replaced
    const routeList = panel.querySelector('.stops'), currentRow = routeList?.querySelector('.on');
    if (currentRow && matchMedia('(min-width: 768px)').matches) currentRow.scrollIntoView({ block: 'nearest' }); // the panel is the only scroller: keep the selected stop in view
    clock();
    if (keep && !prev.isConnected) document.querySelector(`[${keep[0]}="${keep[1]}"]`)?.focus({ preventScroll: true }); // only an element the render replaced needs its focus back
    else if (!sectionChanged && panelLinkIndex >= 0) panel.querySelectorAll('a[href]')[panelLinkIndex]?.focus({ preventScroll: true });
    else if (!sectionChanged && panelCredits) panel.querySelector('[data-credits]')?.focus({ preventScroll: true });
    onFocusStop(litFor(document.activeElement)); // a re-rendered list loses its hover: only a focused stop or tool stays lit
    const c = t.stops[st.id];
    announce.textContent =(c ? `${st.year} ${c.title}` : t.sections[st.section].title) + `, ${t.ui.cities[city]}` + (notes.rain ? `, ${t.ui.led.rain}` : '');
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-options]')) { options.setAttribute('aria-expanded', String(options.getAttribute('aria-expanded') !== 'true')); return; }
    if (!e.target.closest('.controls') || e.target.closest('[data-auto], [data-quick], [data-hide]')) closeOptions();
    if (e.target.closest('[data-hide], #ui-restore')) { setHidden(!document.body.classList.contains('ui-hidden')); return; }
    if (e.target.closest('[data-photo-link]')) { document.querySelector('[data-photo]').click(); return; } // the recap's postcard button
    if (e.target.closest('[data-bell]')) say('stop'); // the mail app still opens; the bell is visual only
    if (e.target.closest('[data-credits]')) { // credits and licences for the third-party models
      const c = i18n[prefs.lang].ui.credits, d = document.getElementById('credits');
      d.innerHTML = `<h2 id="credits-title">${c.title}</h2><p>${c.intro}</p><ul class="credit-list">${credits.map(x => `<li><b>${x.name}</b> ${x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${x.author}</a>` : x.author} · <a href="${x.lic[1]}" target="_blank" rel="noopener">${x.lic[0]}</a></li>`).join('')}</ul>
        <h3>${c.built}</h3><ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul><form method="dialog"><button class="close" autofocus>${c.close}</button></form>`;
      d.showModal();
      return;
    }
    const station = e.target.closest('[data-tool]');
    if (station) { // pick a tool: highlight where it was used and ride to the first of those stops
      const name = station.dataset.tool; tool = tool === name ? null : name;
      if (tool) onGoto(stops.findIndex(st => st.id === toolStops[tool][0])); else render();
      return;
    }
    if (e.target.closest('[data-tool-clear]')) { tool = null; render(); return; }
    const nextStop = e.target.closest('[data-next]'); if (nextStop) { onGoto(+nextStop.dataset.next); return; }
    if (e.target.closest('[data-reset]')) { if (confirm(i18n[prefs.lang].ui.resetConfirm)) resetRoute(); return; }
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); onGoto(+go.dataset.goto); }
    if (e.target.closest('[data-nav-home]')) { e.preventDefault(); onGoto(0); }
    const nav = e.target.closest('[data-nav]');
    if (nav) { if (dropdownMq.matches) nav.closest('details')?.removeAttribute('open'); e.preventDefault(); onGoto(sectionStart(nav.dataset.nav)); }
    if (e.target.closest('[data-voice]')) {
      voiceOn = !voiceOn; voiceBtn.setAttribute('aria-pressed', String(voiceOn)); savePref(store(), 'voice', voiceOn ? 'on' : 'off');
      const st = stops[Math.max(active, 0)], t = i18n[prefs.lang].ui;
      if (!voiceOn) hush(); else speak(st.section === 'journey' ? t.speak.replace('{title}', i18n[prefs.lang].stops[st.id].title) : t.voice, prefs.lang); // the first words double as the preview
    }
    if (e.target.closest('[data-lang]')) {
      prefs.lang = prefs.lang === 'en' ? 'pt' : 'en'; savePref(store(), 'lang', prefs.lang);
      if (voiceOn && hasVoice(prefs.lang)) talk(i18n[prefs.lang].ui.speakLang); // said in the new language; skipped when the browser has no voice for it
      // ponytail: a short crossfade of the copy; plain swap where View Transitions are missing or motion is reduced. The page snapshot pauses the 3D scene for the 0.25 s, as the theme reveal does.
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const root = document.documentElement; root.dataset.vt = 'lang';
        const vt = document.startViewTransition(render);
        vt.ready.catch(() => {}); vt.finished.finally(() => delete root.dataset.vt);
      } else render();
    }
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) {
      prefs.theme = prefs.theme === 'day' ? 'night' : 'day'; savePref(store(), 'theme', prefs.theme);
      const r = themeBtn.getBoundingClientRect(), root = document.documentElement.style;
      root.setProperty('--tx', `${r.left + r.width / 2}px`); root.setProperty('--ty', `${r.top + r.height / 2}px`);
      // ponytail: the reveal is skipped (plain swap) where View Transitions are missing or motion is reduced
      // A hidden tab can abort the reveal after the theme has already changed.
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(applyTheme).ready.catch(() => {});
      else applyTheme();
    }
  });
  // the nav overflow menu is a real dropdown only between 768 and 1100px; elsewhere its links sit inline, so the details stays open
  const moreMenu0 = document.querySelector('.nav-more'), dropdownMq = matchMedia('(min-width: 768px) and (max-width: 1100px)');
  const syncMore = () => { if (moreMenu0) moreMenu0.open = !dropdownMq.matches; };
  syncMore(); dropdownMq.addEventListener('change', syncMore);
  document.addEventListener('keydown', (e) => {
    const moreMenu = dropdownMq.matches && document.querySelector('.nav-more[open]');
    if (e.key === 'Escape' && moreMenu) { moreMenu.removeAttribute('open'); moreMenu.querySelector('summary').focus(); return; }
    if (e.key === 'Escape' && options.getAttribute('aria-expanded') === 'true') { closeOptions(); options.focus(); return; }
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.body.classList.contains('intro-on') || document.querySelector('dialog[open]')) return; // the intro and the credits own the keys while open
    if (e.key === 'h' || e.key === 'H') { setHidden(!document.body.classList.contains('ui-hidden')); return; }
    if (e.key === 'Escape' && document.body.classList.contains('ui-hidden')) { setHidden(false); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { // a tap rides to the next stop, a held key keeps the bus rolling (main.js eases it in and out)
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (e.repeat) onHold(dir); else onGoto(dir > 0 ? Math.min(active + 1, stops.length - 1) : Math.max(active - 1, 0));
      return;
    }
    if (e.key === 'j') onGoto(Math.min(active + 1, stops.length - 1));
    if (e.key === 'k') onGoto(Math.max(active - 1, 0));
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') onHold(0); });
  addEventListener('blur', () => onHold(0));
  applyTheme();
  return {
    get theme() { return prefs.theme; },
    setActive(i) { if (i !== active) { active = i; render(); } },
    current: () => active,
    passed,
    say,
    discover,
    stamps: () => [...cities].map((c) => i18n[prefs.lang].ui.cities[c]),
    caption: () => `${routeNo()} · ${baseText()}`.toUpperCase(),
    speaking: whenDone,
    callingAt() { // the first sound of the ride: "This is the 83, calling at São Paulo, London and Glasgow"
      if (!voiceOn) return;
      const t = i18n[prefs.lang].ui, c = t.cities;
      greeting = true;
      const hour = new Date().getHours(), greet = hour >= 5 && hour < 12 ? t.greetMorning : hour >= 12 && hour < 18 ? t.greetAfternoon : t.greetEvening; // the visitor's own clock
      talk(`${greet} ` + t.speakCalling.replace('{route}', routeNo()).replace('{a}', c.sp).replace('{b}', c.ldn).replace('{c}', c.gla));
      whenDone().then(() => { greeting = false; });
    },
    setPostcardPreview(url) { // the view of the last stop, shown on the return ticket (main.js takes it once the bus has arrived)
      postcardUrl = url; const fig = document.querySelector('[data-postcard-preview]'); if (!fig) return;
      fig.hidden = !url; const img = fig.querySelector('img'); if (img) img.src = url;
    },
    holdTight() { if (voiceOn) talk(i18n[prefs.lang].ui.speakStart); }, // the conductor's line as the ride sets off
    // "Ready to depart." as the city has loaded. Browsers keep speech silent until the page has had a click, tap or key: a visitor who has not touched it yet hears it on their first
    // press while the intro is still up (not on Start, which has the conductor's own line, and not on Esc).
    readyToDepart() {
      if (!voiceOn) return;
      const say = () => talk(i18n[prefs.lang].ui.intro.loaded);
      if (navigator.userActivation?.hasBeenActive !== false) return say();
      const fire = (e) => {
        for (const type of ['pointerdown', 'keydown']) document.removeEventListener(type, fire, true);
        if (voiceOn && document.body.classList.contains('intro-on') && !e.target.closest?.('[data-intro-skip]') && e.key !== 'Escape') say();
      };
      for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, fire, true);
    },
    note(key, on) { if (notes[key] !== on) { notes[key] = on; led(); if (key === 'rain' && on) rainLine(); } },
    atRest,
  };
}
