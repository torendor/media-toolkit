/**
 * @fileoverview Key-less Spotify metadata helpers based on the public embed pages
 * (open.spotify.com/embed/...) and the oEmbed endpoint. Used when no Spotify
 * developer credentials are configured.
 * @module services/spotifyEmbed
 */

const axios = require('axios');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Fetch the __NEXT_DATA__ entity for a Spotify resource.
 * @param {'track'|'album'|'playlist'} type
 * @param {string} id
 */
async function getEmbedEntity(type, id) {
  const res = await axios.get(`https://open.spotify.com/embed/${type}/${id}`, {
    timeout: 10000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' },
  });
  const m = String(res.data).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('Spotify verisi çözümlenemedi');
  const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify içeriği bulunamadı');
  return entity;
}

/** Get cover art via oEmbed. Returns null on failure. */
async function getOembedThumb(type, id) {
  try {
    const res = await axios.get('https://open.spotify.com/oembed', {
      params: { url: `https://open.spotify.com/${type}/${id}` },
      timeout: 6000,
    });
    return res.data?.thumbnail_url || null;
  } catch {
    return null;
  }
}

function pickImage(entity) {
  const sources = entity?.visualIdentity?.image || entity?.coverArt?.sources || [];
  if (!sources.length) return null;
  const sorted = [...sources].sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0));
  return sorted[0]?.url || null;
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '0:00';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Build album/playlist info (with track list) from the embed page.
 * @param {'album'|'playlist'} type
 * @param {string} id
 */
async function getCollectionInfo(type, id) {
  const e = await getEmbedEntity(type, id);
  const cover = pickImage(e);
  const tracks = (e.trackList || []).map((t, i) => ({
    id: t.uri.split(':').pop(),
    title: t.title,
    artist: t.subtitle,
    album: type === 'album' ? e.name || e.title : '',
    trackNumber: i + 1,
    duration: Math.round((t.duration || 0) / 1000),
    durationFormatted: formatMs(t.duration),
    coverUrl: type === 'album' ? cover : null,
    thumbnail: type === 'album' ? cover : null,
    previewUrl: t.audioPreview?.url || null,
    uri: t.uri,
  }));
  const totalMs = (e.trackList || []).reduce((s, t) => s + (t.duration || 0), 0);

  return {
    platform: 'spotify',
    type,
    id,
    title: e.title || e.name || (type === 'album' ? 'Albüm' : 'Çalma Listesi'),
    artist: e.subtitle || '',
    owner: e.subtitle || '',
    year: e.releaseDate?.isoString?.slice(0, 4) || '',
    coverUrl: cover,
    thumbnail: cover,
    totalTracks: tracks.length,
    trackCount: tracks.length,
    totalDuration: Math.round(totalMs / 1000),
    tracks,
    isPlaylist: true,
  };
}

module.exports = { getEmbedEntity, getOembedThumb, getCollectionInfo, pickImage, formatMs };

