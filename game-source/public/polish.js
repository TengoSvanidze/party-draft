// Effects follow confirmed server transitions, never an optimistic tap.
export function presentationEvent(previous,next){
  if(!previous||!next||previous.code!==next.code||previous.round!==next.round||previous.positionIndex!==next.positionIndex||next.revision<=previous.revision)return null;
  if(previous.phase==='locked'&&next.phase==='complete'&&next.answer&&next.choice?.kind!=='none')return 'reveal';
  if(previous.phase==='auction'&&next.phase==='sold')return 'sold';
  if(next.phase==='auction'&&next.bid&&(previous.bid?.amount!==next.bid.amount||previous.bid?.playerId!==next.bid.playerId))return 'bid';
  return null;
}

export function createEffects(storageKey){
  let enabled=false,context=null,overlay=null,cleanup=null;
  const voices=new Set();
  try{enabled=sessionStorage.getItem(storageKey)==='on';}catch{}
  function stop(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
  function clear(){clearTimeout(cleanup);overlay?.remove();overlay=null;stop();}
  async function unlock(){
    if(!enabled)return false;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;context??=new Audio();await context.resume();return context.state==='running';}catch{return false;}
  }
  function sound(kind){
    if(!enabled||document.hidden||context?.state!=='running')return;
    stop();
    const notes=kind==='reveal'?[220,330,440,660]:kind==='sold'?[440,660]:[520];
    notes.forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.085;
      oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+.16);
      oscillator.connect(gain);gain.connect(context.destination);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.18);
    });
  }
  function sync(){const b=document.querySelector('#sound-toggle');if(b){b.setAttribute('aria-pressed',String(enabled));b.textContent=enabled?'♫':'♪';}}
  async function toggle(){enabled=!enabled;try{sessionStorage.setItem(storageKey,enabled?'on':'off');}catch{}sync();if(enabled){if(await unlock())sound('bid');}else stop();}
  function bind(){document.querySelector('#sound-toggle')?.addEventListener('click',toggle);sync();}
  function play(event){
    if(!event||document.hidden)return;
    clear();sound(event);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(event==='bid'){if(!reduced)document.querySelector('.auction-price')?.animate([{opacity:.55},{opacity:1}],{duration:180});return;}
    if(event==='sold'){if(!reduced)document.querySelector('.sale-confirmation')?.animate([{transform:'translateY(5px)',opacity:.4},{transform:'none',opacity:1}],{duration:240,easing:'ease-out'});return;}
    if(reduced)return;
    const hero=document.querySelector('.celebrate .hero');if(!hero)return;
    overlay=document.createElement('div');overlay.className='mystery-curtain';overlay.setAttribute('aria-hidden','true');overlay.textContent='?';hero.append(overlay);
    overlay.animate([{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.025)',offset:.45},{opacity:0,transform:'scale(1.12)'}],{duration:850,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    cleanup=setTimeout(()=>{overlay?.remove();overlay=null;},900);
  }
  document.addEventListener('pointerdown',()=>{if(enabled&&context?.state!=='running')void unlock();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  return {bind,play,clear,get enabled(){return enabled;}};
}
