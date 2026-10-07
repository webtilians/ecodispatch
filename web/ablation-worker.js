// Classic worker keeps the page responsive during 500/1000 paired scenarios.
self.window=self;
importScripts('./simulation.js','./ablation-core.js');
self.onmessage=({data:{config,seed,n}})=>{
  try{
    if(![500,1000].includes(n)||typeof seed!=='string')throw new Error('Invalid experiment configuration');
    const setup=EcoDispatchEngine.setup(config),rows=[];
    for(let i=0;i<n;i++){
      rows.push(EcoDispatchAblation.scenario(config,setup,seed,i));
      if((i+1)%10===0)self.postMessage({type:'progress',done:i+1,total:n});
    }
    self.postMessage({type:'complete',result:EcoDispatchAblation.finish(config,seed,rows)});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
