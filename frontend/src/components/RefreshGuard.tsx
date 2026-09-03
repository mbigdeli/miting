'use client';

/**
 * Swallows the browser reload shortcuts inside the desktop app.
 *
 * The webview treats F5 / Ctrl+R like any browser: a full page reload. In a
 * desktop app that reload throws away the live recording screen mid-meeting
 * and greets the user with the session-recovery dialog — a habit keystroke
 * turned into an incident. There is nothing in this app a reload fixes, so
 * the shortcuts are simply inert in production. Dev keeps them: reloading is
 * how the dev loop works.
 */

import { useEffect } from 'react';

export function RefreshGuard(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const reload =
        key === 'f5' || ((e.ctrlKey || e.metaKey) && key === 'r');
      if (reload) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
  return null;
}
