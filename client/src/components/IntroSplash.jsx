/**
 * IntroSplash.jsx
 * Modern, şık ve lüks açılış animasyonu.
 * Geist font ailesi ve zarif violet/indigo dalgalarıyla açılır ve yumuşakça kaybolur.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { LogoMark } from './ui/Brand';

export default function IntroSplash({ onFinish }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 1100; // 1.1 saniye hızlı ve akıcı

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(p);

      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => onFinish?.(), 180);
      }
    }, 25);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.02, transition: { duration: 0.45, ease: 'easeInOut' } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950 text-white select-none overflow-hidden"
    >
      {/* İnce ortam ışığı */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-brand-500/20 via-brand-indigo/15 to-transparent blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Mark animasyonu */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative mb-6"
        >
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] shadow-glow backdrop-blur-xl">
            <LogoMark className="w-12 h-12" />
          </div>
        </motion.div>

        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Media</span>
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-indigo-300 bg-clip-text text-transparent">
              Toolkit
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium tracking-wide">
            Yüksek Kaliteli Medya &amp; Ses Aracı
          </p>
        </motion.div>

        {/* İlerleme Çubuğu */}
        <motion.div
          initial={{ opacity: 0, width: 60 }}
          animate={{ opacity: 1, width: 140 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8 h-1 bg-white/[0.08] rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-indigo rounded-full"
            style={{ width: `${progress}%` }}
          />
        </motion.div>

        <span className="font-mono text-[11px] text-zinc-500 mt-2.5">
          {progress}%
        </span>
      </div>
    </motion.div>
  );
}
