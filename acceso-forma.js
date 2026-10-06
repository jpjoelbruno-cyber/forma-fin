/* Dedicated FORMÁ Auth validation. No legacy config, client or financial queries. */
(() => {
  'use strict';
  const projectUrl = 'https://irsuevjqmgpwunvymxbc.supabase.co';
  const publicKey = 'sb_publishable_p00kgl4nHZuGdMOwGJi9WA_e_knq977';
  const origin = 'https://forma-fin.vercel.app';
  // Add this exact URL to the dedicated project's redirect allow list.
  // The existing root application never receives this test's auth response.
  const callback = origin + '/acceso-forma.html';
  const byId = id => document.getElementById(id);
  const status = byId('status'), login = byId('login'), logout = byId('logout');
  let client;
  function fail(message) {
    byId('identity').hidden = true;
    byId('email').textContent = '';
    byId('reference').textContent = '';
    logout.hidden = true;
    login.hidden = false;
    login.disabled = !client;
    status.textContent = message;
  }
  async function verify() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) { fail('Listo para probar tu cuenta de Google.'); return; }
    const { data: verified, error: userError } = await client.auth.getUser();
    if (userError || !verified.user || verified.user.is_anonymous) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('No fue posible validar esta sesión con FORMÁ. Vuelve a entrar.');
    }
    byId('email').textContent = verified.user.email || 'Cuenta de Google verificada';
    byId('reference').textContent = verified.user.id.slice(0, 8);
    byId('identity').hidden = false;
    login.hidden = true;
    logout.hidden = false;
    status.textContent = 'Google verificado con el proyecto exclusivo de FORMÁ.';
  }
  async function init() {
    if (location.origin !== origin) { fail('Abre esta prueba desde el enlace oficial de FORMÁ.'); return; }
    if (!window.supabase) { fail('No se pudo cargar el acceso. Recarga la página.'); return; }
    client = window.supabase.createClient(projectUrl, publicKey, { auth: {
      storageKey: 'forma-independent-auth-test-v1',
      flowType: 'pkce', persistSession: true, detectSessionInUrl: true
    }});
    const params = new URLSearchParams(location.search);
    const providerError = params.get('error_description');
    try {
      await verify();
      if (providerError) fail('Google no completó el acceso. Revisa el usuario de prueba y las direcciones de retorno.');
    } catch (_) {
      fail('No se pudo validar el acceso. Vuelve a intentarlo desde esta misma página.');
    } finally {
      history.replaceState(null, '', '/acceso-forma.html');
    }
  }
  login.addEventListener('click', async () => {
    if (!client) return;
    login.disabled = true;
    status.textContent = 'Abriendo Google…';
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: callback, queryParams: { prompt: 'select_account' }
      }});
      if (error) throw error;
    } catch (_) { fail('No se pudo abrir Google. Vuelve a intentarlo.'); }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      fail('Sesión de prueba cerrada. Puedes volver a entrar.');
    } catch (_) { status.textContent = 'No se pudo cerrar la sesión. Inténtalo otra vez.'; }
    finally { logout.disabled = false; }
  });
  void init();
})();
