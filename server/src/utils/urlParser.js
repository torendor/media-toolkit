/**
 * @fileoverview URL parsing utilities for detecting platforms and extracting IDs
 * from YouTube and Spotify URLs.
 * @module utils/urlParser
 */

/**
 * Regular expressions for matching various YouTube URL formats.
 * Covers youtube.com/watch, youtu.be short links, embeds, shorts, and playlists.
 */
const YOUTUBE_PATTERNS = {
  standard: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  short: /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  embed: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  shorts: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  playlist: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*[?&]list=([a-zA-Z0-9_-]+)/,
  music: /(?:https?:\/\/)?music\.youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
};

/**
 * Regular expressions for matching Spotify URL formats.
 * Covers tracks, albums, playlists, and artists.
 */
const SPOTIFY_PATTERNS = {
  track: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?track\/([a-zA-Z0-9]+)/,
  album: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?album\/([a-zA-Z0-9]+)/,
  playlist: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?playlist\/([a-zA-Z0-9]+)/,
  artist: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?artist\/([a-zA-Z0-9]+)/,
  uri_track: /spotify:track:([a-zA-Z0-9]+)/,
  uri_album: /spotify:album:([a-zA-Z0-9]+)/,
  uri_playlist: /spotify:playlist:([a-zA-Z0-9]+)/,
};

/**
 * Detect which platform a URL belongs to.
 * @param {string} url - The URL to analyze
 * @returns {'youtube'|'spotify'|'unknown'} The detected platform
 */
function detectPlatform(url) {
  if (!url || typeof url !== 'string') return 'unknown';

  const normalizedUrl = url.trim().toLowerCase();

  // Check YouTube patterns
  if (
    normalizedUrl.includes('youtube.com') ||
    normalizedUrl.includes('youtu.be') ||
    normalizedUrl.includes('music.youtube.com')
  ) {
    return 'youtube';
  }

  // Check Spotify patterns
  if (
    normalizedUrl.includes('spotify.com') ||
    normalizedUrl.startsWith('spotify:')
  ) {
    return 'spotify';
  }

  return 'unknown';
}

/**
 * Extract the video ID from a YouTube URL.
 * Supports youtube.com/watch, youtu.be, embeds, shorts, and YouTube Music links.
 * @param {string} url - The YouTube URL
 * @returns {string|null} The 11-character video ID, or null if not found
 */
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;

  // Try each pattern in order of specificity
  for (const [, pattern] of Object.entries(YOUTUBE_PATTERNS)) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract the resource ID and type from a Spotify URL or URI.
 * @param {string} url - The Spotify URL or URI
 * @returns {{ type: 'track'|'album'|'playlist'|'artist', id: string }|null}
 *   The extracted type and ID, or null if not recognized
 */
function extractSpotifyId(url) {
  if (!url || typeof url !== 'string') return null;

  // Define the type-to-patterns mapping
  const typePatterns = [
    { type: 'track', patterns: [SPOTIFY_PATTERNS.track, SPOTIFY_PATTERNS.uri_track] },
    { type: 'album', patterns: [SPOTIFY_PATTERNS.album, SPOTIFY_PATTERNS.uri_album] },
    { type: 'playlist', patterns: [SPOTIFY_PATTERNS.playlist, SPOTIFY_PATTERNS.uri_playlist] },
    { type: 'artist', patterns: [SPOTIFY_PATTERNS.artist] },
  ];

  for (const { type, patterns } of typePatterns) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return { type, id: match[1] };
      }
    }
  }

  return null;
}

/**
 * Determine whether a URL points to a playlist or multi-item collection.
 * Checks for YouTube playlists, Spotify playlists, and Spotify albums.
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL represents a playlist or album
 */
function isPlaylist(url) {
  if (!url || typeof url !== 'string') return false;

  // YouTube playlist
  if (YOUTUBE_PATTERNS.playlist.test(url)) {
    return true;
  }

  // Spotify playlist or album (both are multi-track collections)
  const spotifyInfo = extractSpotifyId(url);
  if (spotifyInfo && (spotifyInfo.type === 'playlist' || spotifyInfo.type === 'album')) {
    return true;
  }

  return false;
}

module.exports = {
  detectPlatform,
  extractYouTubeId,
  extractSpotifyId,
  isPlaylist,
};
