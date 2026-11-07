"""Run with browser-harness. MOBILE=1 tests touch and early Skip; BOARD=1 waits for the world with reduced motion."""
import os
import time

mobile = os.environ.get('MOBILE') == '1'
board = not mobile or os.environ.get('BOARD') == '1'
out = os.environ.get('OUT')

def arrow(key, code, count=1):
    for _ in range(count):
        cdp('Input.dispatchKeyEvent', type='keyDown', key=key, windowsVirtualKeyCode=code)
        cdp('Input.dispatchKeyEvent', type='keyUp', key=key, windowsVirtualKeyCode=code)

tab = new_tab('about:blank')
tab_id = tab if isinstance(tab, str) else tab['targetId']
activate_tab(tab_id)
try:
    cdp('Emulation.setDeviceMetricsOverride', width=375 if mobile else 1280,
        height=812 if mobile else 800, deviceScaleFactor=1, mobile=mobile)
    if mobile:
        cdp('Emulation.setTouchEmulationEnabled', enabled=True)
        cdp('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
    cdp('Network.enable')
    cdp('Network.setCacheDisabled', cacheDisabled=True)
    cdp('Page.addScriptToEvaluateOnNewDocument', source="""
      localStorage.setItem('lang', '%s'); localStorage.setItem('theme', '%s');
      window.__introErrors = [];
      addEventListener('error', e => { if (e.message) __introErrors.push(e.message); });
      const logError = console.error;
      console.error = (...args) => { __introErrors.push(args.join(' ')); logError(...args); };
    """ % ('pt' if mobile else 'en', 'night' if mobile else 'day'))
    goto_url(os.environ.get('URL', 'http://localhost:8000/'))
    for _ in range(80):
        if js("!!document.querySelector('#intro[open]') || document.body?.classList.contains('no-webgl')"): break
        time.sleep(.25)
    assert js("document.querySelector('#intro').matches(':modal')"), js("[document.querySelector('#intro')?.outerHTML.slice(0, 130), document.body.className, window.__introErrors]")
    assert js("getComputedStyle(document.querySelector('#intro')).backdropFilter.includes('blur(14px)')")
    assert js("document.querySelector('.intro-stations').children.length === 3"), 'Expected three illustrated stops'
    assert js("document.querySelector('.intro-stations [aria-current]').dataset.previewStop === 'sp'")
    cue = '.touch' if mobile else '.wheel'
    assert js(f"document.querySelector('.intro-guide {cue}')?.getBoundingClientRect().height > 0")
    assert js("getComputedStyle(document.querySelector('.route-vehicle .mini')).display !== 'none'")
    assert js("getComputedStyle(document.querySelector('.route-vehicle .bus')).display === 'none'")
    assert js("document.querySelectorAll('#intro button').length === 1")
    assert js("document.querySelector('[data-intro-skip]:enabled').getBoundingClientRect().height >= 44")
    assert js("document.querySelector('[data-intro-skip]').textContent") == ('Pular' if mobile else 'Skip')
    assert js("document.querySelector('.intro-card').getBoundingClientRect().right <= innerWidth")
    assert js("getComputedStyle(document.querySelector('#loading')).display === 'none'")
    if out:
        capture_screenshot(os.path.join(out, 'intro-mobile.png' if mobile else 'intro-desktop.png'))
    if mobile:
        assert 'Deslize' in js("document.getElementById('intro-hint').textContent")
        x, y = js("(()=>{const r=document.querySelector('.intro-map').getBoundingClientRect();return [r.x+r.width/2,r.y+90]})()")
        cdp('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x': x, 'y': y}])
        cdp('Input.dispatchTouchEvent', type='touchMove', touchPoints=[{'x': x, 'y': y - 50}])
        cdp('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
    else:
        assert js("document.activeElement.matches('.intro-map')")
        x, y = js("(()=>{const r=document.querySelector('.intro-windshield').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        cdp('Input.dispatchMouseEvent', type='mouseWheel', x=x, y=y, deltaX=0, deltaY=120)
        js("new Promise(requestAnimationFrame)")
    assert js("Number(document.querySelector('#intro').style.getPropertyValue('--p')) > 0")
    assert js("document.querySelector('#intro').dataset.dir === 'down'"), 'Forward should highlight the down arrow for wheel, touch and keyboard'
    if not mobile:
        js("document.querySelector('[data-intro-skip]').focus()")
        arrow('ArrowDown', 40, 5)
        arrow('ArrowUp', 38, 3)
        assert js("document.querySelector('.intro-stations [aria-current]').dataset.previewStop === 'london'"), 'Up should drive forward while Skip has focus'
        assert js("document.querySelector('#intro').dataset.dir === 'up'")
        assert js("getComputedStyle(document.querySelector('.route-vehicle .bus')).display !== 'none'")
        if out:
            time.sleep(.25)
            capture_screenshot(os.path.join(out, 'intro-london.png'))
        arrow('ArrowUp', 38)
        assert js("document.querySelector('.intro-stations [aria-current]').dataset.previewStop === 'glasgow'")
        assert js("getComputedStyle(document.querySelector('.route-vehicle .bus')).display !== 'none'")
        js("document.activeElement.blur()")
        at_glasgow = js("Number(document.querySelector('#intro').style.getPropertyValue('--p'))")
        arrow('ArrowDown', 40)
        assert js("Number(document.querySelector('#intro').style.getPropertyValue('--p'))") < at_glasgow
        arrow('ArrowDown', 40, 4)
        assert js("document.querySelector('.intro-stations [aria-current]').dataset.previewStop === 'sp'"), 'Down should drive backward after the control loses focus'
        assert js("document.querySelector('#intro').dataset.dir === 'down'")
    assert js("""(() => {
      const card = document.querySelector('.intro-card').getBoundingClientRect();
      const skip = document.querySelector('[data-intro-skip]').getBoundingClientRect();
      return Math.abs(card.x + card.width / 2 - skip.x - skip.width / 2) < 1;
    })()"""), 'Skip should be centered in the card'
    if board:
        for _ in range(120):
            if js("document.body.classList.contains('world-ready')"): break
            time.sleep(.25)
        assert js("document.body.classList.contains('world-ready')")
    if mobile:
        js("document.querySelector('[data-intro-skip]').click()")
    else:
        js("document.querySelector('[data-intro-skip]').focus()")
        cdp('Input.dispatchKeyEvent', type='keyDown', key=' ', code='Space', windowsVirtualKeyCode=32)
        cdp('Input.dispatchKeyEvent', type='keyUp', key=' ', code='Space', windowsVirtualKeyCode=32)
    if board:
        if not mobile:
            assert js("""(() => {
              const intro = document.querySelector('#intro');
              return intro.classList.contains('bell') && !intro.classList.contains('opening') &&
                intro.querySelector('.dest .cur').textContent === 'STOP REQUESTED';
            })()"""), 'Show the stop request before opening the glass panels'
            for _ in range(45):
                if js("document.querySelector('#intro').classList.contains('opening')"): break
                time.sleep(.03)
            assert js("document.querySelectorAll('#intro .intro-card > .door').length === 2")
            time.sleep(.24)
            assert js("""(() => {
              const intro = document.querySelector('#intro');
              const shift = side => new DOMMatrix(getComputedStyle(intro.querySelector('.door.' + side)).transform).m41;
              return getComputedStyle(intro).opacity === '1' && shift('l') < 0 && shift('r') > 0;
            })()"""), 'The glass panels should slide apart before the overlay fades'
            time.sleep(.43)
            assert js("""(() => {
              const intro = document.querySelector('#intro'), opacity = Number(getComputedStyle(intro).opacity);
              return intro.open && opacity > 0 && opacity < 1;
            })()"""), 'The intro should fade while the glass panels finish opening'
            time.sleep(.75)
    assert js("!document.querySelector('#intro').open && !document.body.classList.contains('no-webgl')")
    if not board:
        for _ in range(120):
            if js("document.body.classList.contains('world-ready')"): break
            time.sleep(.25)
        assert js("document.body.classList.contains('world-ready')")
    assert js("document.activeElement.matches('#panel :is(h1, h2)')")
    assert js("window.__introErrors.length === 0"), js("window.__introErrors")
    print('intro passed', 'mobile / PT' if mobile else 'desktop / EN', 'ready Skip' if board else 'early Skip')
finally:
    cdp('Target.closeTarget', targetId=tab_id)
