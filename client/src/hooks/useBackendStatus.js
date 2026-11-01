/**
 * useBackendStatus.js
 * Polls the download server health endpoint and exposes its status.
 *
 * - Online  → light polling (45s), cached backend URL.
 * - Offline → aggressive polling (6s) that *forces* /api/config re-resolution,
 *   because the public tunnel URL can change whenever the server restarts.
 * - Pauses while the tab is hidden; re-checks immediately when it becomes
 *   visible again or the window regains focus.
 * - Background polls never flip the UI to "checking" (no flicker); only the
 *   very first check and explicit user re-checks do.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkBackend } from '../utils/api';

const POLL_ONLINE_MS = 45000;
const POLL_OFFLINE_MS = 6000;

export function useBackendStatus() {
  const [status, setStatus] = useState({ state: 'checking', url: null, checkedAt: null });
  const timer = useRef(null);
  const inflight = useRef(null);
  const onlineRef = useRef(false);
  const mounted = useRef(true);

  const schedule = useCallback((fn) => {
    clearTimeout(timer.current);
    if (typeof document !== 'undefined' && document.hidden) return; // resumed on visibilitychange
    timer.current = setTimeout(fn, onlineRef.current ? POLL_ONLINE_MS : POLL_OFFLINE_MS);
  }, []);

  /**
   * Run a health check.
   * @param {{force?: boolean, silent?: boolean}} opts
   * @returns {Promise<boolean>} whether the server is online
   */
  const check = useCallback(
    ({ force = false, silent = false } = {}) => {
      if (inflight.current) return inflight.current;
      clearTimeout(timer.current);

      if (!silent) {
        setStatus((s) => (s.state === 'online' ? s : { ...s, state: 'checking' }));
      }

      const run = (async () => {
        let result = { online: false, url: null };
        try {
          result = await checkBackend({ force });
        } catch {}
        if (!mounted.current) return result.online;

        onlineRef.current = result.online;
        setStatus({ state: result.online ? 'online' : 'offline', url: result.url, checkedAt: Date.now() });
        // Offline polls always force re-resolution of the tunnel URL.
        schedule(() => check({ force: !onlineRef.current, silent: true }));
        return result.online;
      })();

      inflight.current = run;
      run.finally(() => {
        if (inflight.current === run) inflight.current = null;
      });
      return run;
    },
    [schedule]
  );

  useEffect(() => {
    mounted.current = true;
    check();

    const onFocus = () => {
      if (!onlineRef.current) check({ force: true, silent: true });
    };
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer.current);
      else check({ force: !onlineRef.current, silent: true });
    };
    const onOnline = () => check({ force: true, silent: true });

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check]);

  /** User-initiated re-check (shows "Bağlanıyor…"). */
  const recheck = useCallback(() => check({ force: true }), [check]);

  /**
   * Make sure the server is reachable right before an action (e.g. download).
   * Returns immediately when already online; otherwise does one forced check.
   */
  const ensureOnline = useCallback(async () => {
    if (onlineRef.current) return true;
    return check({ force: true });
  }, [check]);

  return {
    ...status,
    isOnline: status.state === 'online',
    recheck,
    ensureOnline,
  };
}
