/* FORMA Gestión nueva: una sola estructura (barra de PC / barra inferior de celular).
   Lee los mismos datos reales de FORMA por las mismas funciones del servidor. En esta versión no escribe nada:
   las acciones que registran dinero o reservas se abren en la pantalla actual hasta probarlas con datos reales. */
(function(){'use strict';
var M=window.FormaAgendaModel,FI=window.FormaAgendaIncomeModel||{};
var $=function(s,r){return(r||document).querySelector(s)};
var demo=new URLSearchParams(location.search).get('vista')==='ejemplo';
var client=null,role=null,userEmail='',installEvt=null;
var IC={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 0 0 0-6M21 20c0-2.5-1.5-4.6-4-5.5"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'};
function ico(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+IC[n]+'</svg>'}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function R(c){return 'R$ '+(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function R0(c){return 'R$ '+Math.round(c/100).toLocaleString('pt-BR')}
var MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],MESL=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function dl(iso){if(!iso)return '';var p=String(iso).slice(0,10).split('-');return p[2]+' '+MES[Number(p[1])-1]}
function spNow(){var p={};new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});return{day:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour),min:Number(p.minute)}}
var T=spNow().day;
function daysBetween(a,b){return Math.round((M.date(b)-M.date(a))/86400000)}
function toast(t){var e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){e.hidden=true},3200)}

/* ---------- servidor ---------- */
function rpc(name,args){
  if(demo)return Promise.resolve(demoRpc(name,args||{}));
  var timer,p=new Promise(function(_,rej){timer=setTimeout(function(){rej(Error('timeout'))},15000)});
  return Promise.race([client.rpc(name,args||{}),p]).then(function(r){clearTimeout(timer);if(r.error)throw r.error;return r.data},function(e){clearTimeout(timer);throw e});
}
var errors=[];
function safe(label,promise){return promise.catch(function(e){errors.push(label);return null})}
var fin=function(a,d){return rpc('forma_finance_reports',{p_action:a,p_data:d||{}})};
var crm=function(a,d){return rpc('forma_crm',{p_action:a,p_data:d||{}})};
var edu=function(a,d){return rpc('forma_education',{p_action:a,p_data:d||{}})};

/* ---------- estado ---------- */
var D={work:null,pending:null,month:null,prevMonth:null,crmSales:null,crmAlerts:null,reports:{},edu:null,eduQuery:'',eduOffset:0,eduMore:false,pendQuery:'',weekFrom:M.monday(T),week:null};
var manager=function(){return role==='owner'||role==='manager'};

function monthRange(day){var d=M.date(day),y=d.getUTCFullYear(),m=d.getUTCMonth();return{from:M.iso(new Date(Date.UTC(y,m,1))),to:M.iso(new Date(Date.UTC(y,m+1,0))),bucket:'day'}}
function shiftMonth(day,n){var d=M.date(day);return M.iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)))}
function periodRange(per){
  var d=M.date(T),y=d.getUTCFullYear(),r,pr;
  if(per==='Hoy'){r={from:T,to:T,bucket:'day'};var yd=M.plus(T,-1);pr={from:yd,to:yd,bucket:'day'}}
  else if(per==='Semana'){var mo=M.monday(T);r={from:mo,to:M.plus(mo,6),bucket:'day'};pr={from:M.plus(mo,-7),to:M.plus(mo,-1),bucket:'day'}}
  else if(per==='Mes'){r=monthRange(T);pr=monthRange(shiftMonth(T,-1))}
  else{r={from:y+'-01-01',to:y+'-12-31',bucket:'month'};pr={from:(y-1)+'-01-01',to:(y-1)+'-12-31',bucket:'month'}}
  return{cur:r,prev:pr}
}
function getReport(r){var k=r.from+'|'+r.to+'|'+r.bucket;if(D.reports[k])return Promise.resolve(D.reports[k]);return fin('period',{from:r.from,to:r.to,bucket:r.bucket}).then(function(d){if(!d||d.report_version!==1)throw Error('informe');D.reports[k]=d;return d})}

function loadCore(){
  errors=[];
  var jobs=[];
  jobs.push(safe('agenda',rpc('forma_agenda_work',{p_action:'state',p_data:{}}).then(function(d){D.work=d})));
  if(manager()){
    var mr=monthRange(T);
    jobs.push(safe('cobros',Promise.all([getReport(mr),getReport(monthRange(shiftMonth(T,-1)))]).then(function(a){D.month=a[0];D.prevMonth=a[1]})));
    jobs.push(safe('por cobrar',fin('pending',{offset:0}).then(function(d){D.pending=d})));
    jobs.push(safe('interesados',crm('sales',{stage:'',offset:0}).then(function(d){D.crmSales=d})));
    jobs.push(safe('avisos de interesados',crm('alerts',{}).then(function(d){D.crmAlerts=d})));
  }
  return Promise.all(jobs);
}

/* ---------- derivados ---------- */
function sessionsOn(day,bookings){var out=[];(bookings||[]).forEach(function(b){if(b.cancelled)return;var n;try{n=M.occurrence(b,day)}catch(e){n=-1}if(n>=0)out.push({b:b,n:n,day:day})});out.sort(function(a,b){return a.b.start_hour-b.b.start_hour});return out}
function hourLabel(h){return String(h).padStart(2,'0')+':00'}
function attendanceOf(b,day){return((D.work&&D.work.attendance)||[]).filter(function(a){return a.booking_id===b.id&&a.day===day})[0]}
function unregistered(){
  var res=[],now=spNow();if(!D.work)return res;
  (D.work.bookings||[]).forEach(function(b){if(b.cancelled)return;for(var i=0;i<b.sessions;i++){var day=M.plus(b.start_date,7*i),dd=daysBetween(day,T);if(dd<0||dd>7)continue;if(dd===0&&now.hour<b.start_hour+b.duration)continue;var a=attendanceOf(b,day);if(!a||a.status==='pendiente')res.push({b:b,day:day,i:i})}});
  res.sort(function(a,b){return a.day<b.day?1:-1});return res;
}
function overdue(){return((D.pending&&D.pending.items)||[]).filter(function(x){return x.due_on&&x.due_on<T}).sort(function(a,b){return a.due_on<b.due_on?-1:1})}
function avisos(){
  var a=[];
  overdue().forEach(function(x){a.push({t:'Pago vencido',s:x.client+' · '+R(x.pending_cents)+' · hace '+daysBetween(x.due_on,T)+' días',k:'bad',act:'cobrar'})});
  unregistered().slice(0,20).forEach(function(u){a.push({t:'Clase sin registrar',s:u.b.client+' · '+dl(u.day)+' · '+hourLabel(u.b.start_hour),k:'warn',act:'asist'})});
  ((D.crmAlerts&&D.crmAlerts.items)||[]).forEach(function(i){a.push({t:'Interesado esperando',s:i.name+(i.next_action?' · '+i.next_action:'')+' · '+dl(i.due_on),k:'up',act:'interesados'})});
  return a;
}
function delta(cur,prev,label){if(!prev||prev<=0)return{t:'Sin período anterior para comparar',c:'flat'};var p=(cur-prev)/prev*100;return{t:(p>=0?'▲ ':'▼ ')+Math.abs(p).toFixed(1).replace('.',',')+'% '+label,c:p>=0?'up':'down'}}

