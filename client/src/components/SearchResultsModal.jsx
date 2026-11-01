/**
 * SearchResultsModal.jsx
 * Elegant dark modal displaying song and video search results
 * with thumbnails, duration, artist info, and 1-click selection/download.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Play, Clock, Eye, Download, Music2, ExternalLink, Loader2 } from 'lucide-react';
import SmartImage from './SmartImage';

export default function SearchResultsModal({
  isOpen,
  onClose,
  query,
  results = [],
  isLoading = false,
  onSelectResult,
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-ink-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-ink-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300">
                <Search className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Arama Sonuçları</h3>
                <p className="text-xs text-zinc-400">
                  <span className="text-brand-300 font-medium">"{query}"</span> için bulunan parçalar
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-sm">En iyi müzik ve video sonuçları aranıyor...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-16 text-center text-zinc-400">
                <Music2 className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-medium text-zinc-300">Sonuç bulunamadı</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Lütfen farklı bir şarkı veya sanatçı adı deneyin.
                </p>
              </div>
            ) : (
              results.map((item, idx) => (
                <motion.div
                  key={item.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => onSelectResult(item)}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-brand-500/30 transition-all cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-ink-950 border border-white/[0.06]">
                    <SmartImage
                      src={item.thumbnail}
                      alt={item.title}
                      seed={item.id}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                      <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-zinc-100 group-hover:text-brand-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {item.artist || item.channel || 'Bilinmeyen Sanatçı'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                      {item.durationFormatted && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.durationFormatted}
                        </span>
                      )}
                      {item.views && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {Number(item.views).toLocaleString('tr-TR')} izlenme
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Select / Download Button */}
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 hover:bg-brand-500 text-brand-300 hover:text-white border border-brand-500/20 transition-all duration-200 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>İndir</span>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.06] bg-ink-950/60 flex items-center justify-between text-xs text-zinc-500">
            <span>Seçtiğiniz parça indirme seçenekleriyle açılacaktır.</span>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

