import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';

test('Dark: both complete mystery paths, images, isolation, voting and rematches',async()=>{
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={withSession(){return this;},prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(s){return Promise.all(s.map(x=>x.run()));}};
 const call=async(path,body,seat)=>worker.fetch(new Request('https://test.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),{DB},{waitUntil:p=>p.catch(()=>{})});
 const req=async(...args)=>{const r=await call(...args);assert.equal(r.status,200+(args[0]==='/api/rooms'||args[0].endsWith('/join')?1:0));return r.json();};
 const themes=await req('/api/themes');assert.deepEqual(themes.map(t=>t.id),['mcu','dark','game-of-thrones','naruto','attack-on-titan']);assert.ok(!JSON.stringify(themes).includes('outcomes'));
 assert.equal((await call('/api/rooms',{name:'Invalid',themeId:'__proto__'})).status,400);
 const legacy=await req('/api/rooms',{name:'MCU Host'});
 const legacyRow=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(legacy.code).data);delete legacyRow.themeId;db.prepare('UPDATE rooms SET data=? WHERE code=?').run(JSON.stringify(legacyRow),legacy.code);
 const legacyState=await req('/api/rooms/'+legacy.code+'/state',null,legacy);assert.equal(legacyState.theme.id,'mcu');assert.equal(legacyState.boxSetup[0].positionId,'strategy');
 const host=await req('/api/rooms',{name:'Dark Host',themeId:'dark'}),base='/api/rooms/'+host.code;
 const players=[];for(const name of ['One','Two','Three'])players.push(await req(base+'/join',{name}));
 const state=seat=>req(base+'/state',null,seat);
 const action=async(seat,type,extra={})=>req(base+'/action',{type,revision:(await state(seat)).revision,requestId:crypto.randomUUID(),...extra},seat);
 const expire=()=>{const r=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(host.code).data);r.deadline=Date.now()-1;db.prepare('UPDATE rooms SET data=?,version=version+1 WHERE code=?').run(JSON.stringify(r),host.code);};
 const seen=new Set();
 const image=async(id,seat)=>{const r=await call(base+'/image/'+id,null,seat);assert.equal(r.status,200,id);assert.match(r.headers.get('Content-Type'),/^image\/(jpeg|webp)$/);assert.ok((await r.arrayBuffer()).byteLength>1000);seen.add(id);};
 for(let outcome=0;outcome<2;outcome++){
  const lobby=await state(host);assert.equal(lobby.theme.id,'dark');assert.equal(lobby.positionCount,6);assert.deepEqual(lobby.boxSetup.map(p=>p.positionId),['dark-house','dark-profession','dark-friend','dark-father','dark-mother','dark-rescuer']);
  assert.equal((await state(players[0])).boxSetup,undefined);
  for(const row of lobby.boxSetup)await action(host,'set-box',{positionId:row.positionId,characterId:row.options[outcome].id});
  await action(host,'lock-boxes');for(const player of players)await action(player,'player-ready',{ready:true});await action(host,'start');
  for(let round=0;round<6;round++){
   for(let lot=0;lot<2;lot++){
    const ready=await state(host);assert.equal(ready.positionIndex,round);assert.ok(ready.card.id.startsWith('dark-'));await image(ready.card.id,players[0]);
    await action(host,'open');expire();const sold=await state(host);assert.equal(sold.phase,'sold');assert.equal(sold.lastSale.price,[70,50][lot]);assert.equal(sold.lastSale.automatic,true);await action(host,'next');
   }
   const clues=await state(host);assert.equal(clues.phase,'clues');assert.equal(clues.answer.explanations.length,3);assert.ok(clues.answer.explanations.every(e=>e.en.length>20));await image(clues.card.id,players[0]);await image(clues.answer.id,host);
   const player=players.find(p=>p.memberId===clues.recipientId);const before=await state(player);assert.equal(before.answer,null);assert.deepEqual(before.clues,[]);
   // Repeated characters can legitimately be visible in a previously purchased slot.
   const previouslyVisible=before.members.some(m=>m.lineup.some(s=>s.card?.id===clues.answer.id));
   if(!previouslyVisible)assert.equal((await call(base+'/image/'+clues.answer.id,null,player)).status,403);
   for(let i=0;i<3;i++)await action(host,'clue');
   assert.equal((await state(player)).clues.length,3);
   const locked=await action(player,'choose',{kind:'box'});assert.equal(locked.answer,null);assert.equal(locked.members.find(m=>m.id===player.memberId).lineup[round].status,'sealed');
   const complete=await action(host,'reveal');assert.equal(complete.phase,'complete');assert.equal(complete.answer.id,clues.answer.id);await image(complete.answer.id,player);
   assert.ok(complete.members.every(m=>m.budget>=0));await action(host,round===5?'open-vote':'next-position');
  }
  for(let i=0;i<3;i++)await action(players[i],'vote',{targetId:players[(i+1)%3].memberId});
  const tie=await state(host);assert.equal(tie.phase,'tiebreak');await action(host,'break-tie',{targetId:players[1].memberId});
  const result=await state(host);assert.equal(result.phase,'results');assert.ok(result.members.filter(m=>m.role==='drafter').every(m=>m.lineup.every(s=>s.status==='filled')));
  const reset=await action(host,'rematch');assert.equal(reset.theme.id,'dark');assert.equal(reset.round,outcome+2);assert.ok(reset.boxSetup.every(x=>x.selectedId===null));assert.ok(reset.members.every(m=>m.budget===1000));
 }
 assert.equal(seen.size,24);assert.equal((await call(base+'/image/tony-stark',null,players[0])).status,403);
 assert.equal((await req('/api/rooms/'+legacy.code+'/state',null,legacy)).theme.id,'mcu');
 db.close();
});
