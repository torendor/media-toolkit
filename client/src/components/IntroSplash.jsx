/**
 * IntroSplash.jsx
 * Premium cinematic intro animation on first site entrance:
 * - Glowing cyberpunk neon logo with pulsing aura
 * - Futuristic soundwave equalizer animation
 * - Gradient typography with light-sweep shimmer
 * - Smooth fade & scale exit via Framer Motion
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles } from 'lucide-react';

export default function IntroSplash({ onFinish }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth progress simulation over 1.2 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 45);

    const timer = setTimeout(() => {
      onFinish?.();
    }, 1450);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)', transition: { duration: 0.6, ease: 'easeInOut' } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-900 overflow-hidden select-none"
    >
      {/* Background ambient glowing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-neon-cyan/20 via-neon-purple/20 to-neon-pink/20 blur-[120px]"
        />
      </div>

      {/* Center glowing logo */}
      <div className="relative flex flex-col items-center z-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 200, damping: 20 }}
          className="relative mb-6"
        >
          {/* Animated pulsing outer ring */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: 360 }}
            transition={{ scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 8, repeat: Infinity, ease: 'linear' } }}
            className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink opacity-40 blur-md"
          />

          {/* Logo icon box */}
          <div className="relative w-20 h-20 rounded-2xl bg-dark-800/90 border border-white/20 shadow-[0_0_40px_rgba(0,240,255,0.3)] flex items-center justify-center backdrop-blur-xl">
            <Zap className="w-10 h-10 text-neon-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]" />
          </div>
        </motion.div>

        {/* Title with letter animation */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Media <span className="gradient-text font-black">Toolkit</span>
          </h1>
          <p className="text-xs sm:text-sm text-white/40 font-medium tracking-widest uppercase">
            Universal Media & Audio Platform
          </p>
        </motion.div>

        {/* Audio Equalizer Soundwave Bar animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-1.5 h-8 my-6"
        >
          {[40, 75, 100, 60, 90, 45, 80, 50, 95, 65, 35].map((height, idx) => (
            <motion.span
              key={idx}
              animate={{
                height: [`${height * 0.2}%`, `${height}%`, `${height * 0.3}%`],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
                delay: idx * 0.07,
              }}
              className="w-1 rounded-full bg-gradient-to-t from-neon-cyan to-neon-purple shadow-[0_0_8px_rgba(0,240,255,0.4)]"
            />
          ))}
        </motion.div>

        {/* Futuristic loading progress */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: '12rem' }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative h-1 rounded-full bg-white/10 overflow-hidden"
        >
          <motion.div
            style={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink rounded-full transition-all duration-100 ease-out shadow-[0_0_12px_rgba(0,240,255,0.8)]"
          />
        </motion.div>

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11px] font-mono text-white/30 mt-2.5 tracking-wider"
        >
          Sistem başlatılıyor... %{Math.min(progress, 100)}
        </motion.span>
      </div>
    </motion.div>
  );
}

