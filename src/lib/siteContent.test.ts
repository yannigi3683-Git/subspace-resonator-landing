import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGallery, sortReleasesByDate } from './siteContent';
import type { Release } from './siteContent';

describe('useGallery', () => {
  it('returns an array', () => {
    const { result } = renderHook(() => useGallery());
    expect(Array.isArray(result.current)).toBe(true);
  });

  it('each item has src and alt', () => {
    const { result } = renderHook(() => useGallery());
    result.current.forEach((img) => {
      expect(typeof img.src).toBe('string');
      expect(typeof img.alt).toBe('string');
      expect(img.alt.length).toBeGreaterThan(0);
    });
  });

  it('returns at least one image', () => {
    const { result } = renderHook(() => useGallery());
    expect(result.current.length).toBeGreaterThan(0);
  });
});

const r = (id: string, date: string): Release => ({
  id, date, title: id, kind: 'Single', label: 'L',
});

describe('sortReleasesByDate', () => {
  it('orders full dates newest-first', () => {
    const out = sortReleasesByDate([
      r('a', '2025-10-31'),
      r('c', '2024-01-01'),
      r('b', '2025-12-26'),
    ]);
    expect(out.map(x => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('treats a year-only date as the earliest point in that year', () => {
    const out = sortReleasesByDate([
      r('bareYear', '2026'),
      r('dated', '2026-01-09'),
    ]);
    expect(out.map(x => x.id)).toEqual(['dated', 'bareYear']);
  });

  it('orders across mixed full and year-only dates newest-first', () => {
    const out = sortReleasesByDate([
      r('y2026', '2026'),
      r('d2025dec', '2025-12-26'),
      r('y2025', '2025'),
      r('d2026jan', '2026-01-09'),
    ]);
    expect(out.map(x => x.id)).toEqual(['d2026jan', 'y2026', 'd2025dec', 'y2025']);
  });

  it('does not mutate the input array', () => {
    const input = [r('a', '2024'), r('b', '2025')];
    const snapshot = input.map(x => x.id);
    sortReleasesByDate(input);
    expect(input.map(x => x.id)).toEqual(snapshot);
  });
});
