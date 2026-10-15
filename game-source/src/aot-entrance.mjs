export function mountAotEntrance(root,{language='en',onExit=()=>{},onEnterGame=onExit}={}){
 const tr=(en,ka)=>language==='ka'?ka:en,events=new AbortController();
 const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=media.matches,disposed=false,entering=false,waiting=false,passageFailed=false,loadTimer=0,sound=false,context,gain,raf=0,lastTime=0,travelTime=0,layout;
 const app=document.querySelector('#app'),inert=app?.inert,overflow=document.body.style.overflow;
 const image=new URL('./assets/aot/outpost-art.webp',import.meta.url).href;
 const passageImage=new URL('./assets/aot/passage.webp',import.meta.url).href;
 document.body.style.overflow='hidden';if(app)app.inert=true;
 root.className='aot-portal aot-art-entrance';root.dataset.mode='loading';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',tr('Attack on Titan outpost','ტიტანებზე შეტევა — ფორპოსტი'));
 root.innerHTML=`<img class="aot-ambience" src="${image}" alt="" aria-hidden="true"><div class="aot-world"><img class="aot-picture" src="${image}" alt="${tr('A towering stone wall and closed wooden gate above a lantern-lit outpost, with mechanical gear in the foreground.','უზარმაზარი ქვის კედელი, დახურული ხის ჭიშკარი და ფარნებით განათებული ფორპოსტი. წინ მექანიზმი მოჩანს.')}" fetchpriority="high">
 <div class="aot-gate" aria-hidden="true"><svg class="aot-passage" viewBox="0 0 151 249" preserveAspectRatio="none"><defs><linearGradient id="aot-tunnel-light" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#020304"/><stop offset=".8" stop-color="#10100d"/><stop offset="1" stop-color="#66503a"/></linearGradient><radialGradient id="aot-tunnel-glow"><stop stop-color="#b9935c" stop-opacity=".27"/><stop offset="1" stop-color="#29281e" stop-opacity="0"/></radialGradient><clipPath id="aot-arch"><path d="M0 249V71C0 32 31 2 75.5 0C120 2 151 32 151 71V249Z"/></clipPath></defs><g clip-path="url(#aot-arch)"><rect width="151" height="249" fill="#020304"/><image class="aot-passage-photo" href="${passageImage}" width="151" height="249" preserveAspectRatio="xMidYMid slice" style="filter:brightness(.7)"/></g></svg><div class="aot-gate-leaf aot-gate-left"><img src="${image}" alt=""></div><div class="aot-gate-leaf aot-gate-right"><img src="${image}" alt=""></div></div></div>
 <div class="aot-entry-dark" aria-hidden="true"></div>
 <div class="aot-shade"></div><nav class="aot-top" aria-label="${tr('Entrance controls','შესასვლელის მართვა')}"><button data-aot="back" aria-label="${tr('Back to game','თამაშში დაბრუნება')}">‹</button><span class="aot-brand">PARTY DRAFT</span><button data-aot="sound" aria-pressed="false">${tr('Sound off','ხმა გამორთულია')}</button><button data-aot="settings" aria-label="${tr('Open controls','მართვის გახსნა')}">☷</button></nav>
 <div class="aot-title"><h1>ATTACK ON<br>TITAN</h1><p>${tr('Beyond the Walls','კედლებს მიღმა')}</p></div>
 <div data-aot="loading" role="status"><span>${tr('PREPARING THE OUTPOST','ფორპოსტის მომზადება')}</span></div>
 <footer class="aot-bottom"><button data-aot="enter">${tr('Enter the gate','შედი ჭიშკარში')} <span aria-hidden="true">➜</span></button></footer><button data-aot="skip" hidden>${tr('Skip to room','ოთახში გადასვლა')}</button>
 <dialog data-aot="controls" aria-label="${tr('Outpost controls','ფორპოსტის მართვა')}"><h2>${tr('Outpost controls','ფორპოსტის მართვა')}</h2><button data-aot="motion" aria-pressed="${!reduced}"></button><button data-aot="continue">${tr('Continue to room','გააგრძელე ოთახში')}</button><button data-aot="close">${tr('Close','დახურვა')}</button></dialog><p data-aot="note" role="status"></p>`;
 const $=id=>root.querySelector('[data-aot="'+id+'"]'),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:events.signal});
 function motionLabel(){$('motion').textContent=tr('Entrance transition: ','შესვლის ეფექტი: ')+(reduced?tr('off','გამორთული'):tr('on','ჩართული'));$('motion').setAttribute('aria-pressed',String(!reduced));}
 const world=root.querySelector('.aot-world'),gate=root.querySelector('.aot-gate'),left=root.querySelector('.aot-gate-left'),right=root.querySelector('.aot-gate-right'),dark=root.querySelector('.aot-entry-dark');
 const door=document.createElement('button');door.className='aot-door-target';door.dataset.aot='door';door.setAttribute('aria-label',tr('Open the gate and enter','გააღე ჭიშკარი და შედი'));world.append(door);
 // Rasterize once at the largest visible size, then composite down with transforms.
 const passage=root.ownerDocument.createElement('div');passage.className='aot-entry-passage';passage.setAttribute('aria-hidden','true');const passagePhoto=new Image();passagePhoto.src=passageImage;passagePhoto.alt='';passage.append(passagePhoto);world.after(passage);
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 function resize(){
  const w=root.clientWidth,h=root.clientHeight,contain=w/h>=.75,scale=(contain?Math.min:Math.max)(w/852,h/1846),width=852*scale,height=1846*scale;
  layout={w,h,width,height,x:(w-width)/2,y:(h-height)/2};Object.assign(world.style,{width:width+'px',height:height+'px',left:layout.x+'px',top:layout.y+'px'});
  layout.pw=width*(151/852)*12.5;layout.ph=height*(249/1846)*12.5;
  Object.assign(passage.style,{width:layout.pw+'px',height:layout.ph+'px',left:'0',top:'0'});
 }
 function frame(now){
  if(disposed||!entering||document.hidden)return;travelTime+=Math.min((now-lastTime)/1000,.06);lastTime=now;
  const opening=smooth(travelTime/1.9),approach=smooth((travelTime-.65)/3.3),zoom=1+11.5*approach;
  left.style.transform='rotateY('+(opening*84)+'deg)';right.style.transform='rotateY('+(-opening*84)+'deg)';left.style.filter=right.style.filter='brightness('+(1-opening*.53)+')';
  const dx=layout.w/2-(layout.x+layout.width*(425.5/852)),dy=layout.h/2-(layout.y+layout.height*(1042.5/1846));
  world.style.transform='translate3d('+(dx*approach)+'px,'+(dy*approach)+'px,0) scale('+zoom+')';dark.style.opacity=String(smooth((travelTime-3.35)/.75));
  const pw=layout.width*(151/852)*zoom,ph=layout.height*(249/1846)*zoom,cx=layout.x+layout.width*(425.5/852)+dx*approach,cy=layout.y+layout.height*(1042.5/1846)+dy*approach;
  passage.style.transform='translate3d('+(cx-pw/2)+'px,'+(cy-ph/2)+'px,0) scale('+(zoom/12.5)+')';passage.style.opacity=String(smooth((travelTime-1.75)/.35));
  root.dataset.gateOpen=opening.toFixed(3);root.dataset.journey=travelTime<1.9?'opening':'travelling';
  if(travelTime>=4.15){onEnterGame();return;}raf=requestAnimationFrame(frame);
 }
 function gateSound(){
  if(!sound||!context||context.state!=='running')return;
  const t=context.currentTime,buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.55+.45*Math.sin(i/context.sampleRate*8));
  const noise=context.createBufferSource(),filter=context.createBiquadFilter(),volume=context.createGain();noise.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(190,t);filter.frequency.linearRampToValueAtTime(75,t+2.5);filter.Q.value=4;volume.gain.setValueAtTime(0,t);volume.gain.linearRampToValueAtTime(.075,t+.2);volume.gain.exponentialRampToValueAtTime(.001,t+2.7);noise.connect(filter);filter.connect(volume);volume.connect(context.destination);noise.onended=()=>{noise.disconnect();filter.disconnect();volume.disconnect();};noise.start();noise.stop(t+2.8);
  const rumble=context.createOscillator(),v=context.createGain();rumble.type='sine';rumble.frequency.setValueAtTime(43,t);rumble.frequency.exponentialRampToValueAtTime(28,t+2.7);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(.035,t+.3);v.gain.exponentialRampToValueAtTime(.001,t+3);rumble.connect(v);v.connect(context.destination);rumble.onended=()=>{rumble.disconnect();v.disconnect();};rumble.start();rumble.stop(t+3);
 }
 function startJourney(){
  if(disposed||!entering)return;clearTimeout(loadTimer);waiting=false;resize();root.dataset.mode='entering';root.dataset.gateOpen='0';gate.style.visibility='visible';$('note').textContent=tr('Entering the gate…','ჭიშკარში შესვლა…');gateSound();lastTime=performance.now();if(!document.hidden)raf=requestAnimationFrame(frame);
 }
 function enter(){
  if(disposed||entering)return;if(reduced||!picture.complete||!picture.naturalWidth||passageFailed){onEnterGame();return;}
  entering=true;$('enter').disabled=true;door.disabled=true;root.querySelector('.aot-top').inert=true;$('skip').hidden=false;$('skip').focus({preventScroll:true});
  if(passagePhoto.complete&&passagePhoto.naturalWidth){startJourney();return;}
  // Keep the closed-gate artwork visible until the destination image is usable.
  waiting=true;root.dataset.mode='preparing';$('note').textContent=tr('Preparing the passage…','გასასვლელის მომზადება…');
  loadTimer=setTimeout(()=>{if(!disposed&&waiting)onEnterGame();},4000);
 }
 on(passagePhoto,'load',()=>{if(waiting)startJourney();});
 on(passagePhoto,'error',()=>{passageFailed=true;if(waiting&&!disposed){clearTimeout(loadTimer);onEnterGame();}});
 if(passagePhoto.complete&&!passagePhoto.naturalWidth)passageFailed=true;
 function labelSound(){$('sound').textContent=sound?tr('Sound on','ხმა ჩართულია'):tr('Sound off','ხმა გამორთულია');$('sound').setAttribute('aria-pressed',String(sound));}
 async function toggleSound(){
  try{
   if(!context){context=new(window.AudioContext||window.webkitAudioContext)();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);for(const frequency of [65.406,98]){const o=context.createOscillator();o.type='sine';o.frequency.value=frequency;o.connect(gain);o.start();}}
   await context.resume();if(disposed)return;sound=!sound;gain.gain.setTargetAtTime(sound ? .012 : 0,context.currentTime,.18);labelSound();
  }catch{sound=false;labelSound();$('note').textContent=tr('Sound unavailable.','ხმა მიუწვდომელია.');}
 }
 const picture=root.querySelector('.aot-picture');
 function ready(){if(!disposed){if(!entering)root.dataset.mode='scene';$('loading').hidden=true;resize();}}
 on(picture,'load',ready);on(picture,'error',()=>{ready();$('note').textContent=tr('Artwork could not load. You can still enter your room.','სურათი ვერ ჩაიტვირთა. შეგიძლია ოთახში შესვლა.');});
 if(picture.complete&&picture.naturalWidth)ready();
 on($('back'),'click',onExit);on($('enter'),'click',enter);on($('skip'),'click',onEnterGame);on($('continue'),'click',onEnterGame);on($('sound'),'click',toggleSound);
 on(door,'click',enter);
 on($('settings'),'click',()=>$('controls').showModal());on($('close'),'click',()=>$('controls').close());on($('controls'),'close',()=>$('settings').focus());
 on($('motion'),'click',()=>{reduced=!reduced;motionLabel();});on(media,'change',e=>{reduced=e.matches;motionLabel();if(reduced&&entering)onEnterGame();});motionLabel();
 on(root,'keydown',e=>{
  if($('controls').open)return;if(e.key==='Escape'){e.preventDefault();onExit();return;}
  if(e.key==='Enter'&&!['BUTTON','INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();enter();return;}
  if(e.key!=='Tab')return;const buttons=[...root.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length&&!b.closest('[inert]')),first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 on(window,'resize',resize);resize();
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);context?.suspend().catch(()=>{});}else{if(sound)context?.resume().catch(()=>{});if(entering&&!waiting&&!disposed){lastTime=performance.now();raf=requestAnimationFrame(frame);}}});
 const api={dispose(){if(disposed)return;disposed=true;events.abort();clearTimeout(loadTimer);cancelAnimationFrame(raf);context?.close().catch(()=>{});document.body.style.overflow=overflow;if(app)app.inert=inert;}};
 on(window,'pagehide',()=>api.dispose());$('back').focus({preventScroll:true});return api;
}