/* ---------- gráficos ---------- */
function niceMax(v){if(v<=0)return 1000;var e=Math.pow(10,Math.floor(Math.log10(v))),f=v/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e}
function kfmt(v){return v>=1000?(Math.round(v/100)/10).toLocaleString('pt-BR')+' mil':String(Math.round(v))}
function labelsFor(rows,bucket){return rows.map(function(r){return bucket==='month'?MES[Number(r.day.slice(5,7))-1]:r.day.slice(8,10)})}
function bars(d,bucket){
  var rows=d.timeline||[];if(!rows.length)return '<p class="note">Sin movimientos en este período.</p>';
  var lab=labelsFor(rows,bucket),W=640,H=250,L=48,B=28,T0=14,n=rows.length,gw=(W-L-8)/n,vals=rows.map(function(r){return[Number(r.incoming||0)/100,Number(r.outgoing||0)/100]}),max=niceMax(Math.max.apply(null,vals.map(function(v){return Math.max(v[0],v[1])}))),y=function(v){return T0+(H-T0-B)*(1-v/max)},o='<svg class="ch" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Entradas y salidas del período">';
  [0,.25,.5,.75,1].forEach(function(f){var v=max*f;o+='<line x1="'+L+'" x2="'+(W-8)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+kfmt(v)+'</text>'});
  var step=Math.ceil(n/12);
  for(var i=0;i<n;i++){var w=Math.min(18,gw*.34),x=L+i*gw+gw/2-w-1.5;
    if(rows[i].incoming!=null)o+='<rect x="'+x+'" y="'+y(vals[i][0])+'" width="'+w+'" height="'+Math.max(0,y(0)-y(vals[i][0]))+'" rx="3" fill="var(--ok)"><title>'+esc(dl(rows[i].day)+' · entró '+R(rows[i].incoming))+'</title></rect><rect x="'+(x+w+3)+'" y="'+y(vals[i][1])+'" width="'+w+'" height="'+Math.max(0,y(0)-y(vals[i][1]))+'" rx="3" fill="var(--bad)"><title>'+esc(dl(rows[i].day)+' · salió '+R(rows[i].outgoing||0))+'</title></rect>';
    if(i%step===0)o+='<text x="'+(L+i*gw+gw/2)+'" y="'+(H-8)+'" text-anchor="middle">'+lab[i]+'</text>'}
  return o+'</svg><div class="leg"><span><i style="background:var(--ok)"></i>Entradas</span><span><i style="background:var(--bad)"></i>Salidas</span></div>';
}
function cumul(rows){var s=0;return rows.map(function(r){if(r.incoming==null)return null;return s+=Number(r.incoming)/100})}
function line(d,prev,bucket){
  var rows=d.timeline||[];if(rows.length<2)return '<p class="note">Hace falta más de un día para mostrar el crecimiento.</p>';
  var c=cumul(rows),p=prev&&prev.timeline?cumul(prev.timeline):[],W=640,H=230,L=48,B=28,T0=14,n=rows.length,all=c.concat(p).filter(function(v){return v!=null}),max=niceMax(Math.max.apply(null,all.concat([1]))),x=function(i){return L+i*(W-L-16)/(n-1)},y=function(v){return T0+(H-T0-B)*(1-v/max)},lab=labelsFor(rows,bucket),o='<svg class="ch" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Ingresos acumulados, período actual y anterior">';
  [0,.25,.5,.75,1].forEach(function(f){var v=max*f;o+='<line x1="'+L+'" x2="'+(W-8)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+kfmt(v)+'</text>'});
  function path(a,col,dash){var s='',open=false;for(var i=0;i<Math.min(a.length,n);i++){if(a[i]==null){open=false;continue}s+=(open?'L':'M')+x(i)+','+y(a[i])+' ';open=true}return '<path d="'+s+'" fill="none" stroke="'+col+'" stroke-width="3" stroke-linejoin="round" '+(dash?'stroke-dasharray="6 5"':'')+'/>'}
  o+=path(p,'var(--ink2)',true)+path(c,'var(--brand)');
  var last=-1;c.forEach(function(v,i){if(v!=null)last=i});
  if(last>=0)o+='<circle cx="'+x(last)+'" cy="'+y(c[last])+'" r="5" fill="var(--brand)"/><text x="'+(x(last)-8)+'" y="'+(y(c[last])-10)+'" text-anchor="end" style="font-weight:700;fill:var(--ink)">'+R0(c[last]*100)+'</text>';
  var step=Math.ceil(n/12);lab.forEach(function(l,i){if(i%step===0)o+='<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+l+'</text>'});
  return o+'</svg><div class="leg"><span><i style="background:var(--brand)"></i>Este período</span><span><i style="background:var(--ink2)"></i>Período anterior</span></div>';
}
function methodLabel(m){return(FI.methods&&FI.methods[m])||m}
function hbars(rows,methods){
  rows=(rows||[]).filter(function(r){return Number(r.cents)>0});if(!rows.length)return '<p class="note">Sin cobros en este período.</p>';
  var mx=Math.max.apply(null,rows.map(function(r){return Number(r.cents)}));
  return rows.slice(0,8).map(function(r){return '<div class="bar"><span>'+esc(methods?methodLabel(r.label):r.label)+'</span><div class="tr"><i style="width:'+(Number(r.cents)/mx*100)+'%"></i></div><b class="num">'+R0(Number(r.cents))+'</b></div>'}).join('');
}

/* ---------- vistas ---------- */
var view='inicio',cobTab='resumen',cobPer='Mes',alF='Todos',agFilter='Todo';
var NAV=[['inicio','Inicio','home'],['agenda','Agenda','cal'],['cobros','Cobros','cash'],['alumnos','Alumnos','users'],['interesados','Interesados','chat']];
function navFor(){return manager()?NAV:NAV.slice(0,2)}
function kpi(l,v,cls,d,dc){return '<div class="card kpi c3"><small>'+l+'</small><b class="num '+(cls||'')+'">'+v+'</b>'+(d?'<span class="d '+(dc||'flat')+'">'+d+'</span>':'')+'</div>'}
function head(t,sub,right){return '<div class="head"><div><h1>'+t+'</h1>'+(sub?'<p>'+sub+'</p>':'')+'</div><div style="display:flex;gap:10px;flex-wrap:wrap">'+(right||'')+'</div></div>'}
function movRow(m){return '<div class="row"><div class="t"><b>'+esc(m.t)+'</b><span>'+esc(m.m)+' · '+esc(dl(m.f))+'</span></div><span class="v num '+(m.v>0?'in':'out')+'">'+(m.v>0?'+ ':'− ')+R(Math.abs(m.v))+'</span></div>'}
function movements(d){
  var a=((d&&d.entries)||[]).map(function(e){return{t:e.client+(e.activity?' · '+e.activity:''),m:methodLabel(e.method),f:e.paid_on,v:Number(e.amount_cents)}});
  var b=((d&&d.outflows)||[]).map(function(o){return{t:(o.category||'Salida')+(o.kind==='reembolso'?' · reembolso':''),m:methodLabel(o.method),f:o.paid_on,v:-Number(o.amount_cents)}});
  return a.concat(b).sort(function(x,y){return x.f<y.f?1:x.f>y.f?-1:0});
}
var V={};
V.inicio=function(){
  var h=spNow().hour,sal=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
  var mine=sessionsOn(T,D.work&&D.work.bookings),av=avisos(),p=D.pending,cur=D.month,prev=D.prevMonth;
  var acts=manager()?'<div class="acts" style="margin-bottom:16px"><button class="act a1" data-act="cobrar">'+ico('cash')+'<span>Cobrar un pago<small>Y dar su comprobante</small></span></button><button class="act a2" data-act="matricular">'+ico('cap')+'<span>Matricular un alumno<small>Paso a paso</small></span></button><button class="act a3" data-act="agendar">'+ico('cal')+'<span>Agendar un servicio<small>Elige día y hora</small></span></button><button class="act a4" data-act="interesado">'+ico('chat')+'<span>Nuevo interesado<small>Guardar contacto</small></span></button></div>':'';
  var k='';
  if(manager()){
    var dm=cur&&prev?delta(Number(cur.received_cents),Number(prev.received_cents),'vs mes anterior'):null,w=((D.crmAlerts&&D.crmAlerts.total_count)||0),ov=overdue();
    k+=kpi('Cobrado en '+MESL[M.date(T).getUTCMonth()],cur?R0(Number(cur.received_cents)):'—','in',dm&&dm.t,dm&&dm.c);
    k+=kpi('Por cobrar',p?R0(Number(p.total_cents)):'—','out',p?(Number(p.total_count)+' con saldo'+(ov.length?' · '+ov.length+' vencidos':'')):'',ov.length?'down':'flat');
  }
  k+=kpi('Clases hoy',String(mine.length),'',mine.length?'Próxima '+hourLabel(nextHour(mine)):'Día libre','flat');
  if(manager())k+=kpi('Interesados esperando',String((D.crmAlerts&&D.crmAlerts.total_count)||0),'',((D.crmAlerts&&D.crmAlerts.total_count)?'Piden una respuesta':'Todo respondido'),(D.crmAlerts&&D.crmAlerts.total_count)?'down':'up');
  var hoy=mine.map(function(e){var a=attendanceOf(e.b,T);return '<div class="row"><span class="hour">'+hourLabel(e.b.start_hour)+'</span><div class="t"><b>'+esc(e.b.client)+'</b><span>'+esc(e.b.activity)+(e.b.sessions>1?' · Encuentro '+(e.n+1)+' de '+e.b.sessions:'')+(a&&a.status==='realizada'?' · registrada':'')+'</span></div><button class="btn s sm" data-act="asist">Abrir</button></div>'}).join('')||'<p class="note" style="margin:0">No hay clases agendadas hoy.</p>';
  var aten=av.slice(0,4).map(function(a){return '<div class="row"><div class="t"><b>'+esc(a.t)+'</b><span>'+esc(a.s)+'</span></div><button class="btn p sm" data-act="'+a.act+'">'+({cobrar:'Cobrar',asist:'Registrar',interesados:'Responder'})[a.act]+'</button></div>'}).join('')||'<p class="note" style="margin:0">Nada pendiente. Todo al día.</p>';
  var chart=manager()?'<section class="card c4"><h2>Entradas del mes <button class="link" data-v="cobros">Ver cobros</button></h2>'+(cur?bars(cur,'day'):'<p class="note">No se pudo cargar.</p>')+'</section>':'';
  return head(sal+(userName()?', '+esc(userName()):''),'Lo que necesitas hacer hoy, a un toque.')+acts+'<div class="grid">'+k+
   '<section class="card c4"><h2>Hoy <button class="link" data-v="agenda">Ver agenda</button></h2><div class="list">'+hoy+'</div></section>'+
   '<section class="card c4"><h2>Necesita tu atención <button class="link" data-go="avisos">Ver todo</button></h2><div class="list">'+aten+'</div></section>'+chart+'</div>';
};
function nextHour(list){var n=spNow(),f=list.filter(function(e){return e.b.start_hour>n.hour})[0]||list[0];return f.b.start_hour}
function userName(){return ''}
V.agenda=function(){
  var from=D.weekFrom,days=[0,1,2,3,4,5].map(function(i){return M.plus(from,i)}),hrs=[13,14,15,16,17],NM=['Lun','Mar','Mié','Jue','Vie','Sáb'];
  var bk=(D.week&&D.week.bookings)||[];
  function ok(b){var curso=b.activity==='Clase grupal'||!!b.group_name;return agFilter==='Todo'||(agFilter==='Cursos'?curso:!curso)}
  var g='<div class="h"></div>'+days.map(function(d,i){return '<div class="h'+(d===T?' t':'')+'">'+NM[i]+' '+d.slice(8)+'</div>'}).join('');
  hrs.forEach(function(h){g+='<div class="tm">'+h+':00</div>';days.forEach(function(d){var l=sessionsOn(d,bk).filter(function(s){return ok(s.b)&&h>=s.b.start_hour&&h<s.b.start_hour+s.b.duration});g+='<div>'+(l.length?l.map(function(s){return '<div class="ev'+(s.b.activity==='Clase grupal'?' g':'')+'"><b>'+esc(s.b.client)+'</b>'+esc(s.b.activity)+'</div>'}).join(''):(manager()?'<button class="free" data-act="agendar" style="border:0;background:none">+ Libre</button>':''))+'</div>'})});
  var dls=days.map(function(d,i){var items=sessionsOn(d,bk).filter(function(s){return ok(s.b)}).map(function(s){return '<div class="row"><span class="hour">'+hourLabel(s.b.start_hour)+'</span><div class="t"><b>'+esc(s.b.client)+'</b><span>'+esc(s.b.activity)+'</span></div></div>'}).join('');return '<div class="card day"><h3>'+NM[i]+' '+dl(d)+'</h3>'+(items||'<span class="free">Sin reservas</span>')+(manager()?'<div><button class="btn s sm" data-act="agendar" style="margin-top:8px">+ Agendar</button></div>':'')+'</div>'}).join('');
  var cur=M.monday(T)===from;
  return head('Agenda',dl(days[0])+' – '+dl(days[5])+' · lunes a sábado, 13:00 a 18:00','<div class="seg" role="group" aria-label="Semana"><button data-wk="-1" aria-pressed="false">← Anterior</button><button data-wk="0" aria-pressed="'+cur+'">Esta semana</button><button data-wk="1" aria-pressed="false">Siguiente →</button></div>'+(manager()?'<button class="btn p" data-act="agendar">'+ico('plus')+'Agendar servicio</button>':''))+
   '<div class="chips" style="margin-bottom:14px" role="group" aria-label="Tipo">'+['Todo','Servicios','Cursos'].map(function(c){return '<button class="chip" data-ag="'+c+'" aria-pressed="'+(agFilter===c)+'">'+c+'</button>'}).join('')+'</div><div class="week">'+g+'</div><div class="days">'+dls+'</div>';
};
V.cobros=function(){
  var tabs='<div class="seg" role="tablist">'+[['resumen','Resumen'],['porcobrar','Por cobrar'],['mov','Movimientos']].map(function(t){return '<button data-ct="'+t[0]+'" aria-pressed="'+(cobTab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>';
  var per='<div class="seg" role="group" aria-label="Período">'+['Hoy','Semana','Mes','Año'].map(function(p){return '<button data-cp="'+p+'" aria-pressed="'+(cobPer===p)+'">'+p+'</button>'}).join('')+'</div>';
  var h=head('Cobros','Lo que entra, lo que sale y lo que falta cobrar.','<button class="btn p" data-act="cobrar">'+ico('plus')+'Cobrar un pago</button>')+'<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;margin-bottom:16px">'+tabs+(cobTab==='porcobrar'?'':per)+'</div>';
  var rr=periodRange(cobPer),d=D.reports[rr.cur.from+'|'+rr.cur.to+'|'+rr.cur.bucket],pv=D.reports[rr.prev.from+'|'+rr.prev.to+'|'+rr.prev.bucket];
  if(cobTab==='porcobrar'){
    var p=D.pending,items=(p&&p.items)||[];
    return h+'<div class="grid"><section class="card c12"><h2>Alumnos y clientes con saldo pendiente'+(p?' · '+R(Number(p.total_cents)):'')+'</h2><input class="search" id="pq" placeholder="Buscar por nombre, teléfono o curso" aria-label="Buscar" value="'+esc(D.pendQuery)+'" style="margin-bottom:12px"><div class="tw"><table><thead><tr><th>Cliente</th><th>Curso o servicio</th><th>Vencimiento</th><th style="text-align:right">Debe</th><th></th></tr></thead><tbody>'+(items.map(function(a){return '<tr><td><b>'+esc(a.client)+'</b></td><td>'+esc(a.activity||'')+(a.group_name?'<br><span style="color:var(--ink2);font-size:13px">'+esc(a.group_name)+'</span>':'')+'</td><td><span class="pill '+(a.due_status==='Vencido'?'down':'flat')+'">'+esc(a.due_on?a.due_status+' · '+dl(a.due_on):'Sin fecha')+'</span></td><td class="num out" style="text-align:right"><b>'+R(Number(a.pending_cents))+'</b></td><td style="text-align:right"><button class="btn p sm" data-act="cobrar">Cobrar</button></td></tr>'}).join('')||'<tr><td colspan="5" class="note">'+(p?'Nada pendiente.':'Cargando…')+'</td></tr>')+'</tbody></table></div>'+(p&&p.has_more?'<p class="note"><button class="link" id="pmore">Ver más</button></p>':'')+'</section></div>';
  }
  if(!d)return h+'<p class="skel" role="status">Cargando '+cobPer.toLowerCase()+'…</p>';
  if(cobTab==='mov'){var mv=movements(d);return h+'<div class="grid"><section class="card c12"><h2>Movimientos · '+cobPer.toLowerCase()+'</h2><div class="list">'+(mv.map(movRow).join('')||'<p class="note" style="margin:0">Sin movimientos en este período.</p>')+'</div>'+(d.entries_limited?'<p class="note">Se muestran los 200 más recientes.</p>':'')+'</section></div>'}
  var inn=Number(d.received_cents),out=Number(d.outflow_cents),dm=pv?delta(inn,Number(pv.received_cents),'vs período anterior'):null;
  return h+'<div class="grid">'+kpi('Entradas',R(inn),'in',dm&&dm.t,dm&&dm.c)+kpi('Salidas',R(out),'out','Incluye '+R(Number(d.refund_cents||0))+' reembolsados','flat')+kpi('Por cobrar (todo)',D.pending?R(Number(D.pending.total_cents)):'—','out',D.pending?Number(D.pending.total_count)+' con saldo':'','flat')+kpi('Resultado del período',R(inn-out),inn-out>=0?'in':'out','Entradas menos salidas','flat')+
   '<section class="card c8"><h2>Entradas y salidas</h2>'+bars(d,rr.cur.bucket)+'</section><section class="card c4"><h2>Crecimiento acumulado</h2>'+line(d,pv,rr.cur.bucket)+'</section><section class="card c4"><h2>Cómo pagaron</h2>'+hbars(d.by_method,true)+'</section><section class="card c4"><h2>Cobrado por curso o servicio</h2>'+hbars(d.by_activity)+'</section><section class="card c4"><h2>Últimos movimientos <button class="link" data-ct="mov">Ver todos</button></h2><div class="list">'+(movements(d).slice(0,4).map(movRow).join('')||'<p class="note" style="margin:0">Sin movimientos.</p>')+'</div></section></div>';
};
function courseInfo(p){
  var act=(p.courses||[]).filter(function(c){return c.state==='activo'||c.state==='matriculado'||c.state==='pausa'});
  var debt=0;(p.courses||[]).forEach(function(c){if(c.state==='cancelado'||c.state==='concluido')return;var d=Number(c.total_cents||0)-Number(c.paid_cents||0);if(d>0)debt+=d});
  return{act:act,debt:debt};
}
V.alumnos=function(){
  var items=(D.edu&&D.edu.items)||[],rows=items.map(function(p){return{p:p,i:courseInfo(p)}}).filter(function(x){return alF==='Todos'||(alF==='Deben'&&x.i.debt>0)||(alF==='Al día'&&x.i.debt===0)});
  var cc={};items.forEach(function(p){courseInfo(p).act.forEach(function(c){cc[c.course]=(cc[c.course]||0)+1})});
  var cs=Object.keys(cc).sort(function(a,b){return cc[b]-cc[a]});
  return head('Alumnos','Cursos, matrículas y pagos en un solo lugar.',manager()?'<button class="btn p" data-act="matricular">'+ico('plus')+'Matricular un alumno</button>':'')+
   '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><input class="search" id="aq" placeholder="Buscar alumno o curso" aria-label="Buscar alumno o curso" value="'+esc(D.eduQuery)+'"><div class="chips" role="group" aria-label="Filtro">'+['Todos','Deben','Al día'].map(function(c){return '<button class="chip" data-al="'+c+'" aria-pressed="'+(alF===c)+'">'+c+'</button>'}).join('')+'</div></div>'+
   '<div class="grid"><section class="card c8"><div class="tw"><table class="rt"><thead><tr><th>Alumno</th><th>Curso</th><th>Estado</th><th style="text-align:right">Saldo</th><th></th></tr></thead><tbody>'+(rows.map(function(x){var p=x.p,i=x.i,names=(i.act.length?i.act:(p.courses||[])).map(function(c){return c.course}).join(', ');return '<tr><td><b>'+esc(p.name)+'</b><br><span style="color:var(--ink2);font-size:13px">'+esc(p.phone||'')+'</span></td><td>'+esc(names||'Sin curso')+'</td><td><span class="pill '+(i.debt>0?'down':'up')+'">'+(i.debt>0?'con saldo':'al día')+'</span></td><td class="num '+(i.debt?'out':'in')+'" style="text-align:right"><b>'+R(i.debt)+'</b></td><td style="text-align:right">'+(i.debt>0&&manager()?'<button class="btn p sm" data-act="cobrar">Cobrar</button>':'<button class="btn s sm" data-act="ficha">Ver ficha</button>')+'</td></tr>'}).join('')||'<tr><td colspan="5" class="note">'+(D.edu?'No hay alumnos con ese filtro.':'Cargando…')+'</td></tr>')+'</tbody></table></div>'+(D.eduMore?'<p class="note"><button class="link" id="emore">Ver más alumnos</button></p>':'')+'</section>'+
   '<section class="card c4"><h2>Cursos activos</h2><div class="list">'+(cs.map(function(c){return '<div class="row"><div class="t"><b>'+esc(c)+'</b><span>'+cc[c]+' alumno'+(cc[c]>1?'s':'')+'</span></div></div>'}).join('')||'<p class="note" style="margin:0">Sin cursos activos en la lista cargada.</p>')+'</div></section></div>';
};
var STG=[['nuevo','Nuevo'],['conversacion','En conversación'],['seguimiento','Seguimiento'],['preparar_matricula','Preparando matrícula'],['matriculado','Matriculado']];
V.interesados=function(){
  var s=D.crmSales;if(!s)return head('Interesados','Quién espera respuesta y en qué etapa está.','')+'<p class="skel" role="status">'+(errors.indexOf('interesados')>-1?'No se pudo cargar.':'Cargando…')+'</p>';
  var c=s.counts||{},tot=STG.reduce(function(a,x){return a+Number(c[x[0]]||0)},0),mx=Math.max.apply(null,STG.map(function(x){return Number(c[x[0]]||0)}).concat([1])),it=s.items||[];
  return head('Interesados','Quién espera respuesta y en qué etapa está.','<button class="btn p" data-act="interesado">'+ico('plus')+'Nuevo interesado</button>')+
   '<section class="card" style="margin-bottom:16px"><h2>Embudo de ventas</h2><div class="fun">'+STG.map(function(e){var n=Number(c[e[0]]||0);return '<div class="st"><b class="num">'+n+'</b>'+e[1]+'<i style="width:'+(n/mx*100)+'%"></i></div>'}).join('')+'</div><p style="margin:12px 0 0;color:var(--ink2)">Conversión: <b class="in">'+(tot?Math.round(Number(c.matriculado||0)/tot*100):0)+'%</b> de las personas del tablero ya se matricularon.</p></section>'+
   '<div class="lanes">'+STG.map(function(e){var l=it.filter(function(i){return i.stage===e[0]});return '<div class="lane"><h3>'+e[1]+'<span>'+Number(c[e[0]]||0)+'</span></h3>'+(l.map(function(i){return '<div class="pc"><b>'+esc(i.name)+'</b><span>'+esc([i.area,i.next_action,i.due_on?dl(i.due_on):''].filter(Boolean).join(' · '))+'</span></div>'}).join('')||'<span class="note">Sin tarjetas cargadas</span>')+'</div>'}).join('')+'</div>'+(it.length>=50?'<p class="note">Se muestran las primeras 50 tarjetas; los contadores incluyen todas.</p>':'');
};
V.avisos=function(){
  var a=avisos();
  return head('Avisos','Cobranza y pendientes que piden una acción.','')+'<section class="card"><div class="list">'+(a.map(function(x){return '<div class="row"><span class="pill '+(x.k==='bad'?'down':x.k==='up'?'up':'flat')+'" style="'+(x.k==='warn'?'background:var(--warnbg);color:var(--warn)':'')+'">'+esc(x.t)+'</span><div class="t"><span style="color:var(--ink)">'+esc(x.s)+'</span></div><button class="btn s sm" data-act="'+x.act+'">'+({cobrar:'Cobrar',asist:'Registrar',interesados:'Responder'})[x.act]+'</button></div>'}).join('')||'<p class="note" style="margin:0">Sin avisos. Todo al día.</p>')+'</div></section>';
};
V.ajustes=function(){
  function row(t,s){return '<div class="row"><div class="t"><b>'+t+'</b><span>'+s+'</span></div><button class="btn s sm" data-act="viejo">Abrir</button></div>'}
  return head('Ajustes','Datos de FORMA y de tu cuenta.','')+'<section class="card"><div class="list">'+(manager()?row('Instructores y áreas','Quién da cada curso y qué áreas existen')+row('Cuentas y control de caja','Cuentas, saldo inicial y conciliación')+row('Respuestas preparadas','Mensajes para atender interesados'):'')+row('Historial de agenda','Quién cambió qué y cuándo')+'</div><p class="note">Estas opciones se abren por ahora en la pantalla actual de FORMA Gestão.</p></section>';
};

/* ---------- carga perezosa por vista ---------- */
function ensure(){
  if(view==='cobros'&&manager()&&cobTab!=='porcobrar'){var rr=periodRange(cobPer);Promise.all([getReport(rr.cur),getReport(rr.prev)]).then(function(){if(view==='cobros')render()},function(){errors.push('cobros');toast('No se pudo cargar ese período.')})}
  if(view==='alumnos'&&manager()&&!D.edu)loadEdu(false);
  if(view==='agenda')loadWeek();
}
function loadEdu(more){
  var off=more?D.eduOffset+30:0;
  edu('list',{query:D.eduQuery,offset:off,state:''}).then(function(d){var items=(d&&d.items)||[];D.edu={items:more&&D.edu?D.edu.items.concat(items):items};D.eduOffset=off;D.eduMore=!!(d&&d.has_more);if(view==='alumnos')render()},function(){toast('No se pudo cargar la lista de alumnos.');if(!D.edu)D.edu={items:[]};if(view==='alumnos')render()});
}
function loadWeek(){
  var from=D.weekFrom;
  rpc('forma_agenda_list',{p_from:from,p_to:M.plus(from,5)}).then(function(d){if(from!==D.weekFrom)return;D.week=d;if(view==='agenda')render()},function(){toast('No se pudo cargar la agenda.')});
}
function pendSearch(more){
  var off=more&&D.pending?D.pending.items.length:0;
  fin('pending',{offset:off,query:D.pendQuery}).then(function(d){if(!d)return;if(more&&D.pending)d.items=D.pending.items.concat(d.items);D.pending=d;if(view==='cobros')render()},function(){toast('No se pudo buscar.')});
}

/* ---------- shell ---------- */
function render(){
  var app=$('#app'),keep=document.activeElement&&document.activeElement.id,pos=document.activeElement&&document.activeElement.selectionStart;
  var banner=demo?'<div class="demo">Vista de ejemplo · datos ficticios · no se guarda nada.</div>':'';
  if(errors.length)banner+='<div class="err">No se pudo cargar: '+esc(errors.filter(function(x,i,a){return a.indexOf(x)===i}).join(', '))+'. Lo que ves puede estar incompleto; no se borró nada.</div>';
  app.innerHTML=banner+(V[view]||V.inicio)();
  var n=avisos().length,dot=$('#nAv');dot.textContent=n>9?'9+':String(n);dot.hidden=!n;
  if(keep&&$('#'+keep)){var el=$('#'+keep);el.focus();try{el.setSelectionRange(pos,pos)}catch(e){}}
}
function mark(){document.querySelectorAll('[data-v]').forEach(function(b){if(b.dataset.v===view||(b.dataset.v==='mas'&&['interesados','ajustes','avisos'].indexOf(view)>-1))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function buildNav(){
  var nv=navFor();
  $('#tabs').innerHTML=nv.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+n[1]+'</button>'}).join('');
  var first=nv.slice(0,manager()?4:2);
  $('#bnav').style.gridTemplateColumns='repeat('+(first.length+1)+',1fr)';
  $('#bnav').innerHTML=first.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+'<span>'+n[1]+'</span></button>'}).join('')+'<button data-v="mas">'+ico('more')+'<span>Más</span></button>';
}
function go(v){if(!V[v])v='inicio';view=v;$('#sheet').hidden=true;$('#menu').hidden=true;try{history.replaceState(null,'','#'+v)}catch(e){}render();mark();window.scrollTo(0,0);ensure()}
function openMas(){
  $('#sheetIn').innerHTML=(manager()?'<button data-v="interesados">'+ico('chat')+'Interesados</button>':'')+'<button data-go="avisos">'+ico('chat')+'Avisos</button><button data-go="ajustes">'+ico('gear')+'Ajustes y datos de FORMA</button><button data-act="theme">Cambiar claro / oscuro</button><button data-act="out" style="color:var(--bad);border-color:var(--badbg)">Cerrar sesión</button>';
  $('#sheet').hidden=false;
}
function dlg(title,body){$('#dlg').innerHTML='<div class="dh"><h2>'+title+'</h2><button data-act="cerrar" aria-label="Cerrar">×</button></div><div class="db">'+body+'</div>';$('#dlg').showModal()}
function toOld(what){dlg(what,'<p>Por ahora esta acción se hace en la pantalla actual de FORMA Gestão: ahí queda guardada con todos los controles de seguridad. En la próxima etapa se pasa a esta pantalla nueva, después de probarla contigo con datos reales.</p><a class="btn p" href="/agenda.html" style="text-decoration:none">Abrir pantalla actual</a>')}
function act(k){
  if(k==='theme'){var r=document.documentElement,nt=r.getAttribute('data-theme')==='dark'?'light':'dark';r.setAttribute('data-theme',nt);try{localStorage.setItem('forma-gestion-theme',nt)}catch(e){}return}
  if(k==='install'){if(installEvt){installEvt.prompt();installEvt=null}else toast('En el menú de tu navegador elige “Instalar app” o “Añadir a pantalla de inicio”.');return}
  if(k==='out'){if(demo){toast('Vista de ejemplo: no hay sesión real.');return}client.auth.signOut().then(function(){location.href='/'},function(){toast('No se confirmó el cierre de sesión. Intenta de nuevo.')});return}
  if(k==='cerrar'){$('#dlg').close();return}
  if(k==='interesados'){go('interesados');return}
  var T2={cobrar:'Cobrar un pago',matricular:'Matricular un alumno',agendar:'Agendar un servicio',interesado:'Nuevo interesado',asist:'Registrar la clase',ficha:'Ver la ficha',viejo:'Abrir esta opción'};
  toOld(T2[k]||'Acción');
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-v]');if(b){if(b.dataset.v==='mas'){openMas();return}go(b.dataset.v);return}
  var g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
  var a=e.target.closest('[data-act]');if(a){act(a.dataset.act);return}
  var c=e.target.closest('[data-ct]'),p=e.target.closest('[data-cp]'),al=e.target.closest('[data-al]'),ag=e.target.closest('[data-ag]'),wk=e.target.closest('[data-wk]');
  if(c){cobTab=c.dataset.ct;render();ensure();return}
  if(p){cobPer=p.dataset.cp;render();ensure();return}
  if(al){alF=al.dataset.al;render();return}
  if(ag){agFilter=ag.dataset.ag;render();return}
  if(wk){var n=Number(wk.dataset.wk);D.weekFrom=n===0?M.monday(T):M.plus(D.weekFrom,7*n);D.week=null;render();loadWeek();return}
  if(e.target.id==='pmore'){pendSearch(true);return}
  if(e.target.id==='emore'){loadEdu(true);return}
  if(!e.target.closest('#menu')&&!e.target.closest('#bUser'))$('#menu').hidden=true;
  if(e.target.id==='sheet')$('#sheet').hidden=true;
});
document.addEventListener('input',function(e){
  if(e.target.id==='aq'){clearTimeout(input.t);input.t=setTimeout(function(){D.eduQuery=e.target.value.trim();D.edu=null;loadEdu(false);render()},350)}
  if(e.target.id==='pq'){clearTimeout(input.t);input.t=setTimeout(function(){D.pendQuery=e.target.value.trim();pendSearch(false)},350)}
});
function input(){}
$('#bUser').onclick=function(){var m=$('#menu');m.hidden=!m.hidden;this.setAttribute('aria-expanded',String(!m.hidden))};
$('#bBell').onclick=function(){go('avisos')};
window.addEventListener('hashchange',function(){var h=location.hash.slice(1);if(role&&V[h]&&h!==view)go(h)});
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e});
try{var th=localStorage.getItem('forma-gestion-theme');if(th)document.documentElement.setAttribute('data-theme',th)}catch(e){}

