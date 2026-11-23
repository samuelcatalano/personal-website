"""browser-harness < tests/intro-scroll-cue.browser.py; optional URL and OUT."""
import json
import os

out = os.environ.get('OUT')
if out:
    os.makedirs(out, exist_ok=True)
base = os.environ.get('URL', 'http://localhost:8000/').rstrip('/') + '/'
tab = new_tab(base + 'tests/fixtures/npc-stage.html')
target = tab if isinstance(tab, str) else tab['targetId']
activate_tab(target)
try:
    cdp('Network.enable')
    cdp('Network.setCacheDisabled', cacheDisabled=True)
    wait_for_load()
    js(r'''(async () => {
      window.__cueErrors = [];
      addEventListener('error', e => { if (e.message) __cueErrors.push(e.message); });
      addEventListener('unhandledrejection', e => __cueErrors.push(String(e.reason)));
      const base = new URL('../../', location.href);
      const source = new DOMParser().parseFromString(await (await fetch(new URL('index.html', base))).text(), 'text/html');
      window.__cueMarkup = source.querySelector('#intro');
      window.__cueBase = base;
      window.__cueModules = await Promise.all([import(new URL('js/intro.js', base)), import(new URL('js/content.js', base))]);
      const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('css/style.css', base);
      const loaded = new Promise((resolve,reject) => { sheet.onload=resolve; sheet.onerror=reject; });
      document.head.append(sheet); await loaded;
    })()''')
    for name, width, height in [('desktop', 1280, 1000), ('compact', 1280, 720)]:
        cdp('Emulation.setDeviceMetricsOverride', width=width, height=height,
            deviceScaleFactor=1, mobile=name in ['mobile', 'touch'])
        cdp('Emulation.setTouchEmulationEnabled', enabled=name == 'touch')
        for lang in ['en', 'pt']:
            for theme in ['day', 'night']:
                cdp('Emulation.setEmulatedMedia', features=[
                    {'name': 'prefers-reduced-motion', 'value': 'no-preference'}])
                js('document.documentElement.lang=' + json.dumps(lang) +
                   ';document.body.classList.toggle("theme-night",' + json.dumps(theme == 'night') + ')')
                js(r'''(async () => {
                  if (window.__cueIntro) { __cueIntro.dismiss(); document.querySelector('#intro').remove(); }
                  const intro = __cueMarkup.cloneNode(true);
                  intro.querySelectorAll('[src]').forEach(el => el.src = new URL(el.getAttribute('src'), __cueBase));
                  intro.querySelectorAll('[srcset]').forEach(el => el.srcset = new URL(el.getAttribute('srcset'), __cueBase));
                  const ui=__cueModules[1].i18n[document.documentElement.lang].ui;
                  intro.querySelectorAll('[data-i18n]').forEach(el => el.textContent=el.dataset.i18n.split('.').reduce((o,k)=>o[k],ui));
                  document.body.append(intro);
                  window.__cueIntro=__cueModules[0].createIntro(intro); __cueIntro.start(); __cueIntro.ready(); // the scroll cue is judged once the city can be moved through; its hint stays hidden while loading
                  if (!intro.open) { intro.showModal(); document.body.classList.add('intro-on'); }
                  await document.fonts.ready;
                  await document.querySelector('.intro-mouse-reference').decode();
                  await new Promise(requestAnimationFrame);
                })()''')
                result = js(r'''(() => {
                  const get = selector => {
                    const el = document.querySelector(selector);
                    if (!el) throw Error('Missing ' + selector);
                    return el;
                  };
                  const cue=get('.intro-scroll-cue'), image=get('.intro-mouse-reference');
                  const hint=get('#intro-hint'), card=get('.intro-card');
                  const c=cue.getBoundingClientRect(), i=image.getBoundingClientRect();
                  const h=hint.getBoundingClientRect();
                  const disjoint=(x,y)=>x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top;
                  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0};
                  return {
                    visible: [cue,image,hint].every(visible),
                    noArrows: !document.querySelector('.intro-scroll-arrows'),
                    hintDisjoint: disjoint(c,h)&&disjoint(i,h),
                    hintHierarchy: matchMedia('(pointer: coarse)').matches || (()=>{const secondary=hint.querySelector('.intro-keyboard');return !!secondary && secondary.querySelectorAll('kbd').length===2 && getComputedStyle(secondary).display==='block' && parseFloat(getComputedStyle(secondary).fontSize)<parseFloat(getComputedStyle(hint).fontSize)})(),
                    noOverflow: card.scrollWidth<=card.clientWidth+1&&card.getBoundingClientRect().left>=0&&card.getBoundingClientRect().right<=innerWidth+1,
                    noPointer: getComputedStyle(cue).pointerEvents==='none',
                    imageAnimation: getComputedStyle(image).animationName,
                    animatedSource: image.currentSrc.split('?')[0].endsWith('/mouse-scroll.gif'),
                    errors: window.__cueErrors,
                    lang: document.documentElement.lang,
                    night: document.body.classList.contains('theme-night')
                  };
                })()''')
                label = name + '/' + lang + '/' + theme
                if out:
                    capture_screenshot(os.path.join(out, 'intro-cue-' + label.replace('/', '-') + '.png'))
                assert result['visible'] and result['noArrows'] and result['animatedSource'], (label, result)
                assert result['hintDisjoint'] and result['noOverflow'] and result['hintHierarchy'], (label, result)
                assert result['noPointer'] and result['imageAnimation'] == 'none', (label, result)
                assert not result['errors'], (label, result)
                assert result['lang'].startswith(lang) and result['night'] == (theme == 'night'), (label, result)
                cdp('Emulation.setEmulatedMedia', features=[
                    {'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                js("new Promise(requestAnimationFrame).then(()=>new Promise(requestAnimationFrame)).then(()=>document.querySelector('.intro-mouse-reference').decode())")
                assert js("document.querySelector('.intro-mouse-reference').currentSrc.split('?')[0].endsWith('/mouse-scroll-spritesheet.png') && document.querySelector('.intro-mouse-reference').getBoundingClientRect().width === document.querySelector('.intro-scroll-cue').getBoundingClientRect().width*4"), label
                print(json.dumps({'pass': True, 'case': label}))
finally:
    cdp('Emulation.setEmulatedMedia', features=[])
    cdp('Emulation.setTouchEmulationEnabled', enabled=False)
    cdp('Emulation.clearDeviceMetricsOverride')
    cdp('Target.closeTarget', targetId=target)
