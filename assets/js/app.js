(() => {
  'use strict';

  const STORAGE_KEY = 'nexora-link-control-center-v2';
  const DEFAULTS = {
    version: 2,
    theme: {
      mode: 'dark', accent: '#9B7CFF', background: '#0C1020', card: '#151A2D', text: '#F4F2FF',
      radius: 18, blur: 16, fontScale: 100, navMode: 'bottom', glass: true,
      brandName: 'Nexora Link', brandSubtitle: 'Control Center', logoUrl: '', preset: 'aurora'
    },
    system: {
      bridgeUrl: '', apiKey: '', cloudBackendUrl: '', githubApiBase: 'https://api.github.com', webhookUrl: '',
      uploadLimitMb: 0, timeoutSeconds: 20, logRetention: 50, autoSave: true, logging: true
    },
    logs: []
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let config = loadConfig();
  let serverSnapshot = null;
  let currentPage = 'overview';

  function loadConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored || typeof stored !== 'object') return clone(DEFAULTS);
      return {
        ...clone(DEFAULTS), ...stored,
        theme: { ...clone(DEFAULTS.theme), ...(stored.theme || {}) },
        system: { ...clone(DEFAULTS.system), ...(stored.system || {}) },
        logs: Array.isArray(stored.logs) ? stored.logs.slice(0, 200) : []
      };
    } catch {
      return clone(DEFAULTS);
    }
  }

  function persist(force = false) {
    if (!config.system.autoSave && !force) return;
    const limit = Number(config.system.logRetention) || 50;
    config.logs = config.logs.slice(0, limit);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
    catch { toast('Penyimpanan browser penuh atau diblokir.', 'error'); }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function toast(message, type = 'info') {
    const region = $('#toastRegion');
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), 3400);
  }

  function addLog(type, message, path = '—') {
    if (!config.system.logging) return;
    config.logs.unshift({ at: new Date().toISOString(), type, message, path });
    config.logs = config.logs.slice(0, Number(config.system.logRetention) || 50);
    persist();
    renderLogs();
    renderActivityPreview();
  }

  function cssRgb(hex) {
    const clean = String(hex).replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = Number.parseInt(full, 16);
    if (!Number.isFinite(num)) return '155,124,255';
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
  }

  function applyTheme() {
    const t = config.theme;
    document.body.dataset.mode = ['dark', 'light', 'amoled'].includes(t.mode) ? t.mode : 'dark';
    document.body.dataset.nav = t.navMode === 'sidebar' ? 'sidebar' : 'bottom';
    document.body.classList.toggle('no-glass', !t.glass);
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-rgb', cssRgb(t.accent));
    root.style.setProperty('--bg', t.background);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--radius', `${Number(t.radius) || 0}px`);
    root.style.setProperty('--blur', `${Number(t.blur) || 0}px`);
    root.style.setProperty('--font-scale', `${Number(t.fontScale) || 100}%`);
    $('#brandName').textContent = t.brandName || 'Nexora Link';
    $('#brandSubtitle').textContent = t.brandSubtitle || 'Control Center';
    $('#brandFallback').textContent = (t.brandName || 'N').trim().charAt(0).toUpperCase() || 'N';
    $('#topBrandAvatar').textContent = (t.brandName || 'N').trim().charAt(0).toUpperCase() || 'N';
    const logo = $('#brandLogo');
    const logoUrl = validImageUrl(t.logoUrl);
    if (logoUrl) {
      logo.src = logoUrl;
      logo.hidden = false;
      $('#brandFallback').hidden = true;
      logo.onerror = () => { logo.hidden = true; $('#brandFallback').hidden = false; };
    } else {
      logo.removeAttribute('src'); logo.hidden = true; $('#brandFallback').hidden = false;
    }
    $$('.mode-switch button').forEach((button) => button.classList.toggle('selected', button.dataset.modeChoice === t.mode));
    $$('.preset-card').forEach((button) => button.classList.toggle('selected', button.dataset.preset === t.preset));
    updateThemeForm();
  }

  function validImageUrl(value) {
    if (!value) return '';
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }

  function updateThemeForm() {
    const t = config.theme;
    for (const [id, value] of Object.entries({ accentColor: t.accent, backgroundColor: t.background, cardColor: t.card, textColor: t.text })) {
      const input = $(`#${id}`); if (input) input.value = value;
    }
    $('#accentText').value = t.accent; $('#backgroundText').value = t.background; $('#cardText').value = t.card; $('#textText').value = t.text;
    $('#radiusRange').value = t.radius; $('#radiusOutput').textContent = `${t.radius} px`;
    $('#blurRange').value = t.blur; $('#blurOutput').textContent = `${t.blur} px`;
    $('#fontRange').value = t.fontScale; $('#fontOutput').textContent = `${t.fontScale}%`;
    $('#navMode').value = t.navMode; $('#glassToggle').checked = !!t.glass;
    $('#brandTitleInput').value = t.brandName; $('#brandSubtitleInput').value = t.brandSubtitle; $('#brandLogoInput').value = t.logoUrl;
  }

  function updateSystemForm() {
    const s = config.system;
    $('#bridgeUrlInput').value = s.bridgeUrl || location.origin;
    $('#apiKeyInput').value = s.apiKey || '';
    $('#cloudBackendInput').value = s.cloudBackendUrl || '';
    $('#githubApiInput').value = s.githubApiBase || 'https://api.github.com';
    $('#webhookInput').value = s.webhookUrl || '';
    $('#uploadLimitInput').value = s.uploadLimitMb;
    $('#timeoutInput').value = s.timeoutSeconds;
    $('#logRetentionInput').value = s.logRetention;
    $('#autoSaveToggle').checked = !!s.autoSave;
    $('#loggingToggle').checked = !!s.logging;
  }

  function updateThemeValue(key, value, save = true) {
    config.theme[key] = value;
    if (key !== 'preset' && ['accent', 'background', 'card', 'text'].includes(key)) config.theme.preset = 'custom';
    applyTheme();
    if (save) persist();
  }

  function updateSystemValue(key, value, force = false) {
    config.system[key] = value;
    if (key === 'logRetention') config.logs = config.logs.slice(0, Number(value) || 50);
    if (key !== 'autoSave') persist(force);
    renderLogs();
    renderActivityPreview();
  }

  function setPage(page) {
    const target = $(`#page-${page}`);
    if (!target) return;
    currentPage = page;
    $$('.page').forEach((section) => section.classList.toggle('active', section === target));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
    $('#pageTitle').textContent = target.dataset.title || 'Nexora Link';
    document.title = `${target.dataset.title || 'Nexora Link'} — ${config.theme.brandName || 'Nexora Link'}`;
    closeMobileNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'system') { renderLogs(); renderDiagnostics(); }
  }

  function openMobileNav() {
    if (window.matchMedia('(max-width: 680px)').matches && config.theme.navMode !== 'bottom') {
      $('#sidebar').classList.add('open'); $('#mobileOverlay').classList.add('show');
    } else if (window.matchMedia('(max-width: 680px)').matches && config.theme.navMode === 'bottom') {
      $('#sidebar').classList.remove('open');
      toast('Pilih menu pada Bottom Tab di bagian bawah.');
    }
  }
  function closeMobileNav() { $('#sidebar').classList.remove('open'); $('#mobileOverlay').classList.remove('show'); }

  function getBridgeBase() {
    const raw = String(config.system.bridgeUrl || location.origin).trim().replace(/\/+$/, '');
    const url = new URL(raw, location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL Nexora Link harus menggunakan HTTPS (atau HTTP untuk localhost).');
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('Gunakan HTTPS untuk server publik.');
    return url.href.replace(/\/+$/, '');
  }

  function timeoutFetch(url, options = {}) {
    const controller = new AbortController();
    const seconds = Math.min(180, Math.max(3, Number(config.system.timeoutSeconds) || 20));
    const timer = window.setTimeout(() => controller.abort(), seconds * 1000);
    return fetch(url, { ...options, signal: controller.signal, cache: 'no-store' }).finally(() => window.clearTimeout(timer));
  }

  async function readJson(response) {
    const raw = await response.text();
    try { return raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(`Respons bukan JSON (HTTP ${response.status}).`); }
  }

  function setStatus(ok, label, detail = '') {
    const dotClass = ok === true ? 'good' : ok === false ? 'bad' : 'pending';
    ['sidebarDot', 'topStatusDot'].forEach((id) => { const el = $(`#${id}`); el.className = `status-dot ${dotClass}`; });
    $('#sidebarStatusText').textContent = label;
    $('#topStatusText').textContent = label;
    $('#serverMetric').textContent = ok === true ? 'ONLINE' : ok === false ? 'OFFLINE' : 'WAIT';
    $('#serverMetricFoot').textContent = detail || (ok === true ? 'Health endpoint merespons' : ok === false ? 'Periksa konfigurasi server' : 'Menunggu pemeriksaan');
  }

  function setProvider(provider, enabled) {
    const label = enabled ? 'Aktif' : 'Belum diatur';
    const cls = enabled ? 'good' : 'neutral';
    const ids = {
      google: ['googlePill', 'googleStatusCard', 'googleMetric'],
      github: ['githubPill', 'githubStatusCard', 'githubMetric'],
      telegram: ['telegramPill', 'telegramStatusCard', 'telegramMetric']
    };
    (ids[provider] || []).forEach((id) => {
      const el = $(`#${id}`); if (!el) return;
      if (id.endsWith('Metric')) { el.textContent = enabled ? 'AKTIF' : 'SETUP'; return; }
      el.textContent = label; el.className = `mini-status ${cls}`;
    });
  }

  function renderDiagnostics() {
    if (!serverSnapshot) return;
    const { health, info, checkedAt, issue } = serverSnapshot;
    const ok = Boolean(health && health.ok && !issue);
    const root = $('#diagnosticSummary');
    root.className = `diagnostic-summary ${ok ? 'ok' : 'fail'}`;
    const problems = health?.problems || [];
    root.innerHTML = `<div class="diagnostic-main"><span>${ok ? '✓' : '!'}</span><div><strong>${ok ? 'Server Nexora Link siap' : 'Server belum siap / belum terjangkau'}</strong><small>${escapeHTML(issue || (health ? `HTTP 200 · ${health.service || 'nexora-link'} · diperiksa ${new Date(checkedAt).toLocaleTimeString('id-ID')}` : 'Belum ada data health check'))}</small></div></div>${problems.length ? `<div class="diagnostic-problems">${problems.map(escapeHTML).join('<br>')}</div>` : ''}`;
    const providers = health?.providers || info?.providers || {};
    $('#providerDetails').innerHTML = ['google', 'github', 'telegram'].map((name) => `<div class="provider-detail"><b>${name.toUpperCase()}</b><span>${providers[name] ? 'Terkonfigurasi' : 'Belum diatur'}</span></div>`).join('');
  }

  async function pingBridge() {
    let base;
    try { base = getBridgeBase(); }
    catch (error) { setStatus(false, 'URL tidak valid', error.message); addLog('error', error.message, '/health'); toast(error.message, 'error'); return false; }
    $('#topStatusText').textContent = 'Checking';
    try {
      const response = await timeoutFetch(`${base}/health`);
      const data = await readJson(response);
      serverSnapshot = { health: data, info: serverSnapshot?.info || null, checkedAt: new Date().toISOString(), issue: response.ok ? '' : `HTTP ${response.status}` };
      if (!response.ok || !data.ok) {
        const why = data.problems?.join('; ') || data.message || `HTTP ${response.status}`;
        setStatus(false, 'Perlu konfigurasi', why);
        addLog('error', `Health check gagal: ${why}`, '/health');
        renderDiagnostics();
        toast(`Server merespons, tetapi belum siap: ${why}`, 'error');
        return false;
      }
      setStatus(true, 'Server online', 'Health endpoint merespons');
      ['google', 'github', 'telegram'].forEach((name) => setProvider(name, Boolean(data.providers?.[name])));
      addLog('success', 'Ping server berhasil', '/health');
      renderDiagnostics();
      toast('Nexora Link merespons dengan status OK.', 'success');
      return true;
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Waktu koneksi habis.' : (error.message || 'Tidak dapat menghubungi server.');
      serverSnapshot = { health: null, info: null, checkedAt: new Date().toISOString(), issue: message };
      setStatus(false, 'Tidak terhubung', message);
      ['google', 'github', 'telegram'].forEach((name) => setProvider(name, false));
      addLog('error', `Ping gagal: ${message}`, '/health');
      renderDiagnostics();
      toast(`Ping gagal: ${message}`, 'error');
      return false;
    }
  }

  async function testApiKey() {
    const key = String(config.system.apiKey || '').trim();
    if (!key) { toast('Masukkan NEXORA_API_KEY terlebih dahulu.', 'error'); return; }
    try {
      const base = getBridgeBase();
      const response = await timeoutFetch(`${base}/api/info`, { headers: { 'x-nexora-key': key } });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
      serverSnapshot = { ...(serverSnapshot || {}), info: data, checkedAt: new Date().toISOString(), issue: serverSnapshot?.issue || '' };
      ['google', 'github', 'telegram'].forEach((name) => setProvider(name, Boolean(data.providers?.[name])));
      addLog('success', 'API key diterima oleh /api/info', '/api/info');
      renderDiagnostics();
      toast('API key valid. /api/info berhasil diakses.', 'success');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Waktu koneksi habis.' : error.message;
      addLog('error', `Tes API key gagal: ${message}`, '/api/info');
      toast(`Tes API key gagal: ${message}`, 'error');
    }
  }

  async function testTelegram() {
    const key = String(config.system.apiKey || '').trim();
    if (!key) { toast('Masukkan NEXORA_API_KEY terlebih dahulu.', 'error'); return; }
    try {
      const base = getBridgeBase();
      const response = await timeoutFetch(`${base}/api/telegram/getMe`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-nexora-key': key }, body: '{}'
      });
      const data = await readJson(response);
      if (!response.ok || data.ok === false) throw new Error(data.description || data.message || data.error || `HTTP ${response.status}`);
      addLog('success', 'Telegram Bot API getMe berhasil', '/api/telegram/getMe');
      toast('Telegram Bot API terhubung. Token bot tetap berada di server.', 'success');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Waktu koneksi habis.' : error.message;
      addLog('error', `Tes Telegram gagal: ${message}`, '/api/telegram/getMe');
      toast(`Tes Telegram gagal: ${message}`, 'error');
    }
  }

  async function testBackend() {
    const raw = String(config.system.cloudBackendUrl || '').trim();
    if (!raw) { toast('Isi Nexora Cloud Backend URL terlebih dahulu.', 'error'); return; }
    try {
      const url = new URL(raw);
      const response = await timeoutFetch(`${url.href.replace(/\/+$/, '')}/health`);
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('json') ? await readJson(response) : await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      addLog('success', 'Backend Nexora merespons', `${url.origin}/health`);
      toast('Backend Nexora merespons. Periksa detail health di log layanan bila diperlukan.', 'success');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Waktu koneksi habis.' : error.message;
      addLog('error', `Tes backend gagal: ${message}`, '/health');
      toast(`Tes backend gagal: ${message}. Cek URL dan izin CORS.`, 'error');
    }
  }

  async function testWebhook() {
    const raw = String(config.system.webhookUrl || '').trim();
    if (!raw) { toast('Isi Webhook URL terlebih dahulu.', 'error'); return; }
    try {
      const url = new URL(raw);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Webhook harus memakai HTTP/HTTPS.');
      const response = await timeoutFetch(url.href, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'nexora.dashboard.test', source: 'nexora-link-control-center', sent_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      addLog('success', 'Test webhook terkirim', url.origin);
      toast('Webhook menerima request uji.', 'success');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Waktu koneksi habis.' : error.message;
      addLog('error', `Test webhook gagal: ${message}`, 'webhook');
      toast(`Webhook gagal: ${message}. Endpoint mungkin menolak CORS.`, 'error');
    }
  }

  function renderLogs() {
    const rows = $('#logsBody');
    const logs = config.logs || [];
    if (!logs.length) { rows.innerHTML = '<tr><td colspan="4" class="empty-cell">Belum ada log.</td></tr>'; return; }
    rows.innerHTML = logs.map((item) => {
      const date = new Date(item.at);
      const stamp = Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('id-ID');
      const cls = item.type === 'error' ? 'error' : item.type === 'success' ? 'success' : '';
      return `<tr><td>${escapeHTML(stamp)}</td><td><span class="log-type ${cls}">${escapeHTML(String(item.type || 'info').toUpperCase())}</span></td><td>${escapeHTML(item.message)}</td><td>${escapeHTML(item.path)}</td></tr>`;
    }).join('');
  }

  function renderActivityPreview() {
    const target = $('#activityPreview');
    const recent = (config.logs || []).slice(0, 4);
    if (!recent.length) { target.innerHTML = '<div class="empty-state compact"><span>◷</span><p>Belum ada aktivitas. Jalankan ping untuk memulai.</p></div>'; return; }
    target.innerHTML = recent.map((item) => {
      const date = new Date(item.at);
      const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const icon = item.type === 'error' ? '!' : item.type === 'success' ? '✓' : '·';
      return `<div class="activity-item"><span class="activity-symbol">${icon}</span><div class="activity-copy"><strong>${escapeHTML(item.message)}</strong><small>${escapeHTML(item.path)}</small></div><span class="activity-time">${escapeHTML(when)}</span></div>`;
    }).join('');
  }

  function applyPreset(name) {
    const presets = {
      aurora: { accent: '#9B7CFF', background: '#0C1020', card: '#151A2D', text: '#F4F2FF', mode: 'dark' },
      ocean: { accent: '#42C7ED', background: '#081725', card: '#10283B', text: '#ECF8FF', mode: 'dark' },
      emerald: { accent: '#48D5A4', background: '#091A19', card: '#102A27', text: '#EFFBF6', mode: 'dark' },
      sunset: { accent: '#FF9B72', background: '#211321', card: '#302034', text: '#FFF3F0', mode: 'dark' }
    };
    const preset = presets[name]; if (!preset) return;
    Object.assign(config.theme, preset, { preset: name });
    applyTheme(); persist(); toast(`Preset ${name} diterapkan.`, 'success');
  }

  function handleColor(hexInput, textInput, key) {
    const valid = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const apply = (value) => {
      if (!valid.test(value)) return false;
      const normal = value.length === 4 ? `#${value.slice(1).split('').map((c) => c + c).join('')}` : value.toUpperCase();
      updateThemeValue(key, normal);
      return true;
    };
    $(`#${hexInput}`).addEventListener('input', (event) => {
      $(`#${textInput}`).value = event.target.value.toUpperCase(); apply(event.target.value);
    });
    $(`#${textInput}`).addEventListener('change', (event) => {
      const value = event.target.value.trim();
      if (!apply(value)) { event.target.value = config.theme[key]; toast('Kode warna harus berupa HEX, misalnya #9B7CFF.', 'error'); }
      else $(`#${hexInput}`).value = config.theme[key];
    });
  }

  function exportConfig() {
    const includeSecrets = window.confirm('Export dengan API Key dan Webhook URL?\n\nPilih OK hanya jika file JSON akan disimpan secara aman. Pilih Batal untuk export tanpa data sensitif.');
    const exported = clone(config);
    exported.exported_at = new Date().toISOString();
    exported.exported_by = 'Nexora Link Control Center';
    if (!includeSecrets) {
      exported.system.apiKey = '';
      exported.system.webhookUrl = '';
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nexora-link-config-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    addLog('success', `Konfigurasi diekspor (${includeSecrets ? 'termasuk' : 'tanpa'} rahasia)`, 'config.json');
    toast('File konfigurasi berhasil dibuat.', 'success');
  }

  async function importConfig(file) {
    try {
      if (file.size > 1024 * 1024) throw new Error('Ukuran file terlalu besar (maksimal 1 MB).');
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== 'object' || !imported.theme || !imported.system) throw new Error('Format konfigurasi tidak dikenali.');
      const next = {
        ...clone(DEFAULTS), ...config,
        theme: { ...clone(DEFAULTS.theme), ...imported.theme },
        system: { ...clone(DEFAULTS.system), ...imported.system },
        logs: Array.isArray(imported.logs) ? imported.logs.slice(0, 200) : config.logs
      };
      if (!/^#[\da-f]{3}([\da-f]{3})?$/i.test(next.theme.accent)) next.theme.accent = DEFAULTS.theme.accent;
      if (!/^#[\da-f]{3}([\da-f]{3})?$/i.test(next.theme.background)) next.theme.background = DEFAULTS.theme.background;
      if (!/^#[\da-f]{3}([\da-f]{3})?$/i.test(next.theme.card)) next.theme.card = DEFAULTS.theme.card;
      if (!/^#[\da-f]{3}([\da-f]{3})?$/i.test(next.theme.text)) next.theme.text = DEFAULTS.theme.text;
      next.theme.radius = Math.min(32, Math.max(0, Number(next.theme.radius) || 0));
      next.theme.blur = Math.min(30, Math.max(0, Number(next.theme.blur) || 0));
      next.theme.fontScale = Math.min(120, Math.max(85, Number(next.theme.fontScale) || 100));
      config = next;
      applyTheme(); updateSystemForm(); persist(true); renderLogs(); renderActivityPreview();
      addLog('success', 'Konfigurasi berhasil diimpor', 'config.json');
      toast('Konfigurasi berhasil diimpor.', 'success');
    } catch (error) { toast(`Import gagal: ${error.message}`, 'error'); }
  }

  function resetConfig() {
    if (!window.confirm('Kembalikan semua tema, branding, endpoint, dan preferensi browser ke pengaturan awal? Server Vercel tidak akan diubah.')) return;
    config = clone(DEFAULTS);
    applyTheme(); updateSystemForm(); persist(true); renderLogs(); renderActivityPreview();
    serverSnapshot = null; setStatus(null, 'Belum diperiksa'); renderDiagnostics();
    toast('Pengaturan browser dikembalikan ke default.', 'success');
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast('Berhasil disalin.', 'success');
    } catch {
      const input = document.createElement('textarea'); input.value = value; document.body.append(input); input.select();
      const ok = document.execCommand('copy'); input.remove(); toast(ok ? 'Berhasil disalin.' : 'Tidak dapat menyalin otomatis.', ok ? 'success' : 'error');
    }
  }

  function readSystemForm() {
    const s = config.system;
    s.bridgeUrl = $('#bridgeUrlInput').value.trim().replace(/\/+$/, '');
    s.apiKey = $('#apiKeyInput').value.trim();
    s.cloudBackendUrl = $('#cloudBackendInput').value.trim().replace(/\/+$/, '');
    s.githubApiBase = $('#githubApiInput').value.trim().replace(/\/+$/, '') || 'https://api.github.com';
    s.webhookUrl = $('#webhookInput').value.trim();
    s.uploadLimitMb = Math.min(204800, Math.max(0, Number($('#uploadLimitInput').value) || 0));
    s.timeoutSeconds = Math.min(180, Math.max(3, Number($('#timeoutInput').value) || 20));
    s.logRetention = Number($('#logRetentionInput').value) || 50;
    updateGuideCallbacks();
    persist();
  }

  function bindEvents() {
    $$('.nav-item').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
    $$('[data-page-link]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); setPage(link.dataset.pageLink); }));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.go)));
    $('#mobileMenu').addEventListener('click', openMobileNav);
    $('#mobileOverlay').addEventListener('click', closeMobileNav);
    $('#topBrandAvatar').addEventListener('click', () => setPage('theme'));
    ['topRefresh', 'sidebarRefresh', 'overviewRefresh', 'integrationRefresh', 'diagnosticsRefresh'].forEach((id) => $(`#${id}`).addEventListener('click', pingBridge));

    $$('.mode-switch button').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.modeChoice;
      const palettes = {
        dark: { background: '#0C1020', card: '#151A2D', text: '#F4F2FF' },
        light: { background: '#F3F5FB', card: '#FFFFFF', text: '#25283D' },
        amoled: { background: '#000000', card: '#08090D', text: '#F8F8FA' }
      };
      Object.assign(config.theme, { mode, ...palettes[mode] }); applyTheme(); persist();
    }));
    $$('.preset-card').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
    handleColor('accentColor', 'accentText', 'accent'); handleColor('backgroundColor', 'backgroundText', 'background');
    handleColor('cardColor', 'cardText', 'card'); handleColor('textColor', 'textText', 'text');
    $('#radiusRange').addEventListener('input', (event) => { config.theme.radius = Number(event.target.value); $('#radiusOutput').textContent = `${config.theme.radius} px`; applyTheme(); persist(); });
    $('#blurRange').addEventListener('input', (event) => { config.theme.blur = Number(event.target.value); $('#blurOutput').textContent = `${config.theme.blur} px`; applyTheme(); persist(); });
    $('#fontRange').addEventListener('input', (event) => { config.theme.fontScale = Number(event.target.value); $('#fontOutput').textContent = `${config.theme.fontScale}%`; applyTheme(); persist(); });
    $('#navMode').addEventListener('change', (event) => updateThemeValue('navMode', event.target.value));
    $('#glassToggle').addEventListener('change', (event) => updateThemeValue('glass', event.target.checked));
    $('#brandTitleInput').addEventListener('input', (event) => updateThemeValue('brandName', event.target.value));
    $('#brandSubtitleInput').addEventListener('input', (event) => updateThemeValue('brandSubtitle', event.target.value));
    $('#brandLogoInput').addEventListener('change', (event) => {
      const value = event.target.value.trim();
      if (value && !validImageUrl(value)) { toast('URL logo harus berupa HTTP/HTTPS yang valid.', 'error'); event.target.value = config.theme.logoUrl; return; }
      updateThemeValue('logoUrl', value);
    });
    $('#exportConfig').addEventListener('click', exportConfig);
    $('#importConfigButton').addEventListener('click', () => $('#importConfigFile').click());
    $('#importConfigFile').addEventListener('change', (event) => { const [file] = event.target.files || []; if (file) importConfig(file); event.target.value = ''; });
    $('#resetConfig').addEventListener('click', resetConfig);

    $('#saveSystemSettings').addEventListener('click', () => {
      readSystemForm();
      persist(true); renderLogs(); renderActivityPreview();
      addLog('success', 'Konfigurasi endpoint lokal disimpan', 'localStorage');
      toast('Konfigurasi browser berhasil disimpan.', 'success');
    });
    ['bridgeUrlInput', 'apiKeyInput', 'cloudBackendInput', 'githubApiInput', 'webhookInput', 'uploadLimitInput', 'timeoutInput', 'logRetentionInput'].forEach((id) => {
      $(`#${id}`).addEventListener('input', () => { if (config.system.autoSave) readSystemForm(); });
      $(`#${id}`).addEventListener('change', () => { if (config.system.autoSave) readSystemForm(); });
    });
    $('#clearSecretFields').addEventListener('click', () => {
      if (!window.confirm('Kosongkan API Key dan Webhook URL yang tersimpan pada browser ini?')) return;
      config.system.apiKey = ''; config.system.webhookUrl = ''; updateSystemForm(); persist(true);
      addLog('info', 'API Key dan Webhook URL dikosongkan', 'localStorage');
      toast('Data sensitif lokal sudah dikosongkan.', 'success');
    });
    $('#autoSaveToggle').addEventListener('change', (event) => { config.system.autoSave = event.target.checked; persist(true); toast(event.target.checked ? 'Simpan otomatis diaktifkan.' : 'Simpan otomatis dimatikan. Tekan Simpan konfigurasi untuk menyimpan perubahan.', 'info'); });
    $('#loggingToggle').addEventListener('change', (event) => { config.system.logging = event.target.checked; persist(true); });
    $('#logRetentionInput').addEventListener('change', (event) => updateSystemValue('logRetention', Number(event.target.value), true));
    $('#testBridgeButton').addEventListener('click', pingBridge);
    $('#testInfoButton').addEventListener('click', testApiKey);
    $('#testTelegramButton').addEventListener('click', testTelegram);
    $('#testBackendButton').addEventListener('click', testBackend);
    $('#testWebhookButton').addEventListener('click', testWebhook);
    $('#clearLogsButton').addEventListener('click', () => { config.logs = []; persist(true); renderLogs(); renderActivityPreview(); toast('Log browser dibersihkan.', 'success'); });

    $$('[data-copy-path]').forEach((button) => button.addEventListener('click', () => {
      const path = button.dataset.copyPath;
      copyText(`${(config.system.bridgeUrl || location.origin).replace(/\/+$/, '')}${path}`);
    }));
    $$('.copy-callback').forEach((button) => button.addEventListener('click', () => copyText(`${(config.system.bridgeUrl || location.origin).replace(/\/+$/, '')}${button.dataset.copyValue}`)));
    $$('[data-copy-value]').filter((button) => !button.classList.contains('copy-callback')).forEach((button) => button.addEventListener('click', () => copyText(button.dataset.copyValue)));
    $$('[data-reveal]').forEach((button) => button.addEventListener('click', () => {
      const input = $(`#${button.dataset.reveal}`); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Lihat' : 'Sembunyi';
    }));
  }

  function updateGuideCallbacks() {
    const base = String(config.system.bridgeUrl || location.origin).replace(/\/+$/, '');
    $('#googleCallbackGuide').textContent = `${base}/api/google/callback`;
    $('#githubCallbackGuide').textContent = `${base}/api/github/callback`;
  }

  function init() {
    applyTheme(); updateSystemForm(); updateGuideCallbacks();
    $('#currentYear').textContent = new Date().getFullYear();
    bindEvents(); renderLogs(); renderActivityPreview();
    const originalSave = $('#saveSystemSettings');
    originalSave.addEventListener('click', updateGuideCallbacks);
    setStatus(null, 'Belum diperiksa');
    window.setTimeout(() => pingBridge(), 450);
    window.addEventListener('resize', () => { if (window.innerWidth > 680) closeMobileNav(); });
    window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) { config = loadConfig(); applyTheme(); updateSystemForm(); renderLogs(); renderActivityPreview(); } });
  }

  init();
})();
