/**
 * Audio Routing Utilities for CineMate
 * 
 * Handles automatic, seamless routing of HTMLMediaElements (<video> and <audio>)
 * to connected headphones, Bluetooth headsets (AirPods, Galaxy Buds, etc.), and external output devices.
 * 
 * VLC & MX Player parity:
 * - Movies play as standard MEDIA (STREAM_MUSIC) with standard Media Volume controls (NOT phone call volume).
 * - Avoids forcing elements into Android's "communications" / earpiece telephony route.
 * - System default sink ("") is preserved for native OS Bluetooth A2DP automatic switching.
 * - Detects in-between Bluetooth/AirPods connections via proactive hardware polling & interaction hooks.
 */

export const HEADPHONE_KEYWORDS = [
  'headphone',
  'headset',
  'earphone',
  'earpod',
  'airpod',
  'airpods',
  'buds',
  'bluetooth',
  'wireless',
  'handsfree',
  'external',
  'tws',
  'beats',
  'bose',
  'sony',
  'galaxy',
  'pixel buds',
  'oneplus',
  'realme',
  'boat',
  'noise',
  'boult',
  'soundcore',
  'jbl',
  'sennheiser'
];

/**
 * Checks if a device label matches known headphone or Bluetooth characteristics.
 */
export function isHeadphoneLabel(label: string): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return HEADPHONE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Searches for the best audio output device ID matching headphones/Bluetooth,
 * strictly ignoring internal phone call sinks ("communications", "earpiece").
 * Falling back to the default output device ("").
 */
export async function findBestAudioOutputDeviceId(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return '';
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    if (!outputs.length) return '';

    // Search for an explicit output device matching headphone keywords
    // CRITICAL: Blacklist "communications", "earpiece", "telephony", and "speaker"
    const headphoneDevice = outputs.find(d => {
      const devId = (d.deviceId || '').toLowerCase();
      if (devId === 'communications' || devId === 'default' || devId === '') return false;

      const label = (d.label || '').toLowerCase().trim();
      if (!label) return false;
      if (
        label.includes('communications') ||
        label.includes('earpiece') ||
        label.includes('speaker') ||
        label.includes('telephony')
      ) {
        return false;
      }
      return isHeadphoneLabel(label);
    });

    if (headphoneDevice && headphoneDevice.deviceId) {
      console.log('[AudioRouting] Found explicit headphone output device:', headphoneDevice.label, headphoneDevice.deviceId);
      return headphoneDevice.deviceId;
    }

    // On mobile (Android/iOS), Bluetooth headphones (AirPods) are automatically handled
    // by the system default sink ("") as standard media (STREAM_MUSIC).
    // NEVER return "communications" or any non-default device that routes to phone call earpiece!
    return '';
  } catch (err) {
    console.warn('[AudioRouting] Failed to query audio devices:', err);
    return '';
  }
}

/**
 * Routes an HTMLMediaElement (<video> or <audio>) to the active headphone/Bluetooth output device.
 */
export async function routeMediaElementToHeadphones(element: HTMLMediaElement | null): Promise<void> {
  if (!element) return;

  // On browsers supporting setSinkId (Chrome, Edge, Opera, Android Chrome)
  if (typeof (element as any).setSinkId === 'function') {
    try {
      const bestSinkId = await findBestAudioOutputDeviceId();
      const currentSinkId = (element as any).sinkId ?? '';

      if (bestSinkId && bestSinkId !== '' && bestSinkId !== 'communications') {
        if (currentSinkId !== bestSinkId) {
          console.log(`[AudioRouting] Switching sinkId from "${currentSinkId}" to explicit headphone: "${bestSinkId}"`);
          await (element as any).setSinkId(bestSinkId);
        }
        return;
      }

      // If no explicit headphone device ID is reported (standard on Android Chrome & iOS Safari),
      // the system default sink ("") MUST be preserved.
      // System default ("") is what VLC, MX Player, and YouTube use to automatically route
      // audio to AirPods/Bluetooth and keep the volume on Media Volume (STREAM_MUSIC).
      // If sinkId was accidentally set to "communications" or anything non-empty, reset to ""!
      if (currentSinkId !== '') {
        console.log(`[AudioRouting] Resetting sinkId from "${currentSinkId}" to default media sink ("")`);
        await (element as any).setSinkId('');
      }
    } catch (err) {
      console.warn('[AudioRouting] Error routing media sink:', err);
    }
  }

  // Ensure playback continues uninterrupted
  if (element.paused === false) {
    element.play().catch(() => {});
  }
}

/**
 * Sets up listeners and proactive polling for hardware device changes, window focus,
 * visibility changes, and user taps, calling the provided callback whenever an audio
 * route change (such as connecting or disconnecting AirPods) might have occurred.
 */
export function setupAudioDeviceSync(callback: () => void | Promise<void>): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let isDestroyed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDeviceSignature = '';

  const trigger = () => {
    if (isDestroyed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isDestroyed) return;
      Promise.resolve(callback()).catch((err) => {
        console.warn('[AudioRouting] Sync callback failed:', err);
      });
    }, 200);
  };

  const checkDeviceSignature = async () => {
    if (isDestroyed || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audiooutput' || d.kind === 'audioinput');
      const signature = audioDevices
        .map(d => `${d.kind}:${d.deviceId}:${d.label}`)
        .sort()
        .join('|');

      if (lastDeviceSignature === '') {
        lastDeviceSignature = signature;
      } else if (signature !== lastDeviceSignature) {
        console.log('[AudioRouting] Audio device signature changed:', signature);
        lastDeviceSignature = signature;
        trigger();
      }
    } catch (_) {}
  };

  // Check initial state
  checkDeviceSignature();

  // 1. Hardware device change event (Fires on desktop, but often missed on mobile Bluetooth)
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', trigger);
  }

  // 2. Proactive device polling every 1500ms
  // Catches mobile Android Chrome & iOS Safari Bluetooth connect/disconnect
  const pollInterval = setInterval(() => {
    checkDeviceSignature();
  }, 1500);

  // 3. Tab focus & page visibility
  const handleFocus = () => {
    checkDeviceSignature();
    trigger();
  };
  window.addEventListener('focus', handleFocus);
  window.addEventListener('pageshow', handleFocus);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkDeviceSignature();
      trigger();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // 4. Touch & Pointer interaction listeners
  let lastTapTime = 0;
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapTime > 1500) {
      lastTapTime = now;
      checkDeviceSignature();
    }
  };
  window.addEventListener('touchstart', handleTap, { passive: true });
  window.addEventListener('pointerdown', handleTap, { passive: true });

  return () => {
    isDestroyed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(pollInterval);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', trigger);
    }
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('pageshow', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('touchstart', handleTap);
    window.removeEventListener('pointerdown', handleTap);
  };
}
