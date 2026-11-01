/**
 * @fileoverview YouTube service for extracting video metadata and downloading
 * media via the yt-dlp CLI tool. Parses yt-dlp's JSON output for metadata
 * and stdout progress lines for real-time download tracking.
 * @module services/youtubeService
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getYtdlpPath, getFfmpegPath, LOCAL_BIN } = require('../utils/binaries');

/**
 * Path to the downloads directory.
 * @type {string}
 */
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

/**
 * Extract video metadata from a YouTube URL using yt-dlp --dump-json.
 * Returns structured metadata including title, thumbnail, duration, channel,
 * available formats, and whether the URL is a playlist.
 *
 * @param {string} url - The YouTube URL to analyze
 * @returns {Promise<Object>} Structured video metadata
 * @throws {Error} If yt-dlp fails or returns invalid JSON
 */
async function getInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      url,
    ];

    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim()}`));
      }

      try {
        const info = JSON.parse(stdout.trim());
        resolve(formatVideoInfo(info));
      } catch (parseErr) {
        reject(new Error(`Failed to parse yt-dlp output: ${parseErr.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is yt-dlp installed?`));
    });
  });
}

/**
 * Get metadata for all videos in a YouTube playlist.
 *
 * @param {string} url - The YouTube playlist URL
 * @returns {Promise<Object>} Playlist metadata with an array of video entries
 * @throws {Error} If yt-dlp fails
 */
async function getPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      url,
    ];

    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp playlist extraction failed: ${stderr.trim()}`));
      }

      try {
        // yt-dlp outputs one JSON object per line for each playlist entry
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
        reject(new Error(`Failed to parse playlist data: ${parseErr.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Download a YouTube video or audio using yt-dlp with progress reporting.
 *
 * @param {string} url - The YouTube URL to download
 * @param {Object} options - Download options
 * @param {string} [options.format='audio'] - 'video' or 'audio'
 * @param {string} [options.quality='best'] - Quality level: 'best', '1080p', '720p', '480p', '360p'
 * @param {string} [options.audioFormat='mp3'] - Audio output format: 'mp3', 'flac', 'wav', 'm4a', 'opus'
 * @param {string} [options.audioBitrate='192'] - Audio bitrate in kbps
 * @param {string} [options.outputPath] - Custom output file path
 * @param {Function} [progressCallback] - Called with progress objects { percent, speed, eta, stage }
 * @returns {Promise<string>} The absolute path to the downloaded/converted file
 */
async function download(url, options = {}, progressCallback = null) {
  // Ensure download directory exists
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  const outputTemplate = options.outputPath ||
    path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');

  const args = buildFormatArgs(options);
  if (LOCAL_BIN && fs.existsSync(path.join(LOCAL_BIN, 'ffmpeg.exe'))) {
    args.push('--ffmpeg-location', LOCAL_BIN);
  } else {
    const ffmpegLocation = getFfmpegPath();
    if (ffmpegLocation) {
      args.push('--ffmpeg-location', path.dirname(ffmpegLocation));
    }
  }
  args.push('-o', outputTemplate);
  args.push('--no-warnings');
  args.push('--newline'); // Force progress on new lines for easier parsing
  args.push('--no-playlist'); // Single video only
  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn(getYtdlpPath(), args, { windowsHide: true });
    let stderr = '';
    let lastOutputPath = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();

      // Parse progress lines: [download]  45.2% of ~50.00MiB at 2.50MiB/s ETA 00:15
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

      // Capture [Merger] or [ExtractAudio] lines indicating post-processing
      if (text.includes('[ExtractAudio]') || text.includes('[Merger]')) {
        if (progressCallback) {
          progressCallback({
            percent: 100,
            speed: '',
            eta: '',
            stage: 'converting',
            message: 'Converting media...',
          });
        }
      }

      // Capture the final destination path
      const destMatch = text.match(/\[(?:Merger|ExtractAudio|download)\] Destination: (.+)/);
      if (destMatch) {
        lastOutputPath = destMatch[1].trim();
      }

      // Also check for "has already been downloaded" message
      const alreadyMatch = text.match(/\[download\] (.+) has already been downloaded/);
      if (alreadyMatch) {
        lastOutputPath = alreadyMatch[1].trim();
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp download failed (code ${code}): ${stderr.trim()}`));
      }

      // Resolve with the output path
      if (lastOutputPath && fs.existsSync(lastOutputPath)) {
        resolve(lastOutputPath);
      } else {
        // Try to find the file by scanning the output directory
        findDownloadedFile(DOWNLOAD_DIR)
          .then((foundPath) => {
            if (foundPath) {
              resolve(foundPath);
            } else {
              reject(new Error('Download completed but output file not found'));
            }
          })
          .catch(reject);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is yt-dlp installed and in PATH?`));
    });
  });
}

/**
 * Build the yt-dlp CLI arguments for format selection based on user options.
 *
 * @param {Object} options - The download options
 * @param {string} [options.format='audio'] - 'video' or 'audio'
 * @param {string} [options.quality='best'] - Video quality preference
 * @param {string} [options.audioFormat='mp3'] - Audio output format
 * @param {string} [options.audioBitrate='192'] - Audio bitrate in kbps
 * @returns {string[]} Array of CLI arguments for yt-dlp
 */
function buildFormatArgs(options = {}) {
  const args = [];
  const format = options.format || 'audio';

  if (format === 'audio') {
    // Audio-only download with post-processing conversion
    args.push('-x'); // Extract audio
    args.push('--audio-format', options.audioFormat || 'mp3');
    args.push('--audio-quality', mapBitrateToQuality(options.audioBitrate || '192'));

    // Embed thumbnail in audio if possible with auto-conversion to jpg
    if (['mp3', 'm4a', 'opus', 'flac'].includes(options.audioFormat || 'mp3')) {
      args.push('--embed-thumbnail');
      args.push('--convert-thumbnails', 'jpg');
    }
  } else {
    // Video download with format selection based on quality
    const qualityMap = {
      'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '2160p': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]',
      '1440p': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440]',
      '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]',
      '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]',
      '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]',
      '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]',
    };

    const formatStr = qualityMap[options.quality] || qualityMap['best'];
    args.push('-f', formatStr);
    args.push('--merge-output-format', 'mp4');
  }

  return args;
}

/**
 * Map a numeric bitrate value to yt-dlp's audio quality scale (0-10, 0 being best).
 *
 * @param {string|number} bitrate - Bitrate in kbps (e.g. '320', '192', '128')
 * @returns {string} yt-dlp quality value (0-10 scale)
 */
function mapBitrateToQuality(bitrate) {
  const br = parseInt(bitrate, 10);
  if (br >= 320) return '0';
  if (br >= 256) return '1';
  if (br >= 192) return '2';
  if (br >= 160) return '4';
  if (br >= 128) return '5';
  if (br >= 96) return '7';
  return '9';
}

/**
 * Format raw yt-dlp JSON output into a clean metadata object.
 *
 * @param {Object} raw - Raw yt-dlp --dump-json output
 * @returns {Object} Structured video metadata
 */
function formatVideoInfo(raw) {
  // Gather available format options
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

  // Extract unique resolutions available
  const resolutions = [...new Set(
    formats.filter((f) => f.resolution).map((f) => f.resolution)
  )].sort((a, b) => {
    return parseInt(b) - parseInt(a);
  });

  return {
    platform: 'youtube',
    type: 'video',
    id: raw.id,
    title: raw.title || 'Unknown Title',
    description: raw.description ? raw.description.substring(0, 500) : '',
    thumbnail: raw.thumbnail || (raw.thumbnails && raw.thumbnails.length > 0
      ? raw.thumbnails[raw.thumbnails.length - 1].url
      : null),
    duration: raw.duration || 0,
    durationFormatted: formatDuration(raw.duration || 0),
    channel: raw.channel || raw.uploader || 'Unknown',
    channelUrl: raw.channel_url || raw.uploader_url || '',
    uploadDate: raw.upload_date || '',
    viewCount: raw.view_count || 0,
    likeCount: raw.like_count || 0,
    isLive: raw.is_live || false,
    resolutions,
    formats,
    isPlaylist: false,
  };
}

/**
 * Format a duration in seconds to a human-readable "HH:MM:SS" or "MM:SS" string.
 *
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
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

/**
 * Find the most recently modified file in a directory.
 * Used as a fallback when yt-dlp's output path isn't captured.
 *
 * @param {string} dir - Directory to search
 * @returns {Promise<string|null>} Path to the newest file, or null
 */
async function findDownloadedFile(dir) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    let newest = null;
    let newestTime = 0;
    const mediaExtensions = ['.mp3', '.mp4', '.m4a', '.flac', '.wav', '.webm', '.mkv', '.ogg', '.opus'];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      // Ignore image and temp files
      if (!mediaExtensions.includes(ext)) continue;

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
  getInfo,
  getPlaylistInfo,
  download,
  buildFormatArgs,
};
