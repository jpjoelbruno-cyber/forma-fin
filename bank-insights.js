/* Read-only personal insights. No persistence, network, budget writes or staff access. */
(function(scope){'use strict';
 const categories=[
  {id:'food',name:'Alimentación',icon:'🍽',color:'#7c3aed',match:/food|grocer|supermarket|restaurant|aliment|mercado|padaria|acougue/},
  {id:'transport',name:'Transporte',icon:'🚌',color:'#2563eb',match:/transport|taxi|ride.?hail|fuel|gasoline|combust|uber|99app/},
  {id:'home',name:'Vivienda',icon:'⌂',color:'#0f766e',match:/housing|rent|utilities|electric|water|aluguel|moradia|condominio/},
  {id:'health',name:'Salud',icon:'✚',color:'#be185d',match:/health|medical|pharmac|saude|farmacia/},
  {id:'learning',name:'Educación',icon:'▤',color:'#854d0e',match:/education|tuition|school|educacao|curso|escola/},
  {id:'phone',name:'Comunicación',icon:'☎',color:'#475569',match:/telecom|internet|mobile|recarga claro|telefon/},
  {id:'leisure',name:'Ocio y compras',icon:'◇',color:'#a16207',match:/entertainment|leisure|shopping|clothing|lazer|vestuario/}
 ];
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const cents=n=>Math.round(Math.abs(n)*100),money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateValid=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(s))return false;const d=s.slice(0,10);try{return new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}catch{return false;}};
 function classify(t,override){
  const text=norm(t.category)+' '+norm(t.description),review=reason=>({kind:'review',reason});
  if(!Number.isFinite(t.amount)||!Number.isSafeInteger(cents(t.amount))||!dateValid(t.date))return review('Fecha o importe por verificar');
  if(t.currency!=='BRL')return review('Moneda diferente de BRL');
  if(t.status!=='POSTED')return review('Movimiento pendiente o sin confirmar');
  if((t.type==='DEBIT'&&t.amount>0)||(t.type==='CREDIT'&&t.amount<0))return review('Sentido del movimiento por verificar');
  if(override==='exclude')return{kind:'excluded',reason:'Excluido por ti en esta vista previa'};
  if(override==='income'&&t.amount>0)return{kind:'income',reason:'Ingreso confirmado por ti en esta vista previa'};
  if(t.amount<0&&categories.some(c=>c.id===override))return{kind:'expense',category:override,reason:'Categoría elegida por ti en esta vista previa'};
  if(/refund|reembolso|estorno|chargeback/.test(text))return review('Reembolso: vincular con el gasto original');
  if(/loan|emprestimo|credit received|financing|financiamento/.test(text))return review('Posible préstamo; no asumir ingreso');
  if(/fatura|invoice|bill payment|credit card payment|pagamento de cartao/.test(text))return{kind:'excluded',reason:'Posible pago de factura: evita repetir compras; revisa el detalle'};
  if(/same person transfer|mesma titularidade/.test(text))return{kind:'excluded',reason:'Transferencia propia según el proveedor; verifica la clasificación'};
  if(/transfer|\bpix\b/.test(text))return review('Transferencia: confirmar si es propia, un ingreso o un gasto');
  if(/investments|resgate|aplicacao|aporte/.test(text))return{kind:'excluded',reason:'Movimiento de inversión: separado del consumo; verifica el detalle'};
  if(t.amount>0&&/salary|salario|payroll|pro.?labore|interest|dividend|rendimento/.test(text))return{kind:'income',reason:'Ingreso reconocido por descripción o categoría'};
  if(t.amount<0){const c=categories.find(c=>c.match.test(norm(t.category)))||(/recarga claro/.test(norm(t.description))?categories.find(c=>c.id==='phone'):/\buber\b/.test(norm(t.description))&&!/eats/.test(norm(t.description))?categories.find(c=>c.id==='transport'):null);if(c)return{kind:'expense',category:c.id,reason:'Categoría sugerida; puedes corregirla'};}
  return review('Sin categoría suficientemente clara');
 }
 function summarize(entries,{month='',overrides=new Map()}={}){
  const seen=new Set(),result={income:0,expenses:0,net:0,categories:categories.map(c=>({...c,total:0})),review:0,excluded:0,rows:[],duplicates:0};
  for(const e of entries){const key=e.accountId+':'+e.id;if(seen.has(key)){result.duplicates++;continue;}seen.add(key);if(month&&dateValid(e.date)&&e.date.slice(0,7)!==month)continue;
   const c=classify(e,overrides.get(key)),row={...e,key,...c};result.rows.push(row);
   if(c.kind==='income')result.income+=cents(e.amount);else if(c.kind==='expense'){const n=cents(e.amount);result.expenses+=n;result.categories.find(x=>x.id===c.category).total+=n;}else result[c.kind==='excluded'?'excluded':'review']++;
  }result.net=result.income-result.expenses;return result;
 }
 function render(container,entries,options={}){
  const s=summarize(entries,options),loaded=options.loaded||0,total=options.total||0,partial=options.partial!==false;
  const active=s.categories.filter(c=>c.total>0);let offset=0;const segments=active.map(c=>{const start=offset;offset+=c.total/s.expenses*100;return c.color+' '+start+'% '+offset+'%';}).join(',');
  const note=s.review?'Hay movimientos por revisar; este resultado puede cambiar.':s.excluded?'Hay movimientos separados del consumo; revisa su clasificación.':'Comprueba las sugerencias con tu extracto.';
  container.innerHTML='<header class="bi-header"><div><span class="bi-eyebrow">FORMA · TU DINERO, MÁS CLARO</span><h3>¿Dónde se va mi dinero?</h3><p>Vista previa privada · Últimos 30 días consultables</p></div><label>Periodo<select data-insight-month aria-label="Periodo del resumen"><option value="">Últimos 30 días</option>'+[...new Set(entries.filter(t=>dateValid(t.date)).map(t=>t.date.slice(0,7)))].sort().reverse().map(m=>'<option value="'+m+'"'+(options.month===m?' selected':'')+'>'+m+' · tramo disponible</option>').join('')+'</select></label></header><p class="bi-coverage">'+loaded+' de '+total+' cuenta(s) de esta conexión consultadas. '+(partial?'Resumen parcial: faltan cuentas o páginas por consultar.':'Todas las páginas de estas cuentas fueron consultadas.')+' El periodo disponible puede cubrir solo parte del mes. Importes en BRL.</p><div class="bi-kpis"><article><span>↗ Ingresos reconocidos</span><strong class="bi-positive">'+money(s.income)+'</strong></article><article><span>↘ Gastos reconocidos</span><strong class="bi-spending">'+money(s.expenses)+'</strong></article><article><span>Diferencia observada</span><strong class="'+(s.net<0?'bi-negative':'bi-positive')+'">'+money(s.net)+'</strong><small>No es el saldo de tus cuentas</small></article></div><div class="bi-panels"><section class="bi-panel"><h4>Gastos por categoría</h4><div class="bi-chart-area"><div class="bi-donut" role="img" aria-label="Distribución de gastos reconocidos por categoría" style="background:'+(segments?'conic-gradient('+segments+')':'#ede9f5')+'"><div><small>Gastos</small><strong>'+money(s.expenses)+'</strong></div></div><ul class="bi-legend">'+(active.length?active.map(c=>'<li><span><i style="background:'+c.color+'"></i>'+c.icon+' '+c.name+'</span><strong>'+money(c.total)+'</strong><small>'+Math.round(c.total/s.expenses*100)+'%</small></li>').join(''):'<li>Aún no hay gastos reconocidos. Revisa los movimientos.</li>')+'</ul></div></section><section class="bi-panel"><h4>Tu lectura financiera</h4><p class="bi-health">'+(s.net<0?'Los gastos reconocidos superan los ingresos reconocidos.':'La diferencia de movimientos reconocidos es positiva o cero.')+'</p><div class="bi-meter" role="img" aria-label="Comparación de ingresos y gastos reconocidos"><span style="width:'+(s.income+s.expenses?s.income/(s.income+s.expenses)*100:50)+'%"></span></div><p><span class="bi-positive">● Ingresos</span> · <span>● Gastos</span></p><p>'+note+'</p><div class="bi-review-count"><strong>'+s.review+'</strong> por revisar <span>· '+s.excluded+' separados del consumo</span></div><p>Primer paso: revisa las categorías. Después compara con tu presupuesto y define un aporte posible a tu reserva.</p></section></div><details class="bi-review"><summary>Revisar y corregir movimientos · '+s.rows.length+'</summary><p>Los cambios solo ajustan esta vista previa hasta actualizar las cuentas o salir de FORMA. No se guardan en tu presupuesto. Reembolsos, otras monedas y movimientos pendientes necesitan revisión adicional.</p><div class="bi-review-list">'+s.rows.map(t=>'<article><div><strong>'+esc(t.description)+'</strong><small>'+esc(String(t.date||'').slice(0,10))+' · '+esc(t.accountName||'Cuenta')+'</small><span>'+esc(t.reason)+'</span></div><strong>'+esc(Number.isFinite(t.amount)&&/^[A-Z]{3}$/.test(t.currency||'')?new Intl.NumberFormat('pt-BR',{style:'currency',currency:t.currency}).format(t.amount):'Importe o moneda por verificar')+'</strong><label>Clasificación<select data-insight-key="'+esc(t.key)+'" aria-label="Clasificación de '+esc(t.description)+'"><option value="">Sugerencia automática</option><option value="exclude"'+(options.overrides?.get(t.key)==='exclude'?' selected':'')+'>Separar del consumo</option>'+(t.amount>0?'<option value="income"'+(options.overrides?.get(t.key)==='income'?' selected':'')+'>Ingreso</option>':categories.map(c=>'<option value="'+c.id+'"'+(options.overrides?.get(t.key)===c.id?' selected':'')+'>'+c.name+'</option>').join(''))+'</select></label></article>').join('')+'</div></details><p class="bi-footnote">Esta lectura usa sugerencias, no un diagnóstico. No modifica saldos, no mueve dinero y no comparte tus movimientos con el equipo de atención. El historial mensual y la conexión de varios bancos se habilitarán después de validar el piloto.</p>';
  container.querySelector('[data-insight-month]').onchange=e=>options.onMonth?.(e.target.value);
  container.querySelectorAll('[data-insight-key]').forEach(el=>el.onchange=e=>options.onCorrect?.(el.dataset.insightKey,e.target.value));
  return s;
 }
 const api={categories,classify,summarize,render};if(typeof module==='object'&&module.exports)module.exports=api;else scope.FormaBankInsights=api;
})(typeof window==='undefined'?globalThis:window);
