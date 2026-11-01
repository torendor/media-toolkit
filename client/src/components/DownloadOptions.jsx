/**
 * DownloadOptions.jsx
 * Profesyonel format, kalite ve ses ayarları paneli.
 * Tema uyumlu özel açılır menüler, koyu arkaplan ve erişilebilir kontroller.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Film,
  Music,
  ChevronDown,
  Image as ImageIcon,
  Volume2,
  Scissors,
  Check,
} from 'lucide-react';
import clsx from 'clsx';

const VIDEO_RESOLUTIONS = [
  { value: '2160p', label: '4K (2160p)' },
  { value: '1440p', label: '2K (1440p)' },
  { value: '1080p60', label: '1080p 60fps' },
  { value: '1080p', label: '1080p Full HD' },
  { value: '720p', label: '720p HD' },
  { value: '480p', label: '480p SD' },
];

const VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
];

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC (Kayıpsız)' },
  { value: 'wav', label: 'WAV' },
  { value: 'm4a', label: 'M4A (AAC)' },
];

const AUDIO_BITRATES = [
  { value: '320', label: '320 kbps (En Yüksek)' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps (Standart)' },
  { value: '128', label: '128 kbps' },
];

/**
 * Modern Açılır Menü (Custom Select)
 */
function SelectField({ label, icon: Icon, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {Icon && <Icon className="w-3.5 h-3.5 text-brand-400" />}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-ink-900 border border-white/[0.1] rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-100 font-medium focus:border-brand-400/80 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer hover:border-white/[0.18]"
          style={{ colorScheme: 'dark' }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-ink-900 text-zinc-100 py-2">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      </div>
    </div>
  );
}

/**
 * Modern Geçiş Anahtarı (Toggle Switch)
 */
function ToggleSwitch({ label, description, icon: Icon, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-400 group-hover:text-brand-300 transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{label}</p>
          {description && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>

      <div
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
          checked ? 'bg-brand-500' : 'bg-white/10'
        )}
      >
        <div
          className={clsx(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}

export default function DownloadOptions({ platform, onDownload, isDownloading }) {
  const [activeTab, setActiveTab] = useState(platform === 'spotify' ? 'audio' : 'video');
  const [resolution, setResolution] = useState('1080p');
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('320');

  const [embedThumbnail, setEmbedThumbnail] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [trimSilence, setTrimSilence] = useState(false);

  const tabs = platform === 'spotify'
    ? [{ id: 'audio', label: 'Ses (Audio)', icon: Music }]
    : [
        { id: 'video', label: 'Video', icon: Film },
        { id: 'audio', label: 'Ses', icon: Music },
      ];

  const handleDownload = useCallback(() => {
    const isVideo = activeTab === 'video';
    const format = isVideo ? videoFormat : audioFormat;
    const quality = isVideo ? resolution : bitrate;
    const options = {
      embedThumbnail,
      normalize,
      trimSilence,
      type: activeTab,
    };
    onDownload?.({ format, quality, options });
  }, [activeTab, videoFormat, audioFormat, resolution, bitrate, embedThumbnail, normalize, trimSilence, onDownload]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.08] bg-ink-900/60 backdrop-blur-xl overflow-hidden shadow-card"
    >
      {/* Sekmeler (Tabs) */}
      <div className="flex border-b border-white/[0.08] bg-white/[0.02]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all relative',
              activeTab === tab.id
                ? 'text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <tab.icon className={clsx('w-4 h-4', activeTab === tab.id ? 'text-brand-400' : 'text-zinc-500')} />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-400 to-brand-indigo"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Seçenek İçeriği */}
      <div className="p-5 sm:p-6 space-y-5">
        <AnimatePresence mode="wait">
          {activeTab === 'video' && platform === 'youtube' && (
            <motion.div
              key="video-options"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Çözünürlük"
                  icon={Film}
                  value={resolution}
                  onChange={setResolution}
                  options={VIDEO_RESOLUTIONS}
                />
                <SelectField
                  label="Format"
                  value={videoFormat}
                  onChange={setVideoFormat}
                  options={VIDEO_FORMATS}
                />
              </div>

              <div className="space-y-2 pt-1">
                <ToggleSwitch
                  label="Kapak Resmini Göm"
                  description="Küçük resmi video kapağı olarak dosyaya ekle"
                  icon={ImageIcon}
                  checked={embedThumbnail}
                  onChange={setEmbedThumbnail}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'audio' && (
            <motion.div
              key="audio-options"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Format"
                  icon={Music}
                  value={audioFormat}
                  onChange={setAudioFormat}
                  options={AUDIO_FORMATS}
                />
                <SelectField
                  label="Bit Hızı (Bitrate)"
                  value={bitrate}
                  onChange={setBitrate}
                  options={AUDIO_BITRATES}
                />
              </div>

              <div className="space-y-2 pt-1">
                <ToggleSwitch
                  label="Albüm Kapağını Göm"
                  description="Yüksek çözünürlüklü kapak görselini ID3 etiketine işle"
                  icon={ImageIcon}
                  checked={embedThumbnail}
                  onChange={setEmbedThumbnail}
                />
                <ToggleSwitch
                  label="Sesi Normalleştir"
                  description="EBU R128 standardı ile ses seviyesini optimize et"
                  icon={Volume2}
                  checked={normalize}
                  onChange={setNormalize}
                />
                <ToggleSwitch
                  label="Sessizlikleri Kırp"
                  description="Şarkı başı ve sonundaki boşlukları temizle"
                  icon={Scissors}
                  checked={trimSilence}
                  onChange={setTrimSilence}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* İndir Butonu */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className={clsx(
              'w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5',
              'bg-gradient-to-r from-brand-500 via-brand-600 to-brand-indigo text-white',
              'shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_10px_25px_-5px_rgba(124,58,237,0.5)]',
              'hover:from-brand-400 hover:to-brand-500 hover:scale-[1.01] active:scale-[0.99]',
              'transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'İndiriliyor & İşleniyor…' : 'Hemen İndir'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
