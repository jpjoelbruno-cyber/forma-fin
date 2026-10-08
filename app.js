// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
// Only FORMÁ's independent project is accepted. Banking stays disabled.
const SB_URL = window.FORMA_CONFIG?.supabaseUrl;
const SB_KEY = window.FORMA_CONFIG?.publishableKey;
const CONFIGURED = SB_URL === 'https://irsuevjqmgpwunvymxbc.supabase.co' &&
  !!SB_KEY;
const sb = CONFIGURED ? supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true,flowType:'pkce',storageKey:'forma-independent-auth-v1'}}) : null;
function escapeHTML(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ═══════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════
// ── GRUPOS de categorías (para presupuesto detallado) ──
const CAT_GROUPS=[
  {
    id:'servicios',l:'Servicios Básicos',i:'🏠',
    subs:[
      {id:'alquiler',l:'Alquiler / Hipoteca',i:'🏠'},
      {id:'agua',l:'Agua',i:'💧'},
      {id:'luz',l:'Luz / Energía',i:'⚡'},
      {id:'internet',l:'Internet Casa',i:'📶'},
      {id:'gas',l:'Gas',i:'🔥'},
      {id:'celular',l:'Plan Celular',i:'📱'},
      {id:'condominio',l:'Condominio',i:'🏢'},
      {id:'tv',l:'TV / Streaming',i:'📺'},
    ]
  },
  {
    id:'seguros',l:'Seguros',i:'🛡️',
    subs:[
      {id:'seg-carro',l:'Seguro Carro',i:'🚗'},
      {id:'seg-casa',l:'Seguro Casa',i:'🏡'},
      {id:'seg-vida',l:'Seguro de Vida',i:'❤️'},
      {id:'seg-salud',l:'Seguro de Salud',i:'🏥'},
      {id:'parcela-carro',l:'Parcela Carro',i:'🚘'},
      {id:'parcela-casa',l:'Parcela Casa',i:'🏘️'},
    ]
  },
  {
    id:'alimentacion',l:'Alimentación Hogar',i:'🛒',
    subs:[
      {id:'supermercado',l:'Supermercado / Atacado',i:'🛒'},
      {id:'carne',l:'Carne / Pescado',i:'🥩'},
      {id:'verduras',l:'Verduras / Legumbres',i:'🥦'},
      {id:'frutas',l:'Frutas',i:'🍎'},
      {id:'panaderia',l:'Pan / Panadería',i:'🍞'},
      {id:'lacteos',l:'Lácteos / Huevos',i:'🥚'},
      {id:'bebidas',l:'Bebidas / Agua',i:'🧃'},
      {id:'snacks',l:'Snacks / Varios',i:'🍫'},
    ]
  },
  {
    id:'educacion',l:'Educación',i:'📚',
    subs:[
      {id:'universidad',l:'Universidad / Cursos',i:'🎓'},
      {id:'materiales',l:'Materiales / Libros',i:'📖'},
      {id:'transp-estud',l:'Transporte Estudiante',i:'🎒'},
      {id:'idiomas',l:'Idiomas',i:'🌎'},
      {id:'capacitacion',l:'Capacitación / Online',i:'💻'},
    ]
  },
  {
    id:'ocio',l:'Ocio & Lazer',i:'🎉',
    subs:[
      {id:'restaurantes',l:'Restaurantes / Delivery',i:'🍽️'},
      {id:'cine',l:'Cine / Teatro',i:'🎬'},
      {id:'eventos',l:'Eventos / Shows',i:'🎤'},
      {id:'viajes',l:'Viajes / Vacaciones',i:'✈️'},
      {id:'estacionamiento',l:'Estacionamiento / Peaje',i:'🅿️'},
      {id:'hobbies',l:'Hobbies',i:'🎨'},
      {id:'juegos',l:'Juegos / Apps',i:'🎮'},
      {id:'bar',l:'Bar / Salidas',i:'🍻'},
    ]
  },
  {
    id:'cuidado',l:'Cuidado Personal',i:'💆',
    subs:[
      {id:'peluqueria',l:'Peluquería / Barbería',i:'💇'},
      {id:'salon',l:'Salón de Belleza',i:'💅'},
      {id:'academia',l:'Academia / Gym',i:'🏋️'},
      {id:'farmacia',l:'Farmacia / Medicamentos',i:'💊'},
      {id:'dentista',l:'Dentista',i:'🦷'},
      {id:'medico',l:'Médico / Consultas',i:'🩺'},
      {id:'estetica',l:'Estética / Spa',i:'✨'},
      {id:'higiene',l:'Higiene Personal',i:'🧴'},
    ]
  },
  {
    id:'compras',l:'Compras Personales',i:'🛍️',
    subs:[
      {id:'ropa',l:'Ropa / Calzados',i:'👗'},
      {id:'zapatos',l:'Zapatos',i:'👟'},
      {id:'electronico',l:'Electrónicos',i:'📱'},
      {id:'muebles',l:'Muebles / Decoración',i:'🛋️'},
      {id:'juguetes',l:'Juguetes / Niños',i:'🧸'},
      {id:'accesorios',l:'Accesorios',i:'👜'},
      {id:'online',l:'Compras Online',i:'📦'},
    ]
  },
  {
    id:'transporte',l:'Transporte',i:'🚌',
    subs:[
      {id:'gasolina',l:'Gasolina / Combustible',i:'⛽'},
      {id:'uber',l:'Uber / Cabify',i:'🚖'},
      {id:'taxi',l:'Taxi',i:'🚕'},
      {id:'mecanica',l:'Mecánica / Mantenimiento',i:'🔧'},
      {id:'bus',l:'Bus / Metro / Tren',i:'🚌'},
      {id:'lavado',l:'Lavado de Carro',i:'🚿'},
      {id:'multa',l:'Multas / IPVA',i:'📋'},
    ]
  },
  {
    id:'regalos',l:'Regalos & Donaciones',i:'🎁',
    subs:[
      {id:'cumpleanos',l:'Cumpleaños / Regalos',i:'🎂'},
      {id:'ofrendas',l:'Ofrendas / Diezmos',i:'🙏'},
      {id:'donaciones',l:'Donaciones',i:'❤️‍🔥'},
      {id:'mascotas',l:'Mascotas / Animales',i:'🐾'},
      {id:'vet',l:'Veterinaria',i:'🐕'},
      {id:'mascotas-higiene',l:'Higiene Animal',i:'🛁'},
      {id:'navidad',l:'Navidad / Fiestas',i:'🎄'},
    ]
  },
  {
    id:'finanzas',l:'Finanzas & Deudas',i:'💳',
    subs:[
      {id:'tarjeta',l:'Tarjeta de Crédito',i:'💳'},
      {id:'prestamo',l:'Préstamo / Financiamiento',i:'🏦'},
      {id:'ahorro',l:'Ahorro / Inversión',i:'💰'},
      {id:'impuestos',l:'Impuestos / Tasas',i:'📄'},
      {id:'pension',l:'Pensión / INSS',i:'👴'},
    ]
  },
  {
    id:'hogar',l:'Hogar & Casa',i:'🏠',
    subs:[
      {id:'limpieza',l:'Limpieza / Productos',i:'🧹'},
      {id:'reparacion',l:'Reparaciones',i:'🔨'},
      {id:'jardin',l:'Jardín / Plantas',i:'🌱'},
      {id:'electrodomesticos',l:'Electrodomésticos',i:'🫙'},
      {id:'empleada',l:'Empleada / Servicios',i:'🧺'},
    ]
  },
  {
    id:'trabajo',l:'Trabajo & Negocio',i:'💼',
    subs:[
      {id:'equipo-trabajo',l:'Equipo de Trabajo',i:'🖥️'},
      {id:'oficina',l:'Oficina / Coworking',i:'🏢'},
      {id:'herramientas',l:'Herramientas / Software',i:'⚙️'},
      {id:'marketing',l:'Marketing / Publicidad',i:'📣'},
      {id:'contador',l:'Contador / Asesoría',i:'📊'},
    ]
  },
  {
    id:'hormiga',l:'Gastos Hormiga 🐜',i:'🐜',
    subs:[
      {id:'cafe',l:'Café / Cafetería',i:'☕'},
      {id:'golosinas',l:'Golosinas / Dulces',i:'🍬'},
      {id:'cigarros',l:'Cigarros / Tabaco',i:'🚬'},
      {id:'loteria',l:'Lotería / Apuestas',i:'🎰'},
      {id:'propinas',l:'Propinas',i:'💸'},
      {id:'vending',l:'Máquina / Kiosco',i:'🎪'},
      {id:'app-sub',l:'Suscripciones Apps',i:'📲'},
      {id:'impulso',l:'Compra Impulsiva',i:'😅'},
      {id:'perdido',l:'Dinero Perdido / No sé',i:'🤷'},
      {id:'minucias',l:'Gastos Pequeños Varios',i:'🐜'},
    ]
  },
];

// Lista plana para compatibilidad con el resto del código
const EXP_CATS = CAT_GROUPS.flatMap(g => g.subs);
const INC_CATS=[
  {id:'salario',l:'Salario / Sueldo',i:'💼'},
  {id:'freelance',l:'Freelance / Servicios',i:'💻'},
  {id:'negocio',l:'Pró-labore recibido',i:'💼'},
  {id:'inversion',l:'Rendimientos recibidos',i:'📈'},
  {id:'alquiler-i',l:'Alquiler (ingreso)',i:'🏠'},
  {id:'pension-i',l:'Pensión / Jubilación',i:'👴'},
  {id:'bono',l:'Bono / Premio',i:'🎯'},
  {id:'otros-i',l:'Otros Ingresos',i:'💵'},
];
function catInfo(type,id){
  return[...EXP_CATS,...INC_CATS].find(c=>c.id===id)||{i:'💰',l:id||'—'};
}

// ═══════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════
let user=null, profile=null;
let month=todayMonth();
let annualYear=Number(month.slice(0,4));
let txs=[], budgets={}, budgetDataReady=false;
let txFilter=null, txType='expense', selCat='supermercado';
let connItems=[];

// ═══════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════
function fmt(v){return'R$ '+Number(v||0).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2})}
function todayMonth(){return new Date().toISOString().slice(0,7)}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function initials(n){return(n||'?').trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')}
function monthLabel(m){
  const[y,mo]=m.split('-');
  return['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][+mo-1]+' '+y;
}
function toast(msg,ok=true){
  const el=document.getElementById('toast-el');
  el.textContent=msg;el.style.background=ok?'#1F2937':'#DC2626';
  el.classList.add('show');clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),2800);
}
function showEl(id,type='flex'){document.getElementById(id).style.display=type}
function hideEl(id){document.getElementById(id).style.display='none'}

