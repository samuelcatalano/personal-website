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
// ponytail: innerHTML from static content.js only
function sectionHTML(section, t, active) {
  const s = t.sections[section];
  const ext = (href, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${href}" target="_blank" rel="noopener">${text}</a>`;
  const ic = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const mail = ic('M3 5h18v14H3zm2 2v.5l7 5 7-5V7zm14 3-7 5-7-5V17h14z');
  const inn = ic('M3 3h18v18H3zm3 6v9h3V9zm1.5-3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM11 9v9h3v-5c0-1.5 2-1.600 2 0v5h3v-6c0-3-3.300-3.200-5-1.600V9z');
  const gh = ic('M12 2a10 10 0 0 0-3.200 19.500c.5.100.7-.2.700-.5v-1.800c-2.800.6-3.400-1.200-3.400-1.200-.5-1.200-1.100-1.500-1.100-1.500-.9-.6.1-.6.1-.6 1 .1 1.500 1 1.500 1 .9 1.500 2.300 1.100 2.900.8.1-.7.4-1.100.6-1.300-2.200-.3-4.600-1.100-4.600-5 0-1.100.4-2 1-2.700-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.700 1a9.400 9.400 0 0 1 5 0c1.900-1.300 2.700-1 2.700-1 .5 1.400.2 2.400.1 2.700.6.700 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.300.7.900.7 1.800v2.700c0 .3.2.600.7.500A10 10 0 0 0 12 2z');
  const contact = (c) => `<li><a class="btn solid" href="${links.email}">${mail}${c.email}</a></li><li>${ext(links.linkedin, inn + c.linkedin, 'btn')}</li><li>${ext(links.github, gh + c.github, 'btn')}</li>`;
  const list = (items, f, url) => `<h2>${s.title}</h2><p>${s.intro}</p><ul class="rows">${items.map(f).join('')}</ul><p>${ext(url, s.more + ' ↗', 'btn more')}</p>`;
  switch (section) {
    case 'hero': return `
      <img class="avatar" src="assets/avatar.png" alt="" width="96" height="96">
      <h1>${s.title}</h1><p class="role">${s.role}</p><p class="meta">${s.meta}</p>
      <p class="tagline">${s.tagline}</p><ul class="hero-links contact">
        ${contact(t.sections.contact)}</ul><p class="hint">${t.ui.scroll} ↓</p>`;
    case 'journey': return `
      <h2>${s.title}</h2><p>${s.intro}</p><ol class="stops">${stops.map((st, i) => {
        if (st.section !== 'journey') return '';
        const c = t.stops[st.id], on = i === active;
        return `<li class="${on ? 'on' : ''}"><button data-goto="${i}" aria-expanded="${on}">
          <span class="yr">${st.year}</span> ${st.brand ? `<span class="mono" style="--c:${st.brand.color}" aria-hidden="true">${st.brand.initials}</span>` : ''} <span aria-hidden="true">${flag(st.country)}</span> ${c.title}</button>
          ${on ? `<div class="detail"><strong>${c.role}</strong><small>${c.dates} · ${c.place}</small><p>${c.body}</p></div>` : ''}</li>`;
      }).join('')}</ol>`;
    case 'stack': return `<h2>${s.title}</h2><p>${s.intro}</p><ul class="chips">${stack.map(x => `<li>${x}</li>`).join('')}</ul>`;
    case 'articles': return list(articles, a => `<li>${ext(a.url, `<b>${a.title}</b><small>${s.src} ↗</small>`, 'row')}</li>`, links.medium);
    case 'repos': return list(repos, r => `<li>${ext(r.url, `<code>${r.name}</code><span class="tags">${r.lang.split(' · ').map(x => `<i>${x}</i>`).join('')}</span><em aria-hidden="true">↗</em>`, 'row repo')}</li>`, links.github + '?tab=repositories');
    case 'recs': return `<h2>${s.title}</h2><p>${s.intro}</p>${t.recs.map(r => `<blockquote><p>“${r.quote}”</p><footer>${r.name} · ${r.role}</footer></blockquote>`).join('')}`;
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
    const langButton = document.querySelector('[data-lang]');
    langButton.textContent = prefs.lang === 'en' ? 'PT' : 'EN';
    langButton.setAttribute('aria-label', `${langButton.textContent} — ${t.ui.lang}`);
    document.querySelector('[data-theme]').setAttribute('aria-label', t.ui.theme);
    document.querySelector('.skip').textContent = t.ui.skip;
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
    setActive(i) { if (i !== active) { active = i; render(true); } },
  };
}
