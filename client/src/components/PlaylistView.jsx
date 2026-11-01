/**
 * PlaylistView.jsx
 * Scrollable track list for playlists/albums with select-all,
 * individual selection, track count, and total duration.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Square, ListMusic, Clock, Music } from 'lucide-react';
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

// Animation variants for staggered track list
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const trackVariants = {
  hidden: { opacity: 0, x: -15 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
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
        'flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group',
        isSelected
          ? 'bg-neon-cyan/5 ring-1 ring-neon-cyan/15'
          : 'hover:bg-white/[0.03]'
      )}
    >
      {/* Selection checkbox */}
      <div className="flex-shrink-0">
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-neon-cyan" />
        ) : (
          <Square className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
        )}
      </div>

      {/* Track number */}
      <span className="w-7 text-right text-xs font-mono text-white/30 flex-shrink-0">
        {index + 1}
      </span>

      {/* Mini thumbnail */}
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
        <SmartImage src={track.thumbnail || track.coverUrl} alt={track.title} seed={track.id} className="w-full h-full" />
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/85 font-medium truncate">
          {track.title || 'Unknown Track'}
        </p>
        <p className="text-xs text-white/35 truncate">
          {track.artist || 'Unknown Artist'}
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs font-mono text-white/30 flex-shrink-0">
        {formatDuration(track.duration)}
      </span>
    </motion.div>
  );
}

/**
 * PlaylistView component.
 * @param {object} props
 * @param {Array} props.tracks - Array of track objects
 * @param {string[]} props.selectedTrackIds - Currently selected track IDs
 * @param {Function} props.onSelectionChange - Called with updated selected IDs array
 */
export default function PlaylistView({ tracks = [], selectedTrackIds = [], onSelectionChange }) {
  // Memoize selection set for O(1) lookup
  const selectedSet = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);

  const allSelected = tracks.length > 0 && tracks.every((t) => selectedSet.has(t.id));
  const someSelected = tracks.some((t) => selectedSet.has(t.id));

  /**
   * Toggle an individual track's selection.
   */
  const toggleTrack = useCallback(
    (trackId) => {
      const newSelection = selectedSet.has(trackId)
        ? selectedTrackIds.filter((id) => id !== trackId)
        : [...selectedTrackIds, trackId];
      onSelectionChange?.(newSelection);
    },
    [selectedTrackIds, selectedSet, onSelectionChange]
  );

  /**
   * Select all tracks.
   */
  const selectAll = useCallback(() => {
    onSelectionChange?.(tracks.map((t) => t.id));
  }, [tracks, onSelectionChange]);

  /**
   * Deselect all tracks.
   */
  const deselectAll = useCallback(() => {
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // Calculate total duration of selected tracks
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto glass rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          {/* Title + stats */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-purple/10">
              <ListMusic className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90">Oynatma Listesi Parçaları</h3>
              <p className="text-xs text-white/35 mt-0.5 flex items-center gap-2">
                <span>{tracks.length} parça</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(totalDuration)}
                </span>
              </p>
            </div>
          </div>

          {/* Select/Deselect buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                allSelected
                  ? 'bg-white/5 text-white/50 hover:bg-white/10'
                  : 'bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20'
              )}
            >
              {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>
          </div>
        </div>

        {/* Selection summary */}
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs"
          >
            <span className="text-neon-cyan">
              {tracks.length} parçadan {selectedTrackIds.length} tanesi seçildi
            </span>
            <span className="text-white/30 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalSelectedDuration)}
            </span>
          </motion.div>
        )}
      </div>

      {/* Track list (scrollable) */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-h-80 overflow-y-auto p-3 space-y-1"
      >
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
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
