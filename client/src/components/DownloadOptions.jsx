/**
 * DownloadOptions.jsx
 * Format/quality/bitrate selection panels for YouTube and Spotify downloads.
 * Tab system with video/audio modes, toggle switches, and a neon download button.
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
} from 'lucide-react';
import clsx from 'clsx';

// ============================================
// Option configurations
// ============================================
const VIDEO_RESOLUTIONS = [
  { value: '2160p', label: '4K (2160p)' },
  { value: '1440p', label: '2K (1440p)' },
  { value: '1080p60', label: '1080p 60fps' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];

const VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
];

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'm4a', label: 'M4A' },
];

const AUDIO_BITRATES = [
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '128', label: '128 kbps' },
  { value: 'vbr', label: 'VBR (Variable)' },
];

// Framer Motion animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

/**
 * Custom styled select dropdown.
 */
function SelectField({ label, icon: Icon, value, onChange, options }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 uppercase tracking-wider">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full appearance-none bg-white/5 border border-white/10 rounded-xl
            px-4 py-3 pr-10 text-sm text-white font-medium
            focus:border-neon-cyan/50 focus:ring-2 focus:ring-neon-cyan/20
            outline-none transition-all duration-200 cursor-pointer
            hover:bg-white/8
          `}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-dark-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      </div>
    </div>
  );
}

/**
 * Toggle switch component.
 */
function ToggleSwitch({ label, description, icon: Icon, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            <Icon className="w-4 h-4 text-neon-cyan/70" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-white/80">{label}</p>
          {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
        </div>
      </div>

      {/* Toggle track */}
      <div
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
          checked ? 'bg-neon-cyan/30' : 'bg-white/10'
        )}
      >
        <div
          className={clsx(
            'absolute top-1 w-4 h-4 rounded-full transition-all duration-200',
            checked
              ? 'left-6 bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.5)]'
              : 'left-1 bg-white/40'
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

/**
 * DownloadOptions component.
 * @param {object} props
 * @param {string} props.platform - 'youtube' | 'spotify'
 * @param {Function} props.onDownload - Called with (format, quality, options) when download is triggered
 * @param {boolean} props.isDownloading - Whether a download is currently active
 */
export default function DownloadOptions({ platform, onDownload, isDownloading }) {
  // Active tab: 'video' or 'audio'
  const [activeTab, setActiveTab] = useState(platform === 'spotify' ? 'audio' : 'video');

  // Video settings
  const [resolution, setResolution] = useState('1080p');
  const [videoFormat, setVideoFormat] = useState('mp4');

  // Audio settings
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('320');

  // Toggle options (all defaulted to off/false as requested)
  const [embedThumbnail, setEmbedThumbnail] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [trimSilence, setTrimSilence] = useState(false);

  // Tabs available for each platform
  const tabs = platform === 'spotify'
    ? [{ id: 'audio', label: 'Ses', icon: Music }]
    : [
        { id: 'video', label: 'Video', icon: Film },
        { id: 'audio', label: 'Ses', icon: Music },
      ];

  /**
   * Build download parameters and trigger the download.
   */
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

    onDownload?.(format, quality, options);
  }, [activeTab, videoFormat, audioFormat, resolution, bitrate, embedThumbnail, normalize, trimSilence, onDownload]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="w-full max-w-2xl mx-auto glass rounded-2xl overflow-hidden"
    >
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 relative',
              activeTab === tab.id
                ? 'text-neon-cyan'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}

            {/* Active tab indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Options content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'video' && platform === 'youtube' && (
            <motion.div
              key="video-options"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="space-y-5"
            >
              {/* Video format/quality row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div variants={itemVariants}>
                  <SelectField
                    label="Çözünürlük"
                    icon={Film}
                    value={resolution}
                    onChange={setResolution}
                    options={VIDEO_RESOLUTIONS}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <SelectField
                    label="Format"
                    value={videoFormat}
                    onChange={setVideoFormat}
                    options={VIDEO_FORMATS}
                  />
                </motion.div>
              </div>

              {/* Toggle options */}
              <motion.div variants={itemVariants} className="space-y-2">
                <ToggleSwitch
                  label="Kapak Resmini Göm"
                  description="Küçük resmi video kapağı olarak dosyaya işle"
                  icon={ImageIcon}
                  checked={embedThumbnail}
                  onChange={setEmbedThumbnail}
                />
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'audio' && (
            <motion.div
              key="audio-options"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="space-y-5"
            >
              {/* Audio format/bitrate row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div variants={itemVariants}>
                  <SelectField
                    label="Format"
                    icon={Music}
                    value={audioFormat}
                    onChange={setAudioFormat}
                    options={AUDIO_FORMATS}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <SelectField
                    label="Bit Hızı (Bitrate)"
                    value={bitrate}
                    onChange={setBitrate}
                    options={AUDIO_BITRATES}
                  />
                </motion.div>
              </div>

              {/* Toggle options */}
              <motion.div variants={itemVariants} className="space-y-2">
                <ToggleSwitch
                  label="Albüm Kapağını Göm"
                  description="Yüksek kaliteli kapak görselini ID3 etiketine işle"
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
                  description="Başlangıç ve bitişteki sessiz kısımları otomatik temizle"
                  icon={Scissors}
                  checked={trimSilence}
                  onChange={setTrimSilence}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={clsx(
              'w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5',
              'bg-gradient-to-r from-neon-cyan/20 via-neon-purple/20 to-neon-pink/20',
              'border border-neon-cyan/20',
              'hover:from-neon-cyan/30 hover:via-neon-purple/30 hover:to-neon-pink/30',
              'hover:shadow-[0_0_40px_rgba(0,240,255,0.2)]',
              'hover:scale-[1.02] active:scale-[0.98]',
              'transition-all duration-300',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100',
              !isDownloading && 'animate-pulse-neon'
            )}
          >
            <Download className="w-5 h-5 text-neon-cyan" />
            <span className="text-white">
              {isDownloading ? 'İndiriliyor & İşleniyor...' : 'İndir'}
            </span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
