/**
 * @fileoverview Download history (persisted in localStorage) and smart
 * recommendations derived from the user's downloads + the live Turkish chart.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'media_toolkit_download_history';
const MAX_HISTORY_ITEMS = 30;

/** Split "A, B & C feat. D" into normalized artist names. */
function splitArtists(str = '') {
  return str
    .toLowerCase()
    .split(/,|&| x | feat\.?| ft\.?| ve /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function useHistory(trendingTracks = []) {
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to save download history:', err);
    }
  }, [history]);

  const addHistoryItem = useCallback((item) => {
    if (!item || !item.url) return;
    setHistory((prev) => {
      const filtered = prev.filter((i) => i.url !== item.url);
      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: item.url,
        title: item.title || 'Bilinmeyen Başlık',
        artist: item.artist || item.channel || 'Bilinmeyen Sanatçı',
        thumbnail: item.thumbnail || null,
        platform: item.platform || 'youtube',
        format: item.format || 'mp3',
        quality: item.quality || '320',
        timestamp: Date.now(),
      };
      return [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  const removeHistoryItem = useCallback((id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  // Recommendations are only generated once the user has downloaded something.
  const recommendations = useMemo(() => {
    if (!history.length || !trendingTracks.length) return [];

    const downloadedKeys = new Set(
      history.flatMap((h) => [h.url, `${h.title}`.toLowerCase().trim()])
    );
    const historyArtists = new Set(history.flatMap((h) => splitArtists(h.artist)));
    const lastArtist = history[0]?.artist;

    return trendingTracks
      .filter((t) => t && t.title)
      .filter((t) => !downloadedKeys.has(t.url) && !downloadedKeys.has(t.title.toLowerCase().trim()))
      .map((t) => {
        const matched = splitArtists(t.artist).find((a) => historyArtists.has(a));
        return {
          ...t,
          score: (matched ? 100 : 0) + (50 - (t.rank || 50)),
          reason: matched
            ? `${(t.artist || '').split(',')[0]} dinlediğiniz için`
            : lastArtist
            ? `${lastArtist.split(',')[0]} dinleyenler bunu da seviyor`
            : 'Türkiye’de şu an popüler',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [history, trendingTracks]);

  return {
    history,
    addHistoryItem,
    removeHistoryItem,
    clearHistory,
    recommendations,
  };
}
