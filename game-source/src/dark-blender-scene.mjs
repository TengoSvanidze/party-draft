import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';


const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment=`
precision highp float;
uniform sampler2D tScene;uniform vec2 uResolution;uniform float uTime,uMirror,uGlitch,uTravel,uMotion;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec2 uv=vUv;
 if(uMirror>0.){vec2 p=uv-.5;float r=length(p),a=atan(p.y,p.x)+uTime*.025,wedge=3.14159265/3.;a=abs(mod(a,wedge*2.)-wedge);vec2 k=vec2(cos(a),sin(a))*r;uv=mix(uv,abs(fract(k*1.35+vec2(0.,uTime*.006))-.5)*1.6+.08,uMirror);}
 uv.x+=sin(uv.y*90.+uTime*20.)*uGlitch*.008;
 vec2 px=1./uResolution;float split=(.00015+uGlitch*.003)*uMotion;
 vec3 col=vec3(texture2D(tScene,uv+vec2(split,0)).r,texture2D(tScene,uv).g,texture2D(tScene,uv-vec2(split,0)).b);
 vec3 glow=vec3(0.);
 for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a));glow+=max(texture2D(tScene,uv+d*px*5.).rgb-.95,0.)*.7;glow+=max(texture2D(tScene,uv+d*px*19.).rgb-1.,0.)*.36;}
 col+=glow*.045;
 float ink=noise(uv*6.+uTime*.065)*.7+noise(uv*17.-uTime*.025)*.3;
 col*=mix(1.,smoothstep(.12,.42,ink),uMirror*.7);
 col=aces(col*1.08);col=pow(col,vec3(1./2.2));
 float vignette=smoothstep(.18,.78,length((vUv-.5)*vec2(1.,.85)));col*=1.-vignette*.4;
 col+=(hash(vUv*uResolution+floor(uTime*24.))-.5)*.009*uMotion;
 col=mix(col,vec3(.83,.9,.91),smoothstep(.88,1.,uTravel));gl_FragColor=vec4(col,1.);
}`;

function disposeTree(tree){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 tree.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.source?.data?.close?.();t.dispose();}
}

