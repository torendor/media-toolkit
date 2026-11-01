/**
 * @fileoverview File naming utilities for generating download filenames
 * from metadata templates and sanitizing invalid characters.
 * @module utils/fileNaming
 */

const path = require('path');

/**
 * Characters that are invalid in Windows/macOS/Linux file names.
 * Includes control characters and OS-reserved characters.
 */
const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Reserved filenames on Windows (e.g., CON, PRN, NUL, COM1, LPT1, etc.)
 */
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

/**
 * Generate a filename from a template string by replacing token placeholders
 * with actual metadata values.
 *
 * Supported tokens:
 *  - {title}     - Track/video title
 *  - {artist}    - Artist or channel name
 *  - {album}     - Album name
 *  - {track_num} - Track number (zero-padded to 2 digits)
 *  - {year}      - Release year
 *  - {ext}       - File extension (without dot)
 *
 * @param {string} template - The naming template, e.g. "{artist} - {title}"
 * @param {Object} metadata - The metadata values to insert
 * @param {string} [metadata.title='Unknown Title'] - Track title
 * @param {string} [metadata.artist='Unknown Artist'] - Artist name
 * @param {string} [metadata.album=''] - Album name
 * @param {number|string} [metadata.trackNumber=''] - Track number
 * @param {number|string} [metadata.year=''] - Release year
 * @param {string} ext - File extension without dot, e.g. "mp3"
 * @returns {string} The generated filename with extension appended
 */
function generateFileName(template, metadata = {}, ext = 'mp3') {
  const tokens = {
    title: metadata.title || 'Unknown Title',
    artist: metadata.artist || 'Unknown Artist',
    album: metadata.album || '',
    track_num: metadata.trackNumber
      ? String(metadata.trackNumber).padStart(2, '0')
      : '',
    year: metadata.year ? String(metadata.year) : '',
    ext: ext.replace(/^\./, ''),
  };

  // Replace each {token} in the template with its value
  let fileName = template;
  for (const [token, value] of Object.entries(tokens)) {
    fileName = fileName.replace(new RegExp(`\\{${token}\\}`, 'g'), value);
  }

  // Clean up artifacts from empty tokens: dangling separators, double spaces
  fileName = fileName
    .replace(/\s*-\s*-\s*/g, ' - ')   // collapse double dashes from empty fields
    .replace(/^\s*-\s*/, '')            // remove leading dash
    .replace(/\s*-\s*$/, '')            // remove trailing dash
    .replace(/\s{2,}/g, ' ')           // collapse multiple spaces
    .trim();

  // Fallback if template produced an empty string
  if (!fileName) {
    fileName = tokens.title;
  }

  // Sanitize and append extension
  fileName = sanitizeFileName(fileName);
  return `${fileName}.${tokens.ext}`;
}

/**
 * Remove or replace characters that are invalid in filenames across
 * Windows, macOS, and Linux. Also handles reserved Windows filenames.
 *
 * @param {string} name - The raw filename (without extension)
 * @returns {string} A sanitized filename safe for all major operating systems
 */
function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'download';

  let sanitized = name
    // Replace invalid characters with underscores
    .replace(INVALID_CHARS_REGEX, '_')
    // Replace any remaining forward/backslashes
    .replace(/[/\\]/g, '_')
    // Remove leading/trailing dots and spaces (Windows restriction)
    .replace(/^[\s.]+/, '')
    .replace(/[\s.]+$/, '')
    // Collapse consecutive underscores
    .replace(/_{2,}/g, '_')
    .trim();

  // Handle Windows reserved names by prefixing with underscore
  if (RESERVED_NAMES.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // Truncate to a reasonable max length (255 is typical filesystem limit)
  // Leave room for extension (~10 chars)
  if (sanitized.length > 240) {
    sanitized = sanitized.substring(0, 240);
  }

  // Final fallback for empty strings
  return sanitized || 'download';
}

module.exports = {
  generateFileName,
  sanitizeFileName,
};
