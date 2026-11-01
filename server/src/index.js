/**
 * @fileoverview Main entry point for the Universal Media & Audio Toolkit Express server.
 * Configures middleware, mounts API routes, initializes download directories,
 * and sets up periodic cleanup jobs.
 * @module server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const analyzeRouter = require('./routes/analyze');
const downloadRouter = require('./routes/download');
const settingsRouter = require('./routes/settings');
const searchRouter = require('./routes/search');
const { cleanupOldFiles } = require('./utils/cleanup');
const downloadManager = require('./services/downloadManager');
const { LOCAL_BIN } = require('./utils/binaries');

// Prepend LOCAL_BIN to system PATH so all subprocesses find ffmpeg, ffprobe, yt-dlp
if (LOCAL_BIN && fs.existsSync(LOCAL_BIN)) {
  process.env.PATH = `${LOCAL_BIN}${path.delimiter}${process.env.PATH}`;
}

const app = express();
// Requests arrive through the Cloudflare tunnel; trust its X-Forwarded-For so
// rate limiting is applied per real client instead of to everyone at once.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Security & Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
// Allow the local dev server, any Vercel deployment and extra origins from env
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
      EXTRA_ORIGINS.includes(origin)
    ) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// Serve downloaded files (with caching headers disabled)
app.use('/downloads', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
}, express.static(DOWNLOAD_DIR));

// Routes
app.use('/api/analyze', analyzeRouter);
app.use('/api/download', downloadRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/trending', require('./routes/trending'));
app.use('/api/search', searchRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeDownloads: downloadManager.getActiveCount(),
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.url}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Periodic temp file cleanup (every 30 minutes, files older than 60 mins)
const CLEANUP_INTERVAL = 30 * 60 * 1000;
const MAX_FILE_AGE_MINUTES = 60;

setInterval(() => {
  try {
    const removedCount = cleanupOldFiles(DOWNLOAD_DIR, MAX_FILE_AGE_MINUTES);
    if (removedCount > 0) {
      console.log(`[Auto Cleanup] Removed ${removedCount} expired file(s) from downloads directory`);
    }
  } catch (error) {
    console.error('[Auto Cleanup Error]', error.message);
  }
}, CLEANUP_INTERVAL);

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Universal Media Toolkit Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Downloads folder: ${DOWNLOAD_DIR}`);
  console.log(`===============================================`);
});

module.exports = app;

