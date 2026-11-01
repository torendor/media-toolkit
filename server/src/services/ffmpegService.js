/**
 * @fileoverview FFmpeg service for audio conversion, normalization,
 * silence trimming, thumbnail embedding, and ID3 tagging.
 * Uses fluent-ffmpeg for conversion operations and node-id3 for tag writing.
 * @module services/ffmpegService
 */

const ffmpeg = require('fluent-ffmpeg');
const NodeID3 = require('node-id3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getFfmpegPath, getFfprobePath } = require('../utils/binaries');

try {
  const fPath = getFfmpegPath();
  if (fPath) ffmpeg.setFfmpegPath(fPath);
  const fpPath = getFfprobePath();
  if (fpPath) ffmpeg.setFfprobePath(fpPath);
} catch (e) {
  console.warn('[FFmpeg] Could not set custom path:', e.message);
}

/**
 * Convert an audio file from one format to another with optional bitrate settings.
 *
 * @param {string} inputPath - Absolute path to the source audio file
 * @param {string} outputPath - Absolute path for the converted output
 * @param {Object} [options={}] - Conversion options
 * @param {string} [options.format='mp3'] - Target format: 'mp3', 'flac', 'wav', 'm4a', 'opus'
 * @param {string} [options.bitrate='192k'] - Target bitrate (e.g., '128k', '192k', '320k')
 * @param {number} [options.sampleRate] - Target sample rate in Hz (e.g., 44100, 48000)
 * @param {number} [options.channels] - Number of audio channels (1=mono, 2=stereo)
 * @returns {Promise<string>} The output file path on success
 */
function convertAudio(inputPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const format = options.format || 'mp3';
    let command = ffmpeg(inputPath);

    // Set the audio codec based on target format
    const codecMap = {
      mp3: 'libmp3lame',
      flac: 'flac',
      wav: 'pcm_s16le',
      m4a: 'aac',
      opus: 'libopus',
      ogg: 'libvorbis',
    };

    const codec = codecMap[format];
    if (codec) {
      command = command.audioCodec(codec);
    }

    // Apply bitrate (not applicable for lossless formats)
    if (options.bitrate && !['flac', 'wav'].includes(format)) {
      command = command.audioBitrate(options.bitrate);
    }

    // Apply sample rate if specified
    if (options.sampleRate) {
      command = command.audioFrequency(options.sampleRate);
    }

    // Apply channel count if specified
    if (options.channels) {
      command = command.audioChannels(options.channels);
    }

    command
      .output(outputPath)
      .on('start', (cmdLine) => {
        console.log(`[FFmpeg] Converting: ${cmdLine}`);
      })
      .on('end', () => {
        console.log(`[FFmpeg] Conversion complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Conversion error:`, err.message);
        reject(new Error(`FFmpeg conversion failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Apply audio bitrate settings to an FFmpeg command.
 * Utility for building up ffmpeg chains externally.
 *
 * @param {Object} options - Bitrate options
 * @param {string} [options.mode='cbr'] - 'cbr' for constant bitrate, 'vbr' for variable
 * @param {string} [options.bitrate='192k'] - Target bitrate for CBR
 * @param {number} [options.vbrQuality=4] - VBR quality level (0=best, 9=worst, for MP3)
 * @returns {Object} FFmpeg output options to apply
 */
function setAudioBitrate(options = {}) {
  const mode = options.mode || 'cbr';

  if (mode === 'vbr') {
    // VBR mode uses -q:a for MP3 (LAME) quality
    const quality = options.vbrQuality !== undefined ? options.vbrQuality : 4;
    return {
      outputOptions: ['-q:a', String(quality)],
    };
  }

  // CBR mode
  return {
    audioBitrate: options.bitrate || '192k',
  };
}

/**
 * Apply loudness normalization to an audio file.
 * Supports EBU R128 (broadcast standard) and ReplayGain (music playback standard).
 *
 * @param {string} inputPath - Absolute path to the source audio file
 * @param {string} outputPath - Absolute path for the normalized output
 * @param {'ebu_r128'|'replaygain'} [standard='ebu_r128'] - Normalization standard
 * @returns {Promise<string>} The output file path on success
 */
function normalizeAudio(inputPath, outputPath, standard = 'ebu_r128') {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    if (standard === 'ebu_r128') {
      // EBU R128 normalization: target integrated loudness = -23 LUFS
      // loudnorm filter measures then adjusts loudness in a single pass
      command = command.audioFilters([
        'loudnorm=I=-23:TP=-1:LRA=11:print_format=summary',
      ]);
    } else if (standard === 'replaygain') {
      // ReplayGain-style normalization: target -18 LUFS (typical for music)
      command = command.audioFilters([
        'loudnorm=I=-18:TP=-1:LRA=11:print_format=summary',
      ]);
    }

    command
      .output(outputPath)
      .on('start', (cmdLine) => {
        console.log(`[FFmpeg] Normalizing (${standard}): ${cmdLine}`);
      })
      .on('end', () => {
        console.log(`[FFmpeg] Normalization complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Normalization error:`, err.message);
        reject(new Error(`FFmpeg normalization failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Remove leading and trailing silence from an audio file.
 * Uses the silenceremove filter to detect and strip quiet sections.
 *
 * @param {string} inputPath - Absolute path to the source audio file
 * @param {string} outputPath - Absolute path for the trimmed output
 * @returns {Promise<string>} The output file path on success
 */
function trimSilence(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([
        // Remove leading silence: stop after first non-silence detected
        'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB',
        // Reverse, remove "leading" (which is actually trailing) silence, reverse back
        'areverse',
        'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB',
        'areverse',
      ])
      .output(outputPath)
      .on('start', (cmdLine) => {
        console.log(`[FFmpeg] Trimming silence: ${cmdLine}`);
      })
      .on('end', () => {
        console.log(`[FFmpeg] Silence trimming complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Silence trim error:`, err.message);
        reject(new Error(`FFmpeg silence trim failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Embed a thumbnail/album art image into an audio file using FFmpeg.
 * Works with MP3 (ID3v2 APIC), M4A (mp4 cover), and other container formats.
 *
 * @param {string} audioPath - Absolute path to the audio file
 * @param {string} imagePath - Absolute path to the image file (JPEG or PNG)
 * @returns {Promise<string>} The output file path (overwrites the original)
 */
function embedThumbnail(audioPath, imagePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(audioPath).toLowerCase();
    const tempOutput = audioPath.replace(ext, `_thumb${ext}`);

    let command = ffmpeg()
      .input(audioPath)
      .input(imagePath);

    if (ext === '.mp3') {
      // For MP3: map audio from first input, image from second, copy audio stream
      command = command
        .outputOptions([
          '-map', '0:a',
          '-map', '1:v',
          '-c:a', 'copy',
          '-c:v', 'mjpeg',
          '-id3v2_version', '3',
          '-metadata:s:v', 'title=Album cover',
          '-metadata:s:v', 'comment=Cover (front)',
        ]);
    } else if (ext === '.m4a' || ext === '.mp4') {
      command = command
        .outputOptions([
          '-map', '0:a',
          '-map', '1:v',
          '-c:a', 'copy',
          '-c:v', 'png',
          '-disposition:v:0', 'attached_pic',
        ]);
    } else {
      // For other formats, try generic approach
      command = command
        .outputOptions([
          '-map', '0:a',
          '-map', '1:v',
          '-c:a', 'copy',
          '-disposition:v:0', 'attached_pic',
        ]);
    }

    command
      .output(tempOutput)
      .on('start', (cmdLine) => {
        console.log(`[FFmpeg] Embedding thumbnail: ${cmdLine}`);
      })
      .on('end', async () => {
        try {
          // Replace original file with the new one
          await fs.promises.unlink(audioPath);
          await fs.promises.rename(tempOutput, audioPath);
          console.log(`[FFmpeg] Thumbnail embedded: ${audioPath}`);
          resolve(audioPath);
        } catch (err) {
          reject(new Error(`Failed to replace file after thumbnail embed: ${err.message}`));
        }
      })
      .on('error', async (err) => {
        // Clean up temp file on error
        try { await fs.promises.unlink(tempOutput); } catch { /* ignore */ }
        console.error(`[FFmpeg] Thumbnail embed error:`, err.message);
        reject(new Error(`FFmpeg thumbnail embed failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Apply ID3v2.4 tags to an audio file. Supports title, artist, album,
 * track number, year, genre, and embedded cover art from a URL.
 *
 * @param {string} filePath - Absolute path to the audio file (MP3 preferred)
 * @param {Object} metadata - Tag values to write
 * @param {string} [metadata.title] - Track title
 * @param {string} [metadata.artist] - Artist name
 * @param {string} [metadata.album] - Album name
 * @param {number|string} [metadata.trackNumber] - Track number
 * @param {number|string} [metadata.year] - Release year
 * @param {string} [metadata.genre] - Genre
 * @param {string} [metadata.coverUrl] - URL to album cover image
 * @returns {Promise<boolean>} True if tags were successfully written
 */
async function applyID3Tags(filePath, metadata = {}) {
  const ext = path.extname(filePath).toLowerCase();

  // node-id3 only works reliably with MP3 files
  if (ext !== '.mp3') {
    console.log(`[ID3] Skipping ID3 tags for non-MP3 file: ${ext}`);
    return false;
  }

  try {
    const tags = {};

    if (metadata.title) tags.title = metadata.title;
    if (metadata.artist) tags.artist = metadata.artist;
    if (metadata.album) tags.album = metadata.album;
    if (metadata.trackNumber) tags.trackNumber = String(metadata.trackNumber);
    if (metadata.year) tags.year = String(metadata.year);
    if (metadata.genre) tags.genre = metadata.genre;

    // Download and embed cover art if URL provided
    if (metadata.coverUrl) {
      try {
        const coverResponse = await axios.get(metadata.coverUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });

        const contentType = coverResponse.headers['content-type'] || 'image/jpeg';
        const mimeType = contentType.includes('png') ? 'image/png' : 'image/jpeg';

        tags.image = {
          mime: mimeType,
          type: { id: 3, name: 'front cover' },
          description: 'Album cover',
          imageBuffer: Buffer.from(coverResponse.data),
        };

        console.log(`[ID3] Downloaded cover art: ${metadata.coverUrl}`);
      } catch (coverErr) {
        console.warn(`[ID3] Failed to download cover art: ${coverErr.message}`);
        // Continue without cover art — not a fatal error
      }
    }

    // Write the tags
    const success = NodeID3.write(tags, filePath);

    if (success) {
      console.log(`[ID3] Tags applied to: ${filePath}`);
      return true;
    } else {
      console.warn(`[ID3] node-id3 returned false for: ${filePath}`);
      return false;
    }
  } catch (err) {
    console.error(`[ID3] Error applying tags:`, err.message);
    return false;
  }
}

module.exports = {
  convertAudio,
  setAudioBitrate,
  normalizeAudio,
  trimSilence,
  embedThumbnail,
  applyID3Tags,
};
