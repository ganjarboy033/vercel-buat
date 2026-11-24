import { loadConfig, providerStatus } from '../lib/config.js';
import { guard, send } from '../lib/http.js';

export default function handler(req, res) {
  const config = loadConfig();
  if (!guard(req, res, config, { methods: ['GET'] })) return;
  send(res, 200, {
    service: 'nexora-link', version: '1.0.0', providers: providerStatus(config), redirect: config.appRedirect,
    googleScopeAliases: ['drive', 'drive_file', 'photos_upload', 'photos_appdata', 'photos_picker'],
    telegramMethods: [...config.telegram.allowed]
  });
}
