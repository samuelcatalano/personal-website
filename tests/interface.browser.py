# With the local preview open in browser-harness:
# browser-harness < tests/interface.browser.py
import base64
from pathlib import Path

assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
out = Path('/tmp/london-maquette-interface')
out.mkdir(exist_ok=True)

def screenshot(name):
    (out / name).write_bytes(base64.b64decode(cdp('Page.captureScreenshot', format='png')['data']))

fallback_script = cdp('Page.addScriptToEvaluateOnNewDocument', source="HTMLCanvasElement.prototype.__originalGetContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : Reflect.apply(this.__originalGetContext, this, [type, ...args]); }")['identifier']
cdp('Runtime.evaluate', expression="history.replaceState(null, '', location.pathname); localStorage.setItem('lang', 'en'); localStorage.setItem('theme', 'day')")
cdp('Page.reload', ignoreCache=True)
wait_for_load()
cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
try:
    print(js("""(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 30));
  const waitForSection = async section => {
    for (let n = 0; n < 20 && panel.dataset.section !== section; n++) await wait();
    check(panel.dataset.section === section, `Navigation did not activate ${section}`);
  };
  const panel = document.querySelector('#panel');
  const nav = document.querySelector('.bar nav');
  for (const control of document.querySelectorAll('.controls button')) {
    const r = control.getBoundingClientRect(); check(r.left >= 0 && r.right <= innerWidth, 'Language/theme control is offscreen');
  }
  const sections = ['hero', 'journey', 'stack', 'articles', 'repos', 'recs', 'contact'];
  for (const section of sections) {
    const link = section === 'hero' ? document.querySelector('[data-nav-home]') : document.querySelector(`[data-nav=\"${section}\"]`);
    check(link, `Missing direct navigation to ${section}`);
    link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (section !== 'hero') {
      const navBox = nav.getBoundingClientRect(), linkBox = link.getBoundingClientRect();
      check(linkBox.left >= navBox.left && linkBox.right <= navBox.right, `${section} link did not reveal in mobile navigation`);
    }
    link.click(); await waitForSection(section);
    check(link.getAttribute('aria-current') === 'page', `${section} is not marked current`);
  }
  check(document.documentElement.scrollWidth <= innerWidth, 'Document has horizontal overflow');
  return { pass: true, mobileWidth: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth };
})()"""))
    print(js("""(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 30));
  document.querySelector('[data-nav=journey]').click(); await wait();
  const rows = document.querySelectorAll('[data-goto]');
  check(rows.length === 10, `Expected 10 journey buttons, found ${rows.length}`);
  check(document.querySelectorAll('.stops li.on').length === 1, 'Journey must show exactly one active detail');
  check(document.querySelectorAll('.detail').length === 1, 'Journey must show exactly one open detail');
  const prevY = scrollY;
  document.querySelector('[data-lang]').focus(); document.querySelector('[data-lang]').click(); await wait();
  check(document.documentElement.lang === 'pt-BR', 'Portuguese language did not apply');
  check(document.activeElement.matches('[data-lang]'), 'Language control lost focus after rendering');
  check(scrollY === prevY, 'Language rendering changed page scroll');
  document.querySelector('[data-lang]').click(); await wait();
  document.querySelector('[data-nav-home]').click(); await wait();
  document.querySelector('[data-nav=journey]').click(); await wait();
  const row = document.querySelector('[data-goto]'); row.focus(); row.click(); await wait();
  check(document.activeElement.hasAttribute('data-goto'), 'Career selection lost focus after rendering');
  check(document.querySelectorAll('.detail').length === 1, 'Career selection must keep one detail open');
  document.querySelector('[data-nav=contact]').click(); await wait();
  const email = document.querySelector('.contact a[href^=\"mailto:\"]');
  check(email && email.getBoundingClientRect().width > 0, 'Contact email is inaccessible at 375px');
  check(document.querySelector('[data-theme]'), 'Theme control is unreachable');
  return { pass: true, careerRows: rows.length };
})()"""))
    print(js("""(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const { i18n, stops } = await import('./js/content.js');
  const wait = () => new Promise(resolve => setTimeout(resolve, 60));
  const panel = document.querySelector('#panel');
  document.querySelector('[data-nav-home]').click(); await wait();
  const en = i18n.en.sections.hero;
  check(panel.dataset.section === 'hero' && document.querySelector('h1').textContent === en.title && document.querySelector('.role').textContent === en.role && document.querySelector('.tagline').textContent === en.tagline && document.querySelector('.meta').textContent === en.meta, 'English hero copy does not match i18n');
  document.querySelector('[data-lang]').click(); await wait();
  const pt = i18n.pt.sections.hero;
  check(document.documentElement.lang === 'pt-BR' && document.querySelector('h1').textContent === pt.title && document.querySelector('.role').textContent === pt.role && document.querySelector('.tagline').textContent === pt.tagline && document.querySelector('.meta').textContent === pt.meta, 'Portuguese hero copy does not match i18n');
  document.querySelector('[data-nav=journey]').click(); await wait();
  const active = stops[Number(document.querySelector('.on button').dataset.goto)];
  check(document.querySelector('.detail').textContent.includes(i18n.pt.stops[active.id].role), 'Portuguese career role does not match i18n');
  document.querySelector('[data-lang]').click(); await wait();
  check(document.querySelector('.detail').textContent.includes(i18n.en.stops[active.id].role), 'English career role does not match i18n');
  return { pass: true, checked: ['hero title/role/tagline/meta EN/PT', 'career role EN/PT'] };
})()"""))
    screenshot('mobile-en-day.png')