// ═══════════════════════════════════════════════════
// AUTENTICACIÓN
// ═══════════════════════════════════════════════════
function switchTab(tab){
  if(passwordRecoveryActive)return;
  for(const id of ['recovery-form','password-form'])hideEl(id);
  document.getElementById('login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('signup-form').style.display=tab==='signup'?'block':'none';
  document.querySelectorAll('.at').forEach((b,i)=>b.classList.toggle('active',(tab==='login'&&i===0)||(tab==='signup'&&i===1)));
}
function togglePwd(id,btn){
  const inp=document.getElementById(id);
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.textContent=show?'🙈':'👁';
}

async function doGoogleAuth(){
  try{
    const{error}=await sb.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo: 'https://forma-fin.vercel.app/',
        scopes: 'openid email profile',
        queryParams: {prompt:'select_account'}
      }
    });
    if(error)throw error;
  }catch(e){
    toast('Error con Google: '+e.message,false);
  }
}

let passwordRecoveryActive=false;
function authMessage(id,text,ok=false){
  const el=document.getElementById(id);el.textContent=text;
  el.className='auth-msg '+(ok?'auth-ok':'auth-err');el.style.display='block';
}
function authError(e){
  if(e.message==='Invalid login credentials')return 'Correo o contraseña incorrectos. Puedes recuperar tu contraseña.';
  if(e.message==='Email not confirmed')return 'Confirma tu correo antes de entrar. Revisa también spam.';
  if(/rate|too many/i.test(e.message||''))return 'Espera unos minutos antes de intentarlo otra vez.';
  return 'No pudimos completar la solicitud. Inténtalo de nuevo; si continúa, comunícate con FORMÁ.';
}
async function doLogin(){
  const email=document.getElementById('l-email').value.trim();
  const password=document.getElementById('l-pass').value;
  hideEl('login-err');
  if(!email||!password){authMessage('login-err','Ingresa correo y contraseña');return;}
  const btn=document.getElementById('btn-login');btn.disabled=true;btn.textContent='Entrando…';
  try{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;}
  catch(e){authMessage('login-err',authError(e));}
  finally{btn.disabled=false;btn.textContent='Entrar';}
}
async function doSignup(){
  const name=document.getElementById('s-name').value.trim();
  const email=document.getElementById('s-email').value.trim();
  const password=document.getElementById('s-pass').value;
  hideEl('signup-err');hideEl('signup-ok');
  if(!name||!email||!password){authMessage('signup-err','Completa nombre, correo y contraseña');return;}
  if(password.length<8){authMessage('signup-err','Usa al menos 8 caracteres');return;}
  const btn=document.getElementById('btn-signup');btn.disabled=true;btn.textContent='Creando cuenta…';
  try{
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:'https://forma-fin.vercel.app/'}});
    if(error)throw error;
    if(!data.session)authMessage('signup-ok','Revisa tu correo para confirmar tu cuenta. Después FORMÁ validará tu acceso como alumno.',true);
  }catch(e){authMessage('signup-err',authError(e));}
  finally{btn.disabled=false;btn.textContent='Crear cuenta';}
}
function showRecoveryRequest(){
  switchTab('recovery');showEl('recovery-form');
  document.getElementById('r-email').value=document.getElementById('l-email').value;
  document.getElementById('r-email').focus();
}
async function sendPasswordReset(){
  const email=document.getElementById('r-email').value.trim();
  if(!document.getElementById('r-email').checkValidity()||!email){authMessage('recovery-msg','Escribe un correo válido');return;}
  const btn=document.getElementById('auth-send-reset');btn.disabled=true;
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:'https://forma-fin.vercel.app/'});
    if(error)throw error;
    authMessage('recovery-msg','Si el correo está registrado, recibirás un enlace. Revisa también spam y ábrelo en este navegador.',true);
  }catch(e){authMessage('recovery-msg',authError(e));}
  finally{btn.disabled=false;}
}
function showPasswordRecovery(){
  passwordRecoveryActive=true;user=null;profile=null;
  hideEl('loading-screen');hideEl('app-screen');showEl('auth-screen');
  for(const id of ['login-form','signup-form','recovery-form'])hideEl(id);
  showEl('password-form');document.getElementById('r-pass').focus();
}
async function saveRecoveredPassword(){
  if(!passwordRecoveryActive)return;
  const password=document.getElementById('r-pass').value;
  if(password.length<8){authMessage('password-msg','Usa al menos 8 caracteres');return;}
  if(password!==document.getElementById('r-confirm').value){authMessage('password-msg','Las contraseñas no coinciden');return;}
  const btn=document.getElementById('auth-update-password');btn.disabled=true;
  try{
    const {error}=await sb.auth.updateUser({password});if(error)throw error;
    await sb.auth.signOut({scope:'local'});passwordRecoveryActive=false;
    document.getElementById('r-pass').value='';document.getElementById('r-confirm').value='';
    switchTab('login');authMessage('login-err','Contraseña guardada. Entra con tu correo y tu nueva contraseña.',true);
  }catch(e){authMessage('password-msg',authError(e));}
  finally{btn.disabled=false;}
}
document.getElementById('auth-retry').addEventListener('click',()=>location.reload());
document.getElementById('auth-change').addEventListener('click',doLogout);
document.getElementById('auth-forgot').addEventListener('click',showRecoveryRequest);
document.getElementById('auth-back').addEventListener('click',()=>switchTab('login'));
document.getElementById('auth-send-reset').addEventListener('click',sendPasswordReset);
document.getElementById('auth-update-password').addEventListener('click',saveRecoveredPassword);