function gate(msg,showLogin){
  $('#app').innerHTML='<section class="gate card"><h1>FORMA Gestión</h1><p>'+esc(msg)+'</p>'+(showLogin?'<a class="btn p" href="/?next=gestion">Entrar con mi cuenta de FORMÁ</a>':'')+'</section>';
  $('#tabs').innerHTML='';$('#bnav').hidden=true;
}
function boot(){
  var h=(location.hash||'').slice(1);
  if(demo){role=new URLSearchParams(location.search).get('rol')==='propietario'?'owner':'manager';return start(h)}
  var cfg=window.FORMA_CONFIG;
  if(!cfg||cfg.supabaseUrl!=='https://irsuevjqmgpwunvymxbc.supabase.co'||!cfg.publishableKey){gate('La configuración de FORMÁ no está disponible.');return}
  client=supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,flowType:'pkce',storageKey:'forma-independent-auth-v1'}});
  client.auth.getUser().then(function(r){
    if(r.error||!r.data||!r.data.user){gate('Inicia sesión con tu cuenta de FORMÁ para ver tu espacio de trabajo.',true);return}
    userEmail=r.data.user.email||'';
    var uid=r.data.user.id;
    client.auth.onAuthStateChange(function(ev,s){if(ev==='SIGNED_OUT'||(s&&s.user&&s.user.id!==uid))gate('La sesión cambió. Vuelve a entrar.',true)});
    return rpc('forma_agenda_access').then(function(a){
      if(!a||['owner','manager','instructor'].indexOf(a.role)<0){gate('Tu cuenta no tiene acceso a FORMA Gestión.');return}
      role=a.role;start(h);
    },function(){gate('No se pudo verificar tu acceso. Vuelve a cargar la página.')});
  },function(){gate('No se pudo verificar tu sesión. Vuelve a cargar la página.')});
}
function start(h){
  buildNav();$('#bnav').hidden=false;
  view=V[h]&&(manager()||['inicio','agenda','avisos','ajustes'].indexOf(h)>-1)?h:'inicio';
  render();mark();
  loadCore().then(function(){render();mark();ensure()});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!demo&&role){D.reports={};loadCore().then(function(){render()})}});
}

