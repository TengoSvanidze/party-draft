import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createKnotMotion} from '../src/dark-motion.mjs';
test('release coasts and decays equally at different frame rates',()=>{
 const results=[30,60,120].map(fps=>{const m=createKnotMotion();m.grab();m.drag(.2,.05,.04);m.release();const before=m.state.y;for(let i=0;i<fps*3;i++)m.step(1/fps);assert.ok(m.state.y>before+.5);assert.ok(m.state.vy<.1);return m.state.y;});
 assert.ok(Math.max(...results)-Math.min(...results)<1e-9);
});
test('grabbing, stale release, and reduced motion stop inertia',()=>{
 const m=createKnotMotion();m.impulse();m.grab();assert.equal(m.state.vy,0);m.drag(.2,0,.02);m.release(.2);assert.equal(m.state.vy,0);
 m.impulse();const before=m.state.y;m.step(1,true);assert.equal(m.state.y,before);assert.equal(m.state.vy,0);
 m.grab();m.drag(.2,.1,.03);m.release(0,true);assert.equal(m.state.vy,0);assert.ok(m.state.y>before);
});
