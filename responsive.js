// One financial workflow; layouts are controlled by available screen width.
(() => {
  const heading = document.querySelector('#p-resumo .page-heading');
  const actions = document.createElement('div');
  actions.className = 'overview-actions';
  actions.innerHTML = '<button class="action-main" id="overview-voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>Registrar por voz</button><button class="btn-sm" id="overview-write">Escribir</button>';
  heading.after(actions);
  document.getElementById('overview-voice').onclick = () => {
    goPanel('registrar');
    const button = document.getElementById('voice-start');
    button?.scrollIntoView({behavior:'smooth',block:'center'});
    button?.focus({preventScroll:true});
  };
  document.getElementById('overview-write').onclick = () => {
    goPanel('registrar');
    const manual = document.querySelector('.manual-register');
    if (manual) {manual.open = true;manual.scrollIntoView({behavior:'smooth',block:'start'});}
  };
  const navigation = document.getElementById('bnav');
  navigation.setAttribute('role','navigation');
  navigation.setAttribute('aria-label','Navegación principal de FORMÁ');
  const update = () => navigation.querySelectorAll('.nb').forEach(button => {
    if(button.classList.contains('active'))button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  new MutationObserver(update).observe(navigation,{subtree:true,attributes:true,attributeFilter:['class']});
  update();
  // Financial editors keep their original save and close handlers.
  const workspaces = [
    ['orc-overlay','Mi presupuesto',()=>closeOrcModal()],
    ['goal-overlay','Mi meta',()=>closeGoalModal()],
    ['event-overlay','Dinero guardado',()=>document.getElementById('event-overlay').classList.remove('open')],
    ['tx-detail-overlay','Detalle del movimiento',()=>closeTxDetail()],
    ['tx-edit-overlay','Corregir movimiento',()=>closeTxEdit()]
  ];
  const editors = new Map();
  for(const [id,title,close] of workspaces){
    const root=document.getElementById(id),sheet=root.firstElementChild;
    root.classList.add('editor-workspace');
    sheet.classList.add('editor-surface');
    const header=document.createElement('div');header.className='editor-heading';
    const back=document.createElement('button');back.type='button';back.className='editor-back';back.textContent='Volver';back.setAttribute('aria-label','Volver desde '+title);
    back.onclick=async()=>{await close();};
    const label=document.createElement('h2');label.textContent=title;
    header.append(back,label);sheet.prepend(header);
    let wasOpen=false,returnFocus=null;
    const sync=()=>{
      const open=root.classList.contains('open');
      root.setAttribute('aria-hidden',String(!open));
      root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title);
      if(open&&!wasOpen){returnFocus=document.activeElement;root.scrollTop=0;back.focus({preventScroll:true});}
      if(!open&&wasOpen&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
      wasOpen=open;
    };
    new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});sync();
    editors.set(id,{root,close});
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){
        const controls=[...root.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
  }
  navigation.addEventListener('click',async event=>{
    const target=event.target.closest('.nb');
    const active=[...editors.values()].find(editor=>editor.root.classList.contains('open'));
    if(!target||!active)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(active.root.id!=='orc-overlay'&&active.root.id!=='tx-detail-overlay'){
      if(!window.confirm('¿Quieres salir de este formulario? Los cambios que aún no guardaste no se registrarán.'))return;
    }
    await active.close();
    if(active.root.classList.contains('open'))return;
    target.click();
  },true);
  // Section changes reset the reading position, while budget saves still block
  // closing until the server has confirmed them.
  const previousGoPanel=goPanel;
  goPanel=function(id){const result=previousGoPanel(id);window.scrollTo({top:0,behavior:'auto'});return result;};
})();
