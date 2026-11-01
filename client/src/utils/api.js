/**
 * api.js
 * API layer for the Media Toolkit.
 *
 * Two backends are involved:
 *  - Download server (Express + yt-dlp + FFmpeg) — runs on the user's machine and
 *    is exposed via a tunnel. Its URL is resolved at runtime (see resolveBackend).
 *  - Edge functions (/api/* on Vercel) — always online; provide trending charts,
 *    runtime config and a lightweight metadata fallback.
 */

import axios from 'axios';

const OVERRIDE_KEY = 'media_toolkit_api_url';
const IS_LOCAL =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

const clean = (u) => (u || '').trim().replace(/\/+$/, '');

// ============================================
// Backend URL resolution
// ============================================
let currentBase = null;
let resolving = null;

/** Manually configured backend URL (Settings modal). Empty string = automatic. */
export function getApiOverride() {
  try {
    return clean(localStorage.getItem(OVERRIDE_KEY));
  } catch {
    return '';
  }
}

export function setApiOverride(url) {
  try {
    if (clean(url)) localStorage.setItem(OVERRIDE_KEY, clean(url));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {}
  currentBase = null;
  resolving = null;
}

/**
 * Resolve the download server base URL with Smart Dual-Failover:
 * 1. Checks manual override or localhost in dev.
 * 2. Checks local tunnel (user's PC) — if online and responsive, uses it for top speed.
 * 3. If user's PC is turned OFF or unreachable, seamlessly switches to 24/7 Cloud Backend (Render).
 */
export async function resolveBackend(force = false) {
  if (currentBase && !force) return currentBase;
  if (resolving) return resolving;

  const pending = (async () => {
    const override = getApiOverride();
    if (override) return override;
    if (IS_LOCAL) return 'http://localhost:3001';

    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) {
        const configData = await res.json();
        const localTunnel = clean(configData.localTunnelUrl || configData.backendUrl);
        const cloudBackend = clean(configData.cloudBackendUrl || 'https://media-toolkit-server.onrender.com');

        // Ping local tunnel with short timeout to check if user's PC is on
        if (localTunnel && localTunnel !== cloudBackend) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2500);
            const ping = await fetch(`${localTunnel}/api/health`, {
              signal: ctrl.signal,
              cache: 'no-store',
            });
            clearTimeout(timer);
            if (ping.ok) {
              return localTunnel;
            }
          } catch {
            // User's PC is closed or tunnel expired; fall through to 24/7 cloud server!
          }
        }

        // Failover: 24/7 Cloud Backend
        if (cloudBackend) {
          return cloudBackend;
        }

        if (localTunnel) return localTunnel;
      }
    } catch {}

    return clean(import.meta.env.VITE_API_URL) || 'https://media-toolkit-server.onrender.com';
  })();

  resolving = pending;
  try {
    currentBase = await pending;
  } finally {
    if (resolving === pending) resolving = null;
  }
  return currentBase;
}

/** Synchronous accessor (valid after resolveBackend has run). */
export function getApiBaseUrl() {
  return currentBase || getApiOverride() || (IS_LOCAL ? 'http://localhost:3001' : '');
}

/** Ping the download server. */
export async function checkBackend({ force = false } = {}) {
  const base = await resolveBackend(force);
  if (!base) return { online: false, url: null };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return { online: res.ok, url: base };
  } catch {
    return { online: false, url: base };
  }
}

// ============================================
// Errors
// ============================================
export const OFFLINE_MESSAGE =
  'İndirme sunucusuna şu anda ulaşılamıyor. Sunucu muhtemelen yeniden başlatılıyor; lütfen birkaç saniye sonra tekrar deneyin.';

export class BackendOfflineError extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = 'BackendOfflineError';
    this.offline = true;
  }
}

function normalizeError(error) {
  if (error instanceof BackendOfflineError) return error;
  if (!error.response) {
    // Network failure, DNS error, CORS rejection, timeout...
    if (error.code === 'ECONNABORTED') return new Error('Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin.');
    return new BackendOfflineError();
  }
  const data = error.response.data || {};
  const message =
    data.error ||
    data.message ||
    (error.response.status === 429 ? 'Çok fazla istek gönderildi, lütfen biraz bekleyin.' : null) ||
    `Sunucu hatası (${error.response.status})`;
  return new Error(message);
}

// ============================================
// Axios instance (download server)
// ============================================
const api = axios.create({
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const base = await resolveBackend();
  if (!base) throw new BackendOfflineError();
  config.baseURL = `${base}/api`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Network-level failure: the tunnel URL may have changed. Re-resolve the
    // backend once and retry the request if we got a different address.
    const config = error?.config;
    if (config && !error.response && error.code !== 'ECONNABORTED' && !config._retried) {
      config._retried = true;
      const previous = config.baseURL;
      try {
        const base = await resolveBackend(true);
        if (base && `${base}/api` !== previous) {
          config.baseURL = `${base}/api`;
          return api.request(config);
        }
      } catch {}
    }
    return Promise.reject(normalizeError(error));
  }
);

// ============================================
// API Methods
// ============================================

/** Edge (Vercel) metadata fallback — works even when the download server is offline. */
async function analyzeOnEdge(url) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || 'Bağlantı analiz edilemedi');
  return json.data;
}

/**
 * Analyze a media URL. Uses the download server when available (richer data),
 * otherwise falls back to the edge function so the preview still works.
 */
export async function analyzeUrl(url) {
  try {
    const response = await api.post('/analyze', { url });
    return { ...(response.data?.data || response.data), source: 'server' };
  } catch (err) {
    if (err.offline && !IS_LOCAL) {
      const data = await analyzeOnEdge(url);
      return { ...data, source: 'edge' };
    }
    throw err;
  }
}

/** Start a single download. */
export async function startDownload(params) {
  const response = await api.post('/download/start', params);
  return response.data;
}

/** Start a batch download for playlists/albums. */
export async function startBatchDownload(params) {
  const response = await api.post('/download/batch', params);
  return response.data;
}

/** Direct download URL for a completed job. */
export function getDownloadUrl(downloadId) {
  return `${getApiBaseUrl()}/api/download/file/${downloadId}`;
}

/** SSE progress URL. */
export function getProgressUrl(downloadId) {
  return `${getApiBaseUrl()}/api/download/progress/${downloadId}`;
}

/** Cancel an active download. */
export async function cancelDownload(downloadId) {
  const response = await api.post(`/download/cancel/${downloadId}`);
  return response.data;
}

/**
 * Search videos and music tracks directly by query string.
 * @param {string} query - Search term
 * @param {number} [limit=8] - Number of items to return
 */
export async function searchMedia(query, limit = 8) {
  try {
    const response = await api.get('/search', { params: { q: query, limit } });
    return response.data;
  } catch (err) {
    // If backend is offline or unreachable directly, try edge search proxy
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || 'Arama yapılamadı');
    return json;
  }
}

/**
 * Live Turkish chart (Spotify Top 50 - Turkey). Served by the edge function in
 * production and by the local server in development (via Vite proxy).
 */
export async function fetchTrending(limit = 12) {
  const res = await fetch(`/api/trending?limit=${limit}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || 'Trend listesi alınamadı');
  return json;
}

export default api;