async function doLogout(){
  await sb.auth.signOut({scope:'local'});
  document.getElementById('pending-actions').hidden=true;
  const demo=document.querySelector('.demo-entry');if(demo)demo.hidden=false;
  user=null;profile=null;
  hideEl('app-screen');
  showEl('auth-screen');
}

// ═══════════════════════════════════════════════════
// SESIÓN
// ═══════════════════════════════════════════════════
let authRevision=0;
if(sb) sb.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session?.user)passwordRecoveryActive=true;
  const revision=++authRevision;
  // Supabase data calls must run after the auth callback has returned.
  setTimeout(async()=>{
    if(window.FORMA_DEMO)return;
    if(passwordRecoveryActive){showPasswordRecovery();return;}
    if(revision!==authRevision)return;
    if(session?.user){
      const keepWorkspace=user?.id===session.user.id&&Boolean(profile)&&document.getElementById('app-screen').style.display!=='none';
      user=session.user;
      try{
        await loadProfile();
        if(revision!==authRevision)return;
        // Focus and token refresh revalidate access without rebuilding open forms.
        if(!keepWorkspace)showApp();
      }catch(e){
        if(revision!==authRevision)return;
        hideEl('loading-screen');showEl('auth-screen');
        const message=document.getElementById('login-err');
        hideEl('app-screen');profile=null;user=null;
        message.textContent=['FORMA_ACCESS_PENDING','FORMA_RECOVERY_FAILED'].includes(e.code) ? e.message : 'No pudimos verificar tu acceso a FORMÁ. Vuelve a intentarlo; tus datos no se borraron.';
        switchTab('login');
        message.style.display='block';
        document.getElementById('pending-actions').hidden=e.code!=='FORMA_ACCESS_PENDING';
        const demo=document.querySelector('.demo-entry');if(demo)demo.hidden=true;
        console.error('Profile load failed',e);
      }
    }else{
      user=null;profile=null;
      hideEl('loading-screen');hideEl('app-screen');showEl('auth-screen');
    }
  },0);
});

if(sb) sb.auth.getSession().then(({data:{session}})=>{
  if(window.FORMA_DEMO)return;
  if(!session){hideEl('loading-screen');showEl('auth-screen');}
});
else {
  hideEl('loading-screen');showEl('auth-screen');
  for(const id of ['btn-login','btn-signup','bank-btn']) document.getElementById(id).disabled=true;
  document.querySelectorAll('.btn-google').forEach(button=>button.disabled=true);
  const message=document.getElementById('login-err');
  message.textContent='FORMÁ está preparando su base independiente. El acceso estará disponible después de la configuración segura.';
  message.style.display='block';
}

async function loadProfile(){
  const accessUid=user?.id;
  const recovered=await sb.rpc('forma_restore_legacy');
  if(user?.id!==accessUid)throw new Error('Session changed');
  if(recovered.error){
    const failure=new Error('No pudimos recuperar tus datos anteriores. Están conservados. Comunícate con FORMÁ antes de volver a registrar tu presupuesto.');
    failure.code='FORMA_RECOVERY_FAILED';throw failure;
  }
  const access=await sb.rpc('forma_access_status');
  if(user?.id!==accessUid)throw new Error('Session changed');
  if(access.error)throw access.error;
  if(access.data?.status!=='active'){
    const ref=String(access.data?.reference||accessUid||'').slice(0,8);
    const denied=new Error('Tu acceso a FORMÁ está pendiente de validación. Comunícate con FORMÁ Educacional y comparte tu referencia: '+ref+'. No se borraron tus datos.');
    denied.code='FORMA_ACCESS_PENDING';throw denied;
  }
  let{data,error}=await sb.from('forma_profiles').select('*').eq('id',user.id).maybeSingle();
  if(error)throw error;
  if(!data){
    const meta=user.user_metadata||{};
    const name=meta.full_name||user.email.split('@')[0];
    const inserted=await sb.from('forma_profiles').insert({id:user.id,full_name:name});
    if(inserted.error && inserted.error.code!=='23505')throw inserted.error;
    const r2=await sb.from('forma_profiles').select('*').eq('id',user.id).single();
    if(r2.error)throw r2.error;
    data=r2.data;
  }
  profile=data;
}

// ═══════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════
function showApp(){
  hideEl('loading-screen');
  hideEl('auth-screen');
  showEl('app-screen');
  const name=(profile?.full_name||user.email).split(' ')[0];
  document.getElementById('tb-greeting').textContent='Hola, '+name+'!';
  document.getElementById('tb-role').textContent=profile?.role==='teacher'?'👨‍🏫 Profesor · FORMA EDUCACIONAL':'🎓 Alumno · FORMA EDUCACIONAL';
  document.getElementById('tb-avatar').textContent=initials(profile?.full_name||user.email);
  if(profile?.role==='teacher'){
    document.getElementById('nb-alunos').style.display='flex';
    document.getElementById('inv-code').textContent=profile.invite_code||'Solicita un código al administrador';
  }
  document.getElementById('month-label').textContent=monthLabel(month);
  document.getElementById('tx-date').value=todayStr();
  renderQuickCats();
  renderAllCats();
  loadMonthData();
  loadConnItems();
  renderGoals();
  setTimeout(()=>renderEvoChart(),600);
  // Onboarding solo si es primer ingreso
  const obDone=localStorage.getItem('forma_ob_done_'+user.id);
  if(!obDone) setTimeout(()=>initOnboarding(),800);
}

// ═══════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════
function goPanel(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.getElementById('p-'+id).classList.add('active');
  document.getElementById('nb-'+id).classList.add('active');
  if(id==='resumo'){renderResume();setTimeout(()=>renderEvoChart(),300);renderGoals();}
  if(id==='historico') renderTxList();
  if(id==='anual') loadAnnualData();
  if(id==='alunos') loadStudents();
}

// ═══════════════════════════════════════════════════
// MES
// ═══════════════════════════════════════════════════
function changeMonth(dir){
  let[y,m]=month.split('-').map(Number);
  m+=dir;if(m>12){m=1;y++}if(m<1){m=12;y--}
  month=y+'-'+String(m).padStart(2,'0');
  document.getElementById('month-label').textContent=monthLabel(month);
  loadMonthData();
}

function changeAnnualYear(dir){
  annualYear+=dir;
  loadAnnualData();
}

