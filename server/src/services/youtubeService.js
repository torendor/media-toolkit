/**
 * @fileoverview YouTube service for extracting video metadata and streaming/downloading
 * media via external APIs (Cobalt, Invidious, Piped) with mobile client spoofing
 * (android, ios, web) for local yt-dlp fallback.
 * @module services/youtubeService
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cobaltService = require('./cobaltService');
const { getYtdlpPath, getFfmpegPath, LOCAL_BIN } = require('../utils/binaries');

/**
 * Path to the downloads directory.
 * @type {string}
 */
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

/**
 * Android/iOS client spoofing arguments for yt-dlp.
 * Bypasses YouTube's desktop bot verification and datacenter rate limits.
 */
const MOBILE_CLIENT_ARGS = [
  '--extractor-args',
  'youtube:player_client=android,ios,web',
];

/**
 * Locate a valid cookies.txt file if present.
 * @returns {string|null}
 */
function findCookiesFile() {
  const possiblePaths = [
    process.env.COOKIES_PATH,
    process.env.YOUTUBE_COOKIES_FILE,
    path.resolve(__dirname, '../../../cookies.txt'),
    path.resolve(process.cwd(), 'cookies.txt'),
    path.resolve(__dirname, '../../cookies.txt'),
  ].filter(Boolean);

  for (const cookiePath of possiblePaths) {
    try {
      if (fs.existsSync(cookiePath) && fs.statSync(cookiePath).isFile()) {
        return cookiePath;
      }
    } catch {
      // Ignore
    }
  }

  const cookiesBase64 = process.env.YOUTUBE_COOKIES_BASE64;
  const cookiesRaw = process.env.YOUTUBE_COOKIES;

  if (cookiesBase64 || cookiesRaw) {
    const cookieFile = path.join(DOWNLOAD_DIR, '.yt_cookies.txt');
    try {
      if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
      }
      const content = cookiesBase64
        ? Buffer.from(cookiesBase64, 'base64').toString('utf8')
        : cookiesRaw;
      fs.writeFileSync(cookieFile, content, 'utf8');
      return cookieFile;
    } catch (err) {
      console.warn('[YouTube Auth] Could not write cookies file from env:', err.message);
    }
  }

  return null;
}

/**
 * Resolve cookie auth args if available.
 * @returns {string[]}
 */
function getAuthArgs() {
  const cookiePath = findCookiesFile();
  if (cookiePath) {
    return ['--cookies', cookiePath];
  }
  return [];
}

/**
 * Returns cookie configuration status.
 */
function getCookieStatus() {
  const cookiePath = findCookiesFile();
  return {
    configured: Boolean(cookiePath),
    path: cookiePath || null,
  };
}

/**
 * Fallback metadata extractor using YouTube's public oEmbed API.
 * Never blocked by YouTube bot-detection.
 */
