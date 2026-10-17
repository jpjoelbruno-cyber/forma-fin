/* Exact centavo totals; receivables and cash movements remain separate. */
(function(root){'use strict';
function value(n){n=Number(n);if(!Number.isSafeInteger(n)||n<0)throw Error('Importe de informe inválido.');return n;}
function summary(d){const incoming=value(d.received_cents||0),pending=value(d.pending_cents||0),available=d.finance_version===1;return{incoming,pending,available,outgoing:available?value(d.outflow_cents||0):null,net:available?incoming-value(d.outflow_cents||0):null,refunds:available?value(d.refund_cents||0):null};}
function parts(rows,max=6){const all=rows.map(r=>({label:String(r.label||'Sin categoría'),cents:value(r.cents)})).filter(r=>r.cents>0).sort((a,b)=>b.cents-a.cents);if(all.length<=max)return all;return all.slice(0,max-1).concat({label:'Otras categorías',cents:all.slice(max-1).reduce((n,r)=>n+r.cents,0)});}
function donut(rows){const p=parts(rows),total=p.reduce((n,r)=>n+r.cents,0);let offset=0;return{total,rows:p.map((r,i)=>{const percent=total?r.cents/total*100:0,v={...r,index:i,percent,offset};offset+=percent;return v;})};}
const api={summary,parts,donut};root.FormaFinanceModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
