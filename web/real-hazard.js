(()=>{
  const NS='http://www.w3.org/2000/svg',$=id=>document.getElementById(id),T=k=>I18N.t('hz.'+k);
  const monthLabels={
    es:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  };

  class RealHazardUI{
    constructor(data){
      this.data=data;
      window.addEventListener('languagechange',()=>this.render());
      this.render();
    }
    render(){
      const annual=this.data.hazard_calendar.annual,months=this.data.hazard_calendar.months;
      $('hz-annual-high').textContent=annual.high_or_worse_pct.toFixed(2)+'%';
      $('hz-annual-extreme').textContent=annual.extreme_pct.toFixed(2)+'%';
      $('hz-peak-high').textContent=Math.max(...months.map(x=>x.high_or_worse_pct)).toFixed(1)+'%';
      $('hz-aug-extreme').textContent=months.find(x=>x.month==='aug').extreme_pct.toFixed(2)+'%';
      $('hz-generated').textContent=new Date(this.data.generated_at_utc).toLocaleString(I18N.lang==='es'?'es-ES':'en-US');
      this.draw();
    }
    draw(){
      const svg=$('hz-chart');svg.replaceChildren();
      const rows=this.data.hazard_calendar.months,labels=monthLabels[I18N.lang]||monthLabels.en;
      const make=(tag,attrs,text)=>{
        const el=document.createElementNS(NS,tag);
        Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
        if(text!==undefined)el.textContent=text;svg.append(el);return el;
      };
      make('title',{},T('chartTitle'));
      for(let p=0;p<=100;p+=25){
        const y=330-p*2.7;
        make('line',{x1:55,x2:875,y1:y,y2:y,class:'map-grid'});
        make('text',{x:45,y:y+4,'text-anchor':'end',class:'hz-axis'},p+'%');
      }
      const slot=800/12;
      rows.forEach((row,i)=>{
        const x=65+i*slot,w=slot*.56;
        const highH=row.high_or_worse_pct*2.7,extH=row.extreme_pct*2.7;
        make('rect',{x,y:330-highH,width:w,height:highH,rx:3,class:'hz-high'});
        make('rect',{x,y:330-extH,width:w,height:extH,rx:3,class:'hz-extreme'});
        make('text',{x:x+w/2,y:354,'text-anchor':'middle',class:'hz-axis'},labels[i]);
      });
      make('rect',{x:595,y:20,width:14,height:14,rx:2,class:'hz-high'});
      make('text',{x:616,y:31,class:'hz-legend'},T('highLegend'));
      make('rect',{x:730,y:20,width:14,height:14,rx:2,class:'hz-extreme'});
      make('text',{x:751,y:31,class:'hz-legend'},T('extremeLegend'));
    }
  }
  window.EcoDispatchRealHazardUI={init:data=>new RealHazardUI(data)};
})();