import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

test('unchanged public files validate without sending their bodies again',async()=>{
 for(const path of ['/assets/aot/outpost-art.webp','/assets/aot/passage.webp','/app.js','/themes.json','/']){
  const fetch=headers=>worker.fetch(new Request('https://test.example'+path,{headers}),{},{});
  const initial=await fetch();assert.equal(initial.status,200);const tag=initial.headers.get('ETag');assert.ok(tag);
  for(const value of [tag,'W/'+tag,'"other", '+tag]){const cached=await fetch({'If-None-Match':value});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);assert.equal(cached.headers.get('ETag'),tag);}
  const changed=await fetch({'If-None-Match':'"old-content"'});assert.equal(changed.status,200);assert.ok((await changed.arrayBuffer()).byteLength>0);
 }
});

test('only the AoT entry preloads its artwork',async()=>{
 const aot=await worker.fetch(new Request('https://test.example/?home=1&theme=attack-on-titan'),{},{});
 assert.match(aot.headers.get('Link'),/outpost-art.webp/);
 const dark=await worker.fetch(new Request('https://test.example/?home=1&theme=dark'),{},{});assert.equal(dark.headers.get('Link'),null);
});
