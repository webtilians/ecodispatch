const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');

const data=JSON.parse(fs.readFileSync('web/data/aemet-malaga-fwi-2025.json','utf8'));
const current=JSON.parse(fs.readFileSync('web/data/current.json','utf8'));

assert.equal(data.version,'1.2');
assert.equal(data.dataset,'aemet-malaga-fire-weather-2025');
assert.equal(data.scope.province,'Málaga');
assert.equal(data.scope.year,2025);
assert.equal(data.scope.spatial_resolution,'province');
assert.equal(data.source.publisher,'AEMET - Agencia Estatal de Meteorología');
assert.equal(data.source.attribution,'Fuente: AEMET');

const calendar=data.hazard_calendar;
assert.ok(calendar);
assert.equal(calendar.months.length,12);
assert.equal(calendar.annual.mean_level,1.8);
assert.equal(calendar.annual.high_or_worse_pct,25.21);
assert.equal(calendar.annual.very_high_or_extreme_pct,17.54);
assert.equal(calendar.annual.extreme_pct,4.66);

const byMonth=Object.fromEntries(calendar.months.map(x=>[x.month,x]));
assert.equal(byMonth.jun.high_or_worse_pct,60);
assert.equal(byMonth.jul.high_or_worse_pct,87.1);
assert.equal(byMonth.aug.high_or_worse_pct,87.1);
assert.equal(byMonth.aug.extreme_pct,25.81);
assert.equal(byMonth.sep.high_or_worse_pct,50);

// Recompute every transparent sum directly from the raw official class rows.
const freq=data.datasets['eimri_frecuencias_provincias_2025.csv'].malaga_rows;
const row=level=>freq.find(x=>x.Niveles===level);
const num=v=>Number(String(v).replace(',','.'));
const months=[
  ['Enero','jan'],['Febrero','feb'],['Marzo','mar'],['Abril','apr'],
  ['Mayo','may'],['Junio','jun'],['Julio','jul'],['Agosto','aug'],
  ['Septiembre','sep'],['Octubre','oct'],['Noviembre','nov'],['Diciembre','dec']
];
for(const [source,id] of months){
  const expected=+(num(row('Alto')[source])+num(row('Muy_Alto')[source])+num(row('Extremo')[source])).toFixed(2);
  assert.equal(byMonth[id].high_or_worse_pct,expected,id);
}
const annualExpected=+(num(row('Alto').Anual)+num(row('Muy_Alto').Anual)+num(row('Extremo').Anual)).toFixed(2);
assert.equal(calendar.annual.high_or_worse_pct,annualExpected);

assert.match(calendar.definition.warning,/not incident probabilities/i);
assert.match(current.version,/^1\\.2(?:\\.|$)/);
assert.equal(current.research.real_hazard.integrated_into_dispatch,false);
assert.equal(current.research.real_hazard.spatial_resolution,'province');
assert.equal(current.research.real_hazard.dataset_git_blob,'beb7c4659e4580b54c576e38be766292d84b1b72');

// Ensure current.json points to the exact versioned data object.
const blob=cp.execFileSync('git',['hash-object','web/data/aemet-malaga-fwi-2025.json'],{encoding:'utf8'}).trim();
assert.equal(blob,current.research.real_hazard.dataset_git_blob);

console.log('PASS: v1.2 official AEMET source, transparent hazard derivations, province-only scope and no dispatch integration');
