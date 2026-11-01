/**
 * UrlInput.jsx
 * Smart URL input with auto-platform detection (YouTube/Spotify badges),
 * paste detection, loading spinner, and keyboard shortcuts.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Search, Loader2, Youtube, Music2, Clipboard, X } from 'lucide-react';
import { detectPlatform } from '../utils/formatDetector';

// ============================================
// Platform badge configurations
// ============================================
const PLATFORM_BADGES = {
  youtube: {
    label: 'YouTube',
    icon: Youtube,
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
  },
  spotify: {
    label: 'Spotify',
    icon: Music2,
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    text: 'text-green-400',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.2)]',
  },
};

/**
 * Smart URL input component.
 * @param {object} props
 * @param {Function} props.onAnalyze - Called with (url) when user submits
 * @param {boolean} props.isLoading - Whether analysis is in progress
 * @param {string} props.platform - Currently detected platform
 * @param {Function} props.onPlatformChange - Called when platform detection changes
 */
export default function UrlInput({ value = '', onAnalyze, isLoading, platform, onPlatformChange }) {
  const [url, setUrl] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Keep local input in sync with external value if provided
  useEffect(() => {
    if (value !== undefined) {
      setUrl(value);
    }
  }, [value]);

  // Detect platform whenever URL changes
  useEffect(() => {
    const detected = detectPlatform(url);
    onPlatformChange?.(detected);
  }, [url, onPlatformChange]);

  /**
   * Handle paste events — auto-detect and auto-analyze reliably from clipboard data.
   */
  const handlePaste = useCallback(
    (e) => {
      const pastedText = e.clipboardData?.getData('text')?.trim() || '';
      if (pastedText) {
        setUrl(pastedText);
        const detected = detectPlatform(pastedText);
        if (detected) {
          onAnalyze?.(pastedText);
        }
      }
    },
    [onAnalyze]
  );

  /**
   * Handle form submission (Enter key or button click).
   */
  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (trimmed && !isLoading) {
        onAnalyze?.(trimmed);
      }
    },
    [url, isLoading, onAnalyze]
  );

  /**
   * Handle keyboard shortcuts.
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  const badgeConfig = platform ? PLATFORM_BADGES[platform] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Main input container */}
      <form onSubmit={handleSubmit} className="relative group">
        <div
          className={`
            relative flex items-center rounded-2xl overflow-hidden transition-all duration-300
            glass
            ${isFocused ? 'ring-2 ring-neon-cyan/30 neon-glow' : 'ring-1 ring-white/10'}
          `}
        >
          {/* Link icon prefix */}
          <div className="pl-5 pr-2 flex items-center">
            <Link2 className="w-5 h-5 text-white/30" />
          </div>

          {/* Text input */}
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="YouTube veya Spotify bağlantısını buraya yapıştırın..."
            disabled={isLoading}
            className={`
              flex-1 bg-transparent py-4 px-2 text-white placeholder-white/30
              outline-none text-base font-medium
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            autoComplete="off"
            spellCheck="false"
          />

          {/* Clear button if URL is entered */}
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                onPlatformChange?.(null);
                inputRef.current?.focus();
              }}
              className="p-1 mr-2 text-white/30 hover:text-white/70 transition-colors"
              title="Temizle"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Platform badge (animated) */}
          <AnimatePresence mode="wait">
            {badgeConfig && (
              <motion.div
                key={platform}
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg border text-xs font-semibold
                  ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text} ${badgeConfig.glow}
                `}
              >
                <badgeConfig.icon className="w-3.5 h-3.5" />
                {badgeConfig.label}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analyze button */}
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className={`
              flex items-center gap-2 px-6 py-4 font-semibold text-sm
              bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20
              hover:from-neon-cyan/30 hover:to-neon-purple/30
              border-l border-white/10
              transition-all duration-300
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:shadow-[0_0_30px_rgba(0,240,255,0.15)]
              active:scale-95
            `}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-neon-cyan" />
            )}
            <span className="text-white/90 hidden sm:inline">
              {isLoading ? 'Analiz Ediliyor...' : 'Analiz Et'}
            </span>
          </button>
        </div>
      </form>

      {/* Hint text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-white/40 text-xs mt-3 flex items-center justify-center gap-1.5"
      >
        <Clipboard className="w-3.5 h-3.5 text-neon-cyan" />
        Bağlantıyı yapıştırın veya yazıp Enter tuşuna basın
      </motion.p>
    </motion.div>
  );
}
