// Only changed fields are written; confirmed cloud saves are not browser-only storage.
(() => {
  let owner=null, period=null, timer=null, flight=null, failed=false, invalid=false;
  const pending=new Map();
  const status=text=>{document.getElementById('budget-save-status').textContent=text;};
  const isDemo=()=>window.FORMA_DEMO===true;
  function capture(){
    invalid=false;
    for(const el of document.querySelectorAll('#orc-cats input.orc-input')){
      const category=el.id.startsWith('oc-inc-')?'income:'+el.id.slice(7):el.id.slice(3);
      const value=el.value===''?0:Number(el.value);
      if(el.validity?.badInput||!Number.isFinite(value)||value<0||value>999999999){invalid=true;continue;}
      const rounded=Math.round(value*100)/100;
      if(rounded!==Number(budgets[category]||0)||pending.has(category))pending.set(category,rounded);
    }
  }
  async function flush(){
    clearTimeout(timer);
    if(isDemo())return false;
    if(invalid){status('Revisa los montos. Hay cambios sin guardar.');return false;}
    if(flight){await flight;if(failed)return false;return flush();}
    if(!pending.size)return !failed;
    if(!user||user.id!==owner||!sb){status('Tu sesión cambió. No se guardaron los cambios pendientes.');return false;}
    const batch=new Map(pending), uid=owner, savedMonth=period;
    const rows=[...batch].map(([category,planned])=>({user_id:uid,month:savedMonth,category,planned}));
    failed=false;status('Guardando en tu cuenta… No cierres esta página.');
    flight=(async()=>{
      try{
        const result=await sb.from('forma_budgets').upsert(rows,{onConflict:'user_id,month,category'});
        if(result.error)throw result.error;
        const check=await sb.from('forma_budgets').select('category,planned').eq('user_id',uid).eq('month',savedMonth).in('category',[...batch.keys()]);
        if(check.error)throw check.error;
        const saved=new Map((check.data||[]).map(r=>[r.category,Number(r.planned)]));
        if([...batch].some(([k,v])=>saved.get(k)!==v))throw new Error('Save could not be verified');
        for(const [key,value] of batch){
          if(user?.id===uid&&month===savedMonth)budgets[key]=value;
          if(pending.get(key)===value)pending.delete(key);
        }
        if(user?.id===uid&&month===savedMonth)renderResume();
        status(invalid?'Revisa los montos. Hay cambios sin guardar.':pending.size?'Hay cambios nuevos por guardar…':'✓ Guardado en tu cuenta. Disponible al volver a entrar.');
      }catch(error){failed=true;status('No se pudo confirmar el guardado. Mantén esta página abierta y pulsa Guardar y cerrar para reintentar.');console.error('Budget save failed',error);}
    })();
    await flight;flight=null;
    if(failed)return false;
    return invalid?false:pending.size?flush():true;
  }
  const previousOpen=openOrcModal;
  openOrcModal=function(){
    if(!isDemo()&&!budgetDataReady){toast('Espera a que cargue tu presupuesto. Si hay un error de conexión, vuelve a entrar antes de editar.',false);return;}
    if(pending.size||flight){status('Hay cambios pendientes. Guárdalos antes de abrir otro presupuesto.');return;}
    previousOpen();owner=user?.id;period=month;failed=false;invalid=false;
    status(isDemo()?'Ejemplo: no guarda datos. Entra a tu cuenta para guardar.':'Los cambios se guardan automáticamente con conexión. Espera la confirmación «Guardado».');
    const root=document.getElementById('orc-cats');
    root.oninput=()=>{refreshOrc();if(isDemo())return;capture();clearTimeout(timer);status(invalid?'Revisa los montos. Hay cambios sin guardar.':'Cambios pendientes…');if(!invalid)timer=setTimeout(flush,700);};
  };
  async function finish(){
    if(isDemo()){document.getElementById('orc-overlay').classList.remove('open');return;}
    if(owner!==user?.id)return;
    capture();
    if(await flush()){document.getElementById('orc-overlay').classList.remove('open');}
  }
  saveOrc=async function(){if(isDemo()){demoNotice();return;}return finish();};
  closeOrcModal=finish;
  const previousLogout=doLogout;
  doLogout=async function(){if((pending.size||flight||invalid)&&!(await flush())){toast('Guarda el presupuesto antes de salir',false);return;}return previousLogout();};
  window.addEventListener('beforeunload',event=>{if(pending.size||flight||invalid){event.preventDefault();event.returnValue='';}});
  window.addEventListener('online',()=>{if(pending.size&&!isDemo())flush();});
})();
