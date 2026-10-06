const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../acceso-forma.js'), 'utf8');
async function run({ session = null, user = null, userError = null, origin = 'https://forma-fin.vercel.app' } = {}) {
  const nodes = new Map();
  const calls = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', hidden: false, disabled: false, handlers: {}, addEventListener(name, f) { this.handlers[name] = f; } });
    return nodes.get(id);
  };
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user }, error: userError }),
    signOut: async options => { calls.push(['logout', options]); return { error: null }; },
    signInWithOAuth: async options => { calls.push(['oauth', options]); return { error: null }; }
  };
  vm.runInNewContext(source, {
    document: { getElementById: node },
    location: { origin, search: '?code=private-test-code' },
    history: { replaceState: (...args) => calls.push(['clean', ...args]) },
    URLSearchParams,
    window: { FORMA_CONFIG: { supabaseUrl: 'https://ipcqlltatvpvrqceqiox.supabase.co', publishableKey: 'legacy' }, supabase: { createClient: (...args) => { calls.push(['client', ...args]); return { auth }; } } }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { node, calls };
}
test('dedicated login ignores shared config and uses a separate PKCE storage key', async () => {
  const { calls } = await run();
  const c = calls.find(c => c[0] === 'client');
  assert.equal(c[1], 'https://irsuevjqmgpwunvymxbc.supabase.co');
  assert.equal(c[3].auth.storageKey, 'forma-independent-auth-test-v1');
  assert.equal(c[3].auth.flowType, 'pkce');
});
test('OAuth returns only to the independent test route', async () => {
  const { node, calls } = await run();
  await node('login').handlers.click();
  assert.equal(calls.find(c => c[0] === 'oauth')[1].options.redirectTo, 'https://forma-fin.vercel.app/acceso-forma.html');
});
test('session without server-verified identity cannot show success and only signs out locally', async () => {
  const { node, calls } = await run({ session: {}, user: { id: 'fake' }, userError: new Error('invalid issuer') });
  assert.equal(node('identity').hidden, true);
  assert.equal(node('reference').textContent, '');
  assert.equal(calls.find(c => c[0] === 'logout')[1].scope, 'local');
});
test('only server-verified identity appears and callback code is removed', async () => {
  const { node, calls } = await run({ session: {}, user: { id: '12345678-real', email: 'student@example.invalid' } });
  assert.equal(node('identity').hidden, false);
  assert.equal(node('reference').textContent, '12345678');
  assert.equal(calls.find(c => c[0] === 'clean')[3], '/acceso-forma.html');
});
test('off-origin page cannot initialize Auth', async () => {
  const { calls, node } = await run({ origin: 'https://unrelated.example' });
  assert.equal(calls.some(c => c[0] === 'client'), false);
  assert.equal(node('login').disabled, true);
});
