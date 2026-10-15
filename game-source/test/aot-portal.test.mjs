import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

test('AoT entrance serves the generated artwork and lightweight interface',async()=>{
 const image=await worker.fetch(new Request('https://test.example/assets/aot/outpost-art.webp'),{},{});
 assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/webp');
 const bytes=new Uint8Array(await image.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(new TextDecoder().decode(bytes.slice(8,12)),'WEBP');
 for(const file of ['aot-entrance.js','aot-portal.css','assets/aot/passage.webp']){const response=await worker.fetch(new Request('https://test.example/'+file),{},{});assert.equal(response.status,200);}
 const entry=await worker.fetch(new Request('https://test.example/aot-entrance.js'),{},{});const code=await entry.text();assert.ok(!code.includes('GLTFLoader'));assert.ok(code.length<20000);
});
