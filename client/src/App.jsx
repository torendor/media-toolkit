/**
 * App.jsx
 * Media Toolkit — Evrensel Medya & Ses Platformu.
 * Modern, zarif ve yüksek performanslı medya indirici.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Sparkles,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

// Bileşenler
import UrlInput from './components/UrlInput';
import PreviewCard from './components/PreviewCard';
import DownloadOptions from './components/DownloadOptions';
import ProgressConsole from './components/ProgressConsole';
import PlaylistView from './components/PlaylistView';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import HistoryAndRecommendations from './components/HistoryAndRecommendations';
import IntroSplash from './components/IntroSplash';
import { Logo, YouTubeIcon, SpotifyIcon } from './components/ui/Brand';

// Kancalar (Hooks)
import { useDownload } from './hooks/useDownload';
import { useToast } from './hooks/useToast';
import { useHistory } from './hooks/useHistory';
import { useTrending } from './hooks/useTrending';
import { useBackendStatus } from './hooks/useBackendStatus';

// Araçlar (Utils)
import { analyzeUrl } from './utils/api';

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  // Ayarlar durumu
  const [settings, setSettings] = useState({
    normalize: false,
    trimSilence: false,
    namingTemplate: '{artist} - {title}.{ext}',
    zipPackaging: false,
  });

  // Bildirimler
  const { toasts, addToast, removeToast } = useToast();

  // Sunucu Durumu & Trendler
  const backend = useBackendStatus();
  const trending = useTrending(16);

  // Geçmiş ve Akıllı Öneriler
  const {
    history,
    addHistoryItem,
    removeHistoryItem,
    clearHistory,
    recommendations,
  } = useHistory(trending.tracks);

  // İndirme Yöneticisi
  const download = useDownload(addToast);

  // Türetilmiş durumlar
  const isPlaylist = mediaInfo?.isPlaylist || (mediaInfo?.tracks && mediaInfo.tracks.length > 0);
  const showPreview = mediaInfo && !download.isActive && download.stage === 'idle';
  const showOptions = mediaInfo && !download.isActive && download.stage === 'idle';
  const showProgress = download.stage !== 'idle';

  /**
   * Bağlantı Analiz İşlemi
   */
  const handleAnalyze = useCallback(
    async (url) => {
      try {
        setIsAnalyzing(true);
        setCurrentUrl(url);
        setMediaInfo(null);
        setSelectedTrackIds([]);

        const result = await analyzeUrl(url);
        setMediaInfo(result);

        if (result.tracks && result.tracks.length > 0) {
          setSelectedTrackIds(result.tracks.map((t) => t.id));
        }

        addToast('success', `İçerik bulundu: ${result.title || 'Medya içeriği'}`);
      } catch (error) {
        addToast('error', error.message || 'Bağlantı analiz edilirken bir hata oluştu');
        setMediaInfo(null);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [addToast]
  );

  /**
   * Geçmişten / Trendlerden seçim yapıldığında
   */
  const handleSelectUrl = useCallback(
    (itemOrUrl) => {
      const url = typeof itemOrUrl === 'string' ? itemOrUrl : itemOrUrl.url;
      setCurrentUrl(url);
      download.reset();

      if (typeof itemOrUrl === 'object' && itemOrUrl.title) {
        setMediaInfo({
          title: itemOrUrl.title,
          artist: itemOrUrl.artist,
          thumbnail: itemOrUrl.thumbnail,
          duration: itemOrUrl.duration,
          platform: itemOrUrl.platform,
          url: itemOrUrl.url,
        });
        setPlatform(itemOrUrl.platform);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      handleAnalyze(url);
    },
    [handleAnalyze, download]
  );

  const handlePlatformChange = useCallback((detected) => {
    setPlatform(detected);
  }, []);

  /**
   * İndirme Başlatma İşlemi
   */
  const handleDownload = useCallback(
    async ({ format, quality, options }) => {
      if (!currentUrl) {
        addToast('warning', 'Lütfen geçerli bir bağlantı girin');
        return;
      }

      if (backend.state === 'offline') {
        const isNowOnline = await backend.check({ force: true });
        if (!isNowOnline) {
          addToast('error', 'İndirme sunucusu şu an çevrimdışı. Lütfen birkaç saniye sonra tekrar deneyin.');
          return;
        }
      }

      addHistoryItem({
        url: currentUrl,
        title: mediaInfo?.title || 'Medya Dosyası',
        artist: mediaInfo?.artist || mediaInfo?.channel || 'Bilinmeyen Sanatçı',
        thumbnail: mediaInfo?.thumbnail || null,
        platform,
        format,
        quality,
      });

      const mergedOptions = {
        ...options,
        normalize: settings.normalize || options.normalize,
        trimSilence: settings.trimSilence || options.trimSilence,
        namingTemplate: settings.namingTemplate,
        zipPackaging: settings.zipPackaging,
      };

      if (isPlaylist && selectedTrackIds.length > 0) {
        download.startBatch(currentUrl, platform, format, quality, selectedTrackIds, mergedOptions);
      } else {
        download.startDownload(currentUrl, platform, format, quality, mergedOptions);
      }
    },
    [currentUrl, platform, mediaInfo, settings, isPlaylist, selectedTrackIds, download, addToast, addHistoryItem, backend]
  );

  const handleSettingsChange = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    download.reset();
  }, [download]);

  const handleHomeClick = useCallback(() => {
    setCurrentUrl('');
    setMediaInfo(null);
    setPlatform(null);
    setSelectedTrackIds([]);
    download.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [download]);

  return (
    <div className="relative min-h-screen bg-ink-950 text-zinc-100 flex flex-col selection:bg-brand-500/30 selection:text-white">
      {/* İnce ve Şık Arka Plan Parıltıları */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-brand-600/15 via-brand-indigo/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[130px] rounded-full" />
      </div>

      {/* ============================================
          HEADER
          ============================================ */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-ink-950/70 border-b border-white/[0.06] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={handleHomeClick}
            className="flex items-center gap-3 cursor-pointer group select-none"
            role="button"
            tabIndex={0}
            title="Ana Sayfaya Dön"
          >
            <Logo />
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400 border border-white/[0.06]">
              v2.0 Pro
            </span>
          </div>

          {/* Sağ Alan: Sunucu Durumu ve Ayarlar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={clsx(
                'focus-ring flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all cursor-pointer',
                backend.state === 'online'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.25)]'
                  : backend.state === 'checking'
                  ? 'bg-brand-500/10 text-brand-300 border-brand-500/30 animate-pulse'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              )}
              title="Sunucu bağlantı durumunu görüntüle ve yapılandır"
            >
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  backend.state === 'online'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : backend.state === 'checking'
                    ? 'bg-brand-400'
                    : 'bg-amber-400 animate-pulse'
                )}
              />
              <span className="font-mono text-[11px] tracking-tight">
                {backend.state === 'online'
                  ? 'Sunucu Aktif'
                  : backend.state === 'checking'
                  ? 'Bağlanıyor…'
                  : 'Sunucu Çevrimdışı'}
              </span>
            </button>

            {/* Ayarlar Düğmesi */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="focus-ring p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all duration-200"
              aria-label="Ayarlar"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================
          ANA İÇERİK
          ============================================ */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pb-20 relative z-10">
        {/* HERO BÖLÜMÜ (Yalnızca boştayken) */}
        <AnimatePresence>
          {!mediaInfo && !isAnalyzing && download.stage === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center mt-12 sm:mt-18 mb-10 max-w-2xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-6 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Kayıpsız 320 kbps &amp; 4K Ultra HD İndirme</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
                Medyayı <span className="bg-gradient-to-r from-brand-300 via-brand-indigo to-violet-400 bg-clip-text text-transparent">Kusursuz Kalitede</span> İndirin
              </h1>

              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
                YouTube ve Spotify bağlantılarını orijinal kalitesinde MP3, FLAC veya 4K video olarak kaydedin. Albüm kapağı ve ID3 etiketleri dahildir.
              </p>

              {/* Desteklenen Platform Rozetleri */}
              <div className="flex items-center justify-center gap-3 mt-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-medium text-zinc-300">
                  <YouTubeIcon className="w-4 h-4" />
                  YouTube &amp; Shorts
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-medium text-zinc-300">
                  <SpotifyIcon className="w-4 h-4" />
                  Spotify Şarkı &amp; Playlist
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL Giriş Alanı */}
        {download.stage === 'idle' && (
          <div className="w-full max-w-2xl mb-8 mt-4">
            <UrlInput
              value={currentUrl}
              onAnalyze={handleAnalyze}
              isLoading={isAnalyzing}
              platform={platform}
              onPlatformChange={handlePlatformChange}
            />
          </div>
        )}

        {/* Dinamik Alan: Önizleme, Seçenekler, İlerleme Konsolu */}
        <div className="w-full max-w-3xl flex flex-col items-center gap-6">
          {/* Önizleme Kartı */}
          <AnimatePresence mode="wait">
            {(showPreview || isAnalyzing) && (
              <PreviewCard
                key="preview"
                mediaInfo={mediaInfo}
                platform={platform}
                isLoading={isAnalyzing}
              />
            )}
          </AnimatePresence>

          {/* Oynatma Listesi Parça Seçimi */}
          <AnimatePresence>
            {showOptions && isPlaylist && mediaInfo?.tracks && (
              <PlaylistView
                key="playlist"
                tracks={mediaInfo.tracks}
                selectedTrackIds={selectedTrackIds}
                onSelectionChange={setSelectedTrackIds}
              />
            )}
          </AnimatePresence>

          {/* İndirme Seçenekleri (Format, Kalite, Ayarlar) */}
          <AnimatePresence>
            {showOptions && platform && (
              <DownloadOptions
                key="options"
                platform={platform}
                onDownload={handleDownload}
                isDownloading={download.isActive}
              />
            )}
          </AnimatePresence>

          {/* İlerleme Konsolu */}
          <AnimatePresence>
            {showProgress && (
              <ProgressConsole
                key="progress"
                progress={download.progress}
                speed={download.speed}
                eta={download.eta}
                stage={download.stage}
                isActive={download.isActive}
                error={download.error}
                fileUrl={download.fileUrl}
                onCancel={download.cancel}
                onDownloadFile={download.downloadFile}
                onReset={handleReset}
              />
            )}
          </AnimatePresence>

          {/* Geçmiş ve Akıllı Öneriler */}
          <HistoryAndRecommendations
            history={history}
            recommendations={recommendations}
            trending={trending}
            onSelectUrl={handleSelectUrl}
            onClearHistory={clearHistory}
            onRemoveItem={removeHistoryItem}
          />
        </div>

        {/* Nasıl Çalışır & Avantajlar Bölümü (Boştayken) */}
        {!mediaInfo && !isAnalyzing && download.stage === 'idle' && (
          <div className="w-full max-w-4xl mt-20 pt-16 border-t border-white/[0.06]">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Nasıl Çalışır?</h2>
              <p className="text-zinc-400 text-xs sm:text-sm">3 adımda dilediğiniz medyayı arşivleyin</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-ink-900/40 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                  01
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">Bağlantıyı Yapıştırın</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  İndirmek istediğiniz YouTube video/shorts ya da Spotify parça/albüm bağlantısını kutucuğa yapıştırın.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/[0.06] bg-ink-900/40 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 text-indigo-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                  02
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">Formatınızı Seçin</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  320 kbps MP3, FLAC stüdyo sesi ya da 4K 60fps MP4 video arasından dilediğiniz kaliteyi belirleyin.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/[0.06] bg-emerald-500/10 border-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">Anında İndirin</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                FFmpeg destekli yüksek hızlı dönüştürme tamamlandığında dosyanız tek tıkla doğrudan bilgisayarınıza iner.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="border-t border-white/[0.06] bg-ink-950/80 backdrop-blur py-6 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">Media Toolkit Pro</span>
            <span>—</span>
            <span>Evrensel Medya &amp; Ses Aracı</span>
          </div>
          <p className="text-zinc-500 text-[11px]">
            FFmpeg &amp; yt-dlp destekli yüksek performanslı indirme mimarisi.
          </p>
        </div>
      </footer>

      {/* Modallar ve Bildirimler */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        backend={backend}
      />

      <Toast toasts={toasts} removeToast={removeToast} />

      <AnimatePresence>
        {showSplash && <IntroSplash onFinish={() => setShowSplash(false)} />}
      </AnimatePresence>
    </div>
  );
}
