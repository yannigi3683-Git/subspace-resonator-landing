import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGallery } from './siteContent';

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
