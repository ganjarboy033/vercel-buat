import { loadConfig } from '../../lib/config.js';
import { guard, send, body } from '../../lib/http.js';

/** Proxy Telegram Bot API (JSON) dengan token di server dan allowlist metode. Tidak untuk unggah file besar (batas body Vercel ±4,5 MB). */
export default async function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['POST'] })) return;
  const method = String(req.query?.method || '');
  if (!/^[A-Za-z]{2,40}$/.test(method) || !config.telegram.allowed.has(method)) return send(res, 403, { error: 'METHOD_NOT_ALLOWED', message: 'Metode Telegram tidak diizinkan oleh server.' });
  if (!config.telegram.token) return send(res, 503, { error: 'TELEGRAM_NOT_CONFIGURED', message: 'TELEGRAM_BOT_TOKEN belum diatur di server.' });
  try {
    const upstream = await fetch(`https://api.telegram.org/bot${config.telegram.token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body(req))
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status).send(text);
  } catch { send(res, 502, { error: 'TELEGRAM_UNREACHABLE', message: 'Tidak dapat menghubungi Telegram.' }); }
}
