import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../dist/server/index.js';

const pack=JSON.parse(readFileSync(new URL('../src/aot-pack.json',import.meta.url),'utf8'));
const placeholders=text=>(text.match(/\{[^{}]+\}/g)||[]).sort();

function bilingual(value,path){
 assert.equal(typeof value?.en,'string',`${path}.en`);
 assert.equal(typeof value?.ka,'string',`${path}.ka`);
 assert.ok(value.en.trim(),`${path}.en is blank`);
 assert.ok(value.ka.trim(),`${path}.ka is blank`);
 assert.match(value.ka,/[ა-ჰ]/u,`${path}.ka needs Georgian text`);
 assert.deepEqual(placeholders(value.ka),placeholders(value.en),`${path} placeholders`);
}

test('Attack on Titan content: complete bilingual rounds, shared clues and illustrated cards',()=>{
 assert.equal(pack.id,'attack-on-titan');
 const theme=JSON.parse(readFileSync(new URL('../src/aot-theme.json',import.meta.url),'utf8'));
 for(const key of ['name','description','scope','badge','notice'])bilingual({en:theme[key],ka:theme.ka[key]},`theme.${key}`);
 for(const [key,en]of Object.entries(theme.ui))bilingual({en,ka:theme.ka.ui[key]},`theme.ui.${key}`);
 assert.equal(pack.positions.length,7,'The approved team draft has seven rounds');
 assert.deepEqual(pack.positions.map(p=>p.id),['regiment','captain','strategy','attack-teammate','defence-teammate','attack-shifter','defence-shifter'].map(id=>'aot-'+id));
 const expected=['scouts','garrison','police','yeagerists','warriors','pixis','magath','shadis','zachary','kitz','erwin','hange','jean','armin','connie','levi','floch','sasha','kenny','marlo','mikasa','miche','nanaba','petra','daz','eren','zeke','pieck','annie','porco','reiner','lara','grisha','bertholdt','ymir'].map(id=>'aot-'+id);
 assert.deepEqual(pack.positions.flatMap(p=>[...p.lots,...p.outcomes].map(c=>c.id)),expected);
 assert.equal(new Set(expected).size,35,'No repeated characters');
 const sources=JSON.parse(readFileSync(new URL('../src/aot-image-sources.json',import.meta.url),'utf8'));
 assert.equal(new Set(pack.positions.map(p=>p.id)).size,pack.positions.length);
 const images=JSON.parse(readFileSync(new URL('../src/images.json',import.meta.url),'utf8'));
 for(const position of pack.positions){
  assert.ok(position.id.startsWith('aot-'),position.id);
  for(const key of ['title','label','prompt'])bilingual(position[key],`${position.id}.${key}`);
  assert.ok(['positive','negative'].includes(position.effect),`${position.id}.effect`);
  assert.equal(position.lots.length,3,position.id);
  assert.deepEqual(position.lots.map(c=>c.price),[70,50,20],position.id);
  assert.equal(position.outcomes.length,2,position.id);
  assert.equal(position.clues.length,3,position.id);
  assert.ok(Array.isArray(position.prices)&&position.prices.length>0,position.id);
  assert.ok(position.prices.every(price=>Number.isSafeInteger(price)&&price>0),position.id);
  const cards=[...position.lots,...position.outcomes];
  assert.equal(new Set(cards.map(c=>c.id)).size,5,`${position.id}: choices must be distinct`);
  for(const card of cards){
   assert.ok(card.id.startsWith('aot-'),card.id);
   bilingual(card.name,`${card.id}.name`);
   bilingual(card.pitch,`${card.id}.pitch`);
   assert.equal(card.hasImage,true,card.id);
   assert.ok(images[card.id]?.data,`${card.id}: missing bundled image`);
   assert.ok(Buffer.from(images[card.id].data,'base64').byteLength>100,`${card.id}: empty image`);
   assert.equal(createHash('sha256').update(Buffer.from(images[card.id].data,'base64')).digest('hex'),sources.find(s=>s.id===card.id)?.sha256,`${card.id}: approved photo bytes`);
  }
  for(const [index,clue]of position.clues.entries()){
   bilingual(clue,`${position.id}.clues[${index}]`);
   for(const outcome of position.outcomes){
    for(const language of ['en','ka'])assert.ok(!clue[language].toLocaleLowerCase().includes(outcome.name[language].toLocaleLowerCase()),`${position.id}: clue ${index+1} names hidden answer ${outcome.name[language]}`);
   }
  }
  for(const outcome of position.outcomes){
   assert.equal(outcome.explanations.length,3,outcome.id);
   outcome.explanations.forEach((explanation,index)=>bilingual(explanation,`${outcome.id}.explanations[${index}]`));
  }
 }
});

