# 🎵 Universal Media & Audio Toolkit

A modern, full-stack web application for downloading and converting media from YouTube and Spotify. Features a stunning dark-themed UI with glassmorphism effects, real-time progress tracking, and professional-grade audio processing.

![Platform](https://img.shields.io/badge/Platform-Web-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### YouTube Module
- 📹 Video download: 4K, 2K, 1080p60, 720p, 480p
- 🎵 Audio extraction: MP3, FLAC, WAV, M4A/AAC
- 📋 Playlist support with batch downloading
- 🎯 Format selection: MP4 (H.264/AAC), WebM
- ⚡ Bitrate control: 320/256/192/128 kbps CBR or VBR
- 🖼️ Auto-embed thumbnails as album art

### Spotify Module
- 🔍 Track, album, and playlist metadata resolution
- 🎨 High-res cover art extraction
- 🎯 Smart audio matching via YouTube search
- 🏷️ Full ID3v2.4 tagging (artist, album, track #, cover art)

### Audio Processing
- 📊 EBU R128 / ReplayGain normalization
- ✂️ Automatic silence trimming
- 🔄 Format conversion via FFmpeg
- 📝 Custom file naming templates

### UI/UX
- 🌙 Dark theme with glassmorphism design
- ✨ Neon accent colors and glow effects
- 🎬 Smooth Framer Motion animations
- 📱 Fully responsive (mobile + desktop)
- 📊 Real-time download progress via SSE
- 🔔 Toast notifications for status updates

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express.js |
| Media Processing | yt-dlp, FFmpeg |
| Music Metadata | Spotify Web API |
| Real-time | Server-Sent Events (SSE) |
| Packaging | Archiver (ZIP) |

## 📋 Prerequisites

Before running, ensure these are installed on your system:

1. **Node.js** (v18+): https://nodejs.org
2. **yt-dlp**: https://github.com/yt-dlp/yt-dlp
   ```bash
   # Windows (winget)
   winget install yt-dlp
   
   # Or pip
   pip install yt-dlp
   ```
3. **FFmpeg**: https://ffmpeg.org
   ```bash
   # Windows (winget)
   winget install FFmpeg
   
   # Or chocolatey
   choco install ffmpeg
   ```
4. **Spotify API Credentials** (for Spotify features):
   - Go to https://developer.spotify.com/dashboard
   - Create an app and get Client ID & Client Secret

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
# In the server directory
cp .env.example .env
# Edit .env with your Spotify API credentials
```

### 3. Run Development Servers

```bash
# Terminal 1 - Backend (port 3001)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
cd client
npm run dev
```

### 4. Open Browser

Navigate to `http://localhost:5173`

## 📁 Project Structure

```
media-toolkit/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # UI Components
│   │   │   ├── UrlInput.jsx       # Smart URL input with platform detection
│   │   │   ├── PreviewCard.jsx    # Media preview with skeleton loader
│   │   │   ├── DownloadOptions.jsx # Format/quality selection
│   │   │   ├── ProgressConsole.jsx # Real-time progress display
│   │   │   ├── SettingsModal.jsx   # Advanced settings
│   │   │   ├── PlaylistView.jsx   # Playlist track listing
│   │   │   └── Toast.jsx         # Notification system
│   │   ├── hooks/             # Custom React Hooks
│   │   │   ├── useDownload.js    # Download lifecycle management
│   │   │   └── useToast.js       # Toast state management
│   │   ├── utils/             # Utility Functions
│   │   │   ├── api.js            # Axios API client
│   │   │   └── formatDetector.js # URL pattern detection
│   │   ├── App.jsx            # Main application
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Global styles & Tailwind
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                    # Node.js Backend
│   ├── src/
│   │   ├── routes/            # API Routes
│   │   │   ├── analyze.js        # URL analysis endpoint
│   │   │   └── download.js       # Download & progress endpoints
│   │   ├── services/          # Business Logic
│   │   │   ├── youtubeService.js  # yt-dlp integration
│   │   │   ├── spotifyService.js  # Spotify API + audio matching
│   │   │   ├── ffmpegService.js   # FFmpeg processing pipeline
│   │   │   └── downloadManager.js # Download state tracking
│   │   ├── utils/             # Utilities
│   │   │   ├── urlParser.js      # URL detection & parsing
│   │   │   ├── fileNaming.js     # Dynamic file naming
│   │   │   └── cleanup.js        # Temp file management
│   │   └── index.js           # Express server entry
│   ├── downloads/             # Temp download directory
│   ├── .env.example
│   └── package.json
│
└── README.md
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `SPOTIFY_CLIENT_ID` | Spotify API Client ID | - |
| `SPOTIFY_CLIENT_SECRET` | Spotify API Client Secret | - |
| `DOWNLOAD_DIR` | Temporary download directory | `./downloads` |
| `MAX_CONCURRENT_DOWNLOADS` | Max parallel downloads | `3` |

### File Naming Templates

| Token | Description | Example |
|-------|-------------|---------|
| `{title}` | Track/video title | `Never Gonna Give You Up` |
| `{artist}` | Artist/channel name | `Rick Astley` |
| `{album}` | Album name | `Whenever You Need Somebody` |
| `{track_num}` | Track number | `01` |
| `{year}` | Release year | `1987` |
| `{ext}` | File extension | `mp3` |

**Example:** `{artist} - {title}.{ext}` → `Rick Astley - Never Gonna Give You Up.mp3`

## 📄 License

MIT License - feel free to use this project for personal use.

## ⚠️ Disclaimer

This tool is intended for downloading content you have the right to download. Please respect copyright laws and the terms of service of YouTube and Spotify. The developers are not responsible for any misuse of this software.

