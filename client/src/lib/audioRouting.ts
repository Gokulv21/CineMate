/**
 * Audio Routing Utilities for CineMate
 * 
 * Handles automatic, seamless routing of HTMLMediaElements (<video> and <audio>)
 * to connected headphones, Bluetooth headsets, and external output devices.
 * 
 * Supports:
 * - Headphones connected BEFORE room creation / movie selection
 * - Headphones (Bluetooth or wired) connected AFTER room creation / mid-playback
 * - Headphone disconnect fallback to system default speaker without muting
 * - Window focus / tab visibility changes (e.g. returning after connecting Bluetooth in phone settings)
 */

const HEADPHONE_KEYWORDS = [
  'headphone',
  'headset',
  'earphone',
  'earpod',
  'airpod',
  'buds',
  'bluetooth',
  'wireless',
  'handsfree',
  'external'
];

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
      const label = (d.label || '').toLowerCase();
      return HEADPHONE_KEYWORDS.some(keyword => label.includes(keyword));
    });

    if (headphoneDevice && headphoneDevice.deviceId) {
      return headphoneDevice.deviceId;
    }

    // 2. If multiple output devices exist and one is not 'default' and not built-in speaker
    const nonDefaultDevice = outputs.find(d => {
      const label = (d.label || '').toLowerCase();
      const isSpeaker = label.includes('speaker') || label.includes('internal') || label.includes('phone');
      return d.deviceId && d.deviceId !== 'default' && !isSpeaker;
    });

    if (nonDefaultDevice && nonDefaultDevice.deviceId) {
      return nonDefaultDevice.deviceId;
    }

    // 3. Fallback to system default sink ("")
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
      if (bestSinkId) {
        try {
          await (element as any).setSinkId(bestSinkId);
          return;
        } catch (specificErr) {
          console.warn('[AudioRouting] setSinkId for specific device failed, falling back to default:', specificErr);
        }
      }
      // Empty string routes to the current OS default (which automatically switches to headphones on Android/iOS/Windows)
      await (element as any).setSinkId('');
    } catch (err) {
      console.warn('[AudioRouting] Error routing media element sink:', err);
    }
  }
}

/**
 * Sets up listeners for hardware device changes, window focus, and tab visibility,
 * and calls the provided callback whenever an audio change might have occurred.
 */
export function setupAudioDeviceSync(callback: () => void | Promise<void>): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      Promise.resolve(callback()).catch(() => {});
    }, 250);
  };

  // 1. Hardware device change (wired headphones plugged/unplugged, Bluetooth connected/disconnected)
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', trigger);
  }

  // 2. Tab focus (user switches back after connecting Bluetooth in phone settings)
  window.addEventListener('focus', trigger);

  // 3. Page visibility change (switched back to CineMate browser tab)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      trigger();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', trigger);
    }
    window.removeEventListener('focus', trigger);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
