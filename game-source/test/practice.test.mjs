import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
import {createPractice} from '../public/practice.js';
const images=JSON.parse(readFileSync(new URL('../src/images.json',import.meta.url),'utf8'));

function setup(){
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))db.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={withSession(){return this;},prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(s){return Promise.all(s.map(x=>x.run()));}};
 const call=(path,body,seat)=>worker.fetch(new Request('https://test.example'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(seat?{Authorization:'Bearer '+seat.token}:{})},body:body?JSON.stringify(body):undefined}),{DB},{waitUntil:p=>p.catch(()=>{})});
 return {db,call};
}
for(const themeId of ['mcu','dark','game-of-thrones','naruto','attack-on-titan'])test(`${themeId} local practice: full match, timers, secrets, reload and synchronous actions`,async t=>{
 const {db,call}=setup();const response=await call('/api/rooms',{name:'Narrator',themeId,practice:true});assert.equal(response.status,201);
 const {seats,practiceRoom}=await response.json();assert.equal(seats.length,4);assert.ok(practiceRoom.members.every(m=>m.budget===(['game-of-thrones','naruto','attack-on-titan'].includes(themeId)?2500:1000)));assert.equal(practiceRoom.sessions,undefined);
 let time=Date.now(),saved,practice=createPractice(practiceRoom,seats,{now:()=>time,persist:r=>saved=r});
 const base=`/api/rooms/${practiceRoom.code}`,read=i=>practice.request(base+'/state',null,seats[i].token),times=[];
 const action=(i,type,extra={})=>{const start=performance.now();const s=practice.request(base+'/action',{type,revision:read(i).revision,requestId:crypto.randomUUID(),...extra},seats[i].token);assert.equal(typeof s.then,'undefined');times.push(performance.now()-start);return s;};
 let updates=0;const unsubscribe=practice.subscribe(seats[1].token,()=>updates++);
 action(0,'set-boxes',{selections:read(0).boxSetup.map(row=>({positionId:row.positionId,characterId:row.options[1].id}))});
 await Promise.resolve();assert.equal(updates,2);unsubscribe();
 assert.equal(read(1).boxSetup,undefined);
 const before=practice.snapshot();assert.throws(()=>action(0,'set-boxes',{selections:[{positionId:read(0).boxSetup[0].positionId,characterId:read(0).boxSetup[0].options[0].id},{positionId:'invalid',characterId:'invalid'}]}),/invalidRequest/);assert.deepEqual(practice.snapshot(),before);
 action(0,'lock-boxes');if(themeId==='dark')for(let i=1;i<4;i++)action(i,'player-ready',{ready:true});action(0,'start');action(0,'open');
 const r=read(1).revision;action(1,'bid',{amount:70});assert.throws(()=>practice.request(base+'/action',{type:'bid',revision:r,amount:70,requestId:crypto.randomUUID()},seats[2].token),/stateChanged/);
 assert.throws(()=>action(2,'bid',{amount:71}),/bidTooLow/);
 assert.throws(()=>action(2,'bid',{amount:79}),/bidTooLow/);
 action(2,'bid',{amount:80});assert.equal(read(0).bid.amount,80);
 action(0,'pause');time+=20000;practice.advance();assert.equal(read(0).phase,'auction');assert.equal(read(0).paused,true);action(0,'resume');
 practice=createPractice(saved,seats,{now:()=>time,persist:r=>saved=r});assert.equal(read(0).bid.amount,80);
 for(let step=0;step<250;step++){
  const s=read(0);if(s.phase==='results')break;
  if(['auction','choice'].includes(s.phase)){time=s.deadline+1;practice.advance();continue;}
  if(s.phase==='ready'){action(0,'open');continue;}
  if(['sold','unsold'].includes(s.phase)){action(0,'next');continue;}
  if(s.phase==='clues'){assert.equal(read(1).answer,null);action(0,'clue');continue;}
  if(s.phase==='locked'){assert.equal(read(1).answer,null);action(0,'reveal');continue;}
  if(s.phase==='complete'){
   for(let i=1;i<4;i++){
    const revealed=read(i);assert.equal(revealed.clues.length,3);
    assert.equal(revealed.answer.explanations.length,3);
    assert.ok(revealed.clues.every(c=>c.en.length>0));
    assert.ok(revealed.answer.explanations.every(e=>e.en.length>0));
    assert.deepEqual(revealed.answer,s.answer);
   }
   action(0,s.positionIndex===s.positionCount-1?'open-vote':'next-position');continue;
  }
  if(s.phase==='voting'){for(let i=1;i<4;i++)action(i,'vote',{targetId:seats[i%3+1].memberId});continue;}
  if(s.phase==='tiebreak'){action(0,'break-tie',{targetId:s.tiedIds[0]});continue;}
  assert.fail(s.phase);
 }
 assert.equal(read(0).phase,'results');assert.ok(read(0).members.every(m=>m.budget>=0));
 const imageId=read(0).members.flatMap(m=>m.lineup).find(slot=>slot.card&&images[slot.card.id])?.card.id;assert.ok(imageId);
 action(0,'rematch');assert.equal(read(0).phase,'lobby');assert.equal(read(0).round,2);assert.ok(read(0).members.every(m=>m.budget===(['game-of-thrones','naruto','attack-on-titan'].includes(themeId)?2500:1000)&&m.totalSpent===0));
 assert.equal((await call(base+'/image/'+imageId,null,seats[1])).status,200);
 assert.equal((await call(base+'/image/'+(themeId==='mcu'?'dark-noah':'drax'),null,seats[1])).status,403);
 times.sort((a,b)=>a-b);t.diagnostic(`Local engine p95: ${times[Math.floor(times.length*.95)].toFixed(2)}ms across ${times.length} actions`);db.close();
});
test('Legacy table migration requires all four seats and omits session hashes',async()=>{
 const {db,call}=setup();const host=await (await call('/api/rooms',{name:'Host'})).json(),base='/api/rooms/'+host.code;
 const seats=[host];for(const name of ['One','Two','Three'])seats.push(await (await call(base+'/join',{name})).json());
 assert.equal((await call(base+'/practice',{tokens:seats.map(()=>host.token)},host)).status,403);
 assert.equal((await call(base+'/practice',{tokens:seats.map(s=>s.token)},seats[1])).status,403);
 const migration=await call(base+'/practice',{tokens:seats.map(s=>s.token)},host);assert.equal(migration.status,200);const data=await migration.json();assert.equal(data.room.sessions,undefined);assert.equal(data.room.members.length,4);assert.equal(data.room.practice,true);
 db.close();
});
