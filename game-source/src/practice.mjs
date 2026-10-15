import {act,tick,view} from './engine.mjs';

// A practice table owns every seat on this device. Use exactly the online rules,
// but execute them once in the parent tab instead of making four network trips.
export function createPractice(room,seats,{persist=()=>{},now=Date.now}={}){
 let current=structuredClone(room),scheduled=false;
 const listeners=new Map();
 const member=token=>{const seat=seats.find(s=>s.token===token);if(!seat)throw Error('unauthorized');return seat.memberId;};
 const read=token=>structuredClone(view(current,member(token),now()));
 const publish=()=>{
  persist(structuredClone(current));
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;for(const [token,callbacks] of listeners)for(const cb of callbacks)cb(read(token));});
 };
 return {
  code:current.code,
  request(path,input,token){
   const id=member(token);
   if(path===`/api/rooms/${current.code}/state`){if(tick(current,now()))publish();return read(token);}
   if(path!==`/api/rooms/${current.code}/action`)throw Error('invalidRequest');
   // Apply on a copy: failed actions cannot partially mutate the shared room.
   const next=structuredClone(current);tick(next,now());
   const dirty=act(next,id,input,now());
   current=next;if(dirty)publish();return read(token);
  },
  subscribe(token,callback){member(token);if(!listeners.has(token))listeners.set(token,new Set());listeners.get(token).add(callback);callback(read(token));return ()=>listeners.get(token)?.delete(callback);},
  advance(){if(tick(current,now()))publish();},
  snapshot(){return structuredClone(current);}
 };
}
