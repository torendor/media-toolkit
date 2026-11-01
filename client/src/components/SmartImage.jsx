/**
 * SmartImage.jsx
 * <img> with lazy loading, fade-in, and a graceful gradient fallback when the
 * source is missing or fails to load (no more broken-image icons).
 */

import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import clsx from 'clsx';

const GRADIENTS = [
  'from-fuchsia-500/40 via-purple-600/30 to-indigo-700/40',
  'from-cyan-400/40 via-sky-600/30 to-blue-800/40',
  'from-amber-400/40 via-orange-500/30 to-rose-700/40',
  'from-emerald-400/40 via-teal-600/30 to-cyan-800/40',
  'from-pink-500/40 via-rose-500/30 to-red-700/40',
];

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function SmartImage({ src, alt = '', seed, className, imgClassName, icon: Icon = Music, label }) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(!src);
    setLoaded(false);
  }, [src]);

  const gradient = GRADIENTS[hash(seed || alt || src || '') % GRADIENTS.length];
  const initials = (label || alt || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={clsx('relative overflow-hidden', className)}>
      {/* Fallback / placeholder layer */}
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
            <span className="text-lg font-black text-white/70 tracking-wider">{initials}</span>
          ) : (
            <Icon className="w-1/3 h-1/3 text-white/50" />
          ))}
      </div>

      {!failed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={clsx(
            'relative w-full h-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName
          )}
        />
      )}
    </div>
  );
}

