/**
 * SmartImage.jsx
 * Akıllı görsel bileşeni:
 * - Hızlı yükleme & fallback zinciri (Orijinal URL -> wsrv.nl proxy -> Degrade)
 * - Yavaş ağlarda veya engelli CDN'lerde asla boş kalmaz.
 */

import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import clsx from 'clsx';

const GRADIENTS = [
  'from-violet-900/40 via-purple-900/30 to-indigo-950/50',
  'from-indigo-900/40 via-blue-900/30 to-slate-950/50',
  'from-emerald-900/40 via-teal-900/30 to-zinc-950/50',
  'from-rose-900/40 via-pink-900/30 to-zinc-950/50',
  'from-amber-900/40 via-orange-900/30 to-zinc-950/50',
];

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function SmartImage({
  src,
  alt = '',
  seed,
  className,
  imgClassName,
  icon: Icon = Music,
  label,
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isFallback, setIsFallback] = useState(false);
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setIsFallback(false);
    setFailed(!src);
    setLoaded(false);
  }, [src]);

  const handleError = () => {
    // 1. Aşama: Eğer orijinal Spotify/YouTube görseli tarayıcıda engellendiyse (CORS/Adblock/ISP),
    // güvenilir ve hızlı küresel görsel proxy'si wsrv.nl ile bir kez daha dene
    if (!isFallback && currentSrc && !currentSrc.includes('wsrv.nl')) {
      setIsFallback(true);
      setCurrentSrc(`https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=300&output=webp`);
    } else {
      // 2. Aşama: İkisi de yüklenemezse şık degrade yedek göster
      setFailed(true);
    }
  };

  const gradient = GRADIENTS[hash(seed || alt || src || '') % GRADIENTS.length];
  const initials = (label || alt || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={clsx('relative overflow-hidden bg-ink-900', className)}>
      {/* Degrade Yedek Katmanı */}
      <div
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br transition-opacity duration-300',
          gradient,
          !failed && loaded ? 'opacity-0' : 'opacity-100',
          !failed && !loaded && 'animate-pulse'
        )}
        aria-hidden="true"
      >
        {failed &&
          (initials ? (
            <span className="text-base font-bold text-white/60 tracking-wider font-mono">
              {initials}
            </span>
          ) : (
            <Icon className="w-1/3 h-1/3 text-white/30" />
          ))}
      </div>

      {!failed && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={clsx(
            'relative w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName
          )}
        />
      )}
    </div>
  );
}
