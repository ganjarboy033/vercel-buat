import { loadConfig, providerStatus } from '../lib/config.js';

export default function handler(_req, res) {
  const config = loadConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: config.ok, service: 'nexora-link', version: '1.1.0', time: new Date().toISOString(), providers: providerStatus(config), problems: config.ok ? [] : config.problems });
}
