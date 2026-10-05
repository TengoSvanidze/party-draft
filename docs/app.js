import {createEffects,presentationEvent} from './polish.js';
const basePath=new URL('.',location.href).pathname;
const apiOrigin=location.hostname==='tengosvanidze.github.io'?'https://party-draft-tengo.tengosvanidze3.chatgpt.site':location.origin;
const apiURL=path=>apiOrigin+path;
const app=document.querySelector('#app'), params=new URLSearchParams(location.search);
const panel=params.get('panel')||'main', storageKey='party-draft-seat:'+panel;
const effects=createEffects('party-draft-sound:'+panel);
const [en,ka,themes]=await Promise.all([basePath+'strings.en.json',basePath+'strings.ka.json',apiURL('/api/themes')].map(u=>fetch(u).then(r=>r.json())));
let language=localStorage.getItem('party-draft-language')||'en';
function storedJSON(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{sessionStorage.removeItem(key);return null;}}
let session=storedJSON(storageKey), state=null, connected=false, busy=false, selectedRaise=1, homeMode=params.has('room')?'join':'create', controller=null, toastTimer;
if(params.has('home'))session=null;
const homeURL=basePath+'?home=1'+(panel!=='main'?'&panel='+encodeURIComponent(panel):'');
const navLabel=key=>language==='ka'?({back:'უკან',home:'მთავარი',resume:'თამაშში დაბრუნება',table:'სატესტო მაგიდაზე დაბრუნება'})[key]:({back:'Back',home:'Home',resume:'Return to game',table:'Return to practice table'})[key];
function navigation(){return `<nav class="page-nav" aria-label="Page navigation"><button type="button" id="page-back">← ${esc(navLabel('back'))}</button><a href="${esc(homeURL)}">⌂ ${esc(navLabel('home'))}</a></nav>`;}
function bindNavigation(){document.querySelector('#page-back')?.addEventListener('click',()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();lineupOpen=false;return;}let internal=false;try{internal=new URL(document.referrer).origin===location.origin;}catch{}if(history.length>1&&(history.state?.partyDraft||internal))history.back();else location.assign(homeURL);});}
window.addEventListener('popstate',()=>location.reload());
let selectedTheme='mcu';
const currentTheme=()=>state?.theme||themes.find(x=>x.id===selectedTheme)||themes[0];
let clockOffset=0,phaseKey='',lineupOpen=false,lineupPlayer=null;
const imageCache=new Map(),imageLoading=new Set(),imageRetryAt=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'€'+Number(n).toLocaleString('en-US');
function t(key,values={}){const get=(dict)=>key.split('.').reduce((o,k)=>o?.[k],dict);let text=currentTheme()?.ui?.[key]||(language==='ka'&&get(ka))||get(en)||key;return String(text).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');}
const local=x=>x?.[language]||x?.en||'';
const txt=(key,v)=>esc(t(key,v));
const voteLabel=n=>t(n===1?'oneVote':'voteCount',{count:n});
const button=(label,action,{primary=false,disabled=false,id=action}={})=>`<button id="${esc(id)}" data-action="${esc(action)}" class="${primary?'primary ':''}wide" ${disabled||busy?'disabled':''}>${label}</button>`;
const me=()=>state?.members.find(m=>m.id===state.you);
const name=id=>state?.members.find(m=>m.id===id)?.name||'';
function notify(message){const node=document.querySelector('#toast');node.textContent=message;node.className='visible';clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='',4200);}
function header(){return `<header><div class="brand"><span>◆</span>${txt('brand')}</div><div class="header-controls"><button type="button" id="sound-toggle" class="sound-toggle" aria-label="Sound" title="Sound" aria-pressed="${effects.enabled}">${effects.enabled?'♫':'♪'}</button><select class="locale" id="language" aria-label="Language"><option value="en" ${language==='en'?'selected':''}>EN</option><option value="ka" ${language==='ka'?'selected':''}>KA</option></select></div></header>${navigation()}`;}
function bindLanguage(){bindNavigation();effects.bind();document.querySelector('#language')?.addEventListener('change',e=>{language=e.target.value;localStorage.setItem('party-draft-language',language);render();});}
async function request(url,body,auth=true){
  const headers={};if(body)headers['Content-Type']='application/json';if(auth&&session)headers.Authorization='Bearer '+session.token;
  let response,data;try{response=await fetch(apiURL(url),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});data=await response.json();}catch{throw new Error('network');}
  if(!response.ok)throw new Error(data.error||'serverError');return data;
}
function saveSeat(s){session=s;sessionStorage.setItem(storageKey,JSON.stringify(s));}
function accept(s,animate=true){if(state&&s.revision<state.revision)return;const event=animate?presentationEvent(state,s):null;clockOffset=s.serverTime-Date.now();state=s;render();if(event)requestAnimationFrame(()=>{if(state===s)effects.play(event);});}
async function connect(){
 controller?.abort();controller=new AbortController();const signal=controller.signal;
 while(!signal.aborted&&session){
  try{
   const response=await fetch(apiURL('/api/rooms/'+session.code+'/state'),{headers:{Authorization:'Bearer '+session.token},signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
   const next=await response.json();if(!response.ok){if(['unauthorized','roomMissing'].includes(next.error)){leave();notify(t('errors.'+next.error));return;}throw new Error('network');}
   if(signal.aborted)return;const wasConnected=connected;connected=true;
   if(!state||next.revision!==state.revision||!wasConnected)accept(next,wasConnected);else clockOffset=next.serverTime-Date.now();
   loadImages();
  }catch{if(signal.aborted)return;if(connected){connected=false;render();}}
  await new Promise(resolve=>setTimeout(resolve,connected?700:1500));
 }
}
function leave(){controller?.abort();controller=null;session=null;state=null;connected=false;lineupOpen=false;for(const url of imageCache.values())URL.revokeObjectURL(url);imageCache.clear();sessionStorage.removeItem(storageKey);history.replaceState(null,'',location.pathname);render();}
function renderHome(){
  const saved=storedJSON(storageKey),table=storedJSON('party-draft-table');
  const resume=saved?`<aside class="resume-room"><a href="${basePath}?room=${encodeURIComponent(saved.code)}${panel!=='main'?'&panel='+encodeURIComponent(panel):''}">${esc(navLabel('resume'))} · ${esc(saved.code)}</a><p>${language==='ka'?'შენი ადგილი შენახულია.':'Your seat is saved. Live timers continue while you are away.'}</p></aside>`:'';
  app.innerHTML=`<main class="shell">${header()}${resume}${table?`<a class="table-return" href="${basePath}?table=1">${esc(navLabel('table'))}</a>`:''}<section class="intro enter"><span class="eyebrow orange">${txt('tagline')}</span><h1>${txt('hero1')}<br><span>${txt('hero2')}</span></h1><p>${txt('intro')}</p></section><div class="tabs"><button data-mode="create" class="${homeMode==='create'?'selected':''}">${txt('createTab')}</button><button data-mode="join" class="${homeMode==='join'?'selected':''}">${txt('joinTab')}</button></div><form id="entry">${homeMode==='create'?`<fieldset class="theme-picker"><legend>Choose your theme</legend>${themes.map(theme=>`<label class="theme-option"><input type="radio" name="theme" value="${esc(theme.id)}" ${selectedTheme===theme.id?'checked':''}><span><strong>${esc(theme.name)}</strong><small>${esc(theme.description)}</small></span></label>`).join('')}<p class="hint" id="theme-notice">${esc(currentTheme().notice||'')}</p></fieldset>`:''}<div class="field"><label for="name">${txt('yourName')}</label><input id="name" name="name" autocomplete="nickname" maxlength="24" placeholder="${txt('namePlaceholder')}" required></div>${homeMode==='join'?`<div class="field"><label for="code">${txt('roomCode')}</label><input id="code" name="code" maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" autocomplete="off" value="${esc(params.get('room')||'')}" placeholder="A7K9Q2" required></div>`:`<p class="hint">${txt('hostHint')}</p>`}<button class="primary wide" type="submit">${txt(homeMode==='join'?'join':'create')}</button></form><hr class="divider"><button class="ghost wide" id="practice">${txt('demo')}</button><p class="hint">${txt('demoHint')}</p><p class="foot">${txt('scope')}</p></main>`;
  bindLanguage();document.querySelectorAll('[name=theme]').forEach(input=>input.onchange=()=>{selectedTheme=input.value;document.querySelector('#theme-notice').textContent=currentTheme().notice||'';document.querySelector('.intro p').textContent=t('intro');document.querySelector('.foot').textContent=t('scope');});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{homeMode=b.dataset.mode;renderHome();});
  document.querySelector('#entry').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button[type=submit]');submit.disabled=true;
    try{const entered=new FormData(e.target),code=String(entered.get('code')||'').toUpperCase(),url=homeMode==='create'?'/api/rooms':`/api/rooms/${code}/join`;saveSeat(await request(url,{name:entered.get('name'),...(homeMode==='create'?{themeId:selectedTheme}:{})},false));history.replaceState(null,'',homeURL);history.pushState({partyDraft:true},'',`?room=${session.code}${panel!=='main'?'&panel='+encodeURIComponent(panel):''}`);connect();}catch(error){notify(t('errors.'+error.message));submit.disabled=false;}};
  document.querySelector('#practice').onclick=makePractice;
}
async function makePractice(){
  const button=document.querySelector('#practice');button.disabled=true;button.textContent=t('startingDemo');
  try{
    const host=await request('/api/rooms',{name:'Narrator',themeId:selectedTheme},false),seats=[host];
    for(const name of ['John','George','Nick'])seats.push(await request(`/api/rooms/${host.code}/join`,{name},false));
    const saved=seats.map((seat,i)=>{const id='practice-'+host.code+'-'+i;sessionStorage.setItem('party-draft-seat:'+id,JSON.stringify(seat));return {id,label:['Narrator','John','George','Nick'][i]};});
    sessionStorage.setItem('party-draft-table',JSON.stringify({code:host.code,seats:saved}));location.href=basePath+'?table=1';
  }catch(error){notify(t('errors.'+error.message));button.disabled=false;button.textContent=t('demo');}
}
function renderTable(){
  const table=storedJSON('party-draft-table');if(!table){location.replace(basePath);return;}
  app.innerHTML=`<main class="test-shell">${navigation()}<div class="test-head"><div><span class="eyebrow orange">${txt('room',{code:table.code})}</span><h1>${txt('testTitle')}</h1><p>${txt('testDescription')}</p></div><a href="${basePath}?home=1">${txt('testExit')}</a></div><div class="test-grid">${table.seats.map(s=>`<section><h2>${esc(s.label)}</h2><iframe title="${esc(s.label)}" src="${basePath}?room=${table.code}&panel=${esc(s.id)}"></iframe></section>`).join('')}</div></main>`;bindNavigation();
}
function wallet(){return state.role==='narrator'?`<section class="panel private"><h2>${txt('privateTitle')}</h2><p>${txt('privateText')}</p></section>`:`<section class="panel wallet"><div class="avatar">${esc(me().name[0].toUpperCase())}</div><div class="identity"><strong>${esc(me().name)}</strong><small>${txt('you')}</small></div><div class="money"><strong>${money(me().budget)}</strong><span>${txt('budget')}</span></div></section>`;}
function photo(card,className=''){return card?`<img class="${className}" data-character="${esc(card.id)}" ${imageCache.get(card.id)?`src="${imageCache.get(card.id)}"`: 'hidden'} alt="${esc(local(card.name))}">`:'';}
function hero(card){return `<section class="hero"><span class="badge">${txt('prime')}</span><span class="fallback-letter" aria-hidden="true">${esc(local(card.name).slice(0,2).toUpperCase())}</span>${photo(card)}<div><h2>${esc(local(card.name))}</h2><p>${esc(local(card.pitch))}</p></div></section>`;}
function clock(){return `<div class="timer ${state.paused?'paused':''}" id="timer" role="timer" aria-label="${state.paused?txt('paused'):'Seconds remaining'}">${state.paused?txt('paused'):'—'}</div>`;}
function playerStrip(){return `<div class="players">${state.members.filter(m=>m.role==='drafter').map(m=>`<div class="seat ${state.bid?.playerId===m.id?'leading':''} ${m.pick?'done':''}"><strong>${esc(m.name)}</strong><span>${money(m.budget)} · ${m.pick?txt('owned'):m.budget===0?txt('broke'):state.yielded.includes(m.id)?txt('out'):state.bid?.playerId===m.id?txt('leadingYou',{amount:money(state.bid.amount)}):txt('in')}</span></div>`).join('')}</div>`;}
function boxSetup(){
  if(state.role!=='narrator')return `<p class="note">${txt(state.boxesLocked?'boxesReady':'narratorPreparing')}</p>`;
  const rows=state.boxSetup||[],chosen=rows.filter(r=>r.selectedId).length;
  return `<section class="panel private box-setup"><span class="eyebrow orange">${txt('privateSetup')}</span><h2>${txt('setupTitle')}</h2><p>${txt(state.boxesLocked?'setupLockedText':'setupText')}</p>${rows.map((row,i)=>`<fieldset><legend>${i+1}. ${esc(local(row.title))}</legend><div class="box-options">${row.options.map(c=>`<button id="setup-${row.positionId}-${c.id}" data-action="set-box:${row.positionId}:${c.id}" aria-pressed="${row.selectedId===c.id}" class="${row.selectedId===c.id?'selected':''}" ${state.boxesLocked||busy||!connected?'disabled':''}>${row.selectedId===c.id?'✓ ':''}${esc(local(c.name))}</button>`).join('')}</div></fieldset>`).join('')}<p class="hint" role="status">${txt(state.boxesLocked?'boxesLocked':'boxesChosen',{count:chosen,total:rows.length})}</p>${state.boxesLocked?'':button(txt('lockBoxes'),'lock-boxes',{primary:true,disabled:chosen!==rows.length||!connected})}</section>`;
}
function lobby(){const players=state.members.filter(m=>m.role==='drafter');const invite=location.origin+basePath+'?room='+state.code;
  return `<span class="eyebrow orange">${txt('round',{number:state.round})}</span><h1>${txt('lobbyTitle')}</h1><div class="theme-room"><strong>${esc(state.theme.name)}</strong>${state.theme.notice?`<p class="hint">${esc(state.theme.notice)}</p>`:''}</div><p>${txt('lobbyText')}</p><section class="panel"><small>${txt('roomCode')}</small><div class="room-code">${esc(state.code)}</div><div class="row">${button(txt('copy'),'copy')}</div><label for="invite" class="hint">${txt('invite')}</label><input class="linkbox" readonly id="invite" value="${esc(invite)}">${['localhost','127.0.0.1'].includes(location.hostname)?`<p class="hint">${txt('inviteLocal')}</p>`:''}</section><section class="panel">${Array.from({length:3},(_,i)=>`<div class="lobby-seat"><div class="avatar">${players[i]?esc(players[i].name[0]):'+'}</div><strong>${players[i]?esc(players[i].name):txt('waitingSeat',{number:i+1})}</strong>${players[i]?`<small>${txt('ready')}</small>`:''}</div>`).join('')}</section>${boxSetup()}${state.role==='narrator'?button(players.length===3?txt('start'):txt('needSeats',{number:3-players.length}),'start',{primary:true,disabled:players.length!==3||!connected||!state.boxesLocked}):`<p class="note">${txt('waitingHost')}</p>`}`;
}
function assignmentNotice(){return '<p class="hint">'+(state.autoAssignId?txt('autoAssignNotice',{name:name(state.autoAssignId),amount:money(state.card.price)}):txt('noAffordableRecipient'))+'</p>';}
function auction(){
  const minimum=state.bid?state.bid.amount+selectedRaise:state.card.price;
  const isLeader=state.bid?.playerId===state.you;
  let controls='';
  if(state.role==='narrator')controls=button(txt(state.paused?'resume':'pause'),state.paused?'resume':'pause',{disabled:!connected});
  else if(me().pick)controls=`<p class="note">${txt('filled')}</p>`;
  else if(me().budget===0)controls=`<p class="note">${txt('noMoney')}</p>`;
  else if(state.yielded.includes(state.you))controls=`<p class="note">${txt('yielded')}</p>`;
  else controls=`<div class="raises">${[1,10,50].map(n=>`<button data-raise="${n}" id="raise-${n}" class="raise ${selectedRaise===n?'selected':''}" aria-pressed="${selectedRaise===n}" ${busy||isLeader||state.paused?'disabled':''}>+${money(n)}</button>`).join('')}</div><div class="actions">${button(isLeader?txt('leadingYou',{amount:money(state.bid.amount)}):minimum>me().budget?txt('notEnough'):busy?txt('sending'):txt('bid',{amount:money(minimum)}),'bid',{primary:true,disabled:!connected||state.paused||isLeader||minimum>me().budget})}${button(txt('yield'),'yield',{disabled:!connected||state.paused||isLeader})}</div>`;
  return `<h1>${esc(local(state.position))}</h1>${hero(state.card)}<section class="auction-price"><div><small class="orange">● ${txt('live')}</small><div class="amount">${money(state.bid?.amount??state.card.price)}</div><div class="leader" aria-live="polite">${state.bid?txt('leading',{name:name(state.bid.playerId)}):txt('noBid')}</div></div>${clock()}</section>${playerStrip()}${!state.bid?assignmentNotice():''}${state.paused?`<p class="note">${txt('pausedNote')}</p>`:''}${controls}`;
}
function clueList(){return `<ol class="clues">${[0,1,2].map(i=>`<li class="clue ${i>=state.clueCount?'hidden':''} ${state.role==='narrator'&&i===state.clueCount?'next':''}"><span class="num">${i+1}</span><span>${state.clues[i]?esc(local(state.clues[i])):txt('cluePending')}</span></li>`).join('')}</ol>`;}
function mystery(){
  const narrator=state.role==='narrator',recipient=state.recipientId===state.you,canChoose=state.phase==='choice'&&!state.paused&&recipient&&connected;
  const knownPrice=state.fallback?.kind==='known'?state.fallback.price:state.card.price;
  const title=state.phase==='locked'?txt('locked'):narrator?txt('narratorTitle'):txt('choiceTitle');
  let content=`<h1>${title}</h1><p>${txt('lastPlayer',{name:name(state.recipientId)})}</p>`;
  if(narrator)content+=`<section class="panel private"><small class="orange">${txt('privateAnswer')}</small><div class="answer"><div class="portrait">${photo(state.answer)}</div><div><h2>${esc(local(state.answer.name))}</h2><small>${txt('mystery')} · ${money(state.boxPrice)}</small></div></div></section>`;
  content+=`<div class="meta"><small>${txt(narrator?'readClues':'threeClues')}</small>${state.phase==='choice'?clock():''}</div>${clueList()}`;
  if(state.paused)content+=`<p class="note">${txt('pausedNote')}</p>`;
  if(narrator){content+=`<p class="hint">${txt('cluesCount',{count:state.clueCount})}</p><div class="actions">`;
    if(state.phase==='clues')content+=button(txt('showClue',{number:state.clueCount+1}),'clue',{primary:true,disabled:!connected});
    if(state.phase==='choice')content+=button(txt(state.paused?'resume':'pause'),state.paused?'resume':'pause',{disabled:!connected});
    content+=button(txt('reveal'),'reveal',{primary:state.phase==='locked',disabled:state.phase!=='locked'||!connected})+`</div><p class="hint">${txt('revealWait')}</p>`;
  }else if(state.phase==='locked')content+=`<p class="note">${txt(state.choice?.kind==='none'?'fallbackEmpty':'lockedText')}</p>`;
  else {
    content+=`<div class="choice-cards"><div class="pick-card">${photo(state.card)}<span class="badge">${txt('known')}</span><h2>${esc(local(state.card.name))}</h2><strong>${money(knownPrice)}</strong></div><div class="pick-card box"><span class="boxlabel">${txt('mystery')}</span><span class="question">?</span><strong>${money(state.boxPrice)}</strong></div></div>`;
    if(recipient)content+=`<p class="hint">${state.fallback?.kind==='none'?txt('fallbackEmpty'):state.fallback?.kind==='box'?txt('fallbackBox',{amount:money(state.fallback.price)}):txt('fallbackKnown',{name:local(state.card.name),amount:money(knownPrice)})}</p>`;
    if(recipient&&me().budget===0)content+=`<p class="note">${txt('noMoney')}</p>`;
    if(recipient)content+=`<div class="actions">${button(txt('takeKnown',{name:local(state.card.name),amount:money(knownPrice)}),'known',{disabled:!canChoose||knownPrice>me().budget})}${button(txt('takeBox',{amount:money(state.boxPrice)}),'box',{primary:true,disabled:!canChoose||state.boxPrice>me().budget})}</div><p class="hint">${txt(state.clueCount<3?'cluesFirst':'final')}</p>`;
    else content+=`<p class="note">${txt('watchChoice',{name:name(state.recipientId)})}</p>`;
  }
  return content;
}
function completion(){const last=state.positionIndex===state.positionCount-1;return `<div class="celebrate">${state.answer?`<span class="eyebrow orange">${txt(state.choice.kind==='box'?'revealTitle':'passedTitle')}</span>${hero(state.answer)}<details><summary>${txt('threeClues')}</summary><ul>${state.answer.explanations.map(x=>`<li><p>${esc(local(x))}</p></li>`).join('')}</ul></details>`:''}<h1>${txt('complete')}</h1><p>${txt(last?'draftFinished':'completeText')}</p>${state.members.filter(m=>m.role==='drafter').map(m=>`<section class="panel roster"><div class="portrait">${m.pick?photo(m.pick):'<span class="miss-mark">X</span>'}</div><div><small>${esc(m.name)} · ${txt('paid',{amount:money(m.paid)})}</small><h2>${m.pick?esc(local(m.pick.name)):txt('emptySlot')}</h2><p>${txt('remaining',{amount:money(m.budget)})}</p></div></section>`).join('')}${state.role==='narrator'?button(txt(last?'openVote':'nextPosition'),last?'open-vote':'next-position',{primary:true,disabled:!connected}):`<p class="note">${txt('waitNext')}</p>`}</div>`;}
function voting(){
  const tie=state.phase==='tiebreak';
  return `<span class="eyebrow orange">${txt('finalVote')}</span><h1>${txt(tie?'tieTitle':'voteTitle')}</h1><p>${txt(tie?'tieText':'voteText')}</p>${button(txt('compareLineups'),'lineups',{id:'compare-lineups'})}<p class="note">${txt('votesCast',{count:state.votesCast,total:3})}</p><div class="stack">${state.members.filter(p=>p.role==='drafter').map(p=>`<section class="panel vote-card"><div class="row"><div class="avatar">${esc(p.name[0].toUpperCase())}</div><div><h2>${esc(p.name)}</h2><p>${txt('paid',{amount:money(p.totalSpent)})}${tie?' · '+esc(voteLabel(state.voteCounts[p.id])):''}</p></div></div>${tie?(state.role==='narrator'&&state.tiedIds.includes(p.id)?button(txt('chooseWinner'),'break-tie:'+p.id,{primary:true,disabled:!connected}):''):state.role==='drafter'&&p.id!==state.you?button(txt(state.myVote===p.id?'yourVote':'voteFor',{name:p.name}),'vote:'+p.id,{primary:state.myVote===p.id,disabled:!!state.myVote||!connected}):''}</section>`).join('')}</div>${state.myVote&&!tie?`<p class="note">${txt('voteLocked')}</p>`:''}`;
}
function results(){const winner=state.members.find(p=>p.id===state.winnerId);return `<div class="celebrate"><span class="eyebrow orange">${txt('matchComplete')}</span><h1>${txt('winner',{name:winner.name})}</h1><p>${txt('resultsText')}</p>${state.members.filter(p=>p.role==='drafter').sort((a,b)=>(b.id===state.winnerId)-(a.id===state.winnerId)).map(p=>`<section class="panel ${p.id===state.winnerId?'winner-panel':''}"><h2>${p.id===state.winnerId?'◆ ':''}${esc(p.name)}</h2><p>${esc(voteLabel(state.voteCounts[p.id]))} · ${txt('paid',{amount:money(p.totalSpent)})}</p></section>`).join('')}<div class="actions">${button(txt('saveCard'),'save-card',{primary:true})}${button(txt('compareLineups'),'lineups',{id:'compare-lineups'})}${state.role==='narrator'?button(txt('rematch'),'rematch',{disabled:!connected}):`<p class="note">${txt('waitRematch')}</p>`}</div></div>`;}
async function saveResultCard(){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1500;const ctx=canvas.getContext('2d');ctx.fillStyle='#11100f';ctx.fillRect(0,0,1080,1500);ctx.fillStyle='#ff984a';ctx.font='bold 26px system-ui';ctx.fillText(t('brand'),55,70);ctx.fillStyle='#fff8f1';ctx.font='bold 48px system-ui';ctx.fillText(t('winner',{name:name(state.winnerId)}),55,145,970);ctx.fillStyle='#b5a79c';ctx.font='22px system-ui';ctx.fillText(t('scope'),55,192,970);
  state.members.filter(p=>p.role==='drafter').forEach((p,i)=>{const y=230+i*390;ctx.fillStyle='#211b16';ctx.fillRect(35,y,1010,367);ctx.fillStyle=p.id===state.winnerId?'#ff984a':'#fff8f1';ctx.font='bold 32px system-ui';ctx.fillText((p.id===state.winnerId?'◆ ':'')+p.name,58,y+47,650);ctx.font='20px system-ui';ctx.textAlign='right';ctx.fillText(t('paid',{amount:money(p.totalSpent)})+' · '+voteLabel(state.voteCounts[p.id]),1015,y+45,400);ctx.textAlign='left';state.slots.forEach((slot,j)=>{const entry=p.lineup.find(s=>s.slotId===slot.id);ctx.font='19px system-ui';ctx.fillStyle='#b5a79c';ctx.fillText(local(slot.title),58,y+92+j*44,440);ctx.fillStyle='#fff8f1';ctx.font='bold 21px system-ui';ctx.fillText(entry.card?local(entry.card.name):'X',510,y+92+j*44,495);});});
  ctx.fillStyle='#b5a79c';ctx.font='20px system-ui';ctx.fillText(t('cardFooter'),55,1460,970);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob){notify(t('cardFailed'));return;}
  const url=URL.createObjectURL(blob),dialog=document.createElement('dialog');dialog.id='result-sheet';dialog.setAttribute('aria-label',t('resultCard'));dialog.innerHTML=`<div class="sheet-top"><h2>${txt('resultCard')}</h2><button class="ghost" aria-label="${txt('close')}">✕</button></div><img src="${url}" alt="${txt('resultCard')}"><p class="hint">${txt('saveCardHint')}</p><a class="download-link" href="${url}" download="party-draft-${esc(state.code)}-match-${state.round}.png">${txt('downloadCard')}</a>`;document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();document.querySelector('#save-card')?.focus();},{once:true});dialog.showModal();
}
function lineupSheet(){
  const players=state.members.filter(m=>m.role==='drafter');
  const player=players.find(m=>m.id===lineupPlayer)||players.find(m=>m.id===state.you)||players[0];if(!player)return '';
  const rows=state.slots.map(slot=>{const entry=player.lineup.find(x=>x.slotId===slot.id);return `<li class="lineup-slot ${entry.status}"><div class="slot-icon">${entry.card?photo(entry.card):entry.status==='missed'?'X':entry.status==='sealed'?'?':'—'}</div><div><span>${esc(local(slot.title))}</span><strong>${entry.card?esc(local(entry.card.name)):txt(entry.status==='missed'?'emptySlot':entry.status==='sealed'?'mystery':'notFilled')}</strong></div></li>`;}).join('');
  return `<dialog id="lineup-sheet" aria-labelledby="lineup-heading"><div class="sheet-top"><h2 id="lineup-heading">${txt('lineups')}</h2><button data-action="close-lineups" class="ghost" aria-label="${txt('close')}">✕</button></div><label for="lineup-player">${txt('viewPlayer')}</label><select id="lineup-player">${players.map(p=>`<option value="${esc(p.id)}" ${p.id===player.id?'selected':''}>${esc(p.name)} · ${money(p.budget)}</option>`).join('')}</select>${state.deadline||state.paused?`<p class="sheet-clock">${txt('roundStillLive')} <strong id="lineup-timer"></strong></p>`:''}<ul class="slot-list">${rows}</ul>${player.budget===0?`<p class="note">${txt('noMoney')}</p>`:''}<button data-action="close-lineups" class="primary wide">${txt('backToRound')}</button></dialog>`;
}
function render(){
  document.documentElement.lang=language==='ka'?'ka':'en';
  if(params.has('table')){renderTable();return;}if(!session){renderHome();return;}
  if(!state){app.innerHTML=`<main class="shell">${header()}<p class="note">${txt('connecting')}</p>${button(txt('home'),'home')}</main>`;bind();return;}
  const oldFocus=document.activeElement?.id;
  const nextPhaseKey=state.round+':'+state.positionIndex+':'+state.phase+':'+state.lotIndex,transition=phaseKey!==nextPhaseKey;phaseKey=nextPhaseKey;
  let content='';
  if(state.phase==='lobby')content=lobby();
  else if(state.phase==='ready')content=`<h1>${esc(local(state.position))}</h1>${hero(state.card)}<p>${esc(local(state.prompt))}</p><p class="note">${txt('starting')} · ${money(state.card.price)}</p>${playerStrip()}${assignmentNotice()}${state.role==='narrator'?button(txt('open'),'open',{primary:true,disabled:!connected}):`<p class="note">${txt('waitingOpen')}</p>`}`;
  else if(state.phase==='auction')content=auction();
  else if(state.phase==='sold')content=`<section class="sale-confirmation" role="status"><span class="sale-check" aria-hidden="true">✓</span><div><h1>${txt(state.lastSale.automatic?'assigned':'sold',{name:name(state.lastSale.playerId)})}</h1><strong>${money(state.lastSale.price)}</strong><p>${esc(local(state.lastSale.card.name))}</p></div></section>${hero(state.lastSale.card)}<p class="note">${txt('paid',{amount:money(state.lastSale.price)})}${state.lastSale.automatic?' · '+txt('assignedReason'):''}</p>${playerStrip()}${state.role==='narrator'?button(txt(state.lotIndex===1?'nextChoice':'next'),'next',{primary:true,disabled:!connected}):`<p class="note">${txt('waitNext')}</p>`}`;
  else if(state.phase==='unsold')content=`<h1>${txt('unsold')}</h1>${hero(state.card)}<p class="note">${txt('unsoldText')}</p>${state.role==='narrator'?button(txt('continue'),'next',{primary:true,disabled:!connected}):`<p class="note">${txt('waitNext')}</p>`}`;
  else if(state.phase==='complete')content=completion();else if(['voting','tiebreak'].includes(state.phase))content=voting();else if(state.phase==='results')content=results();else content=mystery();
  const drafting=!['lobby','voting','tiebreak','results'].includes(state.phase);
  app.innerHTML=`<main class="shell">${header()}<p class="status" role="status">${connected?'':txt('connecting')}</p>${wallet()}${state.upgraded?`<p class="note">${txt('upgraded')}</p>`:''}${drafting?`<div class="match-progress" aria-label="${txt('positionProgress',{number:state.positionIndex+1,total:state.positionCount})}">${state.slots.map((s,i)=>`<i class="${i<=state.positionIndex?'active':''}"></i>`).join('')}</div><div class="meta round-heading"><div><small>${txt('positionProgress',{number:state.positionIndex+1,total:state.positionCount})}</small><h2>${state.slots[state.positionIndex].label?esc(local(state.slots[state.positionIndex].label)):txt('roundNames.'+state.slots[state.positionIndex].id)}</h2></div><span class="badge">${['clues','choice','locked'].includes(state.phase)?txt('choiceBadge'):txt('lot',{number:state.lotIndex+1})}</span></div>${state.effect==='negative'?`<p class="negative-note">${txt('negativeRole')}</p>`:''}`:''}<section class="${transition&&state.phase!=='complete'?'enter':''}">${content}</section>${state.phase!=='lobby'?`<div class="lineup">${button(txt('lineups'),'lineups')}</div>${lineupSheet()}`:''}<p class="foot">${txt('room',{code:state.code})} · ${txt('scope')}</p></main>`;
  bind();if(lineupOpen)document.querySelector('#lineup-sheet')?.showModal();if(oldFocus)document.getElementById(oldFocus)?.focus({preventScroll:true});loadImages();updateClock();
}
function bind(){bindLanguage();document.querySelector('#lineup-player')?.addEventListener('change',e=>{lineupPlayer=e.target.value;render();});document.querySelector('#lineup-sheet')?.addEventListener('cancel',()=>{lineupOpen=false;});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>command(b.dataset.action));document.querySelectorAll('[data-raise]').forEach(b=>b.onclick=()=>{selectedRaise=Number(b.dataset.raise);render();});}
async function command(type){
  if(type==='save-card'){await saveResultCard();return;}
  if(type==='lineups'){lineupOpen=true;render();return;}
  if(type==='close-lineups'){lineupOpen=false;document.querySelector('#lineup-sheet')?.close();document.querySelector('#lineups')?.focus();return;}
  if(type==='home'){leave();return;}
  if(type==='copy'){const field=document.querySelector('#invite');try{await navigator.clipboard.writeText(field.value);notify(t('copied'));}catch{field.select();notify(t('copyManual'));}return;}
  if(busy||!connected)return;
  const input={type,revision:state.revision,requestId:crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('')};
  if(type.startsWith('set-box:')){[input.type,input.positionId,input.characterId]=type.split(':');}
  if(type.startsWith('vote:')||type.startsWith('break-tie:')){[input.type,input.targetId]=type.split(':');}
  if(type==='bid')input.amount=state.bid?state.bid.amount+selectedRaise:state.freeRound?0:state.card.price;
  if(type==='known'||type==='box'){input.type='choose';input.kind=type;}
  busy=true;render();
  try{accept(await request(`/api/rooms/${session.code}/action`,input));}
  catch(error){notify(t('errors.'+error.message));try{accept(await request(`/api/rooms/${session.code}/state`));}catch{connected=false;}}
  finally{busy=false;render();}
}
async function loadImages(){
  if(!session||!connected)return;
  const seat=session;
  for(const img of document.querySelectorAll('[data-character]')){
    const id=img.dataset.character;if(imageCache.has(id)){img.src=imageCache.get(id);img.hidden=false;continue;}if(imageLoading.has(id)||(imageRetryAt.get(id)||0)>Date.now())continue;imageLoading.add(id);imageRetryAt.set(id,Date.now()+5000);
    try{const res=await fetch(apiURL(`/api/rooms/${seat.code}/image/${id}`),{headers:{Authorization:'Bearer '+seat.token},signal:AbortSignal.timeout(10000)});if(!res.ok)continue;const data=await res.blob();if(session!==seat)continue;const blob=URL.createObjectURL(data);imageCache.set(id,blob);for(const el of document.querySelectorAll('[data-character]'))if(el.dataset.character===id){el.src=blob;el.hidden=false;}}
    catch{/* Names and actions remain usable if a photo cannot load. */}
    finally{imageLoading.delete(id);}
  }
}
function updateClock(){const nodes=[...document.querySelectorAll('#timer,#lineup-timer')];if(!nodes.length||!state)return;const value=state.paused?t('paused'):Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000))+'s';for(const node of nodes)if(node.textContent!==value)node.textContent=value;}
setInterval(updateClock,100);
if(params.has('table'))renderTable();else{if(session&&params.get('room')&&session.code!==params.get('room')){session=null;state=null;}render();if(session)connect();}
