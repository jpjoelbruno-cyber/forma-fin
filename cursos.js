/* FORMA Gestión · Cursos y grupos (tablero por mes + asistente "Nuevo grupo / Repetir").
   Usa las mismas operaciones del servidor que la pantalla clásica (forma_academic: catalog, course_save, group_save, group_detail).
   Antes de guardar valida fechas, cupos y cruces de horario para no dejar un curso a medias. No borra nada. */
(function(){'use strict';
var X=null,C={cat:null,err:'',busy:false,selG:null,detail:{},wiz:null,msg:'',demoCat:null};
var PAL=['#7C3AED','#0D9488','#F97316','#DB2777','#2563EB','#CA8A04','#DC2626','#0891B2'];
var DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],MES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var FERIADOS={'2026-11-02':'Finados','2026-11-20':'Conciencia Negra','2026-12-25':'Navidad','2027-01-01':'Año Nuevo','2027-02-16':'Carnaval','2027-04-02':'Viernes Santo','2027-04-21':'Tiradentes','2027-05-01':'Día del Trabajo'};
var SUGERIDAS={'2026-12-24':'Nochebuena','2026-12-31':'Fin de Año'};
function esc(s){return X.esc(s)}
function uuid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
function colorOf(c){
  try{var v=localStorage.getItem('forma-color-'+c.id);if(v&&PAL.indexOf(v)>-1)return v}catch(e){}
  var used={};if(C.cat)C.cat.courses.forEach(function(o){if(o.id===c.id)return;try{var u=localStorage.getItem('forma-color-'+o.id);if(u)used[u]=(used[u]||0)+1}catch(e){}});
  var best=null,bi=hash(c.id||c.name||'')%PAL.length;for(var k=0;k<PAL.length;k++){var p=PAL[(bi+k)%PAL.length];if(best===null||(used[p]||0)<(used[best]||0))best=p;if(!used[p])break}
  setColor(c.id,best);return best;
}
function setColor(id,col){try{localStorage.setItem('forma-color-'+id,col)}catch(e){}}
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
function seats(cap,n){
  if(cap>30)return '<b class="num">'+n+' / '+cap+'</b>';
  var o='';for(var i=0;i<cap;i++)o+='<i class="cu-seat'+(i<n?' on':'')+'"></i>';return o;
}
/* ---------- carga ---------- */
function load(force){
  if(C.cat&&!force)return Promise.resolve();
  if(X.demo){if(!C.demoCat)C.demoCat=demoCatalog();C.cat=C.demoCat;return Promise.resolve()}
  return ac('catalog').then(function(d){
    if(!d||d.version!==1||!Array.isArray(d.courses)||!Array.isArray(d.groups))throw Error('catálogo');
    C.cat=d;C.err=''
  },function(e){C.err='No se pudo cargar los cursos. No se cambió nada.';C.cat=C.cat||null});
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
    var gs=cat.groups.filter(function(g){return g.course_id===c.id}).map(function(g){return{g:g,s:span(g)}}).sort(function(a,b){return(a.s.from||'9')<(b.s.from||'9')?-1:1});
    var col=colorOf(c);
    if(!gs.length){rows.push({c:c,col:col,empty:true});return}
    gs.forEach(function(x,i){rows.push({c:c,col:col,g:x.g,s:x.s,first:i===0})});
  });
  var head='<div class="cu-h"></div><div class="cu-hm">'+w.ms.map(function(m){return '<span>'+MES[m.getUTCMonth()]+(m.getUTCMonth()===0?' '+m.getUTCFullYear():'')+'</span>'}).join('')+'</div>';
  rows.forEach(function(r){
    var name='<div class="cu-n"><i class="cu-dot" style="background:'+r.col+'"></i><span>'+esc(r.c.name)+(r.c.active===false?' <small>(inactivo)</small>':'')+'</span></div>';
    if(r.empty){tl+=name+'<div class="cu-t"><button class="cu-ghost" data-cu="newg" data-id="'+r.c.id+'">+ Primer grupo de '+esc(r.c.name)+'</button></div>';return}
    var inwin=r.s.from&&r.s.to>=w.from&&r.s.from<w.to,sel=C.selG===r.g.id;
    var bar=inwin?'<button class="cu-bar'+(sel?' sel':'')+'" data-cu="pick" data-id="'+r.g.id+'" style="left:'+pct(r.s.from,w)+'%;width:'+Math.max(2.5,pct(r.s.to,w)-pct(r.s.from,w))+'%;background:'+r.col+'" title="'+esc(r.g.name)+'"><b>'+esc(r.g.name)+' · '+Number(r.g.students)+'/'+Number(r.g.capacity)+'</b><small>'+r.s.days.map(function(d){return DOW[d]}).join('-')+' '+hhmm(r.s.start)+'–'+hhmm(r.s.end)+'</small></button>':'<span class="cu-out">'+esc(r.g.name)+' · fuera de este período ('+(r.s.from?dm(r.s.from)+' → '+dm(r.s.to):'sin fechas')+')</span>';
    tl+=(r.first?name:'<div class="cu-n sub"><span></span></div>')+'<div class="cu-t">'+bar+'</div>';
    lst+='<button class="cu-card'+(sel?' sel':'')+'" data-cu="pick" data-id="'+r.g.id+'"><i class="cu-dot" style="background:'+r.col+'"></i><span><b>'+esc(r.c.name)+' · '+esc(r.g.name)+'</b><small>'+(r.s.from?dm(r.s.from)+' → '+dm(r.s.to)+' · '+r.s.days.map(function(d){return DOW[d]}).join('-')+' '+hhmm(r.s.start)+'–'+hhmm(r.s.end):'Sin fechas')+' · '+Number(r.g.students)+'/'+Number(r.g.capacity)+' cupos</small></span></button>';
  });
  var cols='<div class="cu-grid" style="--cols:'+w.ms.length+'">'+head+tl+'</div>';
  return '<div class="cu-tl">'+cols+'</div><div class="cu-list">'+(lst||'<p class="note">Aún no hay grupos con fechas.</p>')+'</div>';
}
function panel(){
  var cat=C.cat,g=cat.groups.filter(function(x){return x.id===C.selG})[0];
  if(!g)return '<section class="card cu-side"><h2>Selecciona un grupo</h2><p class="note">Toca una barra del tablero para ver cupos y alumnos, o abre un grupo nuevo.</p></section>';
  var c=cat.courses.filter(function(x){return x.id===g.course_id})[0]||{id:g.course_id,name:g.course||''},s=span(g),col=colorOf(c);loadDetail(g.id);
  var d=C.detail[g.id]||{},al=d.loading?'<p class="note">Cargando alumnos…</p>':d.err?'<p class="note">No se pudo cargar la lista.</p>':((d.students||[]).filter(function(x){return x.state!=='cancelado'}).slice(0,12).map(function(x){var debt=Number(x.total_cents)-Number(x.paid_cents);return '<div class="row"><div class="t"><b>'+esc(x.name)+'</b></div>'+(debt>0?'<span class="pill" style="background:var(--warnbg);color:var(--warn)">Debe '+X.R(debt)+'</span>':'<span class="pill up">Al día</span>')+'</div>'}).join('')||'<p class="note">Aún no hay alumnos matriculados.</p>');
  var sw=PAL.map(function(p){return '<button class="cu-sw'+(p===col?' on':'')+'" data-cu="color" data-id="'+c.id+'" data-c="'+p+'" style="background:'+p+'" aria-label="Color '+p+'"></button>'}).join('');
  return '<section class="card cu-side"><h2><span><i class="cu-dot" style="background:'+col+'"></i><span>'+esc(c.name)+' · '+esc(g.name)+'</span></span></h2>'
   +'<p class="note" style="margin:0 0 10px">'+(s.from?s.days.map(function(x){return DOW[x]}).join(' y ')+' · '+hhmm(s.start)+'–'+hhmm(s.end)+' · '+esc(g.room||'')+' · '+esc(g.instructor||'')+'<br>'+dmy(s.from)+' → '+dmy(s.to)+' · '+s.n+' encuentros':'Sin fechas preparadas')+'</p>'
   +'<b>Cupos '+Number(g.students)+' de '+Number(g.capacity)+'</b><div class="cu-seats">'+seats(Number(g.capacity),Number(g.students))+'</div>'
   +'<div class="list" style="margin:8px 0 12px">'+al+'</div>'
   +'<div class="cu-acts"><button class="btn p" data-act="matricular">+ Matricular en este grupo</button><button class="btn s" data-cu="repeat" data-id="'+g.id+'">Repetir para el mes siguiente</button><button class="btn s" data-act="viejo">Editar fechas y horarios</button></div>'
   +'<p class="note">Color del curso:</p><div class="cu-sws">'+sw+'</div><p class="note">El color se recuerda en este navegador.</p></section>';
}
function html(){
  if(!C.cat)return X.head('Cursos','Grupos por mes, con cupos y horarios.','')+(C.err?'<div class="err">'+esc(C.err)+'</div>':'<p class="skel" role="status">Cargando cursos…</p>');
  if(C.wiz)return wizard();
  var right='<button class="btn p" data-cu="newc">+ Nuevo curso</button>';
  var leg=C.cat.courses.map(function(c){return '<span><i class="cu-dot" style="background:'+colorOf(c)+'"></i>'+esc(c.name)+'</span>'}).join('');
  return X.head('Cursos','Cada barra es un grupo, con el color de su curso.',right)+(C.msg?'<div class="cu-ok">'+esc(C.msg)+'</div>':'')+'<div class="cu-main"><section class="card"><div class="cu-leg">'+leg+'</div>'+board()+'</section>'+panel()+'</div>';
}
/* ---------- asistente ---------- */
function instructors(){var s=['Joel','René','Luis','Emerson','Miguel'];C.cat.groups.forEach(function(g){if(g.instructor&&s.indexOf(g.instructor)<0)s.push(g.instructor)});return s}
function rooms(){var s=['Sala 1','Sala 2','Sala 3'];C.cat.groups.forEach(function(g){if(g.room&&s.indexOf(g.room)<0)s.push(g.room)});return s}
function startWiz(courseId,fromGroupId){
  var cat=C.cat,c=cat.courses.filter(function(x){return x.id===courseId})[0],tpl=null;
  if(c){var gs=cat.groups.filter(function(g){return g.course_id===courseId}).sort(function(a,b){return(span(b).from||'')<(span(a).from||'')?-1:1});tpl=fromGroupId?cat.groups.filter(function(g){return g.id===fromGroupId})[0]:gs[0]}
  var w={mode:c?'group':'course',courseId:courseId||'',tpl:tpl||null,courseName:'',color:PAL[cat.courses.length%PAL.length],start:'',days:[],time:'15:00',hours:2,count:c&&c.encounter_count?Number(c.encounter_count):12,instructor:'Joel',room:'Sala 3',capacity:10,price:'',groupName:'',include:{},rid:{},msg:'',saved:null};
  if(tpl){var s=span(tpl);w.days=s.days.slice();w.time=s.n?hhmm(s.start):'15:00';w.hours=s.n?(s.end-s.start)/60:2;w.count=s.n||w.count;w.instructor=tpl.instructor||w.instructor;w.room=tpl.room||w.room;w.capacity=Number(tpl.capacity)||10;w.price=String(Math.round((Number(tpl.fee_cents)+Number(tpl.installments)*Number(tpl.monthly_cents))/100));w.priceBase=w.price;
    if(s.to){var d=X.M.date(s.to);w.start=X.M.iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)));}}
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
function conflicts(w,p){
  var out=[],seen={},a0=Math.round(parseInt(w.time.slice(0,2),10)*60+parseInt(w.time.slice(3,5),10)),a1=a0+Math.round(Number(w.hours)*60);
  p.list.forEach(function(x){C.cat.groups.forEach(function(g){
    if(g.active===false)return;(g.sessions||[]).forEach(function(s){
      if(s.day!==x.day||s.cancelled)return;if(!(a0<s.end_min&&s.start_min<a1))return;
      var rw=rowOf(w,x),wi=rw.instructor,wr=rw.room,ins=(s.instructor||g.instructor)===wi,room=(s.room||g.room)===wr;if(!ins&&!room)return;
      var k=g.id+(ins?'i':'')+(room?'r':'');if(seen[k])return;seen[k]=1;
      out.push({day:x.day,who:(g.course||'')+' · '+g.name,why:(ins&&room?'mismo instructor y sala':ins?'mismo instructor ('+wi+')':'misma sala ('+wr+')'),time:hhmm(s.start_min)+'–'+hhmm(s.end_min)});
    })
  })});
  return out;
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
  var cfh=cf.length?'<div class="err"><b>Choca con otro grupo — corrige antes de guardar</b><ul style="margin:6px 0 0;padding-left:18px">'+cf.slice(0,6).map(function(k){return '<li>'+dm(k.day)+' '+k.time+' · '+esc(k.who)+' ('+k.why+')</li>'}).join('')+'</ul><span class="note">Cambia la sala, el instructor o la hora.</span></div>':(p.list.length?'<div class="cu-ok">Sin cruces con otros grupos ✓</div>':'');
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
  if(/Ocupado el/.test(m))return 'Choca con otro grupo: '+m+'. Cambia la sala, el instructor o la hora.';
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
/* ---------- eventos ---------- */
function click(e){
  var b=e.target.closest('[data-cu]');if(!b||X.view()!=='cursos')return false;
  var k=b.dataset.cu,w=C.wiz;
  if(k==='pick'){C.selG=b.dataset.id;C.msg='';X.render();return true}
  if(k==='newc'){startWiz('',null);return true}
  if(k==='newg'){startWiz(b.dataset.id,null);return true}
  if(k==='repeat'){var g=C.cat.groups.filter(function(x){return x.id===b.dataset.id})[0];if(g)startWiz(g.course_id,g.id);return true}
  if(k==='cancel'){C.wiz=null;X.render();return true}
  if(k==='color'){setColor(b.dataset.id,b.dataset.c);X.render();return true}
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
document.addEventListener('change',function(e){if(C.wiz&&e.target.dataset&&e.target.dataset.cuo&&X&&X.view()==='cursos'){var pr=e.target.dataset.cuo.split('|'),W=C.wiz;W.ov=W.ov||{};(W.ov[pr[0]]=W.ov[pr[0]]||{})[pr[1]]=e.target.value;W.msg='';X.render();return}
if(C.wiz&&e.target.dataset&&e.target.dataset.cuf&&X&&X.view()==='cursos'){readForm();C.wiz.msg='';X.render()}});
document.addEventListener('submit',function(e){if(e.target.id==='cuForm'){e.preventDefault();save()}});
document.addEventListener('wheel',function(e){var t=document.activeElement;if(t&&t.type==='number'&&t.dataset&&t.dataset.nowheel!==undefined)t.blur()},{passive:true});
/* ---------- ejemplo ---------- */
function demoCatalog(){
  var T=X.T,M=X.M,mon=M.monday(T);function mk(start,days,n,sm,em,ins,room){var out=[],d=start,i=0,g=0;while(i<n&&g++<400){if(days.indexOf(dow(d))>-1){out.push({id:uuid(),day:d,start_min:sm,end_min:em,instructor:ins,room:room,module:'Módulo '+(i+1)});i++}d=M.plus(d,1)}return out}
  var c1='c-met',c2='c-est',c3='c-edu';
  return{version:1,academic:true,academic_version:2,course_templates:1,courses:[{id:c1,name:'Método FORMA',modules:[],active:true,encounter_count:25},{id:c2,name:'Estructura Empresarial',modules:[],active:true,encounter_count:12},{id:c3,name:'Educación Financiera',modules:[],active:true,encounter_count:10}],groups:[
   {id:'g1',course_id:c1,course:'Método FORMA',name:'Grupo octubre',instructor:'Joel',room:'Sala 3',capacity:12,students:9,active:true,fee_cents:20000,installments:3,monthly_cents:90000,sessions:mk(M.plus(mon,-14),[1,4],25,900,1020,'Joel','Sala 3').map(function(x,i){if(i%3===1)x.instructor='René';if(i%3===2)x.instructor='Luis';return x})},
   {id:'g2',course_id:c2,course:'Estructura Empresarial',name:'Grupo octubre',instructor:'René',room:'Sala 2',capacity:10,students:6,active:true,fee_cents:0,installments:1,monthly_cents:120000,sessions:mk(M.plus(mon,-7),[2,4],12,780,900,'René','Sala 2')},
   {id:'g3',course_id:c3,course:'Educación Financiera',name:'Grupo noviembre',instructor:'Miguel',room:'Sala 1',capacity:10,students:1,active:true,fee_cents:20000,installments:3,monthly_cents:30000,sessions:mk(M.plus(mon,14),[1,4],10,780,900,'Miguel','Sala 1')}]};
}
function demoApply(kind,a,b){
  if(kind==='course'){C.demoCat.courses.push({id:b,name:a,modules:[],active:true,encounter_count:0});return}
  var cg=C.demoCat.courses.filter(function(c){return c.id===a.course_id})[0];
  C.demoCat.groups.push({id:b,course_id:a.course_id,course:cg?cg.name:'',name:a.name,instructor:a.instructor,room:a.room,capacity:a.capacity,students:0,active:true,fee_cents:a.fee_cents,installments:a.installments,monthly_cents:a.monthly_cents,sessions:a.sessions.map(function(s){return{id:uuid(),day:s.day,start_min:s.start_min,end_min:s.end_min,instructor:a.instructor,room:a.room,module:s.module}})});
}
window.GestionCursos={init:function(ctx){X=ctx},cat:function(){return C.cat},html:html,load:load,click:click,demoAcademic:function(a){return a.p_action==='course_save'?{saved:true,course_id:a.p_data.request_id}:a.p_action==='group_save'?{saved:true,group_id:a.p_data.request_id}:null}};
})();
