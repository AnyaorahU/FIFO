// Security & user-isolation tests. They need a throwaway MongoDB database:
//   MONGODB_URI_TEST=mongodb://127.0.0.1:27017 npm test
// The test database (fifoconnect_test by default) is wiped before the run.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const TEST_URI = process.env.MONGODB_URI_TEST;
if (!TEST_URI) {
  test('security tests', { skip: 'Set MONGODB_URI_TEST to run (uses a throwaway database)' }, () => {});
  return;
}

process.env.MONGODB_URI = TEST_URI;
process.env.MONGODB_DB = process.env.MONGODB_DB_TEST || 'fifoconnect_test';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-'.padEnd(48, 'x');
process.env.ADMIN_IDLE_MINUTES = '0.05'; // 3 seconds, to test the admin idle timeout
process.env.LOGIN_MAX_FAILURES = '5';

const bcrypt = require('bcryptjs');
const dbm = require('../server/db');
const { buildApp } = require('../server/index');

const ADMIN = { email: 'admin@test.local', password: 'AdminPassword123' };
const UA = 'Mozilla/5.0 (test-browser)';
let server;
let base;

// Minimal cookie-keeping HTTP client.
function client(userAgent = UA) {
  const jar = new Map();
  const request = async (path, { method = 'GET', form, body, headers = {}, redirect = 'manual' } = {}) => {
    const h = { 'user-agent': userAgent, ...headers };
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload = body;
    if (form) { payload = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    const res = await fetch(base + path, { method, headers: h, body: payload, redirect });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    res.text_ = await res.text();
    return res;
  };
  const csrf = async (path = '/login') => {
    const res = await request(path);
    const m = res.text_.match(/name="_csrf" value="([a-f0-9]+)"/);
    assert.ok(m, `no CSRF token on ${path}`);
    return m[1];
  };
  return { request, csrf, jar };
}

async function register(c, email) {
  const _csrf = await c.csrf('/register');
  const res = await c.request('/register', { method: 'POST', form: { _csrf, name: 'Test ' + email, email, password: 'Password123', confirm: 'Password123', terms: '1', country: 'Canada' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/dashboard');
}

async function login(c, email, password) {
  const _csrf = await c.csrf('/login');
  return c.request('/login', { method: 'POST', form: { _csrf, email, password } });
}

async function uploadCv(c) {
  const page = await c.request('/dashboard');
  const _csrf = page.text_.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from('%PDF-1.4\n%test\n')], { type: 'application/pdf' }), 'cv.pdf');
  const res = await c.request(`/dashboard/upload/cv?_csrf=${_csrf}`, { method: 'POST', body: fd });
  assert.equal(res.status, 302);
  const dash = await c.request('/dashboard');
  const fileId = (dash.text_.match(/\/files\/([a-f0-9]{24})/) || [])[1];
  const docId = (dash.text_.match(/\/dashboard\/documents\/([a-f0-9]{24})\/delete/) || [])[1];
  assert.ok(fileId && docId, 'uploaded CV not listed');
  return { fileId, docId, csrf: _csrf };
}

before(async () => {
  await dbm.connect();
  await dbm.getDb().dropDatabase();
  await dbm.connect(); // recreate indexes and validators
  const now = new Date();
  await dbm.col.settings.insertOne({ _id: 'site', name: 'FIFOconnect', heroTitle: 'Test', licences: ['White Card'] });
  await dbm.col.sectors.insertOne({ slug: 'operators', name: 'Operators', blurb: 'x', image: '/img/x.jpg', color: 'navy', active: true, order: 1 });
  await dbm.col.jobs.insertOne({ title: 'Test Job', sector: 'operators', location: 'Perth', country: 'Australia', contract_type: 'Contract', summary: 'A test job summary.', description: 'A test job description.', status: 'open', published_at: now, updated_at: now });
  await dbm.col.users.insertOne({ name: 'Admin', email: ADMIN.email, password_hash: await bcrypt.hash(ADMIN.password, 4), role: 'admin', active: true, created_at: now, failed_logins: 0, locked_until: null });
  server = buildApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server && server.close();
  await dbm.getDb().dropDatabase();
  await dbm.client.close();
});

test('private areas require login and send protective headers', async () => {
  const c = client();
  for (const path of ['/dashboard', '/admin', '/admin/content', '/files/000000000000000000000000']) {
    const res = await c.request(path);
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get('location'), '/login', path);
  }
  const res = await c.request('/admin');
  assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});

