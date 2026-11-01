/**
 * @fileoverview Spotify service for resolving track/album/playlist metadata
 * via the Spotify Web API and downloading matching audio via yt-dlp + FFmpeg.
 * Uses the Client Credentials flow for authentication.
 * @module services/spotifyService
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const youtubeService = require('./youtubeService');
const ffmpegService = require('./ffmpegService');
const { sanitizeFileName } = require('../utils/fileNaming');
const { getCollectionInfo } = require('./spotifyEmbed');

/** Spotify API base URL */
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

/** Spotify token endpoint */
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Cached access token and its expiration time.
 * @type {{ token: string|null, expiresAt: number }}
 */
let tokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Path to the downloads directory.
 * @type {string}
 */
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

/**
 * Obtain a Spotify API access token using the Client Credentials flow.
 * Caches the token and only refreshes when it's expired (with a 60s buffer).
 *
 * @returns {Promise<string>} A valid Spotify access token
 * @throws {Error} If credentials are missing or the request fails
 */
async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env'
    );
  }

  // Return cached token if still valid (with 60s safety margin)
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  try {
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      SPOTIFY_TOKEN_URL,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    tokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };

    console.log('[Spotify] Access token obtained/refreshed');
    return tokenCache.token;
  } catch (err) {
    const message = err.response?.data?.error_description || err.message;
    throw new Error(`Failed to get Spotify access token: ${message}`);
  }
}

/**
 * Fetch track metadata from the Spotify API.
 *
 * @param {string} trackId - The Spotify track ID
 * @returns {Promise<Object>} Structured track metadata
 * @throws {Error} If the API request fails
 */
/**
 * Fetch track metadata from the Spotify API, with automatic fallback to oEmbed + HTML metadata.
 *
 * @param {string} trackId - The Spotify track ID
 * @returns {Promise<Object>} Structured track metadata
 */
async function getTrackInfo(trackId) {
  try {
    const token = await getAccessToken();
    const response = await axios.get(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    });
    return formatTrackInfo(response.data);
  } catch (err) {
    console.warn(`[Spotify] Official API failed (${err.message}), falling back to oEmbed/Scraper...`);
    return await getTrackInfoFallback(trackId);
  }
}

/**
 * Fallback resolver using Spotify's embed page and __NEXT_DATA__ JSON payload.
 * Fully extracts official title, artists, album, duration, year, and HD cover art
 * without requiring any Spotify Developer API keys or credentials.
 *
 * @param {string} trackId - The Spotify track ID
 * @returns {Promise<Object>} Structured track metadata
 */
