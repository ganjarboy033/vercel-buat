import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const keyFor = (secret, purpose) => createHash('sha256').update(`nexora-link:${purpose}:${secret}`).digest();

/** Enkripsi + autentikasi (AES-256-GCM). [purpose] terikat sebagai AAD sehingga tiket tidak bisa dipakai sebagai kode/state. */
export function seal(payload, secret, purpose) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret, purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), data.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

/** Mengembalikan payload atau null bila rusak/dimanipulasi/salah tujuan. */
export function open(token, secret, purpose) {
  try {
    const [version, iv, data, tag] = String(token).split('.');
    if (version !== 'v1' || !iv || !data || !tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret, purpose), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch { return null; }
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** PKCE S256: base64url(SHA-256(verifier)). */
export function pkceChallenge(verifier) {
  return createHash('sha256').update(String(verifier)).digest('base64url');
}

export const isChallenge = (v) => /^[A-Za-z0-9_-]{43}$/.test(String(v || ''));
