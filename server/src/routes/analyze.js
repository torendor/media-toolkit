/**
 * @fileoverview Analyze route for inspecting YouTube/Spotify URLs.
 * Accepts a URL, detects the platform, fetches metadata, and returns
 * structured preview data for the frontend to display.
 * @module routes/analyze
 */

const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { detectPlatform, extractSpotifyId, isPlaylist } = require('../utils/urlParser');
const youtubeService = require('../services/youtubeService');
const spotifyService = require('../services/spotifyService');

const router = Router();

/**
 * POST /api/analyze
 *
 * Analyze a media URL and return structured metadata for preview.
 *
 * Request body:
 *   { "url": "https://youtube.com/watch?v=..." }
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": { platform, type, title, thumbnail, duration, ... }
 *   }
 */
router.post(
  '/',
  [
    body('url')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('URL is required')
      .isURL({ require_protocol: false, require_tld: false })
      .withMessage('Invalid URL format'),
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { url } = req.body;

    try {
      const platform = detectPlatform(url);

      if (platform === 'unknown') {
        return res.status(400).json({
          success: false,
          error: 'Desteklenmeyen bağlantı formatı. Lütfen YouTube, Spotify, TikTok, Instagram veya Twitter/X bağlantısı girin.',
        });
      }

      let data;

      if (platform === 'youtube') {
        data = await analyzeYouTube(url);
      } else if (platform === 'spotify') {
        data = await analyzeSpotify(url);
      } else if (['tiktok', 'instagram', 'twitter'].includes(platform)) {
        data = await youtubeService.getInfo(url, platform);
      }

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      console.error('[Analyze] Error:', err.message);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to analyze URL',
      });
    }
  }
);

/**
 * Analyze a YouTube URL — fetch video or playlist metadata.
 *
 * @param {string} url - The YouTube URL
 * @returns {Promise<Object>} Structured YouTube metadata
 */
async function analyzeYouTube(url) {
  if (isPlaylist(url)) {
    const playlistInfo = await youtubeService.getPlaylistInfo(url);
    return {
      ...playlistInfo,
      isPlaylist: true,
    };
  }

  const videoInfo = await youtubeService.getInfo(url);
  return videoInfo;
}

/**
 * Analyze a Spotify URL — detect resource type and fetch appropriate metadata.
 *
 * @param {string} url - The Spotify URL
 * @returns {Promise<Object>} Structured Spotify metadata
 */
async function analyzeSpotify(url) {
  const spotifyId = extractSpotifyId(url);

  if (!spotifyId) {
    throw new Error('Could not extract Spotify ID from URL');
  }

  switch (spotifyId.type) {
    case 'track':
      return await spotifyService.getTrackInfo(spotifyId.id);

    case 'album':
      return await spotifyService.getAlbumInfo(spotifyId.id);

    case 'playlist':
      return await spotifyService.getPlaylistInfo(spotifyId.id);

    default:
      throw new Error(`Unsupported Spotify resource type: ${spotifyId.type}`);
  }
}

module.exports = router;
