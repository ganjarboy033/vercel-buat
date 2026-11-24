import { loadConfig, resolveGoogleScopes } from '../../lib/config.js';
import { guard, errorPage } from '../../lib/http.js';
import { isChallenge } from '../../lib/crypto.js';
import { makeState, redirect } from '../../lib/oauth.js';

export default function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['GET'], auth: false })) return;
  if (!config.google.clientId || !config.google.clientSecret) return errorPage(res, 503, 'Google belum dikonfigurasi di server (GOOGLE_CLIENT_ID/SECRET).');
  const { state, challenge, scope } = req.query || {};
  if (!state || String(state).length > 128 || !isChallenge(challenge)) return errorPage(res, 400, 'Parameter state atau challenge tidak valid.');
  let scopes;
  try { scopes = resolveGoogleScopes(scope, config.google.defaultScopes); } catch (e) { return errorPage(res, 400, e.message); }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.google.clientId, redirect_uri: `${config.baseUrl}/api/google/callback`, response_type: 'code',
    scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    state: makeState(config, { provider: 'google', appState: String(state), challenge: String(challenge) })
  }).toString();
  redirect(res, url.toString());
}
