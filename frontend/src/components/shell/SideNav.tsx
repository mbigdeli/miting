'use client';

/**
 * Redesign left navigation (mockups: Miting-Redesign, screens 2e–2w).
 * 236px white rail: brand header, Record / Meetings / Settings items,
 * collapsible to an icon rail. Assistant/Action-plan are out of scope.
 */

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { MdMenuOpen, MdMenu } from 'react-icons/md';
import AboutDialog from './AboutDialog';
import RecordingNavStatus from './RecordingNavStatus';
import { MitingLogoTile } from './MitingMark';
import { NAV_ITEMS, isActive } from './navItems';

export default function SideNav() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [version, setVersion] = useState('');
  // True only while the rail is collapsed *on the user's behalf* (settings
  // section opened) rather than by their own toggle — so we know whether a
  // nav click should restore the expanded state.
  const autoCollapsed = useRef(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  // Picking a settings section collapses the rail to give the page room —
  // but only if the user had it expanded (their own collapse is respected).
  useEffect(() => {
    const onSectionSelected = () => {
      setCollapsed((c) => {
        if (!c) autoCollapsed.current = true;
        return true;
      });
    };
    window.addEventListener('miting:settings-section-selected', onSectionSelected);
    return () => window.removeEventListener('miting:settings-section-selected', onSectionSelected);
  }, []);

  // Settings collapses the rail to give the section pane room; leaving it
  // restores the rail only when the collapse was ours (a user's own collapse
  // before opening Settings is respected and never auto-expanded).
  const handleNavClick = (href: string) => {
    if (href === '/settings') {
      setCollapsed((c) => {
        if (!c) autoCollapsed.current = true;
        return true;
      });
    } else if (autoCollapsed.current) {
      autoCollapsed.current = false;
      setCollapsed(false);
    }
    router.push(href);
  };

  const handleToggle = () => {
    autoCollapsed.current = false; // a manual toggle overrides any auto state
    setCollapsed((c) => !c);
  };

  return (
    <aside
      className={`${collapsed ? 'w-14' : 'w-[236px]'} flex h-screen shrink-0 flex-col gap-px border-r border-zinc-200 bg-white px-3 py-3.5 transition-[width]`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-4 pt-1.5">
        {!collapsed && (
          <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
            <MitingLogoTile size={26} radius={8} />
            Miting
          </div>
        )}
        <button
          type="button"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          onClick={handleToggle}
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[7px] border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700"
        >
          {collapsed ? <MdMenu size={16} /> : <MdMenuOpen size={16} />}
        </button>
      </div>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <button
            key={href}
            type="button"
            onClick={() => handleNavClick(href)}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
              active
                ? 'bg-zinc-100 font-medium text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
            }`}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && label}
          </button>
        );
      })}

      <div className="flex-1" />

      <RecordingNavStatus collapsed={collapsed} />
      <AboutDialog collapsed={collapsed} />
      {!collapsed && version && (
        <div className="px-2 pb-1 text-[11px] text-zinc-400">v{version}</div>
      )}
    </aside>
  );
}
