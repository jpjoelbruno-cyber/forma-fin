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
 function vis(){h.querySelectorAll('.ia-rbig').forEach(b=>{const n=nav(b.dataset.iaView);b.hidden=!(n&&n.offsetParent!==null)})}vis();const nv=document.querySelector('.forma-work-header nav');if(nv)new MutationObserver(vis).observe(nv,{attributes:true,subtree:true,childList:true});let k=0;const iv=setInterval(()=>{vis();if(++k>20)clearInterval(iv)},500);
 const first=[...W.children].find(c=>c.id!=='demo-notice');W.insertBefore(h,first||null);
 const more=document.createElement('button');more.type='button';more.className='ia-rmore';more.textContent='Ver el detalle de mi día';more.addEventListener('click',()=>{const on=document.body.classList.toggle('ia-detail');more.textContent=on?'Ocultar el detalle de mi día':'Ver el detalle de mi día'});h.querySelector('.ia-rpend').append(more);
 const t=nav('tasks');if(t){const p=document.createElement('button');p.type='button';p.className='ia-rmore';p.addEventListener('click',()=>t.click());const upd=()=>{p.textContent=(t.textContent.trim().replace(/\s+/g,' ')||'Pendientes')};upd();new MutationObserver(upd).observe(t,{childList:true,subtree:true,characterData:true});h.querySelector('.ia-rpend').prepend(p)}}
function start(){build();if(!$('ia-rhome')){const o=new MutationObserver(()=>{build();if($('ia-rhome'))o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
