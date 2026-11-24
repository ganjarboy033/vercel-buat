import { loadConfig } from '../../lib/config.js';
import { guard, send, body } from '../../lib/http.js';
import { readTicket } from '../../lib/oauth.js';

export default async function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['POST'] })) return;
  const ticket = readTicket(config, body(req).ticket, 'google');
  if (!ticket) return send(res, 401, { error: 'TICKET_INVALID' });
  try {
    await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: ticket.rt }) });
  } catch { /* tiket tetap dianggap dicabut dari sisi aplikasi */ }
  send(res, 200, { ok: true });
}