async function getYouTubeOEmbedInfo(url) {
  const videoIdMatch = url.match(/(?:youtu\.be\/|watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await axios.get(oembedUrl, { timeout: 5000 });
    const data = res.data;

    return {
      platform: 'youtube',
      type: 'video',
      id: videoId || 'unknown',
      title: data.title || 'YouTube Video',
      description: '',
      thumbnail: data.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
      duration: 0,
      durationFormatted: '0:00',
      channel: data.author_name || 'YouTube Channel',
      channelUrl: data.author_url || '',
      uploadDate: '',
      viewCount: 0,
      likeCount: 0,
      isLive: false,
      resolutions: ['1080p', '720p', '480p', '360p'],
      formats: [],
      isPlaylist: false,
    };
  } catch (err) {
    if (videoId) {
      return {
        platform: 'youtube',
        type: 'video',
        id: videoId,
        title: 'YouTube Medyası',
        description: '',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        durationFormatted: '0:00',
        channel: 'YouTube',
        channelUrl: `https://www.youtube.com/watch?v=${videoId}`,
        resolutions: ['1080p', '720p', '480p'],
        formats: [],
        isPlaylist: false,
      };
    }
    throw err;
  }
}

/**
 * Extract video metadata with mobile client spoofing & oEmbed fallback.
 *
 * @param {string} url - Media URL
 * @param {string|null} [platformOverride=null]
 * @returns {Promise<Object>}
 */
async function getInfo(url, platformOverride = null) {
  try {
    return await new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        '--skip-download',
        ...MOBILE_CLIENT_ARGS,
        ...getAuthArgs(),
        url,
      ];

      const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(stderr.trim()));
        }
        try {
          const info = JSON.parse(stdout.trim());
          resolve(formatVideoInfo(info, platformOverride));
        } catch (parseErr) {
          reject(parseErr);
        }
      });

      proc.on('error', reject);
    });
  } catch (err) {
    if (!platformOverride || platformOverride === 'youtube') {
      try {
        console.log('[youtubeService] Mobile yt-dlp metadata failed, falling back to YouTube oEmbed...');
        return await getYouTubeOEmbedInfo(url);
      } catch (oembedErr) {
        console.warn('[youtubeService] oEmbed fallback also failed:', oembedErr.message);
      }
    }
    throw new Error(`Video bilgisi alınamadı: ${err.message}`);
  }
}

/**
 * Extract playlist metadata.
 */
async function getPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      ...MOBILE_CLIENT_ARGS,
      ...getAuthArgs(),
      url,
    ];

    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Çalma listesi alınamadı: ${stderr.trim()}`));
      }

      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        const entries = lines.map((line) => {
          const info = JSON.parse(line);
          return {
            id: info.id,
            title: info.title || 'Unknown Title',
            url: info.url || info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`,
            duration: info.duration || 0,
            thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null,
            channel: info.channel || info.uploader || 'Unknown',
          };
        });

        resolve({
          platform: 'youtube',
          type: 'playlist',
          title: entries[0]?.title ? `Playlist (${entries.length} videos)` : 'Unknown Playlist',
          count: entries.length,
          entries,
        });
      } catch (parseErr) {
        reject(new Error(`Çalma listesi ayrıştırılamadı: ${parseErr.message}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Resolve direct CDN media stream URL.
 * Step 1: External APIs (Cobalt -> Invidious -> Piped)
 * Step 2: Mobile client spoofed yt-dlp (youtube:player_client=android,ios,web)
 *
 * @param {string} url - Media URL
 * @param {Object} [options={}] - Options
 * @returns {Promise<{ streamUrl: string, fileName: string, title: string, ext: string, source: string }>}
 */
async function getStreamUrl(url, options = {}) {
  // 1. Try external APIs (Cobalt, Invidious, Piped)
  try {
    const extResult = await cobaltService.fetchMediaStream(url, options);
    const fileName = extResult.fileName || `media-${Date.now()}.${options.format === 'audio' ? 'mp3' : 'mp4'}`;
    const title = fileName.replace(/\.[^/.]+$/, '');
    const ext = path.extname(fileName).replace('.', '') || (options.format === 'audio' ? 'mp3' : 'mp4');

    return {
      success: true,
      streamUrl: extResult.url,
      fileName,
      title,
      ext,
      source: extResult.source || 'external_api',
    };
  } catch (extErr) {
    console.warn('[youtubeService] External APIs failed, activating mobile client yt-dlp fallback:', extErr.message);
  }

  // 2. Direct Mobile Client Spoofed yt-dlp fallback (player_client=android,ios,web)
  return await getMobileClientStream(url, options);
}

/**
 * Extract stream URL using mobile client spoofed yt-dlp.
 * Uses 'youtube:player_client=android,ios,web' to bypass desktop bot protection.
 */
async function getMobileClientStream(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isAudio = options.format === 'audio';
    let formatArg;

    if (isAudio) {
      formatArg = 'bestaudio[ext=m4a]/bestaudio/best';
    } else {
      const quality = options.quality || 'best';
      const height = parseInt(quality, 10);
      if (!isNaN(height) && height > 0) {
        formatArg = `best[height<=${height}][ext=mp4]/best[height<=${height}]/best[ext=mp4]/best`;
      } else {
        formatArg = 'best[ext=mp4]/best';
      }
    }

    const args = [
      '-g',
      '--no-warnings',
      '--no-playlist',
      '-f', formatArg,
      '--print', '%(title)s',
      '--print', '%(ext)s',
      ...MOBILE_CLIENT_ARGS,
      ...getAuthArgs(),
      url,
    ];

    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Mobil yt-dlp akış bağlantısı alamadı: ${stderr.trim()}`));
      }

      const lines = stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return reject(new Error('Akış çıktısı okunamadı'));
      }

      const title = lines[0] || 'media';
      const ext = lines[1] || (isAudio ? 'm4a' : 'mp4');
      const urls = lines.slice(2).filter((l) => l.startsWith('http://') || l.startsWith('https://'));

      if (urls.length === 0) {
        return reject(new Error('Geçerli bir doğrudan CDN akış bağlantısı bulunamadı'));
      }

      const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_');
      const fileName = `${safeTitle}.${ext}`;

      resolve({
        success: true,
        streamUrl: urls[0],
        fileName,
        title,
        ext,
        source: 'yt-dlp-mobile',
      });
    });

    proc.on('error', (err) => reject(new Error(`yt-dlp çalıştırılamadı: ${err.message}`)));
  });
}

