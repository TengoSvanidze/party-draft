import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';

function disposeModel(root) {
 const geometry=new Set(),materials=new Set(),textures=new Set();
 root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.source.data?.close?.();}
}

// TextureLoader uses CSP-approved blob images instead of ImageBitmap's fetch path.
// The GLBs embed their textures; the mesh decoder is bundled on this same site.
export async function loadBlenderCave({signal,onProgress=()=>{}}={}) {
 const mobile=matchMedia('(max-width: 700px)').matches;
 const file=mobile?'winden-cave-mobile.glb':'winden-cave.glb';
 const url=new URL('./assets/dark/'+file+'?v=1',import.meta.url);
 const controller=new AbortController();
 const abort=()=>controller.abort(signal.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(()=>controller.abort(new Error('Cave loading timed out')),45000);
 let root;
 try {
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error('Cave model returned '+response.status);
  const total=Number(response.headers.get('content-length'))||0;
  let buffer;
  if(response.body){
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress({loaded,total});}
   const data=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}buffer=data.buffer;
  }else buffer=await response.arrayBuffer();
  controller.signal.throwIfAborted();
  const loader=new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:'WINDEN_CSP_TEXTURE_LOADER'};});
  const gltf=await loader.parseAsync(buffer,new URL('.',url).href);
  root=gltf.scene;controller.signal.throwIfAborted();
  const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
  if(bounds.isEmpty()||!Number.isFinite(size.length()))throw Error('Cave model has no usable geometry');
  const mouth=root.getObjectByName('CaveMouth'),floor=root.getObjectByName('CaveFloor'),roof=root.getObjectByName('CaveRoof');
  const base=floor?floor.getWorldPosition(new T.Vector3()):new T.Vector3(bounds.getCenter(new T.Vector3()).x,bounds.min.y,bounds.max.z);
  const openingHeight=roof?roof.getWorldPosition(new T.Vector3()).y-base.y:size.y*.55;
  const scale=T.MathUtils.clamp(4.7/openingHeight,.1,10);
  root.name='Blender cave entrance';root.scale.setScalar(scale);
  // Y-up glTF faces +Z, matching the existing camera. Anchor the opening rather
  // than the centre of the asymmetrical rock wall; the original camera stays put.
  root.position.set(-base.x*scale,-base.y*scale,-6.5-base.z*scale);
  root.updateMatrixWorld(true);
  const caveMaterials=new Set();let triangles=0;
  root.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
   for(const m of (Array.isArray(o.material)?o.material:[o.material])){caveMaterials.add(m);m.transparent=true;m.forceSinglePass=true;if(m.map)m.map.anisotropy=4;if(m.normalMap)m.normalScale.setScalar(.7);}
  });
  return {root,materials:caveMaterials,info:{file,bytes:buffer.byteLength,triangles,up:'+Y',mouth:!!mouth,source:'winden-soft-contact.blend'},dispose:()=>disposeModel(root)};
 }catch(error){if(root)disposeModel(root);throw error;}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
