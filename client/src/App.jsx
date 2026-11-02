/**
 * App.jsx
 * Media Toolkit — Evrensel Medya & Ses Platformu.
 * Modern, zarif ve yüksek performanslı medya indirici.
 * Desteklenen platformlar: YouTube, Spotify, TikTok, Instagram, Twitter/X.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  MoreHorizontal,
  Download,
  Smartphone,
  Search,
  ArrowLeft,
  Archive,
  Layers,
} from 'lucide-react';
import clsx from 'clsx';

// Bileşenler
import UrlInput from './components/UrlInput';
import PreviewCard from './components/PreviewCard';
import DownloadOptions from './components/DownloadOptions';
import ProgressConsole from './components/ProgressConsole';
import PlaylistView from './components/PlaylistView';
import SettingsModal from './components/SettingsModal';
import SearchResultsModal from './components/SearchResultsModal';
import Toast from './components/Toast';
import HistoryAndRecommendations from './components/HistoryAndRecommendations';
import IntroSplash from './components/IntroSplash';
import {
  Logo,
  YouTubeIcon,
  SpotifyIcon,
  InstagramIcon,
  TikTokIcon,
  TwitterIcon,
} from './components/ui/Brand';

// Kancalar (Hooks)
import { useDownload } from './hooks/useDownload';
import { useToast } from './hooks/useToast';
import { useHistory } from './hooks/useHistory';
import { useTrending } from './hooks/useTrending';
import { useBackendStatus } from './hooks/useBackendStatus';

// Araçlar (Utils)
import { analyzeUrl, searchMedia } from './utils/api';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  // Platform Modu ('all', 'youtube', 'spotify', 'instagram', 'tiktok', 'twitter')
  const [platformMode, setPlatformMode] = useState('all');
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const socialMenuRef = useRef(null);

  // Doğrudan Arama Durumu (In-App Search)
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // PWA Kurulum Durumu
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

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

  // PWA Kurulum Dinleyicisi
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Menü dışına tıklandığında sosyal menüyü kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (socialMenuRef.current && !socialMenuRef.current.contains(e.target)) {
        setShowSocialMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      addToast('success', 'MediaToolkit uygulaması cihazınıza yüklendi!');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  /**
   * Doğrudan Arama İşlemi
   */
  const handleSearch = useCallback(
    async (query) => {
      if (!query || !query.trim()) return;
      const cleanQuery = query.trim();
      setSearchQuery(cleanQuery);
      setIsSearching(true);
      setShowSearchModal(true);

      try {
        const data = await searchMedia(cleanQuery, 10);
        setSearchResults(data.results || []);
        if (!data.results || data.results.length === 0) {
          addToast('info', `"${cleanQuery}" için sonuç bulunamadı`);
        }
      } catch (err) {
        console.error('Search error:', err);
        addToast('error', err.message || 'Arama yapılamadı');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [addToast]
  );

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

        if (result.platform) {
          setPlatform(result.platform);
        }

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
   * Arama Sonucundan Seçim Yapıldığında
   */
  const handleSelectSearchResult = useCallback(
    (item) => {
      setShowSearchModal(false);
      setCurrentUrl(item.url);
      setPlatform(item.platform || 'youtube');
      download.reset();
      handleAnalyze(item.url);
    },
    [handleAnalyze, download]
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
    if (detected) {
      setPlatform(detected);
    }
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
          addToast(
            'error',
            'İndirme sunucusu şu an çevrimdışı. Lütfen birkaç saniye sonra tekrar deneyin.'
          );
          return;
        }
      }

      addHistoryItem({
        url: currentUrl,
        title: mediaInfo?.title || 'Medya Dosyası',
        artist: mediaInfo?.artist || mediaInfo?.channel || 'Bilinmeyen Sanatçı',
        thumbnail: mediaInfo?.thumbnail || null,
        platform: platform || 'youtube',
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
        download.startBatch(
          currentUrl,
          platform || 'spotify',
          format,
          quality,
          selectedTrackIds,
          mergedOptions
        );
      } else {
        download.startDownload(
          currentUrl,
          platform || 'youtube',
          format,
          quality,
          mergedOptions
        );
      }
    },
    [
      currentUrl,
      platform,
      mediaInfo,
      settings,
      isPlaylist,
      selectedTrackIds,
      download,
      addToast,
      addHistoryItem,
      backend,
    ]
  );

  /**
   * Oynatma listesi için tek tıkla ZIP indirme
   */
  const handleDownloadPlaylistZip = useCallback(() => {
    if (!currentUrl) return;
    const allIds = mediaInfo?.tracks?.map((t) => t.id) || selectedTrackIds;
    download.startBatch(
      currentUrl,
      platform || 'spotify',
      'audio',
      '320',
      allIds,
      {
        ...settings,
        zipPackaging: true,
        audioFormat: 'mp3',
        audioBitrate: '320',
      }
    );
  }, [currentUrl, platform, mediaInfo, selectedTrackIds, settings, download]);

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
    setPlatformMode('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [download]);

  return (
    <div className="relative min-h-screen bg-ink-950 text-zinc-100 flex flex-col selection:bg-brand-500/30 selection:text-white">
      {/* Şık Arka Plan Parıltıları */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className={clsx(
            'absolute -top-[25%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] blur-[140px] rounded-full transition-colors duration-700',
            platformMode === 'instagram'
              ? 'bg-gradient-to-b from-pink-600/20 via-rose-600/10 to-transparent'
              : platformMode === 'tiktok'
              ? 'bg-gradient-to-b from-cyan-600/20 via-pink-600/10 to-transparent'
              : platformMode === 'twitter'
              ? 'bg-gradient-to-b from-zinc-600/20 via-zinc-800/10 to-transparent'
              : 'bg-gradient-to-b from-brand-600/15 via-brand-indigo/10 to-transparent'
          )}
        />
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[130px] rounded-full" />
      </div>

      {/* ============================================
          HEADER
          ============================================ */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-ink-950/80 border-b border-white/[0.06] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Sol Alan: Logo */}
          <div
            onClick={handleHomeClick}
            className="flex items-center gap-3 cursor-pointer group select-none flex-shrink-0"
            role="button"
            tabIndex={0}
            title="Ana Sayfaya Dön"
          >
            <Logo />
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.05] text-zinc-400 border border-white/[0.06]">
              v2.1 Pro
            </span>
          </div>

          {/* Orta Alan: Platform Seçici & 3 Nokta Menüsü */}
          <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur">
            <button
              type="button"
              onClick={() => {
                setPlatformMode('all');
                setShowSocialMenu(false);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                platformMode === 'all'
                  ? 'bg-white/[0.1] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              Tüm Medyalar
            </button>

            <button
              type="button"
              onClick={() => {
                setPlatformMode('youtube');
                setShowSocialMenu(false);
              }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                platformMode === 'youtube'
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              <YouTubeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlatformMode('spotify');
                setShowSocialMenu(false);
              }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                platformMode === 'spotify'
                  ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              <SpotifyIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spotify</span>
            </button>

            {/* 3 Nokta Sosyal Medya Menüsü (Instagram, TikTok, Twitter/X) */}
            <div className="relative" ref={socialMenuRef}>
              <button
                type="button"
                onClick={() => setShowSocialMenu((prev) => !prev)}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
                  ['instagram', 'tiktok', 'twitter'].includes(platformMode)
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border-transparent'
                )}
                title="Sosyal Medya İndiricileri (Instagram, TikTok, Twitter/X)"
              >
                {platformMode === 'instagram' ? (
                  <InstagramIcon className="w-3.5 h-3.5" />
                ) : platformMode === 'tiktok' ? (
                  <TikTokIcon className="w-3.5 h-3.5" />
                ) : platformMode === 'twitter' ? (
                  <TwitterIcon className="w-3.5 h-3.5" />
                ) : (
                  <MoreHorizontal className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {platformMode === 'instagram'
                    ? 'Instagram'
                    : platformMode === 'tiktok'
                    ? 'TikTok'
                    : platformMode === 'twitter'
                    ? 'X / Twitter'
                    : 'Diğer'}
                </span>
              </button>

              {/* Açılır Dropdown */}
              <AnimatePresence>
                {showSocialMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-ink-900 border border-white/10 shadow-2xl p-1.5 z-50 backdrop-blur-xl"
                  >
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 border-b border-white/[0.06] mb-1">
                      Sosyal Medya İndiricileri
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPlatformMode('instagram');
                        setShowSocialMenu(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                        platformMode === 'instagram'
                          ? 'bg-pink-500/15 text-pink-300'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                      )}
                    >
                      <InstagramIcon className="w-4 h-4 text-pink-400" />
                      <div>
                        <div>Instagram İndirici</div>
                        <div className="text-[10px] text-zinc-500">Reels, Video &amp; Gönderi</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlatformMode('tiktok');
                        setShowSocialMenu(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                        platformMode === 'tiktok'
                          ? 'bg-cyan-500/15 text-cyan-300'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                      )}
                    >
                      <TikTokIcon className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div>TikTok İndirici</div>
                        <div className="text-[10px] text-zinc-500">Filigransız HD MP4</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlatformMode('twitter');
                        setShowSocialMenu(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                        platformMode === 'twitter'
                          ? 'bg-zinc-700/40 text-white'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                      )}
                    >
                      <TwitterIcon className="w-4 h-4 text-zinc-300" />
                      <div>
                        <div>Twitter / X İndirici</div>
                        <div className="text-[10px] text-zinc-500">Video &amp; GIF İndirme</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Sağ Alan: PWA Yükle, Sunucu Durumu & Ayarlar */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* PWA Kurulum Butonu */}
            {isInstallable && (
              <button
                type="button"
                onClick={handleInstallApp}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-brand-500/15 text-brand-300 border border-brand-500/30 hover:bg-brand-500/25 transition-all shadow-sm"
                title="MediaToolkit uygulamasını bilgisayarınıza veya telefonunuza yükleyin"
              >
                <Smartphone className="w-3.5 h-3.5 text-brand-400" />
                <span>Uygulamayı Yükle</span>
              </button>
            )}

            {/* Sunucu Durum Rozeti */}
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
              <span className="font-mono text-[11px] tracking-tight hidden md:inline">
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
        {/* HERO / PLATFORM BAŞLIĞI (Yalnızca boştayken) */}
        <AnimatePresence mode="wait">
          {!mediaInfo && !isAnalyzing && download.stage === 'idle' && (
            <motion.div
              key={platformMode}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="text-center mt-10 sm:mt-16 mb-8 max-w-2xl mx-auto"
            >
              {/* Instagram Özel Görünümü */}
              {platformMode === 'instagram' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium mb-4 shadow-sm">
                    <InstagramIcon className="w-4 h-4" />
                    <span>Instagram Reels &amp; Video İndirici</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
                    Instagram Reels &amp; Videolarını <br />
                    <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">
                      Filigransız HD İndirin
                    </span>
                  </h1>
                  <p className="text-zinc-400 text-sm max-w-lg mx-auto mb-4">
                    Instagram Reels, video ve gönderi bağlantılarını yapıştırın, yüksek çözünürlüklü MP4 video veya MP3 ses olarak kaydedin.
                  </p>
                  <button
                    onClick={() => setPlatformMode('all')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Tüm platformlara dön</span>
                  </button>
                </div>
              )}

              {/* TikTok Özel Görünümü */}
              {platformMode === 'tiktok' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-4 shadow-sm">
                    <TikTokIcon className="w-4 h-4 text-cyan-400" />
                    <span>TikTok Filigransız Video İndirici</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
                    TikTok Videoları <br />
                    <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-rose-400 bg-clip-text text-transparent">
                      Filigransız (No Watermark)
                    </span>
                  </h1>
                  <p className="text-zinc-400 text-sm max-w-lg mx-auto mb-4">
                    TikTok logo ve kullanıcı adı filigranı olmadan full HD 1080p MP4 veya orijinal arka plan sesini 320 kbps MP3 olarak indirin.
                  </p>
                  <button
                    onClick={() => setPlatformMode('all')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Tüm platformlara dön</span>
                  </button>
                </div>
              )}

              {/* Twitter / X Özel Görünümü */}
              {platformMode === 'twitter' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-700/40 border border-zinc-600/40 text-zinc-200 text-xs font-medium mb-4 shadow-sm">
                    <TwitterIcon className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Twitter / X Video &amp; GIF İndirici</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
                    X (Twitter) Videolarını <br />
                    <span className="bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                      Kayıpsız Kalitede Kaydedin
                    </span>
                  </h1>
                  <p className="text-zinc-400 text-sm max-w-lg mx-auto mb-4">
                    Tweet içindeki videoları ve animasyonlu GIF'leri en yüksek MP4 çözünürlüğünde anında cihazınıza indirin.
                  </p>
                  <button
                    onClick={() => setPlatformMode('all')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Tüm platformlara dön</span>
                  </button>
                </div>
              )}

              {/* Spotify Özel Görünümü */}
              {platformMode === 'spotify' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-medium mb-4 shadow-sm">
                    <SpotifyIcon className="w-4 h-4" />
                    <span>Spotify Şarkı &amp; Oynatma Listesi İndirici</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
                    Spotify Parçalarını <br />
                    <span className="bg-gradient-to-r from-green-300 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                      320 kbps &amp; Tek Tıkla ZIP
                    </span>
                  </h1>
                  <p className="text-zinc-400 text-sm max-w-lg mx-auto mb-4">
                    Spotify parça ve albümlerini ID3 etiketleri ve albüm kapaklarıyla birlikte stüdyo kalitesinde MP3 olarak arşivleyin.
                  </p>
                  <button
                    onClick={() => setPlatformMode('all')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Tüm platformlara dön</span>
                  </button>
                </div>
              )}

              {/* YouTube Özel Görünümü */}
              {platformMode === 'youtube' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium mb-4 shadow-sm">
                    <YouTubeIcon className="w-4 h-4" />
                    <span>YouTube Video, Shorts &amp; Müzik İndirici</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
                    YouTube Videoları &amp; Shorts <br />
                    <span className="bg-gradient-to-r from-red-400 via-rose-400 to-amber-400 bg-clip-text text-transparent">
                      4K Ultra HD &amp; FLAC
                    </span>
                  </h1>
                  <p className="text-zinc-400 text-sm max-w-lg mx-auto mb-4">
                    YouTube videolarını en yüksek kalitede MP4 olarak ya da doğrudan 320 kbps ses dosyası olarak saniyeler içinde indirin.
                  </p>
                  <button
                    onClick={() => setPlatformMode('all')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Tüm platformlara dön</span>
                  </button>
                </div>
              )}

              {/* Varsayılan Evrensel Görünüm */}
              {platformMode === 'all' && (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-6 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    <span>Kayıpsız 320 kbps &amp; 4K Ultra HD İndirme</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
                    Medyayı <span className="bg-gradient-to-r from-brand-300 via-brand-indigo to-violet-400 bg-clip-text text-transparent">Kusursuz Kalitede</span> İndirin
                  </h1>

                  <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
                    YouTube, Spotify, TikTok, Instagram ve Twitter bağlantılarını orijinal kalitesinde MP3 veya 4K video olarak kaydedin.
                  </p>

                  {/* Desteklenen Platform Rozetleri */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
                    <button
                      onClick={() => setPlatformMode('youtube')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <YouTubeIcon className="w-3.5 h-3.5" />
                      YouTube &amp; Shorts
                    </button>
                    <button
                      onClick={() => setPlatformMode('spotify')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <SpotifyIcon className="w-3.5 h-3.5" />
                      Spotify Çalma Listesi
                    </button>
                    <button
                      onClick={() => setPlatformMode('instagram')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <InstagramIcon className="w-3.5 h-3.5" />
                      Instagram Reels
                    </button>
                    <button
                      onClick={() => setPlatformMode('tiktok')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors"
                    >
                      <TikTokIcon className="w-3.5 h-3.5 text-cyan-400" />
                      TikTok Filigransız
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Akıllı URL ve Arama Giriş Alanı */}
        {download.stage === 'idle' && (
          <div className="w-full max-w-2xl mb-8 mt-2">
            <UrlInput
              value={currentUrl}
              onAnalyze={handleAnalyze}
              onSearch={handleSearch}
              isLoading={isAnalyzing}
              platform={platform}
              onPlatformChange={handlePlatformChange}
              platformMode={platformMode}
            />
          </div>
        )}

        {/* Dinamik Alan: Önizleme, Oynatma Listesi, Seçenekler, İlerleme Konsolu */}
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

          {/* Oynatma Listesi Parça Seçimi & Tek Tıkla ZIP */}
          <AnimatePresence>
            {showOptions && isPlaylist && mediaInfo?.tracks && (
              <PlaylistView
                key="playlist"
                tracks={mediaInfo.tracks}
                selectedTrackIds={selectedTrackIds}
                onSelectionChange={setSelectedTrackIds}
                onDownloadZip={handleDownloadPlaylistZip}
                isDownloading={download.isActive}
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
                onDirectDownload={() => {
                  download.startDirectDownload({
                    url: currentUrl,
                    format: platform === 'spotify' ? 'audio' : 'video',
                    quality: 'best',
                  });
                }}
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
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Nasıl Çalışır?
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm">
                3 basit adımda dilediğiniz medyayı bilgisayarınıza veya telefonunuza kaydedin
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-ink-900/40 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                  01
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">
                  Bağlantıyı Yapıştırın veya Arayın
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  YouTube, Spotify, TikTok, Instagram veya Twitter linkini yapıştırın ya da şarkı adını doğrudan kutucuğa yazın.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/[0.06] bg-ink-900/40 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 text-indigo-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                  02
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">
                  Formatınızı &amp; Kalitenizi Seçin
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  320 kbps kristal netliğinde MP3, stüdyo FLAC sesi veya 4K / 1080p full HD MP4 video seçeneklerinden dilediğinizi belirleyin.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/[0.06] bg-emerald-500/10 border-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">
                Tek Tıkla Doğrudan İndirin
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                FFmpeg destekli yüksek hızlı dönüştürme biter bitmez dosyanız otomatik olarak bilgisayarınıza veya telefonunuza iner.
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
            <span>Evrensel Medya, Müzik &amp; Ses Aracı</span>
          </div>
          <p className="text-zinc-500 text-[11px]">
            FFmpeg &amp; yt-dlp destekli yüksek performanslı indirme mimarisi.
          </p>
        </div>
      </footer>

      {/* Doğrudan Arama Sonuçları Modalı */}
      <SearchResultsModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        query={searchQuery}
        results={searchResults}
        isLoading={isSearching}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Ayarlar Modalı */}
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
