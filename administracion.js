/* FORMÁ Administración (solo lectura, solo propietario): Resumen · Personas · Cursos online · Ajustes.
   Modo incrustado: si el script lleva data-embed, vive dentro de Gestión (una sola app) y no toca la cabecera ni la navegación de la página.
   Lee los mismos datos reales por las mismas funciones del servidor. No escribe nada. */
(function(){'use strict';
var $=function(s){return document.querySelector(s)};
var demo=new URLSearchParams(location.search).get('vista')==='ejemplo';
var CS=document.currentScript,EMBED=!!(CS&&CS.hasAttribute('data-embed'));
var client=null,view='resumen',errors=[];
var D={report:null,access:null,pending:null,period:null,crm:null,edu:null,courses:null,lessons:null,phone:null,days:30,q:''};
var IC={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 0 0 0-6M21 20c0-2.5-1.5-4.6-4-5.5"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'};
var NAV=[['resumen','Resumen','home'],['personas','Personas','users'],['cursos','Cursos','cap'],['ajustes','Ajustes','gear']];
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
    safe('cursos',table('forma_courses','id,title,access_level,status,position','position').then(function(d){D.courses=d})),
    safe('lecciones',table('forma_course_lessons','id,course_id,status','position').then(function(d){D.lessons=d})),
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
V.cursos=function(){
  var cs=D.courses||[],ls=D.lessons||[];
  function box(title,list,hint){return '<section class="card c6"><h2>'+title+' <span class="pill" style="background:var(--soft);color:var(--brand2)">'+list.length+'</span></h2>'+(list.length?'<div class="list">'+list.map(function(c){var n=ls.filter(function(l){return l.course_id===c.id}).length;return '<div class="row"><div class="t"><b>'+esc(c.title)+'</b><span>'+n+' lección'+(n===1?'':'es')+' · '+(c.status==='published'?'Publicado':'Borrador')+'</span></div></div>'}).join('')+'</div>':'<p class="note">'+hint+'</p>')+'</section>'}
  var free=cs.filter(function(c){return c.access_level==='free'}),sub=cs.filter(function(c){return c.access_level!=='free'});
  return head('Cursos','Gratis para seguidores y solo para matriculados.')+'<div class="grid">'+box('Gratis (para seguidores)',free,'Aún no hay cursos gratis.')+box('Solo matriculados',sub,'Aún no hay cursos de suscripción.')+'</div><p class="note">Para crear o editar cursos y lecciones (duración, pregunta), <a class="link" href="/?alumno=1&abrir=cursos" data-aact="editcursos">abre el editor de cursos</a> (ahí vinculas los videos de YouTube). Cada lección necesita duración y pregunta para guardar el progreso.</p>';
};
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
function go(v){if(!V[v])v='resumen';view=v;if(!EMBED){try{history.replaceState(null,'','#'+v)}catch(e){}}render();if(!EMBED)window.scrollTo(0,0)}
function nav(){
  $('#tabs').innerHTML=NAV.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+n[1]+'</button>'}).join('');
  $('#bnav').style.gridTemplateColumns='repeat(4,1fr)';
  $('#bnav').innerHTML=NAV.map(function(n){return '<button data-v="'+n[0]+'">'+ico(n[2])+'<span>'+n[1]+'</span></button>'}).join('');
  $('#bnav').hidden=false;
}
function act(k){
  if(k==='theme'){var r=document.documentElement,nt=r.getAttribute('data-theme')==='dark'?'light':'dark';r.setAttribute('data-theme',nt);try{localStorage.setItem('forma-gestion-theme',nt)}catch(e){}return}
  if(k==='out'){if(demo){toast('Vista de ejemplo: no hay sesión real.');return}client.auth.signOut().then(function(){location.href='/'},function(){toast('No se confirmó el cierre de sesión.')});return}
  if(k==='presupuesto'){location.href='/?personal=1';return}
  if(k==='gestion'){if(EMBED&&window.FormaAdmin&&window.FormaAdmin.onHome){window.FormaAdmin.onHome();return}location.href='/agenda.html';return}
  if(k==='clasica'){location.href='/?alumno=1&abrir=accesos';return}
  if(k==='editcursos'){location.href='/?alumno=1&abrir=cursos';return}
}
function onClick(e){
  if(EMBED&&!e.target.closest('#adm-root'))return;
  var b=e.target.closest('[data-v],[data-av]');if(b){go(b.dataset.v||b.dataset.av);return}
  var a=e.target.closest('[data-aact]');if(a){if(a.tagName==='A')e.preventDefault();act(a.dataset.aact);return}
  var d=e.target.closest('[data-days]');if(d){D.days=Number(d.dataset.days);D.report=null;render();safe('uso',rpc('forma_admin_report',{p_days:D.days}).then(function(x){D.report=x})).then(render);return}
  if(!EMBED&&!e.target.closest('#menu')&&!e.target.closest('#bUser'))$('#menu').hidden=true;
}
function onInput(e){if(e.target.id==='apq'){D.q=e.target.value.trim();clearTimeout(document.pqT);document.pqT=setTimeout(render,250)}}
document.addEventListener('click',onClick);document.addEventListener('input',onInput);
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
  return[{id:'l1',course_id:'c1',status:'published'},{id:'l2',course_id:'c1',status:'published'},{id:'l3',course_id:'c2',status:'published'},{id:'l4',course_id:'c4',status:'published'}];
}
function demoRpc(name,a){
  if(name==='forma_agenda_access')return{role:'owner'};
  if(name==='forma_admin_report')return{total:42,activated:31,verified_entries:27,historical_only:9,active:18,budget:25,movements:22,goals:12,learning:8,sections:[{section:'resumo',users:17},{section:'registrar',users:11},{section:'aprender',users:9},{section:'metas',users:5}],daily:[],users:[{name:'Ana Pérez',first_entry:'2026-10-06',last_seen:'2026-10-25',budget:true,movements:true,goals:true,learning:true},{name:'Luis Gómez',first_entry:'2026-10-08',last_seen:'2026-10-24',budget:true,movements:true,goals:false,learning:false},{name:'Marta Díaz',first_entry:'2026-10-20',last_seen:'2026-10-21',budget:true,movements:false,goals:false,learning:true}]};
  if(name==='forma_admin_access_review')return{active:36,pending_count:2,staff:2,pending:[{id:'a1b2c3d4',name:'Rita Campos',email:'rita@ejemplo.com',requested_at:'2026-10-24T10:00:00Z'},{id:'e5f6a7b8',name:'Pablo Vera',email:'pablo@ejemplo.com',requested_at:'2026-10-25T16:00:00Z'}]};
  if(name==='forma_finance_reports')return a.p_action==='pending'?{total_cents:880289,total_count:4,items:[]}:{received_cents:1245000,timeline:[]};
  if(name==='forma_crm')return{counts:{nuevo:9,conversacion:6,seguimiento:4,preparar_matricula:2,matriculado:3},items:[]};
  if(name==='forma_education')return{count:12,items:[]};
  return null;
}
var loaded=false,LAB={resumen:'Resumen',personas:'Personas',cursos:'Cursos online',ajustes:'Ajustes'};
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
