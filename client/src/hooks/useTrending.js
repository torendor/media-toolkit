/**
 * useTrending.js
 * Loads the live Spotify "Top 50 - Turkey" chart (with cover art) and caches it
 * in sessionStorage for fast reloads.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchTrending } from '../utils/api';

const CACHE_KEY = 'media_toolkit_trending_v2';
const CACHE_TTL = 30 * 60 * 1000;

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.at < CACHE_TTL && Array.isArray(c.tracks)) return c;
  } catch {}
  return null;
}

export function useTrending(limit = 12) {
  // Read the cache once (not on every render)
  const [cached] = useState(readCache);
  const [tracks, setTracks] = useState(cached?.tracks || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(cached?.at || null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrending(limit);
      setTracks(data.tracks || []);
      const at = Date.now();
      setUpdatedAt(at);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at, tracks: data.tracks }));
      } catch {}
    } catch (err) {
      setError(err.message || 'Trend listesi alınamadı');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (!cached) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tracks, loading, error, updatedAt, reload: load };
}

