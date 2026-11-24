import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { seal, open, pkceChallenge, isChallenge } from '../lib/crypto.js';
import { loadConfig, resolveGoogleScopes } from '../lib/config.js';
import health from '../api/health.js';
import info from '../api/info.js';
import googleStart from '../api/google/start.js';
import googleCallback from '../api/google/callback.js';
import googleToken from '../api/google/token.js';
import githubStart from '../api/github/start.js';
import exchange from '../api/link/exchange.js';
import telegram from '../api/telegram/[method].js';

const KEY = 'k'.repeat(40);
const SECRET = 's'.repeat(40);
const BASE_ENV = {
  NEXORA_API_KEY: KEY, BRIDGE_SECRET: SECRET, PUBLIC_BASE_URL: 'https://link.example.app',
  GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret', GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hsecret',
  TELEGRAM_BOT_TOKEN: '123:TOKEN', RATE_LIMIT_PER_MINUTE: '1000'
};
let ipCounter = 0;
function setEnv(extra = {}) {
  for (const k of Object.keys(process.env)) if (/^(NEXORA|BRIDGE|PUBLIC|GOOGLE|GITHUB|TELEGRAM|RATE|APP_|TICKET|ALLOWED)/.test(k)) delete process.env[k];
  Object.assign(process.env, BASE_ENV, extra);
}
function mkReq({ method = 'GET', query = {}, body, key } = {}) {
  ipCounter++;
  return { method, query, body, headers: { 'x-forwarded-for': `10.0.0.${ipCounter}`, ...(key ? { 'x-nexora-key': key } : {}) } };
}
function mkRes() {
  const res = { statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
  return res;
}
const verifier = () => randomBytes(32).toString('base64url');
function withFetch(handler, fn) { const original = globalThis.fetch; globalThis.fetch = handler; return Promise.resolve(fn()).finally(() => { globalThis.fetch = original; }); }

test('seal/open: round trip, isolasi tujuan, dan deteksi manipulasi', () => {
  const token = seal({ a: 1 }, SECRET, 'ticket');
  assert.deepEqual(open(token, SECRET, 'ticket'), { a: 1 });
  assert.equal(open(token, SECRET, 'code'), null);
  assert.equal(open(token, 'x'.repeat(40), 'ticket'), null);
  // Manipulasi byte ciphertext yang sebenarnya (bukan bit sisa base64) harus terdeteksi oleh GCM.
  const [v, iv, data, tag] = token.split('.');
  const bytes = Buffer.from(data, 'base64url'); bytes[0] ^= 0xff;
  assert.equal(open([v, iv, bytes.toString('base64url'), tag].join('.'), SECRET, 'ticket'), null);
  const badTag = Buffer.from(tag, 'base64url'); badTag[0] ^= 0x01;
  assert.equal(open([v, iv, data, badTag.toString('base64url')].join('.'), SECRET, 'ticket'), null);
  assert.equal(open('sampah', SECRET, 'ticket'), null);
});

test('PKCE challenge sesuai S256 dan validator panjang', () => {
  const v = verifier();
  assert.equal(pkceChallenge(v), createHash('sha256').update(v).digest('base64url'));
  assert.ok(isChallenge(pkceChallenge(v)));
  assert.ok(!isChallenge('pendek'));
});

test('config: menolak rahasia lemah dan base URL non-https; scope alias', () => {
  const bad = loadConfig({ NEXORA_API_KEY: 'x', BRIDGE_SECRET: 'y', PUBLIC_BASE_URL: 'http://evil.com' });
  assert.equal(bad.ok, false);
  assert.equal(bad.problems.length, 3);
  assert.ok(resolveGoogleScopes('drive_file,photos_picker').includes('https://www.googleapis.com/auth/photospicker.mediaitems.readonly'));
  assert.throws(() => resolveGoogleScopes('hack'), /tidak dikenal/);
});

test('health tanpa env melaporkan masalah; dengan env OK dan tidak membocorkan rahasia', () => {
  setEnv({ NEXORA_API_KEY: '' });
  let res = mkRes(); health(mkReq(), res);
  assert.equal(res.body.ok, false);
  setEnv(); res = mkRes(); health(mkReq(), res);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.providers, { google: true, github: true, telegram: true });
  assert.ok(!JSON.stringify(res.body).includes(SECRET) && !JSON.stringify(res.body).includes('gsecret'));
});

