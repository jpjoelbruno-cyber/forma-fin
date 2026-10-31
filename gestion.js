/* FORMÁ Gestión nueva: una sola estructura (barra de PC / barra inferior de celular).
   Lee los mismos datos reales de FORMA por las mismas funciones del servidor. Es la app de gestión única:
   matricular, cobrar, corregir contratos y pagos, grupos y agenda se hacen aquí; todo se valida en el servidor. */
(function(){'use strict';
var M=window.FormaAgendaModel,FI=window.FormaAgendaIncomeModel||{};
var $=function(s,r){return(r||document).querySelector(s)};
var demo=new URLSearchParams(location.search).get('vista')==='ejemplo';
var client=null,role=null,userEmail='',installEvt=null;
var IC={doc:'<path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 0 0 0-6M21 20c0-2.5-1.5-4.6-4-5.5"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'};
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
var NAV=[['inicio','Inicio','home'],['agenda','Agenda','cal'],['cursos','Cursos','cap'],['cobros','Cobros','cash'],['cierre','Cierre de caja','doc'],['alumnos','Alumnos','users'],['interesados','Ventas','chat']];
function navFor(){var n=manager()?NAV.slice():NAV.slice(0,2);if(role==='owner')n.push(['admin','Administración','gear']);return n}
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
  var acts=manager()?'<div class="acts" style="margin-bottom:16px"><button class="act a1" data-act="cobrar">'+ico('cash')+'<span>Cobrar un pago<small>Y dar su comprobante</small></span></button><button class="act a2" data-act="matricular">'+ico('cap')+'<span>Matricular un alumno<small>Paso a paso</small></span></button><button class="act a3" data-act="agendar">'+ico('cal')+'<span>Agendar un servicio<small>Elige día y hora</small></span></button><button class="act a4" data-act="interesado">'+ico('chat')+'<span>Nuevo interesado<small>Guardar contacto</small></span></button><button class="act a1" data-act="salida">'+ico('cash')+'<span>Registrar una salida<small>Gasto o pago que sale</small></span></button><button class="act a2" data-act="cerrarcaja">'+ico('cash')+'<span>Cerrar caja del día<small>Resumen y envío por WhatsApp</small></span></button></div>':'';
  var k='';
  if(manager()){
    var dm=cur&&prev?delta(Number(cur.received_cents),Number(prev.received_cents),'vs mes anterior'):null,w=((D.crmAlerts&&D.crmAlerts.total_count)||0),ov=overdue();
    k+=kpi('Cobrado en '+MESL[M.date(T).getUTCMonth()],cur?R0(Number(cur.received_cents)):'—','in',dm&&dm.t,dm&&dm.c);
    k+=kpi('Por cobrar',p?R0(Number(p.total_cents)):'—','out',p?(Number(p.total_count)+' con saldo'+(ov.length?' · '+ov.length+' vencidos':'')):'',ov.length?'down':'flat');
  }
  k+=kpi('Clases hoy',String(mine.length),'',mine.length?'Próxima '+hourLabel(nextHour(mine)):'Día libre','flat');
  if(manager())k+=kpi('Clientes esperando',String((D.crmAlerts&&D.crmAlerts.total_count)||0),'',((D.crmAlerts&&D.crmAlerts.total_count)?'Piden una respuesta':'Todo respondido'),(D.crmAlerts&&D.crmAlerts.total_count)?'down':'up');
  var hoy=mine.map(function(e){var a=attendanceOf(e.b,T);return '<div class="row"><span class="hour">'+hourLabel(e.b.start_hour)+'</span><div class="t"><b>'+esc(e.b.client)+'</b><span>'+esc(e.b.activity)+(e.b.sessions>1?' · Encuentro '+(e.n+1)+' de '+e.b.sessions:'')+(a&&a.status==='realizada'?' · registrada':'')+'</span></div><button class="btn s sm" data-act="asist">Abrir</button></div>'}).join('')||'<p class="note" style="margin:0">No hay clases agendadas hoy.</p>';
  var aten=av.slice(0,4).map(function(a){return '<div class="row"><div class="t"><b>'+esc(a.t)+'</b><span>'+esc(a.s)+'</span></div><button class="btn p sm" data-act="'+a.act+'">'+({cobrar:'Cobrar',asist:'Registrar',interesados:'Responder'})[a.act]+'</button></div>'}).join('')||'<p class="note" style="margin:0">Nada pendiente. Todo al día.</p>';
  var chart=manager()?'<section class="card c4"><h2>Entradas del mes <button class="link" data-v="cobros">Ver cobros</button></h2>'+(cur?bars(cur,'day'):'<p class="note">No se pudo cargar.</p>')+'</section>':'';
  return head(sal+(userName()?', '+esc(userName()):''),'Lo que necesitas hacer hoy, a un toque.')+acts+'<div class="grid">'+k+
   '<section class="card c4"><h2>Hoy <button class="link" data-v="agenda">Ver agenda</button></h2><div class="list">'+hoy+'</div></section>'+
   '<section class="card c4"><h2>Necesita tu atención <button class="link" data-go="avisos">Ver todo</button></h2><div class="list">'+aten+'</div></section>'+chart+'</div>';
};
function nextHour(list){var n=spNow(),f=list.filter(function(e){return e.b.start_hour>n.hour})[0]||list[0];return f.b.start_hour}
function userName(){return ''}
var agView=(function(){try{var v=localStorage.getItem('forma-ag-vista');if(v==='month'||v==='week'||v==='day')return v}catch(e){}return 'week'})();D.agRef=T;if(M.date(T).getUTCDay()===0)D.agRef=M.plus(T,1);
var agIns='Todos',agDens=(function(){try{var v=localStorage.getItem('forma-ag-dens');if(v==='det'||v==='cmp')return v}catch(e){}return window.innerWidth>=1100?'det':'cmp'})();
var INS_C=['#7C3AED','#0D9488','#F97316','#2563EB','#DB2777','#CA8A04','#0891B2','#DC2626'];
function insCol(n){var h=0;for(var i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))>>>0;return INS_C[h%INS_C.length]}
function kindOf(b){return M.isPodcast(b)?'o':(b.activity==='Clase grupal'||b.group_name)?'g':'v'}
function insList(b){return M.teachers(b).filter(function(t){return t!=='Sin asignar'})}
function insChip(b){var l=insList(b);if(!l.length)return '<span class="ag-i"><span class="ag-av" style="background:#9A91BC">?</span>Sin asignar</span>';return '<span class="ag-i">'+l.slice(0,3).map(function(n){return '<span class="ag-av" style="background:'+insCol(n)+'">'+esc(n.charAt(0))+'</span>'}).join('')+esc(l.join(' · '))+'</span>'}
function stLabel(b,day){try{return M.state(b,day)}catch(e){return ''}}
function lanes(list){
  var out=[],cl=[],end=0;
  list.forEach(function(s){
    var a=s.b.start_hour,z=Math.min(18,a+s.b.duration);
    if(!cl.length||a>=end){flush();cl=[];end=0}
    var lane=0;while(cl.some(function(c){return c.lane===lane&&c.z>a}))lane++;
    var o={s:s,a:a,z:z,lane:lane};cl.push(o);out.push(o);end=Math.max(end,z);o.cl=cl;
  });
  function flush(){var m=0;cl.forEach(function(c){m=Math.max(m,c.lane+1)});cl.forEach(function(c){c.n=m})}
  flush();return out;
}
var DN=function(d){return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][M.date(d).getUTCDay()]};
var DNF=function(d){return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][M.date(d).getUTCDay()]};
function agFirst(ref){return ref.slice(0,8)+'01'}
function agLast(ref){var d=M.date(ref);return M.iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)))}
function agRange(){
  var r=D.agRef;
  if(agView==='day')return{from:r,to:r};
  if(agView==='month')return{from:M.monday(agFirst(r)),to:M.plus(M.monday(agLast(r)),5)};
  var f=M.monday(r);return{from:f,to:M.plus(f,5)};
}
function agKey(){var r=agRange();return r.from+'|'+r.to}
function agSync(){D.weekFrom=M.monday(D.agRef);D.week=null}
function agSetView(v){agView=v;try{localStorage.setItem('forma-ag-vista',v)}catch(e){}if(v==='day'&&M.date(D.agRef).getUTCDay()===0)D.agRef=M.plus(D.agRef,1);agSync();render();loadWeek()}
function agNav(n){
  var r=D.agRef;
  if(n===0){r=T;if(M.date(r).getUTCDay()===0)r=M.plus(r,1)}
  else if(agView==='week')r=M.plus(r,7*n);
  else if(agView==='day'){do{r=M.plus(r,n>0?1:-1)}while(M.date(r).getUTCDay()===0)}
  else{var d=M.date(agFirst(r));r=M.iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)))}
  D.agRef=r;agSync();render();loadWeek();
}
function agHead(days){
  var title,cur;
  if(agView==='month'){var d=M.date(D.agRef);title=MESL[d.getUTCMonth()]+' '+d.getUTCFullYear();cur=agFirst(D.agRef)===agFirst(T)}
  else if(agView==='day'){title=DNF(D.agRef)+' '+dl(D.agRef)+(D.agRef===T?' · hoy':'');cur=D.agRef===T}
  else{title=dl(days[0])+' – '+dl(days[5])+' · lunes a sábado, 13:00 a 18:00';cur=M.monday(T)===days[0]}
  var views='<div class="seg" role="group" aria-label="Vista">'+[['month','Mes'],['week','Semana'],['day','Día']].map(function(v){return '<button data-agv="'+v[0]+'" aria-pressed="'+(agView===v[0])+'">'+v[1]+'</button>'}).join('')+'</div>';
  var nav='<div class="seg" role="group" aria-label="Navegar"><button data-wk="-1" aria-label="Anterior">←</button><button data-wk="0" aria-pressed="'+cur+'">Hoy</button><button data-wk="1" aria-label="Siguiente">→</button></div>';
  return head('Agenda',title,views+nav+(manager()?'<button class="btn s" data-act="cobrar">'+ico('cash')+'Cobrar un pago</button><button class="btn p" data-act="agendar">'+ico('plus')+'Agendar servicio</button>':''));
}
function agMonth(bk,ok){
  var r=agRange(),first=agFirst(D.agRef),last=agLast(D.agRef),h='<div class="mo"><div class="mo-h">'+['Lun','Mar','Mié','Jue','Vie','Sáb'].map(function(x){return '<div>'+x+'</div>'}).join('')+'</div><div class="mo-g">',d=r.from;
  while(d<=r.to){
    var inM=d>=first&&d<=last,l=sessionsOn(d,bk).filter(function(s){return ok(s.b)}),dd=d;
    var chips=l.slice(0,3).map(function(s){var b=s.b,k=kindOf(b);return '<button type="button" class="mo-c '+k+'" data-bk="'+esc(b.id)+'" data-day="'+dd+'" title="'+esc(b.client+' · '+hourLabel(b.start_hour)+'–'+hourLabel(b.start_hour+b.duration))+'"><b>'+hourLabel(b.start_hour).replace(':00','')+'</b> '+esc(b.client)+'</button>'}).join('');
    var more=l.length>3?'<button type="button" class="mo-m" data-agday="'+dd+'">+'+(l.length-3)+' más</button>':'';
    var dots=l.length?'<span class="mo-n">'+l.length+'</span>':'';
    h+='<div class="mo-d'+(inM?'':' out')+(d===T?' t':'')+'" data-agday="'+dd+'"><div class="mo-dh"><button type="button" class="mo-num" data-agday="'+dd+'" aria-label="'+esc(DNF(dd)+' '+dl(dd)+(l.length?', '+l.length+' clases':''))+'">'+Number(d.slice(8))+'</button>'+dots+'</div><div class="mo-cs">'+chips+more+'</div></div>';
    d=M.plus(d,M.date(d).getUTCDay()===6?2:1);
  }
  return h+'</div></div>';
}
V.agenda=function(){
  var from=D.weekFrom,days=agView==='day'?[D.agRef]:[0,1,2,3,4,5].map(function(i){return M.plus(from,i)}),hrs=[13,14,15,16,17];
  var bk=(D.week&&D.week.bookings)||[],HH=agDens==='det'?142:78;
  var names={};bk.forEach(function(b){insList(b).forEach(function(n){names[n]=1})});var nl=Object.keys(names).sort();
  if(agIns!=='Todos'&&!names[agIns])agIns='Todos';
  function ok(b){var curso=kindOf(b)==='g';if(!(agFilter==='Todo'||(agFilter==='Cursos'?curso:!curso)))return false;return agIns==='Todos'||insList(b).indexOf(agIns)>-1}
  var insBar=nl.length?'<span class="chips" role="group" aria-label="Instructor"><button class="chip" data-agi="Todos" aria-pressed="'+(agIns==='Todos')+'">Todo el equipo</button>'+nl.map(function(n){return '<button class="chip" data-agi="'+esc(n)+'" aria-pressed="'+(agIns===n)+'"><span class="ag-av" style="background:'+insCol(n)+'">'+esc(n.charAt(0))+'</span>'+esc(n)+'</button>'}).join('')+'</span>':'';
  var bar='<div class="ag-bar"><div class="chips" role="group" aria-label="Tipo">'+['Todo','Servicios','Cursos'].map(function(c){return '<button class="chip" data-ag="'+c+'" aria-pressed="'+(agFilter===c)+'">'+c+'</button>'}).join('')+'</div>'+insBar+'<span class="ag-sp"></span>'+(agView==='month'?'':'<div class="seg ag-dens" role="group" aria-label="Densidad"><button data-agd="det" aria-pressed="'+(agDens==='det')+'">Detallado</button><button data-agd="cmp" aria-pressed="'+(agDens==='cmp')+'">Compacto</button></div>')+'</div>';
  if(agView==='month')return agHead(days)+bar+'<div class="ag-leg"><span><i style="background:#4338CA"></i>Servicio</span><span><i style="background:#0F766E"></i>Clase grupal</span><span><i style="background:#B45309"></i>Otro / podcast</span></div>'+(D.week?'':'<p class="skel" role="status">Cargando agenda…</p>')+agMonth(bk,ok);
  var cols='';
  days.forEach(function(d,i){
    var l=sessionsOn(d,bk).filter(function(s){return ok(s.b)}),ln=lanes(l),h='';
    hrs.forEach(function(hr){
      var busy=l.some(function(s){return hr>=s.b.start_hour&&hr<s.b.start_hour+s.b.duration});
      if(!busy&&manager())h+='<button class="ag-free" data-act="agendar" style="top:'+((hr-13)*HH)+'px;height:'+HH+'px">+ Libre</button>';
    });
    ln.forEach(function(o){
      var b=o.s.b,k=kindOf(b),w=100/o.n,st=stLabel(b,d),top=(o.a-13)*HH,ht=Math.max(1,o.z-o.a)*HH-6;
      var pc=b.booking_state==='por_confirmar'?' pc':'',tm=hourLabel(b.start_hour)+'–'+hourLabel(b.start_hour+b.duration);
      var inner=agDens==='det'
        ?'<div class="t"><span>'+tm+'</span><span class="st">'+esc(st)+'</span></div><div class="n">'+esc(M.isPodcast(b)?b.client:b.client)+'</div><div class="a">'+esc(M.isPodcast(b)?'Invitación para podcast':b.activity)+(b.area&&!M.isPodcast(b)?' · '+esc(b.area):'')+(b.room?'<br>'+esc(b.room):'')+'</div>'+insChip(b)
        :'<div class="t"><span>'+tm+'</span></div><div class="n">'+esc(b.client)+'</div>'+(st&&ht>60?'<span class="st">'+esc(st)+'</span>':'');
      h+='<button class="ag-b '+k+pc+(agDens==='cmp'?' cmp':'')+'" data-bk="'+esc(b.id)+'" data-day="'+d+'" style="top:'+(top+3)+'px;height:'+ht+'px;left:calc('+(o.lane*w)+'% + 3px);width:calc('+w+'% - 6px)" aria-label="'+esc(b.client+', '+DN(d)+' '+tm)+'">'+inner+'</button>';
    });
    cols+='<div class="ag-col" style="height:'+(5*HH)+'px;--hh:'+HH+'px">'+h+'</div>';
  });
  var hdr='<div class="ag-h"></div>'+days.map(function(d,i){var n=sessionsOn(d,bk).filter(function(s){return ok(s.b)}).length;return '<div class="ag-h'+(d===T?' t':'')+'">'+DN(d)+' '+d.slice(8)+'<small>'+(d===T?'hoy · ':'')+(n?n+(n===1?' clase':' clases'):'libre')+'</small></div>'}).join('');
  var tcol='<div class="ag-tm">'+hrs.map(function(h){return '<div style="height:'+HH+'px">'+hourLabel(h)+'</div>'}).join('')+'</div>';
  var wk='<div class="ag-wrap"><div class="ag-grid" style="grid-template-columns:56px repeat('+days.length+',minmax(0,1fr))">'+hdr+tcol+cols+'</div></div>';
  var dls=days.map(function(d,i){
    var items=sessionsOn(d,bk).filter(function(s){return ok(s.b)}).map(function(s){var b=s.b,k=kindOf(b),st=stLabel(b,d);return '<button class="ag-row '+k+'" data-bk="'+esc(b.id)+'" data-day="'+d+'"><div class="t"><b>'+hourLabel(b.start_hour)+'–'+hourLabel(b.start_hour+b.duration)+'</b><span class="st">'+esc(st)+'</span></div><div class="n">'+esc(b.client)+'</div><div class="a">'+esc(b.activity+(b.area?' · '+b.area:''))+'</div>'+insChip(b)+'</button>'}).join('');
    return '<div class="card day"><h3>'+DN(d)+' '+dl(d)+'</h3>'+(items||'<span class="free">Sin reservas</span>')+(manager()?'<div><button class="btn s sm" data-act="agendar" style="margin-top:8px">+ Agendar</button></div>':'')+'</div>'}).join('');
  return agHead(days)+bar+'<div class="ag-leg"><span><i style="background:#4338CA"></i>Servicio</span><span><i style="background:#0F766E"></i>Clase grupal</span><span><i style="background:#B45309"></i>Otro / podcast</span></div>'+(D.week?'':'<p class="skel" role="status">Cargando agenda…</p>')+'<div class="agw">'+wk+'</div><div class="days">'+dls+'</div>';
};
function openBooking(id,day){
  var b=((D.week&&D.week.bookings)||[]).filter(function(x){return x.id===id})[0];if(!b)return;
  var NMF=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],n=-1;try{n=M.occurrence(b,day)}catch(e){}
  var dd=M.date(day),when=NMF[dd.getUTCDay()]+' '+dl(day)+(day===T?' (hoy)':'')+' · '+hourLabel(b.start_hour)+'–'+hourLabel(b.start_hour+b.duration);
  var att=attendanceOf(b,day),attL={asistio:'Asistió',no_asistio:'No asistió',cancelado:'Cancelada'}[att&&att.status]||(day<=T?'Sin registrar':'Pendiente');
  var k=function(l,v){return v?'<div class="ag-k"><span>'+l+'</span><b>'+v+'</b></div>':''};
  var prog=b.sessions>1&&n>=0?'<div class="ag-k"><span>Avance</span><b>Encuentro '+(n+1)+' de '+b.sessions+'</b></div><div class="ag-prog"><i style="width:'+Math.round((n+1)/b.sessions*100)+'%"></i></div>':'';
  var h='<div class="ag-det"><span class="st">'+esc(stLabel(b,day))+'</span>'+k('Cuándo',esc(when))+k('Actividad',esc(M.isPodcast(b)?'Invitación para podcast':b.activity))+k('Área',esc(b.area||''))+k('Grupo',esc(b.group_name||''))+k('Sala',esc(b.room||''))+k('Instructor',esc(insList(b).join(' · ')||'Sin asignar'))+k('Teléfono',esc(b.phone||''))+k('Referencia',esc(b.student_reference||''))+k('Asistencia',esc(attL))+prog+'</div>'
   +(manager()?'<div class="fi-acts">'+(kindOf(b)==='g'?'<button class="btn p" data-act="asist">Registrar la clase</button>':'')+'<button class="btn '+(kindOf(b)==='g'?'s':'p')+'" data-act="cobrar">Cobrar un pago</button><button class="btn s" data-act="editres" data-bid="'+esc(b.id)+'">Reprogramar o cancelar</button></div>':'');
  dlg(esc(b.client),h,false);
}
V.cierre=function(){return manager()&&window.GestionCierres?window.GestionCierres.html():V.inicio()};
V.cobros=function(){
  if(cobTab==='cierre')cobTab='resumen';
  var tabs='<div class="seg" role="tablist">'+[['resumen','Resumen'],['porcobrar','Por cobrar'],['salidas','Salidas'],['mov','Movimientos']].map(function(t){return '<button data-ct="'+t[0]+'" aria-pressed="'+(cobTab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>';
  var per='<div class="seg" role="group" aria-label="Período">'+['Hoy','Semana','Mes','Año'].map(function(p){return '<button data-cp="'+p+'" aria-pressed="'+(cobPer===p)+'">'+p+'</button>'}).join('')+'</div>';
  var h=head('Cobros','Lo que entra, lo que sale y lo que falta cobrar.','<button class="btn p" data-act="cobrar">'+ico('plus')+'Cobrar un pago</button><button class="btn s" data-act="salida">'+ico('plus')+'Registrar una salida</button>')+'<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;margin-bottom:16px">'+tabs+(cobTab==='porcobrar'?'':per)+'</div>';
  var rr=periodRange(cobPer),d=D.reports[rr.cur.from+'|'+rr.cur.to+'|'+rr.cur.bucket],pv=D.reports[rr.prev.from+'|'+rr.prev.to+'|'+rr.prev.bucket];
  if(cobTab==='porcobrar'){
    var p=D.pending,items=(p&&p.items)||[];
    return h+'<div class="grid"><section class="card c12"><h2>Alumnos y clientes con saldo pendiente'+(p?' · '+R(Number(p.total_cents)):'')+'</h2><input class="search" id="pq" placeholder="Buscar por nombre, teléfono o curso" aria-label="Buscar" value="'+esc(D.pendQuery)+'" style="margin-bottom:12px"><div class="tw"><table><thead><tr><th>Cliente</th><th>Curso o servicio</th><th>Vencimiento</th><th style="text-align:right">Debe</th><th></th></tr></thead><tbody>'+(items.map(function(a){return '<tr><td><b>'+esc(a.client)+'</b></td><td>'+esc(a.activity||'')+(a.group_name?'<br><span style="color:var(--ink2);font-size:13px">'+esc(a.group_name)+'</span>':'')+'</td><td><span class="pill '+(a.due_status==='Vencido'?'down':'flat')+'">'+esc(a.due_on?a.due_status+' · '+dl(a.due_on):'Sin fecha')+'</span></td><td class="num out" style="text-align:right"><b>'+R(Number(a.pending_cents))+'</b></td><td style="text-align:right"><button class="btn p sm" data-act="cobrar">Cobrar</button></td></tr>'}).join('')||'<tr><td colspan="5" class="note">'+(p?'Nada pendiente.':'Cargando…')+'</td></tr>')+'</tbody></table></div>'+(p&&p.has_more?'<p class="note"><button class="link" id="pmore">Ver más</button></p>':'')+'</section></div>';
  }
  if(!d)return h+'<p class="skel" role="status">Cargando '+cobPer.toLowerCase()+'…</p>';
  if(cobTab==='salidas'){
    var os=(d.outflows||[]),tot=Number(d.outflow_cents||0),ex=Number(d.expense_cents||0),rf=Number(d.refund_cents||0),cat={};
    os.forEach(function(o){var k=(o.category||'Sin categoría')+(o.kind==='reembolso'?' (reembolso)':'');cat[k]=(cat[k]||0)+Number(o.amount_cents)});
    var cr=Object.keys(cat).map(function(k){return{label:k,cents:cat[k]}}).sort(function(a,b){return b.cents-a.cents});
    var rows=os.map(function(o){return '<div class="row"><div class="t"><b>'+esc(o.category||'Salida')+(o.kind==='reembolso'?' · reembolso':'')+'</b><span>'+esc(methodLabel(o.method))+' · '+esc(dl(o.paid_on))+(o.note?' · '+esc(o.note):'')+'</span></div><span class="v num out">− '+R(Number(o.amount_cents))+'</span>'+(o.kind==='gasto'?'<button class="btn s sm" data-act="voidout" data-oid="'+esc(o.id)+'">Anular</button>':'')+'</div>'}).join('');
    return h+'<div class="grid">'+kpi('Salidas del período',R(tot),'out',cobPer.toLowerCase(),'flat')+kpi('Gastos',R(ex),'out','Alquiler, servicios, materiales…','flat')+kpi('Reembolsos',R(rf),'out','Devueltos a alumnos','flat')+kpi('Entradas del período',R(Number(d.received_cents)),'in','Para comparar','flat')+'<section class="card c8"><h2>Salidas registradas</h2><div class="list">'+(rows||'<p class="note" style="margin:0">Aún no hay salidas en este período. Usa «Registrar una salida» cuando pagues algo.</p>')+'</div>'+(os.length>=100?'<p class="note">Se muestran las más recientes.</p>':'')+'</section><section class="card c4"><h2>¿En qué salió el dinero?</h2>'+hbars(cr)+'</section></div>';
  }
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
   '<div class="grid"><section class="card c8"><div class="tw"><table class="rt"><thead><tr><th>Alumno</th><th>Curso</th><th>Estado</th><th style="text-align:right">Saldo</th><th></th></tr></thead><tbody>'+(rows.map(function(x){var p=x.p,i=x.i,names=(i.act.length?i.act:(p.courses||[])).map(function(c){return c.course}).join(', ');return '<tr><td><b>'+esc(p.name)+'</b><br><span style="color:var(--ink2);font-size:13px">'+esc(p.phone||'')+'</span></td><td>'+esc(names||'Sin curso')+'</td><td><span class="pill '+(i.debt>0?'down':'up')+'">'+(i.debt>0?'con saldo':'al día')+'</span></td><td class="num '+(i.debt?'out':'in')+'" style="text-align:right"><b>'+R(i.debt)+'</b></td><td style="text-align:right">'+'<button class="btn s sm" data-ficha="'+esc(p.id)+'">Ver ficha</button>'+(i.debt>0&&manager()?' <button class="btn p sm" data-act="cobrar" data-pid="'+esc(p.id)+'">Cobrar</button>':'')+'</td></tr>'}).join('')||'<tr><td colspan="5" class="note">'+(D.edu?'No hay alumnos con ese filtro.':'Cargando…')+'</td></tr>')+'</tbody></table></div>'+(D.eduMore?'<p class="note"><button class="link" id="emore">Ver más alumnos</button></p>':'')+'</section>'+
   '<section class="card c4"><h2>Cursos activos</h2><div class="list">'+(cs.map(function(c){return '<div class="row"><div class="t"><b>'+esc(c)+'</b><span>'+cc[c]+' alumno'+(cc[c]>1?'s':'')+'</span></div></div>'}).join('')||'<p class="note" style="margin:0">Sin cursos activos en la lista cargada.</p>')+'</div></section></div>';
};
var STG=[['nuevo','Nuevo'],['conversacion','En conversación'],['seguimiento','Seguimiento'],['preparar_matricula','Preparando matrícula'],['matriculado','Matriculado']];
V.interesados=function(){
  var s=D.crmSales;if(!s)return head('Ventas','Embudo de ventas: quién espera respuesta y en qué etapa está.','')+'<p class="skel" role="status">'+(errors.indexOf('interesados')>-1?'No se pudo cargar.':'Cargando…')+'</p>';
  return window.GestionEmbudo.html(s,head);
};
V.avisos=function(){
  var a=avisos();
  return head('Avisos','Cobranza y pendientes que piden una acción.','')+'<section class="card"><div class="list">'+(a.map(function(x){return '<div class="row"><span class="pill '+(x.k==='bad'?'down':x.k==='up'?'up':'flat')+'" style="'+(x.k==='warn'?'background:var(--warnbg);color:var(--warn)':'')+'">'+esc(x.t)+'</span><div class="t"><span style="color:var(--ink)">'+esc(x.s)+'</span></div><button class="btn s sm" data-act="'+x.act+'">'+({cobrar:'Cobrar',asist:'Registrar',interesados:'Responder'})[x.act]+'</button></div>'}).join('')||'<p class="note" style="margin:0">Sin avisos. Todo al día.</p>')+'</div></section>';
};
V.cursos=function(){return manager()?window.GestionCursos.html():head('Cursos','Solo para administración.','')};
/* Administración vive aquí dentro (solo propietario): el servidor sigue validando el rol en cada consulta. */
V.admin=function(){return role==='owner'&&window.FormaAdmin?head('Administración','Personas, accesos, cursos online y uso de FORMÁ.','')+window.FormaAdmin.html():head('Administración','Solo para el propietario de FORMA.','')};
V.ajustes=function(){
  function row(t,s,a){return '<div class="row"><div class="t"><b>'+t+'</b><span>'+s+'</span></div>'+(a?'<button class="btn s sm" data-act="'+a+'">Abrir</button>':'<span class="pill flat">Disponible pronto</span>')+'</div>'}
  return head('Ajustes','Datos de FORMA y de tu cuenta.','')+'<section class="card"><div class="list">'+(manager()?row('Instructores','Quién da clases: agregar o desactivar','instructores'):'<p class="note">Aquí aparecerán los ajustes de tu cuenta.</p>')+'</div><p class="note">Cuentas y control de caja, respuestas preparadas e historial de agenda todavía no están en esta pantalla.</p></section>';
};

/* ---------- carga perezosa por vista ---------- */
function ensure(){
  if(view==='cierre'&&manager()&&window.GestionCierres){window.GestionCierres.ensure();return}
  if(view==='cobros'&&manager()&&cobTab!=='porcobrar'){var rr=periodRange(cobPer);Promise.all([getReport(rr.cur),getReport(rr.prev)]).then(function(){if(view==='cobros')render()},function(){errors.push('cobros');toast('No se pudo cargar ese período.')})}
  if(view==='alumnos'&&manager()&&!D.edu)loadEdu(false);
  if(view==='agenda')loadWeek();
  if(view==='cursos'&&manager()&&!window.GestionCursos.loaded){window.GestionCursos.loaded=true;window.GestionCursos.load().then(function(){if(view==='cursos')render()})}
}
function loadEdu(more){
  var off=more?D.eduOffset+30:0;
  edu('list',{query:D.eduQuery,offset:off,state:''}).then(function(d){var items=(d&&d.items)||[];D.edu={items:more&&D.edu?D.edu.items.concat(items):items};D.eduOffset=off;D.eduMore=!!(d&&d.has_more);if(view==='alumnos')render()},function(){toast('No se pudo cargar la lista de alumnos.');if(!D.edu)D.edu={items:[]};if(view==='alumnos')render()});
}
function loadWeek(){
  var r=agRange(),key=agKey();
  rpc('forma_agenda_list',{p_from:r.from,p_to:r.to}).then(function(d){if(key!==agKey())return;D.week=d;if(view==='agenda')render()},function(){toast('No se pudo cargar la agenda.')});
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
  if(view==='admin'&&role==='owner'&&window.FormaAdmin)window.FormaAdmin.mount();
  var n=avisos().length,dot=$('#nAv');dot.textContent=n>9?'9+':String(n);dot.hidden=!n;
  if(keep&&$('#'+keep)){var el=$('#'+keep);el.focus();try{el.setSelectionRange(pos,pos)}catch(e){}}
}
function mark(){document.querySelectorAll('[data-v]').forEach(function(b){if(b.dataset.v===view||(b.dataset.v==='mas'&&['cierre','alumnos','interesados','ajustes','avisos','admin'].indexOf(view)>-1))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function buildNav(){
  var nv=navFor();
  $('#tabs').innerHTML=nv.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+n[1]+'</button>'}).join('');
  var first=nv.slice(0,manager()?4:2);
  $('#bnav').style.gridTemplateColumns='repeat('+(first.length+1)+',1fr)';
  $('#bnav').innerHTML=first.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+'<span>'+n[1]+'</span></button>'}).join('')+'<button data-v="mas">'+ico('more')+'<span>Más</span></button>';
}
var NAVK='forma-gs-nav';
function navSave(y){try{localStorage.setItem(NAVK,JSON.stringify({v:view,ct:cobTab,cp:cobPer,y:y==null?window.scrollY:y,t:Date.now()}))}catch(e){}}
function navLoad(){try{var o=JSON.parse(localStorage.getItem(NAVK)||'null');return o&&Date.now()-o.t<7*864e5?o:null}catch(e){return null}}
function go(v){if(!V[v])v='inicio';view=v;$('#sheet').hidden=true;$('#menu').hidden=true;try{history.replaceState(null,'','#'+v)}catch(e){}render();mark();window.scrollTo(0,0);ensure();navSave(0)}
function openMas(){
  $('#sheetIn').innerHTML=(manager()?'<button data-v="cierre">'+ico('doc')+'Cierre de caja</button><button data-v="alumnos">'+ico('users')+'Alumnos</button><button data-v="interesados">'+ico('chat')+'Ventas</button>':'')+'<button data-go="avisos">'+ico('chat')+'Avisos</button><button data-act="presupuesto">'+ico('cash')+'Ir a mi espacio de alumno</button>'+(role==='owner'?'<button data-v="admin">'+ico('gear')+'Administración</button>':'')+'<button data-go="ajustes">'+ico('gear')+'Ajustes</button><button data-act="theme">Cambiar claro / oscuro</button><button data-act="out" style="color:var(--bad);border-color:var(--badbg)">Cerrar sesión</button>';
  $('#sheet').hidden=false;
}
function dlg(title,body,wide){$('#dlg').style.width=wide?'min(900px,calc(100vw - 24px))':'';$('#dlg').innerHTML='<div class="dh"><h2>'+title+'</h2><button data-act="cerrar" aria-label="Cerrar">×</button></div><div class="db">'+body+'</div>';$('#dlg').showModal()}

/* ---------- ficha del alumno (solo lectura) ---------- */
var FI_STATE={activo:'En curso',matriculado:'Matriculado',pausa:'En pausa',cancelado:'Cancelado',concluido:'Concluido'},FI_SEL=null;
function hm(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function openFicha(id){
  dlg('Ficha del alumno','<p class="skel" role="status">Consultando ficha…</p>',true);
  edu('detail',{person_id:id}).then(function(d){
    if(!d||!d.person)throw Error('ficha');
    D.ficha=d;FI_SEL=(d.enrolments&&d.enrolments[0]&&d.enrolments[0].id)||null;paintFicha();
  },function(){dlg('Ficha del alumno','<div class="err">No se pudo cargar la ficha. No se cambió nada.</div>')});
}
function paintFicha(){
  var d=D.ficha,p=d.person,en=d.enrolments||[],e=en.filter(function(x){return x.id===FI_SEL})[0]||en[0];
  var ini=(p.name||'?').split(/\s+/).slice(0,2).map(function(x){return x[0]}).join('');
  var h='<div class="fi-id"><span class="fi-av">'+esc(ini)+'</span><div><h3>'+esc(p.name)+'</h3><span>'+esc(p.phone||'Sin teléfono')+' · '+esc(p.email||'Sin correo')+'</span></div></div>';
  if(!e){return dlg('Ficha de '+esc(p.name),h+'<p class="note">Todavía no tiene cursos vinculados.</p><button class="btn p" data-act="matricular" data-pid="'+esc(p.id)+'">Matricular en un curso</button>',true)}
  var ses=(d.sessions||[]).filter(function(x){return x.enrolment_id===e.id}).sort(function(a,b){return a.day<b.day?-1:1});
  var total=Math.max(Number(e.planned_encounters||0),ses.length),att=ses.filter(function(x){return x.attendance==='asistio'}).length,miss=ses.filter(function(x){return x.attendance==='no_asistio'}).length;
  var rec=(d.receipts||[]).filter(function(r){return r.enrolment_id===e.id&&!r.voided_at}).sort(function(a,b){return a.paid_on<b.paid_on?1:-1});
  var adv=rec.filter(function(r){return /adelanto de matr|reserva de inscrip/i.test(r.note||'')}).reduce(function(n,r){return n+Number(r.amount_cents)},0);
  var bal=Math.max(0,Number(e.total_cents)-Number(e.paid_cents)),nx=ses.filter(function(x){return x.day>=T&&['asistio','no_asistio','cancelado'].indexOf(x.attendance)<0})[0];
  var deb=(d.debts||[]).filter(function(x){return x.enrolment_id===e.id&&!x.cancelled}).sort(function(a,b){return(a.due_on||'9')<(b.due_on||'9')?-1:1});
  var sel=en.length>1?'<label class="fi-sel">Curso<select id="fiSel">'+en.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===e.id?' selected':'')+'>'+esc(x.course+' · '+(x.group_name||FI_STATE[x.state]||x.state))+'</option>'}).join('')+'</select></label>':'';
  var k=function(l,v,s,c){return '<div class="fi-k"><small>'+l+'</small><b class="num '+(c||'')+'">'+v+'</b>'+(s?'<span>'+s+'</span>':'')+'</div>'};
  h+=sel+'<div class="fi-head"><h3>'+esc(e.course)+'</h3><span class="pill '+(e.state==='cancelado'?'flat':'up')+'">'+esc(FI_STATE[e.state]||e.state)+'</span><span class="note">'+esc(e.group_name||'Sin grupo')+(e.starts_on?' · '+dl(e.starts_on)+(e.ends_on?' → '+dl(e.ends_on):''):'')+'</span></div>';
  h+='<div class="fi-ks">'+k('Valor del curso',R(Number(e.total_cents)))+k('Ya pagó',R(Number(e.paid_cents)),adv?'Incluye '+R(adv)+' de reserva':'','in')+k('Falta pagar',R(bal),miss?miss+' no asistió':'',bal?'out':'in')+k('Asistió',att+' de '+(total||'—'),nx?'Próxima clase: '+dl(nx.day):'Sin próxima clase')+'</div>';
  var pl=deb.length?deb.map(function(x){var rest=Number(x.total_cents)-Number(x.paid_cents),st=rest<=0?['Pagado','up']:Number(x.paid_cents)>0?['Parcial','flat']:(x.due_on&&x.due_on<T?['Vencido','down']:['Pendiente','flat']);return '<div class="row"><div class="t"><b>'+esc(x.area||'Cuota')+'</b><span>Vence '+(x.due_on?dl(x.due_on):'sin fecha')+(rest>0&&Number(x.paid_cents)>0?' · faltan '+R(rest):'')+'</span></div><span class="v num">'+R(Number(x.total_cents))+'</span><span class="pill '+st[1]+'">'+st[0]+'</span></div>'}).join(''):'<p class="note" style="margin:0">Sin cuotas registradas.</p>';
  var pg=rec.slice(0,8).map(function(r){return '<div class="row"><div class="t"><b>'+dl(r.paid_on)+'</b><span>'+esc(methodLabel(r.method))+(r.note?' · '+esc(r.note):'')+'</span></div><span class="v num in">'+R(Number(r.amount_cents))+'</span>'+(manager()?'<button class="btn s sm" data-act="fixpay" data-rid="'+esc(r.id)+'">Corregir</button>':'')+'</div>'}).join('')||'<p class="note" style="margin:0">Aún no hay pagos confirmados.</p>';
  var cl=ses.filter(function(x){return x.day>=M.plus(T,-14)}).slice(0,8).map(function(x){var a=x.attendance||'pendiente',b=a==='asistio'?['Asistió','up']:a==='no_asistio'?['No asistió','down']:a==='cancelado'?['Cancelada','flat']:(x.day<T?['Sin confirmar','flat']:['Programada','flat']);return '<div class="row"><div class="t"><b>'+dl(x.day)+' · '+hm(x.start_min||0)+'</b><span>'+esc(x.module||'Encuentro')+(x.instructor?' · '+esc(x.instructor):'')+(x.room?' · '+esc(x.room):'')+'</span></div><span class="pill '+b[1]+'">'+b[0]+'</span></div>'}).join('')||'<p class="note" style="margin:0">Sin clases vinculadas.</p>';
  var av=(d.payment_notices||[]).filter(function(n){return n.state==='reportado'});
  h+='<div class="fi-g"><section><h4>Plan de pago</h4><div class="list">'+pl+'</div></section><section><h4>Últimos pagos</h4><div class="list">'+pg+'</div></section><section><h4>Clases</h4><div class="list">'+cl+'</div></section></div>';
  if(av.length)h+='<div class="fi-av2">'+av.length+' aviso(s) de pago por revisar: '+av.map(function(n){return R(Number(n.amount_cents))+' · '+dl(n.paid_on)}).join(', ')+'</div>';
  h+='<div class="fi-acts">'+(manager()&&bal>0?'<button class="btn p" data-act="cobrar" data-pid="'+esc(p.id)+'" data-eid="'+esc(e.id)+'">Cobrar un pago</button>':'')+'<button class="btn s" data-act="editmat">Editar matrícula</button>'+(manager()?'<button class="btn s" data-act="contract">Corregir condiciones</button>'+(e.group_id?'<button class="btn s" data-act="movegrp">Cambiar de grupo</button>':'')+'<button class="btn s" data-act="notes">Observaciones</button>':'')+'<button class="btn s" data-act="editperson">Corregir datos</button></div><p class="note">Todo se corrige aquí. Cada corrección pide un motivo y el original queda en el historial; no se borra nada.</p>';
  dlg('Ficha de '+esc(p.name),h,true);
  var s2=$('#fiSel');if(s2)s2.onchange=function(){FI_SEL=this.value;paintFicha()};
}
function act(k,el){
  if(k==='theme'){var r=document.documentElement,nt=r.getAttribute('data-theme')==='dark'?'light':'dark';r.setAttribute('data-theme',nt);try{localStorage.setItem('forma-gestion-theme',nt)}catch(e){}return}
  if(k==='install'){if(installEvt){installEvt.prompt();installEvt=null}else toast('En el menú de tu navegador elige “Instalar app” o “Añadir a pantalla de inicio”.');return}
  if(k==='out'){if(demo){toast('Vista de ejemplo: no hay sesión real.');return}client.auth.signOut().then(function(){location.href='/'},function(){toast('No se confirmó el cierre de sesión. Intenta de nuevo.')});return}
  if(k==='presupuesto'){location.href='/?personal=1';return}
  if(k==='admin'){if(role==='owner')go('admin');return}
  if(k==='cerrar'){$('#dlg').close();return}
  if(k==='interesados'){go('interesados');return}
  if(k==='instructores'){window.GestionCursos.insDialog();return}
  if(k==='cobrar'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.cobrar(el&&el.dataset.pid?{person_id:el.dataset.pid,enrolment_id:el.dataset.eid||null}:null);return}
  if(k==='cerrarcaja'&&manager()){$('#sheet').hidden=true;go('cierre');return}
  if(k==='salida'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.salida();return}
  if(k==='voidout'&&manager()){var oo=null,rp=D.reports,kk;for(kk in rp){((rp[kk]&&rp[kk].outflows)||[]).forEach(function(x){if(x.id===(el&&el.dataset.oid))oo=x})}if(oo)window.GestionAcciones.anularSalida(oo);else toast('No se encontró la salida. Actualiza.');return}
  if(k==='matricular'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.matricular(el&&el.dataset.pid?{person_id:el.dataset.pid}:null);return}
  if(k==='agendar'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.agendar();return}
  if(k==='asist'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.clase();return}
  if(k==='interesado'&&manager()){$('#sheet').hidden=true;window.GestionAcciones.interesado();return}
  if(k==='editres'&&manager()){var bb=((D.week&&D.week.bookings)||[]).filter(function(x){return x.id===(el&&el.dataset.bid)})[0];if(bb){window.GestionAcciones.editarReserva(bb)}else toast('No se encontró la reserva. Actualiza la agenda.');return}
  if(k==='editmat'&&manager()){var ee=((D.ficha&&D.ficha.enrolments)||[]).filter(function(x){return x.id===FI_SEL})[0];if(ee)window.GestionAcciones.editarMatricula(D.ficha.person,ee);return}
  if(k==='fixpay'&&manager()){var rr=((D.ficha&&D.ficha.receipts)||[]).filter(function(x){return x.id===(el&&el.dataset.rid)})[0];if(rr)window.GestionAcciones.corregirPago(D.ficha.person,rr);else toast('No se encontró el pago. Abre la ficha de nuevo.');return}
  if((k==='movegrp'||k==='notes')&&manager()){var en=((D.ficha&&D.ficha.enrolments)||[]).filter(function(x){return x.id===FI_SEL})[0];if(en)window.GestionAcciones[k==='movegrp'?'cambiarGrupo':'observaciones'](D.ficha.person,en,D.ficha);return}
  if(k==='contract'&&manager()){var ec=((D.ficha&&D.ficha.enrolments)||[]).filter(function(x){return x.id===FI_SEL})[0];if(ec)window.GestionAcciones.corregirCondiciones(D.ficha.person,ec,D.ficha);return}
  if(k==='editperson'){if(D.ficha)window.GestionAcciones.corregirPersona(D.ficha.person);return}
  if(k==='viejo'||k==='agenda'){$('#dlg').close&&$('#dlg').close();go('agenda');return}
  toast('Esta opción no está disponible para tu rol.');
}
document.addEventListener('click',function(e){
  if(window.GestionAcciones&&window.GestionAcciones.click(e))return;
  var bkb=e.target.closest('[data-bk]');if(bkb){openBooking(bkb.dataset.bk,bkb.dataset.day);return}
  var agi=e.target.closest('[data-agi]');if(agi){agIns=agi.dataset.agi;render();return}
  var agd=e.target.closest('[data-agd]');if(agd){agDens=agd.dataset.agd;try{localStorage.setItem('forma-ag-dens',agDens)}catch(x){}render();return}
  var fb=e.target.closest('[data-ficha]');if(fb){openFicha(fb.dataset.ficha);return}
  var b=e.target.closest('[data-v]');if(b){if(b.dataset.v==='mas'){openMas();return}go(b.dataset.v);return}
  var g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
  var a=e.target.closest('[data-act]');if(a){act(a.dataset.act,a);return}
  var c=e.target.closest('[data-ct]'),p=e.target.closest('[data-cp]'),al=e.target.closest('[data-al]'),ag=e.target.closest('[data-ag]'),wk=e.target.closest('[data-wk]');
  if(c){cobTab=c.dataset.ct;render();ensure();navSave();return}
  if(p){cobPer=p.dataset.cp;render();ensure();navSave();return}
  if(al){alF=al.dataset.al;render();return}
  if(ag){agFilter=ag.dataset.ag;render();return}
  if(wk){agNav(Number(wk.dataset.wk));return}
  var av=e.target.closest('[data-agv]');if(av){agSetView(av.dataset.agv);return}
  var ad=e.target.closest('[data-agday]');if(ad){D.agRef=ad.dataset.agday;if(M.date(D.agRef).getUTCDay()===0)D.agRef=M.plus(D.agRef,1);agView='day';try{localStorage.setItem('forma-ag-vista','day')}catch(x){}agSync();render();loadWeek();window.scrollTo(0,0);return}
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
  $('#app').innerHTML='<section class="gate card"><h1>FORMÁ Gestión</h1><p>'+esc(msg)+'</p>'+(showLogin?'<a class="btn p" href="/?next=agenda" id="gin">Entrar con mi cuenta de FORMÁ</a>':'')+'</section>';
  $('#tabs').innerHTML='';$('#bnav').hidden=true;
  var gi=$('#gin');if(gi)gi.onclick=function(){try{sessionStorage.setItem('forma-return-agenda','1')}catch(e){}};
}
function boot(){
  var h=(location.hash||'').slice(1),sv=navLoad();
  if(sv){if(!h&&sv.v)h=sv.v;if(sv.ct&&sv.ct!=='cierre')cobTab=sv.ct;if(sv.cp)cobPer=sv.cp;window.__navY=(sv.v===h?sv.y:0)||0}

  if(demo){role=new URLSearchParams(location.search).get('rol')==='propietario'?'owner':'manager';return start(h)}
  var cfg=window.FORMA_CONFIG;
  if(!cfg||cfg.supabaseUrl!=='https://irsuevjqmgpwunvymxbc.supabase.co'||!cfg.publishableKey){gate('La configuración de FORMÁ no está disponible.');return}
  client=supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,flowType:'pkce',storageKey:'forma-independent-auth-v1'}});
  if(window.FormaAdmin)window.FormaAdmin.init({client:client});
  client.auth.getUser().then(function(r){
    if(r.error||!r.data||!r.data.user){gate('Inicia sesión con tu cuenta de FORMÁ para ver tu espacio de trabajo.',true);return}
    userEmail=r.data.user.email||'';
    var uid=r.data.user.id;
    client.auth.onAuthStateChange(function(ev,s){if(ev==='SIGNED_OUT'||(s&&s.user&&s.user.id!==uid))gate('La sesión cambió. Vuelve a entrar.',true)});
    return rpc('forma_agenda_access').then(function(a){
      if(!a||['owner','manager','instructor'].indexOf(a.role)<0){gate('Tu cuenta no tiene acceso a FORMÁ Gestión.');return}
      role=a.role;start(h);
    },function(){gate('No se pudo verificar tu acceso. Vuelve a cargar la página.')});
  },function(){gate('No se pudo verificar tu sesión. Vuelve a cargar la página.')});
}
function start(h){
  buildNav();$('#bnav').hidden=false;if($('#mAdmin'))$('#mAdmin').hidden=role!=='owner';
  view=V[h]&&(manager()||['inicio','agenda','avisos','ajustes'].indexOf(h)>-1)&&(h!=='admin'||role==='owner')?h:'inicio';
  render();mark();
  loadCore().then(function(){render();mark();ensure();if(window.__navY){var yy=window.__navY;window.__navY=0;setTimeout(function(){window.scrollTo(0,yy)},350)}});
  var sT=null;window.addEventListener('scroll',function(){clearTimeout(sT);sT=setTimeout(function(){navSave()},400)},{passive:true});window.addEventListener('pagehide',function(){navSave()});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!demo&&role){D.reports={};loadCore().then(function(){render()})}});
}

