/* Modelo de las calculadoras (interés compuesto, independencia financiera, primer millón).
   Solo matemática: sin pantalla, sin datos personales, sin red. El aporte entra al final de cada mes. */
(function(root){'use strict';
const MAX_MONTHS=1200,MAX_MONEY=1e12;
function num(v,d){const n=Number(v);return Number.isFinite(n)?n:(d||0);}
/* Texto escrito por la persona → número. Acepta 1.000,50 · 1,000.50 · 1000 · R$ 1.000 */
function parseNumber(text){
  let s=String(text==null?'':text).replace(/[^\d.,\-]/g,'');
  if(!s||s==='-')return NaN;
  const neg=s[0]==='-';s=s.replace(/-/g,'');
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
  let out;
  if(lc>=0&&ld>=0){const dec=lc>ld?',':'.';const th=dec===','?'.':',';out=s.split(th).join('').replace(dec,'.');}
  else if(lc>=0||ld>=0){
    const sep=lc>=0?',':'.';const parts=s.split(sep);
    if(parts.length>2)out=parts.join('');
    else if(parts[1].length===3&&parts[0].length>0&&parts[0].length<=3&&parts[0]!=='0')out=parts.join('');
    else out=parts[0]+'.'+parts[1];
  }else out=s;
  const n=Number(out);return Number.isFinite(n)?(neg?-n:n):NaN;
}
/* Tasa → tasa mensual efectiva. unit: 'y' = % al año, 'm' = % al mes */
function monthlyRate(rate,unit){const r=num(rate)/100;return unit==='m'?r:Math.pow(1+r,1/12)-1;}
function annualRate(rate,unit){const r=num(rate)/100;return unit==='m'?Math.pow(1+r,12)-1:r;}
function toMonths(time,unit){return Math.round(num(time)*(unit==='m'?1:12));}
function validate(o){
  const e=[];
  ['ini','ap','goal','want','have'].forEach(k=>{if(k in o&&!(o[k]>=0&&o[k]<=MAX_MONEY))e.push(k);});
  if('rate' in o){const max=o.rateU==='m'?30:200;if(!(o.rate>=0&&o.rate<=max))e.push('rate');}
  if('months' in o&&!(o.months>=1&&o.months<=MAX_MONTHS))e.push('time');
  return e;
}
/* Simulación mes a mes */
function simulate(ini,ap,i,months){
  const rows=[];let bal=ini,con=ini;
  for(let m=1;m<=months;m++){const g=bal*i;bal=bal+g+ap;con+=ap;rows.push({m,ap,g,bal,con,gain:bal-con});}
  return rows;
}
/* Puntos para el gráfico: por año (o por mes si son pocos meses) */
function series(rows){
  if(rows.length<=24)return rows.map(r=>({x:r.m,unit:'m',con:r.con,bal:r.bal,gain:r.gain}));
  const out=[];for(let m=12;m<=rows.length;m+=12){const r=rows[m-1];out.push({x:m/12,unit:'y',con:r.con,bal:r.bal,gain:r.gain});}
  const last=rows[rows.length-1];if(rows.length%12)out.push({x:Math.ceil(rows.length/12),unit:'y',con:last.con,bal:last.bal,gain:last.gain});
  return out;
}
/* Cinco etapas para el resumen (en meses) */
function stages(months){
  if(months<=12){const set=new Set([1,Math.ceil(months*.25),Math.ceil(months*.5),Math.ceil(months*.75),months].filter(x=>x>=1));return [...set].sort((a,b)=>a-b).map(m=>({m,label:'m'+m}));}
  const Y=Math.ceil(months/12);const ys=[...new Set([1,Math.ceil(Y*.25),Math.ceil(Y*.5),Math.ceil(Y*.75),Y])].sort((a,b)=>a-b);
  return ys.map(y=>({m:Math.min(y*12,months),label:'y'+y,y}));
}
/* Meses para llegar a una meta. null si no se llega en 100 años */
function monthsToGoal(goal,ini,ap,i){
  if(ini>=goal)return 0;let bal=ini;
  for(let m=1;m<=MAX_MONTHS;m++){bal=bal*(1+i)+ap;if(bal>=goal)return m;}
  return null;
}
/* Aporte mensual necesario para llegar a la meta en n meses */
function neededContribution(goal,ini,i,n){
  if(ini>=goal)return 0;
  if(i===0)return (goal-ini)/n;
  const f=Math.pow(1+i,n);return Math.max(0,(goal-ini*f)*i/(f-1));
}
/* Independencia: patrimonio necesario y retirada con una tasa de retirada anual (p. ej. 4%) */
function neededWealth(monthly,withdrawPct){return monthly*12/(withdrawPct/100);}
function monthlyIncome(wealth,withdrawPct){return wealth*(withdrawPct/100)/12;}
const api={parseNumber,monthlyRate,annualRate,toMonths,validate,simulate,series,stages,monthsToGoal,neededContribution,neededWealth,monthlyIncome,MAX_MONTHS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FormaCalc=api;
})(typeof window!=='undefined'?window:globalThis);
