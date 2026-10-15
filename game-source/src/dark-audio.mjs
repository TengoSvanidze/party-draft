// Original synthesis only: C-minor pads, sparse additive piano, pulse and noise.
// No recordings, samples, tracks or remote audio requests.
export class DarkAudio {
  constructor(){this.context=null;this.enabled=false;this.mode='scene';this.sources=new Set();this.timer=null;this.disposed=false;this.nextTick=0;this.nextBeat=0;}
  async enable(){
    if(this.disposed)return false;
    try {
      if(!this.context){
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
        const c=this.context=new Audio();this.master=c.createGain();this.master.gain.value=.24;
        this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.ratio.value=4;
        this.master.connect(this.compressor).connect(c.destination);this.analyser=c.createAnalyser();this.analyser.fftSize=256;this.compressor.connect(this.analyser);
        this.noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate);const data=this.noise.getChannelData(0);let last=0;
        for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*4;}
      }
      await this.context.resume();if(this.disposed)return false;this.enabled=true;this.startMode();return true;
    } catch {return false;}
  }
  track(source,nodes){source.darkNodes=nodes;this.sources.add(source);source.onended=()=>{this.sources.delete(source);for(const n of [source,...nodes])n.disconnect();};return source;}
  note(frequency,at,duration,gain=.05,type='sine',attack=.1){
    if(!this.context||!this.enabled)return;
    const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=frequency;
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),at+attack);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g).connect(this.master);this.track(o,[g]);o.start(at);o.stop(at+duration+.03);return o;
  }
  noiseHit(at,duration,gain,from,to){
    if(!this.context||!this.enabled)return;
    const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;s.loop=duration>3;
    f.type='lowpass';f.frequency.setValueAtTime(from,at);f.frequency.exponentialRampToValueAtTime(Math.max(20,to),at+duration);
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+Math.min(duration*.3,.8));g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    s.connect(f).connect(g).connect(this.master);this.track(s,[f,g]);s.start(at);s.stop(at+duration+.05);
  }
  clear(){clearInterval(this.timer);this.timer=null;for(const s of [...this.sources]){try{s.stop();}catch{}for(const n of [s,...(s.darkNodes||[])])try{n.disconnect();}catch{}}this.sources.clear();}
  setMode(mode){this.mode=mode;if(this.enabled)this.startMode();}
  startMode(){
    this.clear();if(!this.context||!this.enabled||this.disposed)return;
    const c=this.context,t=c.currentTime+.04;
    if(this.mode==='intro'){
      // Cm / Ab / Eb / Gm, deliberately composed here, 56 BPM feel.
      const chords=[[65.406,77.782,97.999],[51.913,65.406,77.782],[77.782,97.999,116.541],[48.999,58.270,73.416]];
      chords.forEach((chord,i)=>chord.forEach((f,j)=>{this.note(f,t+i*8,10,.065,'sine',1.8);this.note(f*2.003,t+i*8,9,.018,'triangle',1.6);if(j===1){this.note(f*4,t+i*8+2.1,4,.055,'sine',.008);this.note(f*8,t+i*8+2.1,1.8,.012,'sine',.008);}}));
      this.noiseHit(t+19,6,.16,90,2300);this.note(32.703,t+24,4,.4,'sine',.01);this.noiseHit(t+24,2.2,.42,280,40);
      this.nextTick=t;this.nextBeat=t;this.timer=setInterval(()=>{const now=c.currentTime;while(this.nextTick<now+.15){this.tick(this.nextTick);this.nextTick+=1.0714;}while(this.nextBeat<now+.15){this.heartbeat(this.nextBeat);this.nextBeat+=2.14;}},100);
    } else {
      const ambience=()=>{if(!this.enabled)return;const at=c.currentTime+.02;this.note(65.406,at,12,.045,'sine',2);this.note(97.999,at,12,.018,'sine',2);this.noiseHit(at,12,.10,520,250);};
      ambience();this.nextTick=t+1;let nextPad=t+9;
      this.timer=setInterval(()=>{const now=c.currentTime;if(now>=nextPad){ambience();nextPad=now+9;}if(now>=this.nextTick){this.tick(now+.01);this.nextTick=now+1.0714;}},120);
    }
  }
  tick(t){this.note(1200,t,.045,.037,'triangle',.003);this.note(720,t+.015,.055,.015,'sine',.003);}
  heartbeat(t){this.note(48,t,.25,.11,'sine',.008);this.note(44,t+.26,.3,.065,'sine',.008);}
  travel(){if(!this.enabled)return;const t=this.context.currentTime;this.noiseHit(t,2.8,.38,90,2600);const o=this.note(65.406,t,2.8,.17,'sine',.2);o?.frequency.exponentialRampToValueAtTime(261.625,t+2.7);}
  year(){if(this.enabled)this.noiseHit(this.context.currentTime,.32,.16,1800,100);}
  mute(){this.enabled=false;this.clear();this.context?.suspend().catch(()=>{});}
  suspend(){if(this.enabled)this.context?.suspend().catch(()=>{});}
  resume(){if(this.enabled)this.context?.resume().catch(()=>{});}
  snapshot(){let peak=0;if(this.analyser&&this.enabled){const a=new Float32Array(256);this.analyser.getFloatTimeDomainData(a);peak=Math.max(...a.map(Math.abs));}return {enabled:this.enabled,state:this.context?.state||'uninitialized',sources:this.sources.size,peak};}
  dispose(){if(this.disposed)return;this.disposed=true;this.enabled=false;this.clear();this.context?.close().catch(()=>{});this.master?.disconnect();this.compressor?.disconnect();this.analyser?.disconnect();}
}
