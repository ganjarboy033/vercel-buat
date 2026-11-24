import { seal, open } from './crypto.js';

const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

/** State OAuth terenkripsi: mengikat provider, state dari aplikasi, dan PKCE challenge selama 10 menit. */
export const makeState = (config, { provider, appState, challenge }) =>
  seal({ p: provider, s: appState, c: challenge, t: Date.now() }, config.bridgeSecret, 'state');

export function readState(config, token, provider) {
  const data = open(token, config.bridgeSecret, 'state');
  if (!data || data.p !== provider || Date.now() - data.t > TEN_MIN) return null;
  return data;
}

/** Tiket jangka panjang (berisi refresh/access token terenkripsi). Hanya server yang dapat membukanya. */
export const makeTicket = (config, provider, secrets) =>
  seal({ p: provider, ...secrets, iat: Date.now(), exp: Date.now() + config.ticketTtlMs }, config.bridgeSecret, 'ticket');

export function readTicket(config, ticket, provider) {
  const data = open(ticket, config.bridgeSecret, 'ticket');
  if (!data || data.p !== provider || data.exp < Date.now()) return null;
  return data;
}

/** Kode penukar singkat (5 menit) yang hanya dapat ditukar bersama PKCE verifier. */
export const makeExchangeCode = (config, { ticket, challenge, provider, email }) =>
  seal({ k: ticket, c: challenge, p: provider, e: email || '', exp: Date.now() + FIVE_MIN }, config.bridgeSecret, 'code');

export function readExchangeCode(config, code) {
  const data = open(code, config.bridgeSecret, 'code');
  if (!data || data.exp < Date.now()) return null;
  return data;
}

export function emailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email : '';
  } catch { return ''; }
}

export function redirect(res, url) {
  res.setHeader('Location', url);
  res.status(302).end();
}
