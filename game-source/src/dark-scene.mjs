import * as T from 'three';
import {ERAS} from './dark-config.mjs';
import {loadBlenderCave} from './dark-cave.mjs';
import {forestTexture,shadeForestGround} from './dark-surfaces.mjs';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment=`
precision highp float;
uniform sampler2D tScene;uniform vec2 uResolution;uniform float uTime,uMirror,uGlitch,uTravel,uMotion,uInk,uRipple;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){
 vec2 uv=vUv;
 float radius=length((uv-.5)*vec2(uResolution.x/uResolution.y,1.));
 float wave=sin(radius*65.-(1.-uRipple)*18.)*exp(-pow((radius-(1.-uRipple)*.65)*12.,2.))*uRipple*.003*uMotion;
 uv+=normalize(uv-.5+vec2(.0001))*wave;
 if(uMirror>0.){vec2 p=uv-.5;float r=length(p);float a=atan(p.y,p.x)+uTime*.035;float wedge=3.14159265/3.;a=abs(mod(a,wedge*2.)-wedge);vec2 k=vec2(cos(a),sin(a))*r;vec2 mirrored=abs(fract(k*1.5+vec2(.0,uTime*.008))-.5)*1.65+.06;uv=mix(uv,mirrored,uMirror);}
 uv.x+=sin(uv.y*110.+uTime*20.)*uGlitch*.015;
 float split=(.0007+uGlitch*.005)*uMotion;vec3 col=vec3(texture2D(tScene,uv+vec2(split,0)).r,texture2D(tScene,uv).g,texture2D(tScene,uv-vec2(split,0)).b);
 vec3 glow=vec3(0.);vec2 px=1./uResolution;
 for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a));vec3 b=texture2D(tScene,uv+d*px*5.).rgb;glow+=max(b-vec3(.65),vec3(0.));vec3 c=texture2D(tScene,uv+d*px*13.).rgb;glow+=max(c-vec3(.7),vec3(0.))*.6;}
 col+=glow*.085;
 float ink=noise(uv*6.+uTime*.08)*.65+noise(uv*17.-uTime*.04)*.35;col*=mix(1.,smoothstep(uInk-.3,uInk+.1,ink),uMirror*.65);
 col=col/(col+vec3(1.));col=pow(max(col,vec3(0.)),vec3(1./2.2));
 float vig=1.-smoothstep(.25,.76,length((vUv-.5)*vec2(1.,.92)));col*=mix(.67,1.,vig);
 col+=(hash(vUv*uResolution+floor(uTime*24.))-.5)*.026*uMotion;
 col=mix(col,vec3(.72,.88,1.),smoothstep(.88,1.,uTravel)*.85);
 gl_FragColor=vec4(col,1.);
}`;

