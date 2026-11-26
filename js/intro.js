import { ding, hiss, releaseSounds } from './sound.js';
import { stops, i18n, yearText, yearStack, links } from './content.js';
import { loadState, onLoadChange } from './world/load-progress.js';
// Intro shown on every load. A toy bus follows the scroll wheel (or swipe, or arrow keys) along a miniature of the career line while the 3D world loads;
// The blind names the destination; real loading progress has its own visible line on the ticket.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Scroll, touch and keys share the same 0..1 route position.
export const practice = (p, dy) => clamp01(p + dy / 500);
const JOURNEY = stops.filter((s) => s.section === 'journey');
export const journeyIndex = (p, n = JOURNEY.length) => Math.round(clamp01(p) * (n - 1));
// "2019 LONDON", "2003 PUC": the year plus the employer's initials, or the city where there are none (the move) or where the initials repeat (Glasgow).
export const careerLabel = (st, t) => `${yearText(st, t.ui)} ${st.id === 'glasgow' || !st.brand ? t.stops[st.id].place : st.brand.initials}`.toUpperCase();
// the year label of each node, blank when it repeats the previous node's
export const yearLabels = (journey, ui) => journey.map((st, i) => (i && st.year === journey[i - 1].year ? '' : yearStack(st, ui)));
// Progress shown on the ticket. Loading the world's files fills 0-70; the finishing phase (settling, the three still photos, the last settle) fills 70-99 in real steps,
// so the bar no longer sits on one number while the stills are taken. `phase` is the last finishing step done: 'settled', 'sp', 'london' or 'glasgow' (= photos over).
export const FINAL = { settled: 76, sp: 82, london: 88, glasgow: 94 };
export const progressValue = ({ ratio = 0, loaded = false, phase = null }) => Math.min(99, !loaded ? Math.round(ratio * 70) : phase === 'glasgow' ? Math.round(94 + 5 * ratio) : FINAL[phase] ?? 70);
// Ticket barcode: bars drawn from the ticket number (same bars every visit). Decoration only; the number beside it is the real text.
export const barcode = (seed) => {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7), x = 0, d = '';
  while (x < 220) { s = (s * 48271) % 2147483647; const w = 1 + (s >> 4) % 4; d += `M${x} 0h${w}v1h-${w}z`; x += w + 1 + (s >> 9) % 3; }
  return `<svg viewBox="0 0 ${x} 1" preserveAspectRatio="none" focusable="false"><path d="${d}"/></svg>`;
};
const KEY_DY = { ArrowRight: 35, ArrowLeft: -35, PageDown: 240, PageUp: -240, ' ': 240 }; // right drives forward, left goes back
const LEDS = 48;
export function createIntro(root, { onDrive = () => {}, onBoard = () => {} } = {}) {
  let soundsPlayed = false; // the bell and the door hiss belong to the first Skip only, never again
  let p = 0, auto = 0, autoTarget = 0, raf = 0, previewUrls = [], loaded = false, active = false, interacted = false, ready = false, previewed = false, boarding = false, returning = false, blindStep = 0, phase = null, shown = 0, tipIndex = 0, bellTimer, blindTimer, tipTimer, unsubscribe;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = root.querySelector('.intro-map'), cur = root.querySelector('.dest .cur');
  const nodesEl = root.querySelector('.nodes'), ledsEl = root.querySelector('.leds');
  const statusEl = root.querySelector('.status'), statusText = root.querySelector('#intro-status-text');
  const skip = root.querySelector('[data-intro-skip]');
  const road = root.querySelector('.road'), stamp = root.querySelector('.intro-ticket-stamp'), stub = root.querySelector('.intro-stub');
  const stageEl = root.querySelector('.intro-stage'), tipEl = root.querySelector('#intro-tip');
  const previewStops = [...root.querySelectorAll('[data-preview-stop]')];
  const t = () => i18n[document.documentElement.lang.startsWith('pt') ? 'pt' : 'en'];
  const fraction = i => i / (JOURNEY.length - 1);
  const border = JOURNEY.findIndex(st => st.id === 'move');
  const glasgow = JOURNEY.findIndex(st => st.id === 'glasgow');
  root.style.setProperty('--border-stop', `${100 * fraction(border)}%`);
  const years = yearLabels(JOURNEY, t().ui);
  nodesEl.innerHTML = JOURNEY.map((st, i) => `<i class="node ${st.country.toLowerCase()}${i === border ? ' hub' : ''}" style="--f:${fraction(i)}">${years[i] === '' ? '' : `<b>${years[i]}</b>`}</i>`).join('');
  ledsEl.innerHTML = '<i></i>'.repeat(LEDS);
  const nodes = [...nodesEl.children], leds = [...ledsEl.children];
  // the copy that is written once at start and again when the language changes while the intro is up
  const paintStatic = () => {
    const tt = t(), touch = matchMedia('(pointer: coarse)').matches; // {x} in the hint marks a key cap
    root.querySelector('#intro-hint').innerHTML = touch ? tt.ui.intro.t_hint : `${tt.ui.intro.hint}<span class="intro-keyboard">${tt.ui.intro.keyboardHint.replace(/\{(.+?)\}/g, '<kbd>$1</kbd>')}</span>`;
    stamp.textContent = returning ? tt.ui.intro.ticketReturn : tt.ui.intro.ticket; stamp.dataset.i18n = returning ? 'intro.ticketReturn' : 'intro.ticket';
    road.setAttribute('aria-label', tt.ui.intro.routeLabel);
    root.querySelector('.intro-profile').setAttribute('aria-label', tt.ui.intro.direct);
  };
  const paintTip = () => { const tips = t().ui.intro.tips; tipEl.textContent = tips[tipIndex % tips.length]; };
  const nextTip = () => { tipEl.classList.add('swap'); setTimeout(() => { tipIndex++; paintTip(); tipEl.classList.remove('swap'); }, 350); }; // fade out, swap the text, fade in
  const onLang = () => { if (active) { paintStatic(); paintTip(); paintProgress(); render(); } };
  const paintBlind = () => {
    const tt = t(), city = { sp: 'sp', london: 'ldn', glasgow: 'gla' }[root.dataset.preview || 'sp'];
    let label = tt.ui.cities[city];
    if (bellTimer) label = tt.ui.led.stop;
    else if (interacted) label = careerLabel(JOURNEY[journeyIndex(p)], tt);
    else if (!ready && !previewed) label = [returning ? tt.ui.led.welcomeBack : tt.ui.led.notInService, tt.ui.led.gap, tt.ui.led.warm][blindStep % 3]; // the city is still loading: the vehicle is not in service yet (a returning passenger is welcomed instead), and the blind cycles a few of the bus's own messages while it waits
    else if (boarding) label = tt.ui.led.allAboard;
    const text = label.toUpperCase();
    if (cur.textContent !== text) {
      cur.textContent = text;
      cur.classList.remove('roll');
      void cur.offsetWidth;
      cur.classList.add('roll');
    }
  };
  const paintProgress = () => {
    const { ratio, stage } = loadState(), ui = t().ui;
    shown = Math.max(shown, progressValue({ ratio, loaded, phase })); // never moves backwards: streaming the stills can add requests and lower the file ratio
    const value = ready ? 100 : shown; // 100 is only shown once the whole city has settled
    const photo = { settled: 'sp', sp: 'ldn', london: 'gla' }[phase], finishing = loaded && phase && (photo ? ui.intro.photo.replace('{city}', ui.cities[photo]) : ui.intro.touches); // what the finishing phase is doing now
    root.dataset.ready = String(ready);
    // the dots stay a static ticket perforation: the Start button fill and the bus on the line carry the progress
    skip.style.setProperty('--fill', `${value}%`); // the Start button fills with the same progress
    statusEl.setAttribute('aria-valuenow', String(value));
    statusText.textContent = ready ? ui.intro.loaded : (loaded ? ui.intro.finishing : ui.intro.loadingBtn); // no number: the fill and the bus already show how far it is
    stageEl.textContent = ready ? '' : finishing || (stage ? ui.intro.stages[stage] || '' : ''); // what is arriving now; outside the live region so a screen reader is not read every change
    if (!bellTimer) skip.textContent = ready ? ui.intro.start : ui.intro.loadingBtn; // the button says what it is doing until the city is ready
    autoTarget = ready ? 0 : ratio; // the toy bus rides the line as the world loads, then drives back to the first stop, ready to go forward
    if (!interacted && !raf) raf = requestAnimationFrame(glide);
  };
  const glide = () => {
    raf = 0;
    if (!active || interacted) return;
    const d = autoTarget - auto;
    if (reduced || Math.abs(d) < 0.002) auto = autoTarget; else { auto += d * 0.06; raf = requestAnimationFrame(glide); }
    render();
  };
  const render = () => {
    const shown = interacted ? p : auto;
    root.style.setProperty('--p', shown);
    const at = journeyIndex(shown);
    road.setAttribute('aria-valuemax', String(JOURNEY.length - 1)); road.setAttribute('aria-valuenow', String(at)); road.setAttribute('aria-valuetext', careerLabel(JOURNEY[at], t()));
    const preview = at >= glasgow ? 'glasgow' : at >= border ? 'london' : 'sp';
    if (root.dataset.preview !== preview) {
      root.dataset.preview = preview;
      previewStops.forEach(stop => {
        if (stop.dataset.previewStop === preview) stop.setAttribute('aria-current', 'location');
        else stop.removeAttribute('aria-current');
      });
    }
    const moving = interacted || auto > 0.01;
    nodes.forEach((n, i) => { n.classList.toggle('passed', moving && i <= at); n.classList.toggle('here', moving && i === at); });
    paintBlind();
    if (interacted) onDrive(p); // the loading ride and its return only move the toy bus; the 3D camera follows the visitor alone
  };
  const dismiss = ({ reveal = false } = {}) => {
    if (!active) return;
    active = false;
    clearTimeout(bellTimer); clearInterval(blindTimer); clearInterval(tipTimer);
    for (const u of previewUrls) setTimeout(() => URL.revokeObjectURL(u), 1500);
    unsubscribe();
    document.removeEventListener('keydown', onKey); document.removeEventListener('langchange', onLang);
    const close = () => {
      releaseSounds(); // the bell and the hiss end with the intro: the audio context is closed
      root.close();
      document.body.classList.remove('intro-on'); document.body.classList.add('intro-arrive');
      const heading = document.querySelector('#panel :is(h1, h2)');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    };
    const animate = reveal && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate) { onDrive(null); close(); return; }
    root.classList.add('opening', 'leaving');
    if (soundsPlayed !== 'hiss') { soundsPlayed = 'hiss'; hiss(); }
    onDrive(null);
    setTimeout(close, 1300);
  };
  const step = (dy, direction = dy) => {
    if (!active || bellTimer || !dy) return;
    if (!interacted) p = auto; // take over from the loading ride without a jump
    interacted = true;
    root.dataset.dir = direction > 0 ? 'down' : 'up';
    p = practice(p, dy);
    render();
  };
  root.addEventListener('wheel', e => {
    if (e.ctrlKey || (root.scrollHeight > root.clientHeight && !map.contains(e.target))) return;
    e.preventDefault();
    step(e.deltaY);
  }, { passive: false });
  const onKey = e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target === road) {
      const at = journeyIndex(interacted ? p : auto), last = JOURNEY.length - 1;
      const stopsByKey = { Home: 0, End: last, ArrowLeft: at - 1, ArrowDown: at - 1, ArrowRight: at + 1, ArrowUp: at + 1 };
      if (Object.hasOwn(stopsByKey, e.key)) {
        e.preventDefault();
        jumpTo(Math.max(0, Math.min(last, stopsByKey[e.key])));
        return;
      }
    }
    const dy = KEY_DY[e.key];
    if (!dy || (e.key === ' ' && e.target.closest?.('button, a'))) return;
    e.preventDefault();
    step(e.repeat ? dy / 2 : dy); // a held key eases: half a step per repeat
  };
  let lastY, lastX = 0;
  map.addEventListener('touchstart', e => { lastY = e.touches.length === 1 ? e.touches[0].clientY : undefined; lastX = e.touches[0]?.clientX ?? 0; }, { passive: true });
  let dragX = null; // mouse and pen: drag the toy bus along the line
  let downX = 0;
  map.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.button) return; dragX = downX = e.clientX; map.setPointerCapture(e.pointerId); map.classList.add('dragging'); });
  map.addEventListener('pointermove', e => { if (dragX === null) return; step((e.clientX - dragX) * 1.4); dragX = e.clientX; });
  const endDrag = () => { dragX = null; map.classList.remove('dragging'); };
  // a click (not a drag) on a year jumps the toy vehicle there
  const jumpTo = (i) => { if (!active || bellTimer) return; if (!interacted) p = auto; interacted = true; root.dataset.dir = fraction(i) >= p ? 'down' : 'up'; p = fraction(i); render(); };
  map.addEventListener('pointerup', e => { const click = dragX !== null && Math.abs(e.clientX - downX) < 4; endDrag(); if (click) { const i = nodes.indexOf(document.elementFromPoint(e.clientX, e.clientY)?.closest('.node')); if (i >= 0) jumpTo(i); } });
  map.addEventListener('pointercancel', endDrag);
  map.addEventListener('touchmove', e => {
    if (lastY === undefined || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    step((lastY - y) * 1.6 + (x - lastX) * 1.6); // swipe up or drag right both drive forward
    lastY = y; lastX = x;
  }, { passive: true });
  skip.addEventListener('click', () => {
    if (!active || bellTimer) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onBoard(); dismiss(); return; }
    bellTimer = setTimeout(() => dismiss({ reveal: true }), 900);
    onDrive(null); // let the camera return while the opaque intro is still visible
    root.classList.add('bell');
    const clock = new Intl.DateTimeFormat(document.documentElement.lang.startsWith('pt') ? 'pt-BR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    stub.querySelector('.intro-validated').textContent = t().ui.intro.validated.replace('{time}', clock); // the ticket is validated: a punched hole and the visitor's own time
    stub.insertAdjacentHTML('beforeend', '<i class="punch fresh" aria-hidden="true"></i>');
    onBoard(); // the conductor's "calling at" line
    paintBlind();
    if (!soundsPlayed) { soundsPlayed = 'bell'; ding(); }
    skip.disabled = true; // a second click cannot ring it again
    navigator.vibrate?.(40);
  });
  root.querySelector('[data-intro-direct]').addEventListener('click', () => { if (active && !bellTimer) dismiss(); }); // recruiters: straight to the HTML profile, no waiting for the city
  root.addEventListener('cancel', e => { e.preventDefault(); if (ready) dismiss(); }); // Esc waits for the city like Skip does
  return {
    start() {
      active = true;
      document.body.classList.add('intro-on');
      root.showModal();
      skip.disabled = true; // Skip opens only when the whole city has loaded
      const hour = new Date().getHours(), tt = t();
      root.dataset.tod = hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night'; // the windshield follows the visitor's own clock
      returning = !!navigator.serviceWorker?.controller; // a service worker already in control means the 3D assets are cached: this passenger has been here before, and nothing new is stored
      paintStatic();
      root.querySelector('.intro-barcode').innerHTML = barcode('0083');
      root.querySelectorAll('[data-link]').forEach((a) => { a.href = links[a.dataset.link]; });
      if (!reduced && matchMedia('(pointer: fine)').matches) { // the ticket leans a few degrees toward the cursor, like a card held in the hand
        const card = root.querySelector('.intro-card'); let tilt = 0;
        root.addEventListener('pointermove', (e) => {
          if (tilt || dragX !== null || bellTimer) return;
          tilt = requestAnimationFrame(() => { tilt = 0; card.style.setProperty('--ry', `${((e.clientX / innerWidth) - .5) * 5}deg`); card.style.setProperty('--rx', `${(.5 - (e.clientY / innerHeight)) * 3}deg`); });
        });
      }
      if (!reduced) blindTimer = setInterval(() => { if (active && !ready && !previewed && !interacted && !bellTimer) { blindStep++; paintBlind(); } }, 2600); // reduced motion keeps the first message still
      tipIndex = Math.floor(Math.random() * t().ui.intro.tips.length); paintTip(); // a different tip first on each visit
      if (!reduced) tipTimer = setInterval(() => { if (active && !bellTimer) nextTip(); }, 6500); // reduced motion keeps the first tip still
      document.addEventListener('keydown', onKey); document.addEventListener('langchange', onLang);
      unsubscribe = onLoadChange(() => { if (active) { paintProgress(); paintBlind(); } });
      paintProgress();
      render();
    },
    phase(name) { phase = name; if (active) paintProgress(); }, // a step of the finishing phase is done (main.js)
    worldLoaded() { loaded = true; if (active) paintProgress(); }, // the world exists, buildings and landmarks may still be arriving
    ready() {
      ready = true; skip.disabled = false;
      boarding = true; setTimeout(() => { boarding = false; if (active) paintBlind(); }, 2500); // "All aboard" for a moment, then the city name
      if (active && (document.activeElement === root || document.activeElement === document.body)) skip.focus({ preventScroll: true }); // keyboard users land on the button that just opened
      if (active) { paintProgress(); render(); }
    },
    showPreviews(photos) { // frozen real-city stills (São Paulo, London, Glasgow) come through the windshield, whichever stop the toy bus is at
      if (!active || interacted) return;
      previewed = true; paintBlind();
      const shield = root.querySelector('.intro-windshield');
      for (const [city, blob] of Object.entries(photos)) {
        if (!blob) continue;
        const url = URL.createObjectURL(blob), img = new Image(); previewUrls.push(url);
        img.className = 'live-view'; img.dataset.city = city; img.alt = ''; img.decoding = 'async';
        img.onload = () => { shield.append(img); shield.classList.add('photos'); };
        img.src = url;
      }
    },
    get interacted() { return interacted; },
    get active() { return active; },
    dismiss,
  };
}
