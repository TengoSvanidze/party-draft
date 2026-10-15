// Analytic exponential drag keeps the coast consistent at 30, 60 and 120 fps.
export function createKnotMotion(){
 const state={x:0,y:0,vx:0,vy:0,held:false};
 const clamp=v=>Math.max(-7,Math.min(7,v));
 return {state,
  grab(){state.held=true;state.vx=state.vy=0;},
  drag(dx,dy,seconds){
   state.y+=dx;state.x+=dy;
   const dt=Math.max(.008,Math.min(.1,seconds));
   state.vx=clamp(dy/dt);state.vy=clamp(dx/dt);
  },
  release(idle=0,reduced=false){state.held=false;if(idle>.12||reduced)state.vx=state.vy=0;},
  stop(){state.vx=state.vy=0;},
  reset(){Object.assign(state,{x:0,y:0,vx:0,vy:0,held:false});},
  impulse(){state.vy=3.2;state.vx=.45;},
  step(dt,reduced=false){
   if(reduced){state.vx=state.vy=0;return;}
   if(state.held||dt<=0)return;
   const decay=Math.exp(-1.35*dt),integral=(1-decay)/1.35;
   state.x+=state.vx*integral;state.y+=state.vy*integral;
   state.vx*=decay;state.vy*=decay;
   if(Math.hypot(state.vx,state.vy)<.005)state.vx=state.vy=0;
  }
 };
}
