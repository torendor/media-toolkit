/**
 * HistoryAndRecommendations.jsx
 * Dashboard hub: Recent Downloads, Smart Recommendations (based on downloads)
 * and the live Spotify "Top 50 - Turkey" chart.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Sparkles,
  Flame,
  Download,
  Trash2,
  Music2,
  Youtube,
  ArrowRight,
  Disc3,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';
import clsx from 'clsx';
import SmartImage from './SmartImage';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Dün';
  return `${diffDays} gün önce`;
}

function PlatformBadge({ platform, className }) {
  return (
    <div className={clsx('p-1 rounded-md bg-black/75 backdrop-blur-sm', className)}>
      {platform === 'spotify' ? (
        <Music2 className="w-3 h-3 text-green-400" />
      ) : (
        <Youtube className="w-3 h-3 text-red-400" />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, children, iconClass }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
        <Icon className={clsx('w-6 h-6 text-white/20', iconClass)} />
      </div>
      <h4 className="text-sm font-semibold text-white/60">{title}</h4>
      <p className="text-xs text-white/35 max-w-md mx-auto mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

/** Small preview player shared across trending cards (one at a time). */
let sharedAudio = null;

function usePreview() {
  const [playingId, setPlayingId] = useState(null);
  const toggle = (e, track) => {
    e.stopPropagation();
    if (!track.previewUrl) return;
    if (playingId === track.id) {
      sharedAudio?.pause();
      setPlayingId(null);
      return;
    }
    sharedAudio?.pause();
    sharedAudio = new Audio(track.previewUrl);
    sharedAudio.volume = 0.6;
    sharedAudio.play().catch(() => setPlayingId(null));
    sharedAudio.onended = () => setPlayingId(null);
    setPlayingId(track.id);
  };
  return { playingId, toggle };
}

function TrendingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="aspect-square rounded-lg bg-white/[0.06] animate-pulse mb-3" />
          <div className="h-3.5 w-3/4 rounded bg-white/[0.06] animate-pulse mb-2" />
          <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function HistoryAndRecommendations({
  history = [],
  recommendations = [],
  trending = { tracks: [], loading: false, error: null },
  onSelectUrl,
  onClearHistory,
  onRemoveItem,
}) {
  const [activeTab, setActiveTab] = useState('trending');
  const { playingId, toggle } = usePreview();

  const tabs = [
    { id: 'trending', label: 'Türkiye Top 50', short: 'Trendler', icon: Flame },
    { id: 'recommendations', label: 'Sizin İçin', short: 'Öneriler', icon: Sparkles, count: recommendations.length },
    { id: 'history', label: 'Son İndirilenler', short: 'Geçmiş', icon: History, count: history.length },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-4xl mx-auto mt-8 glass rounded-2xl overflow-hidden border border-white/10"
    >
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 sm:px-5 py-3 gap-3">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
                  isActive
                    ? 'text-neon-cyan bg-white/5 border border-neon-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
                {tab.count > 0 && (
                  <span
                    className={clsx(
                      'text-[10px] px-1.5 rounded-full font-mono font-bold',
                      isActive ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 text-white/40'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'history' && history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
            title="Tüm indirme geçmişini temizle"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Temizle</span>
          </button>
        )}
        {activeTab === 'trending' && (
          <button
            onClick={trending.reload}
            disabled={trending.loading}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-amber-300 transition-colors px-2 py-1 rounded-lg hover:bg-amber-400/10 flex-shrink-0 disabled:opacity-50"
            title="Listeyi yenile"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', trending.loading && 'animate-spin')} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {/* ---------------- TRENDING ---------------- */}
          {activeTab === 'trending' && (
            <motion.div
              key="trending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between text-xs text-white/40">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Spotify Türkiye'de şu an en çok dinlenenler
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/80 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CANLI
                </span>
              </div>

              {trending.loading && !trending.tracks.length ? (
                <TrendingSkeleton />
              ) : trending.error && !trending.tracks.length ? (
                <EmptyState icon={AlertTriangle} title="Trend listesi yüklenemedi" iconClass="text-amber-400/60">
                  {trending.error}{' '}
                  <button onClick={trending.reload} className="text-neon-cyan hover:underline">
                    Tekrar dene
                  </button>
                </EmptyState>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {trending.tracks.map((item, index) => {
                    const isPlaying = playingId === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
                        onClick={() => onSelectUrl(item)}
                        className="group relative flex flex-col p-2.5 sm:p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-amber-400/30 transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(251,191,36,0.12)] hover:-translate-y-0.5"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden mb-2.5">
                          <SmartImage
                            src={item.thumbnail}
                            alt={item.title}
                            seed={item.id}
                            className="w-full h-full"
                            imgClassName="group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                          <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-xs font-black font-mono text-amber-400 border border-amber-400/30">
                            #{item.rank || index + 1}
                          </div>
                          <PlatformBadge platform={item.platform} className="absolute top-1.5 right-1.5" />

                          {item.previewUrl && (
                            <button
                              onClick={(e) => toggle(e, item)}
                              className={clsx(
                                'absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
                                isPlaying
                                  ? 'bg-amber-400 text-black opacity-100 scale-100'
                                  : 'bg-white text-black opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                              )}
                              title={isPlaying ? 'Durdur' : '30 sn önizleme'}
                            >
                              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                            </button>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                          {item.title}
                        </h4>
                        <p className="text-xs text-white/40 truncate mt-0.5">{item.artist}</p>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                          <span className="text-white/30 font-mono">
                            {item.durationFormatted || ''}
                            {item.explicit && (
                              <span className="ml-1.5 px-1 rounded bg-white/10 text-white/50 font-sans font-bold">E</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectUrl(item);
                            }}
                            className="p-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-black transition-all cursor-pointer shadow-[0_0_10px_rgba(251,191,36,0.15)] active:scale-95"
                            title="İndirme ekranına git"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ---------------- RECOMMENDATIONS ---------------- */}
          {activeTab === 'recommendations' && (
            <motion.div
              key="recs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {recommendations.length === 0 ? (
                <EmptyState icon={Disc3} title="Henüz kişisel öneri yok" iconClass="text-neon-purple/40 animate-spin">
                  Öneriler <strong className="text-white/60">indirdiğiniz şarkılara ve sanatçılara</strong> göre
                  hesaplanır. Birkaç parça indirdiğinizde tarzınıza uygun hitler burada belirecek.
                </EmptyState>
              ) : (
                <>
                  <div className="flex items-center text-xs text-white/40">
                    <Sparkles className="w-3.5 h-3.5 text-neon-cyan mr-1.5" />
                    İndirdiklerinize göre seçilen parçalar
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {recommendations.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => onSelectUrl(track)}
                        className="group flex flex-col justify-between p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-neon-cyan/30 transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                            <SmartImage src={track.thumbnail} alt={track.title} seed={track.id} className="w-full h-full" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors truncate">
                              {track.title}
                            </h4>
                            <p className="text-xs text-white/45 truncate mt-0.5">{track.artist}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] gap-2">
                          <span className="text-neon-purple/90 font-medium truncate">{track.reason}</span>
                          <span className="flex items-center gap-1 text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex-shrink-0">
                            İndir <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ---------------- HISTORY ---------------- */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {history.length === 0 ? (
                <EmptyState icon={History} title="Henüz indirme geçmişiniz yok">
                  İndirdiğiniz medya dosyaları burada saklanır ve tek tıkla tekrar açılabilir.
                </EmptyState>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all duration-200"
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <SmartImage src={item.thumbnail} alt={item.title} seed={item.url} className="w-full h-full" />
                        <PlatformBadge platform={item.platform} className="absolute bottom-1 right-1 !p-0.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white/90 truncate group-hover:text-neon-cyan transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-white/40 truncate mt-0.5">{item.artist}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/30 font-mono">
                          <span className="uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-neon-purple font-semibold">
                            {item.format || 'MP3'}
                          </span>
                          <span>•</span>
                          <span>{formatRelativeTime(item.timestamp)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => onSelectUrl(item)}
                          className="p-2 rounded-lg bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan transition-colors"
                          title="Tekrar aç ve indir"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-2 rounded-lg sm:opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
                          title="Listeden kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