/**
 * Fallback file download method.
 * Uses mobile client spoofing.
 */
async function download(url, options = {}, progressCallback = null) {
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  // 1. Try to fetch direct stream URL and download via stream
  try {
    progressCallback?.({ percent: 15, speed: '', eta: '', stage: 'downloading', message: 'Bağlantı çözümleniyor...' });
    const streamInfo = await getStreamUrl(url, options);

    if (streamInfo?.streamUrl) {
      const targetFileName = `${Date.now()}_${streamInfo.fileName || 'media.mp4'}`;
      const targetPath = path.join(DOWNLOAD_DIR, targetFileName);

      progressCallback?.({ percent: 30, speed: '', eta: '', stage: 'downloading', message: 'Medya indiriliyor...' });

      const writer = fs.createWriteStream(targetPath);
      const res = await axios({
        method: 'get',
        url: streamInfo.streamUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
      });

      const totalLength = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;

      res.data.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalLength > 0 && progressCallback) {
          const percent = Math.min(95, Math.round((downloaded / totalLength) * 90) + 5);
          progressCallback({
            percent,
            speed: '',
            eta: '',
            stage: 'downloading',
            message: `İndiriliyor: %${percent}`,
          });
        }
      });

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        res.data.pipe(writer);
      });

      progressCallback?.({ percent: 100, speed: '', eta: '', stage: 'complete', message: 'İndirme tamamlandı!' });
      return targetPath;
    }
  } catch (err) {
    console.warn('[youtubeService] Stream download failed, attempting yt-dlp mobile direct:', err.message);
  }

  // 2. yt-dlp with mobile client spoofing
  return await legacyYtdlpDownload(url, options, progressCallback);
}

/**
 * Mobile-spoofed yt-dlp download.
 */
