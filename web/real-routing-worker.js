self.window=self;
importScripts('./simulation.js?v=1.0.0','./ablation-core.js?v=1.0.0','./real-routing-core.js?v=1.0.0');

self.onmessage=({data:{config,routing,seed,n,harmK=10,bootstrapB=500}})=>{
  try{
    if(!Number.isInteger(n)||n<10||n>1000)throw new Error('Invalid sample count');
    if(typeof seed!=='string'||!seed)throw new Error('Invalid seed');
    const setup=EcoDispatchRealRouting.setup(config,routing),rows=[];
    for(let i=0;i<n;i++){
      rows.push(EcoDispatchRealRouting.scenario(config,routing,setup,seed,i,{harmK}));
      if((i+1)%10===0||i===n-1)self.postMessage({type:'progress',done:i+1,total:n});
    }
    self.postMessage({type:'complete',result:EcoDispatchRealRouting.finish(config,routing,setup,seed,rows,{harmK,bootstrapB})});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};