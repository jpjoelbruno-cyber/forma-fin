/* FORMA Gestión · Idea A: inicio con 4 botones grandes. Solo presentación y navegación: pulsa los botones que ya existen. No consulta ni guarda datos. */
(()=>{const $=id=>document.getElementById(id);
const ico=d=>'<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>'};
const BTNS=[['income','Cobrar un pago','Y darle su comprobante','cash','ia-g','Registrar'],['education','Matricular un alumno','Paso a paso','cap','ia-v','Matricular'],['week','Mi agenda','Ver y agendar','cal','ia-a',''],['sales','Atender interesados','Ver quién espera respuesta','chat','ia-r','']];
function nav(v){return document.querySelector('.forma-work-header nav [data-view="'+v+'"]')}
function after(v,rx){const n=nav(v);if(!n)return;n.click();if(!rx)return;let t=0;const id=setInterval(()=>{t+=250;const b=[...document.querySelectorAll('#workspace button')].find(x=>rx.test(x.textContent.trim())&&x.offsetParent);if(b){clearInterval(id);b.click()}else if(t>2500)clearInterval(id)},250)}
function build(){const W=$('workspace');if(!W||$('ia-rhome'))return;
 const h=document.createElement('section');h.id='ia-rhome';
 h.innerHTML='<div><h2>Buenos días</h2><p>¿Qué querés hacer ahora?</p></div><div class="ia-rgrid"></div><div class="ia-rpend"></div>';
 const g=h.querySelector('.ia-rgrid');
 BTNS.forEach(([v,t,s,i,c,rx])=>{if(!nav(v))return;const b=document.createElement('button');b.type='button';b.className='ia-rbig '+c;b.innerHTML=ico(I[i])+'<span>'+t+'<small>'+s+'</small></span>';b.dataset.iaView=v;b.addEventListener('click',()=>after(v,rx?new RegExp(rx,'i'):null));g.append(b)});
 function vis(){h.querySelectorAll('.ia-rbig').forEach(b=>{const n=nav(b.dataset.iaView);b.hidden=!(n&&!n.hidden)})}vis();const nv=document.querySelector('.forma-work-header nav');if(nv)new MutationObserver(vis).observe(nv,{attributes:true,subtree:true,childList:true});let k=0;const iv=setInterval(()=>{vis();if(++k>20)clearInterval(iv)},500);
 const first=[...W.children].find(c=>c.id!=='demo-notice');W.insertBefore(h,first||null);
 const more=document.createElement('button');more.type='button';more.className='ia-rmore';more.textContent='Ver el detalle de mi día';more.addEventListener('click',()=>{const on=document.body.classList.toggle('ia-detail');more.textContent=on?'Ocultar el detalle de mi día':'Ver el detalle de mi día'});h.querySelector('.ia-rpend').append(more);
 const t=nav('tasks');if(t){const p=document.createElement('button');p.type='button';p.className='ia-rmore';p.addEventListener('click',()=>t.click());const upd=()=>{p.textContent=(t.textContent.trim().replace(/\s+/g,' ')||'Pendientes')};upd();new MutationObserver(upd).observe(t,{childList:true,subtree:true,characterData:true});h.querySelector('.ia-rpend').prepend(p)}}
function start(){build();if(!$('ia-rhome')){const o=new MutationObserver(()=>{build();if($('ia-rhome'))o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();

/* ---- Idea A · estructura de Gestión: barra con Inicio, enlaces, agenda y finanzas simplificadas. Solo mueve/pulsa nodos existentes; no lee ni guarda datos. ---- */
(()=>{const $=id=>document.getElementById(id);const T={week:'Mi agenda',income:'Finanzas',sales:'Atender interesados',education:'Cursos y matrículas',tasks:'Avisos',review:'Evaluar y mejorar',people:'Personas'};
const nav=v=>document.querySelector('.forma-work-header nav [data-view="'+v+'"]');
const view=()=>document.body.dataset.workspaceView||'today';
function bar(){if($('ia-rbar'))return;const h=document.querySelector('.forma-work-header');if(!h)return;const b=document.createElement('div');b.id='ia-rbar';
 b.innerHTML='<button type="button" class="ia-rhome-btn"><svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/></svg>Inicio</button><strong id="ia-rtitle"></strong><img src="/forma-sello-blanco.svg" alt="" width="40" height="40">';
 b.querySelector('button').addEventListener('click',()=>{const t=nav('today');if(t)t.click();window.scrollTo?.(0,0)});h.before(b);
 const upd=()=>{const v=view();$('ia-rtitle').textContent=T[v]||'';document.body.classList.toggle('ia-rinner',v!=='today')};upd();new MutationObserver(upd).observe(document.body,{attributes:true,attributeFilter:['data-workspace-view']})}
function links(){const r=document.querySelector('#ia-rhome .ia-rpend');if(!r||r.querySelector('.ia-rlinks'))return;const d=document.createElement('div');d.className='ia-rlinks';
 [['income','Finanzas'],['people','Personas'],['education','Cursos y matrículas'],['tasks','Avisos'],['review','Evaluar y mejorar']].forEach(([v,t])=>{const a=document.createElement('button');a.type='button';a.dataset.v=v;a.textContent=t;a.addEventListener('click',()=>nav(v)?.click());d.append(a)});r.append(d);
 const vis=()=>d.querySelectorAll('button').forEach(a=>{const n=nav(a.dataset.v);a.hidden=!(n&&!n.hidden)});vis();const nv=document.querySelector('.forma-work-header nav');if(nv)new MutationObserver(vis).observe(nv,{attributes:true,subtree:true,childList:true});let k=0;const iv=setInterval(()=>{vis();if(++k>20)clearInterval(iv)},500)}
function det(title,nodes,cls){const d=document.createElement('details');d.className='ia-rdet '+(cls||'');const s=document.createElement('summary');s.textContent=title;d.append(s);nodes.forEach(n=>n&&d.append(n));return d}
function agenda(){const w=$('rene-week');if(!w||w.dataset.ia)return;const tools=w.querySelector('.calendar-tools');if(!tools)return;w.dataset.ia='1';
 const extra=[...tools.querySelectorAll(':scope>label')];const rf=$('refresh');if(rf)extra.push(rf);const tabs=w.querySelector('.agenda-type-tabs');
 tools.append(det('Más filtros y vistas',extra,'ia-rfilt'));
 const hist=w.querySelector('.agenda-history');if(hist){const d=det('Historial de reservas',[hist]);w.append(d)}}
function caja(){const c=$('income-content');if(!c||c.dataset.ia)return;const stats=c.querySelector('.finance-stats');if(!stats)return;c.dataset.ia='1';
 const b=document.createElement('button');b.type='button';b.className='ia-rdebe';b.textContent='Ver quién debe';b.addEventListener('click',()=>{const t=[...c.querySelectorAll('.finance-view-tabs button')].find(x=>/cobrar/i.test(x.textContent));t?.click()});stats.after(b);
 const sum=$('finance-summary-pane');if(sum&&!sum.dataset.ia){sum.dataset.ia='1'}}
function run(){bar();links();agenda();caja()}
const mo=new MutationObserver(run);mo.observe(document.documentElement,{childList:true,subtree:true});run();})();
