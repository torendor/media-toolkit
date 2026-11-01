/**
 * Brand.jsx
 * Logo mark + platform glyphs (YouTube / Spotify) as lightweight inline SVGs.
 */

import React from 'react';
import clsx from 'clsx';

/** Media Toolkit logo mark: waveform bars + download chevron. */
export function LogoMark({ className }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={clsx('h-8 w-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-g)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke={`url(#${id}-s)`} />
      <path d="M10.5 10v6M16 7.5v11M21.5 10v6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10.5 21.5 16 25l5.5-3.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }) {
  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark className="h-7 w-7" />
      <span className="text-[15px] font-semibold tracking-tight text-zinc-50">
        Media<span className="text-zinc-400">Toolkit</span>
      </span>
    </span>
  );
}

export function YouTubeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('h-4 w-4', className)} aria-hidden="true">
      <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#FF0033" />
      <path d="M10 9.2v5.6l4.8-2.8L10 9.2Z" fill="#fff" />
    </svg>
  );
}

export function SpotifyIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('h-4 w-4', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#1ED760" />
      <path
        d="M7 9.4c3.4-1 7.3-.7 10.2 1M7.6 12.5c2.8-.8 5.9-.5 8.3.9M8.2 15.4c2.2-.6 4.5-.4 6.4.7"
        stroke="#000"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function PlatformIcon({ platform, className }) {
  if (platform === 'spotify') return <SpotifyIcon className={className} />;
  if (platform === 'youtube') return <YouTubeIcon className={className} />;
  return null;
}

export const PLATFORM_LABEL = { youtube: 'YouTube', spotify: 'Spotify' };
