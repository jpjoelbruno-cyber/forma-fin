// One financial workflow; layouts are controlled by available screen width.
(() => {
  const heading = document.querySelector('#p-resumo .page-heading');
  const actions = document.createElement('div');
  actions.className = 'overview-actions';
  actions.innerHTML = '<button class="action-main" id="overview-register">+ Registrar movimiento</button>';
  heading.after(actions);
  document.getElementById('overview-register').onclick = () => {goPanel('registrar');document.getElementById('voice-start')?.focus({preventScroll:true});};
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
  const budgetRoot=document.getElementById('orc-cats');
  let budgetColumns=0;
  function arrangeBudget(force=false){
    const count=innerWidth>=1200?3:innerWidth>=768?2:1;
    if(!force&&budgetColumns===count&&budgetRoot.querySelector('.budget-columns'))return;
    const groups=[...budgetRoot.querySelectorAll('.orc-group')];
    if(!groups.length)return;
    const focus=document.activeElement;
    const old=budgetRoot.querySelector('.budget-columns');
    const columns=document.createElement('div');columns.className='budget-columns';
    columns.style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`;
    for(let i=0;i<count;i++){const column=document.createElement('div');column.className='budget-column';columns.append(column);}
    groups.forEach((group,index)=>columns.children[index%count].append(group));
    const custom=budgetRoot.querySelector('#custom-budget-tools');
    budgetRoot.insertBefore(columns,custom||null);old?.remove();budgetColumns=count;
    if(focus?.isConnected&&focus!==document.body)focus.focus({preventScroll:true});
  }
  new MutationObserver(()=>{if([...budgetRoot.children].some(el=>el.classList.contains('orc-group')))arrangeBudget(true);}).observe(budgetRoot,{childList:true});
  window.addEventListener('resize',()=>arrangeBudget());
  // Section changes reset the reading position, while budget saves still block
  // closing until the server has confirmed them.
  const previousGoPanel=goPanel;
  goPanel=function(id){const result=previousGoPanel(id);window.scrollTo({top:0,behavior:'auto'});return result;};
})();
