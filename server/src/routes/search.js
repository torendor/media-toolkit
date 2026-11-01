/**
 * @fileoverview Search route for searching videos and music directly
 * without requiring the user to paste a URL.
 * @module routes/search
 */

const { Router } = require('express');
const { query, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const { getYtdlpPath } = require('../utils/binaries');

const router = Router();

/**
 * Format duration in seconds to mm:ss
 * @param {number} sec 
 * @returns {string}
 */
function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * GET /api/search?q=query&limit=8
 * Searches YouTube for videos/songs matching the query and returns structured results.
 */
router.get(
  '/',
  [
    query('q').isString().trim().notEmpty().withMessage('Arama terimi zorunludur'),
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi geçersiz',
        details: errors.array(),
      });
    }

    const searchQuery = req.query.q;
    const limit = req.query.limit || 8;

    try {
      const results = await performSearch(searchQuery, limit);
      return res.json({
        success: true,
        query: searchQuery,
        count: results.length,
        results,
      });
    } catch (err) {
      console.error('[Search] Error:', err.message);
      return res.status(500).json({
        success: false,
        error: err.message || 'Arama gerçekleştirilemedi',
      });
    }
  }
);

/**
 * Execute yt-dlp search with flat-playlist extraction
 * @param {string} q 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
function performSearch(q, limit) {
  return new Promise((resolve, reject) => {
    const searchTarget = `ytsearch${limit}:${q}`;
    const args = [
      searchTarget,
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
    ];

    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(`Arama aracı hata verdi (${code}): ${stderr.trim()}`));
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const rawEntries = parsed.entries || [];
        
        const results = rawEntries
          .filter((entry) => entry && entry.id)
          .map((entry) => {
            const bestThumb = Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0
              ? entry.thumbnails[entry.thumbnails.length - 1].url
              : `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;

            return {
              id: entry.id,
              url: `https://www.youtube.com/watch?v=${entry.id}`,
              title: entry.title || 'Bilinmeyen Başlık',
              artist: entry.channel || entry.uploader || 'Bilinmeyen Sanatçı',
              channel: entry.channel || entry.uploader || '',
              duration: entry.duration || 0,
              durationFormatted: formatSeconds(entry.duration),
              thumbnail: bestThumb,
              views: entry.view_count || null,
              platform: 'youtube',
            };
          });

        resolve(results);
      } catch (parseErr) {
        reject(new Error(`Arama sonuçları ayrıştırılamadı: ${parseErr.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Arama başlatılamadı: ${err.message}`));
    });
  });
}

module.exports = router;

