import { loadConfig } from '../../lib/config.js';
import { guard, errorPage, appRedirectPage } from '../../lib/http.js';
import { readState, makeTicket, makeExchangeCode } from '../../lib/oauth.js';

export default async function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['GET'], auth: false })) return;
  const { code, state, error } = req.query || {};
  if (error) return errorPage(res, 400, `GitHub menolak akses: ${error}`);
  const st = readState(config, state, 'github');
  if (!st || !code) return errorPage(res, 400, 'State tidak valid atau sudah kedaluwarsa. Ulangi login dari aplikasi.');
  let data;
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_id: config.github.clientId, client_secret: config.github.clientSecret, code: String(code), redirect_uri: `${config.baseUrl}/api/github/callback` })
    });
    data = await response.json();
  } catch { return errorPage(res, 502, 'Tidak dapat menghubungi GitHub.'); }
  if (!data.access_token) return errorPage(res, 502, `Penukaran kode gagal: ${data.error_description || data.error || 'tidak ada token'}`);
  const ticket = makeTicket(config, 'github', { at: data.access_token, scope: data.scope || '' });
  const blob = makeExchangeCode(config, { ticket, challenge: st.c, provider: 'github' });
  appRedirectPage(res, `${config.appRedirect}?provider=github&code=${encodeURIComponent(blob)}&state=${encodeURIComponent(st.s)}`);
}
