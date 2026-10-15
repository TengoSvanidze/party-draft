import {createKnotMotion} from './dark-motion.mjs';
import {createDarkScene} from './dark-scene.mjs';
import {DarkAudio} from './dark-audio.mjs';
import {ERAS,YEARS,INTRO_SECONDS,introCard,wrapYear,readSeen,markSeen} from './dark-config.mjs';

export function mountDarkPortal(root,{language='en',onExit=()=>{},onEnterGame=onExit}={}){
 const ka=language==='ka',tr=(en,ge)=>ka?ge:en,events=new AbortController(),audio=new DarkAudio();
 const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches;
 let scene=null,disposed=false,mode='loading',era=3,elapsed=0,clock=0,last=0,raf=0,glitch=0,rotationX=0,rotationY=0,mouseX=0,mouseY=0,drag=null,visible=true,hasSeen=false,frameTimes=[];
 try{hasSeen=readSeen(localStorage);}catch{}
 const knot=createKnotMotion();let hover='',zoom=0,flashlight=true,ripple=0;
 const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const id='dark-'+Math.random().toString(36).slice(2);
 root.className='dark-portal';root.dataset.mode='loading';root.tabIndex=-1;root.setAttribute('aria-label',tr('DARK interactive world','DARK-ის ინტერაქტიული სამყარო'));
 root.innerHTML=`<canvas class="dark-portal-canvas" tabindex="0" role="img" aria-label="${tr('3D forest and cave. Drag the glowing knot to rotate it. Press Enter to enter the cave.','3D ტყე და გამოქვაბული. გადაათრიე მანათობელი კვანძი მის დასატრიალებლად. შესასვლელად დააჭირე Enter-ს.')}"></canvas>
 <div class="dark-frame" aria-hidden="true"></div>
 <nav class="dark-top" aria-label="${tr('Scene controls','სცენის მართვა')}"><button class="dark-exit" type="button">← ${tr('Back','უკან')}</button><span class="dark-brand">PARTY DRAFT <i>/</i> WINDEN</span><div class="dark-top-actions"><button class="dark-settings" type="button" aria-haspopup="dialog" aria-controls="${id}-controls">${tr('Controls','მართვა')}</button><button class="dark-sound" type="button" aria-pressed="false">${tr('Sound off','ხმა გამორთულია')}</button></div></nav>
 <div class="dark-loading dark-centered" role="status"><span class="dark-hourglass" aria-hidden="true">⌛</span><p>${tr('Finding the passage…','გასასვლელის ძიება…')}</p><progress class="dark-model-progress" max="1" aria-label="${tr('Cave model loading','გამოქვაბულის მოდელის ჩატვირთვა')}"></progress></div>
 <div class="dark-start dark-centered"><span class="dark-kicker">${tr('AN ORIGINAL INTERACTIVE EXPERIENCE','ორიგინალური ინტერაქტიული გამოცდილება')}</span><h1>DARK</h1><p>${tr('There is no beginning. There is no end.','არ არსებობს დასაწყისი. არ არსებობს დასასრული.')}</p><button class="dark-begin" type="button">${hasSeen||reduced?tr('ENTER WINDEN','შედი ვინდენში'):tr('CLICK TO BEGIN','დააჭირე დასაწყებად')}</button><small>${tr('Starts the original soundscape · headphones recommended','ირთვება ორიგინალური ხმა · სასურველია ყურსასმენები')}</small><button class="dark-no-intro dark-link" type="button">${tr('Enter without intro or sound','შესვლა შესავლისა და ხმის გარეშე')}</button></div>
 <div class="dark-intro" aria-live="off"><p class="dark-intro-card"></p><span class="dark-intro-rule"></span></div>
 <button class="dark-skip" type="button">${tr('Skip intro','გამოტოვე შესავალი')} <small>ESC</small></button>
 <div class="dark-heading"><span class="dark-kicker">${tr('EVERYTHING IS CONNECTED','ყველაფერი კავშირშია')}</span><h1>DARK</h1><p class="dark-era-name"></p></div>
 <div class="dark-cave-hint"><button class="dark-enter" type="button">${tr('Enter the cave','შედი გამოქვაბულში')} <span>↗</span></button><small>${tr('Drag the light. Follow the passage.','დაატრიალე სინათლე. გაჰყევი გასასვლელს.')}</small></div>
 <div class="dark-bottom"><div class="dark-year-head"><span>${tr('CHOOSE YOUR YEAR','აირჩიე წელი')}</span><span class="dark-current-year">2019</span></div><div class="dark-timeline" role="group" aria-label="${tr('Year timeline','წლების შკალა')}">${YEARS.map(y=>`<button type="button" data-year="${y}" aria-pressed="${y===2019}">${y}</button>`).join('')}</div></div>
 <dialog class="dark-controls-sheet" id="${id}-controls" aria-labelledby="${id}-controls-title"><div class="dark-sheet-head"><div><span class="dark-kicker">WINDEN / ${tr('CONTROLS','მართვა')}</span><h2 id="${id}-controls-title">${tr('Make time your own.','მართე შენი დრო.')}</h2></div><button class="dark-close-controls" aria-label="${tr('Close controls','მართვის დახურვა')}" type="button">×</button></div><p class="dark-sheet-hint">${tr('Drag the triquetra to spin it. Swipe the forest to change the year.','დაატრიალე ტრიკვეტრა. წლის შესაცვლელად გაუსვი ტყეს თითი.')}</p><button class="dark-motion" type="button" aria-pressed="${!reduced}">${tr('Motion','მოძრაობა')}: ${reduced?tr('off','გამორთული'):tr('on','ჩართული')}</button><div class="dark-object-tools"><button class="dark-spin dark-link" type="button">${tr('Spin / stop','დატრიალება / გაჩერება')}</button><button class="dark-reset dark-link" type="button">${tr('Reset view','ხედის აღდგენა')}</button><button class="dark-flashlight dark-link" type="button" aria-pressed="true">${tr('Flashlight','ფარანი')}</button></div><div class="dark-bottom-tools"><button class="dark-replay dark-link" type="button">↺ ${tr('Replay intro','შესავლის გამეორება')}</button><span>${tr('← → change year / Enter to travel','← → წელი / Enter მოგზაურობისთვის')}</span><button class="dark-tilt dark-link" type="button">${tr('Enable tilt','ჩართე დახრით მართვა')}</button></div><p class="dark-tilt-status" role="status"></p></dialog>
 <div class="dark-travel-label" aria-live="polite"></div>
 <div class="dark-arrival dark-centered"><span class="dark-kicker">${tr('THE PASSAGE IS OPEN','გასასვლელი გაიხსნა')}</span><h2>${tr('ENTERING','შესვლა')} <span class="dark-arrival-year">2019</span></h2><p>${tr('Your DARK room is on the other side.','მეორე მხარეს შენი DARK-ის ოთახია.')}</p><button class="dark-to-game" type="button">${tr('Continue to DARK room','გააგრძელე DARK-ის ოთახში')} →</button><button class="dark-back dark-link" type="button">← ${tr('Back to the cave','გამოქვაბულში დაბრუნება')}</button></div>
 <div class="dark-fallback dark-centered"><h2>${tr('The passage is still open.','გასასვლელი ისევ ღიაა.')}</h2><p>${tr('3D is unavailable on this device. You can continue to your DARK room.','ამ მოწყობილობაზე 3D მიუწვდომელია. შეგიძლია DARK-ის ოთახში გააგრძელო.')}</p><button class="dark-fallback-game" type="button">${tr('Continue to DARK room','გააგრძელე DARK-ის ოთახში')} →</button></div>
 <p class="dark-announcement" id="${id}" aria-live="polite"></p>`;
 const $=s=>root.querySelector(s),on=(target,type,fn,opts={})=>target.addEventListener(type,fn,{...opts,signal:events.signal});
 const canvas=$('canvas'),announce=text=>$('.dark-announcement').textContent=text;
 function soundLabel(){const b=$('.dark-sound');b.setAttribute('aria-pressed',String(audio.enabled));b.textContent=audio.enabled?tr('Sound on','ხმა ჩართულია'):tr('Sound off','ხმა გამორთულია');}
 function setMode(next){$('.dark-controls-sheet').close();mode=next;elapsed=0;root.dataset.mode=next;root.dataset.reduced=String(reduced);}
 function remember(){try{markSeen(localStorage);}catch{}hasSeen=true;}
 function showScene(focus=true){setMode('scene');remember();audio.setMode('scene');soundLabel();root.scrollIntoView({behavior:'instant',block:'start'});if(focus)canvas.focus({preventScroll:true});}
 function startIntro(){setMode('intro');audio.setMode('intro');root.scrollIntoView({behavior:'instant',block:'start'});$('.dark-skip').focus({preventScroll:true});}
 function updateEra(index,feedback=true){era=index;const e=ERAS[era];scene?.setEra(era);root.style.setProperty('--dark-accent',e.accent);$('.dark-current-year').textContent=e.year;$('.dark-era-name').textContent=ka?e.ka:e.name;$('.dark-arrival-year').textContent=e.year;for(const b of root.querySelectorAll('[data-year]'))b.setAttribute('aria-pressed',String(+b.dataset.year===e.year));if(feedback){glitch=reduced?0:1;audio.year();announce(tr('Year ','წელი ')+e.year);}}
 function travel(){if(mode!=='scene')return;audio.travel();setMode(reduced?'arrival':'travel');$('.dark-travel-label').textContent=tr('ENTERING ','შესვლა ')+YEARS[era];if(reduced)$('.dark-to-game').focus({preventScroll:true});}
 function fallback(){if(disposed)return;setMode('fallback');audio.mute();soundLabel();cancelAnimationFrame(raf);$('.dark-fallback-game').focus({preventScroll:true});}
 on($('.dark-exit'),'click',onExit);on($('.dark-to-game'),'click',onEnterGame);on($('.dark-fallback-game'),'click',onEnterGame);
 on($('.dark-begin'),'click',()=>{audio.enable().then(ok=>{if(!disposed){soundLabel();if(!ok)announce(tr('Sound is unavailable; the scene is still playable.','ხმა მიუწვდომელია; სცენა მაინც მუშაობს.'));}});hasSeen||reduced?showScene():startIntro();});
 on($('.dark-no-intro'),'click',()=>{audio.mute();showScene();});on($('.dark-skip'),'click',()=>showScene());on($('.dark-replay'),'click',startIntro);on($('.dark-enter'),'click',travel);on($('.dark-back'),'click',()=>showScene());
 on($('.dark-sound'),'click',async()=>{if(audio.enabled)audio.mute();else await audio.enable();if(!disposed)soundLabel();});
 for(const b of root.querySelectorAll('[data-year]'))on(b,'click',()=>{if(mode==='scene')updateEra(YEARS.indexOf(+b.dataset.year));});
 const sheet=$('.dark-controls-sheet');
 on($('.dark-settings'),'click',()=>sheet.showModal());on($('.dark-close-controls'),'click',()=>sheet.close());
 on(sheet,'cancel',e=>{e.preventDefault();e.stopPropagation();sheet.close();});
 on(sheet,'click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close();}});
 function spin(){ripple=1;if(Math.hypot(knot.state.vx,knot.state.vy)>.05)knot.stop();else if(!reduced)knot.impulse();else knot.state.y+=Math.PI/4;}
 function resetView(){knot.reset();zoom=0;mouseX=mouseY=0;}
 function toggleFlashlight(){flashlight=!flashlight;$('.dark-flashlight').setAttribute('aria-pressed',String(flashlight));}
 on($('.dark-spin'),'click',spin);on($('.dark-reset'),'click',resetView);on($('.dark-flashlight'),'click',toggleFlashlight);
 function applyMotion(value){reduced=value;scene?.setReduced(value);root.dataset.reduced=String(reduced);$('.dark-motion').textContent=tr('Motion','მოძრაობა')+': '+(reduced?tr('off','გამორთული'):tr('on','ჩართული'));$('.dark-motion').setAttribute('aria-pressed',String(!reduced));if(reduced){knot.stop();mouseX=mouseY=0;glitch=0;if(mode==='intro'||mode==='travel')showScene();}}
 on($('.dark-motion'),'click',()=>applyMotion(!reduced));on(media,'change',e=>applyMotion(e.matches));
 on(root,'keydown',e=>{
  if(sheet.open){if(e.key==='Escape'){e.preventDefault();sheet.close();}return;}
  if(e.key==='Escape'){e.preventDefault();if(mode==='intro'||mode==='travel'||mode==='arrival')showScene();else onExit();return;}
  if(mode!=='scene'||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();updateEra(wrapYear(era,e.key==='ArrowRight'?1:-1));}
  if(e.target===canvas){if(e.code==='Space'){e.preventDefault();spin();}if(e.key.toLowerCase()==='r')resetView();if(e.key.toLowerCase()==='f')toggleFlashlight();if(e.key==='+'||e.key==='=')zoom=Math.min(3,zoom+.4);if(e.key==='-')zoom=Math.max(-2,zoom-.4);}
  if(e.key==='Enter'&&!e.target.closest('button,a,input,select')){e.preventDefault();travel();}
 });
 const coords=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*2-1,y:-((e.clientY-r.top)/r.height*2-1)};};
 on(canvas,'pointerdown',e=>{if(mode!=='scene'||drag)return;const p=coords(e),hit=scene?.hitTest(p.x,p.y);drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,at:e.timeStamp,wasMoving:Math.hypot(knot.state.vx,knot.state.vy)>.05,hit,moved:false,type:e.pointerType};if(hit==='knot'){knot.grab();ripple=1;}canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
 on(canvas,'pointermove',e=>{const p=coords(e);mouseX=p.x;mouseY=-p.y;hover=scene?.hitTest(p.x,p.y)||'';canvas.style.cursor=drag?.hit==='knot'?'grabbing':hover==='knot'?'grab':hover==='cave'?'pointer':'crosshair';if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;drag.moved ||= Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;if(drag.hit==='knot'&&drag.moved){const sensitivity=6/Math.min(canvas.clientWidth,canvas.clientHeight);knot.drag(dx*sensitivity,dy*sensitivity,(e.timeStamp-drag.at)/1000);}drag.lastX=e.clientX;drag.lastY=e.clientY;drag.at=e.timeStamp;});
 on(canvas,'pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(d.hit==='knot'){knot.release((e.timeStamp-d.at)/1000,reduced);if(!d.moved&&!d.wasMoving)spin();}else if(!d.moved&&d.hit==='cave')travel();else if(!d.hit&&Math.abs(e.clientX-d.x)>45&&Math.abs(e.clientY-d.y)<80)updateEra(wrapYear(era,e.clientX<d.x?1:-1));if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
 on(canvas,'pointercancel',()=>{drag=null;knot.release(1);});on(canvas,'lostpointercapture',()=>{if(drag){drag=null;knot.release(1);}});on(canvas,'pointerleave',()=>{if(!drag){mouseX=mouseY=0;hover='';}});
 on(canvas,'wheel',e=>{if(mode!=='scene')return;e.preventDefault();zoom=Math.max(-2,Math.min(3,zoom-e.deltaY*.003));},{passive:false});
 on($('.dark-tilt'),'click',async()=>{const button=$('.dark-tilt'),status=$('.dark-tilt-status');try{if(!globalThis.DeviceOrientationEvent)throw Error();if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error();if(disposed)return;on(window,'deviceorientation',e=>{if(reduced||!visible||e.gamma==null)return;mouseX=Math.max(-1,Math.min(1,e.gamma/25));mouseY=Math.max(-1,Math.min(1,((e.beta??45)-45)/30));});button.disabled=true;canvas.focus({preventScroll:true});button.textContent=tr('Tilt enabled','დახრით მართვა ჩართულია');status.textContent=tr('Tilt your phone gently.','მსუბუქად დახარე ტელეფონი.');}catch{status.textContent=tr('Tilt is unavailable. Use touch instead.','დახრით მართვა მიუწვდომელია. გამოიყენე შეხება.');}});
 on(document,'visibilitychange',()=>{last=0;if(document.hidden)audio.suspend();else if(visible)audio.resume();});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(visible&&!document.hidden)audio.resume();else audio.suspend();},{threshold:.08});observer.observe(root);
 const resize=new ResizeObserver(()=>scene?.resize(root.clientWidth,root.clientHeight));resize.observe(root);
 const advance=now=>{
  if(disposed)return;raf=requestAnimationFrame(advance);if(document.hidden||!visible){last=0;return;}
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;elapsed+=dt;clock+=dt;glitch=Math.max(0,glitch-dt*3.5);ripple=Math.max(0,ripple-dt*.65);if(dt>0){frameTimes.push(dt*1000);if(frameTimes.length>180)frameTimes.shift();}
  if(mode==='scene')knot.step(dt,reduced);rotationX=knot.state.x;rotationY=knot.state.y;
  if(mode==='intro'){const card=introCard(elapsed),node=$('.dark-intro-card');if(node.dataset.card!==card.id){node.dataset.card=card.id;node.textContent=ka&&card.id==='beginning'?'დასაწყისი დასასრულია':card.text;node.className='dark-intro-card '+card.id;root.dataset.card=card.id;}if(elapsed>=INTRO_SECONDS)showScene();}
  if(mode==='travel'&&elapsed>=3.6){setMode('arrival');$('.dark-to-game').focus({preventScroll:true});}
  if(scene&&mode!=='fallback')scene.render({time:clock,dt,mode,introTime:elapsed,travel:mode==='travel'?Math.min(1,elapsed/3.6):0,mouseX,mouseY,rotationX,rotationY,glitch,motion:!reduced,hover,zoom,flashlight,ripple});
 };
 raf=requestAnimationFrame(advance);
 let initTimer=setTimeout(async()=>{
  if(disposed)return;
  try{const loaded=await createDarkScene(canvas,{reduced,onContextLost:fallback,signal:events.signal,onProgress:({loaded,total})=>{if(disposed)return;if(total){const progress=Math.min(1,loaded/total);$('.dark-model-progress').value=progress;$('.dark-loading p').textContent=progress<1?tr('Loading cave… ','გამოქვაბული იტვირთება… ')+Math.round(progress*100)+'%':tr('Opening the passage…','გასასვლელის გახსნა…');}}});if(disposed){loaded.dispose();return;}scene=loaded;scene.resize(root.clientWidth,root.clientHeight);updateEra(era,false);setMode('start');if(scene.stats().cave?.fallback)announce(tr('Blender cave unavailable. The original 3D cave is shown.','Blender-ის გამოქვაბული მიუწვდომელია. ნაჩვენებია თავდაპირველი 3D გამოქვაბული.'));root.scrollIntoView({behavior:'instant',block:'start'});$('.dark-begin').focus({preventScroll:true});}
  catch(error){if(disposed)return;console.warn('DARK 3D unavailable:',error.message);scene?.dispose();scene=null;fallback();}
 },60);
 const api={dispose(){if(disposed)return;disposed=true;document.body.style.overflow=previousOverflow;sheet.close();clearTimeout(initTimer);cancelAnimationFrame(raf);events.abort();resize.disconnect();observer.disconnect();audio.dispose();scene?.dispose();scene=null;root.remove();},getSnapshot(){const sorted=[...frameTimes].sort((a,b)=>a-b);return {mode,year:YEARS[era],reduced,elapsed,rotationX,rotationY,velocityX:knot.state.vx,velocityY:knot.state.vy,hover,zoom,flashlight,disposed,visible,audio:audio.snapshot(),render:scene?.stats(),frameMedianMs:sorted[Math.floor(sorted.length*.5)]||0,frameP95Ms:sorted[Math.floor(sorted.length*.95)]||0};}};
 // Introspection is read-only and lets browser QA verify lifecycle and real audio.
 root.darkExperience=api;return api;
}
