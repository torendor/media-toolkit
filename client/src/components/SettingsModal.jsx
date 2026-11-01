/**
 * SettingsModal.jsx
 * Full-screen overlay modal for advanced settings:
 * Audio enhancement, file naming, batch download, and about section.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  Scissors,
  FileText,
  Package,
  Info,
  ExternalLink,
  Sparkles,
  Server,
} from 'lucide-react';
import clsx from 'clsx';
import { getApiOverride, setApiOverride } from '../utils/api';

// ============================================
// Naming template presets
// ============================================
const NAMING_PRESETS = [
  { label: 'Sanatçı - Başlık', template: '{artist} - {title}.{ext}' },
  { label: 'Yalnızca Başlık', template: '{title}.{ext}' },
  { label: 'Parça No - Başlık', template: '{track} - {title}.{ext}' },
  { label: 'Albüm / Başlık', template: '{album}/{artist} - {title}.{ext}' },
];

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30, delay: 0.05 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.15 },
  },
};

/**
 * Toggle switch (reusable in settings).
 */
function SettingsToggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer group">
      <div>
        <p className="text-sm font-medium text-white/80 group-hover:text-white/90 transition-colors">
          {label}
        </p>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>

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
 * Section wrapper for the settings modal.
 */
function SettingsSection({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-white/5">
          <Icon className="w-4 h-4 text-neon-cyan/70" />
        </div>
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="pl-1">{children}</div>
    </div>
  );
}

/**
 * SettingsModal component.
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Close the modal
 * @param {object} props.settings - Current settings state
 * @param {Function} props.onSettingsChange - Update settings: (key, value) => void
 */
export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange, backend }) {
  const [apiUrl, setApiUrl] = useState(() => getApiOverride());

  const applyApiUrl = (val) => {
    setApiUrl(val);
    setApiOverride(val);
    backend?.recheck?.();
  };

  // Template preview state (local only)
  const previewTemplate = (settings.namingTemplate || '{artist} - {title}.{ext}')
    .replace('{artist}', 'Artist Name')
    .replace('{title}', 'Track Title')
    .replace('{track}', '01')
    .replace('{album}', 'Album Name')
    .replace('{ext}', 'mp3');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal card */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto glass-strong rounded-2xl z-10"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-dark-800/80 backdrop-blur-xl rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-neon-cyan" />
                <h2 className="text-lg font-bold text-white">Gelişmiş Ayarlar</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors group"
                aria-label="Ayarları kapat"
              >
                <X className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
              </button>
            </div>

            {/* Settings content */}
            <div className="p-6 space-y-8">
              {/* Audio Enhancement */}
              <SettingsSection icon={Volume2} title="Ses İyileştirme">
                <div className="space-y-1 divide-y divide-white/5">
                  <SettingsToggle
                    label="Ses Seviyesi Normalizasyonu"
                    description="EBU R128 standardı ile parçaların ses seviyesini dengeli hale getir"
                    checked={settings.normalize || false}
                    onChange={(v) => onSettingsChange('normalize', v)}
                  />
                  <SettingsToggle
                    label="Sessizlikleri Kırp"
                    description="Parçanın başındaki ve sonundaki sessizlikleri otomatik temizle"
                    checked={settings.trimSilence || false}
                    onChange={(v) => onSettingsChange('trimSilence', v)}
                  />
                </div>
              </SettingsSection>

              {/* File Naming */}
              <SettingsSection icon={FileText} title="Dosya İsimlendirme">
                <div className="space-y-3">
                  {/* Template input */}
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">
                      İsimlendirme Şablonu
                    </label>
                    <input
                      type="text"
                      value={settings.namingTemplate || '{artist} - {title}.{ext}'}
                      onChange={(e) => onSettingsChange('namingTemplate', e.target.value)}
                      className={`
                        w-full bg-white/5 border border-white/10 rounded-xl
                        px-4 py-2.5 text-sm text-white font-mono
                        focus:border-neon-cyan/50 focus:ring-2 focus:ring-neon-cyan/20
                        outline-none transition-all duration-200
                        placeholder-white/20
                      `}
                      placeholder="{artist} - {title}.{ext}"
                    />
                    {/* Template preview */}
                    <p className="text-xs text-white/25 mt-2 font-mono">
                      Önizleme: <span className="text-white/40">{previewTemplate}</span>
                    </p>
                  </div>

                  {/* Preset buttons */}
                  <div className="flex flex-wrap gap-2">
                    {NAMING_PRESETS.map((preset) => (
                      <button
                        key={preset.template}
                        onClick={() => onSettingsChange('namingTemplate', preset.template)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                          settings.namingTemplate === preset.template
                            ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25'
                            : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </SettingsSection>

              {/* Batch Download */}
              <SettingsSection icon={Package} title="Toplu İndirme">
                <SettingsToggle
                  label="ZIP Arşivi Olarak Paketle"
                  description="Çalma listesi ve albümlerdeki tüm parçaları tek bir .zip dosyası halinde indir"
                  checked={settings.zipPackaging || false}
                  onChange={(v) => onSettingsChange('zipPackaging', v)}
                />
              </SettingsSection>

              {/* Server Connection */}
              <SettingsSection icon={Server} title="İndirme Sunucusu">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={clsx(
                          'w-2.5 h-2.5 rounded-full flex-shrink-0',
                          backend?.state === 'online' && 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
                          backend?.state === 'offline' && 'bg-red-400',
                          backend?.state === 'checking' && 'bg-amber-400 animate-pulse'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-white/80">
                          {backend?.state === 'online' ? 'Bağlı' : backend?.state === 'offline' ? 'Çevrimdışı' : 'Kontrol ediliyor…'}
                        </p>
                        <p className="text-[11px] text-white/30 font-mono truncate">{backend?.url || 'Adres yapılandırılmadı'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => backend?.recheck?.()}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg text-xs transition-colors"
                    >
                      Test Et
                    </button>
                  </div>

                  <label className="text-xs text-white/40 block">
                    Özel sunucu adresi <span className="text-white/25">(boş bırakın = otomatik)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      onBlur={() => applyApiUrl(apiUrl)}
                      onKeyDown={(e) => e.key === 'Enter' && applyApiUrl(apiUrl)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-neon-cyan/50 focus:ring-2 focus:ring-neon-cyan/20 outline-none transition-all duration-200 placeholder-white/20"
                      placeholder="Otomatik (start-public.bat)"
                    />
                    {apiUrl && (
                      <button
                        type="button"
                        onClick={() => applyApiUrl('')}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-xs whitespace-nowrap transition-colors"
                      >
                        Otomatik
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-white/30 leading-relaxed">
                    Bilgisayarınızda <code className="text-neon-cyan/70">start-public.bat</code> çalıştırıldığında sunucu adresi siteye otomatik olarak tanıtılır.
                  </p>
                </div>
              </SettingsSection>

              {/* About */}
              <SettingsSection icon={Info} title="Hakkında">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-white/50">Sürüm</span>
                    <span className="text-sm font-mono text-white/70">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-white/50">Platform</span>
                    <span className="text-xs text-white/30">Universal Media & Audio Toolkit</span>
                  </div>
                </div>
              </SettingsSection>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