async function loadAnnualData(){
  document.getElementById('annual-year-label').textContent=String(annualYear);
  const el=document.getElementById('annual-list');
  el.textContent='Cargando el año...';
  const year=annualYear;
  let transactions=[],offset=0;
  for(;;){
    const {data,error}=await sb.from('forma_transactions').select('id,date,type,amount')
      .eq('user_id',user.id).gte('date',year+'-01-01').lt('date',(year+1)+'-01-01')
      .order('id').range(offset,offset+999);
    if(error){el.textContent='No pudimos cargar los movimientos del año.';return;}
    transactions.push(...data);
    if(data.length<1000)break;
    offset+=1000;
  }
  const {data:plans,error:budgetError}=await sb.from('forma_budgets')
    .select('month,category,planned').eq('user_id',user.id)
    .gte('month',year+'-01').lte('month',year+'-12').range(0,1999);
  if(budgetError){el.textContent='No pudimos cargar los presupuestos del año.';return;}
  const names=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const rows=names.map((name,i)=>{
    const key=year+'-'+String(i+1).padStart(2,'0');
    const tx=transactions.filter(t=>t.date?.slice(0,7)===key);
    const plan=plans.filter(p=>p.month===key);
    const realIncome=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const realExpense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const plannedIncome=plan.filter(p=>p.category.startsWith('income:')).reduce((s,p)=>s+Number(p.planned),0);
    const plannedExpense=plan.filter(p=>!p.category.startsWith('income:')).reduce((s,p)=>s+Number(p.planned),0);
    return {name,key,realIncome,realExpense,plannedIncome,plannedExpense};
  });
  el.innerHTML=rows.map(r=>`<div style="padding:12px 0;border-bottom:1px solid var(--border2)">
    <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px"><span>${r.name}</span>
      <span style="color:${r.realIncome-r.realExpense<0?'var(--red)':'var(--green)'}">Saldo ${fmt(r.realIncome-r.realExpense)}</span></div>
    <div style="font-size:13px;color:var(--text2);line-height:1.6">Ingresos: ${fmt(r.realIncome)} de ${fmt(r.plannedIncome)} previstos<br>
      Gastos: ${fmt(r.realExpense)} de ${fmt(r.plannedExpense)} previstos</div>
  </div>`).join('');
}

// ═══════════════════════════════════════════════════
// DATOS
// ═══════════════════════════════════════════════════
async function loadMonthData(){
  budgetDataReady=false;
  const loadingUser=user.id, loadingMonth=month;
  const [y,m]=month.split('-').map(Number);
  const nextMonth=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7);
  const[{data:t,error:txError},{data:b,error:budgetError}]=await Promise.all([
    sb.from('forma_transactions').select('*').eq('user_id',user.id)
      .gte('date',month+'-01').lt('date',nextMonth+'-01').order('date',{ascending:false}),
    sb.from('forma_budgets').select('*').eq('user_id',user.id).eq('month',month)
  ]);
  if(txError||budgetError){
    toast('No se pudieron cargar tus datos. Intenta de nuevo.',false);
    console.error('Budget load failed',txError||budgetError);
    return;
  }
  if(user?.id!==loadingUser||month!==loadingMonth)return;
  txs=t||[];
  budgets={};(b||[]).forEach(r=>{budgets[r.category]=r.planned});
  try { await loadPersonalCategories(loadingUser); } catch(e) { toast("No se pudieron cargar tus gastos personalizados. Intenta de nuevo.",false); return; }
  if(user?.id!==loadingUser||month!==loadingMonth)return;
  budgetDataReady=true;
  renderResume();
  renderTxList();
}

// ═══════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════
function renderResume(){
  const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const bal=inc-exp;
  document.getElementById('hero-bal').textContent=fmt(bal);
  document.getElementById('hero-sub').textContent=fmt(inc)+' de ingresos · '+fmt(exp)+' gastado';
  document.getElementById('s-inc').textContent=fmt(inc);
  document.getElementById('s-exp').textContent=fmt(exp);
  document.getElementById('hero-card').classList.toggle('negative',bal<0);
  const plannedIncome=INC_CATS.reduce((sum,c)=>sum+Number(budgets['income:'+c.id]||0),0);
  const plannedExpense=EXP_CATS.reduce((sum,c)=>sum+Number(budgets[c.id]||0),0);
  const variance=plannedExpense-exp;
  const summary=document.getElementById('budget-summary');
  summary.innerHTML=`<div class="statgrid" style="margin:0 0 10px">
    <div class="stat"><div class="stat-label">Ingreso previsto</div><div class="stat-val">${fmt(plannedIncome)}</div></div>
    <div class="stat"><div class="stat-label">Gasto previsto</div><div class="stat-val">${fmt(plannedExpense)}</div></div>
  </div><p style="margin:0;color:var(--text2);font-size:14px">Ingreso real: ${fmt(inc)} · Gasto real: ${fmt(exp)}</p>
  <p style="margin:8px 0 0;font-weight:700;color:${variance<0?'var(--red)':'var(--green)'}">
    ${variance<0?'Gastaste más que lo previsto por '+fmt(-variance):'Queda en el plan de gastos: '+fmt(variance)}
  </p><p style="margin:8px 0 0;color:var(--text2);font-size:12px">Este cálculo depende de lo registrado; no es el saldo del banco.</p>`;

  const bycat={};
  txs.filter(t=>t.type==='expense').forEach(t=>{bycat[t.category]=(bycat[t.category]||0)+Number(t.amount)});
  const cats=Object.keys(bycat).sort((a,b)=>bycat[b]-bycat[a]);
  const cb=document.getElementById('cat-breakdown');
  cb.innerHTML=cats.length?cats.map(c=>{
    const ci=EXP_CATS.find(x=>x.id===c)||{i:'📦',l:c};
    const spent=bycat[c],pl=budgets[c]||0;
    const pct=pl>0?Math.min(100,spent/pl*100):0;
    const cls=pl>0&&spent>pl?'pf-r':pct>80?'pf-y':'pf-g';
    return`<div class="prog">
      <div class="prog-header"><span class="pname">${escapeHTML(ci.i)} ${escapeHTML(ci.l)}</span><span class="pamt">${fmt(spent)}${pl?` / ${fmt(pl)}`:''}</span></div>
      ${pl?`<div class="prog-track"><div class="prog-fill ${cls}" style="width:${pct}%"></div></div>`:''}
    </div>`;
  }).join(''):'<div class="empty"><div class="ei">📝</div><p>Sin gastos este mes.<br>Toca ➕ para registrar.</p></div>';

  const rt=document.getElementById('recent-txs');
  rt.innerHTML=txs.slice(0,4).map(txHTML).join('')||'<div class="empty"><p>Ninguna transacción aún</p></div>';
}

function txHTML(t){
  const c=catInfo(t.type,t.category);
  return`<div class="tx" style="cursor:pointer" data-tx-id="${escapeHTML(t.id)}">
    <div class="tx-icon ${t.type==='income'?'i':'e'}">${escapeHTML(c.i)}</div>
    <div class="tx-body">
      <div class="tx-desc">${escapeHTML(t.description||c.l)}</div>
      <div class="tx-meta">${escapeHTML(c.l)} · ${escapeHTML(t.date)}</div>
    </div>
    <div class="tx-amt ${t.type==='income'?'i':'e'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
  </div>`;
}
document.addEventListener('click',event=>{
  const item=event.target.closest('[data-tx-id]');
  if(item){const tx=txs.find(t=>String(t.id)===item.dataset.txId);if(tx)openTxDetail(tx);}
});

function setFilter(type,btn){
  txFilter=type;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  renderTxList();
}
function renderTxList(){
  const list=txFilter?txs.filter(t=>t.type===txFilter):txs;
  const el=document.getElementById('tx-list');
  el.innerHTML=list.length?'<div class="card">'+list.map(txHTML).join('')+'</div>':
    '<div class="empty"><div class="ei">📭</div><p>Ninguna transacción encontrada</p></div>';
}

// ═══════════════════════════════════════════════════
// REGISTRAR — diseño simple
// ═══════════════════════════════════════════════════

