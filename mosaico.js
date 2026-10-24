/* Mosaico de inicio del alumno: solo reenvía el toque a botones que ya existen. No lee ni escribe datos. */
document.addEventListener('click',e=>{const t=e.target.closest('[data-mosaico]');if(!t)return;const k=t.dataset.mosaico;let b=null;
 if(k==='inst')b=[...document.querySelectorAll('#p-more button')].find(x=>/Mi instituci/.test(x.textContent));
 else if(k==='ayuda')b=document.getElementById('forma-help-button');
 else b=document.getElementById(k);
 if(b)b.click();else if(k==='inst'){const m=document.getElementById('nb-more')||document.querySelector('[id^="nb-more"]');if(m)m.click();}});
