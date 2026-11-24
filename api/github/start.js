import { loadConfig } from '../../lib/config.js';
import { guard, errorPage } from '../../lib/http.js';
import { isChallenge } from '../../lib/crypto.js';
import { makeState, redirect } from '../../lib/oauth.js';

export default function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['GET'], auth: false })) return;
  if (!config.github.clientId || !config.github.clientSecret) return errorPage(res, 503, 'GitHub OAuth belum dikonfigurasi di server (GITHUB_CLIENT_ID/SECRET).');
  const { state, challenge, scope } = req.query || {};
  if (!state || String(state).length > 128 || !isChallenge(challenge)) return errorPage(res, 400, 'Parameter state atau challenge tidak valid.');
  const safeScope = String(scope || config.github.defaultScope).replace(/[^A-Za-z0-9:_, -]/g, '').slice(0, 100);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: config.github.clientId, redirect_uri: `${config.baseUrl}/api/github/callback`, scope: safeScope,
    state: makeState(config, { provider: 'github', appState: String(state), challenge: String(challenge) })
  }).toString();
  redirect(res, url.toString());
}
