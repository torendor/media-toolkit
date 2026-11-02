/**
 * ProgressConsole.jsx
 * Real-time download progress display with terminal-style glass container.
 * Shows progress bar, speed, ETA, stage indicator, and cancel button.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  RefreshCw,
  Tag,
  CheckCircle,
  XCircle,
  X,
  Gauge,
  Clock,
  FileDown,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

// ============================================
// Stage configuration
// ============================================
const STAGE_CONFIG = {
  downloading: {
    icon: Download,
    label: 'İndiriliyor',
    color: 'text-neon-cyan',
    barColor: 'from-neon-cyan to-blue-500',
  },
  converting: {
    icon: RefreshCw,
    label: 'Dönüştürülüyor & İşleniyor',
    color: 'text-neon-purple',
    barColor: 'from-blue-500 to-neon-purple',
  },
  tagging: {
    icon: Tag,
    label: 'Etiketler & Kapak Ekleniyor',
    color: 'text-neon-pink',
    barColor: 'from-neon-purple to-neon-pink',
  },
  complete: {
    icon: CheckCircle,
    label: 'Tamamlandı',
    color: 'text-emerald-400',
    barColor: 'from-emerald-500 to-emerald-400',
  },
  error: {
    icon: XCircle,
    label: 'Hata Oluştu',
    color: 'text-red-400',
    barColor: 'from-red-500 to-red-400',
  },
};

// Stage progression dots
const STAGE_ORDER = ['downloading', 'converting', 'tagging', 'complete'];

/**
 * Confetti-like success particles animation.
 */
function SuccessParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 150 - 50,
        delay: Math.random() * 0.3,
        duration: 0.8 + Math.random() * 0.5,
        size: 4 + Math.random() * 6,
        color: ['#00f0ff', '#a855f7', '#ec4899', '#10b981'][Math.floor(Math.random() * 4)],
      })),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: p.x,
            y: p.y,
            scale: 0,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * ProgressConsole component.
 * @param {object} props
 * @param {number} props.progress - 0-100 percentage
 * @param {string} props.speed - Download speed string
 * @param {string} props.eta - ETA string
 * @param {string} props.stage - Current stage key
 * @param {boolean} props.isActive - Whether download is active
 * @param {string | null} props.error - Error message
 * @param {string | null} props.fileUrl - Completed file download URL
 * @param {Function} props.onCancel - Cancel download callback
 * @param {Function} props.onDownloadFile - Trigger file download callback
 * @param {Function} props.onReset - Reset to initial state
 */
export default function ProgressConsole({
  progress = 0,
  speed,
  eta,
  stage = 'downloading',
  isActive,
  error,
  fileUrl,
  onCancel,
  onDownloadFile,
  onReset,
  onDirectDownload,
}) {
  const stageConfig = STAGE_CONFIG[stage] || STAGE_CONFIG.downloading;
  const StageIcon = stageConfig.icon;
  const isComplete = stage === 'complete';
  const isError = stage === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto glass rounded-2xl overflow-hidden relative"
    >
      {/* Success particles */}
      <AnimatePresence>
        {isComplete && <SuccessParticles />}
      </AnimatePresence>

      {/* Terminal header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* Terminal dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs font-mono text-white/30 ml-2">download-progress</span>
        </div>

        {/* Cancel / Close button */}
        {isActive && (
          <button
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-white/10 transition-colors group"
            title="İndirmeyi İptal Et"
          >
            <X className="w-4 h-4 text-white/30 group-hover:text-red-400 transition-colors" />
          </button>
        )}

        {(isComplete || isError) && (
          <button
            onClick={onReset}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Kapat
          </button>
        )}
      </div>

      {/* Progress content */}
      <div className="p-5 space-y-5">
        {/* Stage indicator with icon */}
        <div className="flex items-center justify-between">
          <motion.div
            key={stage}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className={clsx('p-2 rounded-lg bg-white/5', stageConfig.color)}>
              <StageIcon
                className={clsx(
                  'w-5 h-5',
                  stage === 'converting' && 'animate-spin',
                  stage === 'downloading' && 'animate-bounce'
                )}
              />
            </div>
            <div>
              <p className={clsx('text-sm font-semibold', stageConfig.color)}>
                {stageConfig.label}
              </p>
              {error && <p className="text-xs text-red-400/80 mt-0.5">{error}</p>}
            </div>
          </motion.div>

          {/* Large percentage display */}
          <motion.span
            key={Math.round(progress)}
            initial={{ scale: 1.1, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            className={clsx(
              'text-3xl font-bold font-mono tabular-nums',
              isComplete ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-white'
            )}
          >
            {Math.round(progress)}%
          </motion.span>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className={clsx(
              'h-full rounded-full bg-gradient-to-r',
              stageConfig.barColor
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          {/* Shimmer overlay on active bar */}
          {isActive && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
              style={{ backgroundSize: '200% 100%' }}
            />
          )}
        </div>

        {/* Stage progression dots */}
        <div className="flex items-center justify-center gap-1">
          {STAGE_ORDER.map((s, i) => {
            const stageIdx = STAGE_ORDER.indexOf(stage);
            const isDone = i < stageIdx || stage === 'complete';
            const isCurrent = s === stage;

            return (
              <React.Fragment key={s}>
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    isDone && 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
                    isCurrent && 'bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.5)] scale-125',
                    !isDone && !isCurrent && 'bg-white/10'
                  )}
                />
                {i < STAGE_ORDER.length - 1 && (
                  <div
                    className={clsx(
                      'w-8 h-0.5 rounded-full transition-all duration-300',
                      isDone ? 'bg-emerald-400/40' : 'bg-white/5'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Speed and ETA row */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between text-xs"
          >
            {/* Speed */}
            <span className="flex items-center gap-1.5 text-white/40 font-mono">
              <Gauge className="w-3.5 h-3.5" />
              {speed || '-- MB/s'}
            </span>

            {/* ETA */}
            <span className="flex items-center gap-1.5 text-white/40 font-mono">
              <Clock className="w-3.5 h-3.5" />
              Kalan Süre: {eta || '--:--'}
            </span>
          </motion.div>
        )}

        {/* Action buttons */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3"
          >
            <button
              onClick={onDownloadFile}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl',
                'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400',
                'hover:bg-emerald-500/25 hover:scale-[1.02]',
                'transition-all duration-200 font-semibold text-sm'
              )}
            >
              <FileDown className="w-4 h-4" />
              Dosyayı Bilgisayara Kaydet
            </button>
            <button
              onClick={onReset}
              className={clsx(
                'px-6 py-3 rounded-xl',
                'bg-white/5 border border-white/10 text-white/60',
                'hover:bg-white/10 hover:text-white/80 hover:scale-[1.02]',
                'transition-all duration-200 text-sm'
              )}
            >
              Yeni İndirme
            </button>
          </motion.div>
        )}

        {/* Error retry / direct download fallback */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row gap-2.5 justify-center items-center"
          >
            {onDirectDownload && (
              <button
                onClick={onDirectDownload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4 text-amber-400" />
                İstemci Taraflı İndir (Doğrudan Akış Fallback)
              </button>
            )}
            <button
              onClick={onReset}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-medium"
            >
              Tekrar Dene
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
