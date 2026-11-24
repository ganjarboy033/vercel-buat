const GOOGLE_SCOPE_ALIASES = {
  drive: 'https://www.googleapis.com/auth/drive',
  drive_file: 'https://www.googleapis.com/auth/drive.file',
  photos_upload: 'https://www.googleapis.com/auth/photoslibrary.appendonly',
  photos_appdata: 'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  photos_picker: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
};

export function resolveGoogleScopes(input, fallback) {
  const raw = String(input || fallback || '').split(/[\s,]+/).filter(Boolean);
  const urls = raw.map((s) => GOOGLE_SCOPE_ALIASES[s] || (s.startsWith('https://www.googleapis.com/auth/') ? s : null));
  if (urls.some((u) => u === null)) throw new Error('Scope Google tidak dikenal.');
  return [...new Set(['openid', 'email', ...urls])];
}

export function loadConfig(env = process.env) {
  const apiKey = env.NEXORA_API_KEY || '';
  const bridgeSecret = env.BRIDGE_SECRET || '';
  const baseUrl = (env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const problems = [];
  if (apiKey.length < 32) problems.push('NEXORA_API_KEY wajib minimal 32 karakter');
  if (bridgeSecret.length < 32) problems.push('BRIDGE_SECRET wajib minimal 32 karakter');
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/localhost/.test(baseUrl)) problems.push('PUBLIC_BASE_URL wajib diawali https://');
  return {
    ok: problems.length === 0,
    problems,
    apiKey,
    bridgeSecret,
    baseUrl,
    appRedirect: env.APP_REDIRECT_URI || 'nexoracloud://link',
    ticketTtlMs: Math.max(1, Number(env.TICKET_TTL_DAYS || 180)) * 86400000,
    ratePerMinute: Math.max(1, Number(env.RATE_LIMIT_PER_MINUTE || 60)),
    google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '', defaultScopes: env.GOOGLE_DEFAULT_SCOPES || 'drive_file,photos_upload,photos_picker' },
    github: { clientId: env.GITHUB_CLIENT_ID || '', clientSecret: env.GITHUB_CLIENT_SECRET || '', defaultScope: env.GITHUB_DEFAULT_SCOPE || 'repo' },
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN || '',
      allowed: new Set((env.ALLOWED_TELEGRAM_METHODS || 'getMe,getChat,getChatMember,getFile,sendMessage,sendDocument,copyMessage,forwardMessage,deleteMessage,editMessageCaption').split(',').map((s) => s.trim()).filter(Boolean))
    }
  };
}

export function providerStatus(config) {
  return {
    google: Boolean(config.google.clientId && config.google.clientSecret),
    github: Boolean(config.github.clientId && config.github.clientSecret),
    telegram: Boolean(config.telegram.token)
  };
}
