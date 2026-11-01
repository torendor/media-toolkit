/**
 * @fileoverview Resolves paths for external CLI tools (yt-dlp, ffmpeg, ffprobe)
 * Checking local project bin folder first, then system PATH and common Windows install paths.
 * @module utils/binaries
 */

const path = require('path');
const fs = require('fs');

const LOCAL_BIN = path.resolve(__dirname, '../../bin');

/**
 * Get executable path for yt-dlp
 * @returns {string}
 */
function getYtdlpPath() {
  const localExe = path.join(LOCAL_BIN, 'yt-dlp.exe');
  if (fs.existsSync(localExe)) {
    return localExe;
  }
  return 'yt-dlp';
}

/**
 * Get executable path for ffmpeg
 * @returns {string}
 */
function getFfmpegPath() {
  const localExe = path.join(LOCAL_BIN, 'ffmpeg.exe');
  if (fs.existsSync(localExe)) {
    return localExe;
  }
  // Check common winget / localappdata paths
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const wingetFfmpeg = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
    if (fs.existsSync(wingetFfmpeg)) {
      return wingetFfmpeg;
    }
  }
  return 'ffmpeg';
}

/**
 * Get executable path for ffprobe
 * @returns {string}
 */
function getFfprobePath() {
  const localExe = path.join(LOCAL_BIN, 'ffprobe.exe');
  if (fs.existsSync(localExe)) {
    return localExe;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const wingetFfprobe = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffprobe.exe');
    if (fs.existsSync(wingetFfprobe)) {
      return wingetFfprobe;
    }
  }
  return 'ffprobe';
}

module.exports = {
  getYtdlpPath,
  getFfmpegPath,
  getFfprobePath,
  LOCAL_BIN
};

