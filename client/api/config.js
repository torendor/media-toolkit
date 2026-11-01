/**
 * GET /api/config
 * Exposes the public URL of the download server (set by `start-public.bat`).
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const raw = (process.env.BACKEND_URL || process.env.VITE_API_URL || '').trim();
  const cleaned = raw.replace(/^["']+|["']+$/g, '').replace(/\/+$/, '') || null;
  res.status(200).json({
    backendUrl: cleaned,
  });
}

