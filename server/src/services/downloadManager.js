/**
 * @fileoverview Download Manager service that tracks the state and progress
 * of all active and recently completed downloads using an in-memory Map.
 * @module services/downloadManager
 */

/**
 * @typedef {Object} DownloadEntry
 * @property {string} id - Unique download identifier
 * @property {'pending'|'downloading'|'converting'|'tagging'|'packaging'|'complete'|'error'} status
 * @property {number} progress - Download/processing progress 0-100
 * @property {string} speed - Current download speed (e.g. "2.5 MiB/s")
 * @property {string} eta - Estimated time remaining (e.g. "00:30")
 * @property {string} stage - Current processing stage description
 * @property {string} message - Human-readable status message
 * @property {string|null} filePath - Absolute path to the completed output file
 * @property {string|null} fileName - Original filename for Content-Disposition
 * @property {string|null} error - Error message if status is 'error'
 * @property {Date} createdAt - When the download was initiated
 * @property {Date} updatedAt - When the entry was last updated
 * @property {Function[]} listeners - SSE response listeners for progress events
 */

class DownloadManager {
  constructor() {
    /**
     * In-memory store of all active/recent download sessions.
     * @type {Map<string, DownloadEntry>}
     */
    this.downloads = new Map();

    /**
     * Maximum number of concurrent downloads allowed.
     * @type {number}
     */
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 3;
  }

  /**
   * Create a new download entry with default values.
   * @param {string} id - Unique download ID (uuid)
   * @returns {DownloadEntry} The newly created download entry
   */
  createDownload(id) {
    const entry = {
      id,
      status: 'pending',
      progress: 0,
      speed: '',
      eta: '',
      stage: 'pending',
      message: 'Initializing download...',
      filePath: null,
      fileName: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      listeners: [],
    };

    this.downloads.set(id, entry);
    console.log(`[DownloadManager] Created download: ${id}`);
    return entry;
  }

  /**
   * Update the progress/state of an existing download and notify all SSE listeners.
   * @param {string} id - The download ID to update
   * @param {Partial<DownloadEntry>} data - Fields to update on the download entry
   */
  updateProgress(id, data) {
    const entry = this.downloads.get(id);
    if (!entry) {
      console.warn(`[DownloadManager] Cannot update unknown download: ${id}`);
      return;
    }

    // Merge the update data into the entry
    Object.assign(entry, data, { updatedAt: new Date() });

    // Build the SSE event payload (exclude internal fields)
    const event = {
      id: entry.id,
      status: entry.status,
      progress: entry.progress,
      speed: entry.speed,
      eta: entry.eta,
      stage: entry.stage,
      message: entry.message,
      fileName: entry.fileName,
      error: entry.error,
    };

    // Notify all SSE listeners
    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[DownloadManager] Error notifying listener for ${id}:`, err.message);
      }
    }
  }

  /**
   * Get the current progress/state snapshot for a download.
   * @param {string} id - The download ID
   * @returns {DownloadEntry|null} The download entry, or null if not found
   */
  getProgress(id) {
    return this.downloads.get(id) || null;
  }

  /**
   * Get the output file path for a completed download.
   * @param {string} id - The download ID
   * @returns {string|null} The file path, or null if not found/incomplete
   */
  getFilePath(id) {
    const entry = this.downloads.get(id);
    return entry ? entry.filePath : null;
  }

  /**
   * Register an SSE listener function for a download's progress events.
   * The listener will be called with the progress event object each time
   * updateProgress is invoked.
   * @param {string} id - The download ID
   * @param {Function} listener - Callback function receiving progress events
   */
  addListener(id, listener) {
    const entry = this.downloads.get(id);
    if (entry) {
      entry.listeners.push(listener);
    }
  }

  /**
   * Remove an SSE listener from a download.
   * @param {string} id - The download ID
   * @param {Function} listener - The listener to remove
   */
  removeListener(id, listener) {
    const entry = this.downloads.get(id);
    if (entry) {
      entry.listeners = entry.listeners.filter((l) => l !== listener);
    }
  }

  /**
   * Remove a download entry from the manager, cleaning up listeners.
   * Does NOT delete files — use cleanup utilities for that.
   * @param {string} id - The download ID to remove
   */
  cleanup(id) {
    const entry = this.downloads.get(id);
    if (entry) {
      entry.listeners = [];
      this.downloads.delete(id);
      console.log(`[DownloadManager] Removed download entry: ${id}`);
    }
  }

  /**
   * Get the count of currently active (non-terminal) downloads.
   * @returns {number} Number of downloads in progress
   */
  getActiveCount() {
    let count = 0;
    for (const [, entry] of this.downloads) {
      if (!['complete', 'error'].includes(entry.status)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a new download can be started based on concurrency limits.
   * @returns {boolean} True if under the concurrent download limit
   */
  canStartDownload() {
    return this.getActiveCount() < this.maxConcurrent;
  }
}

// Export a singleton instance so all routes share the same state
module.exports = new DownloadManager();
