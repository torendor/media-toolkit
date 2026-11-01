/**
 * useToast.js
 * Custom hook for managing toast notification state.
 * Supports success, error, warning, and info toast types.
 */

import { useState, useCallback, useRef } from 'react';

// Auto-incrementing ID for each toast
let toastIdCounter = 0;

/**
 * @typedef {Object} Toast
 * @property {number} id - Unique toast identifier
 * @property {'success' | 'error' | 'warning' | 'info'} type - Toast type
 * @property {string} message - Toast message text
 * @property {number} duration - Auto-dismiss duration in ms
 */

/**
 * Custom hook for toast notification management.
 * @returns {{ toasts: Toast[], addToast: Function, removeToast: Function }}
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  /**
   * Remove a toast by its ID and clear its auto-dismiss timer.
   * @param {number} id - Toast ID to remove
   */
  const removeToast = useCallback((id) => {
    // Clear the auto-dismiss timer if it exists
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Add a new toast notification.
   * @param {'success' | 'error' | 'warning' | 'info'} type - Toast type
   * @param {string} message - Message to display
   * @param {number} [duration=5000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @returns {number} The ID of the created toast
   */
  const addToast = useCallback(
    (type, message, duration = 5000) => {
      const id = ++toastIdCounter;

      const newToast = {
        id,
        type,
        message,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);

      // Set up auto-dismiss timer (unless duration is 0)
      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}
