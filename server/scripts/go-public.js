/**
 * go-public.js
 * One-click launcher that makes the local download server reachable from the
 * Vercel-hosted frontend:
 *   1. Starts the Express server (if not already running)
 *   2. Opens a Cloudflare quick tunnel (https://*.trycloudflare.com)
 *   3. Saves the tunnel URL as BACKEND_URL on Vercel and redeploys production
 *
 * Usage:  node scripts/go-public.js [--no-deploy]
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(SERVER_DIR, '..', 'client');
const PORT = process.env.PORT || 3001;
const LOCAL_URL = `http://localhost:${PORT}`;
const CLOUDFLARED = path.join(SERVER_DIR, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const NO_DEPLOY = process.argv.includes('--no-deploy');

const children = [];
const log = (...a) => console.log('\x1b[36m[go-public]\x1b[0m', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isHealthy(base, timeout = 4000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isHealthy(LOCAL_URL)) {
    log(`Sunucu zaten çalışıyor: ${LOCAL_URL}`);
    return;
  }
  log('Sunucu başlatılıyor...');
  const srv = spawn(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, stdio: 'inherit' });
  children.push(srv);
  for (let i = 0; i < 40; i++) {
    if (await isHealthy(LOCAL_URL)) return log(`Sunucu hazır: ${LOCAL_URL}`);
    await sleep(500);
  }
  throw new Error('Sunucu 20 saniye içinde başlamadı');
}

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED)) {
    throw new Error(`cloudflared bulunamadı: ${CLOUDFLARED}`);
  }
  log('Cloudflare tüneli açılıyor...');
  return new Promise((resolve, reject) => {
    const cf = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', LOCAL_URL], { windowsHide: true });
    children.push(cf);
    let found = false;
    const onData = (buf) => {
      const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (m && !found) {
        found = true;
        resolve(m[0]);
      }
    };
    cf.stdout.on('data', onData);
    cf.stderr.on('data', onData);
    cf.on('exit', (code) => {
      if (!found) reject(new Error(`cloudflared kapandı (kod ${code})`));
      else {
        log('Tünel kapandı. Çıkılıyor.');
        shutdown(1);
      }
    });
    setTimeout(() => !found && reject(new Error('Tünel URL alınamadı (30 sn)')), 30000);
  });
}

function vercel(args) {
  const r = spawnSync('vercel', args, { cwd: CLIENT_DIR, shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join('\n'));
  return r.stdout;
}

async function updateVercel(url) {
  log('Vercel ortam değişkenleri güncelleniyor...');
  vercel(['env', 'add', 'BACKEND_URL', '--environment', 'production', '--value', `"${url}"`, '--force', '--yes']);
  vercel(['env', 'add', 'VITE_API_URL', '--environment', 'production', '--value', `"${url}"`, '--force', '--yes']);
  log('Vercel production yeniden dağıtılıyor (≈25 sn)...');
  vercel(['deploy', '--prod', '--yes']);
}

function shutdown(code = 0) {
  for (const c of children) {
    try { c.kill(); } catch {}
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  try {
    await ensureServer();
    const url = await startTunnel();
    log(`Tünel URL: \x1b[32m${url}\x1b[0m`);

    log('Tünelin erişilebilir olması bekleniyor...');
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) {
      ok = await isHealthy(url, 5000);
      if (!ok) await sleep(2000);
    }
    if (!ok) log('\x1b[33mUyarı: tünel henüz yanıt vermiyor, yine de devam ediliyor.\x1b[0m');

    fs.writeFileSync(path.join(SERVER_DIR, '.public-url'), url);

    if (!NO_DEPLOY) {
      await updateVercel(url);
    }

    console.log('\n===============================================');
    console.log(' ✅ Media Toolkit internete açık!');
    console.log(`   Backend : ${url}`);
    console.log('   Site    : https://media-toolkit-xi.vercel.app');
    console.log('   Bu pencereyi kapatırsanız indirme servisi durur.');
    console.log('===============================================\n');
  } catch (err) {
    console.error('\x1b[31m[go-public] Hata:\x1b[0m', err.message);
    shutdown(1);
  }
})();

