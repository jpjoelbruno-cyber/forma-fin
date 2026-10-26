/* asigna hidden solo si cambia: evita que un observador se dispare a sí mismo en bucle */
function setH(e,v){if(e.hidden!==v)e.hidden=v}
/* FORMA Gestión · Idea A: inicio con 4 botones grandes. Solo presentación y navegación: pulsa los botones que ya existen. No consulta ni guarda datos. */
(()=>{const $=id=>document.getElementById(id);
const ico=d=>'<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>'};
const BTNS=[['income','Cobrar un pago','Y darle su comprobante','cash','ia-g','Registrar'],['education','Matricular un alumno','Paso a paso','cap','ia-v','Matricular'],['sales','Atender interesados','Ver quién espera respuesta','chat','ia-r','']];
function nav(v){return document.querySelector('.forma-work-header nav [data-view="'+v+'"]')}
function after(v,rx){const n=nav(v);if(!n)return;n.click();if(!rx)return;let t=0;const id=setInterval(()=>{t+=250;const b=[...document.querySelectorAll('#workspace button')].find(x=>rx.test(x.textContent.trim())&&x.offsetParent);if(b){clearInterval(id);b.click()}else if(t>2500)clearInterval(id)},250)}
function build(){const W=$('workspace');if(!W||$('ia-rhome'))return;
 const h=document.createElement('section');h.id='ia-rhome';
 h.innerHTML='<div><h2>Buenos días</h2><p>¿Qué querés hacer ahora?</p></div><div class="ia-rgrid"></div><div class="ia-rpend"></div>';
 const g=h.querySelector('.ia-rgrid');
 BTNS.forEach(([v,t,s,i,c,rx])=>{if(!nav(v))return;const b=document.createElement('button');b.type='button';b.className='ia-rbig '+c;b.innerHTML=ico(I[i])+'<span>'+t+'<small>'+s+'</small></span>';b.dataset.iaView=v;b.addEventListener('click',()=>after(v,rx?new RegExp(rx,'i'):null));g.append(b)});
 function vis(){h.querySelectorAll('.ia-rbig').forEach(b=>{const n=nav(b.dataset.iaView);setH(b,!(n&&!n.hidden))})}vis();const nv=document.querySelector('.forma-work-header nav');if(nv)new MutationObserver(vis).observe(nv,{attributes:true,subtree:true,childList:true});let k=0;const iv=setInterval(()=>{vis();if(++k>20)clearInterval(iv)},500);
 const first=[...W.children].find(c=>c.id!=='demo-notice');W.insertBefore(h,first||null);
 }
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
 const vis=()=>d.querySelectorAll('button').forEach(a=>{const n=nav(a.dataset.v);setH(a,!(n&&!n.hidden))});vis();const nv=document.querySelector('.forma-work-header nav');if(nv)new MutationObserver(vis).observe(nv,{attributes:true,subtree:true,childList:true});let k=0;const iv=setInterval(()=>{vis();if(++k>20)clearInterval(iv)},500)}
function det(title,nodes,cls){const d=document.createElement('details');d.className='ia-rdet '+(cls||'');const s=document.createElement('summary');s.textContent=title;d.append(s);nodes.forEach(n=>n&&d.append(n));return d}
function agenda(){const w=$('rene-week');if(!w||w.dataset.ia)return;const tools=w.querySelector('.calendar-tools');if(!tools)return;w.dataset.ia='1';
 const extra=[...tools.querySelectorAll(':scope>label')];const rf=$('refresh');if(rf)extra.push(rf);const tabs=w.querySelector('.agenda-type-tabs');
 tools.append(det('Más filtros y vistas',extra,'ia-rfilt'));
 const hist=w.querySelector('.agenda-history');if(hist){const d=det('Historial de reservas',[hist]);w.append(d)}}
function caja(){const c=$('income-content');if(!c)return;const stats=c.querySelector('.finance-stats');if(!stats)return;
 
 const cmp=c.querySelector('.finance-year-comparison');const first=stats.querySelector('article');
 if(cmp&&first){const txt=cmp.textContent;const m=txt.match(/variación\s*([+\-−]?\s*R\$\s*[\d.,]+)(?:\s*\(([+\-−]?[\d.,]+)%\))?/);let h=first.querySelector('.ia-delta');
  let label='',cls='';if(m){const neg=/^[\-−]/.test(m[1].trim());cls=neg?'ia-down':'ia-up';label=(neg?'▼ ':'▲ ')+(m[2]?m[2].replace(/^[+\-−]/,'')+'%':m[1].replace(/^[+\-−]\s*/,''))+' vs anterior'}else{label='Sin comparación anterior';cls='ia-flat'}
  if(!h){h=document.createElement('em');h.className='ia-delta';first.append(h)}if(h.textContent!==label){h.textContent=label;h.className='ia-delta '+cls}}}
