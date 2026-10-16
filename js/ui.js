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
      <p class="tagline">${s.tagline}</p><ul class="hero-links contact">
        <li><a href="${links.email}">${t.sections.contact.email}</a></li>
        <li>${ext(links.linkedin, t.sections.contact.linkedin)}</li>
        <li>${ext(links.github, t.sections.contact.github)}</li>
      </ul><p class="hint">${t.ui.scroll} ↓</p>`;
    case 'journey': return `
      <h2>${s.title}</h2><p>${s.intro}</p><ol class="stops">${stops.map((st, i) => {
        if (st.section !== 'journey') return '';
        const c = t.stops[st.id], on = i === active;
        return `<li class="${on ? 'on' : ''}"><button data-goto="${i}" aria-expanded="${on}">
          <span class="yr">${st.year}</span> ${st.brand ? `<span class="mono" style="--c:${st.brand.color}" aria-hidden="true">${st.brand.initials}</span>` : ''} <span aria-hidden="true">${flag(st.country)}</span> ${c.title}</button>
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
  const announce = document.getElementById('announce');
  let active = -1;

  const applyTheme = () => {
    document.body.classList.toggle('theme-night', prefs.theme === 'night');
    const b = document.querySelector('[data-theme]');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ 'aria-hidden': 'true', focusable: 'false', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) icon.setAttribute(name, value);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', prefs.theme === 'night'
      ? 'M20.985 12.486A9 9 0 1 1 11.514 3.015a7 7 0 0 0 9.471 9.471z'
      : 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z');
    icon.append(path);
    b.replaceChildren(icon);
    b.setAttribute('aria-pressed', String(prefs.theme === 'night'));
    onTheme(prefs.theme);
  };
  const render = (reveal = false) => {
    const t = i18n[prefs.lang];
    const st = stops[Math.max(active, 0)];
    document.documentElement.lang = prefs.lang === 'pt' ? 'pt-BR' : 'en';
    document.querySelector('.bar nav').setAttribute('aria-label', t.ui.navLabel);
    const home = document.querySelector('[data-nav-home]');
    if (st.section === 'hero') home.setAttribute('aria-current', 'page');
    else home.removeAttribute('aria-current');
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.textContent = t.ui.nav[a.dataset.nav];
      if (a.dataset.nav === st.section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
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
