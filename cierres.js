/* FORMÁ · Cierre de caja (día y mes) con resumen para WhatsApp y PDF.
   Librería común (FormaCierresLib: texto, PDF, compartir) + pantalla de Gestión (pestaña «Cierre» en Cobros).
   Los importes los calcula el servidor (forma_day_close / forma_finance_reports); aquí solo se muestran y se dan formato.
   El mensaje NO incluye nombres de alumnos (LGPD): solo totales, medios de pago, cursos y categorías. */
(function(){'use strict';
var MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var DOW=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
var MET={pix:'PIX',efectivo:'Dinero',tarjeta:'Tarjeta',transferencia:'Transferencia',bitcoin:'Bitcoin'};
function money(c){var n=Math.round(Number(c)||0),neg=n<0;n=Math.abs(n);var s=String(Math.floor(n/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+String(n%100).padStart(2,'0');return(neg?'-':'')+'R$ '+s}
function dayLong(iso){var d=new Date(iso+'T12:00:00Z');return DOW[d.getUTCDay()]+' '+d.getUTCDate()+' de '+MES[d.getUTCMonth()]+' de '+d.getUTCFullYear()}
function dayShort(iso){var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function monthLong(ym){var p=ym.split('-');return MES[Number(p[1])-1]+' de '+p[0]}
function hhmm(ts){try{var d=new Date(ts);return d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}catch(e){return ''}}
function top(rows,n){return(rows||[]).filter(function(r){return Number(r.cents)>0}).slice(0,n||6)}
function cashLine(exp,cnt){
  if(cnt==null)return 'Dinero en efectivo del día: esperado '+money(exp)+' (no se contó)';
  var diff=Number(cnt)-Number(exp);
  return 'Dinero en efectivo del día: esperado '+money(exp)+' · contado '+money(cnt)+' · '+(diff===0?'cuadra ✓':(diff>0?'sobran '+money(diff):'faltan '+money(-diff)));
}
/* Estructura neutra del resumen: la usan el texto de WhatsApp y el PDF. kind: 'day' | 'month' */
function summary(kind,o){
  var s=o.snap||{},inn=Number(s.received_cents||0),out=Number(s.outflow_cents||0),title=kind==='day'?'Cierre de caja · '+dayLong(o.day):'Cierre del mes · '+monthLong(o.month);
  var sec=[];
  sec.push({h:'Entró',v:money(inn)+(s.payment_count!=null?' ('+Number(s.payment_count)+' pago'+(Number(s.payment_count)===1?'':'s')+')':''),rows:top(s.by_method,6).map(function(r){return[MET[r.label]||r.label,money(r.cents)]})});
  var acts=top(s.by_activity,6);if(acts.length)sec.push({h:'Por curso o servicio',rows:acts.map(function(r){return[r.label,money(r.cents)]})});
  sec.push({h:'Salió',v:money(out)+(Number(s.refund_cents)>0?' (incluye '+money(s.refund_cents)+' en reembolsos)':''),rows:top(s.by_outflow_category,6).map(function(r){return[r.label,money(r.cents)]})});
  sec.push({h:'Resultado '+(kind==='day'?'del día':'del mes'),v:money(inn-out),strong:true});
  var extra=[];
  if(kind==='day'&&o.cashExp!=null)extra.push(cashLine(o.cashExp,o.cashCnt));
  if(kind==='month'&&o.daysClosed!=null)extra.push('Días con caja cerrada: '+o.daysClosed+(o.daysWith!=null?' de '+o.daysWith+' con movimientos':''));
  if(kind==='month'&&o.cashDiff!=null&&o.cashDiff!==0)extra.push('Diferencia acumulada de caja: '+money(o.cashDiff));
  if(o.note)extra.push('Nota: '+o.note);
  var foot=[];if(o.at)foot.push((o.rev>1?'Corrección '+o.rev+' · ':'')+'Cerrado a las '+hhmm(o.at));else foot.push('Borrador: aún sin cerrar');
  return{title:title,sec:sec,extra:extra,foot:foot};
}
function text(kind,o){
  var m=summary(kind,o),L=['*FORMÁ · '+m.title+'*',''];
  m.sec.forEach(function(x){
    L.push((x.strong?'💰 ':x.h==='Entró'?'✅ ':x.h==='Salió'?'❌ ':'📊 ')+'*'+x.h+'*'+(x.v?': '+x.v:''));
    (x.rows||[]).forEach(function(r){L.push('   • '+r[0]+': '+r[1])});
  });
  if(m.extra.length){L.push('');m.extra.forEach(function(e){L.push('📝 '+e)})}
  L.push('');L.push('_'+m.foot.join(' · ')+'_');
  return L.join('\n');
}
/* ---------- PDF mínimo (texto, A4, Helvetica) sin librerías ---------- */
function enc(s){
  s=String(s).replace(/[→]/g,'->').replace(/[·•]/g,'-').replace(/[—–]/g,'-').replace(/✓/g,'OK').replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
  var o='';for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);o+=(c<=255&&(c>=32||c===10))?s.charAt(i):''}
  return o.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}
function wrap(s,n){var w=String(s).split(' '),L=[],c='';w.forEach(function(x){if((c+' '+x).trim().length>n&&c){L.push(c);c=x}else c=(c+' '+x).trim()});if(c)L.push(c);return L}
function pdf(kind,o){
  var m=summary(kind,o),lines=[{t:'FORMA EDUCACIONAL',s:10,c:'0.35 0.2 0.8'},{t:m.title,s:17,b:1},{t:' ',s:6}];
  m.sec.forEach(function(x){
    lines.push({t:x.h+(x.v?'  -  '+x.v:''),s:x.strong?14:12,b:1});
    (x.rows||[]).forEach(function(r){lines.push({t:'      '+r[0]+':  '+r[1],s:11})});
    lines.push({t:' ',s:5});
  });
  m.extra.forEach(function(e){wrap(e,92).forEach(function(l){lines.push({t:l,s:11})})});
  lines.push({t:' ',s:8});m.foot.forEach(function(f){lines.push({t:f,s:9,c:'0.4 0.4 0.4'})});
  var pages=[],cur=[],y=790;
  lines.forEach(function(l){var h=l.s*1.5;if(y-h<50){pages.push(cur);cur=[];y=790}y-=h;cur.push({l:l,y:y})});pages.push(cur);
  var objs=[],add=function(s){objs.push(s);return objs.length};
  var cat=add('<< /Type /Catalog /Pages 2 0 R >>'),pg=add('');
  var f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  var kids=[];
  pages.forEach(function(p){
    var cs=p.map(function(x){return 'BT /'+(x.l.b?'F2':'F1')+' '+x.l.s+' Tf '+(x.l.c||'0.1 0.08 0.19')+' rg 50 '+x.y.toFixed(1)+' Td ('+enc(x.l.t)+') Tj ET'}).join('\n');
    var cn=add('<< /Length '+cs.length+' >>\nstream\n'+cs+'\nendstream');
    kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+f1+' 0 R /F2 '+f2+' 0 R >> >> /Contents '+cn+' 0 R >>')+' 0 R');
  });
  objs[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
  var out='%PDF-1.4\n',off=[];
  objs.forEach(function(s,i){off.push(out.length);out+=(i+1)+' 0 obj\n'+s+'\nendobj\n'});
  var xr=out.length;out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+off.map(function(x){return String(x).padStart(10,'0')+' 00000 n \n'}).join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root '+cat+' 0 R >>\nstartxref\n'+xr+'\n%%EOF';
  var u=new Uint8Array(out.length);for(var i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;
  return new Blob([u],{type:'application/pdf'});
}
/* ---------- compartir ---------- */
var WAK='forma-cierre-wa';
function waNum(){try{return(localStorage.getItem(WAK)||'').replace(/\D/g,'')}catch(e){return ''}}
function waSet(v){try{var d=String(v||'').replace(/\D/g,'');if(d.length>=10&&d.length<=15)localStorage.setItem(WAK,d);else localStorage.removeItem(WAK)}catch(e){}}
function waUrl(t){var n=waNum();return 'https://wa.me/'+(n?n:'')+'?text='+encodeURIComponent(t)}
function sharePdf(blob,name){
  try{var file=new File([blob],name,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){return navigator.share({files:[file],title:name}).catch(function(){})}}catch(e){}
  var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);return Promise.resolve();
}
function copy(t){return(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(function(){return true},function(){return false})}
window.FormaCierresLib={money:money,dayLong:dayLong,dayShort:dayShort,monthLong:monthLong,hhmm:hhmm,text:text,pdf:pdf,summary:summary,waUrl:waUrl,waNum:waNum,waSet:waSet,sharePdf:sharePdf,copy:copy,MET:MET};

/* =====================  Pantalla de Gestión: Cobros › Cierre  ===================== */
var X=null,L=window.FormaCierresLib;
var CI={mode:'day',day:'',month:'',data:null,days:null,err:'',loading:false,busy:false,pending:null,counted:'',note:'',redo:false,last:null,seq:0};
function esc(s){return X.esc(s)}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function cents(v){var s=String(v||'').trim().replace(/[^\d.,]/g,'');if(!s)return null;var lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');if(lc>-1&&ld>-1)s=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(lc>-1)s=s.replace(',','.');var n=Number(s);if(!isFinite(n)||n<0||n>999999999)throw Error('Revisa el efectivo contado: usa solo números, por ejemplo 350,00.');return Math.round(n*100)}
function ymd(d){return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function init(ctx){X=ctx;CI.day=X.T;CI.month=X.T.slice(0,7);try{var m=localStorage.getItem('forma-ci-mode');if(m==='day'||m==='month')CI.mode=m}catch(e){}}
function demoDay(day){
  return{day:day,latest_revision:0,cash_expected_cents:35000,closings:[],snapshot:{received_cents:128000,payment_count:3,outflow_cents:30000,expense_cents:30000,refund_cents:0,
    by_method:[{label:'pix',cents:80000},{label:'efectivo',cents:48000}],by_activity:[{label:'Bolsa de Valores',cents:80000},{label:'Computación Informática',cents:48000}],by_outflow_category:[{label:'Alquiler',cents:30000}],by_outflow_method:[{label:'efectivo',cents:13000},{label:'pix',cents:17000}]}};
}
function load(){
  if(!X)return;var n=++CI.seq;CI.loading=true;CI.err='';CI.data=null;CI.days=null;
  var p;
  if(CI.mode==='day')p=X.demo?Promise.resolve(demoDay(CI.day)):X.rpc('forma_day_close',{p_action:'preview',p_data:{day:CI.day}});
  else{
    var m=CI.month+'-01',last=ymd(new Date(Date.UTC(Number(CI.month.slice(0,4)),Number(CI.month.slice(5,7)),0)));
    p=X.demo?Promise.resolve({can_close:false,latest_revision:0,snapshot:demoDay(m).snapshot,history:[]}).then(function(d){CI.days={items:[{day:m,revision:1,cash_expected_cents:1,cash_counted_cents:1}]};return d})
      :Promise.all([X.rpc('forma_finance_reports',{p_action:'closing_preview',p_data:{month:m}}),X.rpc('forma_day_close',{p_action:'list',p_data:{from:m,to:last}}).catch(function(){return{items:[],unavailable:true}})]).then(function(r){CI.days=r[1];return r[0]});
  }
  p.then(function(d){if(n!==CI.seq)return;CI.data=d;CI.loading=false;if(X.view()==='cobros')X.render()},function(e){if(n!==CI.seq)return;CI.loading=false;CI.err=errText(e);if(X.view()==='cobros')X.render()});
}
function errText(e){
  var m=(e&&e.message)||'',c=e&&e.code;
  if(c==='PGRST202'||c==='42883'||/Could not find the function|does not exist/i.test(m))return 'Falta activar el cierre diario en Supabase. Ejecuta el archivo forma-cierre-diario.sql (una sola vez) y recarga.';
  if(c==='42501'||/permission denied/i.test(m))return 'Tu rol no puede cerrar caja.';
  if(c==='40001')return 'Otro cierre fue registrado mientras tanto. Actualiza y revisa antes de continuar.';
  if(c==='22023'&&m)return m;
  return 'No se pudo completar. Revisa tu conexión y vuelve a intentar.'+(c?' (Detalle técnico: '+c+')':'');
}
function dayOpts(d){
  var s=d&&d.snapshot||{},last=d&&d.closings&&d.closings[0]||null;
  return{day:CI.day,snap:last?last.snapshot:s,cashExp:last?last.cash_expected_cents:d.cash_expected_cents,cashCnt:last?last.cash_counted_cents:null,note:last&&last.note||'',rev:last?last.revision:0,at:last?last.created_at:null};
}
function monthOpts(d){
  var items=(CI.days&&CI.days.items)||[],tl=(d&&d.snapshot&&d.snapshot.timeline)||[],withMov=tl.filter(function(t){return Number(t.incoming)>0||Number(t.outgoing)>0}).length,diff=0;
  items.forEach(function(i){if(i.cash_counted_cents!=null)diff+=Number(i.cash_counted_cents)-Number(i.cash_expected_cents)});
  var hist=d&&d.history&&d.history[0];
  return{month:CI.month,snap:d.snapshot,daysClosed:CI.days&&CI.days.unavailable?null:items.length,daysWith:CI.days&&CI.days.unavailable?null:Math.max(withMov,items.length),cashDiff:diff,note:hist&&hist.reason||'',rev:hist?hist.revision:0,at:hist?hist.created_at:null};
}
function bar(rows,tone){
  rows=(rows||[]).filter(function(r){return Number(r.cents)>0});if(!rows.length)return '<p class="note" style="margin:0">Sin movimientos.</p>';
  var mx=Math.max.apply(null,rows.map(function(r){return Number(r.cents)}));
  return rows.slice(0,8).map(function(r){return '<div class="bar"><span>'+esc(L.MET[r.label]||r.label)+'</span><div class="tr"><i style="width:'+(Number(r.cents)/mx*100)+'%"'+(tone?';background:var(--bad)':'')+'></i></div><b class="num">'+X.R(Number(r.cents))+'</b></div>'}).join('');
}
function nav(){
  var seg='<div class="seg" role="group" aria-label="Tipo de cierre"><button data-ci="mode" data-m="day" aria-pressed="'+(CI.mode==='day')+'">Cierre del día</button><button data-ci="mode" data-m="month" aria-pressed="'+(CI.mode==='month')+'">Cierre del mes</button></div>';
  var lab=CI.mode==='day'?L.dayLong(CI.day):L.monthLong(CI.month);
  var at=CI.mode==='day'?CI.day>=X.T:CI.month>=X.T.slice(0,7);
  return '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:16px">'+seg+'<div style="display:flex;gap:8px;align-items:center"><button class="btn s sm" data-ci="prev" aria-label="Anterior">‹</button><b style="min-width:200px;text-align:center">'+esc(lab.charAt(0).toUpperCase()+lab.slice(1))+'</b><button class="btn s sm" data-ci="next" aria-label="Siguiente"'+(at?' disabled':'')+'>›</button></div></div>';
}
function share(o,kind){
  return '<div class="fi-acts" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-ci="wa">Enviar por WhatsApp</button><button class="btn s" data-ci="pdf">Descargar PDF</button><button class="btn s" data-ci="copy">Copiar texto</button></div>'
   +'<label style="margin-top:12px;max-width:360px">WhatsApp de destino (opcional)<input id="ci-wa" inputmode="tel" placeholder="Ej.: 5511999990000 · vacío = elegir contacto" value="'+esc(L.waNum())+'"></label><p class="note" style="margin:4px 0 0">Se recuerda solo en este equipo. El mensaje no incluye nombres de alumnos.</p>';
}
function html(){
  var h='<div class="head"><div><h1>Cierre de caja</h1><p>Cada día se cierra con su resumen; al final del mes, el cierre general.</p></div></div>'+nav();
  if(CI.err)h+='<div class="err" role="alert">'+esc(CI.err)+'</div>';
  if(CI.loading||!CI.data)return h+(CI.err?'<button class="btn s" data-ci="retry">Reintentar</button>':'<p class="skel" role="status">Preparando el resumen…</p>');
  var d=CI.data,s=d.snapshot||{},inn=Number(s.received_cents||0),out=Number(s.outflow_cents||0);
  var o=CI.mode==='day'?dayOpts(d):monthOpts(d),closed=o.rev>0,k='';
  k='<div class="grid">'+'<div class="card kpi c3"><small>Entró</small><b class="num in">'+X.R(inn)+'</b><span class="d flat">'+Number(s.payment_count||0)+' pagos</span></div>'
   +'<div class="card kpi c3"><small>Salió</small><b class="num out">'+X.R(out)+'</b><span class="d flat">Gastos y reembolsos</span></div>'
   +'<div class="card kpi c3"><small>Resultado</small><b class="num '+(inn-out>=0?'in':'out')+'">'+X.R(inn-out)+'</b><span class="d flat">Entró menos salió</span></div>'
   +(CI.mode==='day'?'<div class="card kpi c3"><small>Efectivo esperado</small><b class="num">'+X.R(Number(d.cash_expected_cents||0))+'</b><span class="d flat">Dinero que entró − salió</span></div>':'<div class="card kpi c3"><small>Días cerrados</small><b class="num">'+(o.daysClosed==null?'—':o.daysClosed+(o.daysWith!=null?' / '+o.daysWith:''))+'</b><span class="d flat">Con movimientos</span></div>')+'</div>';
  var state=closed?'<div class="cu-ok" role="status">✓ '+(CI.mode==='day'?'Caja cerrada':'Mes cerrado')+' · revisión '+o.rev+' · '+esc(L.hhmm(o.at))+'</div>':'<div class="note" style="margin:0 0 12px">'+(CI.mode==='day'?'Este día todavía está abierto.':(d.can_close?'El mes terminó y se puede cerrar.':'El mes aún no terminó: puedes enviar un borrador, pero no cerrarlo.'))+'</div>';
  var det='<div class="grid" style="margin-top:12px"><section class="card c4"><h2>Cómo entró</h2>'+bar(s.by_method)+'</section><section class="card c4"><h2>Por curso o servicio</h2>'+bar(s.by_activity)+'</section><section class="card c4"><h2>En qué salió</h2>'+bar(s.by_outflow_category,true)+'</section></div>';
  var form='';
  var canClose=CI.mode==='day'||d.can_close;
  if(canClose&&(!closed||CI.redo)){
    form='<section class="card" style="margin-top:12px"><h2>'+(closed?'Corregir y volver a cerrar':CI.mode==='day'?'Cerrar la caja de hoy':'Cerrar el mes')+'</h2><div class="cu-form ac-grid">'
     +(CI.mode==='day'?'<label>Efectivo contado en caja (R$)<input id="ci-cnt" inputmode="decimal" placeholder="Ej.: 350,00 · opcional" value="'+esc(CI.counted)+'"></label>':'')
     +'<label style="grid-column:1/-1">'+(closed?'Motivo de la corrección (obligatorio)':'Nota (opcional)')+'<textarea id="ci-note" maxlength="500" rows="2" placeholder="'+(closed?'Ej.: faltaba registrar un pago en dinero':'Ej.: sin novedades')+'">'+esc(CI.note)+'</textarea></label></div>'
     +'<div class="cu-foot" style="margin-top:10px"><span class="note" style="margin:0">Al cerrar queda guardado con tu usuario y la hora. No se borra: una corrección crea una nueva revisión.</span><button class="btn p" data-ci="close"'+(CI.busy?' disabled':'')+'>'+(CI.busy?'Cerrando…':(closed?'Guardar corrección y enviar':'Cerrar y enviar por WhatsApp'))+'</button></div></section>';
  }
  var sh=(closed&&!CI.redo)?'<section class="card" style="margin-top:12px"><h2>Enviar el resumen</h2><p class="note" style="margin:0 0 4px">Se abre WhatsApp con el mensaje ya escrito.</p>'+share(o,CI.mode)+'<div style="margin-top:12px"><button class="btn s sm" data-ci="redo">Corregir este cierre</button></div></section>'
    :(!closed?'<section class="card" style="margin-top:12px"><h2>Enviar sin cerrar</h2><p class="note" style="margin:0 0 4px">Si solo quieres compartir un borrador.</p>'+share(o,CI.mode)+'</section>':'');
  return h+k+state+det+form+sh;
}
function curOpts(){var d=CI.data;return CI.mode==='day'?dayOpts(d):monthOpts(d)}
function rememberWa(){var i=document.getElementById('ci-wa');if(i)L.waSet(i.value)}
function doClose(){
  if(CI.busy)return;
  var d=CI.data,cnt=null,note=(document.getElementById('ci-note')||{}).value||'';note=note.trim();CI.note=note;
  var ci=document.getElementById('ci-cnt');if(ci)CI.counted=ci.value;
  try{if(CI.mode==='day'&&ci)cnt=cents(ci.value)}catch(e){CI.err=e.message;X.render();return}
  if(Number(d.latest_revision||0)>0&&note.length<3){CI.err='Explica el motivo de la corrección (mínimo 3 letras).';X.render();return}
  CI.err='';
  if(!CI.pending)CI.pending=CI.mode==='day'?{request_id:uuid(),day:CI.day,expected_revision:Number(d.latest_revision||0),note:note,cash_counted_cents:cnt==null?'':String(cnt)}:{request_id:uuid(),month:CI.month+'-01',expected_revision:Number(d.latest_revision||0),reason:note};
  var p=CI.pending;CI.busy=true;X.render();
  var call=X.demo?Promise.resolve({saved:true,revision:Number(d.latest_revision||0)+1,snapshot:d.snapshot,cash_expected_cents:d.cash_expected_cents,cash_counted_cents:cnt,created_at:new Date().toISOString()})
    :(CI.mode==='day'?X.rpc('forma_day_close',{p_action:'close',p_data:p}):X.rpc('forma_finance_reports',{p_action:'close',p_data:p}));
  call.then(function(r){
    if(!r||!r.saved)throw Error('Sin confirmar');
    CI.busy=false;CI.pending=null;CI.redo=false;CI.counted='';CI.note='';
    var o=CI.mode==='day'?{day:CI.day,snap:r.snapshot,cashExp:r.cash_expected_cents,cashCnt:r.cash_counted_cents,note:note,rev:r.revision,at:r.created_at||new Date().toISOString()}
      :Object.assign(monthOpts({snapshot:r.snapshot,history:[{revision:r.revision,reason:note,created_at:new Date().toISOString()}]}),{rev:r.revision,at:new Date().toISOString(),note:note});
    CI.last={kind:CI.mode,o:o};
    X.refresh&&X.refresh();load();
    X.dlg(CI.mode==='day'?'Caja cerrada':'Mes cerrado','<div class="ac-ok">'+(CI.mode==='day'?'La caja del '+esc(L.dayShort(CI.day)):'El mes de '+esc(L.monthLong(CI.month)))+' quedó cerrada. Ya puedes enviar el resumen.</div><pre class="ci-pre">'+esc(L.text(CI.mode,o))+'</pre><div class="fi-acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-ci="walast">Enviar por WhatsApp</button><button class="btn s" data-ci="pdflast">Descargar PDF</button><button class="btn s" data-act="cerrar">Cerrar</button></div>',false);
  },function(e){
    CI.busy=false;if(e&&['22003','22001','22023','23514','40001','42501','22P02','PGRST202','42883'].indexOf(e.code)>-1)CI.pending=null;
    CI.err=errText(e);X.render();
  });
}
function click(e){
  var b=e.target.closest('[data-ci]');if(!b)return false;
  var k=b.dataset.ci;
  if(k==='mode'){CI.mode=b.dataset.m;try{localStorage.setItem('forma-ci-mode',CI.mode)}catch(e){}CI.redo=false;CI.pending=null;load();X.render();return true}
  if(k==='prev'||k==='next'){
    var dir=k==='prev'?-1:1;
    if(CI.mode==='day'){var dd=new Date(CI.day+'T12:00:00Z');dd.setUTCDate(dd.getUTCDate()+dir);var n=ymd(dd);if(n>X.T)return true;CI.day=n}
    else{var y=Number(CI.month.slice(0,4)),m=Number(CI.month.slice(5,7))-1+dir,dm=new Date(Date.UTC(y,m,1));var nm=dm.getUTCFullYear()+'-'+String(dm.getUTCMonth()+1).padStart(2,'0');if(nm>X.T.slice(0,7))return true;CI.month=nm}
    CI.redo=false;CI.pending=null;CI.counted='';CI.note='';load();X.render();return true;
  }
  if(k==='retry'){load();X.render();return true}
  if(k==='redo'){CI.redo=true;X.render();return true}
  if(k==='close'){doClose();return true}
  if(k==='wa'||k==='pdf'||k==='copy'||k==='walast'||k==='pdflast'){
    rememberWa();
    var last=k.slice(-4)==='last',kind=last?CI.last.kind:CI.mode,o=last?CI.last.o:curOpts(),t=L.text(kind,o);
    if(k==='wa'||k==='walast'){window.open(L.waUrl(t),'_blank','noopener');return true}
    if(k==='copy'){L.copy(t).then(function(ok){X.toast?X.toast(ok?'Texto copiado':'No se pudo copiar'):0});return true}
    L.sharePdf(L.pdf(kind,o),'cierre-'+(kind==='day'?o.day:o.month)+'.pdf');return true;
  }
  return false;
}
document.addEventListener('click',function(e){if(X&&click(e)){}});
window.GestionCierres={init:init,html:html,load:load,ensure:function(){if(!CI.data&&!CI.loading&&!CI.err)load()},click:click};
})();
