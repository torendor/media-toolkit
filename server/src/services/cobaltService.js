/**
 * @fileoverview Cobalt, Invidious & Piped external API service for media extraction.
 * Bypasses local datacenter IP restrictions by resolving direct stream URLs
 * through external public or custom instances.
 * @module services/cobaltService
 */

const axios = require('axios');

/**
 * Cobalt API instance endpoints list.
 */
const COBALT_INSTANCES = [
  process.env.COBALT_API_URL,
  'https://api.cobalt.tools',
  'https://cobalt.tools',
  'https://cobalt.kwiatekm.tokyo',
  'https://cobalt-api.kwiatekm.tokyo',
  'https://cobalt.canine.tools',
].filter(Boolean);

/**
 * Invidious & Piped fallback instances for YouTube URL resolution.
 */
const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://invidious.projectsegfau.lt',
  'https://invidious.drgns.space',
];

const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
];

/**
 * Extract YouTube 11-char video ID from any URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractYouTubeId(url) {
  const match = (url || '').match(/(?:youtu\.be\/|watch\?v=|embed\/|shorts\/|v\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Map video quality string to Cobalt resolution standard.
 */
function mapVideoQuality(quality) {
  if (!quality) return '1080';
  const q = String(quality).toLowerCase().replace('p', '');
  if (q === '2160' || q === '4k') return '2160';
  if (q === '1440' || q === '2k') return '1440';
  if (['1080', '720', '480', '360', '240', '144'].includes(q)) return q;
  if (q === 'best') return 'max';
  return '1080';
}

/**
 * Map audio format string.
 */
function mapAudioFormat(format) {
  const f = String(format || 'mp3').toLowerCase();
  if (['mp3', 'ogg', 'wav', 'opus'].includes(f)) return f;
  return 'best';
}

/**
 * Try to resolve stream URL using Cobalt API instances.
 * Logs exact HTTP errors clearly to the console.
 *
 * @param {string} mediaUrl
 * @param {Object} options
 * @returns {Promise<{ url: string, fileName: string, status: string, instance: string }>}
 */
async function fetchFromCobalt(mediaUrl, options = {}) {
  const isAudio = options.format === 'audio';
  const payload = {
    url: mediaUrl,
    downloadMode: isAudio ? 'audio' : 'auto',
    videoQuality: mapVideoQuality(options.quality),
    audioFormat: isAudio ? mapAudioFormat(options.audioFormat) : 'best',
    audioBitrate: options.audioBitrate || '320',
    filenameStyle: 'pretty',
  };

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'MediaToolkit/2.0',
  };

  if (process.env.COBALT_API_KEY) {
    headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;
  }

  for (const instance of COBALT_INSTANCES) {
    const endpoint = instance.endsWith('/') ? instance : `${instance}/`;
    try {
      const response = await axios.post(endpoint, payload, {
        headers,
        timeout: 2500, // Fast timeout for responsive failover
      });

      const data = response.data;
      if (!data) continue;

      let downloadUrl = null;
      let filename = data.filename || null;

      if (['tunnel', 'redirect', 'stream'].includes(data.status)) {
        downloadUrl = data.url;
      } else if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
        downloadUrl = isAudio && data.audio ? data.audio : data.picker[0].url;
      } else if (data.url) {
        downloadUrl = data.url;
      }

      if (downloadUrl) {
        if (!filename) {
          const ext = isAudio ? (options.audioFormat || 'mp3') : 'mp4';
          filename = `media-${Date.now()}.${ext}`;
        }
        return {
          success: true,
          url: downloadUrl,
          fileName: filename,
          status: data.status || 'stream',
          instance,
        };
      }

      if (data.status === 'error') {
        console.error(`[Cobalt Service] Instance ${instance} returned error:`, data.error);
      }
    } catch (err) {
      const status = err.response?.status;
      const errorData = err.response?.data;
      console.error(
        `[Cobalt Service] Instance ${instance} failed [HTTP ${status || 'ERR'}]:`,
        errorData ? JSON.stringify(errorData) : err.message
      );
    }
  }

  throw new Error('Tüm Cobalt API instance istekleri başarısız oldu.');
}

