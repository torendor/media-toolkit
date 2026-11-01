/**
 * UrlInput.jsx
 * Smart URL & Search input with auto-platform detection (YouTube, Spotify, Instagram, TikTok, Twitter/X),
 * direct song/video search mode, paste detection, and loading state.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Search,
  Loader2,
  Youtube,
  Music2,
  Clipboard,
  X,
  Sparkles,
  Compass,
} from 'lucide-react';
import { detectPlatform } from '../utils/formatDetector';
import { InstagramIcon, TikTokIcon, TwitterIcon } from './ui/Brand';

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
  tiktok: {
    label: 'TikTok',
    icon: TikTokIcon,
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
  },
  instagram: {
    label: 'Instagram',
    icon: InstagramIcon,
    bg: 'bg-pink-500/15',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    glow: 'shadow-[0_0_15px_rgba(236,72,153,0.2)]',
  },
  twitter: {
    label: 'Twitter / X',
    icon: TwitterIcon,
    bg: 'bg-zinc-500/15',
    border: 'border-zinc-500/30',
    text: 'text-zinc-300',
    glow: 'shadow-[0_0_15px_rgba(255,255,255,0.1)]',
  },
};

/**
 * Smart URL and Search input component.
 */
export default function UrlInput({
  value = '',
  onAnalyze,
  onSearch,
  isLoading,
  platform,
  onPlatformChange,
  platformMode = 'all',
}) {
  const [url, setUrl] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [inputMode, setInputMode] = useState('auto'); // 'auto', 'search'
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

  const isUrlLike = (text) => {
    const t = text.trim();
    return (
      /^https?:\/\//i.test(t) ||
      /^www\./i.test(t) ||
      t.includes('.com') ||
      t.includes('.be') ||
      detectPlatform(t) !== null
    );
  };

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
      if (!trimmed || isLoading) return;

      if (isUrlLike(trimmed)) {
        onAnalyze?.(trimmed);
      } else {
        // Plain text query: trigger search
        onSearch?.(trimmed);
      }
    },
    [url, isLoading, onAnalyze, onSearch]
  );

  const badgeConfig = platform ? PLATFORM_BADGES[platform] : null;

  // Placeholder customized per active platform mode
  const getPlaceholder = () => {
    switch (platformMode) {
      case 'instagram':
        return 'Instagram Reels veya Gönderi bağlantısını yapıştırın...';
      case 'tiktok':
        return 'TikTok video bağlantısını yapıştırın (filigransız indirilir)...';
      case 'twitter':
        return 'Twitter / X video bağlantısını yapıştırın...';
      case 'spotify':
        return 'Spotify parça veya çalma listesi bağlantısı ya da şarkı adı yazın...';
      case 'youtube':
        return 'YouTube video veya Shorts bağlantısı ya da şarkı adı yazın...';
      default:
        return 'Bağlantı yapıştırın veya doğrudan şarkı / sanatçı adı aratın...';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Main input container */}
      <form onSubmit={handleSubmit} className="relative group">
        <div
          className={`
            relative flex items-center rounded-2xl overflow-hidden transition-all duration-300
            bg-ink-900/90 backdrop-blur-md border
            ${
              isFocused
                ? 'border-brand-500/50 shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)] ring-1 ring-brand-500/30'
                : 'border-white/[0.08] hover:border-white/[0.14]'
            }
          `}
        >
          {/* Leading Icon */}
          <div className="pl-4 pr-1 flex items-center text-zinc-400">
            {url && !isUrlLike(url) ? (
              <Search className="w-5 h-5 text-brand-400" />
            ) : (
              <Link2 className="w-5 h-5 text-zinc-400" />
            )}
          </div>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={getPlaceholder()}
            disabled={isLoading}
            className="flex-1 bg-transparent py-4 px-3 text-white placeholder-zinc-500 outline-none text-sm sm:text-base font-normal disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
            spellCheck="false"
          />

          {/* Clear button if text is entered */}
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                onPlatformChange?.(null);
                inputRef.current?.focus();
              }}
              className="p-1.5 mr-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
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
                  hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 mr-2 rounded-lg border text-xs font-semibold
                  ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text} ${badgeConfig.glow}
                `}
              >
                <badgeConfig.icon className="w-3.5 h-3.5" />
                <span>{badgeConfig.label}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button: Analiz Et or Ara */}
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className={`
              flex items-center gap-2 px-5 sm:px-6 py-4 font-medium text-xs sm:text-sm
              border-l border-white/[0.08]
              transition-all duration-200
              disabled:opacity-30 disabled:cursor-not-allowed
              ${
                url && !isUrlLike(url)
                  ? 'bg-brand-500/20 text-brand-300 hover:bg-brand-500 hover:text-white'
                  : 'bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white'
              }
            `}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
            ) : url && !isUrlLike(url) ? (
              <Search className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4 text-brand-400" />
            )}
            <span>
              {isLoading
                ? 'İşleniyor…'
                : url && !isUrlLike(url)
                ? 'Ara'
                : 'Analiz Et'}
            </span>
          </button>
        </div>
      </form>

      {/* Quick helper tip */}
      <div className="flex items-center justify-between text-xs text-zinc-500 mt-2.5 px-2">
        <span className="flex items-center gap-1.5">
          <Clipboard className="w-3.5 h-3.5 text-zinc-400" />
          <span>Bağlantı yapıştırabilir veya direkt şarkı aratabilirsiniz</span>
        </span>
        <span className="hidden sm:inline font-mono text-[11px] text-zinc-600">
          Enter ↵
        </span>
      </div>
    </motion.div>
  );
}
