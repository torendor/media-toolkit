/**
 * @fileoverview Download routes for starting, tracking, and retrieving media downloads.
 * Provides endpoints for single downloads, batch downloads with ZIP packaging,
 * SSE-based progress streaming, and file retrieval with auto-cleanup.
 * @module routes/download
 */

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { detectPlatform, extractSpotifyId } = require('../utils/urlParser');
const { generateFileName } = require('../utils/fileNaming');
const { cleanupFile, cleanupDownload } = require('../utils/cleanup');
const youtubeService = require('../services/youtubeService');
const spotifyService = require('../services/spotifyService');
const ffmpegService = require('../services/ffmpegService');
const downloadManager = require('../services/downloadManager');

const router = Router();

/**
 * Path to the downloads directory.
 * @type {string}
 */
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

/**
 * POST /api/download/start
 *
 * Initiate a new download. The download runs in the background and progress
 * can be tracked via the SSE endpoint.
 *
 * Request body:
 *   {
 *     "url": "https://...",
 *     "platform": "youtube" | "spotify",
 *     "format": "audio" | "video",
 *     "quality": "best" | "1080p" | "720p" | etc.,
 *     "options": {
 *       "audioFormat": "mp3",
 *       "audioBitrate": "192",
 *       "normalize": false,
 *       "normalizationStandard": "ebu_r128",
 *       "trimSilence": false,
 *       "fileNameTemplate": "{artist} - {title}"
 *     }
 *   }
 *
 * Response: { "success": true, "downloadId": "uuid" }
 */
router.post(
  '/start',
  [
    body('url').isString().trim().notEmpty().withMessage('URL is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    // Check concurrency limit
    if (!downloadManager.canStartDownload()) {
      return res.status(429).json({
        success: false,
        error: 'Maksimum eşzamanlı indirme sınırına ulaşıldı. Lütfen bekleyin.',
      });
    }

    const { url, platform, quality, options } = req.body;
    let format = req.body.format || 'audio';
    const downloadOptions = { ...(options || {}) };

    // Format normalization: If frontend sends 'mp3' or 'mp4', map appropriately
    const audioExts = ['mp3', 'flac', 'wav', 'm4a', 'opus', 'ogg', 'aac'];
    const videoExts = ['mp4', 'webm', 'mkv'];

    if (audioExts.includes(format.toLowerCase())) {
      downloadOptions.audioFormat = format.toLowerCase();
      format = 'audio';
    } else if (videoExts.includes(format.toLowerCase())) {
      downloadOptions.videoFormat = format.toLowerCase();
      format = 'video';
    }
    if (format === 'audio' && /^\d+$/.test(String(quality || '')) && !downloadOptions.audioBitrate) {
      downloadOptions.audioBitrate = String(quality);
    }

    const downloadId = uuidv4();

    // Create the download entry
    downloadManager.createDownload(downloadId);

    // Return the download ID immediately — actual work happens in background
    res.json({
      success: true,
      downloadId,
    });

    // Start the download process in the background (no await)
    processDownload(downloadId, url, platform || detectPlatform(url), {
      format: format || 'audio',
      quality: quality || 'best',
      ...downloadOptions,
    }).catch((err) => {
      console.error(`[Download] Background download ${downloadId} failed:`, err.message);
      downloadManager.updateProgress(downloadId, {
        status: 'error',
        stage: 'error',
        error: err.message,
        message: `Hata: ${err.message}`,
      });
    });
  }
);

/**
 * GET /api/download/progress/:id
 *
 * Server-Sent Events (SSE) endpoint for real-time download progress.
 * Streams events with the following data structure:
 *   { id, status, progress, speed, eta, stage, message, fileName, error }
 *
 * Stages: 'downloading', 'converting', 'tagging', 'packaging', 'complete', 'error'
 */
router.get('/progress/:id', [
  param('id').isUUID().withMessage('Invalid download ID'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid download ID' });
  }

  const { id } = req.params;
  const download = downloadManager.getProgress(id);

  if (!download) {
    return res.status(404).json({
      success: false,
      error: 'Download not found',
    });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
  });

  // Send initial state
  const initialEvent = {
    id: download.id,
    status: download.status,
    progress: download.progress,
    speed: download.speed,
    eta: download.eta,
    stage: download.stage,
    message: download.message,
    fileName: download.fileName,
    error: download.error,
  };
  res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

  // Register listener for updates
  const listener = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Close connection on terminal states
      if (event.status === 'complete' || event.status === 'error') {
        setTimeout(() => {
          res.end();
        }, 500); // Small delay to ensure the client receives the final event
      }
    } catch (err) {
      // Client disconnected
      console.log(`[SSE] Client disconnected for download ${id}`);
    }
  };

  downloadManager.addListener(id, listener);

  // Handle client disconnect
  req.on('close', () => {
    downloadManager.removeListener(id, listener);
    console.log(`[SSE] Client disconnected from progress stream: ${id}`);
  });

  // Send keepalive pings every 15 seconds to prevent connection timeout
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

