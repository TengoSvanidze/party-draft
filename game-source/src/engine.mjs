const randomUUID=()=>crypto.randomUUID(); const randomInt=max=>{const limit=Math.floor(4294967296/max)*max;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);return n%max;};
import content from './pack.json';
import {packs,themeFor,positionsFor,startingBudgetFor} from './themes.mjs';

export const positions = content.positions;
export const AUCTION_MS=15000, CHOICE_MS=30000;
export const SLOTS=positions.map(p=>({id:p.id,title:p.title}));
export const PACK = positions[0];
const pack=r=>positionsFor(r)[r.positionIndex];
const commitBoxes=r=>positionsFor(r).map(p=>({index:null,price:p.prices[randomInt(p.prices.length)]}));
const resetPosition=r=>{const b=r.boxes[r.positionIndex];Object.assign(r,{lotIndex:0,bid:null,yielded:[],deadline:null,paused:false,remaining:0,freeRound:false,clueCount:0,boxIndex:b.index,boxPrice:b.price,choice:null,lastSale:null,recipientId:null});for(const m of r.members){m.pick=null;m.paid=0;}};
export class RuleError extends Error { constructor(code) { super(code); this.code=code; } }
const need = (condition, code) => {if(!condition) throw new RuleError(code);};
export function createRoom(code,name,now=Date.now(),themeId='mcu') {
  const host={id:randomUUID(),name,role:'narrator',budget:startingBudgetFor({themeId}),pick:null,paid:0,roster:{}};
  need(Object.hasOwn(packs,themeId),'invalidTheme');
  const boxes=commitBoxes({themeId});
  return {code,themeId,rulesVersion:5,readyRequired:themeId==='dark',lastBuyerId:null,boxesLocked:false,created:now,updated:now,revision:1,phase:'lobby',members:[host],hostId:host.id,positionIndex:0,boxes,votes:{},winnerId:null,tiedIds:[],
    lotIndex:0,bid:null,yielded:[],deadline:null,paused:false,remaining:0,freeRound:false,
    clueCount:0,boxIndex:boxes[0].index,boxPrice:boxes[0].price,
    choice:null,lastSale:null,round:1,receipts:[]};
}
export function migrateRoom(r){
  if(r.rulesVersion===5)return false;
  if(r.rulesVersion===3||r.rulesVersion===4){
    if(r.rulesVersion===3){r.boxesLocked=r.phase!=='lobby';if(!r.boxesLocked){r.boxes=commitBoxes(r);resetPosition(r);}}
    r.lastBuyerId=r.choice?.price>0?r.choice.playerId:r.lastSale?.playerId||null;
    r.rulesVersion=5;r.revision++;return true;
  }
  const fresh=createRoom(r.code,r.members[0].name,r.created);const members=r.members.map(m=>({...m,budget:1000,pick:null,paid:0,roster:{}}));Object.assign(r,fresh,{members,hostId:r.hostId,revision:r.revision+1,updated:Date.now(),upgraded:true});return true;
}
export const drafters = r => r.members.filter(m=>m.role==='drafter');
export const eligible = r => drafters(r).filter(m=>!m.pick && m.budget>0);
const changed = (r,now) => {r.revision++;r.updated=now;};
export function joinRoom(r,name,now=Date.now()) {
  need(r.phase==='lobby','alreadyStarted');need(drafters(r).length<3,'roomFull');
  need(!r.members.some(m=>m.name.toLowerCase()===name.toLowerCase()),'nameTaken');
  const m={id:randomUUID(),name,role:'drafter',budget:startingBudgetFor(r),pick:null,paid:0,roster:{}};r.members.push(m);changed(r,now);return m;
}
const clearClock = r=>{r.deadline=null;r.paused=false;r.remaining=0;};
function award(r,m,card,price,now,automatic=false) {
  need(!m.pick && price>0 && price<=m.budget,'invalidPurchase');m.pick=card;m.paid=price;m.budget-=price;
  m.roster[pack(r).id]={card,paid:price};
  r.lastBuyerId=m.id;r.lastSale={playerId:m.id,card,price,automatic};r.phase='sold';clearClock(r);changed(r,now);
}
export function automaticRecipient(r) {
  const players=drafters(r),previous=players.findIndex(p=>p.id===r.lastBuyerId),price=pack(r).lots[r.lotIndex].price;
  for(let step=1;step<=players.length;step++){
    const p=players[(previous+step)%players.length];
    if(!p.pick&&p.budget>=price)return p;
  }
  return null;
}
function endAuction(r,now) {
  if(r.bid) return award(r,r.members.find(m=>m.id===r.bid.playerId),pack(r).lots[r.lotIndex],r.bid.amount,now);
  const recipient=automaticRecipient(r),card=pack(r).lots[r.lotIndex];
  if(recipient)return award(r,recipient,card,card.price,now,true);
  r.phase='unsold';r.lastSale=null;clearClock(r);changed(r,now);
}
export function fallback(r) {
  const m=r.members.find(p=>p.id===r.recipientId)||eligible(r)[0], known=pack(r).lots[2];
  if(!m)return {kind:'none',price:0};
  if(m.budget>=known.price)return {kind:'known',price:known.price};
  if(m.budget>=r.boxPrice)return {kind:'box',price:r.boxPrice};
  return {kind:'none',price:0};
}
function lockChoice(r,choice,now) {
  const m=r.members.find(p=>p.id===r.recipientId);need(m && choice.price<=m.budget,'notEnough');
  m.budget-=choice.price;m.paid=choice.price;
  if(choice.price>0)r.lastBuyerId=m.id;
  if(choice.kind==='known'){m.pick=pack(r).lots[2];m.roster[pack(r).id]={card:m.pick,paid:choice.price};}
  r.choice={...choice,playerId:m.id};r.phase='locked';clearClock(r);changed(r,now);
}
export function tick(r,now=Date.now()) {
  if(r.paused || !r.deadline || now<r.deadline)return false;
  if(r.phase==='auction')endAuction(r,now);
  else if(r.phase==='choice')lockChoice(r,fallback(r),now);
  else return false;
  return true;
}
export function act(r,memberId,input,now=Date.now()) {
  tick(r,now);
  const m=r.members.find(m=>m.id===memberId);need(m,'unauthorized');
  need(typeof input.requestId==='string' && /^[a-zA-Z0-9-]{8,80}$/.test(input.requestId),'invalidRequest');
  const receiptKey=memberId+':'+input.requestId;
  if(r.receipts.includes(receiptKey))return false;
  need(input.revision===r.revision,'stateChanged');
  const narrator=()=>need(m.role==='narrator','narratorOnly');
  switch(input.type) {
    case 'set-boxes': {
      narrator();need(r.phase==='lobby'&&!r.boxesLocked,'boxesLocked');
      need(Array.isArray(input.selections)&&input.selections.length>0&&input.selections.length<=positionsFor(r).length,'invalidRequest');
      const positions=positionsFor(r);
      const selections=input.selections.map(s=>{const i=positions.findIndex(p=>p.id===s?.positionId);need(i>=0,'invalidRequest');const index=positions[i].outcomes.findIndex(c=>c.id===s.characterId);need(index>=0,'invalidRequest');return {i,index};});
      for(const {i,index} of selections)r.boxes[i].index=index;break;
    }
    case 'set-box': {
      narrator();need(r.phase==='lobby'&&!r.boxesLocked,'boxesLocked');
      const positions=positionsFor(r);
      const i=positions.findIndex(p=>p.id===input.positionId);need(i>=0,'invalidRequest');
      const index=positions[i].outcomes.findIndex(c=>c.id===input.characterId);need(index>=0,'invalidRequest');r.boxes[i].index=index;break;
    }
    case 'lock-boxes': narrator();need(r.phase==='lobby'&&!r.boxesLocked,'boxesLocked');need(r.boxes.every(b=>b.index===0||b.index===1),'chooseAllBoxes');r.boxesLocked=true;resetPosition(r);break;
    case 'player-ready':
      need(r.themeId==='dark'&&r.phase==='lobby','wrongPhase');need(m.role==='drafter','ineligible');need(typeof input.ready==='boolean','invalidRequest');m.ready=input.ready;break;
    case 'start': narrator();need(r.phase==='lobby' && drafters(r).length===3,'needPlayers');need(r.boxesLocked,'lockBoxesFirst');need(!r.readyRequired||drafters(r).every(p=>p.ready),'playersNotReady');r.phase='ready';r.upgraded=false;break;
    case 'open': narrator();need(r.phase==='ready','wrongPhase');r.phase='auction';r.bid=null;r.yielded=[];r.freeRound=false;r.deadline=now+AUCTION_MS;break;
    case 'bid': {
      need(r.phase==='auction' && !r.paused,'notLive');need(m.role==='drafter' && !m.pick && m.budget>0 && !r.yielded.includes(m.id),'ineligible');
      need(r.bid?.playerId!==m.id,'alreadyLeading');const min=r.bid ? r.bid.amount+10 : pack(r).lots[r.lotIndex].price;
      need(Number.isSafeInteger(input.amount) && input.amount>=min,'bidTooLow');need(input.amount<=m.budget,'notEnough');
      r.bid={playerId:m.id,amount:input.amount};r.deadline=now+AUCTION_MS;
      if(eligible(r).filter(p=>p.id!==m.id).every(p=>r.yielded.includes(p.id)))endAuction(r,now);
      break;
    }
    case 'yield':
      need(r.phase==='auction' && !r.paused,'notLive');need(m.role==='drafter' && !m.pick && !r.yielded.includes(m.id),'ineligible');need(r.bid?.playerId!==m.id,'alreadyLeading');
      r.yielded.push(m.id);
      if(eligible(r).filter(p=>p.id!==r.bid?.playerId).every(p=>r.yielded.includes(p.id)))endAuction(r,now);
      break;
    case 'pause': narrator();need(['auction','choice'].includes(r.phase) && !r.paused,'wrongPhase');r.remaining=Math.max(0,r.deadline-now);r.deadline=null;r.paused=true;break;
    case 'resume': narrator();need(r.paused,'wrongPhase');r.deadline=now+r.remaining;r.paused=false;break;
    case 'next': narrator();need(['sold','unsold'].includes(r.phase),'wrongPhase');r.bid=null;r.yielded=[];r.freeRound=false;
      if(r.lotIndex===2||eligible(r).length===0){r.phase='complete';}
      else if(eligible(r).length===1){r.lotIndex=2;r.phase='clues';r.recipientId=eligible(r)[0].id;}
      else{r.lotIndex++;r.phase='ready';}break;
    case 'clue': narrator();need(r.phase==='clues' && r.clueCount<3,'wrongPhase');r.clueCount++;
      if(r.clueCount===3){r.phase='choice';r.deadline=now+CHOICE_MS;}break;
    case 'choose': {
      need(r.phase==='choice' && !r.paused,'notLive');need(m.role==='drafter' && !m.pick && m.budget>0 && m.id===r.recipientId,'ineligible');need(['known','box'].includes(input.kind),'invalidRequest');
      const price=input.kind==='box'?r.boxPrice:pack(r).lots[2].price;
      lockChoice(r,{kind:input.kind,price},now);break;
    }
    case 'reveal': narrator();need(r.phase==='locked','wrongPhase');
      if(r.choice.kind!=='none'){const p=r.members.find(p=>p.id===r.choice.playerId);p.pick=r.choice.kind==='box'?pack(r).outcomes[r.boxIndex]:pack(r).lots[2];p.roster[pack(r).id]={card:p.pick,paid:r.choice.price};}r.phase='complete';break;
    case 'next-position': narrator();need(r.phase==='complete'&&r.positionIndex<positionsFor(r).length-1,'wrongPhase');r.positionIndex++;resetPosition(r);r.phase=eligible(r).length?'ready':'complete';break;
    case 'open-vote': narrator();need(r.phase==='complete'&&r.positionIndex===positionsFor(r).length-1,'wrongPhase');r.phase='voting';break;
    case 'vote': {
      need(r.phase==='voting','wrongPhase');need(m.role==='drafter'&&!r.votes[m.id],'ineligible');need(drafters(r).some(p=>p.id===input.targetId)&&input.targetId!==m.id,'invalidVote');r.votes[m.id]=input.targetId;
      if(Object.keys(r.votes).length===drafters(r).length){const counts=drafters(r).map(p=>({id:p.id,count:Object.values(r.votes).filter(id=>id===p.id).length}));const max=Math.max(...counts.map(p=>p.count));r.tiedIds=counts.filter(p=>p.count===max).map(p=>p.id);if(r.tiedIds.length===1){r.winnerId=r.tiedIds[0];r.phase='results';}else r.phase='tiebreak';}break;
    }
    case 'break-tie': narrator();need(r.phase==='tiebreak'&&r.tiedIds.includes(input.targetId),'invalidVote');r.winnerId=input.targetId;r.phase='results';break;
    case 'rematch': narrator();need(r.phase==='results','wrongPhase');
      for(const p of r.members){p.pick=null;p.paid=0;p.budget=startingBudgetFor(r);p.roster={};p.ready=false;}
      Object.assign(r,{phase:'lobby',positionIndex:0,boxes:commitBoxes(r),boxesLocked:false,lastBuyerId:null,votes:{},winnerId:null,tiedIds:[],round:r.round+1});resetPosition(r);break;
    default: throw new RuleError('invalidRequest');
  }
  r.receipts.push(receiptKey);if(r.receipts.length>600)r.receipts.shift();changed(r,now);return true;
}
export function view(r,memberId,now=Date.now()) {
  const positions=positionsFor(r),SLOTS=positions.map(p=>({id:p.id,title:p.title,label:p.label}));
  const m=r.members.find(p=>p.id===memberId);need(m,'unauthorized');
  const mystery=['clues','choice','locked'].includes(r.phase)||(r.phase==='complete'&&!!r.choice), canKnow=m.role==='narrator'||r.phase==='complete';
  const visibleCard = r.phase==='lobby'?null:pack(r).lots[r.lotIndex];
  const ended=['voting','tiebreak','results'].includes(r.phase),votesVisible=['tiebreak','results'].includes(r.phase);
  return {theme:themeFor(r),code:r.code,revision:r.revision,phase:r.phase,you:memberId,role:m.role,round:r.round,serverTime:now,
    boxesLocked:r.boxesLocked,readyRequired:!!r.readyRequired,
    ...(m.role==='narrator'&&r.phase==='lobby'?{boxSetup:positions.map((p,i)=>({positionId:p.id,title:p.title,options:p.outcomes.map(c=>({id:c.id,name:c.name})),selectedId:p.outcomes[r.boxes[i].index]?.id||null}))}:{}),
    position:pack(r).title,prompt:pack(r).prompt,effect:pack(r).effect,positionIndex:r.positionIndex,positionCount:positions.length,lotIndex:r.lotIndex,card:visibleCard,slots:SLOTS,upgraded:!!r.upgraded,
    myVote:r.votes[memberId]||null,votesCast:Object.keys(r.votes).length,voteCounts:votesVisible?Object.fromEntries(drafters(r).map(p=>[p.id,Object.values(r.votes).filter(id=>id===p.id).length])):null,tiedIds:votesVisible?r.tiedIds:[],winnerId:r.winnerId,
    timers:{auction:AUCTION_MS/1000,mystery:CHOICE_MS/1000},
    members:r.members.map(p=>({id:p.id,name:p.name,role:p.role,ready:!!p.ready,budget:p.budget,pick:p.pick,paid:p.paid,totalSpent:startingBudgetFor(r)-p.budget,
      lineup:SLOTS.map((slot,i)=>({slotId:slot.id,card:p.roster[slot.id]?.card||null,paid:p.roster[slot.id]?.paid||0,status:p.roster[slot.id]?'filled':i===r.positionIndex&&r.choice?.playerId===p.id&&r.choice.kind==='box'&&r.phase==='locked'?'sealed':p.budget===0||i<r.positionIndex||ended||(i===r.positionIndex&&r.phase==='complete')?'missed':'empty'}))})),
    bid:r.bid,yielded:r.yielded,deadline:r.deadline,paused:r.paused,remaining:r.remaining,freeRound:r.freeRound,lastSale:r.lastSale,
    autoAssignId:['ready','auction'].includes(r.phase)?automaticRecipient(r)?.id||null:null,
    boxPrice:mystery?r.boxPrice:null,clues:mystery?pack(r).clues.slice(0,canKnow?3:r.clueCount):[],clueCount:r.clueCount,
    answer:mystery&&canKnow?pack(r).outcomes[r.boxIndex]:null,
    choice:r.choice,recipientId:mystery?(r.choice?.playerId||r.recipientId):null,
    fallback:['clues','choice'].includes(r.phase)?fallback(r):null};
}
export function allowedImage(r,memberId,id) {
  const s=view(r,memberId);return [s.card,s.answer,...s.members.flatMap(m=>m.lineup.map(s=>s.card))].some(c=>c?.id===id);
}
