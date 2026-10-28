/* Área del alumno · estructura nueva. Solo navegación y presentación: usa los paneles, datos y botones que ya existen.
   - PC: una barra con todo visible. Celular: 4 accesos + Más.
   - "Mi camino": siguiente paso (clase o presupuesto), estaciones de cursos gratis y, si hay matrícula, su curso y su próxima cuota. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=d=>'<svg class="av-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',mes:'<path d="M4 20V10m8 10V4m8 16v-7"/>',plus:'<path d="M12 5v14M5 12h14"/>',goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',book:'<path d="M4 5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-6"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 13h2"/>',calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>'};
/* clave, texto, icono, panel que se activa */
const ITEMS=[['camino','Inicio','home'],['mes','Presupuesto','mes'],['registrar','Anotar','list'],['calc','Calcular','calc'],['aprender','Aprender','book'],['cursos','Mis cursos','cap'],['banco','Cuentas','wallet']];
const MOBILE=['camino','mes','registrar','aprender'];
const PANEL={camino:'camino',mes:'resumo',registrar:'registrar',metas:'metas',calc:'calculadoras',historico:'historico',aprender:'aprender',cursos:'institution',banco:'banco'};
function open(k){
  if(k==='camino'){goPanel('camino');return;}
  if(k==='mes'){goPanel('resumo');return;}
  if(k==='cursos'){const e=$('student-entry');if(e)e.click();else goPanel('institution');return;}
  if(k==='anio'){goPanel('anual');return;}
  const nb=$('nb-'+k);if(nb)nb.click();else goPanel(PANEL[k]||k);
}
function build(){
  const app=$('app-screen');if(!app||$('av-nav'))return;
  const nav=document.createElement('nav');nav.id='av-nav';nav.setAttribute('aria-label','Menú principal');
  nav.innerHTML='<span class="av-brand"><img src="/forma-sello-blanco.svg?v=marca2-20261024" alt="" width="30" height="30">FORMÁ</span><div class="av-items">'+ITEMS.map(([k,t,i])=>'<button type="button" data-k="'+k+'" class="'+(MOBILE.includes(k)?'':'av-pc')+'">'+ico(I[i])+'<span>'+t+'</span></button>').join('')+'<button type="button" data-k="mas" class="av-mob">'+ico(I.more)+'<span>Más</span></button></div><div class="av-tools"><button type="button" id="av-bell" aria-label="Avisos de mis cursos">'+ico(I.bell)+'<b id="av-dot" hidden></b></button><button type="button" id="av-user" aria-label="Mi cuenta" aria-expanded="false">'+ico(I.user)+'</button></div><div id="av-menu" hidden></div><div id="av-sheet" hidden><div id="av-sheet-in"></div></div>';
  app.prepend(nav);
  const h=document.createElement('h1');h.id='av-title';h.hidden=true;nav.after(h);
  nav.addEventListener('click',e=>{
    const b=e.target.closest('button[data-k]');if(b){closeAll();if(b.dataset.k==='mas'){sheet();return;}open(b.dataset.k);return;}
    if(e.target.closest('#av-bell')){closeAll();open('cursos');return;}
    if(e.target.closest('#av-user')){const m=$('av-menu');const show=m.hidden;closeAll();if(show){fillMenu();m.hidden=false;$('av-user').setAttribute('aria-expanded','true');}return;}
    const a=e.target.closest('[data-do]');if(a){closeAll();act(a.dataset.do);return;}
    if(e.target.id==='av-sheet')closeAll();
  });
  document.addEventListener('click',e=>{if(!e.target.closest('#av-menu')&&!e.target.closest('#av-user'))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
  sync();
}
function closeMenu(){const m=$('av-menu');if(m&&!m.hidden){m.hidden=true;$('av-user')?.setAttribute('aria-expanded','false');}}
function closeAll(){closeMenu();const s=$('av-sheet');if(s&&!s.hidden)s.hidden=true;}
function visible(sel){const e=document.querySelector(sel);return !!e&&!e.hidden&&e.style.display!=='none';}
function extra(){
  const out=[['anio','Mi año','cal']];
  if(visible('#nb-alunos'))out.push(['alumnos','Mis alumnos','cap']);
  if(visible('#forma-admin-button'))out.push(['admin','Administración','mes']);
  const g=document.querySelector('.forma-tools a[href="/agenda.html"]');if(g&&!g.hidden)out.push(['gestion','Gestión','cal']);
  out.push(['ayuda','Ayuda','chat'],['instalar','Instalar la app','plus'],['salir','Cerrar sesión','user']);
  return out;
}
function fillMenu(){$('av-menu').innerHTML=extra().map(([k,t])=>'<button type="button" data-do="'+k+'"'+(k==='salir'?' class="av-out"':'')+'>'+esc(t)+'</button>').join('');}
function sheet(){
  const rest=ITEMS.filter(([k])=>!MOBILE.includes(k)).map(([k,t,i])=>['open:'+k,t,i]);
  const ex=extra().map(([k,t,i])=>['do:'+k,t,i||'more']);
  $('av-sheet-in').innerHTML=rest.concat(ex).map(([k,t,i])=>'<button type="button" '+(k.startsWith('open:')?'data-k="'+k.slice(5)+'"':'data-do="'+k.slice(3)+'"')+(k==='do:salir'?' class="av-out"':'')+'>'+esc(t)+'</button>').join('');
  $('av-sheet').hidden=false;
}
function act(k){
  if(k==='anio'){goPanel('anual');return;}
  if(k==='alumnos'){$('nb-alunos')?.click();return;}
  if(k==='admin'){location.href='/administracion.html';return;}
  if(k==='gestion'){location.href='/agenda.html';return;}
  if(k==='ayuda'){$('forma-help-button')?.click();return;}
  if(k==='instalar'){const b=document.querySelector('.forma-install-button');if(b)b.click();return;}
  if(k==='salir'){document.querySelector('.tb-logout')?.click();}
}
const TITLES={registrar:'Anotar',historico:'Anotar',metas:'Anotar',aprender:'Aprender',anual:'Mi año',banco:'Mis cuentas',institution:'Mis cursos',alunos:'Mis alumnos'};
function sync(){
  const n=$('av-nav');const a=document.querySelector('#app-screen .panel.active');if(!n||!a)return;
  const id=a.id.replace(/^p-/,'');const ti=$('av-title');if(ti){const t=TITLES[id]||'';if(ti.textContent!==t)ti.textContent=t;if(ti.hidden===!!t)ti.hidden=!t;}
  const key=({historico:'registrar',metas:'registrar'})[id]||Object.keys(PANEL).find(k=>PANEL[k]===id)||'';
  n.querySelectorAll('.av-items button').forEach(b=>{const on=b.dataset.k===key||(b.dataset.k==='mas'&&!key||b.dataset.k==='mas'&&!MOBILE.includes(key)&&!!key);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  const c=$('student-entry-count'),d=$('av-dot');if(d){const t=(c?.textContent||'').replace(/\D/g,'');const show=!!t&&t!=='0';if(d.hidden===show){d.hidden=!show;}if(show&&d.textContent!==t)d.textContent=t;}
}
/* ---------- Mi camino ---------- */
function panel(){
  if($('p-camino'))return;
  const p=document.createElement('section');p.id='p-camino';p.className='panel';
  p.innerHTML='<div id="cm-body"></div>';
  $('app-screen').insertBefore(p,$('bnav'));
}
const L=()=>window.FormaLearningView||{};
const S=()=>window.FormaStudentView||{};
function txt(id){return(($(id)||{}).textContent||'').trim();}
function firstName(){const g=txt('tb-greeting').replace(/!$/,'').replace(/^hola,?\s*/i,'');return g&&g!=='FORMA'?g:'';}
function dl(iso){if(!iso)return '';const p=String(iso).slice(0,10).split('-');return p[2]+'/'+p[1];}
function money(c){return 'R$ '+(Number(c)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function hh(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}

/* ---------- Inicio y Presupuesto: vista tipo banco ---------- */
const BV=()=>window.FormaBudgetView||null;
const pc=(s,p)=>p>0?Math.round(s/p*100):0;
const tone=p=>p>100?'r':p>=80?'y':'g';
function bankParts(compact){
  const v=BV();
  if(!v)return {hero:'<section class="bk-hero"><div class="bk-l"><small>Tu mes</small><b class="bk-big">…</b></div></section>',acts:'',groups:'',mv:''};
  const f=v.fmt,hasPlan=v.plannedExpense>0,left=v.plannedExpense-v.exp,p=pc(v.exp,v.plannedExpense);
  let hero;
  if(hasPlan){
    hero='<section class="bk-hero '+(left<0?'neg':'')+'"><div class="bk-l"><small>'+(left<0?'Te pasaste de tu plan':'Te quedan este mes')+'</small><b class="bk-big">'+f(Math.abs(left))+'</b><span>de '+f(v.plannedExpense)+' previstos · usaste el '+p+' %</span></div><dl class="bk-r"><div><dt>Entradas</dt><dd>'+f(v.inc)+'</dd></div><div><dt>Gastos</dt><dd>'+f(v.exp)+'</dd></div><div><dt>Resultado</dt><dd>'+f(v.bal)+'</dd></div></dl><div class="bk-bar"><i class="'+tone(p)+'" style="width:'+Math.min(p,100)+'%"></i></div></section>';
  }else{
    hero='<section class="bk-hero"><div class="bk-l"><small>Resultado de tu mes</small><b class="bk-big">'+f(v.bal)+'</b><span>Entradas '+f(v.inc)+' · Gastos '+f(v.exp)+'</span></div><button type="button" class="bk-cta" data-bk="plan">Crear mi presupuesto</button></section>';
  }
  const acts='<div class="bk-acts"><button type="button" data-bk="gasto"><i class="r">↓</i>Anotar gasto</button><button type="button" data-bk="entrada"><i class="g">↑</i>Anotar entrada</button><button type="button" data-bk="voz"><i class="b">🎙</i>Hablar</button><button type="button" data-bk="calc"><i class="y">🧮</i>Calcular</button></div>';
  const gs=v.groups.filter(g=>g.spent>0||g.planned>0).sort((a,b)=>b.spent-a.spent);
  const shown=compact?gs.slice(0,6):gs;
  const tile=g=>{const q=pc(g.spent,g.planned);const t=g.planned>0?tone(q):'n';return '<div class="bk-g"><div class="bk-gh"><span class="bk-gi">'+esc(g.i)+'</span><b>'+esc(g.l)+'</b><span class="bk-ga">'+f(g.spent)+'</span></div><div class="bk-bar sm"><i class="'+t+'" style="width:'+Math.min(g.planned>0?q:0,100)+'%"></i></div><div class="bk-gf '+t+'"><span>'+(g.planned>0?(g.spent<=g.planned?'Te quedan '+f(g.planned-g.spent):'Te pasaste '+f(g.spent-g.planned)):'Sin monto previsto')+'</span><span>'+(g.planned>0?'de '+f(g.planned):'')+'</span></div></div>';};
  const groups='<section class="bk-card"><div class="bk-ch"><h2>Mis grupos</h2><button type="button" class="bk-link" data-bk="plan">'+(hasPlan?'Editar plan':'Crear plan')+'</button></div>'+(shown.length?'<div class="bk-gg">'+shown.map(tile).join('')+'</div>':'<p class="bk-empty">Todavía no hay gastos. Toca «Anotar gasto» y aquí verás cada grupo.</p>')+'</section>';
  const mv='<section class="bk-card"><div class="bk-ch"><h2>Últimos movimientos</h2><button type="button" class="bk-link" data-bk="hist">Ver todos</button></div>'+(v.recent.length?v.recent.map(t=>'<div class="bk-mv"><span class="bk-mi">'+esc(t.i)+'</span><span class="bk-mt">'+esc(t.l)+'<small>'+esc(t.d)+'</small></span><b class="'+(t.type==='income'?'g':'')+'">'+(t.type==='income'?'+':'−')+' '+f(t.a)+'</b></div>').join(''):'<p class="bk-empty">Aún no hay movimientos.</p>')+'</section>';
  return {hero,acts,groups,mv};
}
function bankHTML(compact){const x=bankParts(true);return x.hero+x.acts+'<div class="bk-two">'+x.groups+x.mv+'</div>';}
function bkClick(e){
  const b=e.target.closest('[data-bk]');if(!b)return;const a=b.dataset.bk;
  if(a==='gasto'||a==='entrada'||a==='voz'){open('registrar');setTimeout(()=>{const t=$(a==='entrada'?'tt-i':'tt-e');if(t)t.click();if(a==='voz'){const v=$('voice-start');if(v){v.scrollIntoView({block:'center'});v.click();}}},350);return;}
  if(a==='calc'){open('calc');return;}
  if(a==='hist'){goPanel('historico');return;}
  if(a==='plan'){const hasPlan=BV()&&BV().plannedExpense>0;const el=hasPlan?document.querySelector('[data-forma-click="15"]'):$('guide-action');goPanel('resumo');setTimeout(()=>{(document.querySelector('[data-forma-click="15"]')&&hasPlan?document.querySelector('[data-forma-click="15"]'):$('guide-action'))?.click();},300);return;}
}
function paintBank(){
  const p=$('p-resumo');if(!p)return;let box=$('av-bank');
  if(!box){
    box=document.createElement('div');box.id='av-bank';
    box.innerHTML='<div class="bk-top"><h1>Presupuesto</h1><div id="bk-month"></div></div><div class="bk-layout"><div id="bk-main"></div><aside id="bk-side"><div id="bk-mv"></div></aside></div>';
    p.prepend(box);box.addEventListener('click',bkClick);
    const mn=p.querySelector('.mnav');if(mn)$('bk-month').append(mn);
    const side=$('bk-side');['.savings-card','#chart-card'].forEach(q=>{const e=p.querySelector(q);if(e){e.hidden=false;side.append(e);}});
  }
  const x=bankParts(false);const m=x.hero+x.acts+x.groups;
  if($('bk-main').dataset.h!==m){$('bk-main').dataset.h=m;$('bk-main').innerHTML=m;}
  if($('bk-mv').dataset.h!==x.mv){$('bk-mv').dataset.h=x.mv;$('bk-mv').innerHTML=x.mv;}
}
let lastHTML='';
function paintCamino(){
  const body=$('cm-body');if(!body)return;
  const l=L(),s=S(),path=l.path||[],done=path.filter(c=>c.done).length;
  const gt=txt('guide-title'),gc=txt('guide-copy'),ga=txt('guide-action');
  let hero;
  if(l.next){const idx=Math.max(1,path.findIndex(c=>l.active&&c.id===l.active.id)+1);hero={k:'TU SIGUIENTE PASO'+(path.length?' · Estación '+idx+' de '+path.length:''),t:'Clase: '+l.next.title,c:l.active?l.active.title:'',b:'Continuar la clase →',a:'clase'};}
  else if(l.active){hero={k:'TU SIGUIENTE PASO',t:'Sigue con '+l.active.title,c:'Tu curso gratuito te espera.',b:'Continuar →',a:'clase'};}
  else if(path.length&&done===path.length){hero={k:'¡LO LOGRASTE!',t:'Terminaste todos los cursos gratuitos',c:'El siguiente nivel es un curso con acompañamiento de FORMÁ.',b:'Pedir información',a:'ayuda'};}
  else{hero={k:'TU SIGUIENTE PASO',t:gt||'Arma tu presupuesto',c:gc||'Un paso a la vez.',b:ga||'Empezar',a:'guia'};}
  const stations=path.map((c,i)=>'<div class="cm-st '+(c.done?'done':c.open?'now':'lock')+'"><b>'+(c.done?'✓':c.open?(i+1):'🔒')+'</b><span>'+esc(c.title)+'</span><small>'+(c.done?'Concluido':c.open?'En curso':'Se abre al terminar el anterior')+'</small></div>').join('')+'<div class="cm-st star"><b>★</b><span>Tu curso con FORMÁ</span><small>Clase de prueba y matrícula</small></div>';
  let mine;
  if(s.linked&&s.enrol){const e=s.enrol,left=Math.max(0,e.total-e.paid);mine='<section class="cm-card"><h2>Mi curso <button type="button" class="cm-link" data-cm="cursos">Ver todo</button></h2><b>'+esc(e.course)+'</b><p>'+esc(e.group||'')+'</p><p>'+(s.nextClass?'Próxima clase: '+dl(s.nextClass.day)+' · '+hh(s.nextClass.start)+(s.nextClass.module?' · '+esc(s.nextClass.module):''):'Sin próxima clase confirmada')+'</p><p>'+(s.nextDue?'Próxima cuota: '+money(s.nextDue.cents)+(s.nextDue.due?' · vence '+dl(s.nextDue.due):''):(left?'Falta pagar '+money(left):'Todo pagado'))+'</p></section>';}
  else mine='<section class="cm-card cm-cta"><h2>Cuando quieras, hay un siguiente nivel</h2><p>Los cursos de FORMÁ tienen clases en vivo, acompañamiento y plan de pago. Pide información y te escribimos.</p><button type="button" class="cm-btn" data-cm="ayuda">Pedir información</button></section>';
  const html='<div class="cm-head"><h1>Hola'+(firstName()?', '+esc(firstName()):'')+'</h1><p>Así va tu mes.</p></div>'+
   '<div id="bk-home">'+bankHTML(true)+'</div>'+
   '<div class="cm-grid" style="margin-top:16px"><section class="cm-hero"><small>'+esc(hero.k)+'</small><h2>'+esc(hero.t)+'</h2>'+(hero.c?'<p>'+esc(hero.c)+'</p>':'')+'<button type="button" class="cm-btn cm-white" data-cm="'+hero.a+'">'+esc(hero.b)+'</button></section>'+mine+
   '<section class="cm-card cm-wide"><h2>Tu camino'+(path.length?' <span class="cm-pill">'+done+' de '+path.length+' cursos</span>':'')+'</h2><div class="cm-path">'+stations+'</div><p class="cm-note">Terminas un curso y se abre el siguiente. Lo que haces en tu presupuesto también cuenta para avanzar.</p></section></div>';
  if(html!==lastHTML){lastHTML=html;body.innerHTML=html;}
}
function camClick(e){
  const b=e.target.closest('[data-cm]');if(!b)return;const a=b.dataset.cm;
  if(a==='clase'){goPanel('aprender');const id=L().active&&L().active.id;let tries=0;const t=setInterval(()=>{const btn=id&&document.querySelector('#forma-video-courses [data-course="'+id+'"]');if(btn||++tries>20){clearInterval(t);if(btn)btn.click();}},250);return;}
  if(a==='guia'){goPanel('resumo');setTimeout(()=>$('guide-action')?.click(),300);return;}
  if(a==='ayuda'){$('forma-help-button')?.click();return;}
  open(a);
}
/* ---------- Aprender: camino hacia un curso con FORMÁ ---------- */
function learnCta(){
  const p=$('p-aprender');if(!p||$('av-learn-cta'))return;
  const c=document.createElement('section');c.id='av-learn-cta';c.className='cm-card cm-cta';c.innerHTML='<h2>¿Te gustó? Hay un curso para ti</h2><p>Los cursos de FORMÁ tienen clases en vivo, acompañamiento y plan de pago. Pide información y te escribimos.</p><button type="button" class="cm-btn" id="av-learn-btn">Me interesa</button>';
  p.append(c);$('av-learn-btn').onclick=()=>$('forma-help-button')?.click();
}
let landed=false,t=null;
function schedule(){clearTimeout(t);t=setTimeout(()=>{paintCamino();sync();},60);}
function start(){
  build();panel();learnCta();
  document.addEventListener('forma:learning',schedule);document.addEventListener('forma:student',schedule);
  const cb=$('p-camino');if(cb){cb.addEventListener('click',camClick);cb.addEventListener('click',bkClick);}
  document.addEventListener('forma:budget',()=>{paintBank();schedule();});paintBank();
  const mo=new MutationObserver(()=>{sync();});document.querySelectorAll('#app-screen .panel').forEach(p=>mo.observe(p,{attributes:true,attributeFilter:['class']}));
  const mo2=new MutationObserver(schedule);['hero-bal','hero-sub','guide-title','guide-copy','guide-action','tb-greeting','student-entry-count'].forEach(id=>{const e=$(id);if(e)mo2.observe(e,{childList:true,subtree:true,characterData:true});});
  paintCamino();
  const orig=window.showApp;
  if(typeof orig==='function'){window.showApp=function(...a){const r=orig.apply(this,a);setTimeout(land,0);return r;};}
  if(getComputedStyle($('app-screen')).display!=='none')land();
}
function land(){
  if(landed)return;landed=true;
  const more=document.querySelector('.ia-more');if(more&&!more.open)more.open=true;
  const a=document.querySelector('#app-screen .panel.active');
  if(!a||a.id==='p-resumo'){goPanel('camino');}
  const demo=!!window.FORMA_DEMO;
  if(!demo){setTimeout(()=>{try{window.FormaLearningView?.load?.()}catch(e){}try{window.FormaStudent?.load?.()}catch(e){}},400);}
  else{setTimeout(()=>{try{window.FormaLearningView?.load?.()}catch(e){}},400);}
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
