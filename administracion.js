/* FORMÁ Administración (solo propietario; Cursos online también edita cursos y videos): Resumen · Personas · Cursos online · Ajustes.
   Modo incrustado: si el script lleva data-embed, vive dentro de Gestión (una sola app) y no toca la cabecera ni la navegación de la página.
   Lee los mismos datos reales por las mismas funciones del servidor. Solo escribe en Cursos online (cursos, lecciones y videos), con las reglas de seguridad del servidor. */
(function(){'use strict';
var $=function(s){return document.querySelector(s)};
var demo=new URLSearchParams(location.search).get('vista')==='ejemplo';
var CS=document.currentScript,EMBED=!!(CS&&CS.hasAttribute('data-embed'));
var client=null,view='resumen',errors=[];
var D={report:null,access:null,pending:null,period:null,crm:null,edu:null,courses:null,lessons:null,phone:null,days:30,q:''};
var IC={doc:'<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"/>',home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 0 0 0-6M21 20c0-2.5-1.5-4.6-4-5.5"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'};
var NAV=[['resumen','Resumen','home'],['personas','Personas','users'],['cursos','Cursos','cap'],['cierres','Cierres','doc'],['ajustes','Ajustes','gear']];
function ico(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+IC[n]+'</svg>'}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function R0(c){return 'R$ '+Math.round(Number(c||0)/100).toLocaleString('pt-BR')}
function dt(s){if(!s)return '—';var d=new Date(s);if(isNaN(d))return '—';return d.toLocaleDateString('es',{day:'2-digit',month:'short'})}
function toast(t){var e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){e.hidden=true},3200)}
function rpc(name,args){
  if(demo)return Promise.resolve(demoRpc(name,args||{}));
  var timer,p=new Promise(function(_,rej){timer=setTimeout(function(){rej(Error('timeout'))},15000)});
  return Promise.race([client.rpc(name,args||{}),p]).then(function(r){clearTimeout(timer);if(r.error)throw r.error;return r.data},function(e){clearTimeout(timer);throw e});
}
function table(name,sel,order){
  if(demo)return Promise.resolve(demoTable(name));
  return client.from(name).select(sel).order(order).then(function(r){if(r.error)throw r.error;return r.data});
}
function safe(label,p){return p.catch(function(){errors.push(label);return null})}
function load(){
  errors=[];
  var m=new Date(),from=m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0')+'-01',to=m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0')+'-'+String(new Date(m.getFullYear(),m.getMonth()+1,0).getDate()).padStart(2,'0');
  return Promise.all([
    safe('uso',rpc('forma_admin_report',{p_days:D.days}).then(function(d){D.report=d})),
    safe('accesos',rpc('forma_admin_access_review').then(function(d){D.access=d})),
    safe('cobros',rpc('forma_finance_reports',{p_action:'period',p_data:{from:from,to:to,bucket:'day'}}).then(function(d){D.period=d})),
    safe('por cobrar',rpc('forma_finance_reports',{p_action:'pending',p_data:{offset:0}}).then(function(d){D.pending=d})),
    safe('interesados',rpc('forma_crm',{p_action:'sales',p_data:{stage:'',offset:0}}).then(function(d){D.crm=d})),
    safe('matriculados',rpc('forma_education',{p_action:'list',p_data:{query:'',offset:0,state:''}}).then(function(d){D.edu=d})),
    safe('cursos',table('forma_courses','id,title,access_level,status,position,summary','position').then(function(d){D.courses=d})),
    safe('lecciones',table('forma_course_lessons','id,course_id,module_title,title,youtube_id,status,position,body,action_text','position').then(function(d){D.lessons=d})),
    safe('WhatsApp',(demo?Promise.resolve({whatsapp:'5511999990000'}):client.from('forma_support_settings').select('whatsapp').eq('id',true).single().then(function(r){if(r.error)throw r.error;return r.data})).then(function(d){D.phone=d&&d.whatsapp||''}))
  ]);
}
function kpi(label,val,sub,cls){return '<section class="card kpi c3"><small>'+esc(label)+'</small><b class="num">'+esc(val)+'</b>'+(sub?'<span class="d '+(cls||'flat')+'">'+esc(sub)+'</span>':'')+'</section>'}
function head(t,p){if(EMBED)return '';return '<div class="head"><div><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</div></div>'}
function bars(rows,max,color){return rows.map(function(r){return '<div class="bar"><span>'+esc(r[0])+'</span><div class="tr"><i style="width:'+Math.round(100*Number(r[1])/Math.max(1,max))+'%"'+(color?';background:'+color:'')+'></i></div><b class="num">'+Number(r[1])+'</b></div>'}).join('')}
var SEC={resumo:'Inicio',registrar:'Registrar',historico:'Historial',metas:'Metas',aprender:'Aprender',anual:'Año',camino:'Mi camino',banco:'Cuentas',institution:'Mis cursos'};
var V={};
V.resumen=function(){
  var r=D.report,a=D.access,p=D.pending,per=D.period,c=D.crm,e=D.edu;
  var pend=a?Number(a.pending_count||0):null;
  var k=kpi('Personas con cuenta',r?String(r.total):'—',r?(r.activated+' con datos guardados'):'', 'flat')
   +kpi('Activas ('+D.days+' días)',r?String(r.active):'—',r?(r.verified_entries+' entraron'):'','up')
   +kpi('Accesos por validar',pend==null?'—':String(pend),pend?'Revisar en Personas':'Todo al día',pend?'down':'up')
   +kpi('Alumnos matriculados',e?String(e.count!=null?e.count:(e.items||[]).length):'—','', 'flat')
   +kpi('Cobrado este mes',per?R0(per.received_cents):'—','', 'up')
   +kpi('Por cobrar',p?R0(p.total_cents):'—',p?(Number(p.total_count)+' con saldo'):'',p&&Number(p.total_count)?'down':'up')
   +kpi('Interesados en seguimiento',c&&c.counts?String(['nuevo','conversacion','seguimiento','preparar_matricula'].reduce(function(s,x){return s+Number(c.counts[x]||0)},0)):'—','', 'flat')
   +kpi('Cursos publicados',D.courses?String(D.courses.filter(function(x){return x.status==='published'}).length):'—','', 'flat');
  var secs=r&&r.sections&&r.sections.length?bars(r.sections.map(function(s){return[SEC[s.section]||s.section,s.users]}),Math.max.apply(null,r.sections.map(function(s){return s.users})),''):'<p class="note">Todavía no hay consultas verificadas en el periodo.</p>';
  var acts=r?bars([['Presupuesto',r.budget],['Movimientos',r.movements],['Metas',r.goals],['Guías',r.learning]],Math.max(1,r.total),''):'';
  var fun=c&&c.counts?['nuevo','conversacion','seguimiento','preparar_matricula','matriculado'].map(function(x,i){return '<div class="st"><b class="num">'+Number(c.counts[x]||0)+'</b>'+['Nuevos','En conversación','Seguimiento','Por matricular','Matriculados'][i]+'<i></i></div>'}).join(''):'<p class="note">Sin datos.</p>';
  return head('Resumen','Quién usa FORMÁ, cuánto entra y qué sigue.')
   +'<div class="seg" style="margin-bottom:16px" role="group" aria-label="Periodo">'+[7,30,90].map(function(n){return '<button data-days="'+n+'" aria-pressed="'+(D.days===n)+'">'+n+' días</button>'}).join('')+'</div>'
   +'<div class="grid">'+k
   +'<section class="card c6"><h2>Qué secciones usan más</h2>'+secs+'</section>'
   +'<section class="card c6"><h2>Qué tienen guardado</h2>'+acts+'<p class="note">Personas distintas con datos en el servidor. No se muestran montos ni descripciones.</p></section>'
   +'<section class="card c12"><h2>De seguidor a alumno</h2><div class="fun">'+fun+'</div></section></div>';
};
V.personas=function(){
  var r=D.report,a=D.access,q=D.q.toLowerCase();
  var pend=((a&&a.pending)||[]).filter(function(x){return !q||(x.name||'').toLowerCase().indexOf(q)>-1||(x.email||'').toLowerCase().indexOf(q)>-1});
  var users=((r&&r.users)||[]).filter(function(u){return !q||(u.name||'').toLowerCase().indexOf(q)>-1}).slice(0,300);
  var pv=pend.length?'<div class="list">'+pend.slice(0,50).map(function(x){return '<div class="row"><div class="t"><b>'+esc(x.name||'Sin nombre')+'</b><span>'+esc(x.email||'')+' · pidió acceso '+dt(x.requested_at)+'</span></div><span class="pill warn" style="background:var(--warnbg);color:var(--warn)">Pendiente</span></div>'}).join('')+'</div><p class="note">Para dar acceso a una persona, <a class="link" href="/?abrir=accesos" data-aact="clasica">abre Validar accesos</a>. Aquí solo se consulta.</p>':'<p class="note">No hay cuentas pendientes de validar.</p>';
  var uv=users.length?'<div class="tw"><table><thead><tr><th>Persona</th><th>Primera entrada</th><th>Última actividad</th><th>Presup.</th><th>Mov.</th><th>Metas</th><th>Guías</th></tr></thead><tbody>'+users.map(function(u){return '<tr><td><b>'+esc(u.name||'Sin nombre')+'</b></td><td>'+dt(u.first_entry)+'</td><td>'+dt(u.last_seen)+'</td>'+['budget','movements','goals','learning'].map(function(k){return '<td>'+(u[k]?'●':'·')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>':'<p class="note">Sin resultados.</p>';
  return head('Personas','Quién entró, cuánto usa y quién espera acceso.')+'<input class="search" id="apq" placeholder="Buscar por nombre o correo" value="'+esc(D.q)+'" maxlength="100" style="margin-bottom:16px">'
   +'<div class="grid"><section class="card c4"><h2>Esperan acceso <span class="pill" style="background:var(--warnbg);color:var(--warn)">'+(a?Number(a.pending_count||0):'—')+'</span></h2>'+pv+'</section><section class="card c8"><h2>Con actividad</h2>'+uv+'<p class="note">● tiene datos guardados · Los montos y descripciones siguen privados.</p></section></div>';
};
/* ---- Cursos online: editor simple de cursos, módulos y videos de YouTube (escribe con las mismas tablas y reglas de seguridad del editor anterior) ---- */
var CE={cid:'',lid:null,mod:'',newMod:'',title:'',url:'',pub:true,body:'',act:'',pos:'',dur:'',q:'',o:['','',''],ok:0,more:false,cform:null,busy:false,msg:'',err:''};
function ytId(u){return window.FormaCourseUtils?FormaCourseUtils.youtubeId(u):null}
function lessonsOf(cid){return (D.lessons||[]).filter(function(l){return l.course_id===cid}).sort(function(a,b){return a.position-b.position})}
function modsOf(cid){var m=[];lessonsOf(cid).forEach(function(l){if(l.module_title&&m.indexOf(l.module_title)<0)m.push(l.module_title)});return m}
function ceReset(keepCourse){CE.lid=null;CE.mod='';CE.newMod='';CE.title='';CE.url='';CE.pub=true;CE.body='';CE.act='';CE.pos='';CE.dur='';CE.q='';CE.o=['','',''];CE.ok=0;CE.more=false;CE.msg='';CE.err='';if(!keepCourse)CE.cform=null}
function ceRead(){
  var g=function(id){var e=document.getElementById(id);return e?e.value:null},v;
  if((v=g('ce-mod'))!==null)CE.mod=v;if((v=g('ce-newmod'))!==null)CE.newMod=v;if((v=g('ce-title'))!==null)CE.title=v;if((v=g('ce-url'))!==null)CE.url=v;
  var p=document.getElementById('ce-pub');if(p)CE.pub=p.checked;
  if((v=g('ce-body'))!==null)CE.body=v;if((v=g('ce-act'))!==null)CE.act=v;if((v=g('ce-pos'))!==null)CE.pos=v;if((v=g('ce-dur'))!==null)CE.dur=v;if((v=g('ce-q'))!==null)CE.q=v;
  for(var i=0;i<3;i++)if((v=g('ce-o'+i))!==null)CE.o[i]=v;if((v=g('ce-ok'))!==null)CE.ok=Number(v);
  var cf=CE.cform;if(cf){if((v=g('cf-title'))!==null)cf.title=v;if((v=g('cf-acc'))!==null)cf.acc=v;var c2=document.getElementById('cf-pub');if(c2)cf.pub=c2.checked}
}
function ceCourseForm(){
  var f=CE.cform;
  return '<div class="card" style="margin-bottom:12px;background:var(--soft)"><h2>'+(f.id?'Editar curso':'Nuevo curso')+'</h2><div style="display:grid;gap:10px"><label>Nombre del curso<input id="cf-title" maxlength="120" value="'+esc(f.title)+'"></label><label>Quién lo ve<select id="cf-acc"><option value="free"'+(f.acc==='free'?' selected':'')+'>Gratis (para seguidores)</option><option value="subscription"'+(f.acc!=='free'?' selected':'')+'>Solo matriculados</option></select></label><label style="display:flex;gap:10px;align-items:center;grid-template-columns:none"><input type="checkbox" id="cf-pub" style="width:22px;min-height:22px"'+(f.pub?' checked':'')+'> Publicado (visible para los alumnos)</label>'+(CE.err&&CE.cform?'<div class="err">'+esc(CE.err)+'</div>':'')+'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p sm" data-ce="csave"'+(CE.busy?' disabled':'')+'>'+(CE.busy?'Guardando…':'Guardar curso')+'</button><button class="btn s sm" data-ce="ccancel">Cancelar</button></div></div></div>';
}
function ceVideoForm(c){
  var id=ytId(CE.url),mods=modsOf(c.id),isNew=!CE.lid,usingNew=CE.mod==='__new'||(!mods.length);
  var modSel='<select id="ce-mod" data-ce-change="mod">'+mods.map(function(m){return '<option value="'+esc(m)+'"'+(CE.mod===m?' selected':'')+'>'+esc(m)+'</option>'}).join('')+'<option value="__new"'+(usingNew?' selected':'')+'>+ Módulo nuevo…</option></select>';
  var thumb=id?'<div class="ce-th"><img src="https://i.ytimg.com/vi/'+id+'/mqdefault.jpg" alt="" width="120" height="68"><div><b>Video reconocido ✓</b><span>Si esta es la imagen de tu video, el enlace es correcto.</span></div></div>':(CE.url.trim()?'<div class="err" style="margin:0">Ese enlace no parece un video de YouTube. Copia la dirección completa (youtube.com/watch?v=… o youtu.be/…).</div>':'');
  return '<div class="card"><h2>'+(isNew?'Agregar video':'Editar video')+'</h2><p class="note" style="margin:-6px 0 10px">Curso: <b>'+esc(c.title)+'</b></p><div style="display:grid;gap:12px">'
   +'<label>1 · Módulo'+modSel+'</label>'+(usingNew?'<label>Nombre del módulo nuevo<input id="ce-newmod" maxlength="120" placeholder="Ej.: Primeros pasos" value="'+esc(CE.newMod)+'"></label>':'')
   +'<label>2 · Título del video<input id="ce-title" maxlength="160" placeholder="Ej.: Cómo armar tu presupuesto en 10 minutos" value="'+esc(CE.title)+'"></label>'
   +'<label>3 · Enlace de YouTube<input id="ce-url" type="url" maxlength="500" placeholder="https://www.youtube.com/watch?v=…" value="'+esc(CE.url)+'" data-ce-input="url"></label>'+thumb
   +'<label style="display:flex;gap:10px;align-items:center;grid-template-columns:none"><input type="checkbox" id="ce-pub" style="width:22px;min-height:22px"'+(CE.pub?' checked':'')+'> Visible para alumnos (el curso también debe estar publicado)</label>'
   +'<details'+(CE.more?' open':'')+' data-ce-more><summary style="cursor:pointer;font-weight:700;color:var(--brand2)">Opciones extra (explicación, actividad, pregunta de comprensión, orden)</summary><div style="display:grid;gap:12px;margin-top:10px">'
   +'<label>Explicación<textarea id="ce-body" maxlength="4000" rows="3">'+esc(CE.body)+'</textarea></label><label>Actividad práctica<textarea id="ce-act" maxlength="1000" rows="2">'+esc(CE.act)+'</textarea></label>'
   +'<label>Orden (número; menor sale primero)<input id="ce-pos" type="number" min="0" max="999999" value="'+esc(CE.pos)+'" placeholder="Automático: al final"></label>'
   +'<div class="note" style="margin:0">Para que el alumno avance clase por clase (ver el video y responder), completa esto. Si lo dejas vacío, se guarda solo el video.</div>'
   +'<label>Duración del video (minutos)<input id="ce-dur" type="number" min="1" max="240" step="1" value="'+esc(CE.dur)+'"></label><label>Pregunta breve de comprensión<input id="ce-q" maxlength="200" value="'+esc(CE.q)+'"></label>'
   +[0,1,2].map(function(i){return '<label>Respuesta '+(i+1)+'<input id="ce-o'+i+'" maxlength="200" value="'+esc(CE.o[i])+'"></label>'}).join('')
   +'<label>Respuesta correcta<select id="ce-ok">'+[0,1,2].map(function(i){return '<option value="'+i+'"'+(CE.ok===i?' selected':'')+'>Respuesta '+(i+1)+'</option>'}).join('')+'</select></label></div></details>'
   +(CE.err&&!CE.cform?'<div class="err" style="margin:0">'+esc(CE.err)+'</div>':'')+(CE.msg?'<div class="cu-ok" style="margin:0">'+esc(CE.msg)+'</div>':'')
   +'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-ce="vsave"'+(CE.busy?' disabled':'')+'>'+(CE.busy?'Guardando…':'Guardar video')+'</button>'+(isNew?'':'<button class="btn s" data-ce="vnew">Cancelar edición</button>')+'</div></div></div>';
}
V.cursos=function(){
  var cs=(D.courses||[]).slice().sort(function(a,b){return a.position-b.position});
  if(!CE.cid&&cs.length)CE.cid=cs[0].id;
  var cur=cs.filter(function(c){return c.id===CE.cid})[0];
  var left='<section class="card"><h2>Tus cursos</h2><div class="list">'+(cs.length?cs.map(function(c){var n=lessonsOf(c.id).length;return '<div class="row ce-c'+(c.id===CE.cid?' on':'')+'"><button class="ce-pick" data-ce="course" data-id="'+c.id+'" aria-pressed="'+(c.id===CE.cid)+'"><b>'+esc(c.title)+'</b><span>'+n+' video'+(n===1?'':'s')+' · '+(c.status==='published'?'Publicado':c.status==='archived'?'Archivado':'Borrador')+' · '+(c.access_level==='free'?'Gratis':'Solo matriculados')+'</span></button><button class="btn s sm" data-ce="cedit" data-id="'+c.id+'">Editar</button></div>'}).join(''):'<p class="note">Aún no hay cursos. Crea el primero.</p>')+'</div><div style="margin-top:12px"><button class="btn p sm" data-ce="cnew">+ Nuevo curso</button></div></section>';
  var right='';
  if(CE.cform)right+=ceCourseForm();
  if(cur){
    var ls=lessonsOf(cur.id),mods=modsOf(cur.id);
    right+='<section class="card" style="margin-bottom:12px"><h2>Videos de «'+esc(cur.title)+'»</h2>'+(ls.length?mods.map(function(m){return '<div class="cu-sec" style="margin:10px 0 4px">'+esc(m)+'</div><div class="list">'+ls.filter(function(l){return l.module_title===m}).map(function(l){return '<div class="row"><div class="t"><b>'+esc(l.title)+'</b><span>'+(l.youtube_id?'Con video':'Sin video aún')+' · '+(l.status==='published'?'Visible':l.status==='archived'?'Archivado':'Borrador')+'</span></div><button class="btn s sm" data-ce="vedit" data-id="'+l.id+'">Editar</button></div>'}).join('')+'</div>'}).join(''):'<p class="note">Este curso aún no tiene videos. Agrega el primero abajo.</p>')+'</section>'+ceVideoForm(cur);
  }else if(!CE.cform)right+='<section class="card"><p class="note">Crea un curso para empezar a agregar videos.</p></section>';
  return head('Cursos','Cursos y videos de YouTube.')+'<div class="ce-g"><div>'+left+'</div><div>'+right+'</div></div>'+(demo?'<p class="note">Vista de ejemplo: aquí no se guarda nada.</p>':'');
};
function ceErr(e){var m=(e&&(e.message||e.code))||'';if(/row-level|42501|permission/i.test(m))return 'Tu cuenta no tiene permiso de administrador de cursos.';return 'No se confirmó el guardado. Revisa tu conexión y vuelve a intentar; no se perdió nada.'}
function ceReload(){return Promise.all([table('forma_courses','id,title,access_level,status,position,summary','position').then(function(d){D.courses=d}),table('forma_course_lessons','id,course_id,module_title,title,youtube_id,status,position,body,action_text','position').then(function(d){D.lessons=d})])}
function ceUuid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
function ceSaveCourse(){
  ceRead();var f=CE.cform,t=(f.title||'').trim();CE.err='';
  if(!t||t.length>120){CE.err='Escribe el nombre del curso (máx. 120 letras).';render();return}
  if(demo){CE.err='Vista de ejemplo: no se guarda nada.';render();return}
  var row={title:t,access_level:f.acc==='free'?'free':'subscription',status:f.pub?'published':'draft'},q;
  if(f.id)q=client.from('forma_courses').update(row).eq('id',f.id).select('id').single();
  else{row.id=ceUuid();row.summary='';row.icon='📚';row.language='es';row.position=((D.courses||[]).reduce(function(m,c){return Math.max(m,Number(c.position)||0)},0))+1;q=client.from('forma_courses').insert(row).select('id').single()}
  CE.busy=true;render();
  q.then(function(r){if(r.error||!r.data)throw r.error||Error('save');CE.cid=r.data.id;CE.cform=null;CE.msg='';return ceReload()}).then(function(){CE.busy=false;toast('Curso guardado');render()},function(e){CE.busy=false;CE.err=ceErr(e);render()});
}
function ceSaveVideo(){
  ceRead();CE.err='';CE.msg='';
  var c=(D.courses||[]).filter(function(x){return x.id===CE.cid})[0];if(!c)return;
  var mods=modsOf(c.id),usingNew=CE.mod==='__new'||!mods.length,mod=(usingNew?CE.newMod:(CE.mod||mods[0])).trim(),title=CE.title.trim(),raw=CE.url.trim(),yid=raw?ytId(raw):null;
  var bad=function(t){CE.err=t;render()};
  if(!mod||mod.length>120)return bad('Elige o escribe el módulo.');
  if(!title||title.length>160)return bad('Escribe el título del video.');
  if(!raw)return bad('Pega el enlace de YouTube del video.');
  if(!yid)return bad('Ese enlace no parece un video de YouTube.');
  var pos=CE.pos===''?null:Number(CE.pos);if(pos!==null&&(!Number.isInteger(pos)||pos<0||pos>999999))return bad('El orden debe ser un número entero.');
  var q=CE.q.trim(),opts=CE.o.map(function(x){return x.trim()}),dur=Number(CE.dur),wantCheck=!!(q||opts.some(Boolean)||CE.dur!=='');
  if(wantCheck&&(!q||opts.some(function(o){return !o})||!(dur>=1&&dur<=240&&Number.isInteger(dur))))return bad('Para la pregunta de comprensión completa duración (minutos), pregunta y las 3 respuestas, o deja todo vacío.');
  if(demo)return bad('Vista de ejemplo: no se guarda nada.');
  var all=D.lessons||[],isNew=!CE.lid,id=isNew?ceUuid():CE.lid;
  var row={module_title:mod,title:title,youtube_id:yid,body:CE.body.trim(),action_text:CE.act.trim(),status:CE.pub?'published':'draft'};
  if(pos!==null)row.position=pos;else if(isNew)row.position=lessonsOf(c.id).reduce(function(m,l){return Math.max(m,Number(l.position)||0)},0)+1;
  var req;if(isNew){row.id=id;row.course_id=c.id;req=client.from('forma_course_lessons').insert(row).select('id').single()}else req=client.from('forma_course_lessons').update(row).eq('id',id).eq('course_id',c.id).select('id').single();
  CE.busy=true;render();
  req.then(function(r){if(r.error||!r.data||r.data.id!==id)throw r.error||Error('save');
    if(!wantCheck)return;
    return client.rpc('forma_learning_config',{p_lesson:id,p_duration:dur*60,p_question:q,p_options:opts,p_correct:CE.ok}).then(function(x){if(x.error)throw Object.assign(Error('check'),{check:true})})
  }).then(function(){return ceReload()}).then(function(){CE.busy=false;toast('Video guardado');ceReset(true);CE.msg='Video guardado. Ya puedes agregar otro.';render()},function(e){CE.busy=false;if(e&&e.check){CE.err='El video se guardó, pero no se pudo guardar la pregunta de comprensión (¿falta activar el SQL de aprendizaje?). Puedes dejarla vacía.';ceReload().then(render,render)}else{CE.err=ceErr(e);render()}});
}
function ceClick(b){
  var k=b.dataset.ce;ceRead();
  if(k==='course'){CE.cid=b.dataset.id;ceReset();render();return}
  if(k==='cnew'){ceReset(true);CE.cform={id:null,title:'',acc:'free',pub:false};CE.err='';render();return}
  if(k==='cedit'){var c=(D.courses||[]).filter(function(x){return x.id===b.dataset.id})[0];if(!c)return;CE.cid=c.id;ceReset(true);CE.cform={id:c.id,title:c.title,acc:c.access_level==='free'?'free':'subscription',pub:c.status==='published'};CE.err='';render();return}
  if(k==='ccancel'){CE.cform=null;CE.err='';render();return}
  if(k==='csave'){ceSaveCourse();return}
  if(k==='vsave'){ceSaveVideo();return}
  if(k==='vnew'){ceReset(true);render();return}
  if(k==='vedit'){var l=(D.lessons||[]).filter(function(x){return x.id===b.dataset.id})[0];if(!l)return;ceReset(true);CE.lid=l.id;CE.mod=l.module_title;CE.title=l.title;CE.url=l.youtube_id?'https://www.youtube.com/watch?v='+l.youtube_id:'';CE.pub=l.status==='published';CE.body=l.body||'';CE.act=l.action_text||'';CE.pos=String(l.position==null?'':l.position);CE.more=!!(l.body||l.action_text);render();var f=document.getElementById('ce-title');if(f)f.scrollIntoView({behavior:'smooth',block:'center'})}
}

/* ---- Cierres de caja (solo lectura): qué días se cerraron, diferencias de caja, y reenviar el resumen por WhatsApp o PDF ---- */
var AC={noSql:false,fail:[],month:'',days:null,period:null,closing:null,detail:null,err:'',loading:false,seq:0};
function acMonth(){if(!AC.month){var t=new Date();AC.month=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')}return AC.month}
function acLoad(){
  var n=++AC.seq,m=acMonth(),first=m+'-01',last=m+'-'+String(new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate()).padStart(2,'0');
  AC.loading=true;AC.err='';AC.days=null;AC.period=null;AC.closing=null;AC.detail=null;AC.noSql=false;AC.fail=[];
  var part=function(label,p,fallback){return p.then(function(x){return x},function(e){AC.fail.push(label+(e&&e.code?' ('+e.code+')':''));if(label==='cierres diarios'&&e&&(e.code==='PGRST202'||e.code==='42883'||/Could not find the function/i.test(e.message||'')))AC.noSql=true;return fallback})};
  Promise.all([
    part('cierres diarios',rpc('forma_day_close',{p_action:'list',p_data:{from:first,to:last}}),{items:[]}),
    part('movimientos del mes',rpc('forma_finance_reports',{p_action:'period',p_data:{from:first,to:last,bucket:'day'}}),null),
    part('cierre del mes',rpc('forma_finance_reports',{p_action:'closing_preview',p_data:{month:first}}),null)
  ]).then(function(r){
    if(n!==AC.seq)return;
    AC.days=r[0]||{items:[]};AC.period=r[1];AC.closing=r[2];AC.loading=false;
    if(!AC.period)AC.err='No se pudieron cargar los movimientos del mes.'+(AC.fail.length?' Falló: '+AC.fail.join(', ')+'.':'')+' Vuelve a intentar.';
    try{render()}catch(e){AC.err='No se pudo mostrar la pantalla: '+((e&&e.message)||'error');AC.period=null;try{render()}catch(x){}}
  });
  setTimeout(function(){if(n===AC.seq&&AC.loading){AC.loading=false;AC.err='La carga está tardando demasiado. Revisa tu conexión y vuelve a intentar.';render()}},20000);
}
function acShift(d){var y=Number(acMonth().slice(0,4)),m=Number(acMonth().slice(5,7))-1+d,x=new Date(y,m,1);AC.month=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');acLoad();render()}
V.cierres=function(){
  var L=window.FormaCierresLib,m=acMonth();
  if(!L)return head('Cierres')+'<p class="note">No se cargó el módulo de cierres. Actualiza la página.</p>';
  if(!AC.days&&!AC.loading&&!AC.err)acLoad();
  var nav='<div style="display:flex;gap:8px;align-items:center;margin:0 0 16px"><button class="btn s sm" data-acn="-1" aria-label="Mes anterior">‹</button><b style="min-width:180px;text-align:center">'+esc(L.monthLong(m).charAt(0).toUpperCase()+L.monthLong(m).slice(1))+'</b><button class="btn s sm" data-acn="1" aria-label="Mes siguiente">›</button></div>';
  if(AC.err)return head('Cierres de caja','')+nav+'<div class="err" role="alert">'+esc(AC.err)+'</div><button class="btn s" data-acr="1">Reintentar</button>';
  if(AC.loading||!AC.days||!AC.period)return head('Cierres de caja','')+nav+'<p class="note">Cargando…</p>';
  var warn=AC.noSql?'<div class="err" role="alert">Falta activar el cierre diario en Supabase: ejecuta forma-cierre-diario.sql (una sola vez). Mientras tanto se muestran los movimientos, sin estado de cierre.</div>':'';
  var closed={};(AC.days.items||[]).forEach(function(i){closed[i.day]=i});
  var tl=(AC.period.timeline||[]).filter(function(t){return Number(t.incoming)>0||Number(t.outgoing)>0});
  var open=tl.filter(function(t){return !closed[t.day]&&t.day<=new Date().toISOString().slice(0,10)});
  var rows=tl.slice().sort(function(a,b){return a.day<b.day?1:-1}).map(function(t){
    var c=closed[t.day],diff=c&&c.cash_counted_cents!=null?Number(c.cash_counted_cents)-Number(c.cash_expected_cents):null;
    return '<tr><td><b>'+esc(L.dayShort(t.day))+'</b></td><td class="r">'+R0(Number(t.incoming||0))+'</td><td class="r">'+R0(Number(t.outgoing||0))+'</td><td>'+(c?'<span class="pill up">Cerrado '+esc(L.hhmm(c.created_at))+(c.revision>1?' · corr. '+c.revision:'')+'</span>':'<span class="pill" style="background:var(--warnbg);color:var(--warn)">Sin cerrar</span>')+'</td><td>'+(diff==null?'—':diff===0?'Cuadra ✓':'<b style="color:var(--bad)">'+(diff>0?'+':'−')+' '+R0(Math.abs(diff))+'</b>')+'</td><td>'+(c?'<button class="btn s sm" data-acd="'+esc(t.day)+'">Ver / reenviar</button>':'')+'</td></tr>'}).join('');
  var cl=AC.closing,mrev=cl&&Number(cl.latest_revision)||0;
  var mes='<section class="card c12"><h2>Cierre del mes</h2><p style="margin:0 0 8px">'+(mrev?'<span class="pill up">Mes cerrado · revisión '+mrev+'</span>':'<span class="pill" style="background:var(--warnbg);color:var(--warn)">Mes sin cerrar</span>')+' · Días cerrados: <b>'+Object.keys(closed).length+'</b> de <b>'+tl.length+'</b> con movimientos</p>'+(mrev?'<button class="btn s sm" data-acm="1">Ver / reenviar resumen del mes</button>':'<p class="note" style="margin:0">René cierra el mes desde Cobros › Cierre.</p>')+'</section>';
  var body=head('Cierres de caja','Qué días se cerraron y qué se informó.')+nav+warn+'<div class="grid">'+kpi('Días con movimiento',String(tl.length),'','','flat')+kpi('Cerrados',String(Object.keys(closed).length),'in','','flat')+kpi('Sin cerrar',String(open.length),open.length?'out':'','Faltan por cerrar','flat')+kpi('Entró en el mes',R0(Number(AC.period.received_cents||0)),'in','','flat')+mes
   +'<section class="card c12"><h2>Días del mes</h2><div class="tw"><table><thead><tr><th>Día</th><th class="r">Entró</th><th class="r">Salió</th><th>Estado</th><th>Caja en efectivo</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="note">Sin movimientos este mes.</td></tr>')+'</tbody></table></div></section></div>'
   +'<div id="ac-det">'+(AC.detail?acDetail():'')+'</div>';
  return body;
};
function acDetail(){
  var L=window.FormaCierresLib,d=AC.detail,t=L.text(d.kind,d.o);
  return '<section class="card" style="margin-top:12px"><h2>'+esc(d.kind==='day'?'Cierre del '+L.dayShort(d.o.day):'Cierre de '+L.monthLong(d.o.month))+'</h2><pre class="ci-pre">'+esc(t)+'</pre><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-acs="wa">Enviar por WhatsApp</button><button class="btn s" data-acs="pdf">Descargar PDF</button><button class="btn s" data-acs="copy">Copiar texto</button></div></section>';
}
function acOpenDay(day){
  rpc('forma_day_close',{p_action:'preview',p_data:{day:day}}).then(function(d){var c=d.closings&&d.closings[0];if(!c){toast('Ese día no tiene cierre.');return}
    AC.detail={kind:'day',o:{day:day,snap:c.snapshot,cashExp:c.cash_expected_cents,cashCnt:c.cash_counted_cents,note:c.note,rev:c.revision,at:c.created_at}};render();var e=$('#ac-det');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},function(){toast('No se pudo abrir el cierre.')});
}
function acOpenMonth(){
  var cl=AC.closing;if(!cl)return;
  rpc('forma_finance_reports',{p_action:'closing_get',p_data:{month:acMonth()+'-01',revision:cl.latest_revision}}).then(function(d){
    var items=(AC.days&&AC.days.items)||[],tl=((AC.period&&AC.period.timeline)||[]).filter(function(t){return Number(t.incoming)>0||Number(t.outgoing)>0}),diff=0;items.forEach(function(i){if(i.cash_counted_cents!=null)diff+=Number(i.cash_counted_cents)-Number(i.cash_expected_cents)});
    AC.detail={kind:'month',o:{month:acMonth(),snap:d.snapshot,daysClosed:items.length,daysWith:Math.max(tl.length,items.length),cashDiff:diff,note:d.reason,rev:d.revision,at:d.created_at}};render();var e=$('#ac-det');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},function(){toast('No se pudo abrir el cierre del mes.')});
}
function acClick(e){
  var L=window.FormaCierresLib;
  var rr=e.target.closest('[data-acr]');if(rr){acLoad();render();return true}
  var n=e.target.closest('[data-acn]');if(n){acShift(Number(n.dataset.acn));return true}
  var d=e.target.closest('[data-acd]');if(d){acOpenDay(d.dataset.acd);return true}
  var m=e.target.closest('[data-acm]');if(m){acOpenMonth();return true}
  var s=e.target.closest('[data-acs]');if(s&&AC.detail&&L){var t=L.text(AC.detail.kind,AC.detail.o),k=s.dataset.acs;
    if(k==='wa')window.open(L.waUrl(t),'_blank','noopener');else if(k==='copy')L.copy(t).then(function(ok){toast(ok?'Texto copiado':'No se pudo copiar')});else L.sharePdf(L.pdf(AC.detail.kind,AC.detail.o),'cierre-'+(AC.detail.kind==='day'?AC.detail.o.day:AC.detail.o.month)+'.pdf');return true}
  return false;
}
V.ajustes=function(){
  return head('Ajustes')+'<div class="grid"><section class="card c6"><h2>WhatsApp de ayuda</h2><p style="margin:0 0 6px"><b class="num">'+(D.phone?'+'+esc(D.phone):'Sin configurar')+'</b></p><p class="note">Es el número que abre el botón «Me interesa» y la ayuda. Para cambiarlo, abre «Validar accesos y editar cursos» aquí abajo.</p></section>'
   +'<section class="card c6"><h2>Otras pantallas</h2><div class="list"><div class="row"><div class="t"><b>Validar accesos y editar cursos</b><span>Herramientas de administración dentro de la app</span></div><button class="btn s sm" data-aact="clasica">Abrir</button></div><div class="row"><div class="t"><b>Gestión (René)</b><span>Agenda, cobros, alumnos, interesados</span></div><button class="btn s sm" data-aact="gestion">Abrir</button></div><div class="row"><div class="t"><b>Mi presupuesto y cursos</b><span>Vista del alumno</span></div><button class="btn s sm" data-aact="presupuesto">Abrir</button></div></div></section></div>';
};
function render(){
  var banner=demo&&!EMBED?'<div class="demo">Vista de ejemplo · datos ficticios.</div>':'';
  if(errors.length)banner+='<div class="err">No se pudo cargar: '+esc(errors.filter(function(x,i,a){return a.indexOf(x)===i}).join(', '))+'. Puede estar incompleto; no se cambió nada.</div>';
  var keep=document.activeElement&&document.activeElement.id==='apq';
  var tgt=EMBED?$('#adm-body'):$('#app');if(!tgt)return;
  tgt.innerHTML=banner+V[view]();
  document.querySelectorAll('[data-v],[data-av]').forEach(function(b){var k=b.dataset.v||b.dataset.av;b.toggleAttribute('aria-current',k===view);if(k===view)b.setAttribute('aria-current','page')});
  if(EMBED)document.querySelectorAll('[data-av]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.av===view))});
  if(keep){var el=$('#apq');el.focus();el.setSelectionRange(el.value.length,el.value.length)}
}
function go(v){if(!V[v])v='resumen';view=v;if(EMBED){try{localStorage.setItem('forma-adm-view',v)}catch(e){}}if(!EMBED){try{history.replaceState(null,'','#'+v)}catch(e){}}render();if(!EMBED)window.scrollTo(0,0)}
function nav(){
  $('#tabs').innerHTML=NAV.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+n[1]+'</button>'}).join('');
  $('#bnav').style.gridTemplateColumns='repeat('+NAV.length+',1fr)';
  $('#bnav').innerHTML=NAV.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+'<span>'+n[1]+'</span></button>'}).join('');
  $('#bnav').hidden=false;
}
function act(k){
  if(k==='theme'){var r=document.documentElement,nt=r.getAttribute('data-theme')==='dark'?'light':'dark';r.setAttribute('data-theme',nt);try{localStorage.setItem('forma-gestion-theme',nt)}catch(e){}return}
  if(k==='out'){if(demo){toast('Vista de ejemplo: no hay sesión real.');return}client.auth.signOut().then(function(){location.href='/'},function(){toast('No se confirmó el cierre de sesión.')});return}
  if(k==='presupuesto'){location.href='/?personal=1';return}
  if(k==='gestion'){if(EMBED&&window.FormaAdmin&&window.FormaAdmin.onHome){window.FormaAdmin.onHome();return}location.href='/agenda.html';return}
  if(k==='clasica'){location.href='/?alumno=1&abrir=accesos';return}
  if(k==='editcursos'){go('cursos');return}
}
function onClick(e){
  if(EMBED&&!e.target.closest('#adm-root'))return;
  if(acClick(e))return;
  var ce=e.target.closest('[data-ce]');if(ce){ceClick(ce);return}
  var b=e.target.closest('[data-v],[data-av]');if(b){go(b.dataset.v||b.dataset.av);return}
  var a=e.target.closest('[data-aact]');if(a){if(a.tagName==='A')e.preventDefault();act(a.dataset.aact);return}
  var d=e.target.closest('[data-days]');if(d){D.days=Number(d.dataset.days);D.report=null;render();safe('uso',rpc('forma_admin_report',{p_days:D.days}).then(function(x){D.report=x})).then(render);return}
  if(!EMBED&&!e.target.closest('#menu')&&!e.target.closest('#bUser'))$('#menu').hidden=true;
}
function onInput(e){if(e.target.id==='apq'){D.q=e.target.value.trim();clearTimeout(document.pqT);document.pqT=setTimeout(render,250)}}
document.addEventListener('click',onClick);document.addEventListener('input',onInput);
document.addEventListener('change',function(e){if(EMBED&&!e.target.closest('#adm-root'))return;if(e.target.dataset&&e.target.dataset.ceChange==='mod'&&view==='cursos'){ceRead();render()}});
document.addEventListener('focusout',function(e){if(e.target.dataset&&e.target.dataset.ceInput==='url'&&view==='cursos'&&(!EMBED||e.target.closest('#adm-root'))){ceRead();render()}});
if(!EMBED){
  $('#bUser').onclick=function(){var m=$('#menu');m.hidden=!m.hidden;this.setAttribute('aria-expanded',String(!m.hidden))};
  window.addEventListener('hashchange',function(){var h=location.hash.slice(1);if(V[h]&&h!==view)go(h)});
  try{var th=localStorage.getItem('forma-gestion-theme');if(th)document.documentElement.setAttribute('data-theme',th)}catch(e){}
}
function gate(msg,login){
  $('#app').innerHTML='<section class="gate card"><h1>FORMÁ Administración</h1><p>'+esc(msg)+'</p>'+(login?'<a class="btn p" href="/">Entrar con mi cuenta de FORMÁ</a>':'')+'</section>';
  $('#tabs').innerHTML='';$('#bnav').hidden=true;
}
function start(){nav();var h=location.hash.slice(1);view=V[h]?h:'resumen';render();load().then(render)}
function boot(){
  if(demo)return start();
  var cfg=window.FORMA_CONFIG;
  if(!cfg||cfg.supabaseUrl!=='https://irsuevjqmgpwunvymxbc.supabase.co'||!cfg.publishableKey){gate('La configuración de FORMÁ no está disponible.');return}
  client=supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,flowType:'pkce',storageKey:'forma-independent-auth-v1'}});
  client.auth.getUser().then(function(r){
    if(r.error||!r.data||!r.data.user){gate('Inicia sesión con tu cuenta de FORMÁ.',true);return}
    var uid=r.data.user.id;
    client.auth.onAuthStateChange(function(ev,s){if(ev==='SIGNED_OUT'||(s&&s.user&&s.user.id!==uid))gate('La sesión cambió. Vuelve a entrar.',true)});
    return rpc('forma_agenda_access').then(function(a){
      if(!a||a.role!=='owner'){gate('Esta pantalla es solo para el propietario de FORMA.');return}
      start();
    },function(){gate('No se pudo verificar tu acceso. Vuelve a cargar la página.')});
  },function(){gate('No se pudo verificar tu sesión. Vuelve a cargar la página.')});
}
/* datos de ejemplo */
function demoTable(n){
  if(n==='forma_courses')return[{id:'c1',title:'Tu primer presupuesto',access_level:'free',status:'published',position:1},{id:'c2',title:'Salir de deudas',access_level:'free',status:'published',position:2},{id:'c3',title:'Invertir sin miedo',access_level:'free',status:'draft',position:3},{id:'c4',title:'Método FORMA',access_level:'subscriber',status:'published',position:4}];
  return[{id:'l1',course_id:'c1',module_title:'Primeros pasos',title:'Cómo armar tu presupuesto en 10 minutos',youtube_id:'dQw4w9WgXcQ',status:'published',position:1},{id:'l2',course_id:'c1',module_title:'Primeros pasos',title:'Registrar tus gastos cada día',youtube_id:'dQw4w9WgXcQ',status:'published',position:2},{id:'l5',course_id:'c1',module_title:'Mantener el hábito',title:'Revisar tu mes',youtube_id:null,status:'draft',position:3},{id:'l3',course_id:'c2',module_title:'Primeros pasos',title:'Ordena tus deudas',youtube_id:'dQw4w9WgXcQ',status:'published',position:1},{id:'l4',course_id:'c4',module_title:'Introducción',title:'Bienvenida al método',youtube_id:'dQw4w9WgXcQ',status:'published',position:1}];
}
function demoRpc(name,a){
  if(name==='forma_agenda_access')return{role:'owner'};
  if(name==='forma_day_close'){var td=new Date().toISOString().slice(0,10);if(a.p_action==='list')return{items:[{day:td,revision:1,created_at:new Date().toISOString(),received_cents:128000,outflow_cents:30000,cash_expected_cents:35000,cash_counted_cents:35000,note:''}]};return{day:a.p_data.day,latest_revision:1,cash_expected_cents:35000,closings:[{revision:1,created_at:new Date().toISOString(),note:'',cash_expected_cents:35000,cash_counted_cents:35000,snapshot:{received_cents:128000,payment_count:3,outflow_cents:30000,refund_cents:0,by_method:[{label:'pix',cents:80000},{label:'efectivo',cents:48000}],by_activity:[{label:'Bolsa de Valores',cents:80000},{label:'Computación Informática',cents:48000}],by_outflow_category:[{label:'Alquiler',cents:30000}]}}]}}
  if(name==='forma_finance_reports'&&a.p_action==='period')return{received_cents:128000,outflow_cents:30000,timeline:[{day:new Date().toISOString().slice(0,10),incoming:128000,outgoing:30000}]};
  if(name==='forma_finance_reports'&&a.p_action==='closing_preview')return{can_close:false,latest_revision:0,history:[]};
  if(name==='forma_admin_report')return{total:42,activated:31,verified_entries:27,historical_only:9,active:18,budget:25,movements:22,goals:12,learning:8,sections:[{section:'resumo',users:17},{section:'registrar',users:11},{section:'aprender',users:9},{section:'metas',users:5}],daily:[],users:[{name:'Ana Pérez',first_entry:'2026-10-06',last_seen:'2026-10-25',budget:true,movements:true,goals:true,learning:true},{name:'Luis Gómez',first_entry:'2026-10-08',last_seen:'2026-10-24',budget:true,movements:true,goals:false,learning:false},{name:'Marta Díaz',first_entry:'2026-10-20',last_seen:'2026-10-21',budget:true,movements:false,goals:false,learning:true}]};
  if(name==='forma_admin_access_review')return{active:36,pending_count:2,staff:2,pending:[{id:'a1b2c3d4',name:'Rita Campos',email:'rita@ejemplo.com',requested_at:'2026-10-24T10:00:00Z'},{id:'e5f6a7b8',name:'Pablo Vera',email:'pablo@ejemplo.com',requested_at:'2026-10-25T16:00:00Z'}]};
  if(name==='forma_finance_reports')return a.p_action==='pending'?{total_cents:880289,total_count:4,items:[]}:{received_cents:1245000,timeline:[]};
  if(name==='forma_crm')return{counts:{nuevo:9,conversacion:6,seguimiento:4,preparar_matricula:2,matriculado:3},items:[]};
  if(name==='forma_education')return{count:12,items:[]};
  return null;
}
var loaded=false,LAB={resumen:'Resumen',personas:'Personas',cursos:'Cursos online',cierres:'Cierres de caja',ajustes:'Ajustes'};
if(EMBED){try{var svw=localStorage.getItem('forma-adm-view');if(V[svw])view=svw}catch(e){}}
if(EMBED){
  /* Dentro de Gestión: Gestión da el cliente de sesión y pinta este bloque; aquí no hay cabecera ni menú propios. */
  window.FormaAdmin={
    init:function(c){client=c.client},
    html:function(){return '<div id="adm-root"><div class="seg" role="group" aria-label="Administración" style="margin-bottom:16px">'+NAV.map(function(n){return '<button data-av="'+n[0]+'" aria-pressed="'+(view===n[0])+'">'+LAB[n[0]]+'</button>'}).join('')+'</div><div id="adm-body"></div></div>'},
    mount:function(){if(!demo&&!client)return;render();if(!loaded){loaded=true;load().then(render)}},
    reset:function(){loaded=false}
  };
}else boot();
})();
