import {catalogue} from './themes.mjs';
import {createRoom,joinRoom,act,view,tick,allowedImage,RuleError} from './engine.mjs';
import publicFiles from './public-files.json';
import images from './images.json';
import {positionsFor} from './themes.mjs';
const DAY=86400000;
const pagesOrigin='https://tengosvanidze.github.io';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const nameOf=b=>{if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>24||/[\x00-\x1f<>]/.test(b.name))throw new RuleError('invalidName');return b.name.trim();};
async function body(req){if(Number(req.headers.get('content-length'))>8192)throw new RuleError('invalidRequest');const reader=req.body?.getReader();if(!reader)throw new RuleError('invalidRequest');let bytes=0,text='';const decoder=new TextDecoder();while(true){const x=await reader.read();if(x.done)break;bytes+=x.value.length;if(bytes>8192){await reader.cancel();throw new RuleError('invalidRequest');}text+=decoder.decode(x.value,{stream:true});}try{return JSON.parse(text+decoder.decode());}catch{throw new RuleError('invalidRequest');}}
function database(env){return env.DB.withSession?env.DB.withSession('first-primary'):env.DB;}
async function rate(db,req,path){const ip=req.headers.get('CF-Connecting-IP')||'unknown',window=Math.floor(Date.now()/60000);const limit=path==='/api/rooms'?15:240;const key=await digest(ip)+':'+(path==='/api/rooms'?'create':'actions')+':'+window;const row=await db.prepare('INSERT INTO rates (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+120000).first();return row.count<=limit;}
async function handle(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 if(req.method==='OPTIONS'&&path.startsWith('/api/'))return new Response(null,{status:req.headers.get('Origin')===pagesOrigin?204:403});
 if(req.method==='GET'&&publicFiles[path]){
  const f=publicFiles[path],headers={'Content-Type':f.type,'Cache-Control':'public, no-cache','ETag':f.etag};
  if(path==='/'&&url.searchParams.get('theme')==='attack-on-titan')headers.Link='</assets/aot/outpost-art.webp>; rel=preload; as=image; fetchpriority=high';
  const tags=(req.headers.get('If-None-Match')||'').split(',').map(t=>t.trim().replace(/^W\//,''));
  if(tags.includes(f.etag)||tags.includes('*'))return new Response(null,{status:304,headers});
  return new Response(f.base64?Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)):f.text,{headers});
 }
 if(!path.startsWith('/api/'))return json({error:'notFound'},404);
 if(req.method==='GET'&&path==='/api/themes')return json(catalogue);
 const db=database(env);
 if(req.method==='POST'){
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin&&req.headers.get('Origin')!==pagesOrigin)return json({error:'unauthorized'},403);
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'invalidRequest'},400);
 }
 if(req.method==='POST'&&path==='/api/rooms'){
  if(!await rate(db,req,path))return json({error:'slowDown'},429);
  const input=await body(req);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new RuleError('invalidRequest');
  const name=nameOf(input);
  ctx.waitUntil(db.batch([db.prepare('DELETE FROM rooms WHERE expires < ?').bind(Date.now()),db.prepare('DELETE FROM rates WHERE expires < ?').bind(Date.now())]));
  for(let i=0;i<8;i++){
   const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
   const room=createRoom(code,name,Date.now(),input.themeId??'mcu'),secret=token();room.sessions={[await digest(secret)]:room.hostId};
   const seats=[{code,token:secret,memberId:room.hostId}];
   if(input.practice===true){
    room.practice=true;
    for(const name of ['John','George','Nick']){const m=joinRoom(room,name),secret=token();room.sessions[await digest(secret)]=m.id;seats.push({code,token:secret,memberId:m.id});}
   }
   const result=await db.prepare('INSERT OR IGNORE INTO rooms (code,data,version,expires) VALUES (?,?,1,?)').bind(code,JSON.stringify(room),Date.now()+DAY).run();
   if(result.meta.changes){const {sessions,...snapshot}=room;return json({...seats[0],...(room.practice?{seats,practiceRoom:snapshot}:{})},201);}
  }
  return json({error:'slowDown'},429);
 }
 const match=path.match(/^\/api\/rooms\/([A-Z2-9]{6})\/(join|state|action|image|practice)(?:\/([a-z0-9-]+))?$/);
 if(!match)return json({error:'notFound'},404);
 const [,code,op,imageId]=match;
 if(['join','action','practice'].includes(op)?req.method!=='POST':req.method!=='GET')return json({error:'invalidRequest'},405);
 const input=req.method==='POST'?await body(req):null;
 if(req.method==='POST'&&(!input||typeof input!=='object'||Array.isArray(input)))throw new RuleError('invalidRequest');
 const auth=await digest((req.headers.get('Authorization')||'').replace(/^Bearer /,''));
 const secret=op==='join'?token():null;
 for(let attempt=0;attempt<10;attempt++){
  // Independent checks share one network wait; mutations still require both.
  const [row,allowed]=await Promise.all([
   db.prepare('SELECT data,version FROM rooms WHERE code=? AND expires>?').bind(code,Date.now()).first(),
   req.method==='POST'&&attempt===0?rate(db,req,path):true
  ]);
  if(!allowed)return json({error:'slowDown'},429);
  if(!row)return json({error:'roomMissing'},404);
  const room=JSON.parse(row.data),memberId=room.sessions?.[auth];
  if(op!=='join'&&!memberId)return json({error:'unauthorized'},401);
  let dirty=tick(room),result,error;
  try{
   if(op==='join'){const m=joinRoom(room,nameOf(input));room.sessions[await digest(secret)]=m.id;dirty=true;result={code,memberId:m.id,token:secret};}
   else if(op==='practice'){
    // Only a table holding all four seats may export the full practice state.
    if(memberId!==room.hostId||!Array.isArray(input.tokens)||input.tokens.length!==4||room.members.length!==4)return json({error:'unauthorized'},403);
    const ids=await Promise.all(input.tokens.map(async t=>typeof t==='string'?room.sessions[await digest(t)]:null));
    if(!room.members.every(m=>ids.includes(m.id)))return json({error:'unauthorized'},403);
    room.practice=true;dirty=true;const {sessions,...snapshot}=room;result={room:snapshot};
   }
   else if(op==='action'){dirty=act(room,memberId,input)||dirty;result=view(room,memberId);}
   else if(op==='state')result=view(room,memberId);
   else if(op==='image'){
    const practiceImage=room.practice&&positionsFor(room).some(p=>[...p.lots,...p.outcomes].some(c=>c.id===imageId));
    if(!practiceImage&&!allowedImage(room,memberId,imageId))return json({error:'unauthorized'},403);
    const image=images[imageId];if(!image)return json({error:'notFound'},404);
    return new Response(Uint8Array.from(atob(image.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':image.type,'Cache-Control':'private, max-age=3600'}});
   }
  }catch(e){error=e;}
  if(dirty){
   const saved=await db.prepare('UPDATE rooms SET data=?,version=version+1,expires=? WHERE code=? AND version=?').bind(JSON.stringify(room),Date.now()+DAY,code,row.version).run();
   if(!saved.meta.changes)continue;
  }
  if(error)throw error;
  return json(result,op==='join'?201:200);
 }
 return json({error:'stateChanged'},409);
}
export default {async fetch(req,env,ctx){let res;try{res=await handle(req,env,ctx);}catch(e){console.error('Party Draft request failed',e.code||e.message);res=json({error:e instanceof RuleError?e.code:'serverError'},e instanceof RuleError?400:503);}const headers=new Headers(res.headers);if(req.headers.get('Origin')===pagesOrigin){headers.set('Access-Control-Allow-Origin',pagesOrigin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');headers.set('Access-Control-Max-Age','600');}headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' blob:; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");return new Response(res.body,{status:res.status,headers});}};
