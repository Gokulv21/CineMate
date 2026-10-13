/**
 * Centralized API & WebSocket Configuration
 * Automatically chooses local proxy in development/LAN, or Render backend in production.
 */

const isLocalHostname = (hostname: string): boolean => {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.endsWith('.local')
  );
};

const isLocal = typeof window !== 'undefined' && isLocalHostname(window.location.hostname);
const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (isLocal ? '' : 'https://cinemate-imf3.onrender.com');

export const WS_BASE_URL: string =
  import.meta.env.VITE_WS_URL ||
  (isLocal
    ? `${wsProtocol}//${window.location.host}/ws`
    : 'wss://cinemate-imf3.onrender.com/ws');

