# Desktop disclosure, readable metadata and ride-state checks. Local preview required.
import json

tab = new_tab('http://localhost:8000/tests/fixtures/npc-stage.html')
target = tab if isinstance(tab, str) else tab['targetId']
activate_tab(target)
wait_for_load()
prefs = js("({lang:localStorage.getItem('lang'),theme:localStorage.getItem('theme'),sound:localStorage.getItem('sound')})")
script = cdp('Page.addScriptToEvaluateOnNewDocument', source="""
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
};
localStorage.setItem('lang', 'en'); localStorage.setItem('theme', 'day');
""")['identifier']
try:
    cdp('Network.enable')
    cdp('Network.setBypassServiceWorker', bypass=True)
    cdp('Network.setCacheDisabled', cacheDisabled=True)
    cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
    cdp('Emulation.setEmulatedMedia', features=[{'name':'prefers-reduced-motion','value':'reduce'}])
    goto_url('http://localhost:8000/?nosw')
    wait_for_load()
    result = js(r'''(async () => {
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const visible = el => !!el?.getBoundingClientRect().width;
      const controls = document.querySelector('.controls'), panel = document.querySelector('#panel');
      check(visible(controls.querySelector('[data-auto] .control-label')) && visible(controls.querySelector('[data-quick] .control-label')), 'Missing visible ride labels');
      const toggle = controls.querySelector('[data-options]'), options = document.getElementById('control-options');
      check(toggle && toggle.getAttribute('aria-controls') === options.id, 'Disclosure must name its group');
      check(toggle.getAttribute('aria-expanded') === 'false' && !visible(options), 'Secondary controls start collapsed');
      toggle.click();
      check(toggle.getAttribute('aria-expanded') === 'true' && visible(options), 'Secondary controls did not open');
      const sound = options.querySelector('[data-sound]'), before = sound.getAttribute('aria-pressed');
      sound.click(); check(sound.getAttribute('aria-pressed') !== before, 'Secondary sound action is unreachable'); sound.click();
      options.querySelector('[data-photo]').focus();
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      check(toggle.getAttribute('aria-expanded') === 'false' && document.activeElement === toggle, 'Escape must close options and restore focus');
      toggle.click(); document.querySelector('[data-nav-home]').click();
      check(toggle.getAttribute('aria-expanded') === 'false', 'Clicking outside must close options');
      const language = controls.querySelector('[data-lang]');
      for (const lang of ['en', 'pt']) {
        const {i18n} = await import('/js/content.js');
        check(toggle.textContent.trim() === i18n[lang].ui.controlOptions, 'Options label did not translate');
        document.querySelector('[data-nav=repos]').click();
        check(parseFloat(getComputedStyle(panel.querySelector('.tags i')).fontSize) >= 12, 'Repository tags remain too small');
        document.querySelector('[data-nav=stack]').click();
        check(parseFloat(getComputedStyle(panel.querySelector('.ticket-meta')).fontSize) >= 12, 'Tool metadata remains too small');
        language.click();
      }
      document.querySelector('[data-nav-home]').click();
      check(panel.clientWidth >= 390, 'Reading surface is still too narrow');
      check(parseFloat(getComputedStyle(panel.querySelector('.hint')).fontSize) >= 12, 'Ride instruction remains too small');
      controls.querySelector('[data-quick]').click();
      check(controls.querySelector('[data-quick]').getAttribute('aria-pressed') === 'true' && controls.querySelector('[data-auto]').getAttribute('aria-pressed') === 'false', 'Auto Ride must identify its own active state');
      controls.querySelector('[data-quick]').click();
      return {pass:true, disclosure:true, localized:true, quickState:true};
    })()''')
    print(result)
    js("document.querySelector('[data-options]').focus()")
    for event in ['keyDown', 'keyUp']:
        cdp('Input.dispatchKeyEvent', type=event, key=' ', code='Space', windowsVirtualKeyCode=32)
    assert js("document.querySelector('[data-options]').getAttribute('aria-expanded')==='true'"), 'Space must open options'
    cdp('Input.dispatchKeyEvent', type='keyDown', key='Escape', code='Escape', windowsVirtualKeyCode=27)
    assert js("document.querySelector('[data-options]').getAttribute('aria-expanded')==='false' && document.activeElement.matches('[data-options]')"), 'Keyboard dismissal lost focus'
    for width in [1280, 1440, 1920]:
        cdp('Emulation.setDeviceMetricsOverride', width=width, height=900, deviceScaleFactor=1, mobile=False)
        assert js("[...document.querySelectorAll('.bar > a,.bar nav,.controls')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})"), f'Header clips at {width}px'
    print({'pass': True, 'desktopWidths': [1280, 1440, 1920]})
finally:
    cdp('Page.removeScriptToEvaluateOnNewDocument', identifier=script)
    for key, value in prefs.items():
        js('localStorage.' + ('removeItem('+json.dumps(key)+')' if value is None else 'setItem('+json.dumps(key)+','+json.dumps(value)+')'))
    cdp('Emulation.clearDeviceMetricsOverride')
    cdp('Emulation.setEmulatedMedia', features=[])
    close_tab(target)