/* ---------- datos de ejemplo (mismas formas que el servidor) ---------- */
var _dc=null;
function demoCount(){var c={};_dc.items.forEach(function(i){c[i.stage]=(c[i.stage]||0)+1});['nuevo','conversacion','seguimiento','preparar_matricula','matriculado','cerrado'].forEach(function(k){c[k]=(c[k]||0)});return c}
function demoCrm(){if(!_dc){_dc={items:[{id:'i1',temperature:'caliente',person_id:'p1',version:1,stage:'nuevo',name:'Rita Campos',area:'Educación financiera',next_action:'Responder precios',due_on:T},{id:'i2',temperature:'frio',person_id:'p2',version:1,stage:'nuevo',name:'Pablo Vera',area:'Informática'},{id:'i3',temperature:'tibio',person_id:'p3',version:1,stage:'conversacion',name:'Hugo Ríos',area:'Educación financiera',next_action:'Enviar programa',due_on:M.plus(T,-2)},{id:'i4',temperature:'muy_caliente',person_id:'p4',version:1,stage:'seguimiento',name:'Marta Díaz',area:'Mentoría',next_action:'Clase de prueba'},{id:'i5',temperature:'caliente',person_id:'p5',version:1,stage:'preparar_matricula',name:'Elena Soto',area:'Inversiones básicas',next_action:'Confirmar pago'},{id:'i6',person_id:'p6',version:1,stage:'matriculado',name:'Iván Cruz',area:'Educación financiera'},{id:'i7',person_id:'p7',version:1,stage:'cerrado',name:'Tomás Gil',area:'Informática',close_reason:'Eligió otro lugar'}]};_dc.counts=demoCount()}return _dc}
function demoRpc(name,a){
  var d=a.p_data||{},act=a.p_action;
  if(name==='forma_agenda_access')return{role:'manager'};
  if(name==='forma_academic')return window.GestionCursos.demoAcademic(a);
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
    if(act==='sales'){var dm=demoCrm();var cl=d&&d.stage==='cerrado';return{counts:dm.counts,items:dm.items.filter(function(i){return cl?i.stage==='cerrado':i.stage!=='cerrado'})}}
    if(act==='interest_move'){var it=demoCrm().items.filter(function(i){return i.id===d.id})[0];if(it){it.stage=d.stage;if(d.temperature!==undefined)it.temperature=d.temperature;it.version=(it.version||1)+1;if(d.stage==='cerrado')it.close_reason=d.close_reason;demoCrm().counts=demoCount()}return{saved:true,stage:d.stage,version:it?it.version:2,before_stage:'nuevo'}}
    if(act==='interest_undo')return{saved:true}
  }
  if(name==='forma_education'&&act==='detail')return{person:{id:d.person_id,name:'Ana Pérez',phone:'+55 11 90000-0001',email:'ana@ejemplo.com'},enrolments:[{id:'e1',course:'Educación financiera',state:'activo',group_id:'g3',group_name:'Grupo noviembre',version:1,starts_on:M.plus(T,-20),ends_on:M.plus(T,60),total_cents:120000,paid_cents:80000,planned_encounters:8}],sessions:[0,1,2,3].map(function(i){return{enrolment_id:'e1',day:M.plus(T,-14+i*7),start_min:780,end_min:900,module:'Módulo '+(i+1),instructor:'René',room:'Sala 1',attendance:i<2?'asistio':'pendiente'}}),receipts:[{id:'r1',enrolment_id:'e1',paid_on:M.plus(T,-18),method:'efectivo',amount_cents:20000,note:'Reserva de inscripción'},{id:'r2',enrolment_id:'e1',paid_on:M.plus(T,-5),method:'pix',amount_cents:60000,note:''}],debts:[{enrolment_id:'e1',area:'Cuota 1',due_on:M.plus(T,-5),total_cents:60000,paid_cents:60000},{enrolment_id:'e1',area:'Cuota 2',due_on:M.plus(T,25),total_cents:40000,paid_cents:0}],payment_notices:[]};
  if(name==='forma_education'&&act==='list')return{version:1,count:3,has_more:false,items:[{id:'s1',name:'Ana Pérez',phone:'+55 11 90000-0001',courses:[{course:'Educación financiera',state:'activo',total_cents:120000,paid_cents:80000}]},{id:'s2',name:'Luis Gómez',phone:'+55 11 90000-0002',courses:[{course:'Inversiones básicas',state:'activo',total_cents:90000,paid_cents:90000}]},{id:'s3',name:'Carlos Rojas',phone:'',courses:[{course:'Mentoría particular',state:'activo',total_cents:240000,paid_cents:120000}]}]};
  return null;
}
window.GestionCierres&&window.GestionCierres.init({esc:esc,rpc:rpc,R:R,T:T,demo:demo,dlg:dlg,toast:toast,render:function(){render()},view:function(){return view},refresh:function(){D.reports={}},M:M});
window.GestionAcciones.init({M:M,plus:M.plus,rpc:rpc,edu:edu,esc:esc,dlg:dlg,dl:dl,R:R,T:T,demo:demo,cursos:window.GestionCursos,reficha:function(id){openFicha(id)},refresh:function(){D.edu=null;D.reports={};loadCore().then(function(){render();ensure()})}});
window.GestionEmbudo=window.GestionEmbudo||{init:function(){},click:function(){},html:function(s,h){return h('Ventas','','')+'<p class="skel">Recarga la página para ver el embudo.</p>'}};
window.GestionEmbudo.init({crm:crm,esc:esc,dl:dl,dlg:dlg,plus:ico('plus'),data:function(){return D.crmSales},manager:manager,close:function(){var d=$('#dlg');if(d&&d.open)d.close()},render:function(){if(view==='interesados')render()},reload:function(){crm('sales',{stage:'',offset:0}).then(function(d){D.crmSales=d;D.crmAlerts=null;if(view==='interesados')render()},function(){toast('No se pudo actualizar la lista.')})}});
if(window.FormaAdmin)window.FormaAdmin.onHome=function(){go('inicio')};
window.GestionCursos.init({dlg:dlg,rpc:rpc,esc:esc,render:render,head:head,R:R,M:M,T:T,demo:demo,view:function(){return view}});
document.addEventListener('click',function(e){window.GestionCursos.click(e);window.GestionEmbudo.click(e)});
boot();
})();
