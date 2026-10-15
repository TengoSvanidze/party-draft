import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
import {createHash} from 'node:crypto';

test('Every Naruto card uses the selected original image',()=>{
 const manifest=JSON.parse(readFileSync('test/fixtures/naruto-images.json','utf8'));
 const images=JSON.parse(readFileSync('src/images.json','utf8'));
 assert.equal(manifest.length,66);assert.equal(new Set(manifest.map(x=>x.filename)).size,65);
 for(const entry of manifest)assert.equal(createHash('sha256').update(Buffer.from(images[entry.id].data,'base64')).digest('hex'),entry.sha256,entry.id);
});

test('Naruto preserves the approved lineups, clues and narrator explanations',()=>{
 const draft=JSON.parse(readFileSync('test/fixtures/naruto-approved.json','utf8'));
 const pack=JSON.parse(readFileSync('src/naruto-pack.json','utf8'));
 assert.equal(pack.positions.length,15);
 for(const [i,p] of pack.positions.entries()){
  const r=draft.rounds[i];
  assert.deepEqual(p.lots.map(c=>c.name.en),[...r.auction,r.known]);
  assert.deepEqual(p.outcomes.map(c=>c.name.en),r.outcomes);
  assert.deepEqual(p.clues.map(c=>c.en),r.clues.map(c=>c.text));
  p.outcomes.forEach((c,j)=>assert.deepEqual(c.explanations.map(e=>e.en),r.clues.map(e=>e.explanations[j])));
  assert.equal(p.effect,r.effect);
  assert.ok([...p.lots,...p.outcomes].every(c=>c.id.startsWith('naruto-')&&c.hasImage===true));
 }
 assert.deepEqual(pack.positions.filter(p=>p.effect==='negative').map(p=>p.id),['naruto-greatest-enemy']);
});

test('Naruto online: both mystery paths across 15 rounds, secrecy, voting and rematches',async()=>{
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={withSession(){return this;},prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(s){return Promise.all(s.map(x=>x.run()));}};
 const call=(path,body,seat)=>worker.fetch(new Request('https://test.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),{DB},{waitUntil:p=>p.catch(()=>{})});
 const req=async(...args)=>{const res=await call(...args);assert.ok(res.ok,`${args[0]}: ${res.status}`);return res.json();};
 const themes=await req('/api/themes'),naruto=themes.find(t=>t.id==='naruto');
 assert.equal(naruto.startingBudget,2500);assert.match(naruto.ui.setupText,/all 15/);
 assert.ok(!JSON.stringify(themes).includes('outcomes'));assert.ok(!JSON.stringify(themes).includes('Hidden Rain'));
 const host=await req('/api/rooms',{name:'Narrator',themeId:'naruto'}),base='/api/rooms/'+host.code;
 const players=[];for(const name of ['One','Two','Three'])players.push(await req(base+'/join',{name}));
 const state=seat=>req(base+'/state',null,seat);
 const action=async(seat,type,extra={})=>req(base+'/action',{type,revision:(await state(seat)).revision,requestId:crypto.randomUUID(),...extra},seat);
 const expire=()=>{const room=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(host.code).data);room.deadline=Date.now()-1;db.prepare('UPDATE rooms SET data=?,version=version+1 WHERE code=?').run(JSON.stringify(room),host.code);};
 for(let outcome=0;outcome<2;outcome++){
  db.exec('DELETE FROM rates');
  const lobby=await state(host);assert.equal(lobby.positionCount,15);assert.equal(lobby.boxSetup.length,15);
  assert.equal((await state(players[0])).boxSetup,undefined);
  await action(host,'set-boxes',{selections:lobby.boxSetup.map(p=>({positionId:p.positionId,characterId:p.options[outcome].id}))});
  await action(host,'lock-boxes');await action(host,'start');
  for(let round=0;round<15;round++){
   for(let lot=0;lot<2;lot++){
    const ready=await state(host);assert.equal(ready.positionIndex,round);assert.equal(ready.card.hasImage,true);
    const image=await call(base+'/image/'+ready.card.id,null,players[0]);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
    await action(host,'open');expire();assert.equal((await state(host)).phase,'sold');await action(host,'next');
   }
   const clues=await state(host);assert.equal(clues.phase,'clues');assert.equal(clues.answer.id,lobby.boxSetup[round].options[outcome].id);
   assert.equal(clues.answer.explanations.length,3);
   const player=players.find(p=>p.memberId===clues.recipientId);
   assert.equal((await state(player)).answer,null);assert.deepEqual((await state(player)).clues,[]);
   const before=await state(player);
   const previouslyVisible=before.members.some(m=>m.lineup.some(s=>s.card?.id===clues.answer.id));
   if(!previouslyVisible&&clues.card.id!==clues.answer.id)assert.equal((await call(base+'/image/'+clues.answer.id,null,player)).status,403);
   assert.equal((await call(base+'/image/'+clues.card.id,null,player)).status,200);
   assert.equal((await call(base+'/image/'+clues.answer.id,null,host)).status,200);
   const premature=await call(base+'/action',{type:'reveal',revision:clues.revision,requestId:crypto.randomUUID()},host);
   assert.equal(premature.status,400);assert.equal((await premature.json()).error,'wrongPhase');
   for(let n=1;n<=3;n++){await action(host,'clue');assert.equal((await state(player)).clues.length,n);}
   const locked=await action(player,'choose',{kind:'box'});assert.equal(locked.answer,null);
   assert.equal(locked.members.find(m=>m.id===player.memberId).lineup[round].status,'sealed');
   const complete=await action(host,'reveal');assert.equal(complete.answer.id,clues.answer.id);
   assert.equal((await call(base+'/image/'+complete.answer.id,null,player)).status,200);
   assert.ok(complete.members.every(m=>m.budget>=0));
   await action(host,round===14?'open-vote':'next-position');
  }
  for(let i=0;i<3;i++)await action(players[i],'vote',{targetId:players[(i+1)%3].memberId});
  assert.equal((await state(host)).phase,'tiebreak');await action(host,'break-tie',{targetId:players[0].memberId});
  const result=await state(host);assert.equal(result.phase,'results');assert.equal(result.slots.length,15);
  assert.ok(result.members.filter(m=>m.role==='drafter').every(m=>m.lineup.every(s=>s.status==='filled')));
  const reset=await action(host,'rematch');assert.equal(reset.theme.id,'naruto');assert.ok(reset.boxSetup.every(p=>p.selectedId===null));
  assert.ok(reset.members.every(m=>m.budget===2500&&m.totalSpent===0));
 }
 assert.equal((await call(base+'/image/got-house-stark',null,players[0])).status,403);
 db.close();
});