export async function createDarkScene(canvas,{reduced=false,onContextLost=()=>{},signal,onProgress=()=>{}}={}){
 let blenderCave=null,caveError='';
 try{blenderCave=await loadBlenderCave({signal,onProgress});}catch(error){if(signal?.aborted)throw error;caveError=error.message;console.warn('Blender cave unavailable; using the original 3D cave:',error.message);}
 let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});}catch(error){blenderCave?.dispose();throw error;}
 renderer.outputColorSpace=T.LinearSRGBColorSpace;renderer.setPixelRatio(1);renderer.info.autoReset=false;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(52,1,.1,110);camera.position.set(0,2.15,9);
 scene.background=new T.Color(ERAS[3].sky);scene.fog=new T.FogExp2(ERAS[3].fog,ERAS[3].density);
 const hemi=new T.HemisphereLight(0xbecbd0,0x37312b,1.05);scene.add(hemi);
 const moon=new T.DirectionalLight(0xd5dfe0,3.1);moon.position.set(-9,11,-2);scene.add(moon);
 const rim=new T.DirectionalLight(0xa3b8be,.7);rim.position.set(8,6,-14);scene.add(rim);
 const caveLight=new T.PointLight(0x3abce7,28,16,1.2);caveLight.position.set(0,2.8,-5);scene.add(caveLight);
 const torch=new T.SpotLight(0xe2f6ff,24,35,Math.PI/7,.7,1.4);torch.position.copy(camera.position);scene.add(torch,torch.target);
 const lanternLight=new T.PointLight(0xffbe68,0,12,1.4);lanternLight.position.set(-3,1.5,-1.5);scene.add(lanternLight);
 const rockMat=new T.MeshLambertMaterial({color:ERAS[3].rock});
 const barkTexture=forestTexture('bark'),groundTexture=forestTexture('soil');
 const barkMat=new T.MeshStandardMaterial({color:0x51483e,map:barkTexture,bumpMap:barkTexture,bumpScale:.085,roughness:.96});
 const needleCanvas=document.createElement('canvas');needleCanvas.width=128;needleCanvas.height=256;const nc=needleCanvas.getContext('2d');nc.strokeStyle='#d4dfd8';nc.lineCap='round';
 for(let j=0;j<60;j++){const y=15+j*3.8,width=(y/256)*56;for(const side of [-1,1]){nc.lineWidth=1.5;nc.beginPath();nc.moveTo(64,y-8);nc.lineTo(64+side*width,y+15);nc.stroke();for(let k=0;k<11;k++){const x=64+side*width*k/11,by=y-8+23*k/11;nc.lineWidth=.9;nc.beginPath();nc.moveTo(x,by);nc.lineTo(x+side*6,by-10);nc.moveTo(x,by);nc.lineTo(x+side*4,by+12);nc.stroke();}}}const needleTexture=new T.CanvasTexture(needleCanvas);
 const leafMat=new T.MeshLambertMaterial({color:ERAS[3].leaf,map:needleTexture,alphaTest:.18,side:T.DoubleSide});
 const groundMat=new T.MeshStandardMaterial({color:0xc0b6a1,map:groundTexture,bumpMap:groundTexture,bumpScale:.12,roughness:.82,vertexColors:true});
 const stoneCanvas=document.createElement('canvas');stoneCanvas.width=stoneCanvas.height=256;const sc=stoneCanvas.getContext('2d'),pixels=sc.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const n=Math.sin(x*12.9898+y*78.233)*43758.5453,n2=Math.sin(x*.07+y*.045+Math.sin(y*.1)*2),v=85+(n-Math.floor(n))*70+n2*28;const i=(y*256+x)*4;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;}sc.putImageData(pixels,0,0);const stoneTexture=new T.CanvasTexture(stoneCanvas);stoneTexture.wrapS=stoneTexture.wrapT=T.RepeatWrapping;stoneTexture.repeat.set(2,2);rockMat.map=stoneTexture;rockMat.bumpMap=stoneTexture;rockMat.bumpScale=.12;rockMat.flatShading=true;
 const groundGeo=new T.PlaneGeometry(110,110,160,160);groundGeo.rotateX(-Math.PI/2);
 const ga=groundGeo.attributes.position;for(let i=0;i<ga.count;i++){const x=ga.getX(i),z=ga.getZ(i);ga.setY(i,Math.sin(x*.9)*Math.cos(z*.7)*.12+Math.sin(x*2.7+z)*.06);}groundGeo.computeVertexNormals();shadeForestGround(groundGeo);scene.add(new T.Mesh(groundGeo,groundMat));
 let seed=419;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),rockGeo=new T.IcosahedronGeometry(1,2);const rp=rockGeo.attributes.position;for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),k=1+.1*Math.sin(x*7+y*11+z*5)+.07*Math.cos(y*8-z*6);rp.setXYZ(i,x*k,y*k,z*k);}rockGeo.computeVertexNormals();
 // A deep, hollow passage framed by irregular limestone, not a textured picture.
 const cave=new T.Group();scene.add(cave);
 const caveDark=new T.Mesh(new T.CircleGeometry(2.8,40),new T.MeshBasicMaterial({color:0x010509}));caveDark.position.set(0,2.3,-10);caveDark.scale.y=1.15;cave.add(caveDark);
 const rocks=new T.InstancedMesh(rockGeo,rockMat,108);let ri=0;
 for(let layer=0;layer<3;layer++)for(let j=0;j<24;j++){
  const a=j/23*Math.PI,r=3.9+layer*.82;dummy.position.set(Math.cos(a)*r,Math.sin(a)*r*.95-.1,-6.5-layer*.85+(random()-.5)*.6);
  dummy.scale.set(1.1+random()*.5,.65+random()*.8,.9+random());dummy.rotation.set(random()*2,random()*2,random()*2);dummy.updateMatrix();rocks.setMatrixAt(ri++,dummy.matrix);
 }
 for(let j=0;j<36;j++){const side=j%2?1:-1;dummy.position.set(side*(5.5+random()*8),random()*2,-5-random()*10);dummy.scale.set(1+random()*2,.6+random()*2,1+random()*2);dummy.rotation.set(random(),random()*3,random());dummy.updateMatrix();rocks.setMatrixAt(ri++,dummy.matrix);}cave.add(rocks);
 // Keep all RNG calls above so every existing tree and particle stays in place.
 // Replace only the entrance arch; retain the original surrounding boulders.
 if(blenderCave){for(let i=0;i<36;i++){rocks.getMatrixAt(i+72,dummy.matrix);rocks.setMatrixAt(i,dummy.matrix);}rocks.count=36;rocks.instanceMatrix.needsUpdate=true;caveDark.position.z=-34;cave.add(blenderCave.root);}
 const tunnel=new T.Mesh(new T.CylinderGeometry(2.5,2.6,28,24,1,true),new T.MeshLambertMaterial({color:0x193039,side:T.BackSide}));tunnel.rotation.x=Math.PI/2;tunnel.position.set(0,2.4,-22);cave.add(tunnel);
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.12,.38,1,16,8),barkMat,95);
 const branches=new T.InstancedMesh(new T.CylinderGeometry(.025,.095,1,8),barkMat,380);
 const leaves=new T.InstancedMesh(new T.PlaneGeometry(1,1),leafMat,285);
 const up=new T.Vector3(0,1,0),dir=new T.Vector3();
 for(let i=0;i<95;i++){
  const side=i%2?1:-1,x=side*(4.5+random()*25),z=5-random()*55,height=8+random()*13;
  dummy.position.set(x,height/2,z);dummy.scale.set(1+random()*.8,height,1+random()*.8);dummy.rotation.set(0,random()*6,(random()-.5)*.07);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<4;j++){const a=random()*6.28,len=1.7+random()*2.3;dir.set(Math.cos(a),.5,Math.sin(a)).normalize();dummy.position.set(x+dir.x*len*.5,height*(.38+j*.14),z+dir.z*len*.5);dummy.quaternion.setFromUnitVectors(up,dir);dummy.scale.set(1,len,1);dummy.updateMatrix();branches.setMatrixAt(i*4+j,dummy.matrix);}
  for(let j=0;j<3;j++){dummy.position.set(x,height*(.66+j*.12),z);dummy.rotation.set(0,j*Math.PI/3+random()*.25,0);dummy.scale.set(5.6-j*.7,7-j*.8,1);dummy.updateMatrix();leaves.setMatrixAt(i*3+j,dummy.matrix);}
 }
 scene.add(trunks,branches,leaves);
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;const cc=contactCanvas.getContext('2d'),cg=cc.createRadialGradient(32,32,0,32,32,32);cg.addColorStop(0,'rgba(0,0,0,.6)');cg.addColorStop(.45,'rgba(0,0,0,.28)');cg.addColorStop(1,'rgba(0,0,0,0)');cc.fillStyle=cg;cc.fillRect(0,0,64,64);
 const contactTexture=new T.CanvasTexture(contactCanvas),contactGeometry=new T.PlaneGeometry(1,1);contactGeometry.rotateX(-Math.PI/2);const contactMaterial=new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const contacts=new T.InstancedMesh(contactGeometry,contactMaterial,130);scene.add(contacts);
 const groundHeight=(x,z)=>Math.sin(x*.9)*Math.cos(z*.7)*.12+Math.sin(x*2.7+z)*.06;
 const stones=new T.InstancedMesh(rockGeo,rockMat,130);for(let i=0;i<130;i++){dummy.position.set((random()-.5)*35,.1,8-random()*35);dummy.rotation.set(random(),random()*3,random());const scale=.05+random()*.4;dummy.position.y=groundHeight(dummy.position.x,dummy.position.z)+scale*.16;dummy.scale.set(scale*1.8,scale*.5,scale);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);dummy.position.y=groundHeight(dummy.position.x,dummy.position.z)+.012;dummy.rotation.set(0,0,0);dummy.scale.set(scale*5,1,scale*3);dummy.updateMatrix();contacts.setMatrixAt(i,dummy.matrix);}scene.add(stones);
 // Three interwoven lobes with depth: an original mathematical triquetra.
 const symbol=new T.Group();symbol.position.set(0,2.3,-4.2);const glowMat=new T.MeshBasicMaterial({color:new T.Color(0x49cfff).multiplyScalar(1.8)});
 for(let lobe=0;lobe<3;lobe++){
  const points=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2,angle=lobe*Math.PI*2/3;const x=Math.sin(t)*.46,y=.43+Math.cos(t)*.78;points.push(new T.Vector3(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),Math.sin(t*2+lobe)*.07));}
  symbol.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),100,.024,5,true),glowMat));
 }
 scene.add(symbol);
 const lantern=new T.Group();lantern.position.copy(lanternLight.position);lantern.add(new T.Mesh(new T.CylinderGeometry(.13,.16,.34,8),new T.MeshBasicMaterial({color:0xffc271})));
 const cap=new T.Mesh(new T.ConeGeometry(.23,.15,8),barkMat);cap.position.y=.24;lantern.add(cap);const ring=new T.Mesh(new T.TorusGeometry(.19,.02,4,12),barkMat);ring.position.y=.4;lantern.add(ring);scene.add(lantern);lantern.visible=false;
 // Fog is generated in code; a shared radial texture supplies soft volumetric layers.
 const mistCanvas=document.createElement('canvas');mistCanvas.width=mistCanvas.height=64;const mc=mistCanvas.getContext('2d'),grad=mc.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(180,207,219,.24)');grad.addColorStop(.5,'rgba(130,162,173,.10)');grad.addColorStop(1,'rgba(130,162,173,0)');mc.fillStyle=grad;mc.fillRect(0,0,64,64);
 const mistTexture=new T.CanvasTexture(mistCanvas),mistMat=new T.SpriteMaterial({map:mistTexture,color:0x91b5c4,transparent:true,opacity:.22,depthWrite:false});const mists=[];
 for(let i=0;i<12;i++){const s=new T.Sprite(mistMat);s.position.set((random()-.5)*30,.8+random()*1.5,-2-random()*25);s.scale.set(14+random()*8,3.5,1);scene.add(s);mists.push(s);}
 const particleGeo=new T.BufferGeometry(),positions=new Float32Array(190*3),seeds=new Float32Array(190);for(let i=0;i<190;i++){positions.set([(random()-.5)*26,random()*7,-random()*22],i*3);seeds[i]=random()*100;}
 particleGeo.setAttribute('position',new T.BufferAttribute(positions,3));particleGeo.setAttribute('aSeed',new T.BufferAttribute(seeds,1));
 const particleMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uDead:{value:0},uColor:{value:new T.Color(0xc8b78b)},uMotion:{value:reduced?0:1}},vertexShader:`attribute float aSeed;uniform float uTime,uDead,uMotion;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.3+aSeed)*.3*uMotion;p.y+=sin(uTime*.45+aSeed)*.25*uMotion;if(uDead>.5)p.y=mod(position.y+uTime*.55*uMotion,8.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(36./-mv.z,1.,5.);vAlpha=.3+.65*pow(sin(uTime*.7*uMotion+aSeed)*.5+.5,3.);}`,fragmentShader:`uniform vec3 uColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(uColor,(1.-smoothstep(.05,.5,d))*vAlpha);}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending});scene.add(new T.Points(particleGeo,particleMat));
 const rainGeo=new T.BufferGeometry(),rainPos=new Float32Array(700*6);for(let i=0;i<700;i++){const x=(random()-.5)*30,y=random()*18,z=7-random()*27;rainPos.set([x,y,z,x-.045,y+.38,z],i*6);}rainGeo.setAttribute('position',new T.BufferAttribute(rainPos,3));
 const rainMat=new T.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`uniform float uTime;void main(){vec3 p=position;p.y=mod(p.y-uTime*9.,18.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`void main(){gl_FragColor=vec4(.55,.71,.77,.12);}`,transparent:true,depthWrite:false});const rain=new T.LineSegments(rainGeo,rainMat);scene.add(rain);
 const tunnelRings=new T.Group(),ringMat=new T.MeshBasicMaterial({color:0x238bbb,transparent:true,opacity:.7});for(let i=0;i<32;i++){const ring=new T.Mesh(new T.TorusGeometry(2.2,.024,4,48),ringMat);ring.position.set(Math.sin(i*.3)*.22,2.4,-9-i*1.05);ring.rotation.z=i*.08;tunnelRings.add(ring);}scene.add(tunnelRings);tunnelRings.visible=false;
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});const postScene=new T.Scene(),postCamera=new T.Camera();
 const postMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{tScene:{value:target.texture},uResolution:{value:new T.Vector2(1,1)},uTime:{value:0},uMirror:{value:0},uGlitch:{value:0},uTravel:{value:0},uMotion:{value:reduced?0:1},uInk:{value:.35},uRipple:{value:0}},depthTest:false,depthWrite:false});const quad=new T.Mesh(new T.PlaneGeometry(2,2),postMat);postScene.add(quad);
 let width=1,height=1,scale=Math.min(globalThis.devicePixelRatio||1,1.45),disposed=false,lastEra=3,frameCount=0,slow=0,fast=0;const look=new T.Vector3(0,2.4,-7),ray=new T.Raycaster(),pointer=new T.Vector2();
 const clickPlane=new T.Mesh(new T.PlaneGeometry(5.1,5.5),new T.MeshBasicMaterial({visible:false}));clickPlane.position.set(0,2.6,-5.6);scene.add(clickPlane);
 const knotPick=new T.Mesh(new T.SphereGeometry(1.25,16,12),new T.MeshBasicMaterial({visible:false}));knotPick.position.copy(symbol.position);scene.add(knotPick);
 function resize(w,h){width=w;height=h;renderer.setPixelRatio(scale);renderer.setSize(w,h,false);target.setSize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));postMat.uniforms.uResolution.value.set(target.width,target.height);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const eraTarget={sky:new T.Color(),fog:new T.Color(),rock:new T.Color(),ground:new T.Color(),leaf:new T.Color(),light:new T.Color(),cave:new T.Color(),density:0};
 let eraInitialized=false;
 function setEra(index){lastEra=index;const e=ERAS[index];for(const key of ['sky','fog','rock','leaf','light'])eraTarget[key].set(e[key]);eraTarget.ground.set(e.ground).lerp(new T.Color(0xe0d5c1),.65);eraTarget.density=e.density;
  const tint=eraTarget.cave.set(e.rock);tint.multiplyScalar(1/Math.max(tint.r,tint.g,tint.b));tint.lerp(new T.Color(0xffffff),.55).multiplyScalar(.9);
  leaves.visible=index!==4;rain.visible=index!==4&&!reduced;lantern.visible=index===0;lanternLight.intensity=index===0?8:0;particleMat.uniforms.uDead.value=index===4?1:0;particleMat.uniforms.uColor.value.set(index===4?0xe8a467:0xc8b78b);mistMat.color.set(index===4?0xbb977a:0xb3c0bc);
  if(!eraInitialized||reduced){blendEra(1);eraInitialized=true;}
 }
 function blendEra(t){scene.background.lerp(eraTarget.sky,t);scene.fog.color.lerp(eraTarget.fog,t);scene.fog.density=T.MathUtils.lerp(scene.fog.density,eraTarget.density,t);rockMat.color.lerp(eraTarget.rock,t);groundMat.color.lerp(eraTarget.ground,t);leafMat.color.lerp(eraTarget.leaf,t);moon.color.lerp(eraTarget.light,t);if(blenderCave)for(const m of blenderCave.materials)m.color.lerp(eraTarget.cave,t);}

 setEra(3);
 const contextLost=e=>{e.preventDefault();onContextLost();};canvas.addEventListener('webglcontextlost',contextLost);
 function render({time,dt,mode,introTime=0,travel=0,mouseX=0,mouseY=0,rotationX=0,rotationY=0,glitch=0,motion=true,zoom=0,flashlight=true,ripple=0}){
  if(disposed)return;const animate=motion&&!reduced;blendEra(animate?1-Math.exp(-dt*4):1);
  if(!animate){rain.visible=false;postMat.uniforms.uMotion.value=0;}else {rain.visible=lastEra!==4;postMat.uniforms.uMotion.value=1;}
  particleMat.uniforms.uMotion.value=animate?1:0;
  const intro=mode==='intro',flying=mode==='travel';let cx=mouseX*.55,cy=2.15-mouseY*.22,cz=width<height?10.6:9;
  if(intro&&animate){cx=Math.sin(introTime*.15)*1.8;cy=2.5+Math.sin(introTime*.1)*.5;cz=9-introTime*.075;}
  if(flying){cx=0;cy=2.4;cz=T.MathUtils.lerp(width<height?10.6-zoom:9-zoom,-33,T.MathUtils.smoothstep(travel,0,1));}
  if(!animate){cx=0;cy=2.15;}
  if(!intro&&!flying)cz-=zoom;
  // The Blender passage supplies the visible interior. Keep the original long
  // tunnel for the deep wormhole flight, beyond the entrance, without its rim.
  tunnel.visible=!blenderCave||(flying&&cz<-12);
  if(blenderCave){const opacity=flying?1-T.MathUtils.smoothstep(travel,.36,.55):1;blenderCave.root.visible=opacity>.001;for(const m of blenderCave.materials){m.opacity=opacity;m.depthWrite=opacity>.95;}}
  camera.position.set(cx,cy,cz);look.set(0,2.5,flying?-48:-7);camera.lookAt(look);camera.updateMatrixWorld();torch.position.copy(camera.position);torch.target.position.set(mouseX*5,2.6-mouseY*3,-6);torch.intensity=flashlight?(intro?5:14):0;
  symbol.rotation.y=rotationY;symbol.rotation.x=rotationX;symbol.position.y=2.3+(animate?Math.sin(time*.7)*.055:0);symbol.visible=!flying||travel<.2;knotPick.position.copy(symbol.position);
  caveLight.intensity=7+(animate?Math.sin(time*1.7)*.7:0);lanternLight.intensity=lastEra===0?8+(animate?Math.sin(time*13)*.55:0):0;
  if(animate)for(let i=0;i<mists.length;i++)mists[i].position.x+=Math.sin(time*.1+i)*dt*.1;
  rainMat.uniforms.uTime.value=time;particleMat.uniforms.uTime.value=time;tunnelRings.visible=flying;
  const u=postMat.uniforms;u.uTime.value=animate?time:0;u.uRipple.value=animate?ripple:0;u.uMirror.value=intro?1-T.MathUtils.smoothstep(introTime,29,35):0;u.uGlitch.value=animate?glitch:0;u.uTravel.value=flying?travel:0;u.uInk.value=.18+Math.sin(introTime*.45)*.15;
  renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);frameCount++;
  // Reduce fragment cost before sacrificing animation rate on slower GPUs.
  if(frameCount>90&&animate){slow=dt>.023?slow+1:Math.max(0,slow-1);fast=dt<.018?fast+1:0;if(slow>50&&scale>.65){scale=Math.max(.65,scale*.82);resize(width,height);slow=0;}else if(fast>360&&scale<1.2){scale=Math.min(1.2,scale*1.08);resize(width,height);fast=0;}}
 }
 return {resize,setEra,render,setReduced(value){reduced=value;},hitTest(x,y){pointer.set(x,y);ray.setFromCamera(pointer,camera);return ray.intersectObject(knotPick).length?'knot':ray.intersectObject(clickPlane).length?'cave':null;},stats:()=>({asset:blenderCave?'Original Winden + Blender cave':'Original procedural Winden',cave:blenderCave?.info??{fallback:true,error:caveError},calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,resolutionScale:scale,frames:frameCount}),dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',contextLost);const geometries=new Set(),materials=new Set(),textures=new Set([mistTexture]);for(const tree of [scene,postScene])tree.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.source.data?.close?.();}target.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
