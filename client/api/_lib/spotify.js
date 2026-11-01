/**
 * Shared helpers for Vercel serverless functions.
 * Scrapes Spotify's public embed pages (no API keys needed) and
 * uses public oEmbed endpoints for cover art.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Spotify "Top 50 - Turkey" editorial playlist */
export const TOP50_TURKEY_ID = '37i9dQZEVXbIVYVBNw9D5K';

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8', ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Fetch the __NEXT_DATA__ entity from a Spotify embed page. */
export async function getEmbedEntity(type, id) {
  const res = await fetchWithTimeout(`https://open.spotify.com/embed/${type}/${id}`);
  if (!res.ok) throw new Error(`Spotify embed isteği başarısız (${res.status})`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('Spotify verisi çözümlenemedi');
  const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify içeriği bulunamadı');
  return entity;
}

/** Get a track/album cover via Spotify oEmbed. */
export async function getSpotifyThumb(type, id) {
  try {
    const res = await fetchWithTimeout(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${type}/${id}`)}`,
      {},
      6000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch {
    return null;
  }
}

export function pickImage(entity) {
  const sources = entity?.visualIdentity?.image || entity?.coverArt?.sources || [];
  if (!sources.length) return null;
  // Prefer the largest image
  const sorted = [...sources].sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0));
  return sorted[0]?.url || null;
}

export function formatMs(ms) {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function idFromUri(uri = '') {
  return uri.split(':').pop();
}

/** Map with limited concurrency. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export { fetchWithTimeout };

