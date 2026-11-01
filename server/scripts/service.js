/**
 * service.js — İndirme sunucusunu arka plan hizmeti gibi yönetir (Windows).
 *
 *   node scripts/service.js install    Windows açılışında otomatik başlat + şimdi başlat
 *   node scripts/service.js uninstall  Otomatik başlatmayı kaldır + durdur
 *   node scripts/service.js start      Gizli pencerede şimdi başlat
 *   node scripts/service.js stop       Durdur
 *   node scripts/service.js restart    Yeniden başlat
 *   node scripts/service.js status     Durum bilgisi
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SERVER_DIR = path.resolve(__dirname, '..');
const KEEP_ALIVE = path.join(__dirname, 'keep-alive.js');
const LOCK_FILE = path.join(SERVER_DIR, '.keep-alive.pid');
const URL_FILE = path.join(SERVER_DIR, '.public-url');
const LOG_FILE = path.join(SERVER_DIR, 'logs', 'keep-alive.log');
const STARTUP_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);
const VBS_FILE = path.join(STARTUP_DIR, 'MediaToolkitServer.vbs');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function runningPid() {
  try {
    const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
    if (!pid) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function start() {
  const pid = runningPid();
  if (pid) return console.log(yellow(`Zaten çalışıyor (PID ${pid}).`));
  const child = spawn(process.execPath, [KEEP_ALIVE], {
    cwd: SERVER_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  console.log(green(`✓ Sunucu arka planda başlatıldı (PID ${child.pid}).`));
  console.log(`  Log: ${LOG_FILE}`);
}

function stop() {
  const pid = runningPid();
  if (!pid) return console.log(yellow('Sunucu zaten çalışmıyor.'));
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-pid); } catch { process.kill(pid); }
  }
  try { fs.unlinkSync(LOCK_FILE); } catch { /* yoksay */ }
  console.log(green('✓ Sunucu durduruldu.'));
}

function install() {
  if (process.platform !== 'win32') {
    console.log(red('Otomatik başlatma şu an yalnızca Windows için destekleniyor.'));
    process.exit(1);
  }
  fs.mkdirSync(STARTUP_DIR, { recursive: true });
  const q = (s) => s.replace(/"/g, '""');
  const vbs = [
    "' Media Toolkit download server - starts hidden at Windows logon",
    'Set sh = CreateObject("WScript.Shell")',
    `sh.CurrentDirectory = "${q(SERVER_DIR)}"`,
    `sh.Run """${q(process.execPath)}"" ""${q(KEEP_ALIVE)}""", 0, False`,
    '',
  ].join('\r\n');
  fs.writeFileSync(VBS_FILE, vbs, 'latin1');
  console.log(green('✓ Otomatik başlatma kuruldu.'));
  console.log(`  ${VBS_FILE}`);
  start();
}

function uninstall() {
  if (fs.existsSync(VBS_FILE)) fs.unlinkSync(VBS_FILE);
  console.log(green('✓ Otomatik başlatma kaldırıldı.'));
  stop();
}

async function status() {
  const pid = runningPid();
  console.log(`Gözetmen        : ${pid ? green(`çalışıyor (PID ${pid})`) : red('çalışmıyor')}`);
  console.log(`Otomatik başlat : ${fs.existsSync(VBS_FILE) ? green('açık') : yellow('kapalı')}`);
  const url = fs.existsSync(URL_FILE) ? fs.readFileSync(URL_FILE, 'utf8').trim() : null;
  console.log(`Tünel adresi    : ${url || '-'}`);
  for (const [name, base] of [['Yerel sunucu', 'http://127.0.0.1:3001'], ['Tünel', url]]) {
    if (!base) continue;
    let ok = false;
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(6000) });
      ok = r.ok;
    } catch { /* çevrimdışı */ }
    console.log(`${name.padEnd(16)}: ${ok ? green('erişilebilir') : red('erişilemiyor')}`);
  }
  if (fs.existsSync(LOG_FILE)) {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-8);
    console.log('\nSon log satırları:\n' + lines.join('\n'));
  }
}

const cmd = process.argv[2] || 'status';
({
  install,
  uninstall,
  start,
  stop,
  restart: () => { stop(); setTimeout(start, 1500); },
  status,
}[cmd] || (() => { console.log('Komutlar: install | uninstall | start | stop | restart | status'); }))();
