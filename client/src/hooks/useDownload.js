/**
 * useDownload.js
 * Custom hook managing the entire download lifecycle:
 * - Starting downloads via API
 * - Connecting to SSE for real-time progress
 * - Tracking progress, speed, ETA, stage and a human-readable activity log
 * - Triggering browser file downloads
 * - Cancellation, retry and cleanup
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  startDownload as apiStartDownload,
  startBatchDownload,
  getDownloadUrl,
  cancelDownload as apiCancelDownload,
  getProgressUrl,
  getStreamUrl,
} from '../utils/api';
import { translateServerMessage } from '../utils/format';

// Download stages in order ('pending' and 'packaging' may also be sent by the server)
const STAGES = ['idle', 'downloading', 'converting', 'tagging', 'complete', 'error'];

/** How many consecutive SSE errors we tolerate (EventSource auto-reconnects) before failing. */
const MAX_SSE_ERRORS = 4;
const MAX_LOG_LINES = 40;

/**
 * @typedef {Object} DownloadState
 * @property {number} progress - Download progress 0-100
 * @property {string} speed - Download speed string (e.g., "2.5 MB/s")
 * @property {string} eta - Estimated time remaining (e.g., "00:32")
 * @property {string} stage - 'idle' | 'pending' | 'downloading' | 'converting' | 'tagging' | 'packaging' | 'complete' | 'error'
 * @property {boolean} isActive - Whether a download is in progress
 * @property {string | null} error - Error message if stage is 'error'
 * @property {string | null} fileUrl - URL to download the completed file
 * @property {string | null} downloadId - Current download job ID
 * @property {string | null} fileName - Name of the downloaded file
 * @property {string} message - Latest (translated) server message
 * @property {{id:number, text:string, at:number}[]} logs - Activity log
 */

const INITIAL_STATE = {
  progress: 0,
  speed: '',
  eta: '',
  stage: 'idle',
  isActive: false,
  error: null,
  fileUrl: null,
  downloadId: null,
  fileName: null,
  message: '',
  logs: [],
};

let logId = 0;

/** Append a log line; collapse consecutive lines of the same "kind" (digits stripped). */
function appendLog(logs, text) {
  if (!text) return logs;
  const last = logs[logs.length - 1];
  if (last && last.text === text) return logs;
  const kind = (t) => t.replace(/[\d.,%]+/g, '#');
  const entry = { id: ++logId, text, at: Date.now() };
  if (last && kind(last.text) === kind(text)) {
    return [...logs.slice(0, -1), entry];
  }
  return [...logs, entry].slice(-MAX_LOG_LINES);
}

function triggerBrowserDownload(url, fileName) {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'download');
    link.setAttribute('target', '_blank');
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.warn('Download trigger error:', err);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }
}

/**
 * Custom hook for download management with SSE progress tracking.
 * @param {Function} onToast - Callback to show toast notifications: (type, message) => void
 * @returns {object} Download state and control functions
 */
