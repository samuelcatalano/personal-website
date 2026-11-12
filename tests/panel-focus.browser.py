import json
import time
# With the local preview open in browser-harness:
# browser-harness < tests/panel-focus.browser.py
assert page_info()['url'].startswith('http://localhost:'), 'Open the local preview first'
cdp('Emulation.setDeviceMetricsOverride', width=1280, height=800, deviceScaleFactor=1, mobile=False)
original_lang = js("localStorage.getItem('lang')")
fallback = cdp('Page.addScriptToEvaluateOnNewDocument', source="window.__panelOriginalContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : window.__panelOriginalContext.call(this, type, ...args); }")['identifier']
cdp('Runtime.evaluate', expression="localStorage.setItem('lang', 'en'); window.__panelPreviousDocument = true")
try:
    cdp('Page.reload', ignoreCache=True)
    wait_for_load()
    for _ in range(100):
        if js("!window.__panelPreviousDocument && document.readyState === 'complete'"): break
        time.sleep(.1)
    assert js("!window.__panelPreviousDocument"), 'Reload did not finish'
    reply = cdp('Runtime.evaluate', expression=r"""(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const panel = document.querySelector('#panel');
  const open = async section => {
    document.querySelector(`[data-nav="${section}"]`).click();
    for (let i = 0; i < 30 && panel.dataset.section !== section; i++) await new Promise(resolve => setTimeout(resolve, 30));
    check(panel.dataset.section === section, `Could not open ${section}`);
  };
  check(innerWidth >= 1100, 'This check is desktop-only');
  document.querySelector('[data-nav-home]').click();
  document.querySelector('[data-lang]').click();
  check(/\d{2}:\d{2}/.test(document.querySelector('[data-london]')?.textContent), 'London clock is empty after panel rebuild');
  document.querySelector('[data-lang]').click();
  const heroLinks = panel.querySelector('.hero-links');
  check(heroLinks.compareDocumentPosition(panel.querySelector('.tagline')) & Node.DOCUMENT_POSITION_FOLLOWING, 'Hero humour competes with contact actions');
  await open('repos');
  check(panel.querySelectorAll('a.repo small').length === 6, 'Repository descriptions are missing');
  const repo = panel.querySelector('a.repo');
  repo.focus();
  const href = repo.getAttribute('href');
  document.querySelector('[data-lang]').click();
  check(document.documentElement.lang === 'pt-BR', 'Language did not change');
  check(document.activeElement?.getAttribute('href') === href, 'Repository link lost focus on panel rebuild');
  check(panel.querySelector('a.repo small')?.textContent.includes('Exemplo'), 'Portuguese description is missing');
  await open('journey');
  const selected = panel.querySelector('[data-goto="9"]');
  selected.focus(); selected.click();
  for (let i = 0; i < 30 && !panel.querySelector('.current-stop[data-stop="9"]'); i++) await new Promise(resolve => setTimeout(resolve, 30));
  const ticket = panel.querySelector('.current-stop');
  check(ticket?.dataset.stop === '9', 'Selected stop has no leading ticket');
  check(ticket.compareDocumentPosition(panel.querySelector('.stops')) & Node.DOCUMENT_POSITION_FOLLOWING, 'Timeline precedes selected experience');
  check(ticket.compareDocumentPosition(panel.querySelector('.recent-role')) & Node.DOCUMENT_POSITION_FOLLOWING, 'Current role competes with selected experience');
  check(ticket.textContent.includes('xDesign') && ticket.textContent.includes('FanDuel'), 'Selected ticket has wrong company or contribution');
  check(panel.querySelector('.recent-role').textContent.includes('Tribal'), 'Compact current role is missing');
  check(!panel.querySelector('.recent-body'), 'Current role still repeats its full description');
  check(panel.scrollTop < 8, 'Selected ticket is scrolled out of view');
  check(document.activeElement?.dataset.goto === '9', 'Selected stop lost keyboard focus');
  const selectionBox = document.activeElement.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
  check(selectionBox.top >= panelBox.top && selectionBox.bottom <= panelBox.bottom, 'Keyboard focus is clipped below the selected ticket');
  document.querySelector('[data-lang]').click();
  check(panel.querySelector('.current-stop').textContent.includes('Senior Java Software Engineer'), 'Selected ticket did not translate');
  check(document.activeElement?.dataset.goto === '9', 'Selected stop lost focus on translation');
  document.querySelector('[data-lang]').click();
  await open('contact');
  const email = panel.querySelector('a[href^="mailto:"]');
  email.focus();
  document.querySelector('[data-lang]').click();
  check(document.activeElement?.getAttribute('href')?.startsWith('mailto:'), 'Contact link lost focus on panel rebuild');
  panel.querySelector('[data-credits]').focus();
  document.querySelector('[data-lang]').click();
  check(document.activeElement?.matches('[data-credits]'), 'Credits control lost focus on panel rebuild');
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const start = document.startViewTransition;
    let unhandled = false;
    const rejection = event => { unhandled = true; event.preventDefault(); };
    addEventListener('unhandledrejection', rejection);
    try {
      document.startViewTransition = update => { update(); return { ready: Promise.reject(new DOMException('Document hidden', 'InvalidStateError')) }; };
      document.querySelector('[data-theme]').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      check(!unhandled, 'Aborted theme reveal leaves an unhandled rejection');
    } finally {
      document.startViewTransition = undefined;
      document.querySelector('[data-theme]').click();
      document.startViewTransition = start;
      removeEventListener('unhandledrejection', rejection);
    }
  }
  return { pass: true, width: innerWidth, repositoryDescriptions: 6 };
})()""", returnByValue=True, awaitPromise=True, _response_timeout=60)
finally:
    cdp('Page.removeScriptToEvaluateOnNewDocument', identifier=fallback)
    js("HTMLCanvasElement.prototype.getContext = window.__panelOriginalContext; delete window.__panelOriginalContext")
    js("localStorage." + ("removeItem('lang')" if original_lang is None else "setItem('lang', " + json.dumps(original_lang) + ")"))
    cdp('Emulation.clearDeviceMetricsOverride')
assert 'exceptionDetails' not in reply, reply.get('exceptionDetails')
result = reply['result'].get('value')
print(result)
assert result and result.get('pass'), result
