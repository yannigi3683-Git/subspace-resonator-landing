import { describe, it, expect } from 'vitest';
import { useGallery } from './siteContent';

describe('useGallery', () => {
  it('returns an array', () => {
    const images = useGallery();
    expect(Array.isArray(images)).toBe(true);
  });

  it('each item has src and alt', () => {
    const images = useGallery();
    images.forEach((img) => {
      expect(typeof img.src).toBe('string');
      expect(typeof img.alt).toBe('string');
      expect(img.alt.length).toBeGreaterThan(0);
    });
  });

  it('returns at least one image', () => {
    const images = useGallery();
    expect(images.length).toBeGreaterThan(0);
  });
});
