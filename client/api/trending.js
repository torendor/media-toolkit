/**
 * GET /api/trending?limit=12
 * Live "Top 50 - Turkey" chart from Spotify with real cover art.
 * Cached at the edge for 1 hour.
 */
import { TOP50_TURKEY_ID, getEmbedEntity, getSpotifyThumb, idFromUri, formatMs, mapLimit } from './_lib/spotify.js';

export default async function handler(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 12, 1), 50);

  try {
    const entity = await getEmbedEntity('playlist', TOP50_TURKEY_ID);
    const list = (entity.trackList || []).slice(0, limit);

    const tracks = await mapLimit(list, 8, async (t, index) => {
      const id = idFromUri(t.uri);
      return {
        id,
        rank: index + 1,
        title: t.title,
        artist: t.subtitle,
        url: `https://open.spotify.com/track/${id}`,
        platform: 'spotify',
        thumbnail: await getSpotifyThumb('track', id),
        duration: t.duration ? Math.round(t.duration / 1000) : null,
        durationFormatted: formatMs(t.duration),
        explicit: !!t.isExplicit,
        previewUrl: t.audioPreview?.url || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      success: true,
      source: entity.name || 'Top 50 - Turkey',
      updatedAt: new Date().toISOString(),
      tracks,
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ success: false, error: err.message || 'Trend listesi alınamadı' });
  }
}

