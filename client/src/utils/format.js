/**
 * format.js
 * Small, shared formatting helpers (durations, relative time, counts) and a
 * translator that turns the download server's English progress messages into
 * Turkish for the progress console.
 */

/** Seconds → "3:42" / "1:02:15". */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Seconds → "1 sa 12 dk" style (for totals). */
export function formatLongDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs} sa ${mins} dk`;
  return `${mins} dk`;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Dün';
  if (diffDays < 30) return `${diffDays} gün önce`;
  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatViewCount(num) {
  if (!num || isNaN(num)) return null;
  return `${compact.format(num)} görüntülenme`;
}

// ============================================
// Server progress message translation
// ============================================
const RULES = [
  [/^Initializing download/i, () => 'İndirme hazırlanıyor…'],
  [/^Starting download/i, () => 'İndirme başlatılıyor…'],
  [/^Downloading:\s*([\d.]+)%/i, (m) => `İndiriliyor — %${m[1]}`],
  [/^Searching YouTube for:\s*(.+)/i, (m) => `Kaynak aranıyor: ${m[1]}`],
  [/^Converting media/i, () => 'Medya dönüştürülüyor…'],
  [/^Processing audio/i, () => 'Ses işleniyor…'],
  [/^Normalizing audio/i, () => 'Ses seviyesi normalleştiriliyor (EBU R128)…'],
  [/^Trimming silence/i, () => 'Sessiz bölümler kırpılıyor…'],
  [/^Applying metadata tags/i, () => 'ID3 etiketleri ve kapak ekleniyor…'],
  [/^Starting batch download \((\d+)\/(\d+)\)/i, (m) => `Toplu indirme başlatılıyor (${m[1]}/${m[2]})…`],
  [/^Downloading item (\d+)\/(\d+):\s*(.*)$/i, (m) => `Parça ${m[1]}/${m[2]}${m[3] ? ` · ${translateServerMessage(m[3])}` : ''}`],
  [/^Packaging (\d+) files into ZIP/i, (m) => `${m[1]} dosya ZIP arşivine paketleniyor…`],
  [/^Batch download complete!?\s*(\d+)?/i, (m) => (m[1] ? `Toplu indirme tamamlandı — ${m[1]} dosya` : 'Toplu indirme tamamlandı')],
  [/^Download complete/i, () => 'İndirme tamamlandı'],
  [/^Batch error:\s*(.*)/i, (m) => `Toplu indirme hatası: ${m[1]}`],
];

export function translateServerMessage(message) {
  if (!message || typeof message !== 'string') return '';
  const text = message.trim();
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}
