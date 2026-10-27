/* Mi dinero: Anotar + Movimientos (extracto) en una sola pantalla, y Metas como pestaña.
   Solo presentación: mueve los paneles existentes (#p-registrar y #p-historico) a un contenedor común.
   No cambia datos, ids ni la lógica de guardado. Para volver atrás: quitar este script y mi-dinero.css de index.html. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function tabs(){return '<div class="md-tabs" role="tablist" aria-label="Mi dinero"><button type="button" role="tab" data-md="registrar">Anotar y movimientos</button><button type="button" role="tab" data-md="metas">Metas</button></div>';}
function refresh(){try{if(typeof renderTxList==='function')renderTxList();}catch(e){}}
function mark(){
  const w=$('md-wrap'),m=$('p-metas');
  const onMetas=!!m&&m.classList.contains('active');
  document.querySelectorAll('.md-tabs button').forEach(b=>{const on=(b.dataset.md==='metas')===onMetas;b.setAttribute('aria-selected',on?'true':'false');});
  if(w&&!onMetas&&w.querySelector('.panel.active')&&!w.dataset.fresh){w.dataset.fresh='1';refresh();}
  if(w&&!w.querySelector('.panel.active'))delete w.dataset.fresh;
}
function build(){
  const r=$('p-registrar'),h=$('p-historico'),m=$('p-metas');if(!r||!h||$('md-wrap'))return !!$('md-wrap');
  const w=document.createElement('section');w.id='md-wrap';
  r.before(w);w.insertAdjacentHTML('afterbegin',tabs());w.append(r,h);
  h.insertAdjacentHTML('afterbegin','<h2 class="md-h">Movimientos</h2>');
  if(m)m.insertAdjacentHTML('afterbegin',tabs());
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-md]');if(b){e.preventDefault();const to=b.dataset.md;if(typeof goPanel==='function')goPanel(to);document.body.scrollTop=0;window.scrollTo(0,0);mark();return;}
    if(e.target.closest('#save-btn')){let n=0;const t=setInterval(()=>{refresh();if(++n>8)clearInterval(t);},450);}
  });
  new MutationObserver(mark).observe($('app-screen')||document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  mark();return true;
}
if(!build()){const o=new MutationObserver(()=>{if(build())o.disconnect();});o.observe(document.documentElement,{childList:true,subtree:true});}
})();
