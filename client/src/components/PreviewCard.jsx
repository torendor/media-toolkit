/**
 * PreviewCard.jsx
 * Media info card with thumbnail, title, duration, artist/channel.
 * Supports skeleton loader state and Framer Motion slide-up entrance.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Eye, User, Music, ListMusic, Youtube, Music2 } from 'lucide-react';
import SmartImage from './SmartImage';
import { InstagramIcon, TikTokIcon, TwitterIcon } from './ui/Brand';

// ============================================
// Platform badge config (small version)
// ============================================
const PLATFORM_BADGE = {
  youtube: {
    label: 'YouTube',
    icon: Youtube,
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  spotify: {
    label: 'Spotify',
    icon: Music2,
    className: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  tiktok: {
    label: 'TikTok',
    icon: TikTokIcon,
    className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  },
  instagram: {
    label: 'Instagram',
    icon: InstagramIcon,
    className: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  },
  twitter: {
    label: 'Twitter / X',
    icon: TwitterIcon,
    className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  },
};

/**
 * Format seconds into human-readable duration (e.g., "3:42" or "1:02:15").
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format large numbers with commas or abbreviations.
 * @param {number} num
 * @returns {string}
 */
function formatViewCount(num) {
  if (!num) return null;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} Mn görüntülenme`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)} B görüntülenme`;
  return `${num} görüntülenme`;
}

/**
 * Skeleton loader version of the preview card.
 */
function SkeletonPreviewCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto glass rounded-2xl overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Thumbnail skeleton */}
        <div className="w-full sm:w-48 h-32 skeleton rounded-xl flex-shrink-0" />

        {/* Text skeleton */}
        <div className="flex-1 space-y-3 py-1">
          <div className="h-5 skeleton w-3/4 rounded" />
          <div className="h-4 skeleton w-1/2 rounded" />
          <div className="flex gap-3 mt-4">
            <div className="h-4 skeleton w-20 rounded" />
            <div className="h-4 skeleton w-20 rounded" />
          </div>
          <div className="h-6 skeleton w-24 rounded-lg mt-2" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * PreviewCard component.
 * @param {object} props
 * @param {object | null} props.mediaInfo - Media metadata from API
 * @param {string} props.platform - 'youtube' | 'spotify'
 * @param {boolean} props.isLoading - Show skeleton loader
 */
export default function PreviewCard({ mediaInfo, platform, isLoading }) {
  // Show skeleton while loading
  if (isLoading) {
    return <SkeletonPreviewCard />;
  }

  // Don't render if no media info
  if (!mediaInfo) return null;

  const badge = PLATFORM_BADGE[platform];
  const isPlaylist = mediaInfo.isPlaylist || mediaInfo.trackCount > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-300"
    >
      <div className="flex flex-col sm:flex-row gap-0 sm:gap-4 p-0 sm:p-4">
        {/* Thumbnail */}
        <div className="relative w-full sm:w-52 h-40 sm:h-32 flex-shrink-0 overflow-hidden sm:rounded-xl">
          <SmartImage
            src={mediaInfo.thumbnail || mediaInfo.coverUrl}
            alt={mediaInfo.title}
            seed={mediaInfo.id || mediaInfo.title}
            className="w-full h-full"
          />

          {/* Duration overlay on thumbnail */}
          {mediaInfo.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-mono text-white/90">
              {formatDuration(mediaInfo.duration)}
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="flex-1 p-4 sm:p-0 flex flex-col justify-between">
          {/* Title */}
          <div>
            <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2">
              {mediaInfo.title || 'Bilinmeyen Başlık'}
            </h3>

            {/* Channel / Artist */}
            <p className="text-white/50 text-sm mt-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {mediaInfo.artist || mediaInfo.channel || 'Bilinmeyen Sanatçı / Kanal'}
            </p>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Duration */}
            {mediaInfo.duration && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(mediaInfo.duration)}
              </span>
            )}

            {/* View count (YouTube) */}
            {mediaInfo.viewCount && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Eye className="w-3.5 h-3.5" />
                {formatViewCount(mediaInfo.viewCount)}
              </span>
            )}

            {/* Track count (playlists/albums) */}
            {isPlaylist && mediaInfo.trackCount && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <ListMusic className="w-3.5 h-3.5" />
                {mediaInfo.trackCount} parça
              </span>
            )}

            {/* Total duration for playlists */}
            {isPlaylist && mediaInfo.totalDuration && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(mediaInfo.totalDuration)} toplam
              </span>
            )}

            {/* Platform badge */}
            {badge && (
              <span
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium
                  ${badge.className}
                `}
              >
                <badge.icon className="w-3 h-3" />
                {badge.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
