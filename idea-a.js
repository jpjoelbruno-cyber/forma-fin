/* Idea A (alumno): una cosa a la vez. Solo presentación y navegación; reutiliza los botones y datos existentes. No consulta ni guarda datos por su cuenta. */
(()=>{const $=id=>document.getElementById(id);
const TITLES={registrar:'Anotar',historico:'Mis movimientos',metas:'Mis metas',aprender:'Aprender',anual:'Mi año',banco:'Mis cuentas',institution:'Mis cursos y pagos',more:'Más',alunos:'Alumnos'};
const ico=d=>'<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',plus:'<path d="M12 5v14M5 12h14"/>',goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',wallet:'<path d="M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-3h11M16 14h2"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/>'};
function link(t,i,sub,attr){return '<button type="button" class="ia-lk" '+attr+'><span class="ia-lki">'+ico(I[i])+'</span><span class="ia-lkt">'+t+(sub?'<small>'+sub+'</small>':'')+'</span><span class="ia-lka">'+ico(I.arrow)+'</span></button>'}
function buildBar(){const app=$('app-screen');if(!app||$('ia-bar'))return;
 const bar=document.createElement('header');bar.id='ia-bar';bar.innerHTML='<button type="button" class="ia-homebtn" data-ia-home>'+ico(I.home)+'Inicio</button><h1 id="ia-title">FORMÁ</h1><img src="/forma-sello-blanco.svg?v=marca2-20261024" alt="Sello FORMÁ" class="ia-seal">';
 app.insertBefore(bar,app.querySelector('.topbar'));bar.querySelector('[data-ia-home]').addEventListener('click',()=>{const b=$('nb-resumo');if(b)b.click()});}
function buildHome(){const P=$('p-resumo');if(!P||$('ia-home'))return;
 const home=document.createElement('section');home.id='ia-home';home.innerHTML=
 '<div class="ia-hi"><img src="/forma-sello.svg?v=marca2-20261024" alt="" class="ia-hseal"><div><h2 id="ia-hola">Hola</h2><p>Esto es lo que pasa con tu plata</p></div></div>'+
 '<div class="ia-card"><p class="ia-sub">Este mes te quedan</p><div class="ia-big" id="ia-left">R$ 0</div><div class="ia-row"><span class="ia-ok" id="ia-in">Entró R$ 0</span><span class="ia-bad" id="ia-out">Salió R$ 0</span></div></div>'+
 '<button type="button" class="ia-cta" data-forma-click="34"><span class="ia-ctai">'+ico(I.plus)+'</span>Anotar un gasto o una entrada</button>'+
 '<div class="ia-links">'+link('Mis metas','goal','','data-forma-click="36"')+link('Aprender','book','','data-forma-click="37"')+link('Mis cursos y pagos','cap','Pagos y comprobantes','data-ia-go="inst"')+link('Mis movimientos','list','','data-forma-click="35"')+link('Mis cuentas','wallet','','data-ia-go="nb-banco"')+link('Mi año','cal','','data-forma-click="38"')+link('Ayuda','chat','Hablar con FORMÁ','data-ia-go="ayuda"')+'</div>';
 const det=document.createElement('details');det.className='ia-more';det.innerHTML='<summary>Ver el resumen completo del mes</summary>';
 while(P.firstChild)det.append(P.firstChild);P.append(home,det);
 home.addEventListener('click',e=>{const t=e.target.closest('[data-ia-go]');if(!t)return;const k=t.dataset.iaGo;let b=null;
  if(k==='inst')b=[...document.querySelectorAll('#p-more button')].find(x=>/Mi instituci/.test(x.textContent));else if(k==='ayuda')b=$('forma-help-button');else b=$(k);if(b)b.click()});
 syncHome();}
function syncHome(){const t=(id)=>($(id)?.textContent||'').trim();const hola=t('tb-greeting').replace(/!$/,'');if($('ia-hola')&&hola&&hola!=='FORMA')$('ia-hola').textContent=hola;
 const bal=t('hero-bal');if($('ia-left')&&bal)$('ia-left').textContent=bal.replace(/,00$/,'');
 if($('ia-in'))$('ia-in').textContent='Entró '+(t('s-inc')||'R$ 0').replace(/,00$/,'');if($('ia-out'))$('ia-out').textContent='Salió '+(t('s-exp')||'R$ 0').replace(/,00$/,'');
 const left=$('ia-left');if(left){const neg=/^-|−/.test(bal);left.classList.toggle('ia-bad',neg);left.classList.toggle('ia-ok',!neg)}}
let step=1;
function wizard(){const P=$('p-registrar'),m=$('manual-register');if(!P||!m||P.dataset.ia)return;P.dataset.ia='1';
 const type=m.querySelector('.reg-type-row'),amt=m.querySelector('.reg-amount-wrap'),ql=$('qcat-label'),daily=m.querySelector('.daily-category'),qc=$('quick-cats'),vt=$('ver-todas-btn'),ac=$('all-cats-wrap'),desc=$('tx-desc'),date=$('tx-date'),save=$('save-btn'),voice=P.querySelector('.voice-card');
 const w=document.createElement('div');w.className='ia-wiz';w.dataset.step='1';
 w.innerHTML='<div class="ia-dots"><i></i><i></i><i></i></div><p class="ia-stepl" id="ia-stepl"></p>'+
 '<section class="ia-s s1"><h2>¿Qué quieres anotar?</h2><button type="button" class="ia-big2 ia-red" data-ia-type="e">'+ico(I.down)+'<span>Un gasto<small>Plata que salió</small></span></button><button type="button" class="ia-big2 ia-green" data-ia-type="i">'+ico(I.up)+'<span>Una entrada<small>Plata que recibí</small></span></button><div class="ia-voicebox"></div></section>'+
 '<section class="ia-s s2"><h2>¿Cuánto fue?</h2><div class="ia-amt"></div><h3>¿En qué?</h3><div class="ia-cats"></div><p class="ia-err" id="ia-err" hidden>Tocá el número y escribí cuánto fue.</p><div class="ia-nav"><button type="button" class="ia-back" data-ia-step="1">Atrás</button><button type="button" class="ia-next" data-ia-step="3">Seguir</button></div></section>'+
 '<section class="ia-s s3"><h2>Revisá y guardá</h2><div class="ia-sum" id="ia-sum"></div><div class="ia-when"></div><div class="ia-nav"><button type="button" class="ia-back" data-ia-step="2">Atrás</button><span class="ia-save"></span></div></section>';
 P.append(w);
 w.querySelector('.ia-amt').append(amt);const cats=w.querySelector('.ia-cats');[ql,qc,vt,ac,daily].filter(Boolean).forEach(x=>cats.append(x));
 const when=w.querySelector('.ia-when');[date,desc].filter(Boolean).forEach(x=>when.append(x));w.querySelector('.ia-save').append(save);
 if(voice)w.querySelector('.ia-voicebox').append(voice);
 if(type)type.classList.add('ia-hidden');
 w.addEventListener('click',e=>{const ty=e.target.closest('[data-ia-type]');if(ty){const b=$(ty.dataset.iaType==='e'?'tt-e':'tt-i');if(b)b.click();go(2);return}
  const st=e.target.closest('[data-ia-step]');if(!st)return;const n=Number(st.dataset.iaStep);
  if(n===3){const d=$('amt-display');if(!d||d.classList.contains('empty')||/^0[,.]00$/.test(d.textContent.trim())){$('ia-err').hidden=false;return}$('ia-err').hidden=true}
  go(n)});}
function go(n){const w=document.querySelector('.ia-wiz');if(!w)return;step=n;w.dataset.step=String(n);
 w.querySelectorAll('.ia-dots i').forEach((d,i)=>d.classList.toggle('on',i<n));const exp=$('tt-e')?.classList.contains('active');
 $('ia-stepl').textContent='Paso '+n+' de 3'+(n>1?' · '+(exp?'Es un gasto':'Es una entrada'):'');
 if(n===3){const d=$('amt-display')?.textContent.trim()||'';const cat=document.querySelector('#quick-cats .qcat.active,#all-cats-wrap .active');$('ia-sum').innerHTML='<span class="'+(exp?'ia-bad':'ia-ok')+'">'+(exp?'− ':'+ ')+'R$ '+d+'</span><small>'+(exp?'Gasto':'Entrada')+'</small>'}
 const el=$('ia-err');if(el&&n!==2)el.hidden=true;window.scrollTo&&document.scrollingElement&&(document.scrollingElement.scrollTop=0)}
function relabel(){document.querySelectorAll('#goals-list button[data-forma-click="85"]').forEach(b=>{if(b.textContent!=='Guardar dinero en esta meta')b.textContent='Guardar dinero en esta meta'});
 document.querySelectorAll('#goals-list button[data-forma-click="86"]').forEach(b=>{if(b.textContent!=='Saqué dinero')b.textContent='Saqué dinero'});
 document.querySelectorAll('#p-metas .section-head .btn-sm').forEach(b=>{if(b.textContent!=='Crear una meta nueva')b.textContent='Crear una meta nueva'})}
function owner(){const n=$('nb-alunos'),g=document.querySelector('#ia-home .ia-links');if(!g||g.querySelector('[data-ia-al]'))return;if(n&&n.style.display!=='none'){const d=document.createElement('div');d.innerHTML=link('Alumnos','users','Ver y acompañar','data-ia-al="1"');const b=d.firstChild;b.addEventListener('click',()=>n.click());g.prepend(b)}}
function sync(){const a=document.querySelector('#app-screen .panel.active');if(!a)return;const k=a.id.replace(/^p-/,'');const home=k==='resumo';
 document.body.classList.toggle('ia-home-on',home);document.body.classList.toggle('ia-inner',!home);const t=$('ia-title');if(t)t.textContent=TITLES[k]||(a.querySelector('h2')?.textContent||'FORMÁ');
 if(k==='registrar'&&a.dataset.iaOpen!=='1'){a.dataset.iaOpen='1';go(1)}if(k!=='registrar'){const r=$('p-registrar');if(r)r.dataset.iaOpen='0'}
 if(document.scrollingElement)document.scrollingElement.scrollTop=0;relabel();owner();syncHome()}
function start(){buildBar();buildHome();wizard();go(1);sync();
 const mo=new MutationObserver(()=>{sync()});document.querySelectorAll('#app-screen .panel').forEach(p=>mo.observe(p,{attributes:true,attributeFilter:['class']}));
 const mo2=new MutationObserver(()=>{relabel();syncHome();owner()});['goals-list','hero-bal','s-inc','s-exp','tb-greeting','nb-alunos'].forEach(id=>{const e=$(id);if(e)mo2.observe(e,{childList:true,subtree:true,characterData:true,attributes:true})});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
