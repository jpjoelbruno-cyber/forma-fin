/* FORMA Gestión · Cursos y grupos (tablero por mes + asistente "Nuevo grupo / Repetir").
   Usa las mismas operaciones del servidor que la pantalla clásica (forma_academic: catalog, course_save, group_save, group_detail).
   Antes de guardar valida fechas, cupos y cruces de horario para no dejar un curso a medias. No borra nada. */
(function(){'use strict';
var X=null,C={vw:'t',calM:'',flt:{c:'',st:'',m:'',h:''},reg:null,cat:null,err:'',busy:false,selG:null,detail:{},wiz:null,msg:'',demoCat:null};
var PAL=['#7C3AED','#0D9488','#F97316','#DB2777','#2563EB','#CA8A04','#DC2626','#0891B2','#16A34A','#9333EA','#0EA5E9','#E11D48','#65A30D','#B45309','#0F766E','#4F46E5'];
var DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],MES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var FERIADOS={'2026-11-02':'Finados','2026-11-20':'Conciencia Negra','2026-12-25':'Navidad','2027-01-01':'Año Nuevo','2027-02-16':'Carnaval','2027-04-02':'Viernes Santo','2027-04-21':'Tiradentes','2027-05-01':'Día del Trabajo'};
var SUGERIDAS={'2026-12-24':'Nochebuena','2026-12-31':'Fin de Año'};
function esc(s){return X.esc(s)}
function uuid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
function ownColor(c){
  if(C.reg&&C.reg.colors[c.id])return String(C.reg.colors[c.id]).toUpperCase();
  try{var v=localStorage.getItem('forma-color-'+c.id);if(v&&PAL.indexOf(v.toUpperCase())>-1)return v.toUpperCase()}catch(e){}
  return null;
}
/* un color propio por curso: si dos cursos tienen el mismo, el de id menor lo conserva y el otro recibe uno libre */
function colorOf(c){
  var mine=ownColor(c),others=C.cat?C.cat.courses.filter(function(o){return o.id!==c.id}):[],taken={},dup=false;
  others.forEach(function(o){var k=ownColor(o);if(k){taken[k]=1;if(k===mine&&o.id<c.id)dup=true}});
  if(mine&&!dup)return mine;
  var bi=hash(c.id||c.name||'')%PAL.length,pick=null;
  for(var k=0;k<PAL.length;k++){var p=PAL[(bi+k)%PAL.length];if(!taken[p]){pick=p;break}}
  if(!pick)return mine||PAL[bi];
  setColor(c.id,pick);return pick;
}
function setColor(id,col){
  try{localStorage.setItem('forma-color-'+id,col)}catch(e){}
  if(C.reg){C.reg.colors[id]=col;if(!X.demo&&/^[0-9a-f-]{36}$/i.test(id))X.rpc('forma_registry',{p_action:'color_save',p_data:{course_id:id,color:col}}).catch(function(){})}
}
function hhmm(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function dow(d){return new Date(d+'T12:00:00Z').getUTCDay()}
function dmy(d){var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function dm(d){var p=d.split('-');return p[2]+'/'+p[1]}
function ac(action,data){return X.rpc('forma_academic',{p_action:action,p_data:data||{}})}
function span(g){
  var s=(g.sessions||[]).slice().sort(function(a,b){return a.day<b.day?-1:a.day>b.day?1:a.start_min-b.start_min});
  if(!s.length)return{from:null,to:null,n:0,days:[],start:0,end:0,list:s};
  var days=[];s.forEach(function(x){var d=dow(x.day);if(days.indexOf(d)<0)days.push(d)});days.sort(function(a,b){return((a+6)%7)-((b+6)%7)});
  return{from:s[0].day,to:s[s.length-1].day,n:s.length,days:days,start:s[0].start_min,end:s[0].end_min,list:s};
}
var ST={plan:['Planificado','#6B7280'],abierto:['Inscripciones abiertas','#2563EB'],completo:['Completo','#B45309'],curso:['En curso','#0D9488'],fin:['Finalizado','#4B5563'],cancel:['Cancelado','#DC2626']};
function stOf(g){
  if(g.active===false)return 'cancel';
  var s=span(g),n=Number(g.students)||0,cap=Number(g.capacity)||0;
  if(!s.from)return 'plan';
  if(s.to<X.T)return 'fin';
  if(s.from<=X.T)return 'curso';
  return(cap>0&&n>=cap)?'completo':'abierto';
}
function badge(g){var k=stOf(g),t=ST[k];return '<span class="cu-st" style="background:'+t[1]+'">'+t[0]+'</span>'}
function hOf(g){var s=span(g);if(!s.n)return '';return s.start<720?'m':s.start<1080?'t':'n'}
function passes(g){
  var f=C.flt,s=span(g);
  if(f.c&&g.course_id!==f.c)return false;
  if(f.st&&stOf(g)!==f.st)return false;
  if(f.h&&hOf(g)!==f.h)return false;
  if(f.m){if(!s.from)return false;var a=f.m+'-01',b=f.m+'-31';if(!(s.from<=b&&s.to>=a))return false}
  return true;
}
function fltOn(){var f=C.flt;return !!(f.c||f.st||f.m||f.h)}
function fltBar(){
  var cat=C.cat,ms={};cat.groups.forEach(function(g){var s=span(g);if(!s.from)return;var d=X.M.date(s.from),e=X.M.date(s.to),y=d.getUTCFullYear(),m=d.getUTCMonth();while(y*12+m<=e.getUTCFullYear()*12+e.getUTCMonth()){ms[y+'-'+String(m+1).padStart(2,'0')]=1;m++;if(m>11){m=0;y++}}});
  var mk=Object.keys(ms).sort(),o=function(v,t,cur){return '<option value="'+esc(v)+'"'+(cur===v?' selected':'')+'>'+esc(t)+'</option>'};
  var f=C.flt;
  return '<div class="cu-flt"><label>Curso<select data-cuflt="c">'+o('','Todos',f.c)+cat.courses.slice().sort(function(a,b){return a.name.localeCompare(b.name)}).map(function(c){return o(c.id,c.name,f.c)}).join('')+'</select></label>'
   +'<label>Mes<select data-cuflt="m">'+o('','Todos',f.m)+mk.map(function(k){var p=k.split('-');return o(k,MES[Number(p[1])-1]+' '+p[0],f.m)}).join('')+'</select></label>'
   +'<label>Horario<select data-cuflt="h">'+o('','Todos',f.h)+o('m','Mañana (antes de 12:00)',f.h)+o('t','Tarde (12:00–18:00)',f.h)+o('n','Noche (desde 18:00)',f.h)+'</select></label>'
   +'<label>Estado<select data-cuflt="st">'+o('','Todos',f.st)+Object.keys(ST).map(function(k){return o(k,ST[k][0],f.st)}).join('')+'</select></label>'
   +(fltOn()?'<button type="button" class="btn s sm" data-cu="fclear">Quitar filtros</button>':'')+'</div>';
}
function seats(cap,n){
  if(cap>30)return '<b class="num">'+n+' / '+cap+'</b>';
  var o='';for(var i=0;i<cap;i++)o+='<i class="cu-seat'+(i<n?' on':'')+'"></i>';return o;
}
/* ---------- carga ---------- */
function load(force){
  if(C.cat&&!force)return Promise.resolve();
  if(X.demo){if(!C.demoCat)C.demoCat=demoCatalog();C.cat=C.demoCat;return loadReg()}
  return ac('catalog').then(function(d){
    if(!d||d.version!==1||!Array.isArray(d.courses)||!Array.isArray(d.groups))throw Error('catálogo');
    C.cat=d;C.err='';
    return loadReg();
  },function(e){C.err='No se pudo cargar los cursos. No se cambió nada.';C.cat=C.cat||null});
}
function applyIns(){
  if(!C.reg||!X.M||!X.M.instructors)return;
  C.reg.ins.forEach(function(i){if(i.active&&X.M.instructors.indexOf(i.name)<0)X.M.instructors.push(i.name)});
}
function loadReg(){
  if(X.demo){if(!C.reg)C.reg={ins:['Joel','René','Luis','Emerson','Miguel'].map(function(n){return{name:n,active:true}}),colors:{}};applyIns();return Promise.resolve()}
  return Promise.all([X.rpc('forma_registry',{p_action:'instructors_list',p_data:{}}),X.rpc('forma_registry',{p_action:'colors_list',p_data:{}})]).then(function(r){
    var cols={};((r[1]&&r[1].items)||[]).forEach(function(x){cols[x.course_id]=x.color});
    C.reg={ins:(r[0]&&r[0].items)||[],colors:cols};applyIns();
    /* colores que ya había elegido este navegador: se comparten una sola vez */
    C.cat.courses.forEach(function(k){if(!cols[k.id]){try{var v=localStorage.getItem('forma-color-'+k.id);if(v&&PAL.indexOf(v)>-1)setColor(k.id,v)}catch(e){}}});
  },function(){C.reg=null});
}
function loadDetail(gid){
  if(C.detail[gid])return;
  C.detail[gid]={loading:true};
  (X.demo?Promise.resolve({students:[{name:'Ana Pérez',total_cents:290000,paid_cents:290000},{name:'Luis Gómez',total_cents:290000,paid_cents:145000},{name:'Carlos Rojas',total_cents:290000,paid_cents:0}]}):ac('group_detail',{group_id:gid})).then(function(d){C.detail[gid]={students:(d&&d.students)||[]};if(X.view()==='cursos')X.render()},function(){C.detail[gid]={students:[],err:true};if(X.view()==='cursos')X.render()});
}
/* ---------- tablero ---------- */
function monthWin(){
  var d=X.M.date(X.T),y=d.getUTCFullYear(),m=d.getUTCMonth()-1,a=new Date(Date.UTC(y,m,1)),ms=[];
  for(var i=0;i<7;i++)ms.push(new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+i,1)));
  var end=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+7,1));
  return{ms:ms,from:X.M.iso(a),to:X.M.iso(end)};
}
function pct(day,w){var a=X.M.date(w.from).getTime(),b=X.M.date(w.to).getTime(),t=X.M.date(day).getTime();return Math.max(0,Math.min(100,(t-a)/(b-a)*100))}
function board(){
  var cat=C.cat,w=monthWin(),rows=[],tl='',lst='';
  cat.courses.slice().sort(function(a,b){return a.name.localeCompare(b.name)}).forEach(function(c){
    var gs=cat.groups.filter(function(g){return g.course_id===c.id&&passes(g)}).map(function(g){return{g:g,s:span(g)}}).sort(function(a,b){return(a.s.from||'9')<(b.s.from||'9')?-1:1});
    var col=colorOf(c);
    if(!gs.length){if(!fltOn())rows.push({c:c,col:col,empty:true});return}
    gs.forEach(function(x,i){rows.push({c:c,col:col,g:x.g,s:x.s,first:i===0})});
  });
  var head='<div class="cu-h"></div><div class="cu-hm">'+w.ms.map(function(m){return '<span>'+MES[m.getUTCMonth()]+(m.getUTCMonth()===0?' '+m.getUTCFullYear():'')+'</span>'}).join('')+'</div>';
  rows.forEach(function(r){
    var name='<div class="cu-n"><i class="cu-dot" style="background:'+r.col+'"></i><span>'+esc(r.c.name)+(r.c.active===false?' <small>(inactivo)</small>':'')+'</span></div>';
    if(r.empty){tl+=name+'<div class="cu-t"><button class="cu-ghost" data-cu="newg" data-id="'+r.c.id+'">+ Primer grupo de '+esc(r.c.name)+'</button></div>';return}
    var inwin=r.s.from&&r.s.to>=w.from&&r.s.from<w.to,sel=C.selG===r.g.id;
    var bar=inwin?'<button class="cu-bar'+(sel?' sel':'')+(r.g.active===false?' off':'')+'" data-cu="pick" data-id="'+r.g.id+'" style="left:'+pct(r.s.from,w)+'%;width:'+Math.max(2.5,pct(r.s.to,w)-pct(r.s.from,w))+'%;background:'+r.col+'" title="'+esc(r.g.name)+'"><b>'+esc(r.g.name)+' · '+Number(r.g.students)+'/'+Number(r.g.capacity)+'</b><small>'+r.s.days.map(function(d){return DOW[d]}).join('-')+' '+hhmm(r.s.start)+'–'+hhmm(r.s.end)+'</small></button>':'<span class="cu-out">'+esc(r.g.name)+' · fuera de este período ('+(r.s.from?dm(r.s.from)+' → '+dm(r.s.to):'sin fechas')+')</span>';
    tl+=(r.first?name:'<div class="cu-n sub"><span></span></div>')+'<div class="cu-t">'+bar+'</div>';
    lst+='<button class="cu-card'+(sel?' sel':'')+'" data-cu="pick" data-id="'+r.g.id+'"><i class="cu-dot" style="background:'+r.col+'"></i><span><b>'+esc(r.c.name)+' · '+esc(r.g.name)+'</b> '+badge(r.g)+'<small>'+(r.s.from?dm(r.s.from)+' → '+dm(r.s.to)+' · '+r.s.days.map(function(d){return DOW[d]}).join('-')+' '+hhmm(r.s.start)+'–'+hhmm(r.s.end):'Sin fechas')+' · '+Number(r.g.students)+'/'+Number(r.g.capacity)+' cupos</small></span></button>';
  });
  var cols='<div class="cu-grid" style="--cols:'+w.ms.length+'">'+head+tl+'</div>';
  return '<div class="cu-tl">'+cols+'</div><div class="cu-list">'+(lst||'<p class="note">'+(fltOn()?'Ningún grupo coincide con los filtros.':'Aún no hay grupos con fechas.')+'</p>')+'</div>';
}
/* calendario mensual: todas las clases de los grupos activos, con choques marcados (mismo día, horas que se pisan y mismo instructor o sala) */
function calendar(){
  var cat=C.cat;if(!C.calM)C.calM=X.T.slice(0,7);
  var y=Number(C.calM.slice(0,4)),m=Number(C.calM.slice(5,7))-1,first=new Date(Date.UTC(y,m,1)),days=new Date(Date.UTC(y,m+1,0)).getUTCDate(),lead=(first.getUTCDay()+6)%7;
  var byDay={};cat.groups.forEach(function(g){if(g.active===false||!passes(g))return;var c=cat.courses.filter(function(k){return k.id===g.course_id})[0]||{id:g.course_id,name:g.course};
    (g.sessions||[]).forEach(function(x){if(x.cancelled||x.day.slice(0,7)!==C.calM)return;(byDay[x.day]=byDay[x.day]||[]).push({g:g,c:c,s:x,ins:x.instructor||g.instructor,room:x.room||g.room})})});
  var cells='';for(var i=0;i<lead;i++)cells+='<div class="cu-cd off"></div>';
  for(var d=1;d<=days;d++){
    var iso=C.calM+'-'+String(d).padStart(2,'0'),L=(byDay[iso]||[]).sort(function(a,b){return a.s.start_min-b.s.start_min}),fer=FERIADOS[iso];
    L.forEach(function(a){a.bad=L.some(function(b){return b!==a&&a.s.start_min<b.s.end_min&&b.s.start_min<a.s.end_min&&(a.ins===b.ins||a.room===b.room)})});
    cells+='<div class="cu-cd'+(iso===X.T?' today':'')+'"><span class="n">'+d+(fer?' <em>'+esc(fer)+'</em>':'')+'</span>'+L.map(function(a){return '<button class="cu-ev'+(a.bad?' bad':'')+'" data-cu="pick" data-id="'+a.g.id+'" style="background:'+colorOf(a.c)+'" title="'+esc(a.c.name+' · '+a.g.name+' · '+a.ins+' · '+a.room)+(a.bad?' — CHOQUE':'')+'"><b>'+hhmm(a.s.start_min)+'</b> '+esc(a.c.name)+(a.bad?' ⚠':'')+'</button>'}).join('')+'</div>';
  }
  var prev=new Date(Date.UTC(y,m-1,1)),next=new Date(Date.UTC(y,m+1,1)),k=function(dt){return dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')};
  var bad=0;Object.keys(byDay).forEach(function(k2){byDay[k2].forEach(function(a){if(a.bad)bad++})});
  return '<div class="cu-calh"><button class="btn s sm" data-cu="calm" data-m="'+k(prev)+'">‹</button><b>'+MES[m]+' '+y+'</b><button class="btn s sm" data-cu="calm" data-m="'+k(next)+'">›</button></div>'
   +(bad?'<div class="err">Hay <b>'+bad+'</b> clase(s) que se pisan (mismo instructor o sala a la misma hora). Están marcadas con ⚠: abre el grupo y usa «Editar grupo».</div>':'<div class="cu-ok">Sin choques este mes ✓</div>')
   +'<div class="cu-cal"><div class="cu-cw">Lun</div><div class="cu-cw">Mar</div><div class="cu-cw">Mié</div><div class="cu-cw">Jue</div><div class="cu-cw">Vie</div><div class="cu-cw">Sáb</div><div class="cu-cw">Dom</div>'+cells+'</div>';
}
function courseTotals(){
  var cat=C.cat,rows=[];
  cat.courses.slice().sort(function(a,b){return a.name.localeCompare(b.name)}).forEach(function(c){
    var gs=cat.groups.filter(function(g){return g.course_id===c.id&&g.active!==false&&passes(g)&&g.financial});if(!gs.length)return;
    var t=gs.reduce(function(a,g){a.c+=Number(g.financial.contracted_cents)||0;a.p+=Number(g.financial.paid_cents)||0;a.d+=Number(g.financial.pending_cents)||0;a.n+=Number(g.students)||0;return a},{c:0,p:0,d:0,n:0});
    rows.push('<tr><td><i class="cu-dot" style="background:'+colorOf(c)+'"></i> '+esc(c.name)+' <small>('+gs.length+' grupo'+(gs.length===1?'':'s')+' · '+t.n+' alumnos)</small></td><td class="r">'+X.R(t.c)+'</td><td class="r">'+X.R(t.p)+'</td><td class="r">'+X.R(t.d)+'</td></tr>');
  });
  if(!rows.length)return '';
  return '<details class="cu-totd"><summary>Totales por curso (grupos activos)</summary><div class="tw"><table class="cu-tb"><thead><tr><th>Curso</th><th class="r">Negociado</th><th class="r">Recibido</th><th class="r">Pendiente</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div></details>';
}
function panel(){
  var cat=C.cat,g=cat.groups.filter(function(x){return x.id===C.selG})[0];
  if(!g)return '<section class="card cu-side"><h2>Selecciona un grupo</h2><p class="note">Toca una barra del tablero para ver cupos y alumnos, o abre un grupo nuevo.</p></section>';
  var c=cat.courses.filter(function(x){return x.id===g.course_id})[0]||{id:g.course_id,name:g.course||''},s=span(g),col=colorOf(c);loadDetail(g.id);
  var d=C.detail[g.id]||{},al=d.loading?'<p class="note">Cargando alumnos…</p>':d.err?'<p class="note">No se pudo cargar la lista.</p>':((d.students||[]).filter(function(x){return x.state!=='cancelado'}).slice(0,12).map(function(x){var debt=Number(x.total_cents)-Number(x.paid_cents);return '<div class="row"><div class="t"><b>'+esc(x.name)+'</b></div>'+(debt>0?'<span class="pill" style="background:var(--warnbg);color:var(--warn)">Debe '+X.R(debt)+'</span>':'<span class="pill up">Al día</span>')+'</div>'}).join('')||'<p class="note">Aún no hay alumnos matriculados.</p>');
  var usedBy={};cat.courses.forEach(function(o){if(o.id!==c.id){var k=ownColor(o);if(k)usedBy[k]=o.name}});
  var sw=PAL.map(function(p){var u=usedBy[p];return '<button class="cu-sw'+(p===col?' on':'')+(u?' used':'')+'" data-cu="color" data-id="'+c.id+'" data-c="'+p+'" style="background:'+p+'" aria-label="Color '+(u?'ya usado por '+esc(u):p)+'" title="'+(u?'Ya lo usa '+esc(u):'')+'"></button>'}).join('');
  var fin=g.financial||{},tot=(fin.contracted_cents!==undefined)?'<div class="cu-tot"><div><small>Negociado</small><b>'+X.R(Number(fin.contracted_cents)||0)+'</b></div><div><small>Recibido</small><b style="color:var(--ok)">'+X.R(Number(fin.paid_cents)||0)+'</b></div><div><small>Pendiente</small><b style="color:var(--warn)">'+X.R(Number(fin.pending_cents)||0)+'</b></div></div>':'';
  var off=g.active===false,lbl=off?'Reactivar grupo':'Cancelar grupo';
  return '<section class="card cu-side"><h2><span><i class="cu-dot" style="background:'+col+'"></i><span>'+esc(c.name)+' · '+esc(g.name)+'</span></span></h2><div style="margin:-4px 0 8px">'+badge(g)+'</div>'
   +'<p class="note" style="margin:0 0 10px">'+(s.from?s.days.map(function(x){return DOW[x]}).join(' y ')+' · '+hhmm(s.start)+'–'+hhmm(s.end)+' · '+esc(g.room||'')+' · '+esc(g.instructor||'')+'<br>'+dmy(s.from)+' → '+dmy(s.to)+' · '+s.n+' encuentros':'Sin fechas preparadas')+'</p>'
   +'<b>Cupos '+Number(g.students)+' de '+Number(g.capacity)+'</b><div class="cu-seats">'+seats(Number(g.capacity),Number(g.students))+'</div>'
   +tot+'<div class="list" style="margin:8px 0 12px">'+al+'</div>'
   +'<div class="cu-acts">'+(off?'':'<button class="btn p" data-act="matricular">+ Matricular en este grupo</button>')+'<button class="btn s" data-cu="editg" data-id="'+g.id+'">Editar grupo (horario, cupos, sala…)</button><button class="btn s" data-cu="repeat" data-id="'+g.id+'">Repetir para el mes siguiente</button><button class="btn s" data-act="agenda">Ver y mover las clases en la Agenda</button><button class="btn s cu-danger" data-cu="'+(off?'react':'cancelg')+'" data-id="'+g.id+'">'+lbl+'</button></div>'
   +'<p class="note">Color del curso:</p><div class="cu-sws">'+sw+'</div><p class="note">Cada curso tiene su propio color; los ya usados aparecen atenuados.</p></section>';
}
function html(){
  if(!C.cat)return X.head('Cursos','Grupos por mes, con cupos y horarios.','')+(C.err?'<div class="err">'+esc(C.err)+'</div>':'<p class="skel" role="status">Cargando cursos…</p>');
  if(C.wiz)return wizard();
  if(C.ed)return edView();
  var right='<button class="btn s" data-cu="insman">Instructores</button> <button class="btn p" data-cu="newc">+ Nuevo curso</button>';
  var leg=C.cat.courses.map(function(c){return '<span><i class="cu-dot" style="background:'+colorOf(c)+'"></i>'+esc(c.name)+'</span>'}).join('');
  return X.head('Cursos','Cada barra es un grupo, con el color de su curso.',right)+(C.msg?'<div class="cu-ok">'+esc(C.msg)+'</div>':'')+'<div class="cu-main"><section class="card"><div class="cu-leg">'+leg+'</div>'+'<div class="cu-vw"><button class="btn s sm" data-cu="vw" data-cv="t" aria-pressed="'+(C.vw==='t')+'">Tablero</button><button class="btn s sm" data-cu="vw" data-cv="c" aria-pressed="'+(C.vw==='c')+'">Calendario del mes</button></div>'+fltBar()+(C.vw==='c'?calendar():board())+courseTotals()+'</section>'+panel()+'</div>';
}
/* ---------- asistente ---------- */
function instructors(){var s=['Joel','René','Luis','Emerson','Miguel'];if(C.reg)C.reg.ins.forEach(function(i){if(i.active&&s.indexOf(i.name)<0)s.push(i.name)});C.cat.groups.forEach(function(g){if(g.instructor&&s.indexOf(g.instructor)<0)s.push(g.instructor)});return s}
function rooms(){var s=['Sala 1','Sala 2','Sala 3'];C.cat.groups.forEach(function(g){if(g.room&&s.indexOf(g.room)<0)s.push(g.room)});return s}
function insDialog(msg){
  if(!C.reg){X.dlg('Instructores','<div class="err">No se pudo cargar el registro de instructores. No se cambió nada.</div>');return}
  var used={};(C.cat?C.cat.groups:[]).forEach(function(g){used[g.instructor]=1});
  var h=(msg?'<div class="'+(msg.ok?'ac-ok':'err')+'" role="alert">'+esc(msg.t)+'</div>':'')+'<p class="note">Quién puede dar clases. Puedes sumar instructores nuevos y desactivar a quien salga; sus clases anteriores se conservan.</p><div class="list">'+C.reg.ins.map(function(i){
    return '<div class="row"><div class="t"><b>'+esc(i.name)+'</b><span>'+(i.active?'Activo':'Desactivado')+(used[i.name]?' · tiene grupos':'')+'</span></div><button class="btn s sm" data-cu="instog" data-n="'+esc(i.name)+'" data-a="'+(i.active?'0':'1')+'">'+(i.active?'Desactivar':'Activar')+'</button></div>';
  }).join('')+'</div><form class="cu-form" id="insForm" style="margin-top:14px" onsubmit="return false"><label>Nuevo instructor<input id="insName" maxlength="60" placeholder="Nombre" autocomplete="off"></label><button class="btn p" data-cu="insadd" type="button">Agregar instructor</button></form>';
  X.dlg('Instructores',h,false);
}
function insSave(name,active){
  if(X.demo){var f=C.reg.ins.filter(function(i){return i.name===name})[0];if(f)f.active=active;else C.reg.ins.push({name:name,active:active});applyIns();return Promise.resolve({saved:true})}
  return X.rpc('forma_registry',{p_action:'instructor_save',p_data:{name:name,active:active}}).then(function(r){
    if(!r||!r.saved)throw Error('Sin confirmar');
    var f=C.reg.ins.filter(function(i){return i.name===name})[0];if(f)f.active=active;else C.reg.ins.push({name:name,active:active});C.reg.ins.sort(function(a,b){return a.name.localeCompare(b.name)});applyIns();return r;
  });
}
function insAdd(){
  var n=(document.getElementById('insName').value||'').trim().replace(/\s+/g,' ');
  if(n.length<2){insDialog({t:'Escribe el nombre del instructor.'});return}
  if(/^sin asignar$/i.test(n)){insDialog({t:'Ese nombre no es válido.'});return}
  var ex=C.reg.ins.filter(function(i){return i.name.toLowerCase()===n.toLowerCase()})[0];
  if(ex&&ex.active){insDialog({t:n+' ya está en la lista.'});return}
  insSave(ex?ex.name:n,true).then(function(){insDialog({ok:true,t:(ex?ex.name:n)+' quedó disponible para grupos y reservas.'});X.render()},function(){insDialog({t:'No se pudo guardar. No se cambió nada.'})});
}
function insToggle(n,a){
  insSave(n,a).then(function(){insDialog({ok:true,t:n+(a?' activado.':' desactivado. Sus clases anteriores se conservan.')});X.render()},function(){insDialog({t:'No se pudo guardar. No se cambió nada.'})});
}
function startWiz(courseId,fromGroupId){
  var cat=C.cat,c=cat.courses.filter(function(x){return x.id===courseId})[0],tpl=null;
  if(c){var gs=cat.groups.filter(function(g){return g.course_id===courseId}).sort(function(a,b){return(span(b).from||'')<(span(a).from||'')?-1:1});tpl=fromGroupId?cat.groups.filter(function(g){return g.id===fromGroupId})[0]:gs[0]}
  var w={mode:c?'group':'course',courseId:courseId||'',tpl:tpl||null,courseName:'',color:PAL[cat.courses.length%PAL.length],start:'',days:[],time:'15:00',hours:2,count:c&&c.encounter_count?Number(c.encounter_count):12,instructor:'Joel',room:'Sala 3',capacity:10,price:'',groupName:'',include:{},rid:{},msg:'',saved:null};
  if(tpl){var s=span(tpl);w.days=s.days.slice();w.time=s.n?hhmm(s.start):'15:00';w.hours=s.n?(s.end-s.start)/60:2;w.count=s.n||w.count;w.instructor=tpl.instructor||w.instructor;w.room=tpl.room||w.room;w.capacity=Number(tpl.capacity)||10;w.price=String(Math.round((Number(tpl.fee_cents)+Number(tpl.installments)*Number(tpl.monthly_cents))/100));w.priceBase=w.price;
    if(s.to){var d=X.M.date(s.to);w.start=X.M.iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)));}}
  if(w.start&&w.start<X.T)w.start='';
  if(!w.start){var t=X.M.date(X.T);w.start=X.M.iso(new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,1)))}
  if(!w.days.length)w.days=[4];
  var sd=X.M.date(w.start),mn=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  w.groupName='Grupo '+mn[sd.getUTCMonth()]+' '+sd.getUTCFullYear();w.i0=w.instructor;w.r0=w.room;
  C.wiz=w;C.msg='';X.render();window.scrollTo(0,0);
}
function tplSessions(w){return w.tpl?(w.tpl.sessions||[]).slice().sort(function(a,b){return a.day<b.day?-1:a.day>b.day?1:a.start_min-b.start_min}):[]}
function insAt(w,i){var t=tplSessions(w)[i];return(w.instructor===w.i0&&t&&t.instructor)?t.instructor:w.instructor}
function roomAt(w,i){var t=tplSessions(w)[i];return(w.room===w.r0&&t&&t.room)?t.room:w.room}
function rowOf(w,x){
  var o=(w.ov&&w.ov[x.day])||{},t=x.t>=0?tplSessions(w)[x.t]:null;
  return{module:o.module!==undefined?o.module:((t&&t.module)||''),instructor:o.instructor||(x.t>=0?insAt(w,x.t):w.instructor),room:o.room||(x.t>=0?roomAt(w,x.t):w.room)};
}
function plan(w){var p=plan0(w);
  var rm=w.rm||{};p.list.forEach(function(x){x.t=x.n-1});var list=p.list.filter(function(x){return !rm[x.day]});
  (w.extra||[]).forEach(function(d){if(!list.some(function(x){return x.day===d})&&!rm[d])list.push({n:0,t:-1,day:d,why:'añadido'})});
  list.sort(function(a,b){return a.day<b.day?-1:1});list.forEach(function(x,i){x.n=i+1});
  return{list:list,skipped:p.skipped,end:list.length?list[list.length-1].day:null};
}
function plan0(w){
  var list=[],skipped=[],n=0,d=w.start,guard=0,cnt=Math.max(0,Math.min(104,Number(w.count)||0));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(w.start||'')||!w.days.length||!cnt)return{list:[],skipped:[],end:null};
  while(n<cnt&&guard++<900){
    if(w.days.indexOf(dow(d))>-1){
      var why=FERIADOS[d]||SUGERIDAS[d];
      if(why&&!w.include[d])skipped.push({day:d,why:why});else{n++;list.push({n:n,day:d,why:why||''})}
    }
    d=X.M.plus(d,1);
  }
  return{list:list,skipped:skipped,end:list.length?list[list.length-1].day:null};
}
function clash(list,gid,courseId){
  var out=[],seen={};
  list.forEach(function(x){C.cat.groups.forEach(function(g){
    if(g.active===false||g.id===gid)return;(g.sessions||[]).forEach(function(s){
      if(s.day!==x.day||s.cancelled)return;if(!(x.start_min<s.end_min&&s.start_min<x.end_min))return;
      var ins=(s.instructor||g.instructor)===x.instructor,room=(s.room||g.room)===x.room;if(!ins&&!room)return;
      var k=g.id+(ins?'i':'')+(room?'r':'');if(seen[k])return;seen[k]=1;
      out.push({day:x.day,gid:g.id,same:!!courseId&&g.course_id===courseId&&s.start_min===x.start_min&&s.end_min===x.end_min,who:(g.course||'')+' · '+g.name,why:(ins&&room?'mismo instructor y sala':ins?'mismo instructor ('+x.instructor+')':'misma sala ('+x.room+')'),time:hhmm(s.start_min)+'–'+hhmm(s.end_min)});
    })
  })});
  return out;
}
function conflicts(w,p){
  var a0=Math.round(parseInt(w.time.slice(0,2),10)*60+parseInt(w.time.slice(3,5),10)),a1=a0+Math.round(Number(w.hours)*60);
  return clash(p.list.filter(function(x){return x.day>=X.T}).map(function(x){var rw=rowOf(w,x);return{day:x.day,start_min:a0,end_min:a1,instructor:rw.instructor,room:rw.room}}),w.gid||null,w.courseId);
}
function cfHTML(cf){
  if(!cf.length)return '';
  var same=cf.filter(function(k){return k.same})[0];
  return '<div class="err"><b>'+(same?'Este grupo parece ya existir':'Choca con otro grupo — corrige antes de guardar')+'</b>'
   +(same?'<p style="margin:6px 0 0">«'+esc(same.who)+'» ya tiene clase el '+dm(same.day)+' a las '+same.time+' con el mismo instructor o sala. No lo crees otra vez: <button type="button" class="link" data-cu="gopen" data-id="'+same.gid+'">abre ese grupo</button> y usa «Editar grupo». Si lo creaste por error, <button type="button" class="link" data-cu="cancelg" data-id="'+same.gid+'">cancela ese grupo duplicado</button> (no borra nada) y vuelve a guardar.</p>':'')
   +'<ul style="margin:6px 0 0;padding-left:18px">'+cf.slice(0,6).map(function(k){return '<li>'+dm(k.day)+' '+k.time+' · '+esc(k.who)+' ('+k.why+') <button type="button" class="link" data-cu="gopen" data-id="'+k.gid+'">ver grupo</button></li>'}).join('')+'</ul><span class="note">Cambia la sala, el instructor o la hora.</span></div>';
}

