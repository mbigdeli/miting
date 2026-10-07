import { describe, expect, it } from 'vitest';
import { formatEngineSize } from '@/lib/modelSize';

describe('formatEngineSize', () => {
  it('prints the catalog size exactly as Settings does', () => {
    expect(formatEngineSize(670)).toBe('670 MB');
    expect(formatEngineSize(1549)).toBe('1549 MB');
    expect(formatEngineSize(458)).toBe('458 MB');
  });
});