async function getTrackInfoFallback(trackId) {
  const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
  
  try {
    const res = await axios.get(embedUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const nextDataMatch = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch && nextDataMatch[1]) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const entity = nextData?.props?.pageProps?.state?.data?.entity;

      if (entity) {
        const title = entity.title || entity.name || 'Spotify Track';
        const artist = (entity.artists || []).map(a => a.name).join(', ') || 'Unknown Artist';
        const durationMs = entity.duration || 0;
        const durationSec = Math.round(durationMs / 1000);
        const images = entity.visualIdentity?.image || [];
        const coverUrl = images[images.length - 1]?.url || images[0]?.url || null;
        const releaseYear = entity.releaseDate?.isoString ? entity.releaseDate.isoString.substring(0, 4) : '';

        return {
          platform: 'spotify',
          type: 'track',
          id: trackId,
          title,
          artist,
          album: entity.album?.name || title,
          albumArtist: artist,
          trackNumber: entity.trackNumber || 1,
          discNumber: 1,
          year: releaseYear || new Date().getFullYear().toString(),
          duration: durationSec,
          durationFormatted: formatDurationMs(durationMs),
          coverUrl,
          thumbnail: coverUrl,
          previewUrl: entity.audioPreview?.url || null,
          isrc: null,
          explicit: !!entity.isExplicit,
          popularity: 80,
        };
      }
    }
  } catch (err) {
    console.warn('[Spotify Fallback] Embed parse error:', err.message);
  }

  // Secondary fallback: oEmbed
  const oembedRes = await axios.get(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`);
  const title = oembedRes.data?.title || 'Spotify Track';
  const thumbnail = oembedRes.data?.thumbnail_url || null;

  return {
    platform: 'spotify',
    type: 'track',
    id: trackId,
    title,
    artist: 'Spotify Artist',
    album: title,
    albumArtist: 'Spotify Artist',
    trackNumber: 1,
    discNumber: 1,
    year: new Date().getFullYear().toString(),
    duration: 0,
    durationFormatted: '--:--',
    coverUrl: thumbnail,
    thumbnail,
    previewUrl: null,
    isrc: null,
    explicit: false,
    popularity: 50,
  };
}

/**
 * Fetch album metadata with all tracks from the Spotify API.
 *
 * @param {string} albumId - The Spotify album ID
 * @returns {Promise<Object>} Structured album metadata with track list
 * @throws {Error} If the API request fails
 */
async function getAlbumInfo(albumId) {
  try {
    return await getAlbumInfoOfficial(albumId);
  } catch (err) {
    console.warn(`[Spotify] Album API failed (${err.message}), falling back to embed scraper...`);
    return await getCollectionInfo('album', albumId);
  }
}

async function getAlbumInfoOfficial(albumId) {
  const token = await getAccessToken();

  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    });

    const album = response.data;

    // Format each track in the album
    const tracks = album.tracks.items.map((track, index) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      trackNumber: track.track_number || index + 1,
      duration: Math.round((track.duration_ms || 0) / 1000),
      durationFormatted: formatDurationMs(track.duration_ms),
      previewUrl: track.preview_url,
      uri: track.uri,
    }));

    return {
      platform: 'spotify',
      type: 'album',
      id: album.id,
      title: album.name,
      artist: album.artists.map((a) => a.name).join(', '),
      releaseDate: album.release_date || '',
      year: album.release_date ? album.release_date.substring(0, 4) : '',
      totalTracks: album.total_tracks,
      coverUrl: album.images?.[0]?.url || null,
      thumbnail: album.images?.[1]?.url || album.images?.[0]?.url || null,
      genres: album.genres || [],
      label: album.label || '',
      tracks,
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    throw new Error(`Failed to get Spotify album info: ${message}`);
  }
}

/**
 * Fetch playlist metadata with all tracks from the Spotify API.
 * Handles pagination for playlists with more than 100 tracks.
 *
 * @param {string} playlistId - The Spotify playlist ID
 * @returns {Promise<Object>} Structured playlist metadata with track list
 * @throws {Error} If the API request fails
 */
async function getPlaylistInfo(playlistId) {
  try {
    return await getPlaylistInfoOfficial(playlistId);
  } catch (err) {
    console.warn(`[Spotify] Playlist API failed (${err.message}), falling back to embed scraper...`);
    return await getCollectionInfo('playlist', playlistId);
  }
}

async function getPlaylistInfoOfficial(playlistId) {
  const token = await getAccessToken();

  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { fields: 'id,name,description,images,owner,tracks' },
      timeout: 15000,
    });

    const playlist = response.data;
    let allItems = playlist.tracks.items || [];

    // Paginate through remaining tracks if the playlist has more than 100
    let nextUrl = playlist.tracks.next;
    while (nextUrl) {
      const nextResponse = await axios.get(nextUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000,
      });
      allItems = allItems.concat(nextResponse.data.items || []);
      nextUrl = nextResponse.data.next;
    }

    // Format each track entry
    const tracks = allItems
      .filter((item) => item.track && item.track.id)
      .map((item, index) => {
        const track = item.track;
        return {
          id: track.id,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          album: track.album?.name || '',
          trackNumber: index + 1,
          duration: Math.round((track.duration_ms || 0) / 1000),
          durationFormatted: formatDurationMs(track.duration_ms),
          coverUrl: track.album?.images?.[0]?.url || null,
          previewUrl: track.preview_url,
          uri: track.uri,
        };
      });

    return {
      platform: 'spotify',
      type: 'playlist',
      id: playlist.id,
      title: playlist.name || 'Unknown Playlist',
      description: playlist.description || '',
      owner: playlist.owner?.display_name || 'Unknown',
      coverUrl: playlist.images?.[0]?.url || null,
      thumbnail: playlist.images?.[1]?.url || playlist.images?.[0]?.url || null,
      totalTracks: tracks.length,
      tracks,
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    throw new Error(`Failed to get Spotify playlist info: ${message}`);
  }
}

/**
 * Find a matching YouTube video for a Spotify track and download it as audio.
 * Searches YouTube for "{artist} - {title}", downloads the best audio match,
 * converts to the requested format, and applies ID3 tags with cover art.
 *
 * @param {Object} trackInfo - Spotify track metadata (from getTrackInfo or formatTrackInfo)
 * @param {string} trackInfo.title - Track title
 * @param {string} trackInfo.artist - Artist name
 * @param {string} [trackInfo.album] - Album name
 * @param {string} [trackInfo.year] - Release year
 * @param {number} [trackInfo.trackNumber] - Track number
 * @param {string} [trackInfo.coverUrl] - Album cover URL
 * @param {Object} [options={}] - Download/conversion options
 * @param {string} [options.audioFormat='mp3'] - Target audio format
 * @param {string} [options.audioBitrate='192'] - Target bitrate in kbps
 * @param {boolean} [options.normalize=false] - Whether to apply loudness normalization
 * @param {string} [options.normalizationStandard='ebu_r128'] - Normalization standard
 * @param {boolean} [options.trimSilence=false] - Whether to trim leading/trailing silence
 * @param {Function} [progressCallback] - Called with progress updates
 * @returns {Promise<string>} Absolute path to the final audio file
 */
async function findAndDownload(trackInfo, options = {}, progressCallback = null) {
  const searchQuery = `${trackInfo.artist} - ${trackInfo.title}`;
  const audioFormat = options.audioFormat || 'mp3';
  const safeName = sanitizeFileName(`${trackInfo.artist} - ${trackInfo.title}`);

  // Ensure download directory exists
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  // Stage 1: Search YouTube for the track
  if (progressCallback) {
    progressCallback({
      percent: 5,
      speed: '',
      eta: '',
      stage: 'downloading',
      message: `Searching YouTube for: ${searchQuery}`,
    });
  }

  const searchUrl = `ytsearch1:${searchQuery}`;

  // Stage 2: Download audio from YouTube
  const outputTemplate = path.join(DOWNLOAD_DIR, `${safeName}.%(ext)s`);

  const downloadedPath = await youtubeService.download(
    searchUrl,
    {
      format: 'audio',
      audioFormat,
      audioBitrate: options.audioBitrate || '192',
      outputPath: outputTemplate,
    },
    (progress) => {
      if (progressCallback) {
        // Scale download progress to 10-60% range
        const scaledPercent = 10 + (progress.percent * 0.5);
        progressCallback({
          ...progress,
          percent: Math.min(scaledPercent, 60),
          stage: 'downloading',
        });
      }
    }
  );

  let currentPath = downloadedPath;

  // Stage 3: Additional conversion if needed
  if (progressCallback) {
    progressCallback({
      percent: 65,
      speed: '',
      eta: '',
      stage: 'converting',
      message: 'Processing audio...',
    });
  }

  // Stage 4: Normalize audio if requested
  if (options.normalize) {
    if (progressCallback) {
      progressCallback({
        percent: 70,
        speed: '',
        eta: '',
        stage: 'converting',
        message: 'Normalizing audio levels...',
      });
    }

    const normalizedPath = currentPath.replace(
      path.extname(currentPath),
      `_normalized${path.extname(currentPath)}`
    );

    await ffmpegService.normalizeAudio(
      currentPath,
      normalizedPath,
      options.normalizationStandard || 'ebu_r128'
    );

    // Replace original with normalized version
    await fs.promises.unlink(currentPath);
    await fs.promises.rename(normalizedPath, currentPath);
  }

  // Stage 5: Trim silence if requested
  if (options.trimSilence) {
    if (progressCallback) {
      progressCallback({
        percent: 75,
        speed: '',
        eta: '',
        stage: 'converting',
        message: 'Trimming silence...',
      });
    }

    const trimmedPath = currentPath.replace(
      path.extname(currentPath),
      `_trimmed${path.extname(currentPath)}`
    );

    await ffmpegService.trimSilence(currentPath, trimmedPath);

    await fs.promises.unlink(currentPath);
    await fs.promises.rename(trimmedPath, currentPath);
  }

  // Stage 6: Apply ID3 tags
  if (progressCallback) {
    progressCallback({
      percent: 85,
      speed: '',
      eta: '',
      stage: 'tagging',
      message: 'Applying metadata tags...',
    });
  }

  await ffmpegService.applyID3Tags(currentPath, {
    title: trackInfo.title,
    artist: trackInfo.artist,
    album: trackInfo.album,
    trackNumber: trackInfo.trackNumber,
    year: trackInfo.year,
    coverUrl: trackInfo.coverUrl,
  });

  if (progressCallback) {
    progressCallback({
      percent: 100,
      speed: '',
      eta: '',
      stage: 'complete',
      message: 'Download complete!',
    });
  }

  return currentPath;
}

/**
 * Format a raw Spotify track object into a clean metadata structure.
 *
 * @param {Object} track - Raw track object from Spotify API
 * @returns {Object} Formatted track metadata
 */
function formatTrackInfo(track) {
  return {
    platform: 'spotify',
    type: 'track',
    id: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    artists: track.artists.map((a) => ({ name: a.name, id: a.id })),
    album: track.album?.name || '',
    albumId: track.album?.id || '',
    trackNumber: track.track_number || 1,
    discNumber: track.disc_number || 1,
    duration: Math.round((track.duration_ms || 0) / 1000),
    durationFormatted: formatDurationMs(track.duration_ms),
    year: track.album?.release_date ? track.album.release_date.substring(0, 4) : '',
    releaseDate: track.album?.release_date || '',
    coverUrl: track.album?.images?.[0]?.url || null,
    thumbnail: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
    previewUrl: track.preview_url || null,
    explicit: track.explicit || false,
    isrc: track.external_ids?.isrc || null,
    uri: track.uri,
    isPlaylist: false,
  };
}

/**
 * Format milliseconds into a "M:SS" or "H:MM:SS" string.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDurationMs(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
  getAccessToken,
  getTrackInfo,
  getAlbumInfo,
  getPlaylistInfo,
  findAndDownload,
};
