/**
 * PlaylistView.jsx
 * Scrollable track list for playlists/albums with select-all,
 * individual selection, track count, total duration, and 1-click ZIP batch download button.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Square,
  ListMusic,
  Clock,
  Archive,
  Download,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import SmartImage from './SmartImage';

/**
 * Format seconds into readable duration.
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

const trackVariants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
};

/**
 * Individual track row component.
 */
function TrackRow({ track, index, isSelected, onToggle }) {
  return (
    <motion.div
      variants={trackVariants}
      onClick={() => onToggle(track.id)}
      className={clsx(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group border',
        isSelected
          ? 'bg-brand-500/10 border-brand-500/30 text-white'
          : 'bg-transparent border-transparent hover:bg-white/[0.04] text-zinc-300'
      )}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0">
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-brand-400" />
        ) : (
          <Square className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        )}
      </div>

      {/* Track number */}
      <span className="w-6 text-right text-xs font-mono text-zinc-500 flex-shrink-0">
        {index + 1}
      </span>

      {/* Mini thumbnail */}
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-ink-950 border border-white/[0.06]">
        <SmartImage
          src={track.thumbnail || track.coverUrl}
          alt={track.title}
          seed={track.id}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-zinc-100 group-hover:text-white">
          {track.title || 'Bilinmeyen Parça'}
        </p>
        <p className="text-xs text-zinc-400 truncate">
          {track.artist || 'Bilinmeyen Sanatçı'}
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs font-mono text-zinc-500 flex-shrink-0">
        {formatDuration(track.duration)}
      </span>
    </motion.div>
  );
}

/**
 * PlaylistView component.
 */
export default function PlaylistView({
  tracks = [],
  selectedTrackIds = [],
  onSelectionChange,
  onDownloadZip,
  isDownloading = false,
}) {
  const selectedSet = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);

  const allSelected = tracks.length > 0 && tracks.every((t) => selectedSet.has(t.id));
  const someSelected = tracks.some((t) => selectedSet.has(t.id));

  const toggleTrack = useCallback(
    (trackId) => {
      const newSelection = selectedSet.has(trackId)
        ? selectedTrackIds.filter((id) => id !== trackId)
        : [...selectedTrackIds, trackId];
      onSelectionChange?.(newSelection);
    },
    [selectedTrackIds, selectedSet, onSelectionChange]
  );

  const selectAll = useCallback(() => {
    onSelectionChange?.(tracks.map((t) => t.id));
  }, [tracks, onSelectionChange]);

  const deselectAll = useCallback(() => {
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const totalSelectedDuration = useMemo(() => {
    return tracks
      .filter((t) => selectedSet.has(t.id))
      .reduce((sum, t) => sum + (t.duration || 0), 0);
  }, [tracks, selectedSet]);

  const totalDuration = useMemo(() => {
    return tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  }, [tracks]);

  if (!tracks.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.08] bg-ink-900/80 backdrop-blur-md overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-ink-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title + stats */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300">
              <ListMusic className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Çalma Listesi ({tracks.length} Parça)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                <span>{formatDuration(totalDuration)} toplam süre</span>
                {someSelected && (
                  <>
                    <span>•</span>
                    <span className="text-brand-300 font-medium">
                      {selectedTrackIds.length} parça seçildi ({formatDuration(totalSelectedDuration)})
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={allSelected ? deselectAll : selectAll}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
                allSelected
                  ? 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                  : 'bg-brand-500/10 text-brand-300 border-brand-500/30 hover:bg-brand-500/20'
              )}
            >
              {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>

            {onDownloadZip && (
              <button
                type="button"
                onClick={() => {
                  if (!allSelected) selectAll();
                  onDownloadZip();
                }}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)] transition-all duration-200 disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Tümünü ZIP Olarak İndir</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Track list (scrollable) */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-h-72 overflow-y-auto p-3 space-y-1 divide-y divide-white/[0.02]"
      >
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id || index}
            track={track}
            index={index}
            isSelected={selectedSet.has(track.id)}
            onToggle={toggleTrack}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
