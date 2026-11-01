/**
 * keep-alive.js
 * ---------------------------------------------------------------------------
 * 7/24 çalışan gözetmen (supervisor). İndirme sunucusunu her zaman açık tutar:
 *
 *   • Express sunucusunu başlatır, çökerse otomatik yeniden başlatır
 *   • Cloudflare tünelini açar, düşerse / yanıt vermezse yeniden açar
 *   • Tünel adresi değiştiğinde Vercel'deki BACKEND_URL'yi günceller ve
 *     production'ı yeniden derler (redeploy) — site kendiliğinden bağlanır
 *   • Sunucu çalışırken bilgisayarın uyku moduna geçmesini engeller
 *   • Tek örnek (single instance) kilidi; loglar server/logs/keep-alive.log
 *
 * Kullanım:
 *   node scripts/keep-alive.js            (normal)
 *   node scripts/keep-alive.js --no-deploy (Vercel'i güncellemeden)
 *   node scripts/keep-alive.js --allow-sleep
 * ---------------------------------------------------------------------------
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Ayarlar
// ---------------------------------------------------------------------------
const SERVER_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(SERVER_DIR, '..', 'client');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'keep-alive.log');
const LOCK_FILE = path.join(SERVER_DIR, '.keep-alive.pid');
const URL_FILE = path.join(SERVER_DIR, '.public-url');
const PORT = process.env.PORT || 3001;
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const SITE_URL = process.env.SITE_URL || 'https://media-toolkit-xi.vercel.app';
const CLOUDFLARED = path.join(SERVER_DIR, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');

const NO_DEPLOY = process.argv.includes('--no-deploy');
const ALLOW_SLEEP = process.argv.includes('--allow-sleep');

const HEALTH_INTERVAL_MS = 30_000;   // sağlık kontrol sıklığı
const TUNNEL_FAILS_BEFORE_RESTART = 3; // art arda başarısız kontrol sayısı
const LOCAL_FAILS_BEFORE_RESTART = 3;
const MAX_LOG_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------
fs.mkdirSync(LOG_DIR, { recursive: true });
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* log hatası gözetmeni durdurmamalı */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Tek örnek kilidi
// ---------------------------------------------------------------------------
function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
    if (pid && pid !== process.pid && isPidAlive(pid)) {
      console.log(`Gözetmen zaten çalışıyor (PID ${pid}). Çıkılıyor.`);
      process.exit(0);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
}
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE) && fs.readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch { /* yoksay */ }
}