var INS_COL=['#7C3AED','#0D9488','#F97316','#DB2777','#2563EB','#CA8A04','#DC2626','#0891B2'];
function insColor(n){var l=instructors(),i=l.indexOf(n);return INS_COL[(i<0?0:i)%INS_COL.length]}
function editor(w,p,cf){
  if(!p.list.length)return '';
  var ins=instructors(),rms=rooms(),mods=(C.cat.courses.filter(function(c){return c.id===w.courseId})[0]||{modules:[]}).modules||[];
  var cnt={};p.list.forEach(function(x){var r=rowOf(w,x);cnt[r.instructor]=(cnt[r.instructor]||0)+1});
  var res='<div class="cu-chips">'+Object.keys(cnt).map(function(k){return '<span class="cu-ins" style="background:'+insColor(k)+'">'+esc(k)+' · '+cnt[k]+'</span>'}).join('')+'</div>';
  if(!w.edit)return '<div class="cu-edhead"><div><b>Instructores de este grupo</b>'+res+'</div><button type="button" class="btn s" data-cu="edit">Editar encuentro por encuentro</button></div>';
  var opt=function(list,v){var l=list.indexOf(v)<0&&v?list.concat([v]):list;return l.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>'}).join('')};
  var badDays={};cf.forEach(function(k){badDays[k.day]=1});
  var rows=p.list.map(function(x){var r=rowOf(w,x);return '<tr'+(badDays[x.day]?' class="bad"':'')+'><td><b>'+x.n+'</b></td><td>'+DOW[dow(x.day)]+' '+dm(x.day)+(x.why==='añadido'?' <small>(añadido)</small>':'')+'</td><td><input list="cuMods" maxlength="160" data-cuo="'+x.day+'|module" value="'+esc(r.module)+'" placeholder="Nombre del módulo"></td><td><select data-cuo="'+x.day+'|instructor" style="border-left:6px solid '+insColor(r.instructor)+'">'+opt(ins,r.instructor)+'</select></td><td><select data-cuo="'+x.day+'|room">'+opt(rms,r.room)+'</select></td><td><button type="button" class="link" data-cu="rm" data-d="'+x.day+'" aria-label="Quitar encuentro">Quitar</button></td></tr>'}).join('');
  var dl='<datalist id="cuMods">'+mods.map(function(m){return '<option value="'+esc(m)+'">'}).join('')+'</datalist>';
  return '<div class="cu-edhead"><div><b>Encuentro por encuentro</b>'+res+'</div><button type="button" class="btn s" data-cu="edit">Ocultar</button></div>'
   +'<div class="cu-bulk"><b>Asignar en bloque</b><label>Del encuentro<input type="number" min="1" max="'+p.list.length+'" data-cuf="bFrom" data-nowheel value="'+esc(w.bFrom||1)+'"></label><label>Al<input type="number" min="1" max="'+p.list.length+'" data-cuf="bTo" data-nowheel value="'+esc(w.bTo||p.list.length)+'"></label><label>Instructor<select data-cuf="bIns">'+opt(ins,w.bIns||w.instructor)+'</select></label><label>Sala<select data-cuf="bRoom"><option value="">(no cambiar)</option>'+opt(rms,'')+'</select></label><button type="button" class="btn p sm" data-cu="bulk">Aplicar</button></div>'
   +'<div class="tw"><table class="cu-tb"><thead><tr><th>#</th><th>Fecha</th><th>Módulo</th><th>Instructor</th><th>Sala</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+dl
   +'<div class="cu-add"><label>Añadir un encuentro<input type="date" data-cuf="newDay" value="'+esc(w.newDay||'')+'"></label><button type="button" class="btn s sm" data-cu="addday">+ Añadir</button><span class="note">Para quitar o añadir encuentros extra, sin cambiar los demás. Si un instructor no aparece en la lista, hay que registrarlo primero en el sistema (pídeselo a Joel).</span></div>';
}
function wizard(){
  var w=C.wiz,p=plan(w),cf=conflicts(w,p),isC=w.mode==='course',c=C.cat.courses.filter(function(x){return x.id===w.courseId})[0];
  var col=isC?w.color:colorOf(c);
  var chip=function(on,attr,txt){return '<button type="button" class="chip" aria-pressed="'+on+'" '+attr+'>'+txt+'</button>'};
  var dchips=[1,2,3,4,5,6,0].map(function(d){return chip(w.days.indexOf(d)>-1,'data-cu="day" data-d="'+d+'"',DOW[d])}).join('');
  var wk=[1,2,3].map(function(n){return chip(w.days.length===n,'data-cu="perweek" data-n="'+n+'"',String(n))}).join('');
  var sw=PAL.map(function(x){return '<button type="button" class="cu-sw'+(x===w.color?' on':'')+'" data-cu="wcolor" data-c="'+x+'" style="background:'+x+'" aria-label="Color"></button>'}).join('');
  var opt=function(list,v){return list.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>'}).join('')};
  var durs=[1,1.5,2,2.5,3,4].map(function(h){return '<option value="'+h+'"'+(Number(w.hours)===h?' selected':'')+'>'+h+' h</option>'}).join('');
  var sk=p.skipped.map(function(s){return '<span class="cu-skip">'+dm(s.day)+' · '+esc(s.why)+' <button type="button" class="link" data-cu="inc" data-d="'+s.day+'">dar clase igual</button></span>'}).join('');
  var weeks=p.list.length?Math.round((X.M.date(p.end)-X.M.date(w.start))/86400000/7):0;
  var multi=(function(){var set={};p.list.forEach(function(x){set[rowOf(w,x).instructor]=1});return Object.keys(set)})();var prev0=multi.length>1?'<div class="cu-ok" style="background:var(--soft);color:var(--brand2)">Instructores de este grupo: <b>'+multi.map(esc).join(', ')+'</b> · se mantienen como en el grupo anterior. Si eliges otro instructor arriba, se aplica a todos los encuentros.</div>':'';var prev=p.list.length?'<div class="cu-prev">'+p.list.map(function(x){return '<span class="cu-d'+(cf.some(function(k){return k.day===x.day})?' bad':'')+'" title="'+esc(x.why)+'"><b>'+x.n+'</b> '+DOW[dow(x.day)]+' '+dm(x.day)+(multi.length>1?' · '+esc(rowOf(w,x).instructor):'')+'</span>'}).join('')+'</div>':'<p class="note">Elige la fecha de inicio y los días.</p>';
  var past=(w.start&&w.start<X.T)?'<div class="cu-ok" style="background:var(--warnbg);color:var(--warn)"><b>Grupo ya iniciado</b> · empezó el '+dmy(w.start)+'. Los encuentros pasados quedan registrados como ya dados y se podrá matricular con un valor y una entrada propios.</div>':'';
  var cfh=past+(cf.length?cfHTML(cf):(p.list.length?'<div class="cu-ok">Sin cruces con otros grupos ✓</div>':''));
  var edt=editor(w,p,cf);
  return X.head(isC?'Nuevo curso':'Nuevo grupo · '+esc(c?c.name:''),isC?'Crea el curso y su primer grupo en un solo paso.':(w.tpl?'Repetido desde “'+esc(w.tpl.name)+'”: mismos días, hora, sala e instructor. Cambia solo lo que haga falta.':'Define días, hora y cupos.'),'<button class="btn s" data-cu="cancel">Cancelar</button>')
  +(w.msg?'<div class="err" id="cuErr" role="alert">'+esc(w.msg)+'</div>':'')
  +'<form class="card cu-form" id="cuForm" novalidate><div class="cu-two">'
  +(isC?'<label class="cu-wide">Nombre del curso<input data-cuf="courseName" maxlength="120" value="'+esc(w.courseName)+'" placeholder="Ej.: Marketplace"></label><div class="cu-wide"><label>Color del curso</label><div class="cu-sws">'+sw+'</div></div>':'')
  +'<label>Nombre del grupo<input data-cuf="groupName" maxlength="120" value="'+esc(w.groupName)+'"></label>'
  +'<label>Primer encuentro<input type="date" data-cuf="start" value="'+esc(w.start)+'"></label>'
  +'<div><label>Veces por semana</label>'+wk+'</div><div><label>Días</label>'+dchips+'</div>'
  +'<label>Hora de inicio<input type="time" data-cuf="time" value="'+esc(w.time)+'"></label><label>Duración de cada encuentro<select data-cuf="hours">'+durs+'</select></label>'
  +'<label>Cantidad de encuentros<input type="number" min="1" max="104" inputmode="numeric" data-cuf="count" data-nowheel value="'+esc(w.count)+'"></label><label>Cupos<input type="number" min="1" max="500" inputmode="numeric" data-cuf="capacity" data-nowheel value="'+esc(w.capacity)+'"></label>'
  +'<label>Instructor<select data-cuf="instructor">'+opt(instructors(),w.instructor)+'</select></label><label>Sala<select data-cuf="room">'+opt(rooms(),w.room)+'</select></label>'
  +'<label>Precio de referencia (R$)<input inputmode="decimal" data-cuf="price" value="'+esc(w.price)+'" placeholder="0"></label></div>'
  +(p.list.length?'<div class="cu-sum"><b>'+p.list.length+' encuentros → termina el '+DOW[dow(p.end)]+' '+dmy(p.end)+'</b> <span class="note">(≈ '+weeks+' semanas)</span>'+(sk?'<div style="margin-top:6px">Se saltan: '+sk+'</div>':'')+'</div>':'')
  +cfh+prev0+edt+prev
  +'<div class="cu-foot"><button class="btn s" type="button" data-cu="cancel">Cancelar</button><button class="btn p" type="submit" id="cuSave"'+(C.busy?' disabled':'')+'>'+(C.busy?'Guardando…':(isC?'Crear curso y grupo':'Guardar grupo'))+'</button></div>'
  +(w.msg?'<div class="err" style="margin-top:12px" role="alert">'+esc(w.msg)+'</div>':'')+'</form>';
}
function readForm(){
  var w=C.wiz;document.querySelectorAll('[data-cuf]').forEach(function(el){w[el.dataset.cuf]=el.value});
  w.hours=Number(w.hours);
}
function money(s){var n=Number(String(s||'').replace(/\./g,'').replace(',','.'));return isFinite(n)&&n>=0?Math.round(n*100):NaN}
function friendly(e){
  var m=(e&&e.message)||'';
  var oc=/Ocupado el (\d{4}-\d{2}-\d{2}) de (\d{2}:\d{2}) a (\d{2}:\d{2})(?:\s*·\s*(.*))?$/.exec(m);
  if(oc){
    var when=DOW[dow(oc[1])]+' '+dm(oc[1])+' de '+oc[2]+' a '+oc[3],pt=(oc[4]||'').split(' · ').map(function(x){return x.trim()});
    if(/^Curso:/.test(pt[0]||''))return 'Choca con el grupo «'+pt[0].replace(/^Curso:\s*/,'')+(pt[1]?' · '+pt[1]:'')+'» ('+(pt[2]||'otro instructor')+(pt[3]?', '+pt[3].toLowerCase():'')+') el '+when+'. Si es el mismo grupo que querías crear, ábrelo y usa «Editar grupo» en lugar de crearlo otra vez. Si no, cambia el instructor, la sala o el horario.';
    if(/^Servicio:/.test(pt[0]||''))return 'Choca con el servicio «'+pt[0].replace(/^Servicio:\s*/,'')+'»'+(pt[1]?' de '+pt[1]:'')+(pt[2]?' ('+pt[2].toLowerCase()+')':'')+' el '+when+'. Ese horario ya está ocupado en la agenda: prueba otro horario, otro día u otro instructor.';
    return 'Ese horario ya está ocupado el '+when+'. Revisa instructor y sala.';
  }
  if(/superan el total/.test(m))return 'Los encuentros de los módulos superan el total previsto del curso.';
  if(/instructor registrado/.test(m))return 'Ese instructor no está registrado.';
  if(e&&e.code==='40001')return 'Otro equipo cambió este dato. Vuelve a Cursos y reintenta.';
  if(/timeout/.test(m))return 'El servidor tardó en responder. No se confirmó el guardado: revisa Cursos antes de reintentar.';
  return m||'No se pudo guardar.';
}
function save(){
  if(C.busy)return;var w=C.wiz;readForm();w.msg='';
  var p=plan(w),cf=conflicts(w,p),isC=w.mode==='course',name=(w.courseName||'').trim(),gname=(w.groupName||'').trim();
  var cap=Number(w.capacity),total=money(w.price);
  function bad(t){w.msg=t;X.render();var e=document.getElementById('cuErr');if(e)e.scrollIntoView({block:'center'})}
  if(isC&&name.length<2)return bad('Escribe el nombre del curso.');
  if(isC&&C.cat.courses.some(function(c){return c.name.toLowerCase()===name.toLowerCase()}))return bad('Ya existe un curso con ese nombre.');
  if(gname.length<1)return bad('Escribe el nombre del grupo.');
  if(!p.list.length)return bad('Elige la fecha de inicio, los días y la cantidad de encuentros.');
  if(!Number.isInteger(cap)||cap<1||cap>500)return bad('Revisa los cupos (de 1 a 500).');
  if(isNaN(total))return bad('Revisa el precio de referencia.');
  if(cf.length)return bad('Hay '+cf.length+' cruce(s) de horario con otros grupos. Corrígelos antes de guardar.');
  var a0=parseInt(w.time.slice(0,2),10)*60+parseInt(w.time.slice(3,5),10),a1=a0+Math.round(w.hours*60);
  if(a1>1440||a0<0)return bad('Revisa la hora de inicio y la duración.');
  var cat=C.cat,c=cat.courses.filter(function(x){return x.id===w.courseId})[0],v2=cat.academic_version===2,tpl=w.tpl;
  var tplS=tpl?(tpl.sessions||[]).slice().sort(function(a,b){return a.day<b.day?-1:1}):[];
  var sessions=p.list.map(function(x,i){var r=rowOf(w,x),o={day:x.day,start_min:a0,end_min:a1,module:(r.module||'').trim().slice(0,160),instructor:r.instructor,room:r.room};if(!v2){delete o.instructor;delete o.room}return o});
  var mods=c?(c.modules||[]):[];
  var same=tpl&&w.price===w.priceBase;
  var group={name:gname,course_id:'',instructor:w.instructor,room:w.room,capacity:cap,fee_cents:same?Number(tpl.fee_cents):0,installments:same?Number(tpl.installments):(total>0?1:0),monthly_cents:same?Number(tpl.monthly_cents):total,active:true,sessions:sessions};
  if(v2)group.module_plan=mods.map(function(n){var old=tpl&&(tpl.module_plan||[]).filter(function(m){return m.name===n})[0];return(old&&w.instructor===w.i0&&w.room===w.r0)?old:{name:n,instructor:w.instructor,room:w.room}});
  var sig=JSON.stringify(group)+name;if(w.sig!==sig){w.sig=sig;w.rid={c:uuid(),g:uuid()}}
  C.busy=true;X.render();
  var courseStep=isC&&!w.saved?ac('course_save',(function(){var d={name:name,modules:[],active:true,request_id:w.rid.c};if(cat.course_templates===1){d.encounter_count=p.list.length;d.module_counts={}}return d})()).then(function(r){if(!r||!r.saved)throw Error('El servidor no confirmó el curso.');w.saved={courseId:r.course_id||w.rid.c};if(X.demo)demoApply('course',name,w.saved.courseId)}):Promise.resolve();
  courseStep.then(function(){
    group.course_id=isC?w.saved.courseId:w.courseId;group.request_id=w.rid.g;
    return ac('group_save',group);
  }).then(function(r){
    if(!r||!r.saved)throw Error('El servidor no confirmó el grupo.');
    var gid=r.group_id||w.rid.g;
    if(isC)setColor(group.course_id,w.color);
    if(X.demo)demoApply('group',group,gid);
    return(X.demo?Promise.resolve():load(true)).then(function(){C.busy=false;C.wiz=null;C.selG=gid;C.msg='Guardado: '+gname+' · '+p.list.length+' encuentros, del '+dmy(p.list[0].day)+' al '+dmy(p.end)+'.';X.render();window.scrollTo(0,0)});
  }).catch(function(e){
    C.busy=false;w.msg=(w.saved?'El curso ya quedó creado; no hace falta crearlo otra vez. ':'')+'No se guardó el grupo. '+friendly(e);X.render();var el=document.getElementById('cuErr');if(el)el.scrollIntoView({block:'center'});
  });
}
/* ---------- editar / cancelar grupo ---------- */
function sessOut(x,ins,room){return{id:x.id,day:x.day,start_min:x.start_min,end_min:x.end_min,module:x.module||'',instructor:ins!==undefined?ins:(x.instructor||''),room:room!==undefined?room:(x.room||'')}}
function startEdit(gid){
  var g=C.cat.groups.filter(function(x){return x.id===gid})[0];if(!g)return;
  var s=span(g),past=s.list.filter(function(x){return x.day<X.T}),fut=s.list.filter(function(x){return x.day>=X.T}),ref=fut[0]||s.list[0];
  var t=Math.round((Number(g.fee_cents)+Number(g.installments)*Number(g.monthly_cents))/100);
  C.ed={gid:gid,g:g,version:g.version,name:g.name,cap:String(g.capacity),instr:g.instructor||'Joel',room:g.room||'Sala 3',price:String(t),priceBase:String(t),resched:false,days:fut.length?(function(){var d=[];fut.forEach(function(x){var k=dow(x.day);if(d.indexOf(k)<0)d.push(k)});return d})():[4],time:ref?hhmm(ref.start_min):'15:00',hours:ref?(ref.end_min-ref.start_min)/60:2,start:fut.length?fut[0].day:X.T,count:fut.length||10,include:{},past:past,fut:fut,msg:'',rid:uuid()};
  C.wiz=null;C.msg='';X.render();window.scrollTo(0,0);
}
function edSessions(e){
  var out=e.past.map(function(x){return sessOut(x)}),ni=e.instr!==e.g.instructor,nr=e.room!==e.g.room;
  function ins(x){return(ni&&(x.instructor===e.g.instructor||!x.instructor))?e.instr:(x.instructor||e.instr)}
  function rm(x){return(nr&&(x.room===e.g.room||!x.room))?e.room:(x.room||e.room)}
  var a0=parseInt(e.time.slice(0,2),10)*60+parseInt(e.time.slice(3,5),10),a1=a0+Math.round(Number(e.hours)*60);
  if(!e.resched){e.fut.forEach(function(x){out.push(sessOut(x,ins(x),rm(x)))});return out}
  var p=plan0({start:e.start,days:e.days,count:e.count,include:e.include});
  p.list.forEach(function(it,i){var old=e.fut[i];var o={day:it.day,start_min:a0,end_min:a1,module:old?(old.module||''):'',instructor:old?ins(old):e.instr,room:old?rm(old):e.room};if(old)o.id=old.id;out.push(o)});
  return out;
}
function edView(){
  var e=C.ed,g=e.g,c=C.cat.courses.filter(function(x){return x.id===g.course_id})[0]||{name:g.course||''};
  var list=edSessions(e),cf=clash(list.filter(function(x){return x.day>=X.T}).map(function(x){return{day:x.day,start_min:x.start_min,end_min:x.end_min,instructor:x.instructor||e.instr,room:x.room||e.room}}),e.gid,g.course_id);
  var opt=function(l,v){var q=l.indexOf(v)<0&&v?l.concat([v]):l;return q.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>'}).join('')};
  var durs=[1,1.5,2,2.5,3,4].map(function(h){return '<option value="'+h+'"'+(Number(e.hours)===h?' selected':'')+'>'+h+' h</option>'}).join('');
  var dchips=[1,2,3,4,5,6,0].map(function(d){return '<button type="button" class="chip" aria-pressed="'+(e.days.indexOf(d)>-1)+'" data-cu="edday" data-d="'+d+'">'+DOW[d]+'</button>'}).join('');
  var fut=list.filter(function(x){return x.day>=X.T}),pastN=e.past.length;
  var res=e.resched?'<div class="cu-two" style="margin-top:10px"><div class="cu-wide"><label>Días de la semana</label>'+dchips+'</div><label>Hora de inicio<input type="time" data-cue="time" value="'+esc(e.time)+'"></label><label>Duración<select data-cue="hours">'+durs+'</select></label><label>Desde el día<input type="date" data-cue="start" value="'+esc(e.start)+'"></label><label>Encuentros que faltan<input type="number" min="0" max="104" inputmode="numeric" data-nowheel data-cue="count" value="'+esc(e.count)+'"></label></div>':'';
  var prev=fut.length?'<div class="cu-prev">'+fut.map(function(x,i){return '<span class="cu-d'+(cf.some(function(k){return k.day===x.day})?' bad':'')+'"><b>'+(pastN+i+1)+'</b> '+DOW[dow(x.day)]+' '+dm(x.day)+' '+hhmm(x.start_min)+'</span>'}).join('')+'</div>':'<p class="note">No quedan encuentros por dar.</p>';
  var wasNum=e.fut.length;
  return X.head('Editar grupo · '+esc(c.name),'«'+esc(g.name)+'» · '+Number(g.students)+' alumno(s). Los encuentros ya dados no se tocan.','<button class="btn s" data-cu="edcancel">Volver</button>')
   +(e.msg?'<div class="err" id="cuErr" role="alert">'+esc(e.msg)+'</div>':'')
   +'<form class="card cu-form" id="edForm" novalidate><div class="cu-two">'
   +'<label>Nombre del grupo<input data-cue="name" maxlength="120" value="'+esc(e.name)+'"></label>'
   +'<label>Cupos (mínimo '+Number(g.students)+')<input type="number" min="'+Math.max(1,Number(g.students))+'" max="500" inputmode="numeric" data-nowheel data-cue="cap" value="'+esc(e.cap)+'"></label>'
   +'<label>Instructor<select data-cue="instr">'+opt(instructors(),e.instr)+'</select></label><label>Sala<select data-cue="room">'+opt(rooms(),e.room)+'</select></label>'
   +'<label>Precio de referencia (R$)<input inputmode="decimal" data-cue="price" value="'+esc(e.price)+'"></label></div>'
   +'<div class="cu-sum" style="margin-top:14px"><b>Horario actual:</b> '+(pastN?pastN+' ya dado'+(pastN===1?'':'s')+' · ':'')+wasNum+' por dar'+(e.fut[0]?' · próximo '+DOW[dow(e.fut[0].day)]+' '+dm(e.fut[0].day)+' '+hhmm(e.fut[0].start_min)+'–'+hhmm(e.fut[0].end_min):'')+'</div>'
   +'<div style="margin-top:10px"><button type="button" class="btn s" data-cu="edres" aria-pressed="'+e.resched+'">'+(e.resched?'✓ Cambiando los días y el horario de lo que falta':'Cambiar los días y el horario de lo que falta')+'</button><p class="note" style="margin:6px 0 0">Reprograma solo los encuentros que aún no se dieron, conservando su módulo y su asistencia. Si el horario estaba mal, hazlo aquí.</p></div>'
   +res+(cf.length?cfHTML(cf):(fut.length?'<div class="cu-ok" style="margin-top:12px">Sin cruces con otros grupos ✓</div>':''))+prev
   +'<div class="cu-foot"><button class="btn s" type="button" data-cu="edcancel">Cancelar</button><button class="btn p" type="submit"'+(C.busy?' disabled':'')+'>'+(C.busy?'Guardando…':'Guardar cambios')+'</button></div></form>';
}
function readEd(){var e=C.ed;document.querySelectorAll('[data-cue]').forEach(function(el){e[el.dataset.cue]=el.value});e.hours=Number(e.hours)}
function edSave(){
  if(C.busy)return;var e=C.ed;readEd();e.msg='';var g=e.g;
  function bad(t){e.msg=t;X.render();var x=document.getElementById('cuErr');if(x)x.scrollIntoView({block:'center'})}
  var name=(e.name||'').trim(),cap=Number(e.cap),total=money(e.price);
  if(name.length<1)return bad('Escribe el nombre del grupo.');
  if(!Number.isInteger(cap)||cap<1||cap>500)return bad('Revisa los cupos (de 1 a 500).');
  if(cap<Number(g.students))return bad('Hay '+Number(g.students)+' alumnos matriculados: los cupos no pueden ser menos.');
  if(isNaN(total))return bad('Revisa el precio de referencia.');
  var a0=parseInt(e.time.slice(0,2),10)*60+parseInt(e.time.slice(3,5),10);if(e.resched&&(!/^\d{4}-\d{2}-\d{2}$/.test(e.start||'')||!e.days.length))return bad('Elige el día de inicio y los días de la semana.');
  if(e.resched&&(a0<0||a0+Math.round(e.hours*60)>1440))return bad('Revisa la hora de inicio y la duración.');
  var sessions=edSessions(e);if(!sessions.length)return bad('El grupo debe tener al menos un encuentro.');
  if(sessions.length>104)return bad('Máximo 104 encuentros por grupo.');
  var cf=clash(sessions.filter(function(x){return x.day>=X.T}).map(function(x){return{day:x.day,start_min:x.start_min,end_min:x.end_min,instructor:x.instructor||e.instr,room:x.room||e.room}}),e.gid,g.course_id);
  if(cf.length)return bad('Hay '+cf.length+' cruce(s) de horario con otros grupos. Corrígelos antes de guardar.');
  var same=e.price===e.priceBase;
  var payload={id:e.gid,expected:e.version,course_id:g.course_id,name:name,instructor:e.instr,room:e.room,capacity:cap,fee_cents:same?Number(g.fee_cents):0,installments:same?Number(g.installments):(total>0?1:0),monthly_cents:same?Number(g.monthly_cents):total,active:g.active!==false,module_plan:g.module_plan||[],sessions:sessions,request_id:e.rid};
  C.busy=true;X.render();
  ac('group_save',payload).then(function(r){
    if(!r||!r.saved)throw Error('El servidor no confirmó el cambio.');
    if(X.demo)demoEdit(e.gid,payload);
    return(X.demo?Promise.resolve():load(true)).then(function(){C.busy=false;C.ed=null;C.selG=e.gid;C.detail={};C.msg='Guardado: '+name+'. Los alumnos ya matriculados verán el horario actualizado.';X.render();window.scrollTo(0,0)});
  }).catch(function(er){C.busy=false;e.rid=uuid();e.msg='No se guardó. '+friendly(er);X.render();var x=document.getElementById('cuErr');if(x)x.scrollIntoView({block:'center'})});
}
function setActive(gid,on){
  var g=C.cat.groups.filter(function(x){return x.id===gid})[0];if(!g)return;
  var d=document.getElementById('dlg');
  var payload={id:gid,expected:g.version,course_id:g.course_id,name:g.name,instructor:g.instructor,room:g.room,capacity:Number(g.capacity),fee_cents:Number(g.fee_cents),installments:Number(g.installments),monthly_cents:Number(g.monthly_cents),active:on,module_plan:g.module_plan||[],sessions:(g.sessions||[]).map(function(x){return sessOut(x)}),request_id:uuid()};
  if(!payload.sessions.length){C.msg='';X.dlg('No se puede','<div class="err">Este grupo no tiene encuentros, así que no se puede cambiar su estado desde aquí.</div>');return}
  var btn=d&&d.querySelector('.cu-danger');if(btn){btn.disabled=true;btn.textContent=on?'Reactivando…':'Cancelando…'}
  function viaSave(){return ac('group_save',payload)}
  var step=X.demo?viaSave():X.rpc('forma_enrolment_admin',{p_action:'group_set_active',p_data:{group_id:gid,expected:g.version,active:on,request_id:uuid()}}).catch(function(er){
    if(er&&(er.code==='PGRST202'||er.code==='42883'||er.code==='42501'||/Acción no admitida|Falta identificador/.test(er.message||'')))return viaSave();throw er});
  step.then(function(r){
    if(!r||!r.saved)throw Error('El servidor no confirmó el cambio.');
    if(X.demo)demoEdit(gid,payload);
    return(X.demo?Promise.resolve():load(true))
  }).then(function(){if(d&&d.open)d.close();C.detail={};C.msg=on?'Grupo reactivado.':'Grupo cancelado. Sus alumnos, pagos e historial se conservan.';X.render()},function(er){X.dlg(on?'No se pudo reactivar':'No se pudo cancelar','<div class="err">'+esc(friendly(er))+' No se cambió nada.</div><p class="note">Detalle técnico: '+esc((er&&er.code)||'sin código')+' · '+esc(String((er&&er.message)||'').slice(0,200))+'</p>')});
}
function cancelDlg(gid){
  var g=C.cat.groups.filter(function(x){return x.id===gid})[0];if(!g)return;
  var n=Number(g.students)||0,f=g.financial||{},paid=Number(f.paid_cents)||0;
  X.dlg('Cancelar grupo','<p><b>'+esc((g.course||'')+' · '+g.name)+'</b></p>'
   +(n?'<div class="err"><b>Tiene '+n+' alumno(s) matriculado(s)'+(paid?' y '+X.R(paid)+' ya recibidos':'')+'.</b> Antes de cancelar, avisa a esos alumnos y decide qué pasa con ellos.</div>':'<p class="note">No tiene alumnos matriculados.</p>')
   +'<p class="note">Cancelar <b>no borra</b> alumnos, pagos ni historial: el grupo queda marcado como «Cancelado» y sus clases dejan de ocupar la agenda. Puedes reactivarlo cuando quieras.</p>'
   +'<div class="cu-acts"><button class="btn p cu-danger" data-cu="cancelok" data-id="'+gid+'">Sí, cancelar el grupo</button><button class="btn s" data-act="cerrar">No, volver</button></div>',false);
}
function demoEdit(gid,pl){
  var g=C.demoCat.groups.filter(function(x){return x.id===gid})[0];if(!g)return;
  g.name=pl.name;g.instructor=pl.instructor;g.room=pl.room;g.capacity=pl.capacity;g.fee_cents=pl.fee_cents;g.installments=pl.installments;g.monthly_cents=pl.monthly_cents;g.active=pl.active;g.version=(g.version||1)+1;
  g.sessions=pl.sessions.map(function(x){return{id:x.id||uuid(),day:x.day,start_min:x.start_min,end_min:x.end_min,module:x.module,instructor:x.instructor,room:x.room}});
}
/* ---------- eventos ---------- */
function click(e){
  var b=e.target.closest('[data-cu]');if(!b)return false;if(X.view()!=='cursos'&&['insman','insadd','instog'].indexOf(b.dataset.cu)<0)return false;
  var k=b.dataset.cu,w=C.wiz;
  if(k==='pick'){C.selG=b.dataset.id;C.msg='';X.render();return true}
  if(k==='insman'){insDialog();return true}
  if(k==='insadd'){insAdd();return true}
  if(k==='instog'){insToggle(b.dataset.n,b.dataset.a==='1');return true}
  if(k==='newc'){startWiz('',null);return true}
  if(k==='newg'){startWiz(b.dataset.id,null);return true}
  if(k==='repeat'){var g=C.cat.groups.filter(function(x){return x.id===b.dataset.id})[0];if(g)startWiz(g.course_id,g.id);return true}
  if(k==='cancel'){C.wiz=null;X.render();return true}
  if(k==='color'){var cid=b.dataset.id,cc=b.dataset.c,oth=C.cat.courses.filter(function(o){return o.id!==cid&&ownColor(o)===cc})[0];if(oth){C.msg='';X.dlg('Color ya usado','<p>Ese color ya lo usa <b>'+esc(oth.name)+'</b>. Elige otro para que cada curso se distinga.</p>');return true}setColor(cid,cc);X.render();return true}
  if(k==='vw'){C.vw=b.dataset.cv;X.render();return true}
  if(k==='calm'){C.calM=b.dataset.m;X.render();return true}
  if(k==='editg'){startEdit(b.dataset.id);return true}
  if(k==='cancelg'){cancelDlg(b.dataset.id);return true}
  if(k==='cancelok'){setActive(b.dataset.id,false);return true}
  if(k==='react'){setActive(b.dataset.id,true);return true}
  if(k==='gopen'){var gd=document.getElementById('dlg');if(gd&&gd.open)gd.close();C.wiz=null;C.ed=null;C.selG=b.dataset.id;C.msg='';X.render();window.scrollTo(0,0);return true}
  if(k==='fclear'){C.flt={c:'',st:'',m:'',h:''};X.render();return true}
  if(k==='edcancel'){C.ed=null;X.render();return true}
  if(k==='edres'){readEd();C.ed.resched=!C.ed.resched;X.render();return true}
  if(k==='edday'){readEd();var E=C.ed,dd=Number(b.dataset.d),ix=E.days.indexOf(dd);if(ix>-1){if(E.days.length>1)E.days.splice(ix,1)}else E.days.push(dd);X.render();return true}
  if(!w)return false;
  readForm();
  if(k==='day'){var d=Number(b.dataset.d),i=w.days.indexOf(d);if(i>-1){if(w.days.length>1)w.days.splice(i,1)}else w.days.push(d);X.render();return true}
  if(k==='perweek'){var n=Number(b.dataset.n);if(w.days.length>n)w.days=w.days.slice(0,n);else while(w.days.length<n){var cand=[1,4,2,5,3,6,0].filter(function(x){return w.days.indexOf(x)<0})[0];w.days.push(cand)}X.render();return true}
  if(k==='wcolor'){w.color=b.dataset.c;X.render();return true}
  if(k==='edit'){w.edit=!w.edit;X.render();return true}
  if(k==='rm'){w.rm=w.rm||{};w.rm[b.dataset.d]=true;if(w.ov)delete w.ov[b.dataset.d];X.render();return true}
  if(k==='addday'){var nd=w.newDay;if(!/^\d{4}-\d{2}-\d{2}$/.test(nd||'')){w.msg='Elige la fecha del encuentro que quieres añadir.';X.render();return true}w.extra=w.extra||[];if(w.extra.indexOf(nd)<0)w.extra.push(nd);if(w.rm)delete w.rm[nd];w.newDay='';w.msg='';X.render();return true}
  if(k==='bulk'){var P=plan(w),f=Math.max(1,Number(w.bFrom)||1),t=Math.min(P.list.length,Number(w.bTo)||P.list.length);w.ov=w.ov||{};P.list.forEach(function(x){if(x.n>=f&&x.n<=t){var o=w.ov[x.day]=w.ov[x.day]||{};if(w.bIns)o.instructor=w.bIns;if(w.bRoom)o.room=w.bRoom}});X.render();return true}
  if(k==='inc'){w.include[b.dataset.d]=true;X.render();return true}
  return false;
}
document.addEventListener('change',function(e){if(e.target.dataset&&e.target.dataset.cuflt&&X&&X.view()==='cursos'){C.flt[e.target.dataset.cuflt]=e.target.value;X.render();return}
if(C.ed&&e.target.dataset&&e.target.dataset.cue&&X&&X.view()==='cursos'){readEd();C.ed.msg='';X.render();return}
if(C.wiz&&e.target.dataset&&e.target.dataset.cuo&&X&&X.view()==='cursos'){var pr=e.target.dataset.cuo.split('|'),W=C.wiz;W.ov=W.ov||{};(W.ov[pr[0]]=W.ov[pr[0]]||{})[pr[1]]=e.target.value;W.msg='';X.render();return}
if(C.wiz&&e.target.dataset&&e.target.dataset.cuf&&X&&X.view()==='cursos'){readForm();C.wiz.msg='';X.render()}});
document.addEventListener('submit',function(e){if(e.target.id==='cuForm'){e.preventDefault();save()}if(e.target.id==='edForm'){e.preventDefault();edSave()}});
document.addEventListener('wheel',function(e){var t=document.activeElement;if(t&&t.type==='number'&&t.dataset&&t.dataset.nowheel!==undefined)t.blur()},{passive:true});
/* ---------- ejemplo ---------- */
function demoCatalog(){
  var T=X.T,M=X.M,mon=M.monday(T);function mk(start,days,n,sm,em,ins,room){var out=[],d=start,i=0,g=0;while(i<n&&g++<400){if(days.indexOf(dow(d))>-1){out.push({id:uuid(),day:d,start_min:sm,end_min:em,instructor:ins,room:room,module:'Módulo '+(i+1)});i++}d=M.plus(d,1)}return out}
  var c1='c-met',c2='c-est',c3='c-edu';
  return{version:1,academic:true,academic_version:2,course_templates:1,courses:[{id:c1,name:'Método FORMA',modules:[],active:true,encounter_count:25},{id:c2,name:'Estructura Empresarial',modules:[],active:true,encounter_count:12},{id:c3,name:'Educación Financiera',modules:[],active:true,encounter_count:10}],groups:[
   {id:'g1',course_id:c1,course:'Método FORMA',name:'Grupo octubre',instructor:'Joel',room:'Sala 3',capacity:12,students:9,active:true,financial:{contracted_cents:2610000,paid_cents:1500000,pending_cents:1110000},fee_cents:20000,installments:3,monthly_cents:90000,sessions:mk(M.plus(mon,-14),[1,4],25,900,1020,'Joel','Sala 3').map(function(x,i){if(i%3===1)x.instructor='René';if(i%3===2)x.instructor='Luis';return x})},
   {id:'g2',course_id:c2,course:'Estructura Empresarial',name:'Grupo octubre',instructor:'René',room:'Sala 2',capacity:10,students:6,active:true,financial:{contracted_cents:720000,paid_cents:480000,pending_cents:240000},fee_cents:0,installments:1,monthly_cents:120000,sessions:mk(M.plus(mon,-7),[2,4],12,780,900,'René','Sala 2')},
   {id:'g3',course_id:c3,course:'Educación Financiera',name:'Grupo noviembre',instructor:'Miguel',room:'Sala 1',capacity:10,students:1,active:true,financial:{contracted_cents:290000,paid_cents:145000,pending_cents:145000},fee_cents:20000,installments:3,monthly_cents:30000,sessions:mk(M.plus(mon,14),[1,4],10,780,900,'Miguel','Sala 1')},
   {id:'g4',course_id:c3,course:'Educación Financiera',name:'Grupo diciembre',instructor:'Miguel',room:'Sala 1',capacity:10,students:0,active:true,financial:{contracted_cents:0,paid_cents:0,pending_cents:0},fee_cents:20000,installments:3,monthly_cents:30000,sessions:mk(M.plus(mon,49),[2,5],10,900,1020,'Miguel','Sala 1')}]};
}
function demoApply(kind,a,b){
  if(kind==='course'){C.demoCat.courses.push({id:b,name:a,modules:[],active:true,encounter_count:0});return}
  var cg=C.demoCat.courses.filter(function(c){return c.id===a.course_id})[0];
  C.demoCat.groups.push({id:b,course_id:a.course_id,course:cg?cg.name:'',name:a.name,instructor:a.instructor,room:a.room,capacity:a.capacity,students:0,active:true,fee_cents:a.fee_cents,installments:a.installments,monthly_cents:a.monthly_cents,sessions:a.sessions.map(function(s){return{id:uuid(),day:s.day,start_min:s.start_min,end_min:s.end_min,instructor:a.instructor,room:a.room,module:s.module}})});
}
window.GestionCursos={insDialog:function(){return load(false).then(function(){insDialog()})},init:function(ctx){X=ctx},cat:function(){return C.cat},html:html,load:load,click:click,demoAcademic:function(a){return a.p_action==='course_save'?{saved:true,course_id:a.p_data.request_id}:a.p_action==='group_save'?{saved:true,group_id:a.p_data.request_id}:null}};
})();
