import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
function binding(sqlite){return {withSession(){return this;},prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};}
test('public worker: rooms, concurrent bids, hidden answers, expiry, six rounds and voting',async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const env={DB:binding(sqlite)},ctx={waitUntil:p=>p.catch(()=>{})};
 const req=async(path,body,seat)=>{const r=await worker.fetch(new Request('https://party.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:'https://party.example'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),env,ctx);return {status:r.status,data:await r.json()};};
 const host=(await req('/api/rooms',{name:'Host'})).data,base='/api/rooms/'+host.code;
 const players=[];for(const name of ['John','George','Nick'])players.push((await req(base+'/join',{name})).data);
 for(const payload of ['null','[]','"bad"'])for(const path of ['/api/rooms',base+'/action']){const r=await worker.fetch(new Request('https://party.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+host.token},body:payload}),env,ctx);assert.equal(r.status,400);assert.equal((await r.json()).error,'invalidRequest');}
 assert.equal((await req(base+'/state')).status,401);
 assert.equal((await req('/assets/doctor-strange-reference.jpg')).status,404);
 assert.equal((await req(base+'/image/doctor-strange',null,players[0])).status,403);
 const state=async s=>(await req(base+'/state',null,s)).data;
 const action=async(s,type,extra={})=>{const current=await state(s);const r=await req(base+'/action',{type,revision:current.revision,requestId:crypto.randomUUID(),...extra},s);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 for(const row of (await state(host)).boxSetup)await action(host,'set-box',{positionId:row.positionId,characterId:row.options[0].id});
 await action(host,'lock-boxes');await action(host,'start');await action(host,'open');
 const current=await state(players[0]);
 const raced=await Promise.all(players.slice(0,2).map(p=>req(base+'/action',{type:'bid',amount:70,revision:current.revision,requestId:crypto.randomUUID()},p)));
 assert.equal(raced.filter(x=>x.status===200).length,1);assert.equal(raced.filter(x=>x.data.error==='stateChanged').length,1);
 await action(host,'pause');assert.equal((await state(players[0])).paused,true);await action(host,'resume');
 const expire=()=>{const row=sqlite.prepare('SELECT data FROM rooms WHERE code=?').get(host.code);const room=JSON.parse(row.data);room.deadline=Date.now()-1;sqlite.prepare('UPDATE rooms SET data=?,version=version+1 WHERE code=?').run(JSON.stringify(room),host.code);};
 for(let step=0;step<150;step++){
  const s=await state(host);if(s.phase==='results')break;
  if(s.phase==='auction'||s.phase==='choice'){expire();continue;}
  if(s.phase==='ready'){await action(host,'open');continue;}
  if(s.phase==='sold'||s.phase==='unsold'){await action(host,'next');continue;}
  if(s.phase==='clues'){const playerState=await state(players[0]);assert.equal(playerState.answer,null);await action(host,'clue');continue;}
  if(s.phase==='locked'){await action(host,'reveal');continue;}
  if(s.phase==='complete'){await action(host,s.positionIndex===5?'open-vote':'next-position');continue;}
  if(s.phase==='voting'){for(let i=0;i<3;i++)if(!(await state(players[i])).myVote)await action(players[i],'vote',{targetId:players[(i+1)%3].memberId});continue;}
  if(s.phase==='tiebreak'){await action(host,'break-tie',{targetId:s.tiedIds[0]});continue;}
  assert.fail('Unexpected phase '+s.phase);
 }
 const final=await state(host);assert.equal(final.phase,'results');assert.ok(final.winnerId);assert.ok(final.members.every(m=>m.budget>=0));
 await action(host,'rematch');
 const restarted=await state(host);assert.equal(restarted.phase,'lobby');assert.equal(restarted.round,2);assert.equal(restarted.boxesLocked,false);assert.ok(restarted.members.every(m=>m.budget===1000&&m.totalSpent===0));assert.ok(restarted.boxSetup.every(b=>b.selectedId===null));
 for(const row of restarted.boxSetup)await action(host,'set-box',{positionId:row.positionId,characterId:row.options[1].id});
 await action(host,'lock-boxes');await action(host,'start');await action(host,'open');
 await action(players[0],'bid',{amount:1000});await action(players[1],'yield');await action(players[2],'yield');
 let s=await state(players[0]);assert.equal(s.phase,'sold');assert.equal(s.members.find(m=>m.id===players[0].memberId).budget,0);
 await action(host,'next');await action(host,'open');expire();
 s=await state(host);assert.equal(s.lastSale.playerId,players[1].memberId);assert.equal(s.lastSale.price,50);assert.equal(s.lastSale.automatic,true);
 await action(host,'next');for(let i=0;i<3;i++)await action(host,'clue');
 s=await state(players[2]);assert.equal(s.timers.mystery,30);assert.ok(s.deadline-s.serverTime>29000);assert.equal(s.answer,null);
 const boxPrice=s.boxPrice;await action(players[2],'choose',{kind:'box'});
 s=await state(players[2]);assert.equal(s.answer,null);assert.equal(s.members.find(m=>m.id===players[2].memberId).lineup[0].status,'sealed');
 assert.equal((await req(base+'/image/drax',null,players[2])).status,403);
 await action(host,'reveal');s=await state(players[2]);assert.equal(s.answer.id,'drax');assert.equal(s.members.find(m=>m.id===players[2].memberId).budget,1000-boxPrice);
 await action(host,'next-position');s=await state(players[0]);assert.equal(s.members.find(m=>m.id===players[0].memberId).lineup[1].status,'missed');
 assert.equal(JSON.stringify(sqlite.prepare('SELECT data FROM rooms').all()).includes(host.token),false);
 sqlite.close();
});
