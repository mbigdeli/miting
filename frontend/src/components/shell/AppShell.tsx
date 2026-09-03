'use client';

/**
 * The app shell: left navigation rail + scrollable content pane. This is the
 * only shell — the legacy sidebar layout was removed when the redesign
 * graduated from the newAppShell beta flag.
 */

import SideNav from './SideNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 font-inter text-zinc-950 antialiased">
      <SideNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
