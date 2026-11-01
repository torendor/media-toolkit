/**
 * GET /api/config
 * Exposes the active backend URLs with smart failover:
 *  - localTunnelUrl: User's PC tunnel (fastest, clean residential IP)
 *  - cloudBackendUrl: 24/7 Cloud server (Render/Railway) for when PC is off
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const localTunnel = (process.env.BACKEND_URL || '').replace(/^["']+|["']+$/g, '').replace(/\/+$/, '') || null;
  const cloudBackend = (process.env.CLOUD_BACKEND_URL || 'https://media-toolkit-server.onrender.com').replace(/^["']+|["']+$/g, '').replace(/\/+$/, '');

  res.status(200).json({
    backendUrl: localTunnel || cloudBackend,
    localTunnelUrl: localTunnel,
    cloudBackendUrl: cloudBackend,
  });
}
