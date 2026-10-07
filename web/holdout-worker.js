self.window=self;
importScripts('./simulation.js?v=0.9.1','./ablation-core.js?v=0.9.1','./holdout-core.js?v=0.9.1');

self.onmessage=({data})=>{
  try{
    const P=EcoDispatchHoldout.protocol;
    const testMode=data.testMode===true;
    const seed=testMode?data.seed:P.seed;
    const n=testMode?data.n:P.n;
    if(testMode){
      if(typeof seed!=='string'||!seed.startsWith('ci-holdout-')||!Number.isInteger(n)||n<10||n>50)throw new Error('Invalid CI holdout configuration');
    }else{
      if(data.seed!==undefined&&data.seed!==P.seed)throw new Error('Holdout seed is frozen');
      if(data.n!==undefined&&data.n!==P.n)throw new Error('Holdout n is frozen');
    }
    const config=data.config;
    const setup=EcoDispatchEngine.setup(config),rows=[];
    for(let i=0;i<n;i++){
      rows.push(EcoDispatchAblation.scenario(config,setup,seed,i,{harmK:P.harmK}));
      if((i+1)%10===0||i===n-1)self.postMessage({type:'progress',done:i+1,total:n});
    }
    self.postMessage({type:'complete',result:EcoDispatchHoldout.finish(config,rows,seed)});
  }catch(error){
    self.postMessage({type:'error',message:error.message});
  }
};