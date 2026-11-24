import { loadConfig } from '../../lib/config.js';
import { guard, send, body } from '../../lib/http.js';
import { readTicket } from '../../lib/oauth.js';

export default async function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['POST'] })) return;
  const ticket = readTicket(config, body(req).ticket, 'google');
  if (!ticket) return send(res, 401, { error: 'TICKET_INVALID', message: 'Tiket tidak valid atau kedaluwarsa. Login ulang dari aplikasi.' });
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.google.clientId, client_secret: config.google.clientSecret, refresh_token: ticket.rt, grant_type: 'refresh_token' })
    });
    const data = await response.json();
    if (!response.ok) {
      const revoked = data.error === 'invalid_grant';
      return send(res, revoked ? 401 : 502, { error: revoked ? 'TICKET_REVOKED' : 'GOOGLE_ERROR', message: data.error_description || data.error || 'Gagal memperbarui token.' });
    }
    send(res, 200, { access_token: data.access_token, expires_in: data.expires_in, token_type: data.token_type, scope: data.scope || ticket.scope });
  } catch { send(res, 502, { error: 'GOOGLE_UNREACHABLE', message: 'Tidak dapat menghubungi Google.' }); }
}
