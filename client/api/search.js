/**
 * GET /api/search?q=...&limit=...
 * Vercel Serverless Function to search videos and music.
 * Proxies to the active backend download server or queries fallback sources.
 */

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = (req.query?.q || '').trim();
  const limit = parseInt(req.query?.limit, 10) || 8;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Arama terimi zorunludur' });
  }

  const backendUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');

  // If a live download server is connected via tunnel, delegate search to yt-dlp
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const targetUrl = `${backendUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    } catch (err) {
      console.warn('[Vercel Search Proxy] Failed to reach backend:', err.message);
    }
  }

  // Fallback: Return empty results gracefully
  return res.status(200).json({
    success: true,
    query,
    count: 0,
    results: [],
    fallback: true,
  });
}