async function legacyYtdlpDownload(url, options = {}, progressCallback = null) {
  const outputTemplate = options.outputPath || path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');
  const args = buildFormatArgs(options);
  args.push(...MOBILE_CLIENT_ARGS);
  args.push(...getAuthArgs());
  args.push('--no-warnings', '--newline', '--no-playlist');

  if (LOCAL_BIN && fs.existsSync(path.join(LOCAL_BIN, 'ffmpeg.exe'))) {
    args.push('--ffmpeg-location', LOCAL_BIN);
  } else {
    const ffmpegLocation = getFfmpegPath();
    if (ffmpegLocation) {
      args.push('--ffmpeg-location', path.dirname(ffmpegLocation));
    }
  }

  args.push('-o', outputTemplate, url);

  return new Promise((resolve, reject) => {
    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stderr = '';
    let lastOutputPath = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const progressMatch = text.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\s*\w+)\s+at\s+([\d.]+\s*\w+\/s)\s+ETA\s+(\S+)/
      );
      if (progressMatch && progressCallback) {
        progressCallback({
          percent: parseFloat(progressMatch[1]),
          speed: progressMatch[3],
          eta: progressMatch[4],
          stage: 'downloading',
          message: `Downloading: ${progressMatch[1]}%`,
        });
      }

      const destMatch = text.match(/\[(?:Merger|ExtractAudio|download)\] Destination: (.+)/);
      if (destMatch) {
        lastOutputPath = destMatch[1].trim();
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp indirme hatası: ${stderr.trim()}`));
      }
      if (lastOutputPath && fs.existsSync(lastOutputPath)) {
        resolve(lastOutputPath);
      } else {
        findDownloadedFile(DOWNLOAD_DIR).then(resolve).catch(reject);
      }
    });

    proc.on('error', reject);
  });
}

function buildFormatArgs(options = {}) {
  const args = [];
  const format = options.format || 'audio';

  if (format === 'audio') {
    args.push('-x');
    args.push('--audio-format', options.audioFormat || 'mp3');
    args.push('--audio-quality', '0');
  } else {
    args.push('-f', 'best[ext=mp4]/best');
    args.push('--merge-output-format', 'mp4');
  }

  return args;
}

function formatVideoInfo(raw, platformOverride = null) {
  const formats = (raw.formats || [])
    .filter((f) => f.height || f.abr)
    .map((f) => ({
      formatId: f.format_id,
      ext: f.ext,
      resolution: f.height ? `${f.height}p` : null,
      fps: f.fps || null,
      vcodec: f.vcodec !== 'none' ? f.vcodec : null,
      acodec: f.acodec !== 'none' ? f.acodec : null,
      abr: f.abr || null,
      filesize: f.filesize || f.filesize_approx || null,
    }));

  const resolutions = [...new Set(
    formats.filter((f) => f.resolution).map((f) => f.resolution)
  )].sort((a, b) => parseInt(b) - parseInt(a));

  return {
    platform: platformOverride || 'youtube',
    type: 'video',
    id: raw.id,
    title: raw.title || 'Unknown Title',
    description: raw.description ? raw.description.substring(0, 500) : '',
    thumbnail: raw.thumbnail || (raw.thumbnails?.length ? raw.thumbnails[raw.thumbnails.length - 1].url : null),
    duration: raw.duration || 0,
    durationFormatted: formatDuration(raw.duration || 0),
    channel: raw.channel || raw.uploader || 'Unknown',
    channelUrl: raw.channel_url || raw.uploader_url || '',
    uploadDate: raw.upload_date || '',
    viewCount: raw.view_count || 0,
    likeCount: raw.like_count || 0,
    isLive: raw.is_live || false,
    resolutions: resolutions.length ? resolutions : ['1080p', '720p', '480p'],
    formats,
    isPlaylist: false,
  };
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function findDownloadedFile(dir) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    let newest = null;
    let newestTime = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(dir, entry.name);
      const stat = await fs.promises.stat(filePath);
      if (stat.mtimeMs > newestTime) {
        newestTime = stat.mtimeMs;
        newest = filePath;
      }
    }
    return newest;
  } catch {
    return null;
  }
}

module.exports = {
  findCookiesFile,
  getAuthArgs,
  getCookieStatus,
  getInfo,
  getPlaylistInfo,
  getStreamUrl,
  download,
  buildFormatArgs,
  MOBILE_CLIENT_ARGS,
};
