/* Integer centavos throughout; no banking or card credentials. */
(function(root){'use strict';
 const methods={pix:'Pix',efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',bitcoin:'Bitcoin · valor en R$'};
 function cents(value){const s=String(value).trim();if(!/^\d{1,7}([.,]\d{1,2})?$/.test(s))throw Error('Usa un importe sin separador de miles: 1500,50.');const parts=s.replace(',','.').split('.'),n=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>100000000)throw Error('Importe fuera del límite.');return n;}
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
 function summarize(payments){const active=payments.filter(p=>!p.voided_at),group=key=>Object.entries(active.reduce((a,p)=>(a[p[key]]=(a[p[key]]||0)+p.amount_cents,a),{})).map(([label,cents])=>({label,cents})).sort((a,b)=>b.cents-a.cents);return{received_cents:active.reduce((a,p)=>a+p.amount_cents,0),payment_count:active.length,by_activity:group('activity'),by_area:group('area'),by_group:group('group_name').map(r=>({...r,label:r.label==='undefined'||!r.label?'Sin grupo':r.label})),by_method:group('method')};}
 function dateLabel(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))throw Error('Selecciona una fecha válida.');const d=new Date(day+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==day||day<'2020-01-01'||day>'2045-12-31')throw Error('Selecciona una fecha válida.');return d.toLocaleDateString('es',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'});}
 function paymentTiming(kind,mode,appointment,custom){
  if(!['pendiente','presencial','adelanto'].includes(kind))return{status:kind,payment_plan:'sin_acuerdo',due_on:null};
  if(!['atencion','fecha','sin_acuerdo'].includes(mode))throw Error('Selecciona cuándo se prevé el pago.');
  const due=mode==='atencion'?appointment:mode==='fecha'?custom:null;if(mode!=='sin_acuerdo')dateLabel(due);
  // The installed v4 server only retains due_on with payment_plan=fecha. Keep
  // a future promise pending; preserve its onsite intent in the immutable
  // registration/audit JSON instead of silently discarding the chosen date.
  return{status:kind==='presencial'?'pendiente':kind,presentation_status:kind,date_mode:mode,payment_location:kind==='presencial'?'presencial':null,payment_plan:due?'fecha':kind==='presencial'?'presencial':'sin_acuerdo',due_on:due};
 }
 function agreementLabel(c,appointment){if(c.due_on){let text='Pago previsto: '+dateLabel(c.due_on);if(appointment&&c.due_on===appointment)text+=' · Día de la atención';return text;}return c.payment_plan==='presencial'?'Pago presencial · Sin fecha definida':'Sin fecha de pago definida';}
 const api={methods,cents,money,summarize,dateLabel,paymentTiming,agreementLabel};root.FormaAgendaIncomeModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