/**
 * GET /api/download/file/:id
 *
 * Stream the completed download file to the client.
 * Automatically deletes the temp file after a successful transfer.
 */
router.get('/file/:id', [
  param('id').isUUID().withMessage('Invalid download ID'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid download ID' });
  }

  const { id } = req.params;
  const download = downloadManager.getProgress(id);

  if (!download) {
    return res.status(404).json({
      success: false,
      error: 'Download not found',
    });
  }

  if (download.status !== 'complete') {
    return res.status(400).json({
      success: false,
      error: `Download is not ready. Current status: ${download.status}`,
    });
  }

  const filePath = download.filePath;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'Download file not found on disk',
    });
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const fileName = download.fileName || path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Set appropriate Content-Type
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.opus': 'audio/opus',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.zip': 'application/zip',
    };

    res.set({
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    // Stream the file
    const stream = fs.createReadStream(filePath);

    stream.on('end', () => {
      // Schedule cleanup after the file has been fully streamed
      setTimeout(async () => {
        await cleanupFile(filePath);
        downloadManager.cleanup(id);
        console.log(`[Download] File served and cleaned up: ${id}`);
      }, 5000);
    });

    stream.on('error', (err) => {
      console.error(`[Download] File stream error:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error streaming file' });
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error(`[Download] Error serving file:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
});

/**
 * POST /api/download/batch
 *
 * Download multiple URLs and package them into a ZIP file.
 * Returns a download ID for progress tracking via SSE.
 *
 * Request body:
 *   {
 *     "urls": ["https://...", "https://..."],
 *     "platform": "youtube" | "spotify",
 *     "format": "audio",
 *     "quality": "best",
 *     "options": { ... }
 *   }
 *
 * Response: { "success": true, "downloadId": "uuid" }
 */
router.post(
  '/batch',
  [
    body('urls').optional().isArray({ min: 1, max: 100 }).withMessage('Provide 1-100 URLs'),
    body('trackIds').optional().isArray({ max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    if (!downloadManager.canStartDownload()) {
      return res.status(429).json({
        success: false,
        error: 'Maksimum eşzamanlı indirme sınırına ulaşıldı. Lütfen bekleyin.',
      });
    }

    const { platform, quality, options } = req.body;
    let urls = Array.isArray(req.body.urls) ? req.body.urls : [];

    // Frontend form: { url, trackIds } → expand track IDs into individual URLs
    if (!urls.length && Array.isArray(req.body.trackIds) && req.body.trackIds.length) {
      const sourcePlatform = platform || detectPlatform(req.body.url || '');
      urls = req.body.trackIds.map((id) =>
        sourcePlatform === 'spotify'
          ? `https://open.spotify.com/track/${id}`
          : `https://www.youtube.com/watch?v=${id}`
      );
    }

    if (!urls.length) {
      return res.status(400).json({ success: false, error: 'İndirilecek parça seçilmedi' });
    }

    let format = String(req.body.format || 'audio').toLowerCase();
    const downloadOptions = { ...(options || {}) };
    if (['mp3', 'flac', 'wav', 'm4a', 'opus', 'ogg', 'aac'].includes(format)) {
      downloadOptions.audioFormat = format;
      format = 'audio';
    } else if (['mp4', 'webm', 'mkv'].includes(format)) {
      downloadOptions.videoFormat = format;
      format = 'video';
    }
    if (format === 'audio' && /^\d+$/.test(String(quality || ''))) {
      downloadOptions.audioBitrate = String(quality);
    }

    const downloadId = uuidv4();

    downloadManager.createDownload(downloadId);

    res.json({
      success: true,
      downloadId,
      totalItems: urls.length,
      trackCount: urls.length,
    });

    // Start batch processing in background
    processBatchDownload(downloadId, urls, platform, {
      format,
      quality: quality || 'best',
      ...downloadOptions,
    }).catch((err) => {
      console.error(`[Batch] Background batch ${downloadId} failed:`, err.message);
      downloadManager.updateProgress(downloadId, {
        status: 'error',
        stage: 'error',
        error: err.message,
        message: `Batch error: ${err.message}`,
      });
    });
  }
);

/**
 * Process a single download in the background.
 * Routes to YouTube or Spotify service based on platform.
 *
 * @param {string} downloadId - Unique download session ID
 * @param {string} url - The media URL
 * @param {string} platform - 'youtube' or 'spotify'
 * @param {Object} options - Download/conversion options
 * @returns {Promise<void>}
 */
async function processDownload(downloadId, url, platform, options) {
  const progressCallback = (progress) => {
    downloadManager.updateProgress(downloadId, {
      status: progress.stage === 'complete' ? 'complete' : progress.stage,
      progress: progress.percent,
      speed: progress.speed || '',
      eta: progress.eta || '',
      stage: progress.stage,
      message: progress.message,
    });
  };

  // Ensure download directory exists
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  downloadManager.updateProgress(downloadId, {
    status: 'downloading',
    stage: 'downloading',
    message: 'Starting download...',
  });

  let outputPath;

  if (['youtube', 'tiktok', 'instagram', 'twitter'].includes(platform)) {
    outputPath = await youtubeService.download(url, options, progressCallback);

    // Apply post-processing if requested
    outputPath = await applyPostProcessing(outputPath, options, progressCallback);
  } else if (platform === 'spotify') {
    const spotifyId = extractSpotifyId(url);
    if (!spotifyId || spotifyId.type !== 'track') {
      throw new Error('Only individual Spotify tracks can be downloaded with /start. Use /batch for playlists/albums.');
    }

    const trackInfo = await spotifyService.getTrackInfo(spotifyId.id);
    outputPath = await spotifyService.findAndDownload(trackInfo, options, progressCallback);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Generate a clean filename
  const ext = path.extname(outputPath).replace('.', '');
  const baseName = path.basename(outputPath, path.extname(outputPath));
  const fileName = `${baseName}.${ext}`;

  downloadManager.updateProgress(downloadId, {
    status: 'complete',
    progress: 100,
    stage: 'complete',
    message: 'Download complete!',
    filePath: outputPath,
    fileName,
  });

  console.log(`[Download] Completed: ${downloadId} -> ${outputPath}`);
}

/**
 * Process a batch download: download each URL sequentially, then package as ZIP.
 *
 * @param {string} downloadId - Unique batch download session ID
 * @param {string[]} urls - Array of media URLs
 * @param {string} platform - Detected or specified platform
 * @param {Object} options - Download/conversion options
 * @returns {Promise<void>}
 */
async function processBatchDownload(downloadId, urls, platform, options) {
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  const downloadedFiles = [];
  const totalItems = urls.length;

  downloadManager.updateProgress(downloadId, {
    status: 'downloading',
    stage: 'downloading',
    message: `Starting batch download (0/${totalItems})...`,
  });

  // Download each item
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const itemPlatform = platform || detectPlatform(url);
    const itemNum = i + 1;

    try {
      const progressCallback = (progress) => {
        // Scale progress: each item gets an equal share of 0-85%
        const itemProgressRange = 85 / totalItems;
        const basePercent = (i / totalItems) * 85;
        const itemPercent = (progress.percent / 100) * itemProgressRange;

        downloadManager.updateProgress(downloadId, {
          status: 'downloading',
          progress: Math.round(basePercent + itemPercent),
          speed: progress.speed || '',
          eta: progress.eta || '',
          stage: 'downloading',
          message: `Downloading item ${itemNum}/${totalItems}: ${progress.message || ''}`,
        });
      };

      let outputPath;

      if (['youtube', 'tiktok', 'instagram', 'twitter'].includes(itemPlatform)) {
        outputPath = await youtubeService.download(url, options, progressCallback);
        outputPath = await applyPostProcessing(outputPath, options, null);
      } else if (itemPlatform === 'spotify') {
        const spotifyId = extractSpotifyId(url);
        if (spotifyId && spotifyId.type === 'track') {
          const trackInfo = await spotifyService.getTrackInfo(spotifyId.id);
          outputPath = await spotifyService.findAndDownload(trackInfo, options, progressCallback);
        } else {
          console.warn(`[Batch] Skipping non-track Spotify URL: ${url}`);
          continue;
        }
      } else {
        console.warn(`[Batch] Skipping unsupported URL: ${url}`);
        continue;
      }

      if (outputPath && fs.existsSync(outputPath)) {
        downloadedFiles.push(outputPath);
      }
    } catch (itemErr) {
      console.error(`[Batch] Error downloading item ${itemNum}: ${itemErr.message}`);
      // Continue with remaining items — don't fail the whole batch
    }
  }

  if (downloadedFiles.length === 0) {
    throw new Error('No files were successfully downloaded');
  }

  // Package into ZIP
  downloadManager.updateProgress(downloadId, {
    status: 'packaging',
    progress: 90,
    stage: 'packaging',
    message: `Packaging ${downloadedFiles.length} files into ZIP...`,
  });

  const zipFileName = `media-toolkit-batch-${Date.now()}.zip`;
  const zipPath = path.join(DOWNLOAD_DIR, zipFileName);

  await createZipArchive(downloadedFiles, zipPath);

  // Clean up individual files
  for (const filePath of downloadedFiles) {
    await cleanupFile(filePath);
  }

  downloadManager.updateProgress(downloadId, {
    status: 'complete',
    progress: 100,
    stage: 'complete',
    message: `Batch download complete! ${downloadedFiles.length} files packaged.`,
    filePath: zipPath,
    fileName: zipFileName,
  });

  console.log(`[Batch] Completed: ${downloadId} -> ${zipPath}`);
}

/**
 * Apply post-processing steps (normalization, silence trimming) to a downloaded file.
 *
 * @param {string} filePath - Path to the downloaded file
 * @param {Object} options - Processing options
 * @param {boolean} [options.normalize] - Whether to normalize audio
 * @param {string} [options.normalizationStandard] - 'ebu_r128' or 'replaygain'
 * @param {boolean} [options.trimSilence] - Whether to trim silence
 * @param {Function|null} progressCallback - Optional progress callback
 * @returns {Promise<string>} Path to the processed file
 */
async function applyPostProcessing(filePath, options, progressCallback) {
  let currentPath = filePath;

  // Normalize audio if requested
  if (options.normalize) {
    if (progressCallback) {
      progressCallback({
        percent: 75,
        speed: '',
        eta: '',
        stage: 'converting',
        message: 'Normalizing audio...',
      });
    }

    const normalizedPath = currentPath.replace(
      path.extname(currentPath),
      `_norm${path.extname(currentPath)}`
    );

    await ffmpegService.normalizeAudio(
      currentPath,
      normalizedPath,
      options.normalizationStandard || 'ebu_r128'
    );

    await fs.promises.unlink(currentPath);
    await fs.promises.rename(normalizedPath, currentPath);
  }

  // Trim silence if requested
  if (options.trimSilence) {
    if (progressCallback) {
      progressCallback({
        percent: 85,
        speed: '',
        eta: '',
        stage: 'converting',
        message: 'Trimming silence...',
      });
    }

    const trimmedPath = currentPath.replace(
      path.extname(currentPath),
      `_trim${path.extname(currentPath)}`
    );

    await ffmpegService.trimSilence(currentPath, trimmedPath);

    await fs.promises.unlink(currentPath);
    await fs.promises.rename(trimmedPath, currentPath);
  }

  return currentPath;
}

/**
 * Create a ZIP archive from an array of file paths.
 *
 * @param {string[]} filePaths - Array of absolute paths to include
 * @param {string} outputPath - Absolute path for the output ZIP file
 * @returns {Promise<void>} Resolves when the ZIP is written
 */
function createZipArchive(filePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => {
      console.log(`[ZIP] Archive created: ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(new Error(`ZIP archive creation failed: ${err.message}`));
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('[ZIP] Warning:', err.message);
      } else {
        reject(err);
      }
    });

    archive.pipe(output);

    // Add each file to the archive
    for (const filePath of filePaths) {
      const name = path.basename(filePath);
      archive.file(filePath, { name });
    }

    archive.finalize();
  });
}

module.exports = router;
