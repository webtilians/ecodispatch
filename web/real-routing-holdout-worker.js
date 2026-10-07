self.window=self;
importScripts(
  './simulation.js?v=1.1.0',
  './ablation-core.js?v=1.1.0',
  './real-routing-core.js?v=1.1.0',
  './real-routing-holdout-core.js?v=1.1.0'
);

self.onmessage=({data})=>{
  try{
    const P=EcoDispatchRealRoutingHoldout.protocol;
    const testMode=data.testMode===true;
    const seed=testMode?data.seed:P.seed;
    const n=testMode?data.n:P.n;

    if(testMode){
      if(typeof seed!=='string'||!seed.startsWith('ci-real-routing-holdout-'))throw new Error('Invalid CI holdout seed');
      if(!Number.isInteger(n)||n<10||n>50)throw new Error('Invalid CI holdout n');
    }else{
      if(data.seed!==undefined&&data.seed!==P.seed)throw new Error('Real-routing holdout seed is frozen');
      if(data.n!==undefined&&data.n!==P.n)throw new Error('Real-routing holdout n is frozen');
    }

    const config=data.config,routing=data.routing;
    const setup=EcoDispatchRealRoutingHoldout.validateDomain(config,routing),rows=[];
    for(let i=0;i<n;i++){
      rows.push(EcoDispatchRealRouting.scenario(config,routing,setup,seed,i,{harmK:P.harmK}));
      if((i+1)%10===0||i===n-1)self.postMessage({type:'progress',done:i+1,total:n});
    }
    self.postMessage({
      type:'complete',
      result:EcoDispatchRealRoutingHoldout.finish(config,routing,rows,seed)
    });
  }catch(error){
    self.postMessage({type:'error',message:error.message});
  }
};