// ---------------------------------------------------------------------------
// HTTP yardımcıları
// ---------------------------------------------------------------------------
async function fetchJson(url, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json().catch(() => ({}));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
const isHealthy = async (base, timeout) => !!(await fetchJson(`${base}/api/health`, timeout));

// ---------------------------------------------------------------------------
// Yönetilen süreçler
// ---------------------------------------------------------------------------
let shuttingDown = false;
const state = {
  server: null,
  serverRestarts: 0,
  tunnel: null,
  tunnelUrl: null,
  tunnelRestarts: 0,
  awake: null,
  deploying: false,
  deployedUrl: null,
};

function backoff(n) {
  return Math.min(60_000, 2_000 * 2 ** Math.min(n, 5));
}

// ---- Express sunucusu ------------------------------------------------------
async function startServer() {
  if (shuttingDown) return;
  // Başka bir yerde zaten çalışıyorsa (örn. elle başlatılmış) onu kullan
  if (await isHealthy(LOCAL_URL, 2000)) {
    log('Sunucu zaten çalışıyor, mevcut örnek kullanılıyor.');
    return;
  }
  log('Express sunucusu başlatılıyor...');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  state.server = child;
  const pipe = (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach((l) => log('[server]', l));
  child.stdout.on('data', pipe);
  child.stderr.on('data', pipe);
  child.on('exit', (code, signal) => {
    if (state.server === child) state.server = null;
    if (shuttingDown) return;
    const wait = backoff(state.serverRestarts++);
    log(`Sunucu kapandı (kod ${code ?? signal}). ${wait / 1000} sn sonra yeniden başlatılacak.`);
    setTimeout(startServer, wait);
  });

  for (let i = 0; i < 60; i++) {
    if (await isHealthy(LOCAL_URL, 2000)) {
      log(`Sunucu hazır: ${LOCAL_URL}`);
      state.serverRestarts = 0;
      return;
    }
    await sleep(500);
  }
  log('Uyarı: sunucu 30 sn içinde sağlıklı yanıt vermedi.');
}

function killServer() {
  if (state.server) {
    try { state.server.kill(); } catch { /* yoksay */ }
    state.server = null;
  }
}

// ---- Cloudflare tüneli -----------------------------------------------------
function startTunnel() {
  if (shuttingDown) return;
  if (!fs.existsSync(CLOUDFLARED)) {
    log(`HATA: cloudflared bulunamadı: ${CLOUDFLARED}`);
    return;
  }
  log('Cloudflare tüneli açılıyor...');
  const child = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', LOCAL_URL], { windowsHide: true });
  state.tunnel = child;
  let found = false;

  const onData = (buf) => {
    const text = buf.toString();
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m && !found) {
      found = true;
      onTunnelUrl(m[0]);
    }
    if (/ERR/i.test(text)) {
      text.split(/\r?\n/).filter((l) => /ERR/.test(l)).forEach((l) => log('[tunnel]', l.trim()));
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('exit', (code) => {
    if (state.tunnel === child) state.tunnel = null;
    if (shuttingDown) return;
    const wait = backoff(state.tunnelRestarts++);
    log(`Tünel kapandı (kod ${code}). ${wait / 1000} sn sonra yeniden açılacak.`);
    setTimeout(startTunnel, wait);
  });

  setTimeout(() => {
    if (!found && state.tunnel === child) {
      log('Tünel adresi 45 sn içinde alınamadı, yeniden deneniyor.');
      try { child.kill(); } catch { /* yoksay */ }
    }
  }, 45_000);
}

function restartTunnel(reason) {
  log(`Tünel yeniden başlatılıyor: ${reason}`);
  state.tunnelUrl = null;
  if (state.tunnel) {
    try { state.tunnel.kill(); } catch { /* yoksay */ }
    // 'exit' olayı yeniden başlatmayı tetikler
  } else {
    startTunnel();
  }
}

async function onTunnelUrl(url) {
  log(`Tünel adresi: ${url}`);
  // Tünelin dışarıdan erişilebilir olmasını bekle
  let ok = false;
  for (let i = 0; i < 30 && !ok && !shuttingDown; i++) {
    ok = await isHealthy(url, 5000);
    if (!ok) await sleep(2000);
  }
  if (!ok) log('Uyarı: tünel henüz yanıt vermiyor, yine de devam ediliyor.');
  state.tunnelUrl = url;
  state.tunnelRestarts = 0;
  try { fs.writeFileSync(URL_FILE, url); } catch { /* yoksay */ }
  syncVercel();
}

// ---- Vercel senkronizasyonu ------------------------------------------------
function runVercel(args, timeoutMs = 240_000) {
  return new Promise((resolve, reject) => {
    const child = spawn('vercel', args, { cwd: CLIENT_DIR, shell: true, windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => { try { child.kill(); } catch { /* yoksay */ } }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(out.trim().split('\n').slice(-3).join(' | ') || `vercel çıkış kodu ${code}`));
    });
    child.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}

async function syncVercel() {
  if (NO_DEPLOY || state.deploying || !state.tunnelUrl) return;
  const target = state.tunnelUrl;

  // Site zaten bu adresi kullanıyorsa bir şey yapma
  const cfg = await fetchJson(`${SITE_URL}/api/config`, 8000);
  if (cfg && cfg.backendUrl === target) {
    state.deployedUrl = target;
    log('Vercel zaten güncel adresi kullanıyor.');
    return;
  }

  state.deploying = true;
  try {
    log('Vercel BACKEND_URL güncelleniyor...');
    await runVercel(['env', 'add', 'BACKEND_URL', '--environment', 'production', '--value', `"${target}"`, '--force', '--yes'], 60_000);
    log('Production yeniden derleniyor (redeploy)...');
    const host = SITE_URL.replace(/^https?:\/\//, '');
    await runVercel(['redeploy', host, '--environment', 'production']);
    state.deployedUrl = target;
    log(`✓ Site güncellendi → ${SITE_URL} artık ${target} adresini kullanıyor.`);
  } catch (err) {
    log('Vercel güncelleme hatası:', err.message, '— 2 dk sonra tekrar denenecek.');
    setTimeout(syncVercel, 120_000);
  } finally {
    state.deploying = false;
    // Deploy sürerken tünel değiştiyse tekrar senkronize et
    if (state.tunnelUrl && state.tunnelUrl !== target) syncVercel();
  }
}

// ---- Uyku modunu engelle ---------------------------------------------------
function keepAwake() {
  if (ALLOW_SLEEP || process.platform !== 'win32' || shuttingDown) return;
  const ps = `
$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);';
$t = Add-Type -MemberDefinition $sig -Name Power -Namespace Win32 -PassThru;
[void]$t::SetThreadExecutionState([uint32]"0x80000001");
while ($true) { Start-Sleep -Seconds 3600 }`;
  const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true });
  state.awake = child;
  child.on('exit', () => {
    if (state.awake === child) state.awake = null;
    if (!shuttingDown) setTimeout(keepAwake, 10_000);
  });
  log('Uyku modu engellendi (sunucu çalıştığı sürece bilgisayar uyumaz).');
}

// ---------------------------------------------------------------------------
// Sağlık izleyici
// ---------------------------------------------------------------------------
let localFails = 0;
let tunnelFails = 0;
async function healthLoop() {
  while (!shuttingDown) {
    await sleep(HEALTH_INTERVAL_MS);
    if (shuttingDown) break;

    // Yerel sunucu
    if (await isHealthy(LOCAL_URL, 5000)) {
      localFails = 0;
    } else if (++localFails >= LOCAL_FAILS_BEFORE_RESTART) {
      log('Sunucu yanıt vermiyor, yeniden başlatılıyor.');
      localFails = 0;
      if (state.server) killServer(); // exit olayı yeniden başlatır
      else startServer();
      continue;
    }

    // Tünel
    if (state.tunnelUrl) {
      if (await isHealthy(state.tunnelUrl, 8000)) {
        tunnelFails = 0;
        if (state.deployedUrl !== state.tunnelUrl) syncVercel();
      } else if (++tunnelFails >= TUNNEL_FAILS_BEFORE_RESTART) {
        tunnelFails = 0;
        restartTunnel('dışarıdan erişilemiyor');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Kapanış
// ---------------------------------------------------------------------------
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Gözetmen kapatılıyor...');
  for (const c of [state.tunnel, state.server, state.awake]) {
    if (c) { try { c.kill(); } catch { /* yoksay */ } }
  }
  releaseLock();
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));
process.on('exit', releaseLock);
process.on('uncaughtException', (e) => log('Beklenmeyen hata:', e.stack || e.message));
process.on('unhandledRejection', (e) => log('Yakalanmamış promise:', e?.stack || e));

// ---------------------------------------------------------------------------
// Başlat
// ---------------------------------------------------------------------------
(async () => {
  acquireLock();
  log('================================================');
  log(`Media Toolkit gözetmeni başladı (PID ${process.pid})`);
  log(`Site: ${SITE_URL}`);
  log('================================================');
  keepAwake();
  await startServer();
  startTunnel();
  healthLoop();
})();
