/* Modelo B (alumno): barra con botón Inicio en cada pantalla, mosaico de inicio. Solo navegación y presentación; no lee ni escribe datos. */
(()=>{const $=id=>document.getElementById(id);
const TITLES={registrar:'Anotar un movimiento',historico:'Mis movimientos',metas:'Mis metas',aprender:'Aprender',anual:'Mi año',banco:'Mis cuentas',institution:'Mis cursos y pagos',more:'Más opciones',alunos:'Alumnos'};
function build(){const app=$('app-screen');if(!app||$('mb-bar'))return;
 const bar=document.createElement('header');bar.id='mb-bar';bar.innerHTML='<button type="button" class="mb-home" data-mb-home><svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>Inicio</button><h1 id="mb-title">FORMÁ</h1><img src="/forma-sello-blanco.svg?v=marca2-20261024" alt="Sello FORMÁ" class="mb-seal">';
 app.insertBefore(bar,app.querySelector('.topbar'));
 bar.querySelector('[data-mb-home]').addEventListener('click',()=>{const b=$('nb-resumo');if(b)b.click()});}
function sync(){const a=document.querySelector('#app-screen .panel.active');if(!a)return;const k=a.id.replace(/^p-/,'');const home=k==='resumo';
 document.body.classList.toggle('mb-home',home);document.body.classList.toggle('mb-inner',!home);
 const t=$('mb-title');if(t)t.textContent=TITLES[k]||(a.querySelector('h2')?.textContent||'FORMÁ');if(document.scrollingElement)document.scrollingElement.scrollTop=0;}
function owner(){const n=$('nb-alunos'),g=document.querySelector('.mos-g');if(!g||g.querySelector('[data-mb-alunos]'))return;
 if(n&&n.style.display!=='none'){const b=document.createElement('button');b.className='mos-tile';b.dataset.mbAlunos='1';b.innerHTML='<span class="mos-chip c-b"><svg class="mi" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M17 11a3 3 0 1 0 0-6M21.5 19c-.3-2.5-1.5-4-3.5-4.7"/></svg></span><strong>Alumnos</strong><small>Ver y acompañar</small>';b.addEventListener('click',()=>n.click());g.append(b)}}
function step(n,title,nodes){const d=document.createElement('section');d.className='mb-step';d.innerHTML='<h3><b>'+n+'</b>'+title+'</h3>';const body=document.createElement('div');body.className='mb-step-body';nodes.filter(Boolean).forEach(x=>body.append(x));d.append(body);return d}
function anotar(){const P=$('p-registrar'),m=$('manual-register');if(!P||!m||P.dataset.mb)return;P.dataset.mb='1';
 const type=m.querySelector('.reg-type-row'),amt=m.querySelector('.reg-amount-wrap'),ql=$('qcat-label'),daily=m.querySelector('.daily-category'),qc=$('quick-cats'),vt=$('ver-todas-btn'),ac=$('all-cats-wrap'),desc=$('tx-desc'),date=$('tx-date'),save=$('save-btn'),opts=m.querySelector('.reg-opts');
 const voice=P.querySelector('.voice-card');
 const cancel=document.createElement('button');cancel.type='button';cancel.className='mb-cancel';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>{const b=$('nb-resumo');if(b)b.click()});
 const wrap=document.createElement('div');wrap.className='mb-anotar';
 if(type)wrap.append(type);
 if(voice)wrap.append(voice);
 wrap.append(step(1,'¿Cuánto?',[amt]),step(2,'¿Qué fue?',[ql,qc,vt,ac,daily,desc]),step(3,'¿Cuándo?',[date]));
 const bar=document.createElement('div');bar.className='mb-actions';bar.append(cancel,save);wrap.append(bar);
 P.append(wrap);m.open=true;m.classList.add('mb-manual-done');}
function start(){build();anotar();sync();owner();
 const mo=new MutationObserver(()=>{sync();owner()});document.querySelectorAll('#app-screen .panel').forEach(p=>mo.observe(p,{attributes:true,attributeFilter:['class']}));
 const nb=$('nb-alunos');if(nb)mo.observe(nb,{attributes:true,attributeFilter:['style']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
