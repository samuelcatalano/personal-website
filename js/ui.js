import { ding } from './intro.js';
import { stops, i18n, links, articles, repos, stackGroups, sectionStart } from './content.js';
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
// ponytail: innerHTML from static content.js only
function sectionHTML(section, t, active) {
  const s = t.sections[section];
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
      <img class="avatar" src="assets/avatar.png" alt="" width="96" height="96">
      <h1>${s.title}</h1><p class="role">${s.role}</p><p class="meta">${s.meta}</p>
      <p class="tagline">${s.tagline}</p><p class="avail">${s.availability}</p><p class="clock">${t.ui.clock} <time data-london></time></p><ul class="hero-links contact">
        ${contact(t.sections.contact)}</ul><p class="hint">${matchMedia('(pointer: coarse)').matches ? t.ui.scrollTouch : t.ui.scroll} ↓</p>`;
    case 'journey': return `
      <h2>${s.title}</h2><p>${s.intro}</p><ol class="stops">${stops.map((st, i) => {
        if (st.section !== 'journey') return '';
        const c = t.stops[st.id], on = i === active;
        return `<li class="${st.country.toLowerCase()}${st.id === 'move' ? ' hub' : ''}${on ? ' on' : ''}"><button data-goto="${i}" aria-expanded="${on}">
          <span class="yr">${st.year}</span><span class="node" aria-hidden="true"></span>${st.brand ? `<span class="mono" style="--c:${st.brand.color}" aria-hidden="true">${st.brand.initials}</span>` : ''}<span class="name">${c.title}</span></button>
          ${on ? `<div class="detail"><strong>${c.role}</strong><small>${c.dates} · ${c.place}</small><p>${c.body}</p></div>` : ''}</li>`;
      }).join('')}</ol>
      <p class="zones"><span class="z br">${t.ui.zones.br}</span><span class="z uk">${t.ui.zones.uk}</span></p>`;
    case 'stack': return `<h2>${s.title}</h2><p>${s.intro}</p><div class="lines">${stackGroups.map(g => `<div class="line" style="--c:${g.color}"><h3>${s.groups[g.id]}</h3><ul>${g.items.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>`;
    case 'articles': return list(articles, a => `<li>${ext(a.url, `<b>${a.title}</b><small>${s.src} ↗</small>`, 'row')}</li>`, links.medium);
    case 'repos': return list(repos, r => `<li style="--c:${r.color}">${ext(r.url, `<code>${r.name}</code><span class="tags">${r.lang.split(' · ').map(x => `<i>${x}</i>`).join('')}</span><em aria-hidden="true">↗</em>`, 'row repo')}</li>`, links.github + '?tab=repositories');
    case 'recs': return `<h2>${s.title}</h2><p>${s.intro}</p>${t.recs.map(r => `<blockquote><span class="who" aria-hidden="true">${r.name.split(' ').filter((_, k, w) => k === 0 || k === w.length - 1).map(w => w[0]).join('')}</span><p>${r.quote}</p><footer><b>${r.name}</b><span>${r.role}</span></footer></blockquote>`).join('')}`;
    case 'contact': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="contact">${contact(s)}</ul>
      <p class="footer">${t.ui.footer}</p>`;
  }
}
export function initUI({ onGoto, onTheme }) {
  const prefs = loadPrefs(store());
  const panel = document.getElementById('panel'), announce = document.getElementById('announce');
  let active = -1;
  const applyTheme = () => {
    document.body.classList.toggle('theme-night', prefs.theme === 'night');
    const b = document.querySelector('[data-theme]');
    const d = prefs.theme === 'night'
      ? 'M20.985 12.486A9 9 0 1 1 11.514 3.015a7 7 0 0 0 9.471 9.471z'
      : 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z';
    b.innerHTML = `<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
    b.setAttribute('aria-pressed', String(prefs.theme === 'night'));
    onTheme(prefs.theme);
  };
  // Header LED blind: names the current stop, with the occasional announcement (the gap, rain, the terminus, a pulled bell).
  const notes = { gap: false, rain: false, flash: false };
  const led = () => {
    const el = document.querySelector('.led .live'), t = i18n[prefs.lang], st = stops[Math.max(active, 0)];
    let text = st.section === 'journey' ? `${st.year} ${t.stops[st.id].place}` : st.section === 'hero' ? t.ui.intro.d1 : t.ui.nav[st.section], alert = false;
    if (notes.flash) { text = t.ui.led.stop; alert = true; }
    else if (notes.gap) { text = t.ui.led.gap; alert = true; }
    else if (st.section === 'contact') text = t.ui.led.end;
    else if (notes.rain && Math.floor(Date.now() / 4000) % 2) { text = t.ui.led.rain; alert = true; }
    el.classList.toggle('alert', alert);
    if (el.textContent !== text) { el.textContent = text; el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); }
  };
  const clock = () => { // London time for visitors elsewhere: "is he awake?"
    const el = document.querySelector('[data-london]');
    if (el) el.textContent = new Intl.DateTimeFormat(prefs.lang === 'pt' ? 'pt-BR' : 'en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date());
  };
  setInterval(() => { led(); clock(); }, 2000);
  const render = (reveal = false) => {
    const t = i18n[prefs.lang];
    const st = stops[Math.max(active, 0)];
    document.documentElement.lang = prefs.lang === 'pt' ? 'pt-BR' : 'en';
    document.querySelector('.bar nav').setAttribute('aria-label', t.ui.navLabel);
    const home = document.querySelector('[data-nav-home]');
    const cur = (el, on) => (on ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current'));
    cur(home, st.section === 'hero');
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.textContent = t.ui.nav[a.dataset.nav];
      cur(a, a.dataset.nav === st.section);
    });
    led();
    clock();
    const nav = document.querySelector('.bar nav'), here = nav.querySelector('[aria-current]'); // on phones the menu scrolls: keep the current section in view
    if (here && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: here.offsetLeft - (nav.clientWidth - here.offsetWidth) / 2, behavior: 'smooth' });
    const langButton = document.querySelector('[data-lang]');
    langButton.textContent = prefs.lang === 'en' ? 'PT' : 'EN';
    langButton.setAttribute('aria-label', `${langButton.textContent} — ${t.ui.lang}`);
    document.querySelector('[data-theme]').setAttribute('aria-label', t.ui.theme);
    document.querySelector('.skip').textContent = t.ui.skip;
    const touch = matchMedia('(pointer: coarse)').matches; // phones get "swipe" copy (intro.t_*) instead of "scroll"
    const pick = (path) => path.split('.').reduce((o, k) => o[k], t.ui);
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n, tk = key.replace(/^intro\.(sub|down|up)$/, 'intro.t_$1');
      el.textContent = touch && tk !== key ? pick(tk) : pick(key);
    });
    const prev = document.activeElement;
    const key = ['data-goto', 'data-nav', 'data-nav-home', 'data-lang', 'data-theme'].find(a => prev?.hasAttribute?.(a));
    const keep = key && [key, prev.getAttribute(key)];
    const top = panel.dataset.section === st.section ? panel.scrollTop : 0;
    panel.innerHTML = sectionHTML(st.section, t, active);
    panel.scrollTop = top;
    panel.dataset.section = st.section;
    if (reveal) panel.querySelector('.on')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    if (keep) document.querySelector(`[${keep[0]}="${keep[1]}"]`)?.focus({ preventScroll: true });
    const c = t.stops[st.id];
    announce.textContent = c ? `${st.year} ${c.title}` : t.sections[st.section].title;
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-bell]')) { ding(); notes.flash = true; led(); setTimeout(() => { notes.flash = false; led(); }, 2500); } // the mail app still opens: the bell is a flourish
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); onGoto(+go.dataset.goto); }
    if (e.target.closest('[data-nav-home]')) { e.preventDefault(); onGoto(0); history.replaceState(null, '', location.pathname + location.search); }
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); onGoto(sectionStart(nav.dataset.nav)); history.replaceState(null, '', '#' + nav.dataset.nav); }
    if (e.target.closest('[data-lang]')) { prefs.lang = prefs.lang === 'en' ? 'pt' : 'en'; savePref(store(), 'lang', prefs.lang); render(); }
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) {
      prefs.theme = prefs.theme === 'day' ? 'night' : 'day'; savePref(store(), 'theme', prefs.theme);
      const r = themeBtn.getBoundingClientRect(), root = document.documentElement.style;
      root.setProperty('--tx', `${r.left + r.width / 2}px`); root.setProperty('--ty', `${r.top + r.height / 2}px`);
      // ponytail: the reveal is skipped (plain swap) where View Transitions are missing or motion is reduced
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(applyTheme);
      else applyTheme();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey) return;
    if (e.key === 'j') onGoto(Math.min(active + 1, stops.length - 1));
    if (e.key === 'k') onGoto(Math.max(active - 1, 0));
  });
  applyTheme();
  return {
    get theme() { return prefs.theme; },
    setActive(i) { if (i !== active) { active = i; render(true); } },
    note(key, on) { if (notes[key] !== on) { notes[key] = on; led(); } },
  };
}