function run(){bar();agenda();caja()}
let rt=0;const mo=new MutationObserver(()=>{if(rt)return;rt=setTimeout(()=>{rt=0;run()},80)});mo.observe(document.documentElement,{childList:true,subtree:true});run();})();

(()=>{const $=id=>document.getElementById(id);const nv=v=>document.querySelector('.forma-work-header nav [data-view="'+v+'"]');
const ico=d=>'<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',chart:'<path d="M5 20V10M12 20V4M19 20v-7"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',cap:'<path d="M3 10l9-5 9 5-9 5zM7 12v5c3 2 7 2 10 0v-5"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 0 0 0-6M21 20c0-2.5-1.5-4.6-4-5.5"/>',bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'};
const IT=[['today','Inicio','home'],['week','Agenda','cal'],['income','Finanzas','chart'],['sales','Interesados','chat'],['education','Cursos','cap'],['people','Personas','users'],['tasks','Avisos','bell'],['review','Evaluar','star'],['mas','Más','more']];
const MAS=[['sales','Atender interesados'],['education','Cursos y matrículas'],['people','Personas'],['tasks','Avisos'],['review','Evaluar y mejorar']];
function go(v,rx){const n=nv(v);if(!n)return;n.click();if(!rx)return;let t=0;const id=setInterval(()=>{t+=250;const b=[...document.querySelectorAll('#workspace button')].find(x=>rx.test(x.textContent.trim())&&x.offsetParent);if(b){clearInterval(id);b.click()}else if(t>2500)clearInterval(id)},250)}
function build(){const h=document.querySelector('.forma-work-header');if(!h||$('ia-rnav'))return;const n=document.createElement('nav');n.id='ia-rnav';n.setAttribute('aria-label','Menú principal');
 n.innerHTML=IT.map(([k,t,i])=>'<button type="button" data-k="'+k+'">'+ico(I[i])+'<span>'+t+'</span></button>').join('');
 const m=document.createElement('div');m.id='ia-rmas';m.hidden=true;m.innerHTML='<div class="ia-rmas-in"></div>';
 n.addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;const k=b.dataset.k;m.hidden=true;if(k==='mas'){fill();m.hidden=false;return}go(k)});
 m.addEventListener('click',e=>{const b=e.target.closest('button');if(!b){m.hidden=true;return}m.hidden=true;if(b.dataset.v)go(b.dataset.v);else if(b.dataset.out){const o=[...document.querySelectorAll('button')].find(x=>/Cerrar sesi/i.test(x.textContent));o?.click()}});
 h.append(n);document.body.append(m);vis();sync()}
function fill(){const box=$('ia-rmas').firstChild;box.innerHTML='';MAS.forEach(([v,t])=>{const n=nv(v);if(!n||n.hidden)return;const b=document.createElement('button');b.type='button';b.dataset.v=v;b.textContent=t;box.append(b)});
 const o=[...document.querySelectorAll('button')].find(x=>/Cerrar sesi/i.test(x.textContent));if(o){const b=document.createElement('button');b.type='button';b.dataset.out='1';b.className='ia-out';b.textContent='Cerrar sesión';box.append(b)}}
function vis(){const n=$('ia-rnav');if(!n)return;const map={today:'today',week:'week',income:'income',sales:'sales',education:'education',people:'people',tasks:'tasks',review:'review'};n.querySelectorAll('button').forEach(b=>{const k=b.dataset.k;if(k==='mas'){setH(b,false);return}const x=nv(map[k]);setH(b,!(x&&!x.hidden))})}
function sync(){const n=$('ia-rnav');if(!n)return;const v=document.body.dataset.workspaceView||'today';const g=({today:'today',week:'week',income:'income',sales:'sales',education:'education',people:'people',tasks:'tasks',review:'review'})[v]||'mas';n.querySelectorAll('button').forEach(b=>{if(b.dataset.k===g)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
let tm=0;const mo=new MutationObserver(()=>{if(tm)return;tm=setTimeout(()=>{tm=0;build();vis();sync()},60)});mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-workspace-view','hidden']});build();})();