finally:
    js("if (HTMLCanvasElement.prototype.__originalGetContext) HTMLCanvasElement.prototype.getContext = HTMLCanvasElement.prototype.__originalGetContext; delete HTMLCanvasElement.prototype.__originalGetContext")
    cdp('Page.removeScriptToEvaluateOnNewDocument', identifier=fallback_script)
    cdp('Emulation.clearDeviceMetricsOverride')

cdp('Emulation.setDeviceMetricsOverride', width=800, height=900, deviceScaleFactor=1, mobile=False)
print(js("""(() => {
  const nav = document.querySelector('.bar nav').getBoundingClientRect();
  const controls = document.querySelector('.controls').getBoundingClientRect();
  if (document.documentElement.scrollWidth > innerWidth) throw Error('Document overflows at 800px');
  if (nav.left < 0 || nav.right > innerWidth || controls.left < 0 || controls.right > innerWidth) throw Error('Header overflows at 800px');
  return { pass: true, width: innerWidth, nav: [nav.left, nav.right], controls: [controls.left, controls.right] };
})()"""))
screenshot('tablet-800-en-day.png')
cdp('Emulation.clearDeviceMetricsOverride')

# Capture real scene states at desktop and mobile sizes after the fallback-only UI checks.
cdp('Runtime.evaluate', expression="history.replaceState(null, '', location.pathname); localStorage.setItem('lang', 'en'); localStorage.setItem('theme', 'day')")
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1.25, mobile=False)
cdp('Page.reload', ignoreCache=True)
wait_for_load()
js('scrollTo(0, 0)')
import time
time.sleep(2)
screenshot('desktop-en-day-hero.png')
js("document.querySelector('[data-nav=journey]').click()")
time.sleep(2)
screenshot('desktop-en-day-career.png')
js("document.querySelector('[data-lang]').click()")
time.sleep(.3)
screenshot('desktop-pt-day-career.png')
js("document.querySelector('[data-theme]').click()")
time.sleep(.3)
screenshot('desktop-pt-night-career.png')
cdp('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
js("document.querySelector('[data-nav-home]').click()")
time.sleep(2)
screenshot('mobile-pt-night-hero.png')
js("document.querySelector('[data-nav=journey]').click()")
time.sleep(2)
screenshot('mobile-pt-night-career.png')
js("document.querySelector('[data-theme]').click(); document.querySelector('[data-lang]').click()")
time.sleep(.3)
screenshot('mobile-en-day-career.png')
cdp('Emulation.setDeviceMetricsOverride', width=187, height=406, deviceScaleFactor=1, mobile=True)
screenshot('mobile-200pct-zoom-career.png')
cdp('Emulation.clearDeviceMetricsOverride')
