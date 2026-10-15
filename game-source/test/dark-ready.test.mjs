import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';

test('Dark readiness is per player, reversible, authenticated, idempotent and required before starting',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync('drizzle/'+f,'utf8'));
  const DB={withSession(){return this;},prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(s){return Promise.all(s.map(x=>x.run()));}};
  const call=async(path,body,seat)=>{
   const response=await worker.fetch(new Request('https://test.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),{DB},{waitUntil:p=>p.catch(()=>{})});
   return {status:response.status,data:await response.json()};
  };
  const host=(await call('/api/rooms',{name:'Host',themeId:'dark'})).data,base='/api/rooms/'+host.code;
  const players=[];for(const name of ['One','Two','Three'])players.push((await call(base+'/join',{name})).data);
  const state=async seat=>(await call(base+'/state',null,seat)).data;
  const action=async(seat,type,extra={})=>call(base+'/action',{type,revision:(await state(seat)).revision,requestId:crypto.randomUUID(),...extra},seat);
  assert.equal((await state(host)).readyRequired,true);
  assert.ok((await state(host)).members.every(m=>!m.ready));
  assert.equal((await action(host,'player-ready',{ready:true})).data.error,'ineligible');
  assert.equal((await action(players[0],'player-ready',{ready:'true'})).data.error,'invalidRequest');
  const revision=(await state(players[0])).revision,requestId=crypto.randomUUID();
  const input={type:'player-ready',ready:true,revision,requestId,memberId:players[1].memberId};
  const first=await call(base+'/action',input,players[0]);assert.equal(first.status,200);
  assert.equal(first.data.members.find(m=>m.id===players[0].memberId).ready,true);
  assert.equal(first.data.members.find(m=>m.id===players[1].memberId).ready,false);
  assert.equal((await call(base+'/action',input,players[0])).data.revision,first.data.revision);
  assert.equal((await call(base+'/action',{...input,requestId:crypto.randomUUID()},players[1])).data.error,'stateChanged');
  const lobby=await state(host);
  await action(host,'set-boxes',{selections:lobby.boxSetup.map(row=>({positionId:row.positionId,characterId:row.options[0].id}))});
  await action(host,'lock-boxes');
  assert.equal((await action(host,'start')).data.error,'playersNotReady');
  for(const player of players.slice(1))await action(player,'player-ready',{ready:true});
  await action(players[0],'player-ready',{ready:false});
  assert.equal((await action(host,'start')).data.error,'playersNotReady');
  await action(players[0],'player-ready',{ready:true});
  assert.equal((await action(host,'start')).data.phase,'ready');
  assert.equal((await action(players[0],'player-ready',{ready:false})).data.error,'wrongPhase');
  const row=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(host.code).data);row.phase='results';
  db.prepare('UPDATE rooms SET data=? WHERE code=?').run(JSON.stringify(row),host.code);
  const rematch=await action(host,'rematch');assert.ok(rematch.data.members.every(m=>!m.ready));
  assert.equal(rematch.data.readyRequired,true);
  // Old Dark rooms retain their original start behavior until a new room is created.
  const legacy=JSON.parse(db.prepare('SELECT data FROM rooms WHERE code=?').get(host.code).data);
  delete legacy.readyRequired;legacy.boxesLocked=true;
  db.prepare('UPDATE rooms SET data=? WHERE code=?').run(JSON.stringify(legacy),host.code);
  assert.equal((await action(host,'start')).data.phase,'ready');
  const other=(await call('/api/rooms',{name:'Other',themeId:'mcu'})).data;
  const drafter=(await call('/api/rooms/'+other.code+'/join',{name:'Player'})).data;
  const otherState=(await call('/api/rooms/'+other.code+'/state',null,drafter)).data;
  assert.equal((await call('/api/rooms/'+other.code+'/action',{type:'player-ready',ready:true,revision:otherState.revision,requestId:crypto.randomUUID()},drafter)).data.error,'wrongPhase');
 }finally{db.close();}
});
