/**
 * Audio Routing Utilities for CineMate
 * 
 * Handles automatic, seamless routing of HTMLMediaElements (<video> and <audio>)
 * to connected headphones, Bluetooth headsets (AirPods, Galaxy Buds, etc.), and external output devices.
 * 
 * Supports:
 * - Headphones connected BEFORE room creation / movie selection
 * - Headphones (Bluetooth or wired) connected AFTER room creation / mid-playback
 * - Automatic detection on mobile (Android Chrome & iOS Safari) where Bluetooth connects
 *   do NOT fire native 'devicechange' events (via proactive signature polling & gesture hooks)
 * - Headphone disconnect fallback to system default speaker without muting or freezing
 * - Window focus / tab visibility changes (e.g. returning after connecting Bluetooth in phone settings)
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
 * falling back to the default output device ("").
 */
export async function findBestAudioOutputDeviceId(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return '';
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    if (!outputs.length) return '';

    // 1. Look for device explicitly named with headphone or bluetooth keywords
    const headphoneDevice = outputs.find(d => {
      const label = (d.label || '').toLowerCase().trim();
      return label.length > 0 && isHeadphoneLabel(label);
    });

    if (headphoneDevice && headphoneDevice.deviceId) {
      return headphoneDevice.deviceId;
    }

    // 2. Check if an audioinput device matches Bluetooth/AirPods.
    // On many mobile browsers (especially Android Chrome), the Bluetooth headset is exposed
    // with its model name under audioinput while audiooutput only lists "default" or "communications".
    const hasHeadphoneInput = devices.some(d => {
      if (d.kind !== 'audioinput') return false;
      const label = (d.label || '').toLowerCase().trim();
      return label.length > 0 && isHeadphoneLabel(label);
    });

    if (hasHeadphoneInput) {
      // If there is an output device whose label is NOT internal speaker, prefer it
      const preferredOutput = outputs.find(d => {
        const label = (d.label || '').toLowerCase();
        return label && !label.includes('speaker') && !label.includes('internal') && !label.includes('built-in');
      });
      if (preferredOutput && preferredOutput.deviceId) {
        return preferredOutput.deviceId;
      }
    }

    // 3. Fall back to system default sink ("").
    // Operating systems (Android, iOS, Windows, macOS) automatically route system default 
    // to active wired/Bluetooth headphones. Never pick a random non-default ID,
    // which on mobile points to the internal phone earpiece!
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

  // On browsers supporting setSinkId (Chrome, Edge, Opera, newer Android Chrome)
  if (typeof (element as any).setSinkId === 'function') {
    try {
      const bestSinkId = await findBestAudioOutputDeviceId();
      const currentSinkId = (element as any).sinkId ?? '';

      if (bestSinkId && bestSinkId !== '') {
        if (currentSinkId !== bestSinkId) {
          console.log(`[AudioRouting] Switching sinkId from "${currentSinkId}" to: "${bestSinkId}"`);
          await (element as any).setSinkId(bestSinkId);
        }
        return;
      }

      // If bestSinkId is '' (system default):
      // On Chromium, if currentSinkId is ALREADY '', calling setSinkId('') is treated as a no-op,
      // which fails to re-latch to a newly connected Bluetooth headset on Android.
      // We force Chromium to re-initialize its AudioTrack by toggling sinkId if multiple outputs exist.
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const outputs = devices.filter(d => d.kind === 'audiooutput');

      if (currentSinkId !== '') {
        await (element as any).setSinkId('');
      } else if (outputs.length > 1) {
        const altSink = outputs.find(o => o.deviceId && o.deviceId !== '')?.deviceId;
        if (altSink) {
          try {
            await (element as any).setSinkId(altSink);
            await (element as any).setSinkId('');
          } catch (_) {
            await (element as any).setSinkId('');
          }
        }
      } else {
        await (element as any).setSinkId('');
      }
    } catch (err) {
      console.warn('[AudioRouting] Error routing media element sink:', err);
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

  // 2. Proactive device polling every 1200ms
  // Essential for mobile Android Chrome and iOS Safari where Bluetooth connects/disconnects
  // do NOT dispatch the 'devicechange' event!
  const pollInterval = setInterval(() => {
    checkDeviceSignature();
  }, 1200);

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

  // 4. Touch & Pointer interaction listeners (in case user opened AirPods case while looking at player)
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
