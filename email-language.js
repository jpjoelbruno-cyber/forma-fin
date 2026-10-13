/* Email language is presentation metadata only. It never grants account access. */
(()=>{
 const $=id=>document.getElementById(id),valid=lang=>['es','pt'].includes(lang);
 const signup=$('s-language');let chosen;
 try{chosen=localStorage.getItem('forma-email-language');}catch{}
 signup.value=valid(chosen)?chosen:String(navigator.language||'es').toLowerCase().startsWith('pt')?'pt':'es';
 signup.onchange=()=>{if(valid(signup.value))try{localStorage.setItem('forma-email-language',signup.value);}catch{}};
 const help=$('forma-usage-choice')?.closest('dialog');if(!help)return;
 const section=document.createElement('section');section.className='email-language-settings';section.innerHTML='<hr><h3>Idioma de los correos / Idioma dos e-mails</h3><label for="email-preferred-language">Confirmación y recuperación / Confirmação e recuperação</label><select id="email-preferred-language" class="inp-simple"><option value="es">Español</option><option value="pt">Português</option></select><button id="email-save-language" class="btn-sm">Guardar idioma / Salvar idioma</button><p id="email-language-status" role="status" aria-live="polite"></p>';
 help.append(section);let saving=false,account=null;
 function reflect(u){if(account&&account===u?.id)return;account=u?.id||null;const language=u?.user_metadata?.language;$('email-preferred-language').value=valid(language)?language:signup.value;$('email-save-language').disabled=!account||!!window.FORMA_DEMO;saving=false;$('email-language-status').textContent='';}
 $('email-save-language').onclick=async()=>{
  if(saving||!account||window.FORMA_DEMO||!user)return;
  const uid=account,lang=$('email-preferred-language').value;if(!valid(lang)||uid!==user.id)return;
  const pt=lang==='pt',message=$('email-language-status'),button=$('email-save-language');saving=true;button.disabled=true;message.textContent=pt?'Salvando idioma…':'Guardando idioma…';
  try{
   const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==uid||user?.id!==uid||account!==uid)throw Error('changed');
   const r=await sb.auth.updateUser({data:{language:lang}});if(r.error||r.data?.user?.id!==uid||r.data.user.user_metadata?.language!==lang)throw Error('unconfirmed');
   if(account!==uid||user?.id!==uid)return;signup.value=lang;signup.onchange();message.textContent=pt?'Idioma salvo na sua conta.':'Idioma guardado en tu cuenta.';
  }catch{if(account===uid)message.textContent=pt?'Não foi possível confirmar. Tente novamente.':'No se pudo confirmar. Vuelve a intentarlo.';}
  finally{saving=false;if(account===uid)button.disabled=false;}
 };
 if(sb){sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')reflect(null);else if(['INITIAL_SESSION','SIGNED_IN','USER_UPDATED'].includes(event))reflect(session?.user);});}
})();
