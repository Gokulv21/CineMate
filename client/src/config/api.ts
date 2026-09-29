/**
 * Centralized API & WebSocket Configuration
 * Automatically chooses local proxy in development, or Render backend in production.
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://cinemate-imf3.onrender.com');

export const WS_BASE_URL: string =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `ws://${window.location.host}/ws`
    : 'wss://cinemate-imf3.onrender.com/ws');