test('forms without a valid CSRF token are rejected (sent back to a fresh form, nothing happens)', async () => {
  const c = client();
  const res = await c.request('/login', { method: 'POST', form: { email: ADMIN.email, password: ADMIN.password } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
  assert.equal((await c.request('/admin')).headers.get('location'), '/login', 'must not be logged in');
  const stale = await c.request('/login', { method: 'POST', form: { _csrf: 'a'.repeat(48), email: ADMIN.email, password: ADMIN.password } });
  assert.equal(stale.status, 303);
  assert.equal((await c.request('/admin')).headers.get('location'), '/login', 'must not be logged in with a forged token');
});

test('an old login page submitted while already logged in goes straight to the dashboard', async () => {
  const c = client();
  const oldToken = await c.csrf('/login');
  await register(c, 'returning@test.local'); // logging in rotates the session, so oldToken is now stale
  const res = await c.request('/login', { method: 'POST', form: { _csrf: oldToken, email: 'returning@test.local', password: 'Password123' } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/dashboard');
});

test('candidates are isolated from each other', async () => {
  const alice = client(); const bob = client();
  await register(alice, 'alice@test.local');
  await register(bob, 'bob@test.local');
  const { fileId, docId } = await uploadCv(alice);

  // Alice can download her own file
  assert.equal((await alice.request(`/files/${fileId}`)).status, 200);
  // Bob cannot download, delete or see Alice's document
  assert.equal((await bob.request(`/files/${fileId}`)).status, 404);
  const bobPage = await bob.request('/dashboard');
  const _csrf = bobPage.text_.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  await bob.request(`/dashboard/documents/${docId}/delete`, { method: 'POST', form: { _csrf } });
  assert.equal((await alice.request(`/files/${fileId}`)).status, 200, "Bob's delete must not affect Alice's file");
  assert.ok(!bobPage.text_.includes(fileId), "Alice's file must not appear on Bob's dashboard");
  // Bob cannot reach the admin area or exports
  for (const path of ['/admin', '/admin/candidates', '/admin/candidates.csv', '/admin/content/settings']) {
    assert.equal((await bob.request(path)).status, 403, path);
  }
  // Logged-out visitors cannot download files
  assert.equal((await client().request(`/files/${fileId}`)).status, 302);
});

test('MongoDB operator injection is ignored', async () => {
  const c = client();
  const _csrf = await c.csrf('/login');
  const res = await c.request('/login', { method: 'POST', body: `_csrf=${_csrf}&email[$ne]=x&password[$ne]=x`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 401);
  const jobs = await c.request('/jobs?sector[$ne]=nothing&country[$gt]=');
  assert.equal(jobs.status, 200);
  assert.match(jobs.text_, /1 job offer/);
  const bad = await c.request('/jobs/%7B%22%24ne%22%3A1%7D');
  assert.equal(bad.status, 404);
});

test('accounts lock after repeated failed logins', async () => {
  const c = client();
  await register(client(), 'locked@test.local');
  for (let i = 0; i < 5; i++) await login(c, 'locked@test.local', 'wrong-password-' + i);
  const res = await login(c, 'locked@test.local', 'Password123');
  assert.equal(res.status, 429);
  assert.match(res.text_, /locked/);
});

test('a session cookie used from a different browser is rejected', async () => {
  const c = client();
  await register(c, 'carol@test.local');
  assert.equal((await c.request('/dashboard')).status, 200);
  const thief = client('Different-Browser/1.0');
  for (const [k, v] of c.jar) thief.jar.set(k, v);
  const res = await thief.request('/dashboard');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('dangerous admin actions need the admin password again', async () => {
  const admin = client();
  const res = await login(admin, ADMIN.email, ADMIN.password);
  assert.equal(res.headers.get('location'), '/admin');
  const dave = client();
  await register(dave, 'dave@test.local');
  const user = await dbm.col.users.findOne({ email: 'dave@test.local' });
  const _csrf = await admin.csrf(`/admin/candidates/${user._id}`);
  await admin.request(`/admin/candidates/${user._id}/delete`, { method: 'POST', form: { _csrf, confirm_password: 'wrong' } });
  assert.ok(await dbm.col.users.findOne({ _id: user._id }), 'delete without the right password must be refused');
  await admin.request(`/admin/candidates/${user._id}/delete`, { method: 'POST', form: { _csrf, confirm_password: ADMIN.password } });
  assert.equal(await dbm.col.users.findOne({ _id: user._id }), null);
  // The deleted candidate is signed out
  assert.equal((await dave.request('/dashboard')).status, 302);
});

test('idle admin sessions expire', async () => {
  const admin = client();
  await login(admin, ADMIN.email, ADMIN.password);
  assert.equal((await admin.request('/admin')).status, 200);
  await new Promise(r => setTimeout(r, 3500));
  const res = await admin.request('/admin');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('the database rejects malformed users (when validation rules are allowed)', async () => {
  const info = await dbm.getDb().listCollections({ name: 'users' }).next();
  if (!info.options || !info.options.validator) return; // database user without collMod permission
  await assert.rejects(dbm.col.users.insertOne({ email: 'x@test.local', password_hash: 'x', role: 'superuser' }));
});
