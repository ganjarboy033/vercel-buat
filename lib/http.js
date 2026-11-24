import { safeEqual } from './crypto.js';

const hits = new Map();

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

/** Validasi metode, rate limit (best-effort per instance), dan kunci aplikasi. Mengembalikan true bila boleh lanjut. */
export function guard(req, res, config, { methods, auth = true }) {
  if (!config.ok) { send(res, 503, { error: 'NOT_CONFIGURED', message: 'Server belum dikonfigurasi.', problems: config.problems }); return false; }
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return false; }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const bucket = Math.floor(Date.now() / 60000);
  const key = `${ip}:${bucket}`;
  const count = (hits.get(key) || 0) + 1;
  hits.set(key, count);
  if (hits.size > 5000) for (const k of hits.keys()) if (!k.endsWith(`:${bucket}`)) hits.delete(k);
  if (count > config.ratePerMinute) { send(res, 429, { error: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' }); return false; }
  if (auth && !safeEqual(req.headers['x-nexora-key'] || '', config.apiKey)) { send(res, 401, { error: 'UNAUTHORIZED', message: 'Kunci API tidak valid.' }); return false; }
  return true;
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Halaman perantara yang membuka deep link aplikasi (lebih andal daripada redirect 302 ke skema kustom). */
export function appRedirectPage(res, url, title = 'Kembali ke Nexora Cloud') {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta http-equiv="refresh" content="0;url=${esc(url)}"></head><body style="font-family:system-ui;text-align:center;padding:40px;background:#101820;color:#e7edf4">
<h2>${esc(title)}</h2><p>Jika aplikasi tidak terbuka otomatis, ketuk tombol di bawah.</p>
<p><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#2787c7;color:#fff;text-decoration:none">Buka Nexora Cloud</a></p>
<script>setTimeout(function(){location.href=${JSON.stringify(url)}},50)</script></body></html>`);
}

export function errorPage(res, status, message) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:32px;background:#101820;color:#e7edf4"><h3>Login gagal</h3><p>${esc(message)}</p></body>`);
}
