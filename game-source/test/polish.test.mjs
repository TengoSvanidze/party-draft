import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationEvent} from '../public/polish.js';
const previous={code:'ROOMAA',round:1,positionIndex:0,revision:7,phase:'auction',bid:{amount:70,playerId:'john'}};
test('confirmed bid and sale effects do not repeat on duplicate state',()=>{
 const next={...previous,revision:8,bid:{amount:71,playerId:'nick'}};
 assert.equal(presentationEvent(previous,next),'bid');
 assert.equal(presentationEvent(next,next),null);
 assert.equal(presentationEvent(next,previous),null);
 assert.equal(presentationEvent(previous,{...next,phase:'sold'}),'sold');
});
test('mystery effect only follows a reveal, never clues, choice or initial load',()=>{
 const locked={...previous,phase:'locked'};
 const complete={...locked,revision:8,phase:'complete',answer:{id:'drax'},choice:{kind:'box'}};
 assert.equal(presentationEvent(locked,complete),'reveal');
 assert.equal(presentationEvent(null,complete),null);
 assert.equal(presentationEvent({...locked,phase:'clues'},complete),null);
 assert.equal(presentationEvent(locked,{...complete,choice:{kind:'none'}}),null);
 assert.equal(presentationEvent(locked,{...complete,round:2}),null);
 assert.equal(presentationEvent(locked,{...complete,positionIndex:1}),null);
 assert.equal(presentationEvent(locked,{...complete,code:'ROOMBB'}),null);
});
