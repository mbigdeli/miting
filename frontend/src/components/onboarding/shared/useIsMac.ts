import { useEffect, useState } from 'react';

/**
 * Detects whether the app is running on macOS.
 * Used for platform gating (the permissions step is macOS-only).
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkPlatform = async () => {
      try {
        // Dynamic import to avoid SSR issues if any
        const { platform } = await import('@tauri-apps/plugin-os');
        if (!cancelled) setIsMac(platform() === 'macos');
      } catch (e) {
        console.error('Failed to detect platform:', e);
        if (!cancelled) setIsMac(navigator.userAgent.includes('Mac'));
      }
    };

    checkPlatform();
    return () => {
      cancelled = true;
    };
  }, []);

  return isMac;
}