// Categorías que aparecen directamente (las más usadas)
const QUICK_EXP=[
  {id:'supermercado',l:'Mercado',i:'🛒'},
  {id:'restaurantes',l:'Comida',i:'🍽️'},
  {id:'gasolina',l:'Gasolina',i:'⛽'},
  {id:'luz',l:'Luz',i:'⚡'},
  {id:'uber',l:'Uber',i:'🚖'},
  {id:'farmacia',l:'Farmacia',i:'💊'},
  {id:'cafe',l:'Café',i:'☕'},
  {id:'celular',l:'Celular',i:'📱'},
  {id:'ropa',l:'Ropa',i:'👗'},
  {id:'academia',l:'Gym',i:'🏋️'},
  {id:'impulso',l:'Impulso',i:'😅'},
  {id:'alquiler',l:'Alquiler',i:'🏠'},
];
const QUICK_INC=[
  {id:'salario',l:'Salario',i:'💼'},
  {id:'freelance',l:'Freelance',i:'💻'},
  {id:'negocio',l:'Pró-labore',i:'💼'},
  {id:'bono',l:'Bono',i:'🎯'},
  {id:'inversion',l:'Inversión',i:'📈'},
  {id:'alquiler-i',l:'Alquiler',i:'🏠'},
  {id:'pension-i',l:'Pensión',i:'👴'},
  {id:'otros-i',l:'Otros',i:'💵'},
];

function updateAmtDisplay(v){
  const el=document.getElementById('amt-display');
  if(!v||parseFloat(v)===0){el.textContent='0,00';el.classList.add('empty');}
  else{el.textContent=parseFloat(v).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});el.classList.remove('empty');}
}

function setTxType(type){
  txType=type;
  document.getElementById('tt-e').className='rtype-btn gas'+(type==='expense'?' active':'');
  document.getElementById('tt-i').className='rtype-btn ing'+(type==='income'?' active':'');
  selCat=type==='expense'?'supermercado':'salario';
  // cerrar "ver todas"
  document.getElementById('all-cats-wrap').classList.remove('open');
  document.getElementById('ver-todas-btn').textContent='＋ Ver todas las categorías';
  renderQuickCats();
  renderAllCats();
}

function selQuickCat(id){
  selCat=id;
  renderQuickCats();
  renderAllCats();
}

function renderQuickCats(){
  const cats=txType==='income'?QUICK_INC:QUICK_EXP;
  document.getElementById('quick-cats').innerHTML=cats.map(c=>`
    <button class="qcat${c.id===selCat?' active':''}" data-forma-click="72" data-forma-arg0="${c.id}">
      <span class="qi">${c.i}</span>${escapeHTML(c.l)}
    </button>`).join('');
}

let allCatsOpen=false;
function toggleAllCats(){
  allCatsOpen=!allCatsOpen;
  const wrap=document.getElementById('all-cats-wrap');
  const btn=document.getElementById('ver-todas-btn');
  wrap.classList.toggle('open',allCatsOpen);
  btn.textContent=allCatsOpen?'▲ Ocultar categorías':'＋ Ver todas las categorías';
  if(allCatsOpen) renderAllCats();
}

function renderAllCats(){
  const wrap=document.getElementById('all-cats-wrap');
  if(!wrap.classList.contains('open')) return;
  const groups=txType==='income'
    ?[{id:'ingresos',l:'Ingresos',i:'💵',subs:INC_CATS}]
    :CAT_GROUPS;
  wrap.innerHTML=groups.map(g=>`
    <div class="all-cats-section">
      <div class="acs-header">${g.i} ${g.l}</div>
      <div class="acs-grid">
        ${g.subs.map(c=>`
          <button class="acat${c.id===selCat?' active':''}" data-forma-click="73" data-forma-arg0="${c.id}">
            <span class="ai">${c.i}</span>${escapeHTML(c.l)}
          </button>`).join('')}
      </div>
    </div>`).join('');
}

// renderCatGrid kept for compat (budget modal still uses CAT_GROUPS)
function renderCatGrid(){ renderQuickCats(); }

async function saveTx(){
  const amt=parseFloat(document.getElementById('tx-amt').value);
  const desc=document.getElementById('tx-desc').value.trim();
  const date=document.getElementById('tx-date').value;
  if(!amt||amt<=0){
    document.getElementById('tx-amt').focus();
    document.getElementById('amt-display').style.animation='shake .3s';
    setTimeout(()=>document.getElementById('amt-display').style.animation='',400);
    toast('Ingresa el monto primero',false);return;
  }
  if(!date){toast('Selecciona la fecha',false);return}
  const btn=document.getElementById('save-btn');
  btn.disabled=true;btn.textContent='...';
  const{error}=await sb.from('forma_transactions').insert({
    user_id:user.id,date,description:desc||null,
    amount:amt,type:txType,category:selCat,source:'manual'
  });
  if(error){toast('Error: '+error.message,false);}
  else{
    toast('✅ ¡Guardado!');
    document.getElementById('tx-amt').value='';
    document.getElementById('amt-display').textContent='0,00';
    document.getElementById('amt-display').classList.add('empty');
    document.getElementById('tx-desc').value='';
    // mantener categoría seleccionada — no resetear
  }
  btn.disabled=false;btn.textContent='✓ Guardar';
  if(!error&&date.slice(0,7)===month) await loadMonthData();
}

// ═══════════════════════════════════════════════════
// PRESUPUESTO MODAL
// ═══════════════════════════════════════════════════
function openOrcModal(){
  const spent={};
  txs.filter(t=>t.type==='expense').forEach(t=>{spent[t.category]=(spent[t.category]||0)+Number(t.amount)});
  document.getElementById('orc-month-sub').textContent='Presupuesto para '+monthLabel(month);
  document.getElementById('orc-cats').innerHTML=`<div class="orc-group-hdr">💰 Ingresos previstos</div>
    ${INC_CATS.map(c=>`<div class="orc-row"><span class="orc-label">${c.i} ${escapeHTML(c.l)}</span>
      <input class="orc-input" type="number" id="oc-inc-${c.id}" placeholder="0" value="${budgets['income:'+c.id]||''}" min="0" step="0.01" inputmode="decimal"></div>`).join('')}
    <div class="orc-group-hdr">💸 Gastos previstos</div>`+CAT_GROUPS.map(g=>`
    <div class="orc-group-hdr">${g.i} ${g.l}</div>
    ${g.subs.map(c=>`
    <div class="orc-row">
      <span class="orc-label">${c.i} ${escapeHTML(c.l)}</span>
      <span class="orc-spent">${spent[c.id]?fmt(spent[c.id]):''}</span>
      <input class="orc-input" type="number" id="oc-${c.id}" placeholder="0" value="${budgets[c.id]||''}" min="0" step="0.01" inputmode="decimal">
    </div>`).join('')}
  `).join('');
  document.getElementById('orc-overlay').classList.add('open');
}
function closeOrcModal(){document.getElementById('orc-overlay').classList.remove('open')}

async function saveOrc(){
  const categories=[...INC_CATS.map(c=>({key:'income:'+c.id,input:'oc-inc-'+c.id})),
    ...EXP_CATS.map(c=>({key:c.id,input:'oc-'+c.id}))];
  const rows=[];
  for(const c of categories){
    const raw=document.getElementById(c.input).value;
    const value=raw===''?0:Number(raw);
    if(!Number.isFinite(value)||value<0||value>999999999){toast('Revisa los montos del presupuesto',false);return;}
    rows.push({user_id:user.id,month,category:c.key,planned:Math.round(value*100)/100});
  }
  const{error}=await sb.from('forma_budgets').upsert(rows,{onConflict:'user_id,month,category'});
  if(error){toast('Error al guardar presupuesto',false);console.error(error);return}
  rows.forEach(r=>{budgets[r.category]=r.planned});
  toast('✅ ¡Presupuesto guardado!');
  closeOrcModal();
  renderResume();
}

