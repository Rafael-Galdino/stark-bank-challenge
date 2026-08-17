import { describe, it, expect } from 'vitest';
import { buildCycleWindowId } from '../../../src/domain/value-objects/cycle-window-vo';

describe('buildCycleWindowId', () => {
  it('00:00 BRT -> bucket 0', () => {
    // 2024-01-15 00:00 BRT = 2024-01-15T03:00:00Z
    const date = new Date('2024-01-15T03:00:00Z');
    expect(buildCycleWindowId(date, 180)).toBe('cycle-2024-01-15-0');
  });
  it('02:59 BRT -> bucket 0', () => {
    const date = new Date('2024-01-15T05:59:00Z');
    expect(buildCycleWindowId(date, 180)).toBe('cycle-2024-01-15-0');
  });
  it('03:00 BRT -> bucket 1', () => {
    const date = new Date('2024-01-15T06:00:00Z');
    expect(buildCycleWindowId(date, 180)).toBe('cycle-2024-01-15-1');
  });
  it('21:00 BRT -> bucket 7', () => {
    const date = new Date('2024-01-16T00:00:00Z');
    expect(buildCycleWindowId(date, 180)).toBe('cycle-2024-01-15-7');
  });
  it('usa 180 minutos como default quando cycleMinutes nao e informado', () => {
    const date = new Date('2024-01-15T06:00:00Z'); // 03:00 BRT
    expect(buildCycleWindowId(date)).toBe('cycle-2024-01-15-1');
  });
});
