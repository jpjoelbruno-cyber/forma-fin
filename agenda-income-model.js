/* Integer centavos throughout; no banking or card credentials. */
(function(root){'use strict';
 const methods={pix:'Pix',efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia'};
 function cents(value){const s=String(value).trim();if(!/^\d{1,7}([.,]\d{1,2})?$/.test(s))throw Error('Usa un importe sin separador de miles: 1500,50.');const parts=s.replace(',','.').split('.'),n=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>100000000)throw Error('Importe fuera del límite.');return n;}
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
 function summarize(payments){const active=payments.filter(p=>!p.voided_at),group=key=>Object.entries(active.reduce((a,p)=>(a[p[key]]=(a[p[key]]||0)+p.amount_cents,a),{})).map(([label,cents])=>({label,cents})).sort((a,b)=>b.cents-a.cents);return{received_cents:active.reduce((a,p)=>a+p.amount_cents,0),payment_count:active.length,by_activity:group('activity'),by_area:group('area'),by_method:group('method')};}
 const api={methods,cents,money,summarize};root.FormaAgendaIncomeModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
