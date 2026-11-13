# Controlled real intro markup/styles, without loading the 3D world.
import os
import time

out=os.environ.get('OUT')
if out: os.makedirs(out,exist_ok=True)
t=new_tab('http://localhost:8000/tests/fixtures/npc-stage.html')
target=t if isinstance(t,str) else t['targetId']
activate_tab(target)
try:
    cdp('Network.enable')
    cdp('Network.setCacheDisabled',cacheDisabled=True)
    cdp('Network.setBypassServiceWorker',bypass=True)
    cdp('Emulation.setDeviceMetricsOverride',width=1280,height=900,deviceScaleFactor=1,mobile=False)
    wait_for_load()
    result=js(r'''(async()=>{
      const {createIntro}=await import('/js/intro.js'),{i18n,stops}=await import('/js/content.js'),{trackLoad}=await import('/js/world/load-progress.js');
      const source=new DOMParser().parseFromString(await(await fetch('/index.html')).text(),'text/html');
      const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/css/style.css';document.head.append(sheet);
      await new Promise((resolve,reject)=>{sheet.onload=resolve;sheet.onerror=reject});
      const check=(ok,msg)=>{if(!ok)throw Error(msg)},results=[];
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const luminance=css=>{ctx.fillStyle=css;ctx.fillRect(0,0,1,1);const c=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      for(const lang of ['en','pt']){
       document.documentElement.lang=lang;document.body.classList.toggle('theme-night',lang==='pt');
       const root=source.getElementById('intro').cloneNode(true);document.body.append(root);
       const ui=i18n[lang].ui;
       root.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=el.dataset.i18n.split('.').reduce((o,k)=>o[k],ui));
       let release;const pending=trackLoad('/assets/buildings/intro-fixture.glb',new Promise(r=>release=r));
       const intro=createIntro(root);intro.start();
       const progress=root.querySelector('.status'),button=root.querySelector('[data-intro-skip]');
       check(progress.getBoundingClientRect().width>100&&!progress.classList.contains('sr-only'),'Loading progress must be visible on the paper ticket');
       check(button.disabled&&root.dataset.ready==='false','CTA opens before the city is ready');
       check(root.querySelector('.dest .cur').textContent===ui.cities.sp.toUpperCase(),'Destination blind is not a stable city label');
       check(root.querySelector('.intro-ticket').textContent.includes('Samuel Catalano'),'Ticket owner missing');
       check(root.querySelector('.intro-stub').textContent.includes(ui.intro.passenger),'Passenger stub missing');
       check(root.querySelector('.intro-windshield').getBoundingClientRect().height>=176,'City preview remains too small');
       root.dispatchEvent(new Event('cancel',{cancelable:true}));check(root.open,'Escape bypasses loading');
       const photos={};
       for(const [city,colour]of Object.entries({sp:'#b56b49',london:'#596d80',glasgow:'#8d795c'})){
        const image=document.createElement('canvas');image.width=300;image.height=150;const paint=image.getContext('2d');paint.fillStyle=colour;paint.fillRect(0,0,300,150);
        photos[city]=await new Promise(resolve=>image.toBlob(resolve,'image/png'));
       }
       intro.showPreviews(photos);
       for(let i=0;i<40&&root.querySelectorAll('.live-view').length<3;i++)await new Promise(r=>setTimeout(r,25));
       check(root.querySelectorAll('.live-view').length===3,'Three decoded city previews not retained');
       release();await pending;intro.worldLoaded();
       check(button.disabled&&root.querySelector('#intro-status-text').textContent.includes(ui.intro.finishing),'Finishing state lost');
       intro.ready();
       await new Promise(r=>setTimeout(r,500)); // Measure the ready palette after its 400 ms colour transition.
       check(!button.disabled&&root.dataset.ready==='true'&&button.textContent===ui.intro.start,'Ready boarding state missing');
       check(root.querySelector('#intro-status-text').textContent===ui.intro.loaded&&progress.getAttribute('aria-valuenow')==='100','Ready progress/announcement missing');
       check(document.activeElement===button,'Ready keyboard focus lost');
       const paper=getComputedStyle(root).getPropertyValue('--ticket');
       check(contrast(getComputedStyle(root.querySelector('.intro-ticket-stamp')).color,paper)>=4.5,'Ticket stamp contrast');
       const fg=getComputedStyle(button).color,bg=getComputedStyle(button).backgroundColor;
       check(contrast(fg,bg)>=4.5,'Boarding CTA contrast '+JSON.stringify({fg,bg,ratio:contrast(fg,bg)}));
       check(contrast(getComputedStyle(progress).color,paper)>=4.5,'Ready status contrast');
       const journey=stops.filter(s=>s.section==='journey'),move=journey.findIndex(s=>s.id==='move')/(journey.length-1);
       root.dispatchEvent(new WheelEvent('wheel',{deltaY:move*500,bubbles:true,cancelable:true}));
       check(root.dataset.preview==='london'&&root.querySelector('.intro-stations [aria-current]').dataset.previewStop==='london','Photo caption and practice route disagree');
       await new Promise(r=>setTimeout(r,700));
       const visible=[...root.querySelectorAll('.live-view')].filter(img=>Number(getComputedStyle(img).opacity)>.99);
       check(visible.length===1&&visible[0].dataset.city==='london','More than one settled city photo is visible');
       const b=root.querySelector('.intro-card').getBoundingClientRect();check(b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight,'Desktop ticket clips');
       results.push({lang,previewHeight:root.querySelector('.intro-windshield').getBoundingClientRect().height,cta:button.textContent});
       intro.dismiss();root.remove();
      }
      return{pass:true,results};
    })()''')
    assert result and result.get('pass'),result
    print(result)
finally:
    cdp('Emulation.clearDeviceMetricsOverride')
    cdp('Target.closeTarget',targetId=target)
