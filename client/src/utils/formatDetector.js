/**
 * formatDetector.js
 * URL pattern detection for YouTube and Spotify platforms.
 * Extracts platform type, video/track IDs, and content type info.
 */

// ============================================
// YouTube URL patterns
// ============================================
const YOUTUBE_PATTERNS = [
  // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  // Short URLs: youtu.be/VIDEO_ID
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // Shorts URLs: youtube.com/shorts/VIDEO_ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  // Embed URLs: youtube.com/embed/VIDEO_ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // Music URLs: music.youtube.com/watch?v=VIDEO_ID
  /(?:https?:\/\/)?music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
];

// YouTube playlist pattern
const YOUTUBE_PLAYLIST_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/;

// ============================================
// Spotify URL patterns
// ============================================
const SPOTIFY_PATTERNS = {
  track: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?track\/([a-zA-Z0-9]+)/,
  album: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?album\/([a-zA-Z0-9]+)/,
  playlist: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-zA-Z0-9-]+\/)?playlist\/([a-zA-Z0-9]+)/,
};

/**
 * Detect the platform from a given URL.
 * @param {string} url - The URL to analyze
 * @returns {'youtube' | 'spotify' | null} The detected platform
 */
export function detectPlatform(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmedUrl = url.trim();

  // Check YouTube patterns (including playlist)
  const isYouTube =
    YOUTUBE_PATTERNS.some((pattern) => pattern.test(trimmedUrl)) ||
    YOUTUBE_PLAYLIST_PATTERN.test(trimmedUrl);

  if (isYouTube) return 'youtube';

  // Check Spotify patterns
  const isSpotify = Object.values(SPOTIFY_PATTERNS).some((pattern) =>
    pattern.test(trimmedUrl)
  );

  if (isSpotify) return 'spotify';

  return null;
}

/**
 * Extract the YouTube video ID from a URL.
 * @param {string} url - A YouTube URL
 * @returns {string | null} The 11-character video ID, or null
 */
export function getYouTubeVideoId(url) {
  if (!url) return null;

  const trimmedUrl = url.trim();

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract the YouTube playlist ID from a URL.
 * @param {string} url - A YouTube playlist URL
 * @returns {string | null} The playlist ID, or null
 */
export function getYouTubePlaylistId(url) {
  if (!url) return null;

  const match = url.trim().match(YOUTUBE_PLAYLIST_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract Spotify content info from a URL.
 * @param {string} url - A Spotify URL
 * @returns {{ type: 'track' | 'album' | 'playlist', id: string } | null}
 */
export function getSpotifyInfo(url) {
  if (!url) return null;

  const trimmedUrl = url.trim();

  for (const [type, pattern] of Object.entries(SPOTIFY_PATTERNS)) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return { type, id: match[1] };
    }
  }

  return null;
}

/**
 * Check if a URL points to a playlist/album (multi-track content).
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isPlaylistUrl(url) {
  if (!url) return false;

  const trimmedUrl = url.trim();

  // YouTube playlist
  if (YOUTUBE_PLAYLIST_PATTERN.test(trimmedUrl)) return true;

  // Spotify album or playlist
  const spotifyInfo = getSpotifyInfo(trimmedUrl);
  if (spotifyInfo && (spotifyInfo.type === 'album' || spotifyInfo.type === 'playlist')) {
    return true;
  }

  return false;
}