export function useDownload(onToast) {
  const [state, setState] = useState(INITIAL_STATE);
  const eventSourceRef = useRef(null);
  const lastRequestRef = useRef(null);
  const runIdRef = useRef(0); // invalidates late responses after cancel/reset

  /** Close any open SSE connection. */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const fail = useCallback(
    (message) => {
      setState((prev) => {
        if (prev.stage === 'complete') return prev;
        return {
          ...prev,
          stage: 'error',
          isActive: false,
          error: message,
          logs: appendLog(prev.logs, message),
        };
      });
      onToast?.('error', message);
    },
    [onToast]
  );

  /**
   * Connect to SSE endpoint for real-time progress updates.
   * @param {string} downloadId - The download job ID
   */
  const connectSSE = useCallback(
    (downloadId, runId) => {
      cleanup();

      const eventSource = new EventSource(getProgressUrl(downloadId));
      eventSourceRef.current = eventSource;
      let errorCount = 0;

      eventSource.onmessage = (event) => {
        if (runId !== runIdRef.current) return;
        errorCount = 0;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch (parseError) {
          console.error('Failed to parse SSE data:', parseError);
          return;
        }

        const text = translateServerMessage(data.message);

        if (data.stage === 'complete') {
          eventSource.close();
          eventSourceRef.current = null;
          const fileUrl = data.fileUrl || getDownloadUrl(downloadId);
          const fileName = data.fileName || null;

          setState((prev) => ({
            ...prev,
            progress: 100,
            stage: 'complete',
            isActive: false,
            speed: '',
            eta: '',
            fileUrl,
            fileName: fileName ?? prev.fileName,
            message: text || 'İndirme tamamlandı',
            logs: appendLog(prev.logs, text || 'İndirme tamamlandı'),
          }));

          // Automatically hand the file to the browser
          triggerBrowserDownload(fileUrl, fileName);
          onToast?.('success', 'İşlem tamamlandı. Dosyanız indiriliyor.');
          return;
        }

        if (data.stage === 'error') {
          eventSource.close();
          eventSourceRef.current = null;
          fail(data.error || text || 'İndirme başarısız oldu');
          return;
        }

        setState((prev) => ({
          ...prev,
          progress: typeof data.progress === 'number' ? Math.max(0, Math.min(100, data.progress)) : prev.progress,
          speed: data.speed ?? prev.speed,
          eta: data.eta ?? prev.eta,
          stage: data.stage ?? prev.stage,
          fileName: data.fileName ?? prev.fileName,
          message: text || prev.message,
          logs: appendLog(prev.logs, text),
        }));
      };

      eventSource.onerror = () => {
        if (runId !== runIdRef.current) {
          eventSource.close();
          return;
        }
        errorCount += 1;
        // CLOSED = the server rejected the stream (e.g. unknown id / 404) → no auto-reconnect.
        // Otherwise the browser will retry; give a flaky tunnel a few chances.
        if (eventSource.readyState === EventSource.CLOSED || errorCount >= MAX_SSE_ERRORS) {
          eventSource.close();
          if (eventSourceRef.current === eventSource) eventSourceRef.current = null;
          fail('Sunucu ile bağlantı kesildi. Lütfen tekrar deneyin.');
        }
      };
    },
    [cleanup, fail, onToast]
  );

  /** Shared starter for single + batch downloads. */
  const run = useCallback(
    async (kind, params) => {
      cleanup();
      const runId = ++runIdRef.current;
      lastRequestRef.current = { kind, params };

      setState({
        ...INITIAL_STATE,
        isActive: true,
        stage: 'pending',
        message: 'İndirme hazırlanıyor…',
        logs: appendLog([], 'İstek sunucuya gönderiliyor…'),
      });

      try {
        const result = kind === 'batch' ? await startBatchDownload(params) : await apiStartDownload(params);
        if (runId !== runIdRef.current) return; // cancelled meanwhile

        const downloadId = result?.downloadId;
        if (!downloadId) throw new Error('Sunucu geçersiz bir yanıt döndürdü');

        setState((prev) => ({
          ...prev,
          downloadId,
          stage: prev.stage === 'pending' ? 'downloading' : prev.stage,
          logs: appendLog(prev.logs, 'Sunucu isteği kabul etti'),
        }));
        connectSSE(downloadId, runId);

        onToast?.(
          'info',
          kind === 'batch'
            ? `Toplu indirme başlatıldı (${result.trackCount || params.trackIds?.length || 'tüm'} parça)`
            : 'İndirme başlatıldı'
        );
      } catch (error) {
        if (runId !== runIdRef.current) return;
        const message = error?.message || (kind === 'batch' ? 'Toplu indirme başlatılamadı' : 'İndirme başlatılamadı');
        setState({
          ...INITIAL_STATE,
          stage: 'error',
          error: message,
          offline: !!error?.offline,
          logs: appendLog([], message),
        });
        onToast?.('error', message);
      }
    },
    [cleanup, connectSSE, onToast]
  );

  /**
   * Start a new download.
   * @param {string} url - Media URL
   * @param {string} platform - 'youtube' | 'spotify'
   * @param {string} format - Output format
   * @param {string} quality - Quality setting
   * @param {object} [options] - Additional options
   */
  const startDownload = useCallback(
    (url, platform, format, quality, options = {}) => run('single', { url, platform, format, quality, options }),
    [run]
  );

  /**
   * Start a batch download (for playlists/albums).
   * @param {string[]} [trackIds] - Specific track IDs (empty = all)
   */
  const startBatch = useCallback(
    (url, platform, format, quality, trackIds = [], options = {}) =>
      run('batch', { url, platform, format, quality, trackIds, options }),
    [run]
  );

  /** Re-run the last request with identical parameters. */
  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;
    run(last.kind, last.params);
  }, [run]);

  /** Trigger browser download for the completed file (again). */
  const downloadFile = useCallback(() => {
    if (!state.downloadId) return;
    triggerBrowserDownload(getDownloadUrl(state.downloadId), state.fileName);
  }, [state.downloadId, state.fileName]);

  /** Cancel the current download. */
  const cancel = useCallback(async () => {
    const id = state.downloadId;
    runIdRef.current += 1;
    cleanup();
    setState(INITIAL_STATE);
    onToast?.('warning', 'İndirme iptal edildi');
    if (id) {
      try {
        await apiCancelDownload(id);
      } catch {
        // best effort
      }
    }
  }, [state.downloadId, cleanup, onToast]);

  /** Reset back to idle state. */
  const reset = useCallback(() => {
    runIdRef.current += 1;
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  /**
   * Client-side direct stream download (bypasses server download & bot IP restrictions).
   */
  const startDirectDownload = useCallback(
    async ({ url, format = 'video', quality = 'best' }) => {
      cleanup();
      const runId = ++runIdRef.current;
      lastRequestRef.current = { kind: 'direct', params: { url, format, quality } };

      setState({
        ...INITIAL_STATE,
        isActive: true,
        stage: 'downloading',
        message: 'Doğrudan akış bağlantısı alınıyor…',
        logs: appendLog([], 'İstemci taraflı doğrudan akış bağlantısı hazırlanıyor…'),
      });

      try {
        const res = await getStreamUrl({ url, format, quality });
        if (runId !== runIdRef.current) return;

        if (!res?.success || !res?.data?.streamUrl) {
          throw new Error(res?.error || 'Doğrudan akış bağlantısı alınamadı.');
        }

        const { streamUrl, fileName, title } = res.data;
        const finalName = fileName || `${title || 'media'}.${format === 'audio' ? 'm4a' : 'mp4'}`;

        setState((prev) => ({
          ...prev,
          progress: 100,
          stage: 'complete',
          isActive: false,
          fileUrl: streamUrl,
          fileName: finalName,
          message: 'Doğrudan akış bağlantısı hazır! İndirme başlatılıyor…',
          logs: appendLog(prev.logs, `Doğrudan bağlantı alındı: ${finalName}`),
        }));

        triggerBrowserDownload(streamUrl, finalName);
        onToast?.('success', 'Doğrudan akış indirmesi başlatıldı!');
      } catch (err) {
        if (runId !== runIdRef.current) return;
        const msg = err?.message || 'Doğrudan akış alınamadı.';
        setState({
          ...INITIAL_STATE,
          stage: 'error',
          error: msg,
          logs: appendLog([], msg),
        });
        onToast?.('error', msg);
      }
    },
    [cleanup, onToast]
  );

  return {
    ...state,
    canRetry: !!lastRequestRef.current,
    startDownload,
    startBatch,
    startDirectDownload,
    retry,
    downloadFile,
    cancel,
    reset,
    STAGES,
  };
}
