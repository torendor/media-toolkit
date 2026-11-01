/**
 * POST /api/analyze  { url }
 * Lightweight, key-less metadata resolver that runs on Vercel.
 * Used as a fallback when the download server is offline so users can
 * still preview content (title, artist, cover, track list).
 */
import { getEmbedEntity, pickImage, idFromUri, formatMs, fetchWithTimeout } from './_lib/spotify.js';

const SPOTIFY_RE = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i;
const SPOTIFY_URI_RE = /spotify:(track|album|playlist):([a-zA-Z0-9]+)/i;
const YT_ID_RE = /(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/;
const YT_LIST_RE = /[?&]list=([a-zA-Z0-9_-]+)/;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

async function analyzeSpotify(type, id) {
  const e = await getEmbedEntity(type, id);
  const cover = pickImage(e);

  if (type === 'track') {
    const artist = (e.artists || []).map((a) => a.name).join(', ') || e.subtitle || 'Bilinmeyen Sanatçı';
    return {
      platform: 'spotify',
      type: 'track',
      id,
      title: e.title || e.name,
      artist,
      album: e.album?.name || null,
      duration: e.duration ? Math.round(e.duration / 1000) : null,
      durationFormatted: formatMs(e.duration),
      year: e.releaseDate?.isoString?.slice(0, 4) || null,
      coverUrl: cover,
      thumbnail: cover,
      explicit: !!e.isExplicit,
      previewUrl: e.audioPreview?.url || null,
      isPlaylist: false,
    };
  }

  const tracks = (e.trackList || []).map((t, i) => ({
    id: idFromUri(t.uri),
    title: t.title,
    artist: t.subtitle,
    trackNumber: i + 1,
    duration: t.duration ? Math.round(t.duration / 1000) : null,
    durationFormatted: formatMs(t.duration),
    thumbnail: type === 'album' ? cover : null,
    uri: t.uri,
  }));
  const totalMs = (e.trackList || []).reduce((s, t) => s + (t.duration || 0), 0);

  return {
    platform: 'spotify',
    type,
    id,
    title: e.title || e.name,
    artist: e.subtitle || (e.authors || []).map((a) => a.name).join(', ') || null,
    coverUrl: cover,
    thumbnail: cover,
    trackCount: tracks.length,
    totalTracks: tracks.length,
    totalDuration: totalMs ? Math.round(totalMs / 1000) : null,
    tracks,
    isPlaylist: true,
  };
}

async function analyzeYouTube(url) {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
  );
  if (!res.ok) throw new Error('YouTube videosu bulunamadı veya gizli');
  const o = await res.json();
  const vid = url.match(YT_ID_RE)?.[1];
  const list = url.match(YT_LIST_RE)?.[1];
  return {
    platform: 'youtube',
    type: list && !vid ? 'playlist' : 'video',
    id: vid || list,
    title: o.title,
    artist: o.author_name,
    channel: o.author_name,
    thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : o.thumbnail_url,
    duration: null,
    isPlaylist: false,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url } = await readBody(req);
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Bağlantı gerekli' });
  }

  try {
    const sp = url.match(SPOTIFY_RE) || url.match(SPOTIFY_URI_RE);
    let data;
    if (sp) {
      data = await analyzeSpotify(sp[1].toLowerCase(), sp[2]);
    } else if (/youtube\.com|youtu\.be/i.test(url)) {
      data = await analyzeYouTube(url);
    } else {
      return res.status(400).json({ success: false, error: 'Yalnızca YouTube ve Spotify bağlantıları destekleniyor' });
    }
    return res.status(200).json({ success: true, data: { ...data, source: 'edge' } });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'Bağlantı analiz edilemedi' });
  }
}

