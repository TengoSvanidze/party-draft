import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('GitHub Pages CORS permits the game origin and rejects other preflights',async()=>{
 const origin='https://tengosvanidze.github.io';
 const call=(method,Origin)=>worker.fetch(new Request('https://party.example/api/themes',{method,headers:{Origin}}),{},{});
 const pre=await call('OPTIONS',origin);assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),origin);assert.match(pre.headers.get('Access-Control-Allow-Headers'),/Authorization/);
 const get=await call('GET',origin);assert.equal(get.status,200);assert.equal(get.headers.get('Access-Control-Allow-Origin'),origin);assert.deepEqual((await get.json()).map(theme=>theme.id),['mcu','dark','game-of-thrones','naruto','attack-on-titan']);
 const bad=await call('OPTIONS','https://example.net');assert.equal(bad.status,403);assert.equal(bad.headers.get('Access-Control-Allow-Origin'),null);
});
