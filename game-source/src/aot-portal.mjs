import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export function mountAotPortal(root,{language='en',onExit=()=>{},onEnterGame=onExit}={}){
const tr=(en,ka)=>language==='ka'?ka:en;
root.className='aot-portal';root.dataset.mode='loading';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',tr('Attack on Titan interactive outpost','ტიტანებზე შეტევა — ინტერაქტიული ფორპოსტი'));
const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
const app=document.querySelector('#app'),previousInert=app?.inert; if(app)app.inert=true;
root.innerHTML=`<canvas data-aot="scene" tabindex="0" aria-label="${tr('3D outpost. Drag the gear or use arrow keys to rotate it. Enter opens the gate.','3D ფორპოსტი. მექანიზმის დასატრიალებლად გადაათრიე ან გამოიყენე ისრები. Enter აღებს ჭიშკარს.')}"></canvas>
<div class="aot-shade"></div><nav class="aot-top" aria-label="${tr('Scene controls','სცენის მართვა')}"><button data-aot="back" aria-label="${tr('Back to game','თამაშში დაბრუნება')}">‹</button><span class="aot-brand">PARTY DRAFT</span><button data-aot="sound" aria-pressed="false">${tr('Sound off','ხმა გამორთულია')}</button><button data-aot="settings" aria-label="${tr('Open controls','მართვის გახსნა')}">☷</button></nav>
<div class="aot-title"><h1>ATTACK ON<br>TITAN</h1><p>${tr('Beyond the Walls','კედლებს მიღმა')}</p></div>
<div data-aot="loading" role="status"><span>${tr('PREPARING THE OUTPOST','ფორპოსტის მომზადება')}</span><progress max="100" aria-label="${tr('Blender model loading','Blender-ის მოდელის ჩატვირთვა')}"></progress><small>${tr('Loading the 3D world…','3D სამყაროს ჩატვირთვა…')}</small></div>
<footer class="aot-bottom"><p data-aot="hint">${tr('Drag the gear to inspect','გადაათრიე მექანიზმის დასათვალიერებლად')}</p><button data-aot="enter" disabled>${tr('Enter the gate','შედი ჭიშკარში')} <span aria-hidden="true">➜</span></button></footer>
<button data-aot="skip" hidden>${tr('Skip to room','ოთახში გადასვლა')}</button>
<dialog data-aot="controls" aria-label="${tr('Outpost controls','ფორპოსტის მართვა')}"><h2>${tr('Outpost controls','ფორპოსტის მართვა')}</h2><button data-aot="motion" aria-pressed="true"></button><button data-aot="tilt">${tr('Enable phone tilt','ჩართე ტელეფონის დახრით მართვა')}</button><button data-aot="reset">${tr('Reset gear & view','მექანიზმისა და ხედის აღდგენა')}</button><button data-aot="close">${tr('Close','დახურვა')}</button></dialog>
<p data-aot="note" role="status"></p>`;
const $=selector=>root.querySelector(selector.replace(/#([\w-]+)/g,'[data-aot="$1"]'));
const canvas=$('#scene'),events=new AbortController();
function disposeModel(node){const geos=new Set(),mats=new Set(),textures=new Set();node.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});mats.forEach(m=>m.dispose());geos.forEach(g=>g.dispose());}
const media=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=media.matches,loaded=false,disposed=false,hidden=false,mode='loading',sound=false,ctx,gain,osc,audioTimer,raf,last=0,elapsed=0,travelStart=0,spin=0,drag=null,tilt=false;
let model,mixer,action,camera,basePos,baseQuat,reels=[],bannerMeshes=[],enterEnd=new THREE.Vector3(0,1.6,-19);
const velocity=new THREE.Vector2(),pointer=new THREE.Vector2(),ray=new THREE.Raycaster(),touchNdc=new THREE.Vector2();
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:1.75));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFShadowMap;scene.background=new THREE.Color('#727976');scene.fog=new THREE.FogExp2('#7b8584',.0018);
scene.add(new THREE.HemisphereLight('#acbccb','#3b3023',1));
const sun=new THREE.DirectionalLight('#ffe0ad',2.5);sun.position.set(20,35,12);sun.target.position.set(0,4,0);scene.add(sun,sun.target);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-20,right:20,top:25,bottom:-22,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;
const fill=new THREE.DirectionalLight('#bacbdf',.5);fill.position.set(-20,10,20);scene.add(fill);
const lamps=[];
for(const x of [-4.2,4.2]){const l=new THREE.PointLight('#ffb567',14,7,2);l.position.set(x,3.1,0);lamps.push(l);scene.add(l);}
new THREE.TextureLoader().load(new URL('./assets/aot/sky.jpg',import.meta.url).href,t=>{if(disposed){t.dispose();return;}t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;scene.background=t;scene.environment=t;scene.environmentIntensity=.5;scene.backgroundIntensity=.8;});
function spriteTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'rgba(220,225,225,.8)');g.addColorStop(.4,'rgba(190,202,204,.28)');g.addColorStop(1,'rgba(180,190,198,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const smTex=spriteTexture(),steam=[];
for(let i=0;i<10;i++){const mat=new THREE.SpriteMaterial({map:smTex,opacity:.14,depthWrite:false,color:'#d6d9d3'}),p=new THREE.Sprite(mat);p.position.set((i%2?1:-1)*(5+i%3),38+(i%4)*4,-53-i);p.scale.set(8,13,1);p.userData.base=p.position.clone();steam.push(p);scene.add(p);}
camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.05,500);camera.position.set(0,1.6,18);camera.lookAt(0,8,-12);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const quality=new URLSearchParams(location.search).get('quality')||(innerWidth<900?'mobile':'desktop');
const assets=quality==='desktop'?'desktop':'mobile';
loader.load(new URL('./assets/aot/outpost-'+assets+'.glb',import.meta.url).href,g=>{
 if(disposed||mode==='error'){disposeModel(g.scene);return;}
 model=g.scene;scene.add(model);scene.updateMatrixWorld(true);
 const src=g.cameras[0];if(src){camera=src.clone();src.getWorldPosition(camera.position);src.getWorldQuaternion(camera.quaternion);camera.scale.set(1,1,1);camera.near=.05;camera.far=500;scene.add(camera);}
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();basePos=camera.position.clone();baseQuat=camera.quaternion.clone();
 model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=!o.name.startsWith('Wall');if(o.material)o.material.envMapIntensity=.6;}
 if(o.name==='GearReel'||o.name==='GearReel_Right'){reels.push(o);o.userData.base=o.quaternion.clone();}
 if(o.isMesh&&o.name.startsWith('Banners')){const p=o.geometry.attributes.position,arr=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){arr[i*3]=p.getX(i);arr[i*3+1]=p.getY(i);arr[i*3+2]=p.getZ(i);}o.geometry.setAttribute('position',new THREE.BufferAttribute(arr.slice(),3));o.userData.base=arr;bannerMeshes.push(o);}
 });
 model.getObjectByName('EntryEnd')?.getWorldPosition(enterEnd);enterEnd.y=1.7;
 mixer=new THREE.AnimationMixer(model);const clip=g.animations.find(a=>a.name==='Gate_Open');if(clip){action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}
 renderer.shadowMap.needsUpdate=true;loaded=true;mode='scene';root.dataset.mode='scene';$('#loading').hidden=true;$('#enter').disabled=false;
 api.modelLoaded=true;api.animationNames=g.animations.map(a=>a.name);api.assetVariant=assets;clearTimeout(loadTimeout);last=performance.now();
},p=>{if(p.total){$('#loading progress').value=p.loaded/p.total*100;$('#loading small').textContent=Math.round(p.loaded/p.total*100)+'%';}},()=>fallback());
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function on(t,type,fn){t.addEventListener(type,fn,{signal:events.signal});}
function reset(){if(!loaded)return;mode='scene';renderer.shadowMap.needsUpdate=true;spin=0;velocity.set(0,0);pointer.set(0,0);action?.stop();mixer?.setTime(0);camera.position.copy(basePos);camera.quaternion.copy(baseQuat);for(const r of reels)r.quaternion.copy(r.userData.base);root.dataset.mode='scene';$('#skip').hidden=true;}
function enter(){if(mode==='error'){onEnterGame();return;}if(!loaded||mode!=='scene')return;mode='travel';travelStart=elapsed;action?.reset().play();root.dataset.mode='travel';$('#skip').hidden=false;$('#skip').focus();if(reduced){mixer?.update(2);arrive();}}
function arrive(){mode='arrival';onEnterGame();}
function toggleSound(){sound=!sound;if(sound){ctx??=new (window.AudioContext||window.webkitAudioContext)();ctx.resume();if(!gain){gain=ctx.createGain();gain.gain.value=.018;gain.connect(ctx.destination);osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=65.406;osc.connect(gain);osc.start();}gain.gain.setTargetAtTime(.018,ctx.currentTime,.2);}else gain?.gain.setTargetAtTime(0,ctx.currentTime,.15);$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').textContent=sound?tr('Sound on','ხმა ჩართულია'):tr('Sound off','ხმა გამორთულია');}
on(window,'resize',resize);on($('#enter'),'click',enter);on($('#back'),'click',onExit);on($('#skip'),'click',onEnterGame);on($('#reset'),'click',()=>{reset();$('#controls').close();});on($('#sound'),'click',()=>{try{toggleSound();}catch{sound=false;$('#note').textContent=tr('Sound unavailable.','ხმა მიუწვდომელია.');}});
on($('#settings'),'click',()=>$('#controls').showModal());on($('#close'),'click',()=>$('#controls').close());on($('#controls'),'close',()=>$('#settings').focus());
on($('#motion'),'click',()=>{reduced=!reduced;$('#motion').textContent=tr('Motion: ','მოძრაობა: ')+(reduced?tr('off','გამორთული'):tr('on','ჩართული'));$('#motion').setAttribute('aria-pressed',String(!reduced));});
$('#motion').textContent=tr('Motion: ','მოძრაობა: ')+(reduced?tr('off','გამორთული'):tr('on','ჩართული'));$('#motion').setAttribute('aria-pressed',String(!reduced));
on($('#tilt'),'click',async()=>{try{if(!window.DeviceOrientationEvent)throw Error('unavailable');const permission=DeviceOrientationEvent.requestPermission?await DeviceOrientationEvent.requestPermission():'granted';if(permission!=='granted')throw Error('denied');tilt=true;$('#tilt').textContent=tr('Tilt enabled','დახრით მართვა ჩართულია');}catch{$('#tilt').textContent=tr('Tilt unavailable — drag works','დახრა მიუწვდომელია — გადაათრიე თითით');}});
on(window,'deviceorientation',e=>{if(tilt&&!reduced){pointer.x=THREE.MathUtils.clamp((e.gamma||0)/40,-1,1);pointer.y=THREE.MathUtils.clamp(((e.beta||40)-40)/40,-1,1);}});
on(canvas,'pointerdown',e=>{if(mode!=='scene')return;canvas.setPointerCapture(e.pointerId);touchNdc.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(touchNdc,camera);const hit=ray.intersectObjects(reels,true);drag={x:e.clientX,y:e.clientY,gear:hit.length>0||e.clientY>innerHeight*.64};});
on(canvas,'pointermove',e=>{if(!drag||mode!=='scene')return;const dx=e.clientX-drag.x;drag.x=e.clientX;drag.y=e.clientY;if(drag.gear){spin=dx*.003;for(const r of reels)r.rotateZ(spin);}else{pointer.x=THREE.MathUtils.clamp(e.clientX/innerWidth*2-1,-1,1);pointer.y=THREE.MathUtils.clamp(e.clientY/innerHeight*2-1,-1,1);}});
on(canvas,'pointerup',()=>{drag=null;});on(canvas,'pointercancel',()=>{drag=null;});
on(window,'keydown',e=>{if(!root.contains(document.activeElement))return;if($('#controls').open)return;if(e.key==='Escape'){if(mode==='travel')reset();else onExit();return;}if(e.target.tagName==='BUTTON')return;if(e.key==='Enter'){e.preventDefault();enter();}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();renderer.shadowMap.needsUpdate=true;for(const r of reels)r.rotateZ(e.key==='ArrowLeft'?-.15:.15);}});
on(document,'visibilitychange',()=>{hidden=document.hidden;if(hidden){cancelAnimationFrame(raf);ctx?.suspend();}else{if(sound)ctx?.resume();last=performance.now();raf=requestAnimationFrame(frame);}});
on(media,'change',e=>{reduced=e.matches;$('#motion').textContent=tr('Motion: ','მოძრაობა: ')+(reduced?tr('off','გამორთული'):tr('on','ჩართული'));});
function frame(now){if(disposed||hidden)return;const dt=Math.min((now-last)/1000,.05)||.016;last=now;elapsed+=dt;
 if(loaded){
  if(mode==='travel'){const t=elapsed-travelStart;mixer?.update(dt);const k=THREE.MathUtils.clamp((t-.65)/2.1,0,1),ease=k*k*(3-2*k);camera.position.lerpVectors(basePos,enterEnd,ease);const target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(enterEnd,new THREE.Vector3(0,2,-40),new THREE.Vector3(0,1,0)));camera.quaternion.slerpQuaternions(baseQuat,target,ease);if(t>2.85)arrive();}
  if(mode==='scene'){camera.position.copy(basePos);if(!reduced){camera.position.x+=pointer.x*.16;camera.position.y-=pointer.y*.05;}camera.quaternion.copy(baseQuat);if(!drag&&!reduced){spin*=Math.exp(-dt*3.2);for(const r of reels)r.rotateZ(spin*dt*60);}}
  if(!reduced){steam.forEach((p,i)=>{p.position.x=p.userData.base.x+Math.sin(elapsed*.16+i)*1.2;p.position.y=p.userData.base.y+Math.sin(elapsed*.12+i)*1.5;});lamps.forEach((l,i)=>l.intensity=14+Math.sin(elapsed*2+i)*.8);
   for(const o of bannerMeshes){const a=o.geometry.attributes.position,b=o.userData.base;let max=-Infinity,min=Infinity;for(let i=1;i<b.length;i+=3){max=Math.max(max,b[i]);min=Math.min(min,b[i]);}const range=max-min||1;for(let i=0;i<a.count;i++)a.setZ(i,b[i*3+2]+Math.sin(elapsed*.7+b[i*3]*12)*(max-b[i*3+1])/range*range*.008);a.needsUpdate=true;}
  }
 }
 if(disposed||mode==='error')return;
 if(mode==='travel'||Math.abs(spin)>.0001||drag?.gear)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);raf=requestAnimationFrame(frame);
}
const api={modelLoaded:false,getState:()=>({texturedMeshes:model?.children.flatMap(o=>o.children).filter(o=>o.isMesh&&o.material.map).length||0,mode,reduced,sound,spin,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,hasTitan:!!model?.getObjectByName('ColossalTitan'),textures:renderer.info.memory.textures,disposed,doorTime:action?.time||0,gearAngle:reels[0]?.rotation.z||0}),dispose:()=>{if(disposed)return;disposed=true;clearTimeout(loadTimeout);document.body.style.overflow=previousOverflow;if(app)app.inert=previousInert;cancelAnimationFrame(raf);events.abort();ctx?.close();mixer?.stopAllAction();const textures=new Set(),mats=new Set(),geos=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});if(scene.background?.isTexture)textures.add(scene.background);textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});mats.forEach(m=>m.dispose());geos.forEach(g=>g.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();}};

function fallback(){if(disposed||mode==='error')return;mode='error';clearTimeout(loadTimeout);cancelAnimationFrame(raf);$('#loading').hidden=true;$('#hint').textContent=tr('You can still enter your AoT room.','შეგიძლია AoT-ის ოთახში შესვლა.');$('#note').textContent=tr('3D is unavailable on this device.','ამ მოწყობილობაზე 3D მიუწვდომელია.');$('#enter').disabled=false;$('#enter').textContent=tr('Continue to room →','გააგრძელე ოთახში →');}
const loadTimeout=setTimeout(()=>{if(!loaded)fallback();},45000);
on(canvas,'webglcontextlost',e=>{e.preventDefault();fallback();});
on(root,'keydown',e=>{if(e.key!=='Tab'||$('#controls').open)return;const items=[...root.querySelectorAll('button:not(:disabled),canvas[tabindex]')].filter(x=>!x.hidden&&x.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
on(window,'pagehide',()=>api.dispose());$('#back').focus({preventScroll:true});raf=requestAnimationFrame(frame);
return api;
}