test('info memerlukan kunci aplikasi', () => {
  setEnv();
  let res = mkRes(); info(mkReq(), res);
  assert.equal(res.statusCode, 401);
  res = mkRes(); info(mkReq({ key: 'salah' }), res);
  assert.equal(res.statusCode, 401);
  res = mkRes(); info(mkReq({ key: KEY }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.telegramMethods.includes('getMe'));
});

test('alur Google lengkap: start → callback → exchange(PKCE) → token', async () => {
  setEnv();
  const v = verifier(); const ch = pkceChallenge(v);
  let res = mkRes();
  googleStart(mkReq({ query: { state: 'app-state-1', challenge: ch, scope: 'drive,photos_picker' } }), res);
  assert.equal(res.statusCode, 302);
  const auth = new URL(res.headers.location);
  assert.equal(auth.origin + auth.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(auth.searchParams.get('client_id'), 'gid');
  assert.equal(auth.searchParams.get('access_type'), 'offline');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://link.example.app/api/google/callback');
  assert.match(auth.searchParams.get('scope'), /drive/);
  const state = auth.searchParams.get('state');

  const idToken = 'h.' + Buffer.from(JSON.stringify({ email: 'budi@gmail.com' })).toString('base64url') + '.s';
  let redirectUrl;
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(new URLSearchParams(init.body).get('grant_type'), 'authorization_code');
    assert.equal(new URLSearchParams(init.body).get('client_secret'), 'gsecret');
    return { ok: true, json: async () => ({ refresh_token: 'RT-1', access_token: 'AT', scope: 'x', id_token: idToken }) };
  }, async () => {
    res = mkRes();
    await googleCallback(mkReq({ query: { code: 'abc', state } }), res);
    assert.equal(res.statusCode, 200);
    redirectUrl = res.body.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  });
  assert.ok(redirectUrl.startsWith('nexoracloud://link?provider=google'));
  const link = new URL(redirectUrl);
  assert.equal(link.searchParams.get('state'), 'app-state-1');
  const code = link.searchParams.get('code');
  assert.ok(!redirectUrl.includes('RT-1'), 'refresh token tidak boleh muncul di deep link');

  // verifier salah ditolak; benar diterima
  res = mkRes(); exchange(mkReq({ method: 'POST', key: KEY, body: { code, verifier: verifier() } }), res);
  assert.equal(res.statusCode, 403);
  res = mkRes(); exchange(mkReq({ method: 'POST', key: KEY, body: { code, verifier: v } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.email, 'budi@gmail.com');
  assert.ok(!JSON.stringify(res.body).includes('RT-1'), 'tiket terenkripsi, bukan refresh token mentah');
  const ticket = res.body.ticket;

  await withFetch(async (_url, init) => {
    assert.equal(new URLSearchParams(init.body).get('refresh_token'), 'RT-1');
    return { ok: true, json: async () => ({ access_token: 'AT-NEW', expires_in: 3599, token_type: 'Bearer' }) };
  }, async () => {
    res = mkRes(); await googleToken(mkReq({ method: 'POST', key: KEY, body: { ticket } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.access_token, 'AT-NEW');
  });
  await withFetch(async () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) }), async () => {
    res = mkRes(); await googleToken(mkReq({ method: 'POST', key: KEY, body: { ticket } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'TICKET_REVOKED');
  });
  res = mkRes(); await googleToken(mkReq({ method: 'POST', body: { ticket } }), res);
  assert.equal(res.statusCode, 401, 'tanpa kunci aplikasi ditolak');
  res = mkRes(); await googleToken(mkReq({ method: 'POST', key: KEY, body: { ticket: 'palsu' } }), res);
  assert.equal(res.statusCode, 401);
});

test('start menolak challenge/state tidak valid dan scope asing', () => {
  setEnv();
  let res = mkRes(); googleStart(mkReq({ query: { state: 's', challenge: 'x' } }), res);
  assert.equal(res.statusCode, 400);
  res = mkRes(); googleStart(mkReq({ query: { state: 's', challenge: pkceChallenge('a'.repeat(43)), scope: 'evil' } }), res);
  assert.equal(res.statusCode, 400);
});

test('state GitHub tidak dapat dipakai di callback Google (isolasi provider)', async () => {
  setEnv();
  let res = mkRes();
  githubStart(mkReq({ query: { state: 'g', challenge: pkceChallenge(verifier()) } }), res);
  assert.equal(res.statusCode, 302);
  const state = new URL(res.headers.location).searchParams.get('state');
  res = mkRes(); await googleCallback(mkReq({ query: { code: 'c', state } }), res);
  assert.equal(res.statusCode, 400);
});

test('proxy Telegram: allowlist, penerusan benar, token tidak bocor', async () => {
  setEnv();
  let res = mkRes();
  await telegram(mkReq({ method: 'POST', key: KEY, query: { method: 'logOut' }, body: {} }), res);
  assert.equal(res.statusCode, 403);
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.telegram.org/bot123:TOKEN/getMe');
    assert.equal(init.method, 'POST');
    return { status: 200, text: async () => JSON.stringify({ ok: true, result: { id: 1 } }) };
  }, async () => {
    res = mkRes();
    await telegram(mkReq({ method: 'POST', key: KEY, query: { method: 'getMe' }, body: {} }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(!String(res.body).includes('TOKEN'));
  });
  res = mkRes(); await telegram(mkReq({ method: 'GET', key: KEY, query: { method: 'getMe' } }), res);
  assert.equal(res.statusCode, 405);
  setEnv({ TELEGRAM_BOT_TOKEN: '' }); res = mkRes();
  await telegram(mkReq({ method: 'POST', key: KEY, query: { method: 'getMe' }, body: {} }), res);
  assert.equal(res.statusCode, 503);
});

test('rate limit per IP', () => {
  setEnv({ RATE_LIMIT_PER_MINUTE: '2' });
  const base = { method: 'GET', headers: { 'x-forwarded-for': '9.9.9.9', 'x-nexora-key': KEY }, query: {} };
  const codes = [1, 2, 3].map(() => { const r = mkRes(); info({ ...base }, r); return r.statusCode; });
  assert.deepEqual(codes, [200, 200, 429]);
});
