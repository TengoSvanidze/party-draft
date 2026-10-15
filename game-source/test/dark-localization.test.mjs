import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
test('Dark Georgian covers every card, clue and explanation with Georgian names and intact placeholders',()=>{
 const pack=json('../src/dark-pack.json'), ui=json('../src/dark-ka.json');
 const check=x=>{assert.ok(x.ka?.trim(),x.en);assert.deepEqual([...x.en.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),[...x.ka.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort());};
 for(const p of pack.positions){
  [p.title,p.label,p.prompt,...p.clues].forEach(check);
  for(const c of [...p.lots,...p.outcomes]){
   [c.name,c.pitch,...(c.explanations||[])].forEach(check);
   assert.match(c.name.ka,/[ა-ჰ]/u);
  }
 }
 assert.ok(ui.notice);assert.ok(!ui.notice.includes('coming later'));
 assert.deepEqual([...ui.ui.autoAssignNotice.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),['{amount}','{name}']);
});
