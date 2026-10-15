import * as THREE from 'three';
import {DarkAudio} from './dark-audio.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);

// Camera-projected geometry preserves the final Cycles lighting on mobile.
// Positions come from surface raycasts in the actual finished Blender scene.
export function depthGeometry(meta, depths) {
  const {width, height, halfX, halfY, units} = meta;
  const positions = new Float32Array(width * height * 3), indices = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, d = depths[i] * units;
    positions.set([(x / (width - 1) * 2 - 1) * halfX * d,
      (1 - y / (height - 1) * 2) * halfY * d, -d], i * 3);
  }
  const add = (a, b, c) => {
    const near = Math.min(depths[a], depths[b], depths[c]) * units;
    const far = Math.max(depths[a], depths[b], depths[c]) * units;
    // Do not stretch foreground bark across the distant forest at silhouettes.
    if (far - near < 1.4 || far / near < 1.22) indices.push(a, b, c);
  };
  // Refine depth boundaries at full resolution; spend fewer triangles on flat soil.
  for (let y = 0; y < height - 1; y += 2) for (let x = 0; x < width - 1; x += 2) {
    const right = Math.min(x + 2, width - 1), bottom = Math.min(y + 2, height - 1);
    const a = y * width + x, b = y * width + right, c = bottom * width + x, d = bottom * width + right;
    const samples = [a,b,c,d,(y+1)*width+x,(y+1)*width+right,y*width+x+1,bottom*width+x+1,(y+1)*width+x+1];
    const span = (Math.max(...samples.map(i=>depths[i])) - Math.min(...samples.map(i=>depths[i]))) * units;
    if (span < .42) {add(a,c,b);add(b,c,d);}
    else for (let row = y; row < bottom; row++) for (let col = x; col < right; col++) {
      const p = row * width + col, q = p + 1, r = p + width, s = r + 1;
      add(p,r,q);add(q,r,s);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

const forestVertex = `varying vec3 point;
void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const forestFragment = `uniform sampler2D photo; uniform vec2 halfFrame;
uniform vec2 cursor; uniform float light; uniform float seconds; varying vec3 point;
void main(){
 vec2 uv=.5+point.xy/(-point.z*halfFrame)*.5;
 vec3 col=texture2D(photo,clamp(uv,vec2(.001),vec2(.999))).rgb;
 float grey=dot(col,vec3(.2126,.7152,.0722));
 col=mix(vec3(grey),col,.55)*vec3(.99,1.,1.035);
 float beam=exp(-pow(length((uv-cursor)*vec2(1.78,1.)),2.)*85.);
 col+=vec3(.16,.135,.075)*beam*light;
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
 col+=grain*.009;
 gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`;
const tunnelVertex = `varying vec2 tunnelUV;void main(){tunnelUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const tunnelFragment = `uniform float seconds; varying vec2 tunnelUV;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 uv=tunnelUV; float angle=uv.y*6.2831853;
 float stone=noise(vec2(uv.x*110.+sin(angle)*11.,cos(angle)*14.));
 float detail=noise(vec2(uv.x*570.+sin(angle)*55.,cos(angle)*83.));
 float veins=pow(max(0.,1.-abs(sin(angle*11.+sin(uv.x*145.)*1.8+stone*5.))),22.);
 float pulse=.48+.35*sin(uv.x*24.-seconds*2.);
 vec3 col=vec3(.018,.022,.028)+vec3(.075,.065,.047)*stone+detail*.014;
 col+=vec3(.56,.31,.075)*veins*pulse;
 col+=vec3(.055,.078,.095)*pow(stone,5.);
 gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`;

export async function mountDarkWaitingScene(root, {signal, onTravelEnd, onLost} = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 899px)');
  const ownEvents = new AbortController();
  const events = ownEvents.signal;
  const [meta, buffer] = await Promise.all([
    fetch(new URL('./assets/dark/winden-depth.json', location.href), {signal}).then(r => {if (!r.ok) throw Error('depth'); return r.json();}),
    fetch(new URL('./assets/dark/winden-depth.bin', location.href), {signal}).then(r => {if (!r.ok) throw Error('depth'); return r.arrayBuffer();}),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const img = root.querySelector('img');
  if (!img.complete || !img.naturalWidth) await img.decode();
  // A srcset image reports density-corrected natural dimensions. Give WebGL a
  // standalone image, whose dimensions match its actual decoded pixel buffer.
  const textureImage = new Image();textureImage.src = img.currentSrc || img.src;
  await textureImage.decode();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const renderer = new THREE.WebGLRenderer({alpha: false, antialias: false, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact.matches ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x090b0e);
  renderer.domElement.className = 'dark-waiting-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  root.prepend(renderer.domElement);
  const texture = new THREE.Texture(textureImage);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  const forest = new THREE.Scene(), tunnel = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, .05, 180);
  const tunnelCamera = new THREE.PerspectiveCamera(72, 16 / 9, .05, 130);
  const material = new THREE.ShaderMaterial({vertexShader: forestVertex, fragmentShader: forestFragment,
    uniforms: {photo: {value: texture}, halfFrame: {value: new THREE.Vector2(meta.halfX, meta.halfY)},
      cursor: {value: new THREE.Vector2(.5, .5)}, light: {value: 0}, seconds: {value: 0}}, side: THREE.DoubleSide});
  const geometry = depthGeometry(meta, new Uint16Array(buffer));
  forest.add(new THREE.Mesh(geometry, material));
  const farGeometry = new THREE.PlaneGeometry(meta.halfX * 250, meta.halfY * 250);
  farGeometry.translate(0, 0, -125);
  forest.add(new THREE.Mesh(farGeometry, material));

  // Sparse, genuinely spatial motes make the near air readable without hiding the scene.
  const motes = new Float32Array((compact.matches ? 52 : 100) * 3);
  let seed = 2019;
  const random = () => {seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296;};
  for (let i = 0; i < motes.length; i += 3) motes.set([(random() - .5) * 18, (random() - .5) * 9, -2 - random() * 26], i);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  const moteMaterial = new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    uniforms: {seconds: {value: 0}},
    vertexShader: `uniform float seconds; varying float alpha;void main(){vec3 p=position;p.x+=sin(seconds*.16+p.z)*.14;p.y+=sin(seconds*.21+p.x)*.1;vec4 v=modelViewMatrix*vec4(p,1.);alpha=.13;gl_PointSize=clamp(14./-v.z,1.,3.);gl_Position=projectionMatrix*v;}`,
    fragmentShader: `varying float alpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.77,.8,.83,alpha*smoothstep(.5,.05,d));}`});
  const dust = new THREE.Points(moteGeometry, moteMaterial); forest.add(dust);
  const mistGeometry = new THREE.PlaneGeometry(24, 12);
  const mistMaterial = new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    uniforms: {seconds: {value: 0}},
    vertexShader: `varying vec2 fogUV;void main(){fogUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float seconds;varying vec2 fogUV;void main(){vec2 p=fogUV;float cloud=sin(p.x*9.+seconds*.07+sin(p.y*6.))*sin(p.y*7.-seconds*.04+p.x);float edge=smoothstep(0.,.18,p.x)*smoothstep(0.,.18,1.-p.x);gl_FragColor=vec4(.61,.65,.69,(cloud*.5+.5)*edge*.025);}`});
  const mist = new THREE.Mesh(mistGeometry, mistMaterial);mist.position.set(0, -.7, -10);forest.add(mist);

  const curvePoints = Array.from({length: 31}, (_, i) => new THREE.Vector3(Math.sin(i * .49) * 1.65,
    Math.cos(i * .38) * 1.25, -i * 3.6));
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const tubeGeometry = new THREE.TubeGeometry(curve, 360, 2.9, compact.matches ? 32 : 48, false);
  // Uneven tunnel walls, rather than a perfectly machined cylinder.
  const tubePositions = tubeGeometry.attributes.position, tubeUV = tubeGeometry.attributes.uv;
  for (let i = 0; i < tubePositions.count; i++) {
    const centre = curve.getPointAt(tubeUV.getX(i));
    const p = new THREE.Vector3().fromBufferAttribute(tubePositions, i);
    const angle = tubeUV.getY(i) * Math.PI * 2;
    const scale = 1 + .065 * Math.sin(tubeUV.getX(i) * 157 + angle * 5) + .035 * Math.cos(angle * 12);
    p.sub(centre).multiplyScalar(scale).add(centre);tubePositions.setXYZ(i, p.x, p.y, p.z);
  }
  const tunnelMaterial = new THREE.ShaderMaterial({vertexShader: tunnelVertex, fragmentShader: tunnelFragment,
    side: THREE.BackSide, uniforms: {seconds: {value: 0}}});
  tunnel.add(new THREE.Mesh(tubeGeometry, tunnelMaterial));
  const sparks = new Float32Array(180 * 3);
  for (let i = 0; i < sparks.length; i += 3) {
    const t = random(), centre = curve.getPointAt(t), angle = random() * Math.PI * 2, radius = 1.6 + random() * .9;
    sparks.set([centre.x + Math.cos(angle) * radius, centre.y + Math.sin(angle) * radius, centre.z], i);
  }
  const sparkGeometry = new THREE.BufferGeometry();sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparks, 3));
  const sparkMaterial = new THREE.PointsMaterial({color: 0xc6a151, size: .023, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending});
  tunnel.add(new THREE.Points(sparkGeometry, sparkMaterial));
  const exitGeometry = new THREE.PlaneGeometry(16, 16);
  const exitMaterial = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 exitUV;void main(){exitUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 exitUV;void main(){float d=length(exitUV-.5)*2.;float glow=exp(-d*d*20.);gl_FragColor=vec4(.71,.57,.3,glow*.8);}`});
  const exitGlow = new THREE.Mesh(exitGeometry, exitMaterial);exitGlow.position.copy(curve.getPointAt(.985));tunnel.add(exitGlow);
  const audio = new DarkAudio();
  let disposed = false, raf = 0, previous = 0, time = 0, travelStart = null, travelStage = 'forest';
  let targetX = 0, targetY = 0, x = 0, y = 0, flashlight = false, drag = null;
  let travelOrigin = new THREE.Vector3(), resumeTravel = 0;
  const caveDepth = 13.5;
  const caveTarget = new THREE.Vector3((meta.cave[0] - .5) * 2 * meta.halfX * caveDepth,
    (.5 - meta.cave[1]) * 2 * meta.halfY * caveDepth, -caveDepth);
  const resize = () => {
    if (disposed) return;
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h);
    camera.aspect = tunnelCamera.aspect = aspect;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.min(meta.halfY, meta.halfX / aspect))) * .965;
    camera.updateProjectionMatrix(); tunnelCamera.updateProjectionMatrix();
    requestFrame();
  };
  function requestFrame() {if (!disposed && !document.hidden && !raf) raf = requestAnimationFrame(draw);}
  function finishTravel() {
    travelStart = null; travelStage = 'forest';
    root.dataset.travel = 'forest'; root.style.setProperty('--cave-black', '0');
    x = y = targetX = targetY = 0; camera.rotation.set(0, 0, 0);
    onTravelEnd?.(); requestFrame();
  }
  function draw(now) {
    raf = 0; if (disposed || document.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0; previous = now;
    if (!reduced.matches) time += dt;
    const progress = travelStart === null ? null : (now - travelStart) / 1000;
    if (progress !== null) {
      const p = reduced.matches ? 6.1 : progress;
      if (p < 2) {
        const t = ease(clamp(p / 2, 0, 1)); camera.position.lerpVectors(travelOrigin, caveTarget, t);
        camera.rotation.set(0, 0, 0);
        root.style.setProperty('--cave-black', String(ease(clamp((p - 1.1) / .8, 0, 1))));
        travelStage = 'cave';
      } else if (p < 5.7) {
        const t = clamp((p - 2) / 4, 0, .94);
        tunnelCamera.position.copy(curve.getPointAt(t));
        tunnelCamera.lookAt(curve.getPointAt(Math.min(.99, t + .045)));
        tunnelCamera.rotateZ(Math.sin(t * 7) * .12);
        tunnelMaterial.uniforms.seconds.value = time;
        root.style.setProperty('--cave-black', String(1 - ease(clamp((p - 2) / .45, 0, 1))));
        travelStage = 'wormhole';
      } else {
        travelStage = 'arrival';
        root.style.setProperty('--cave-black', '1');
      }
      root.dataset.travel = travelStage;
      if (progress > (reduced.matches ? .7 : 7.1)) finishTravel();
    } else {
      const damping = 1 - Math.exp(-dt * 4);
      x += (targetX - x) * damping; y += (targetY - y) * damping;
      camera.position.set(x * .32, y * .15, reduced.matches ? 0 : Math.sin(time * .18) * .012);
      camera.rotation.set(-y * .006, x * .007, 0);
      material.uniforms.cursor.value.set(.5 + x * .22, .5 + y * .22);
    }
    material.uniforms.light.value = flashlight ? 1 : 0;
    material.uniforms.seconds.value = moteMaterial.uniforms.seconds.value = mistMaterial.uniforms.seconds.value = time;
    renderer.render(travelStage === 'wormhole' ? tunnel : forest, travelStage === 'wormhole' ? tunnelCamera : camera);
    if (!reduced.matches || travelStart !== null || Math.abs(targetX - x) + Math.abs(targetY - y) > .002) requestFrame();
  }
  window.addEventListener('resize', resize, {signal: events});
  window.addEventListener('pointermove', e => {
    if (travelStart !== null || reduced.matches || e.pointerType !== 'mouse' || compact.matches) return;
    targetX = clamp((e.clientX / innerWidth - .5) * 2, -1, 1);
    targetY = clamp((.5 - e.clientY / innerHeight) * 2, -1, 1); requestFrame();
  }, {signal: events, passive: true});
  // Delegation survives room rerenders; touch control never captures the form.
  document.addEventListener('pointerdown', e => {
    const control = e.target.closest('#dark-look-control');
    if (!control || travelStart !== null) return;
    drag = {id: e.pointerId, px: e.clientX, py: e.clientY, x: targetX, y: targetY};
    control.setPointerCapture(e.pointerId);
  }, {signal: events});
  document.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    targetX = clamp(drag.x + (e.clientX - drag.px) / 130, -1, 1);
    targetY = clamp(drag.y - (e.clientY - drag.py) / 150, -1, 1); requestFrame();
  }, {signal: events, passive: true});
  const release = () => {drag = null;};
  document.addEventListener('pointerup', release, {signal: events});
  document.addEventListener('pointercancel', release, {signal: events});
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && travelStart !== null) {e.preventDefault(); finishTravel(); return;}
    if (e.target.id !== 'dark-look-control') return;
    const directions = {ArrowLeft: [-.3, 0], ArrowRight: [.3, 0], ArrowUp: [0, .3], ArrowDown: [0, -.3]};
    if (directions[e.key]) {e.preventDefault(); const [dx, dy] = directions[e.key]; targetX = clamp(targetX + dx, -1, 1); targetY = clamp(targetY + dy, -1, 1);requestFrame();}
  }, {signal: events});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(raf);raf = 0;resumeTravel = performance.now();audio.suspend();}
    else {if (travelStart !== null && resumeTravel) travelStart += performance.now() - resumeTravel;previous = 0;resumeTravel = 0;audio.resume();requestFrame();}
  }, {signal: events});
  reduced.addEventListener('change', () => {targetX = targetY = x = y = 0;requestFrame();}, {signal: events});
  renderer.domElement.addEventListener('webglcontextlost', e => {e.preventDefault();dispose();onLost?.();}, {signal: events});
  function dispose() {
    if (disposed) return;disposed = true;ownEvents.abort();cancelAnimationFrame(raf);
    if (travelStart !== null) onTravelEnd?.();
    for (const resource of [geometry, farGeometry, material, texture, moteGeometry, moteMaterial, mistGeometry, mistMaterial, tubeGeometry, tunnelMaterial, sparkGeometry, sparkMaterial, exitGeometry, exitMaterial]) resource.dispose();
    audio.dispose(); renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    delete root.darkSceneSnapshot;
  }
  signal.addEventListener('abort', dispose, {once: true});
  root.darkSceneSnapshot = () => ({camera: camera.position.toArray(), triangles: geometry.index.count / 3,
    stage: travelStage, reduced: reduced.matches, audio: audio.snapshot(), renderer: renderer.info.render.calls});
  resize();root.dataset.depth = 'ready';
  return {
    travel() {if (disposed || travelStart !== null) return false;travelOrigin.copy(camera.position);travelStart = performance.now();audio.travel();requestFrame();return true;},
    skip: finishTravel,
    flashlight() {flashlight = !flashlight;requestFrame();return flashlight;},
    async sound() {if (audio.enabled) {audio.mute();return false;}return audio.enable();},
    dispose,
  };
}
