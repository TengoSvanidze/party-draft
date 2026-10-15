import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

for(const limited of [false,true])test(`Action checks overlap and ${limited?'rate limit still blocks the request':'missing rooms still return 404'}`,{timeout:2000},async()=>{
 let rateStarted=false,readStarted=false,release;
 const together=new Promise(resolve=>release=resolve);
 const DB={withSession(){return this;},prepare(sql){return {bind(){return this;},async first(){
  if(sql.startsWith('SELECT data'))readStarted=true;
  else if(sql.startsWith('INSERT INTO rates'))rateStarted=true;
  else assert.fail('Unexpected database operation');
  if(rateStarted&&readStarted)release();
  await together;
  return sql.startsWith('SELECT')?null:{count:limited?241:1};
 },async run(){assert.fail('No mutation allowed');}};}};
 const res=await worker.fetch(new Request('https://test.example/api/rooms/ABCDEF/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'open'})}),{DB},{});
 assert.equal(res.status,limited?429:404);
 assert.equal((await res.json()).error,limited?'slowDown':'roomMissing');
});
