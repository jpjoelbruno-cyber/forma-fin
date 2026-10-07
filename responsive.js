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
})();
