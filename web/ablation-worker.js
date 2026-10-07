// v0.8 classic worker: keeps 500/1000 paired scenarios and bootstrap off the UI thread.
self.window=self;
importScripts('./simulation.js?v=0.8.0','./ablation-core.js?v=0.8.0');
self.onmessage=({data:{config,seed,n,harmK,bootstrapB}})=>{
  try{
    // Public UI exposes 500/1000. Lower values are accepted for browser CI.
    if(!Number.isInteger(n)||n<10||n>1000||typeof seed!=='string')throw new Error('Invalid experiment configuration');
    if(!Number.isFinite(harmK)||harmK<=0)throw new Error('Invalid harm penalty');
    const setup=EcoDispatchEngine.setup(config),rows=[];
    for(let i=0;i<n;i++){
      rows.push(EcoDispatchAblation.scenario(config,setup,seed,i,{harmK}));
      if((i+1)%10===0||i===n-1)self.postMessage({type:'progress',done:i+1,total:n});
    }
    self.postMessage({
      type:'complete',
      result:EcoDispatchAblation.finish(config,seed,rows,{harmK,bootstrapB})
    });
  }catch(error){self.postMessage({type:'error',message:error.message});}
};