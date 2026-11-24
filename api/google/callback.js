import { loadConfig } from '../../lib/config.js';
import { guard, errorPage, appRedirectPage } from '../../lib/http.js';
import { readState, makeTicket, makeExchangeCode, emailFromIdToken } from '../../lib/oauth.js';

export default async function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['GET'], auth: false })) return;
  const { code, state, error } = req.query || {};
  if (error) return errorPage(res, 400, `Google menolak akses: ${error}`);
  const st = readState(config, state, 'google');
  if (!st || !code) return errorPage(res, 400, 'State tidak valid atau sudah kedaluwarsa. Ulangi login dari aplikasi.');
  let data;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(code), client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: `${config.baseUrl}/api/google/callback`, grant_type: 'authorization_code' })
    });
    data = await response.json();
    if (!response.ok) return errorPage(res, 502, `Penukaran kode gagal: ${data.error_description || data.error || response.status}`);
  } catch { return errorPage(res, 502, 'Tidak dapat menghubungi Google.'); }
  if (!data.refresh_token) return errorPage(res, 502, 'Google tidak memberi refresh token. Cabut akses aplikasi di myaccount.google.com/permissions lalu ulangi.');
  const email = emailFromIdToken(data.id_token);
  const ticket = makeTicket(config, 'google', { rt: data.refresh_token, scope: data.scope || '' });
  const blob = makeExchangeCode(config, { ticket, challenge: st.c, provider: 'google', email });
  appRedirectPage(res, `${config.appRedirect}?provider=google&code=${encodeURIComponent(blob)}&state=${encodeURIComponent(st.s)}`);
}