// ═══════════════════════════════════════════════════
// BANCO — bloqueado hasta disponer de integración segura en el servidor
// ═══════════════════════════════════════════════════
async function loadConnItems(){
  renderBankPanel();
}

function renderBankPanel(){
  const el=document.getElementById('bank-accs');
  const syncBtn=document.getElementById('sync-btn');
  const banner=document.getElementById('bank-banner');
  banner.className='info-banner';
  banner.textContent='La conexión bancaria está temporalmente deshabilitada. Puedes probar los registros manuales sin conectar cuentas reales.';
  banner.style.display='block';
  el.textContent='Las cuentas bancarias estarán disponibles después de las pruebas de seguridad.';
  syncBtn.style.display='none';
}

async function connectBank(){
  toast('Conexión bancaria deshabilitada hasta completar la integración segura',false);
}
async function syncBanks(){
  toast('Sincronización bancaria deshabilitada',false);
}

function autoCat(d,t){
  if(t!=='DEBIT')return'salario';
  d=(d||'').toLowerCase();
  if(/ifood|restaurante|lanche|pizza|mercado|padaria|comida|supermercado/.test(d))return'alimentacion';
  if(/uber|99|taxi|onibus|metro|gasolina|posto|combustivel/.test(d))return'transporte';
  if(/aluguel|condominio|luz|energia|agua|gas|iptu/.test(d))return'vivienda';
  if(/farmacia|medico|hospital|clinica|plano|saude/.test(d))return'salud';
  if(/escola|faculdade|curso|livro|udemy|coursera/.test(d))return'educacion';
  if(/netflix|spotify|cinema|game|teatro|show/.test(d))return'ocio';
  if(/amazon|shopee|roupa|vestuario|zara/.test(d))return'ropa';
  if(/tim|claro|vivo|oi|internet|telefon/.test(d))return'cuentas';
  return'otros';
}

// ═══════════════════════════════════════════════════
// ALUMNOS
// ═══════════════════════════════════════════════════
function copyCode(){
  const code=document.getElementById('inv-code').textContent;
  navigator.clipboard.writeText(code).then(()=>toast('✅ Código copiado: '+code));
}

