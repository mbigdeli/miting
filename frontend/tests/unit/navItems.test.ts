import { describe, expect, test } from 'vitest';
import { isActive } from '@/components/shell/navItems';

describe('isActive', () => {
  test('record is active only on the exact root route', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/meetings', '/')).toBe(false);
    expect(isActive('/meeting-details', '/')).toBe(false);
  });

  test('meeting details highlights the Meetings item, not Record', () => {
    expect(isActive('/meeting-details', '/meetings')).toBe(true);
    expect(isActive('/meeting-details?id=meeting-123', '/meetings')).toBe(true);
    expect(isActive('/meeting-details', '/')).toBe(false);
    expect(isActive('/meeting-details', '/settings')).toBe(false);
  });

  test('plain routes match themselves and their subroutes', () => {
    expect(isActive('/meetings', '/meetings')).toBe(true);
    expect(isActive('/settings', '/settings')).toBe(true);
    expect(isActive('/settings/anything', '/settings')).toBe(true);
    expect(isActive('/settings', '/meetings')).toBe(false);
  });
});
