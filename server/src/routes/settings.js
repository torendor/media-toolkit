/**
 * @fileoverview Settings route for retrieving and validating server capabilities.
 * Returns information about available tools, supported formats, and server status.
 * @module routes/settings
 */

const { Router } = require('express');
const { spawn } = require('child_process');
const downloadManager = require('../services/downloadManager');

const router = Router();

/**
 * GET /api/settings
 *
 * Return server capabilities, supported formats, and tool availability.
 */
router.get('/', async (req, res) => {
  try {
    const [ytdlpVersion, ffmpegVersion] = await Promise.all([
      getToolVersion('yt-dlp', ['--version']),
      getToolVersion('ffmpeg', ['-version']),
    ]);

    res.json({
      success: true,
      data: {
        server: {
          port: process.env.PORT || 3001,
          maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 3,
          activeDownloads: downloadManager.getActiveCount(),
        },
        tools: {
          ytdlp: {
            available: !!ytdlpVersion,
            version: ytdlpVersion || 'Not found',
          },
          ffmpeg: {
            available: !!ffmpegVersion,
            version: ffmpegVersion || 'Not found',
          },
        },
        supportedFormats: {
          audio: ['mp3', 'flac', 'wav', 'm4a', 'opus', 'ogg'],
          video: ['mp4', 'mkv', 'webm'],
        },
        qualityOptions: {
          video: ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'],
          audioBitrate: ['320', '256', '192', '160', '128', '96'],
        },
        normalization: {
          standards: ['ebu_r128', 'replaygain'],
        },
        fileNameTokens: ['{title}', '{artist}', '{album}', '{track_num}', '{year}', '{ext}'],
        spotify: {
          configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
        },
      },
    });
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings',
    });
  }
});

/**
 * GET /api/settings/health
 *
 * Simple health check endpoint.
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Get the version string of an external CLI tool.
 * Returns null if the tool is not installed or not in PATH.
 *
 * @param {string} command - The CLI command name (e.g., 'yt-dlp', 'ffmpeg')
 * @param {string[]} args - Arguments to get version info
 * @returns {Promise<string|null>} Version string, or null if not available
 */
function getToolVersion(command, args) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(command, args, {
        windowsHide: true,
        timeout: 5000,
      });

      let stdout = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          // Extract just the first line for cleaner output
          const firstLine = stdout.trim().split('\n')[0].trim();
          resolve(firstLine);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

module.exports = router;