async function loadStudents(){
  if(profile?.role!=='teacher')return;
  const curMonth=todayMonth();
  const{data:students}=await sb.from('forma_profiles').select('*').eq('teacher_id',user.id);
  document.getElementById('stu-count').textContent=(students||[]).length+' alumno'+((students||[]).length!==1?'s':'');
  const el=document.getElementById('stu-list');
  if(!students?.length){
    el.innerHTML='<div class="empty"><div class="ei">👥</div><p>Ningún alumno vinculado aún.<br>Comparte el código de arriba.</p></div>';return;
  }
  const withBal=await Promise.all(students.map(async s=>{
    const{data:t}=await sb.from('forma_transactions').select('type,amount').eq('user_id',s.id).gte('date',curMonth+'-01');
    const inc=(t||[]).filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount),0);
    const exp=(t||[]).filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount),0);
    return{...s,bal:inc-exp};
  }));
  el.innerHTML=withBal.map(s=>`
    <div class="stu-row">
      <div class="stu-av">${escapeHTML(initials(s.full_name))}</div>
      <div class="stu-body">
        <div class="stu-name">${escapeHTML(s.full_name)}</div>
        <div class="stu-meta">Este mes · saldo actual</div>
      </div>
      <div class="stu-bal" style="color:${s.bal>=0?'var(--green)':'var(--red)'}">${fmt(s.bal)}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════
// MODAL CERRAR AL CLICK FUERA
// ═══════════════════════════════════════════════════
document.getElementById('orc-overlay').addEventListener('click',function(e){if(e.target===this)closeOrcModal()});
document.getElementById('goal-overlay').addEventListener('click',function(e){if(e.target===this)closeGoalModal()});

// ═══════════════════════════════════════════════════
// TECLADO NUMÉRICO PROPIO (Nubank style)
// ═══════════════════════════════════════════════════
let npRaw=''; // string de dígitos sin punto — último 2 son decimales
let npEditMode=false; // true cuando se usa para editar tx

function openNumpad(editMode=false){
  npEditMode=editMode;
  if(!editMode){
    // Recuperar valor actual si ya había algo
    const el=document.getElementById('amt-display');
    const cur=el.textContent.replace(/[^0-9]/g,'');
    npRaw=cur&&cur!=='000'?cur:'';
  }
  const c=catInfo(txType,selCat);
  document.getElementById('np-icon').textContent=c.i;
  document.getElementById('np-cat').textContent=c.l;
  updateNumpadDisplay();
  document.getElementById('numpad-overlay').classList.add('open');
}

function openEditNumpad(){
  // Actualizar icon con tipo de edición
  const c=catInfo(editTxData?.type||'expense',editTxData?.category||selCat);
  document.getElementById('np-icon').textContent=c.i;
  document.getElementById('np-cat').textContent=c.l;
  npEditMode=true;
  updateNumpadDisplay();
  document.getElementById('numpad-overlay').classList.add('open');
}

function closeNumpad(){
  document.getElementById('numpad-overlay').classList.remove('open');
}

function numpadPress(d){
  if(d==='.'){
    // Ya tiene decimal implícito (centavos = últimos 2 dígitos)
    // Ignorar punto — la pantalla siempre muestra 2 decimales
    return;
  }
  if(npRaw.length>=10) return; // máximo 10 dígitos
  npRaw+=d;
  updateNumpadDisplay();
}

function numpadDel(){
  npRaw=npRaw.slice(0,-1);
  updateNumpadDisplay();
}

function updateNumpadDisplay(){
  const el=document.getElementById('np-amt');
  if(!npRaw){
    el.textContent='0,00';
    el.classList.add('empty');
    return;
  }
  el.classList.remove('empty');
  const num=parseInt(npRaw,10)/100;
  el.textContent=num.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function numpadOk(){
  const num=npRaw?parseInt(npRaw,10)/100:0;
  if(npEditMode){
    // Actualizar el campo de edición
    document.getElementById('edit-amt-display').textContent=
      num.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(editTxData) editTxData._newAmt=num;
    closeNumpad();
    return;
  }
  // Actualizar campo de registro
  const display=document.getElementById('amt-display');
  if(num>0){
    display.textContent=num.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});
    display.classList.remove('empty');
    display.dataset.value=num;
  }else{
    display.textContent='0,00';
    display.classList.add('empty');
    delete display.dataset.value;
  }
  closeNumpad();
}

// ═══════════════════════════════════════════════════
// DETALLE / EDITAR / ELIMINAR TRANSACCIÓN
// ═══════════════════════════════════════════════════
let currentTxDetail=null;
let editTxData=null;

function openTxDetail(t){
  // t puede ser objeto o string (desde onclick attr)
  const tx=(typeof t==='string')?JSON.parse(t):t;
  currentTxDetail=tx;
  const c=catInfo(tx.type,tx.category);
  const icon=document.getElementById('tdd-icon');
  icon.textContent=c.i;
  icon.className='tx-detail-icon '+(tx.type==='income'?'i':'e');
  const amtEl=document.getElementById('tdd-amt');
  amtEl.textContent=(tx.type==='income'?'+':'-')+fmt(tx.amount);
  amtEl.className='tx-detail-amt '+(tx.type==='income'?'i':'e');
  document.getElementById('tdd-desc').textContent=tx.description||c.l;
  document.getElementById('tdd-cat').textContent=c.i+' '+c.l;
  document.getElementById('tdd-date').textContent=tx.date;
  document.getElementById('tdd-type').textContent=tx.type==='income'?'💰 Ingreso':'💸 Gasto';
  document.getElementById('tx-detail-overlay').classList.add('open');
}

function closeTxDetail(){
  document.getElementById('tx-detail-overlay').classList.remove('open');
  currentTxDetail=null;
}

function editTxOpen(){
  if(!currentTxDetail) return;
  const selectedTx={...currentTxDetail};
  closeTxDetail();
  editTxData={...selectedTx,_newAmt:Number(selectedTx.amount)};
  // Rellenar campos del editor
  editSetType(editTxData.type);
  const display=document.getElementById('edit-amt-display');
  display.textContent=Number(editTxData.amount).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('edit-desc').value=editTxData.description||'';
  document.getElementById('edit-date').value=editTxData.date;
  // Prep numpad para edición
  npRaw=Math.round(Number(editTxData.amount)*100).toString();
  document.getElementById('tx-edit-overlay').classList.add('open');
}

function closeTxEdit(){
  document.getElementById('tx-edit-overlay').classList.remove('open');
  editTxData=null;
  npRaw='';
}

function editSetType(type){
  if(editTxData) editTxData.type=type;
  document.getElementById('edit-tt-e').className='rtype-btn gas'+(type==='expense'?' active':'');
  document.getElementById('edit-tt-i').className='rtype-btn ing'+(type==='income'?' active':'');
}

async function saveTxEdit(){
  if(!editTxData) return;
  const amt=editTxData._newAmt||Number(editTxData.amount);
  const desc=document.getElementById('edit-desc').value.trim();
  const date=document.getElementById('edit-date').value;
  if(!amt||amt<=0){toast('Monto inválido',false);return}
  if(!date){toast('Fecha requerida',false);return}
  const{error}=await sb.from('forma_transactions').update({
    amount:amt,description:desc||null,date,type:editTxData.type
  }).eq('id',editTxData.id);
  if(error){toast('Error: '+error.message,false);return}
  toast('✅ ¡Transacción actualizada!');
  closeTxEdit();
  await loadMonthData();
}

async function deleteTxConfirm(){
  if(!currentTxDetail) return;
  const tx=currentTxDetail;
  // Confirmación inline simple
  const btn=document.querySelector('.btn-del-tx');
  if(btn.dataset.confirm!=='1'){
    btn.textContent='⚠️ ¿Confirmar?';
    btn.dataset.confirm='1';
    setTimeout(()=>{btn.textContent='🗑️ Eliminar';btn.dataset.confirm='';},3000);
    return;
  }
  const{error}=await sb.from('forma_transactions').delete().eq('id',tx.id);
  if(error){toast('Error: '+error.message,false);return}
  toast('🗑️ Transacción eliminada');
  closeTxDetail();
  await loadMonthData();
}

// ═══════════════════════════════════════════════════
// ONBOARDING PRIMER USO
// ═══════════════════════════════════════════════════
let obStep=0;
let obData={salary:0,cats:[]};
const OB_STEPS=[{
  emoji:'👋',title:'Aprende a tu ritmo',
  sub:'No necesitas saber cuánto ganas para empezar. Descubre tus gastos, completa tu presupuesto poco a poco y crea tus metas cuando estés listo.',
  cta:'Entrar a FORMÁ',skip:false
}];

function initOnboarding(){
  if(!user||window.FORMA_DEMO)return;
  obStep=0;
  obData={salary:0,cats:[]};
  renderOnboardStep();
  document.getElementById('onboard-overlay').classList.add('open');
}

function renderOnboardStep(){
  const step=OB_STEPS[obStep];
  const total=OB_STEPS.length;
  // Dots
  const dots=Array.from({length:total},(_,i)=>`<div class="od${i===obStep?' active':''}"></div>`).join('');
  document.getElementById('ob-dots').innerHTML=dots;

  let html=`<div class="onboard-emoji">${step.emoji}</div>
    <div class="onboard-title">${step.title}</div>
    <div class="onboard-sub">${step.sub}</div>`;

  if(step.cats){
    const cats=[
      {id:'supermercado',i:'🛒',l:'Mercado'},
      {id:'restaurantes',i:'🍽️',l:'Comida'},
      {id:'gasolina',i:'⛽',l:'Gasolina'},
      {id:'uber',i:'🚖',l:'Uber'},
      {id:'farmacia',i:'💊',l:'Farmacia'},
      {id:'academia',i:'🏋️',l:'Gym'},
      {id:'ropa',i:'👗',l:'Ropa'},
      {id:'cafe',i:'☕',l:'Café'},
      {id:'alquiler',i:'🏠',l:'Alquiler'},
    ];
    html+=`<div class="onboard-cats">${cats.map(c=>`
      <button class="ob-cat${obData.cats.includes(c.id)?' active':''}" data-forma-click="74" data-forma-arg0="${c.id}">
        <span class="oi">${c.i}</span>${escapeHTML(c.l)}
      </button>`).join('')}</div>`;
  }

  html+=`<button class="onboard-btn" data-forma-click="75">${step.cta}</button>`;
  if(step.skip){
    html+=`<button class="onboard-skip" data-forma-click="76">Saltar configuración</button>`;
  }
  document.getElementById('ob-content').innerHTML=html;
}

function obToggleCat(id,btn){
  const idx=obData.cats.indexOf(id);
  if(idx>=0){obData.cats.splice(idx,1);btn.classList.remove('active');}
  else if(obData.cats.length<3){obData.cats.push(id);btn.classList.add('active');}
  else{toast('Máximo 3 categorías',false);}
}

async function obNext(){obFinish();}

function obSkip(){
  obFinish();
}

function obFinish(){
  // Reordenar QUICK_EXP según preferencias del usuario
  if(obData.cats.length){
    obData.cats.reverse().forEach(id=>{
      const idx=QUICK_EXP.findIndex(c=>c.id===id);
      if(idx>0){const [item]=QUICK_EXP.splice(idx,1);QUICK_EXP.unshift(item);}
    });
    renderQuickCats();
  }
  if(!user)return;
  localStorage.setItem('forma_ob_done_'+user.id,'1');
  document.getElementById('onboard-overlay').classList.remove('open');
  toast('Tu plan empieza aquí.');
}

// ═══════════════════════════════════════════════════
// GRÁFICO DE EVOLUCIÓN (canvas puro)
// ═══════════════════════════════════════════════════
async function renderEvoChart(){
  const canvas=document.getElementById('evo-chart');
  if(!canvas) return;
  // Generar últimos 6 meses
  const months=[];
  let[y,m]=todayMonth().split('-').map(Number);
  for(let i=5;i>=0;i--){
    let mm=m-i; let yy=y;
    if(mm<1){mm+=12;yy--;}
    months.push(yy+'-'+String(mm).padStart(2,'0'));
  }
  // Cargar datos de cada mes
  const data=await Promise.all(months.map(async mo=>{
    const{data:t}=await sb.from('forma_transactions').select('type,amount')
      .eq('user_id',user.id).gte('date',mo+'-01').lte('date',mo+'-31');
    const inc=(t||[]).filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount),0);
    const exp=(t||[]).filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount),0);
    return{mo,inc,exp};
  }));

  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||300;
  const H=160;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const pad={t:10,r:10,b:28,l:44};
  const cw=W-pad.l-pad.r;
  const ch=H-pad.t-pad.b;
  const max=Math.max(...data.flatMap(d=>[d.inc,d.exp]),1);
  const barW=Math.floor(cw/months.length);
  const bw=Math.floor(barW*0.3);
  const gap=Math.floor(barW*0.05);

  // Grid
  const isDark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  const gridColor=isDark?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)';
  const textColor=isDark?'rgba(255,255,255,.45)':'rgba(0,0,0,.4)';
  ctx.strokeStyle=gridColor; ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(p=>{
    const y=pad.t+ch*(1-p);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle=textColor;ctx.font='10px DM Sans,sans-serif';ctx.textAlign='right';
    ctx.fillText('$'+(max*p/1000>=1?(max*p/1000).toFixed(0)+'k':(max*p).toFixed(0)),pad.l-4,y+3);
  });

  // Barras
  const GREEN='#16A34A', RED='#DC2626';
  data.forEach((d,i)=>{
    const x=pad.l+i*barW+Math.floor(barW/2);
    // Ingreso
    const ih=Math.round((d.inc/max)*ch);
    ctx.fillStyle=GREEN;
    roundRect(ctx,x-bw-gap,pad.t+ch-ih,bw,ih,3);
    // Gasto
    const eh=Math.round((d.exp/max)*ch);
    ctx.fillStyle=RED;
    roundRect(ctx,x+gap,pad.t+ch-eh,bw,eh,3);
    // Label mes
    const mo=d.mo.slice(5);
    const names=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    ctx.fillStyle=textColor;ctx.font='10px DM Sans,sans-serif';ctx.textAlign='center';
    ctx.fillText(names[+mo],x,H-6);
  });
}

function roundRect(ctx,x,y,w,h,r){
  if(h<=0) return;
  r=Math.min(r,h/2,w/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h);
  ctx.lineTo(x,y+h);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
  ctx.fill();
}

// ═══════════════════════════════════════════════════
// METAS DE AHORRO
// ═══════════════════════════════════════════════════
function loadGoals(){
  const raw=localStorage.getItem('forma_goals_'+user.id)||'[]';
  return JSON.parse(raw);
}
function saveGoals(goals){
  localStorage.setItem('forma_goals_'+user.id,JSON.stringify(goals));
}

function renderGoals(){
  const goals=loadGoals();
  const el=document.getElementById('goals-list');
  if(!goals.length){
    el.innerHTML='<div class="empty" style="padding:12px 0"><p style="font-size:13px">Sin metas aún.<br>Crea tu primera meta de ahorro.</p></div>';
    return;
  }
  el.innerHTML=goals.map((g,i)=>{
    const pct=g.target>0?Math.min(100,Math.round((g.saved/g.target)*100)):0;
    const left=g.target-g.saved;
    const daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/(1000*86400)):null;
    return`<div class="goal-item">
      <div class="goal-header">
        <span class="goal-name">${escapeHTML(g.emoji||'🎯')} ${escapeHTML(g.name)}</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span class="goal-pct">${pct}%</span>
          <button class="goal-del" data-forma-click="77" data-forma-arg0="${i}">🗑</button>
        </span>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-meta">
        <span>${fmt(g.saved)} de ${fmt(g.target)}</span>
        <span>${left>0?'Falta '+fmt(left):'✅ ¡Meta alcanzada!'}${daysLeft!=null?' · '+daysLeft+'d':''}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button data-forma-click="78" data-forma-arg0="${i}" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid var(--border2);background:var(--surface);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text2)">+$50</button>
        <button data-forma-click="79" data-forma-arg0="${i}" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid var(--border2);background:var(--surface);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text2)">+$100</button>
        <button data-forma-click="80" data-forma-arg0="${i}" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid var(--border2);background:var(--surface);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text2)">+$200</button>
        <button data-forma-click="81" data-forma-arg0="${i}" style="flex:1;padding:7px;border-radius:8px;background:var(--brand-lt);border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--brand)">+otro</button>
      </div>
    </div>`;
  }).join('');
}

function openGoalModal(){
  document.getElementById('goal-name').value='';
  document.getElementById('goal-target').value='';
  document.getElementById('goal-saved').value='';
  document.getElementById('goal-date').value='';
  document.getElementById('goal-overlay').classList.add('open');
}
function closeGoalModal(){document.getElementById('goal-overlay').classList.remove('open')}

const GOAL_EMOJIS={'viaje':'✈️','iphone':'📱','celular':'📱','auto':'🚗','carro':'🚗','casa':'🏠','boda':'💍','emergencia':'🛡️','fondo':'🛡️','vacacion':'🏖️','laptop':'💻','computad':'💻'};
function goalEmoji(name){
  const n=(name||'').toLowerCase();
  return Object.entries(GOAL_EMOJIS).find(([k])=>n.includes(k))?.[1]||'🎯';
}

function saveGoal(){
  const name=document.getElementById('goal-name').value.trim();
  const target=parseFloat(document.getElementById('goal-target').value)||0;
  const saved=parseFloat(document.getElementById('goal-saved').value)||0;
  const date=document.getElementById('goal-date').value||null;
  if(!name){toast('Ingresa el nombre de la meta',false);return}
  if(!target||target<=0){toast('Ingresa un monto objetivo',false);return}
  const goals=loadGoals();
  goals.push({name,target,saved,date,emoji:goalEmoji(name),createdAt:todayStr()});
  saveGoals(goals);
  toast('🎯 ¡Meta creada!');
  closeGoalModal();
  renderGoals();
}

function deleteGoal(i){
  const goals=loadGoals();
  goals.splice(i,1);
  saveGoals(goals);
  renderGoals();
  toast('Meta eliminada');
}

function addToGoal(i,amt){
  const goals=loadGoals();
  goals[i].saved=Math.min(goals[i].target,(goals[i].saved||0)+amt);
  saveGoals(goals);
  renderGoals();
  if(goals[i].saved>=goals[i].target) toast('🎉 ¡Meta '+goals[i].name+' alcanzada!');
  else toast('+'+fmt(amt)+' ahorrado 💪');
}

function addToGoalCustom(i){
  const v=parseFloat(prompt('¿Cuánto quieres agregar a la meta?')||0);
  if(v>0) addToGoal(i,v);
}

// ═══════════════════════════════════════════════════
// PWA — instalación como app
// ═══════════════════════════════════════════════════
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstall=e;
  const dismissed=localStorage.getItem('forma_install_dismissed');
  if(!dismissed) document.getElementById('install-banner').classList.add('show');
});
window.addEventListener('appinstalled',()=>{
  document.getElementById('install-banner').classList.remove('show');
  toast('✅ ¡FORMÁ instalada como app!');
});
async function doInstall(){
  if(!deferredInstall) return;
  deferredInstall.prompt();
  const{outcome}=await deferredInstall.userChoice;
  if(outcome==='accepted'){document.getElementById('install-banner').classList.remove('show');}
  deferredInstall=null;
}
function dismissInstall(){
  document.getElementById('install-banner').classList.remove('show');
  localStorage.setItem('forma_install_dismissed','1');
}

// Offline financial writes are deliberately not queued.

// Actualizar saveTx para usar el valor del numpad
const _origSaveTx=saveTx;
saveTx=async function(){
  // Obtener monto del display (numpad lo puso ahí)
  const display=document.getElementById('amt-display');
  const rawAmt=parseFloat(display.dataset.value||0)||0;
  if(!rawAmt||rawAmt<=0){
    display.style.animation='shake .3s';
    setTimeout(()=>display.style.animation='',400);
    toast('Ingresa el monto primero',false);return;
  }
  const desc=document.getElementById('tx-desc').value.trim();
  const date=document.getElementById('tx-date').value;
  if(!date){toast('Selecciona la fecha',false);return}
  const btn=document.getElementById('save-btn');
  btn.disabled=true;btn.textContent='...';
  const{error}=await sb.from('forma_transactions').insert({
    user_id:user.id,date,description:desc||null,
    amount:rawAmt,type:txType,category:selCat,source:'manual'
  });
  if(error){toast('Error: '+error.message,false);}
  else{
    toast('✅ ¡Guardado!');
    display.textContent='0,00';
    display.classList.add('empty');
    delete display.dataset.value;
    npRaw='';
    document.getElementById('tx-desc').value='';
  }
  btn.disabled=false;btn.textContent='✓ Guardar';
  if(!error&&date.slice(0,7)===month) await loadMonthData();
}
