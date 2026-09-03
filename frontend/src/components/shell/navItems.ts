import {
  MdOutlineMic,
  MdFormatListBulleted,
  MdOutlineSettings,
} from 'react-icons/md';

/** Main navigation entries (Material icon set). Assistant is out of scope. */
export const NAV_ITEMS = [
  { href: '/', label: 'Record', icon: MdOutlineMic },
  { href: '/meetings', label: 'Mitings', icon: MdFormatListBulleted },
  { href: '/settings', label: 'Settings', icon: MdOutlineSettings },
] as const;

/** Route-aware highlight: meeting details belongs to the Meetings context. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/meetings' && pathname.startsWith('/meeting-details')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
