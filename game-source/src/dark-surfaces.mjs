import * as T from 'three';

// Original seamless surface relief. These augment the procedural forest;
// the Blender cave retains its baked photo textures.
export function forestTexture(kind){
 const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size);
 const hash=(x,y,n)=>{const v=Math.sin(((x%n+n)%n)*127.1+((y%n+n)%n)*311.7)*43758.5453;return v-Math.floor(v);};
 const noise=(x,y,n)=>{const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy,n),hash(ix+1,iy,n),a),T.MathUtils.lerp(hash(ix,iy+1,n),hash(ix+1,iy+1,n),a),b);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
  const grain=Math.sin(x*127.1+y*311.7)*43758.5453%1;
  const broad=Math.sin(u*3+Math.sin(v*2))*Math.cos(v*4+Math.sin(u));
  const ridge=Math.pow(Math.abs(Math.sin(u*23+Math.sin(v*3)*.8+Math.sin(v*11)*.18)),.3);
  const soil=noise(x/size*8,y/size*8,8)*65+noise(x/size*32,y/size*32,32)*40+noise(x/size*128,y/size*128,128)*24;
  const val=kind==='bark'?35+ridge*145+broad*22+grain*12:48+soil+grain*14;
  const i=(y*size+x)*4;img.data[i]=val;img.data[i+1]=val;img.data[i+2]=val;img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(kind==='bark'?1:26,kind==='bark'?5:26);texture.anisotropy=4;return texture;
}

export function shadeForestGround(geometry){
 const positions=geometry.attributes.position,colors=[];
 const moss=new T.Color('#55594b'),soil=new T.Color('#938473'),c=new T.Color();
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i),path=1-T.MathUtils.smoothstep(Math.abs(x+Math.sin(z*.2)*.35),1.2,4.2);
  const patch=Math.sin(x*1.3+z*.4)*Math.cos(z*.9-x*.3)*.1;
  const caveShadow=1-.36*(1-T.MathUtils.smoothstep(Math.abs(x),1,5))*(1-T.MathUtils.smoothstep(Math.abs(z+7),0,5));
  c.copy(moss).lerp(soil,T.MathUtils.clamp(path+patch,0,1)).multiplyScalar(caveShadow);colors.push(c.r,c.g,c.b);
 }
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
}