test('Attack on Titan online: both mystery paths, image secrecy, explanations, budgets, voting and rematches',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync('drizzle/'+file,'utf8'));
  const DB={withSession(){return this;},prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};
  const call=(path,body,seat)=>worker.fetch(new Request('https://test.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),{DB},{waitUntil:promise=>promise.catch(()=>{})});
  const req=async(...args)=>{const response=await call(...args);assert.ok(response.ok,`${args[0]}: ${response.status}`);return response.json();};
  const themes=await req('/api/themes'),theme=themes.find(t=>t.id==='attack-on-titan');
  assert.ok(theme);assert.equal(theme.startingBudget,2500);
  assert.ok(!JSON.stringify(themes).includes('outcomes'));
  assert.ok(!JSON.stringify(themes).includes('explanations'));
  const host=await req('/api/rooms',{name:'Narrator',themeId:'attack-on-titan'}),base='/api/rooms/'+host.code;
  const players=[];for(const name of ['One','Two','Three'])players.push(await req(base+'/join',{name}));
  const state=seat=>req(base+'/state',null,seat);
  const action=async(seat,type,extra={})=>req(base+'/action',{type,revision:(await state(seat)).revision,requestId:crypto.randomUUID(),...extra},seat);
  const expire=()=>{const room=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(host.code).data);room.deadline=Date.now()-1;db.prepare('UPDATE rooms SET data=?,version=version+1 WHERE code=?').run(JSON.stringify(room),host.code);};
  const seen=new Set();
  const image=async(id,seat)=>{const response=await call(base+'/image/'+id,null,seat);assert.equal(response.status,200,id);assert.match(response.headers.get('content-type'),/^image\/(jpeg|png|webp|svg\+xml)(?:;|$)/);assert.ok((await response.arrayBuffer()).byteLength>100,id);seen.add(id);};
  const checkBudgets=s=>{for(const member of s.members){assert.ok(member.budget>=0,member.name);assert.equal(member.budget+member.totalSpent,2500,`${member.name}: spending balance`);}};
  const isVisible=(s,id)=>s.card?.id===id||s.members.some(member=>member.lineup.some(slot=>slot.card?.id===id));
  const oldTheme=await req('/api/rooms',{name:'MCU Narrator',themeId:'mcu'}),oldBase='/api/rooms/'+oldTheme.code;

  for(let outcome=0;outcome<2;outcome++){
   // Accelerated matches represent separate real-world rate-limit windows.
   db.exec('DELETE FROM rates');
   const lobby=await state(host);
   assert.equal(lobby.theme.id,'attack-on-titan');assert.equal(lobby.positionCount,pack.positions.length);
   assert.deepEqual(lobby.boxSetup.map(row=>row.positionId),pack.positions.map(position=>position.id));
   for(const player of players){const publicLobby=await state(player);assert.equal(publicLobby.boxSetup,undefined);assert.equal(publicLobby.answer,null);}
   await action(host,'set-boxes',{selections:lobby.boxSetup.map(row=>({positionId:row.positionId,characterId:row.options[outcome].id}))});
   await action(host,'lock-boxes');await action(host,'start');
   for(const [round,position]of pack.positions.entries()){
    for(let lot=0;lot<2;lot++){
     const ready=await state(host);assert.equal(ready.positionIndex,round);assert.equal(ready.card.id,position.lots[lot].id);await image(ready.card.id,players[0]);
     await action(host,'open');expire();const sold=await state(host);assert.equal(sold.phase,'sold');assert.equal(sold.lastSale.price,[70,50][lot]);assert.equal(sold.lastSale.automatic,true);checkBudgets(sold);await action(host,'next');
    }
    const clues=await state(host),expected=position.outcomes[outcome];
    assert.equal(clues.phase,'clues');assert.equal(clues.answer.id,expected.id);assert.deepEqual(clues.answer.explanations,expected.explanations);
    await image(clues.card.id,players[0]);await image(expected.id,host);
    for(const player of players){
     const before=await state(player);assert.equal(before.answer,null);assert.deepEqual(before.clues,[]);
     // A recurring card may already be visible in an earlier purchased slot.
     if(!isVisible(before,expected.id))assert.equal((await call(base+'/image/'+expected.id,null,player)).status,403);
    }
    const premature=await call(base+'/action',{type:'reveal',revision:clues.revision,requestId:crypto.randomUUID()},host);
    assert.equal(premature.status,400);assert.equal((await premature.json()).error,'wrongPhase');
    const recipient=players.find(player=>player.memberId===clues.recipientId);assert.ok(recipient);
    for(let count=1;count<=3;count++){
     await action(host,'clue');const view=await state(recipient);assert.equal(view.answer,null);assert.deepEqual(view.clues,position.clues.slice(0,count));
    }
    const beforePurchase=await state(recipient),budget=beforePurchase.members.find(m=>m.id===recipient.memberId).budget;
    const locked=await action(recipient,'choose',{kind:'box'});
    assert.equal(locked.answer,null);assert.equal(locked.members.find(m=>m.id===recipient.memberId).lineup[round].status,'sealed');
    assert.equal(locked.members.find(m=>m.id===recipient.memberId).budget,budget-beforePurchase.boxPrice);checkBudgets(locked);
    const complete=await action(host,'reveal');assert.equal(complete.phase,'complete');assert.equal(complete.answer.id,expected.id);
    for(const player of players){
     const revealed=await state(player);assert.equal(revealed.answer.id,expected.id);assert.deepEqual(revealed.clues,position.clues);assert.deepEqual(revealed.answer.explanations,expected.explanations);await image(expected.id,player);checkBudgets(revealed);
    }
    await action(host,round===pack.positions.length-1?'open-vote':'next-position');
   }
   const selfVote=await call(base+'/action',{type:'vote',revision:(await state(players[0])).revision,requestId:crypto.randomUUID(),targetId:players[0].memberId},players[0]);assert.equal(selfVote.status,400);
   for(let index=0;index<players.length;index++)await action(players[index],'vote',{targetId:players[(index+1)%players.length].memberId});
   assert.equal((await state(host)).phase,'tiebreak');await action(host,'break-tie',{targetId:players[1].memberId});
   const result=await state(host);assert.equal(result.phase,'results');assert.equal(result.winnerId,players[1].memberId);assert.equal(result.slots.length,pack.positions.length);
   assert.ok(result.members.filter(member=>member.role==='drafter').every(member=>member.lineup.length===pack.positions.length&&member.lineup.every(slot=>slot.status==='filled')));checkBudgets(result);
   const reset=await action(host,'rematch');assert.equal(reset.phase,'lobby');assert.equal(reset.theme.id,'attack-on-titan');assert.equal(reset.round,outcome+2);assert.equal(reset.boxesLocked,false);
   assert.ok(reset.boxSetup.every(row=>row.selectedId===null));assert.ok(reset.members.every(member=>member.budget===2500&&member.totalSpent===0));
  }
  assert.deepEqual([...seen].sort(),[...new Set(pack.positions.flatMap(position=>[...position.lots,...position.outcomes].map(card=>card.id)))].sort());
  for(const id of ['tony-stark','dark-noah','got-house-stark','naruto-hidden-leaf'])assert.equal((await call(base+'/image/'+id,null,players[0])).status,403,id);
  assert.equal((await call(oldBase+'/image/'+pack.positions[0].lots[0].id,null,oldTheme)).status,403);
  assert.equal((await req(oldBase+'/state',null,oldTheme)).theme.id,'mcu');
 }finally{db.close();}
});
