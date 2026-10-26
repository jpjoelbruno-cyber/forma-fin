/* Franja del embudo de ventas: solo lee los números ya visibles en el tablero de Ventas. No consulta ni guarda datos. */
(()=>{function start(T){if(document.getElementById('embudo-franja'))return;
const strip=document.createElement('section');strip.id='embudo-franja';strip.className='embudo';strip.hidden=true;strip.setAttribute('aria-label','Embudo de ventas');T.before(strip);
function paint(){const lanes=[...T.querySelectorAll('.crm-lane[data-axis="stage"]')];
 const rows=lanes.map(l=>{const b=l.querySelector('h3 button');const sp=b&&b.querySelector('span');const n=sp?Number(sp.textContent):NaN;return{k:l.dataset.laneKey,name:b?b.firstChild.textContent.trim():'',n}}).filter(r=>Number.isFinite(r.n));
 if(rows.length<2){strip.hidden=true;return}
 const total=rows.reduce((a,r)=>a+r.n,0),mat=rows.find(r=>r.k==='matriculado');
 const max=Math.max(1,...rows.map(r=>r.n));
 strip.innerHTML='<h3>Embudo de ventas</h3><div class="emb-row">'+rows.map(r=>'<div class="emb-step"><b>'+r.n+'</b><span>'+r.name+'</span><i style="width:'+Math.round(r.n/max*100)+'%"></i></div>').join('<span class="emb-arrow" aria-hidden="true">→</span>')+'</div>'
 +(mat&&total?'<p>Conversión: <strong>'+Math.round(mat.n/total*100)+'%</strong> de las personas en el tablero ya están matriculadas.</p>':'');
 strip.hidden=false;}
new MutationObserver(paint).observe(T,{childList:true,subtree:true,characterData:true});paint();}
const f=()=>{const T=document.getElementById('crm-sales');if(T){start(T);return true}return false};
if(!f()){const o=new MutationObserver(()=>{if(f())o.disconnect()});o.observe(document.documentElement,{childList:true,subtree:true})}})();