/* ---------- datos de ejemplo (mismas formas que el servidor) ---------- */
function demoRpc(name,a){
  var d=a.p_data||{},act=a.p_action;
  if(name==='forma_agenda_access')return{role:'manager'};
  if(name==='forma_agenda_list'||(name==='forma_agenda_work'&&act==='state')){
    var wk=M.monday(T),bk=[{id:'d1',client:'Alumno de cierre',activity:'Mentoría particular',area:'Educación financiera',instructor:'René',instructors:['René'],start_date:wk,start_hour:15,duration:1,sessions:3,booking_state:'reservado'},{id:'d2',client:'Alumno de ejemplo',activity:'Mentoría particular',area:'Educación financiera',instructor:'René',instructors:['René'],start_date:T,start_hour:17,duration:1,sessions:1,booking_state:'reservado'},{id:'d3',client:'Curso FORMA · Grupo octubre',activity:'Clase grupal',group_name:'Grupo octubre',area:'Método FORMA',instructor:'Miguel',instructors:['Miguel'],start_date:M.plus(wk,2),start_hour:13,duration:2,sessions:4,booking_state:'reservado'}];
    return name==='forma_agenda_list'?{bookings:bk,role:'manager',calendar_version:4}:{version:1,bookings:bk,attendance:[],tasks:[],reminder_minutes:30};
  }
  if(name==='forma_finance_reports'){
    if(act==='pending')return{version:1,total_cents:880289,total_count:4,has_more:false,items:[{id:'p1',client:'Carlos Rojas',activity:'Mentoría particular',due_on:M.plus(T,-22),due_status:'Vencido',pending_cents:120000},{id:'p2',client:'Ana Pérez',activity:'Educación financiera',group_name:'Grupo octubre',due_on:M.plus(T,-14),due_status:'Vencido',pending_cents:40000},{id:'p3',client:'María López',activity:'Educación financiera',due_on:M.plus(T,6),due_status:'Próximo',pending_cents:20000},{id:'p4',client:'Diego Suárez',activity:'Educación financiera',due_on:null,due_status:'Sin fecha',pending_cents:60000}]};
    if(act==='period'){
      var f=new Date(d.from+'T12:00:00Z'),t=new Date(d.to+'T12:00:00Z'),rows=[],i=0,cur=new Date(f);
      var seed=Number(d.from.slice(0,4))%2?1:.8;
      while(cur<=t){var day=cur.toISOString().slice(0,10),future=day>T;rows.push({day:day,incoming:future?null:Math.round((20000+((i*7919)%30000))*seed*(d.bucket==='month'?12:1)),outgoing:future?null:Math.round((6000+((i*4271)%9000))*(d.bucket==='month'?12:1))});if(d.bucket==='month')cur.setUTCMonth(cur.getUTCMonth()+1);else cur.setUTCDate(cur.getUTCDate()+1);i++}
      var inn=rows.reduce(function(s,r){return s+(r.incoming||0)},0),out=rows.reduce(function(s,r){return s+(r.outgoing||0)},0);
      return{version:1,report_version:1,received_cents:inn,outflow_cents:out,refund_cents:0,payment_count:12,timeline:rows,by_method:[{label:'pix',cents:Math.round(inn*.5)},{label:'efectivo',cents:Math.round(inn*.25)},{label:'tarjeta',cents:Math.round(inn*.15)},{label:'transferencia',cents:Math.round(inn*.1)}],by_activity:[{label:'Educación financiera',cents:Math.round(inn*.6)},{label:'Mentoría particular',cents:Math.round(inn*.4)}],entries:[{id:'e1',client:'Ana Pérez',activity:'Cuota',amount_cents:20000,paid_on:M.plus(T,-1),method:'pix'},{id:'e2',client:'Luis Gómez',activity:'Matrícula',amount_cents:20000,paid_on:M.plus(T,-4),method:'efectivo'}],outflows:[{id:'o1',kind:'gasto',amount_cents:60000,paid_on:M.plus(T,-2),method:'transferencia',category:'Alquiler del salón'}]};
    }
  }
  if(name==='forma_crm'){
    if(act==='alerts')return{version:1,total_count:2,items:[{id:'i1',name:'Rita Campos',next_action:'Responder precios',due_on:T},{id:'i2',name:'Hugo Ríos',next_action:'Enviar programa',due_on:M.plus(T,-2)}]};
    if(act==='sales')return{counts:{nuevo:9,conversacion:6,seguimiento:4,preparar_matricula:2,matriculado:3,cerrado:5},items:[{id:'i1',stage:'nuevo',name:'Rita Campos',area:'Educación financiera',next_action:'Responder precios',due_on:T},{id:'i2',stage:'nuevo',name:'Pablo Vera',area:'Informática'},{id:'i3',stage:'conversacion',name:'Hugo Ríos',area:'Educación financiera',next_action:'Enviar programa',due_on:M.plus(T,-2)},{id:'i4',stage:'seguimiento',name:'Marta Díaz',area:'Mentoría',next_action:'Clase de prueba'},{id:'i5',stage:'matriculado',name:'Iván Cruz',area:'Educación financiera'}]};
  }
  if(name==='forma_education'&&act==='list')return{version:1,count:3,has_more:false,items:[{id:'s1',name:'Ana Pérez',phone:'+55 11 90000-0001',courses:[{course:'Educación financiera',state:'activo',total_cents:120000,paid_cents:80000}]},{id:'s2',name:'Luis Gómez',phone:'+55 11 90000-0002',courses:[{course:'Inversiones básicas',state:'activo',total_cents:90000,paid_cents:90000}]},{id:'s3',name:'Carlos Rojas',phone:'',courses:[{course:'Mentoría particular',state:'activo',total_cents:240000,paid_cents:120000}]}]};
  return null;
}
boot();
})();
