import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

 test('dashboard static entry exists at the Vercel project root', () => {
  assert.ok(existsSync(resolve(root, 'index.html')));
  assert.ok(existsSync(resolve(root, 'assets/css/styles.css')));
  assert.ok(existsSync(resolve(root, 'assets/js/app.js')));
  assert.ok(!existsSync(resolve(root, 'nexora-link-vercel/index.html')));
});

test('Vercel routes keep health alias and do not rewrite API paths to the dashboard', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  assert.ok(config.functions['api/**/*.js']);
  assert.ok(config.rewrites.some((rule) => rule.source === '/health' && rule.destination === '/api/health'));
  assert.ok(!config.rewrites.some((rule) => rule.source === '/:path*' || rule.source === '/(.*)'));
});

test('all original Nexora Link function routes remain present', () => {
  const expected = [
    'api/health.js', 'api/info.js', 'api/google/start.js', 'api/google/callback.js',
    'api/google/token.js', 'api/google/revoke.js', 'api/github/start.js',
    'api/github/callback.js', 'api/github/token.js', 'api/link/exchange.js',
    'api/telegram/[method].js'
  ];
  for (const file of expected) assert.ok(existsSync(resolve(root, file)), `${file} should remain in the project`);
});

test('dashboard includes theme, local system settings, and setup guide sections', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  for (const marker of ['page-theme', 'page-integrations', 'page-system', 'page-guide', 'exportConfig', 'importConfigButton', 'bridgeUrlInput', 'apiKeyInput', 'testTelegramButton']) {
    assert.ok(html.includes(marker), `missing dashboard element: ${marker}`);
  }
});
