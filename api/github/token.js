import { loadConfig } from '../../lib/config.js';
import { guard, send, body } from '../../lib/http.js';
import { readTicket } from '../../lib/oauth.js';

export default function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['POST'] })) return;
  const ticket = readTicket(config, body(req).ticket, 'github');
  if (!ticket) return send(res, 401, { error: 'TICKET_INVALID', message: 'Tiket tidak valid atau kedaluwarsa. Login ulang dari aplikasi.' });
  send(res, 200, { access_token: ticket.at, token_type: 'bearer', scope: ticket.scope });
}
