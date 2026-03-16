import { describe, expect, it, vi } from 'vitest';
import { formatExpiryTime, formatRelativeTime } from './time';

describe('time helpers', () => {
  it('formats recent relative time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'));
    expect(formatRelativeTime('2026-03-16T11:55:00Z')).toBe('5M AGO');
    vi.useRealTimers();
  });

  it('formats lowercase relative time when requested', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'));
    expect(formatRelativeTime('2026-03-16T11:00:00Z', { uppercase: false })).toBe('1h ago');
    vi.useRealTimers();
  });

  it('formats expiry state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'));
    expect(formatExpiryTime('2026-03-16T12:30:00Z')).toBe('30M LEFT');
    expect(formatExpiryTime('2026-03-16T11:30:00Z')).toBe('EXPIRED');
    vi.useRealTimers();
  });
});
