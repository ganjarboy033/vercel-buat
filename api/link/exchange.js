import { loadConfig } from '../../lib/config.js';
import { guard, send, body } from '../../lib/http.js';
import { pkceChallenge, safeEqual } from '../../lib/crypto.js';
import { readExchangeCode } from '../../lib/oauth.js';

/** Menukar kode dari deep link dengan tiket, hanya jika PKCE verifier cocok (mencegah pembajakan deep link). */
export default function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['POST'] })) return;
  const { code, verifier } = body(req);
  const data = readExchangeCode(config, code);
  if (!data) return send(res, 400, { error: 'CODE_INVALID', message: 'Kode tidak valid atau kedaluwarsa. Ulangi login.' });
  if (!verifier || String(verifier).length < 43 || !safeEqual(pkceChallenge(verifier), data.c)) return send(res, 403, { error: 'VERIFIER_MISMATCH', message: 'Verifikasi PKCE gagal.' });
  send(res, 200, { ticket: data.k, provider: data.p, email: data.e || '' });
}
