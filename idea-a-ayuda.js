/* Idea A · Ayuda: agrupa los ajustes técnicos (medición, idioma) en "Ajustes y privacidad". Solo mueve nodos existentes; no lee ni guarda datos. */
(()=>{function tidy(){const d=document.querySelector('dialog.forma-dialog');if(!d)return;
 let b=d.querySelector('.ia-adv');
 if(!b){const hr=[...d.children].find(c=>c.tagName==='HR');if(!hr)return;b=document.createElement('details');b.className='ia-adv';const s=document.createElement('summary');s.textContent='Ajustes y privacidad';b.append(s);let n=hr.nextSibling;const rest=[];while(n){rest.push(n);n=n.nextSibling}hr.remove();rest.forEach(x=>b.append(x));d.append(b);
  const wa=d.querySelector('#forma-whatsapp');if(wa&&!wa.querySelector('svg'))wa.insertAdjacentHTML('afterbegin','<svg class="ia-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>')}
 const lang=d.querySelector(':scope>.email-language-settings');if(lang){lang.querySelector('hr')?.remove();b.append(lang)}}
 let k=0;const iv=setInterval(()=>{tidy();if(++k>60)clearInterval(iv)},500);
 document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#forma-help-button'))setTimeout(tidy,200)});})();
