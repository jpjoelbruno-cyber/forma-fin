/* Idea A · menú fijo estilo app bancaria (alumno). Solo navegación: pulsa los botones/paneles que ya existen. No consulta ni guarda datos. */
(()=>{const $=id=>document.getElementById(id);
const ico=d=>'<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',plus:'<path d="M12 5v14M5 12h14"/>',goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'};
const IT=[['resumo','Inicio','home'],['registrar','Anotar','plus'],['metas','Metas','goal'],['historico','Movimientos','list'],['more','Más','more']];
function build(){const app=$('app-screen');if(!app||$('ia-nav'))return;const n=document.createElement('nav');n.id='ia-nav';n.setAttribute('aria-label','Menú principal');
 n.innerHTML='<span class="ia-nav-brand"><img src="/forma-sello-blanco.svg?v=marca2-20261024" alt="" width="30" height="30">FORMÁ</span>'+IT.map(([k,t,i])=>'<button type="button" data-k="'+k+'">'+ico(I[i])+'<span>'+t+'</span></button>').join('');
 n.addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;const k=b.dataset.k;if(k==='more'&&typeof goPanel==='function'){goPanel('more');return}const nb=$('nb-'+k);if(nb)nb.click()});
 app.prepend(n);sync()}
function sync(){const n=$('ia-nav');const a=document.querySelector('#app-screen .panel.active');if(!n||!a)return;const k=a.id.replace(/^p-/,'');const g=['resumo','registrar','metas','historico'].includes(k)?k:'more';
 n.querySelectorAll('button').forEach(b=>{if(b.dataset.k===g)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function start(){build();const mo=new MutationObserver(sync);document.querySelectorAll('#app-screen .panel').forEach(p=>mo.observe(p,{attributes:true,attributeFilter:['class']}));if(!$('ia-nav')){const o=new MutationObserver(()=>{build();if($('ia-nav'))o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