export async function createDarkScene(canvas,{reduced=false,onContextLost=()=>{},signal}={}){
 // Exit cancels the download before allocating a WebGL context.
 const response=await fetch(new URL('./assets/dark/winden.glb',import.meta.url),{signal});
 if(!response.ok)throw Error('The Blender environment could not load');
 const data=await response.arrayBuffer();signal?.throwIfAborted();
 const loader=new GLTFLoader();
 // Ordinary image decoding respects the existing img-src blob: policy.
 loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:'WINDEN_DOM_IMAGE_LOADER'};});
 const gltf=await loader.parseAsync(data,'');
 if(signal?.aborted){disposeTree(gltf.scene);signal.throwIfAborted();}
 let renderer;
 try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){disposeTree(gltf.scene);throw e;}
 renderer.outputColorSpace=T.LinearSRGBColorSpace;renderer.toneMapping=T.NoToneMapping;renderer.setPixelRatio(1);renderer.info.autoReset=false;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.12,120);
 scene.background=new T.Color(0x080f13);scene.fog=new T.FogExp2(0x14242c,.035);scene.add(gltf.scene);
 gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material.map)o.material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());o.material.side=T.DoubleSide;}});
 const foliage=[];gltf.scene.traverse(o=>{if(o.isMesh&&o.material.name==='Foliage')foliage.push(o);if(o.isMesh&&o.material.name==='Passage'){o.material.fog=false;o.material.envMapIntensity=0;o.material.color.setRGB(.08,.075,.065);}});
 const hemi=new T.HemisphereLight(0xc5c9bd,0x29251c,1.15);scene.add(hemi);
 const moon=new T.DirectionalLight(0xd4d6cc,2.1);moon.position.set(-10,12,-1);moon.castShadow=true;
 moon.shadow.mapSize.set(1536,1536);Object.assign(moon.shadow.camera,{left:-16,right:16,top:17,bottom:-8,near:1,far:65});moon.shadow.bias=-.0002;moon.shadow.normalBias=.12;moon.target.position.set(0,2,-6);scene.add(moon,moon.target);
 const rim=new T.DirectionalLight(0xb5bfb7,.85);rim.position.set(7,10,-13);scene.add(rim);
 const caveLight=new T.PointLight(0x66cce8,38,13,2);caveLight.position.set(0,1.2,-7.5);scene.add(caveLight);
 // An unlit bend closes the distant tunnel against the bright forest background.
 // The time-travel transition replaces this darkness with the animated passage.
 const tunnelDarkness=new T.Mesh(new T.PlaneGeometry(12,7),new T.MeshBasicMaterial({color:0x020303,fog:false}));tunnelDarkness.position.set(0,1,-10.6);scene.add(tunnelDarkness);
 const torch=new T.SpotLight(0xdceaf1,55,32,.33,.8,2);scene.add(torch,torch.target);
 const lanternLight=new T.PointLight(0xffbc65,0,11,2);lanternLight.position.set(-2,1,-3);scene.add(lanternLight);
 // Original environment map supplies soft specular illumination to the wet stone.
 const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;const ec=envCanvas.getContext('2d');
 const gradient=ec.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#b9bdb2');gradient.addColorStop(.45,'#50554b');gradient.addColorStop(.65,'#1b2019');gradient.addColorStop(1,'#020303');ec.fillStyle=gradient;ec.fillRect(0,0,512,256);ec.fillStyle='#c6cec4';ec.beginPath();ec.ellipse(110,48,19,11,0,0,Math.PI*2);ec.fill();
 const envTexture=new T.CanvasTexture(envCanvas);envTexture.mapping=T.EquirectangularReflectionMapping;envTexture.colorSpace=T.SRGBColorSpace;
 const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(envTexture);scene.environment=environment.texture;scene.environmentIntensity=.35;envTexture.dispose();pmrem.dispose();
 // A continuous interlaced triquetra with a slender luminous core.
 class Knot extends T.Curve{getPoint(t,target=new T.Vector3()){const a=t*Math.PI*2;return target.set(Math.sin(a)+2*Math.sin(2*a),-Math.cos(a)+2*Math.cos(2*a),-.28*Math.sin(3*a)).multiplyScalar(.22);}}
 const symbol=new T.Group();symbol.position.set(0,1.15,-7.8);
 const knotGeo=new T.TubeGeometry(new Knot(),240,.018,8,true);
 const knotMat=new T.MeshBasicMaterial({color:new T.Color(.36,1.15,1.25)});symbol.add(new T.Mesh(knotGeo,knotMat));scene.add(symbol);
 const lantern=new T.Group();lantern.position.copy(lanternLight.position);const metal=new T.MeshStandardMaterial({color:0x4e4434,metalness:.85,roughness:.32});
 const lampGlass=new T.Mesh(new T.CylinderGeometry(.07,.085,.2,12),new T.MeshBasicMaterial({color:new T.Color(4,1.8,.4)}));lantern.add(lampGlass);
 for(const y of [-.14,.14]){const cap=new T.Mesh(new T.CylinderGeometry(.13,.12,.045,16),metal);cap.position.y=y;lantern.add(cap);}scene.add(lantern);
 const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;const fc=fogCanvas.getContext('2d'),fg=fc.createRadialGradient(64,64,2,64,64,64);fg.addColorStop(0,'rgba(180,209,216,.26)');fg.addColorStop(.45,'rgba(140,166,178,.1)');fg.addColorStop(1,'rgba(130,155,170,0)');fc.fillStyle=fg;fc.fillRect(0,0,128,128);
 const fogTexture=new T.CanvasTexture(fogCanvas),fogMat=new T.SpriteMaterial({map:fogTexture,color:0x9eb6c1,opacity:.18,transparent:true,depthWrite:false});const mists=[];
 for(let i=0;i<9;i++){const mist=new T.Sprite(fogMat);mist.position.set((i%3-1)*6,.3+i*.09,-2-i*2.5);mist.scale.set(13,2.1,1);scene.add(mist);mists.push(mist);}
 let seed=1921;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const pg=new T.BufferGeometry(),pos=new Float32Array(90*3),seeds=new Float32Array(90);for(let i=0;i<90;i++){pos.set([(random()-.5)*24,random()*5,-random()*18],i*3);seeds[i]=random()*100;}pg.setAttribute('position',new T.BufferAttribute(pos,3));pg.setAttribute('aSeed',new T.BufferAttribute(seeds,1));
 const particleMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uMotion:{value:1},uDead:{value:0},uColor:{value:new T.Color(0xc3cf91)}},vertexShader:`attribute float aSeed;uniform float uTime,uMotion,uDead;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.2+aSeed)*.22*uMotion;p.y+=sin(uTime*.4+aSeed)*.15*uMotion;if(uDead>.5)p.y=mod(p.y+uTime*.4*uMotion,6.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(32./-mv.z,1.,3.);vAlpha=.1+.7*pow(sin(uTime*.6*uMotion+aSeed)*.5+.5,4.);}`,fragmentShader:`uniform vec3 uColor;varying float vAlpha;void main(){gl_FragColor=vec4(uColor,(1.-smoothstep(.05,.5,length(gl_PointCoord-.5)))*vAlpha);}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending});scene.add(new T.Points(pg,particleMat));
 const rainGeo=new T.BufferGeometry(),rainPos=new Float32Array(430*6),rainEnds=new Float32Array(860);for(let i=0;i<430;i++){const x=(random()-.5)*26,y=random()*16,z=8-random()*25;rainPos.set([x,y,z,x-.012,y,z],i*6);rainEnds[i*2+1]=.12;}rainGeo.setAttribute('position',new T.BufferAttribute(rainPos,3));rainGeo.setAttribute('aEnd',new T.BufferAttribute(rainEnds,1));
 const rainMat=new T.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`attribute float aEnd;uniform float uTime;void main(){vec3 p=position;p.y=mod(p.y-uTime*7.,16.)+aEnd;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`void main(){gl_FragColor=vec4(.48,.62,.7,.065);}`,transparent:true,depthWrite:false});const rain=new T.LineSegments(rainGeo,rainMat);scene.add(rain);
 const rings=new T.Group(),ringGeo=new T.TorusGeometry(2.15,.012,5,70),ringMat=new T.MeshBasicMaterial({color:new T.Color(.22,.6,.8),transparent:true,opacity:.8});for(let i=0;i<34;i++){const ring=new T.Mesh(ringGeo,ringMat);ring.position.set(Math.sin(i*.4)*.16,2.1,-8-i*1.1);ring.rotation.z=i*.16;rings.add(ring);}scene.add(rings);rings.visible=false;
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:0});
 
 const postScene=new T.Scene(),postCamera=new T.Camera(),postMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{tScene:{value:target.texture},uResolution:{value:new T.Vector2(1,1)},uTime:{value:0},uMirror:{value:0},uGlitch:{value:0},uTravel:{value:0},uMotion:{value:1}},depthTest:false,depthWrite:false});postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),postMat));
 const ray=new T.Raycaster(),pointer=new T.Vector2(),clickPlane=new T.Mesh(new T.PlaneGeometry(5.2,3),new T.MeshBasicMaterial({visible:false}));clickPlane.position.set(0,1.1,-8);scene.add(clickPlane);
 const knotPick=new T.Mesh(new T.SphereGeometry(.72,12,8),new T.MeshBasicMaterial({visible:false}));knotPick.position.copy(symbol.position);scene.add(knotPick);
 let width=1,height=1,scale=Math.min(devicePixelRatio||1,1.3),disposed=false,era=3,frames=0,slow=0,fast=0;
 const palettes=[{fog:0x22221c,moon:0xe4c697,sky:0x111410},{fog:0x28302a,moon:0xf1d5a5,sky:0x101816},{fog:0x171b2c,moon:0xbab5ed,sky:0x070b17},{fog:0x62685e,moon:0xd1d8cf,sky:0x73796f},{fog:0x38261c,moon:0xf1ae69,sky:0x1a100b}];
 function resize(w,h){width=w;height=h;renderer.setSize(w,h,false);target.setSize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));postMat.uniforms.uResolution.value.set(target.width,target.height);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function setEra(index){era=index;const e=palettes[index];scene.background.set(e.sky);scene.fog.color.set(e.fog);scene.fog.density=index===4?.035:.022;moon.color.set(e.moon);for(const o of foliage)o.visible=index!==4;lantern.visible=index===0;particleMat.uniforms.uDead.value=index===4?1:0;particleMat.uniforms.uColor.value.set(index===4?0xfdb26b:0xc3cf91);scene.environmentIntensity=index===4?.25:.35;renderer.shadowMap.needsUpdate=true;}
 setEra(3);
 const lost=e=>{e.preventDefault();onContextLost();};canvas.addEventListener('webglcontextlost',lost);
 function render({time,dt,mode,introTime=0,travel=0,mouseX=0,mouseY=0,rotationX=0,rotationY=0,glitch=0,motion=true,hover='',zoom=0,flashlight=true}){
  if(disposed)return;const animate=motion&&!reduced,intro=mode==='intro',flying=mode==='travel';let x=animate?mouseX*.42:0,y=3.8-(animate?mouseY*.18:0),z=(width<height?14.5:10)-zoom;
  if(intro&&animate){x=Math.sin(introTime*.07)*1.25;y=3.8;z=10-introTime*.06;}
  if(flying){x=0;y=1.3;z=T.MathUtils.lerp(z,-34,T.MathUtils.smoothstep(travel,0,1));}
  camera.position.set(x,y,z);camera.lookAt(0,flying?1.3:2,flying?-48:-8);
  torch.position.copy(camera.position);pointer.set(mouseX,-mouseY);ray.setFromCamera(pointer,camera);torch.target.position.copy(camera.position).addScaledVector(ray.ray.direction,22);torch.intensity=flashlight?(hover==='cave'?95:65):0;
  symbol.rotation.set(rotationX,rotationY,0);symbol.position.y=1.15+(animate?Math.sin(time*.6)*.025:0);symbol.visible=!flying||travel<.18;
  caveLight.intensity=(hover==='knot'?4:2)+(animate?Math.sin(time*.8)*.15:0);lanternLight.intensity=era===0?12+(animate?Math.sin(time*11)*.35:0):0;
  rain.visible=era!==4&&animate;rainMat.uniforms.uTime.value=time;particleMat.uniforms.uTime.value=time;particleMat.uniforms.uMotion.value=animate?1:0;
  rings.visible=flying;tunnelDarkness.visible=!flying;
  if(animate)for(let i=0;i<mists.length;i++)mists[i].position.x+=Math.sin(time*.07+i)*dt*.035;
  const u=postMat.uniforms;u.uTime.value=animate?time:0;u.uMotion.value=animate?1:0;u.uMirror.value=intro?1-T.MathUtils.smoothstep(introTime,29,35):0;u.uGlitch.value=animate?glitch:0;u.uTravel.value=flying?travel:0;
  renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);frames++;
  if(frames>90&&animate){slow=dt>.0185?slow+1:Math.max(0,slow-1);fast=dt<.0135?fast+1:0;if(slow>35&&scale>.65){scale=Math.max(.65,scale*.82);resize(width,height);slow=0;}else if(fast>360&&scale<1.25){scale=Math.min(1.25,scale*1.08);resize(width,height);fast=0;}}
 }
 return {resize,setEra,render,setReduced(v){reduced=v;},hitTest(x,y){pointer.set(x,y);ray.setFromCamera(pointer,camera);return ray.intersectObject(knotPick).length?'knot':ray.intersectObject(clickPlane).length?'cave':null;},stats:()=>({asset:'Blender / winden.glb',calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,resolutionScale:scale,frames}),dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);disposeTree(scene);disposeTree(postScene);environment.dispose();target.dispose();moon.shadow.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
