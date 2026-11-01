/**
 * @fileoverview GET /api/trending — live Spotify "Top 50 - Turkey" chart with cover art.
 * Mirrors the Vercel serverless function so local development behaves the same.
 * @module routes/trending
 */

const { Router } = require('express');
const { getEmbedEntity, getOembedThumb } = require('../services/spotifyEmbed');

const router = Router();
const TOP50_TURKEY_ID = '37i9dQZEVXbIVYVBNw9D5K';
const CACHE_MS = 60 * 60 * 1000;
let cache = { at: 0, data: null };

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  try {
    if (!cache.data || Date.now() - cache.at > CACHE_MS) {
      const entity = await getEmbedEntity('playlist', TOP50_TURKEY_ID);
      const list = (entity.trackList || []).slice(0, 50);
      const tracks = await Promise.all(
        list.map(async (t, index) => {
          const id = t.uri.split(':').pop();
          return {
            id,
            rank: index + 1,
            title: t.title,
            artist: t.subtitle,
            url: `https://open.spotify.com/track/${id}`,
            platform: 'spotify',
            thumbnail: index < 24 ? await getOembedThumb('track', id) : null,
            duration: t.duration ? Math.round(t.duration / 1000) : null,
            explicit: !!t.isExplicit,
            previewUrl: t.audioPreview?.url || null,
          };
        })
      );
      cache = { at: Date.now(), data: { source: entity.name || 'Top 50 - Turkey', tracks } };
    }
    res.json({ success: true, ...cache.data, tracks: cache.data.tracks.slice(0, limit) });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

module.exports = router;

