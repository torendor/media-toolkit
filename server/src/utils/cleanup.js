/**
 * @fileoverview Cleanup utilities for managing temporary download files.
 * Handles single-file deletion, age-based directory cleanup, and
 * full download session cleanup.
 * @module utils/cleanup
 */

const fs = require('fs');
const path = require('path');

/**
 * Delete a single file from disk. Silently ignores files that don't exist.
 * Logs errors for any other filesystem failures.
 *
 * @param {string} filePath - Absolute path to the file to delete
 * @returns {Promise<boolean>} True if the file was deleted or didn't exist, false on error
 */
async function cleanupFile(filePath) {
  if (!filePath) return true;

  try {
    await fs.promises.unlink(filePath);
    console.log(`[Cleanup] Deleted file: ${filePath}`);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File already doesn't exist — that's fine
      return true;
    }
    console.error(`[Cleanup] Failed to delete file ${filePath}:`, err.message);
    return false;
  }
}

/**
 * Scan a directory and delete all files older than the specified age.
 * Does not recurse into subdirectories. Useful for periodic temp cleanup.
 *
 * @param {string} directory - Absolute path to the directory to scan
 * @param {number} [maxAgeMinutes=60] - Maximum age in minutes; files older than this are deleted
 * @returns {Promise<{ deleted: number, errors: number }>} Count of deleted files and errors
 */
async function cleanupOldFiles(directory, maxAgeMinutes = 60) {
  const result = { deleted: 0, errors: 0 };

  try {
    // Ensure the directory exists before scanning
    await fs.promises.access(directory, fs.constants.R_OK);
  } catch {
    // Directory doesn't exist or isn't readable — nothing to clean
    return result;
  }

  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    for (const entry of entries) {
      // Only process files, skip directories
      if (!entry.isFile()) continue;

      const filePath = path.join(directory, entry.name);

      try {
        const stat = await fs.promises.stat(filePath);
        const ageMs = now - stat.mtimeMs;

        if (ageMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          result.deleted++;
          console.log(`[Cleanup] Deleted old file (${Math.round(ageMs / 60000)}min old): ${entry.name}`);
        }
      } catch (fileErr) {
        if (fileErr.code !== 'ENOENT') {
          result.errors++;
          console.error(`[Cleanup] Error processing ${entry.name}:`, fileErr.message);
        }
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Error reading directory ${directory}:`, err.message);
  }

  if (result.deleted > 0) {
    console.log(`[Cleanup] Removed ${result.deleted} old files from ${directory}`);
  }

  return result;
}

/**
 * Clean up all files and state associated with a specific download session.
 * Removes the output file from disk and clears the entry from the download manager.
 *
 * @param {string} downloadId - The unique download session ID
 * @param {import('../services/downloadManager')} manager - The DownloadManager instance
 * @returns {Promise<void>}
 */
async function cleanupDownload(downloadId, manager) {
  if (!downloadId || !manager) return;

  try {
    const filePath = manager.getFilePath(downloadId);

    if (filePath) {
      await cleanupFile(filePath);
    }

    manager.cleanup(downloadId);
    console.log(`[Cleanup] Cleaned up download session: ${downloadId}`);
  } catch (err) {
    console.error(`[Cleanup] Error cleaning download ${downloadId}:`, err.message);
  }
}

module.exports = {
  cleanupFile,
  cleanupOldFiles,
  cleanupDownload,
};