/**
 * Fallback to Invidious or Piped API when Cobalt is unavailable.
 *
 * @param {string} videoId - 11-char YouTube ID
 * @param {Object} options
 * @returns {Promise<{ url: string, fileName: string, title: string }>}
 */
async function fetchFromInvidiousOrPiped(videoId, options = {}) {
  const isAudio = options.format === 'audio';

  // 1. Try Invidious
  for (const invidious of INVIDIOUS_INSTANCES) {
    try {
      const res = await axios.get(`${invidious}/api/v1/videos/${videoId}`, {
        timeout: 2000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const data = res.data;
      if (data && data.title) {
        let chosenStream = null;
        if (isAudio && Array.isArray(data.adaptiveFormats)) {
          chosenStream = data.adaptiveFormats.find((f) => f.type?.includes('audio')) || data.adaptiveFormats[0];
        } else if (Array.isArray(data.formatStreams) && data.formatStreams.length > 0) {
          chosenStream = data.formatStreams[0]; // Progressive MP4
        }

        if (chosenStream?.url) {
          const safeTitle = data.title.replace(/[/\\?%*:|"<>]/g, '_');
          const ext = isAudio ? 'm4a' : (chosenStream.container || 'mp4');
          return {
            success: true,
            url: chosenStream.url,
            fileName: `${safeTitle}.${ext}`,
            title: data.title,
            source: 'invidious',
          };
        }
      }
    } catch (err) {
      console.warn(`[Invidious Fallback] ${invidious} failed:`, err.message);
    }
  }

  // 2. Try Piped
  for (const piped of PIPED_INSTANCES) {
    try {
      const res = await axios.get(`${piped}/streams/${videoId}`, {
        timeout: 2000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const data = res.data;
      if (data && (data.videoStreams || data.audioStreams)) {
        let chosenStream = null;
        if (isAudio && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          chosenStream = data.audioStreams[0];
        } else if (Array.isArray(data.videoStreams) && data.videoStreams.length > 0) {
          chosenStream = data.videoStreams.find((v) => !v.videoOnly) || data.videoStreams[0];
        }

        if (chosenStream?.url) {
          const safeTitle = (data.title || 'YouTube Media').replace(/[/\\?%*:|"<>]/g, '_');
          const ext = isAudio ? 'm4a' : (chosenStream.format?.toLowerCase() || 'mp4');
          return {
            success: true,
            url: chosenStream.url,
            fileName: `${safeTitle}.${ext}`,
            title: data.title || 'Media',
            source: 'piped',
          };
        }
      }
    } catch (err) {
      console.warn(`[Piped Fallback] ${piped} failed:`, err.message);
    }
  }

  throw new Error('Invidious ve Piped ayrıştırıcıları da yanıt vermedi.');
}

/**
 * Universal External Resolver:
 * Tries Cobalt API first; then Invidious/Piped API for YouTube.
 *
 * @param {string} mediaUrl
 * @param {Object} options
 * @returns {Promise<{ url: string, fileName: string, source: string }>}
 */
async function fetchMediaStream(mediaUrl, options = {}) {
  // 1. Cobalt API
  try {
    return await fetchFromCobalt(mediaUrl, options);
  } catch (cobaltErr) {
    console.error('[Stream Resolver] Cobalt attempt failed:', cobaltErr.message);
  }

  // 2. Invidious / Piped (for YouTube URLs)
  const ytId = extractYouTubeId(mediaUrl);
  if (ytId) {
    try {
      console.log(`[Stream Resolver] Attempting Invidious / Piped for YouTube ID: ${ytId}...`);
      return await fetchFromInvidiousOrPiped(ytId, options);
    } catch (invErr) {
      console.error('[Stream Resolver] Invidious / Piped attempt failed:', invErr.message);
    }
  }

  throw new Error('Tüm harici medya API sağlayıcıları (Cobalt, Invidious, Piped) yanıt vermedi.');
}

module.exports = {
  fetchMediaStream,
  fetchFromCobalt,
  fetchFromInvidiousOrPiped,
  extractYouTubeId,
  mapVideoQuality,
  mapAudioFormat,
  COBALT_INSTANCES,
};
