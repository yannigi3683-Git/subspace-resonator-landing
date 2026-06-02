import { describe, it, expect } from 'vitest';
import { useGallery } from './siteContent';

describe('useGallery', () => {
  it('returns an array', () => {
    const images = useGallery();
    expect(Array.isArray(images)).toBe(true);
  });

  it('each item has src and alt', () => {
    const images = useGallery();
    images.forEach((img, i) => {
      expect(typeof img.src).toBe('string');
      expect(img.alt).toBe(`Subspace Resonator — photo ${i + 1}`);
    });
  });

  it('items are sorted by filename', () => {
    const images = useGallery();
    for (let i = 1; i < images.length; i++) {
      expect(images[i - 1].alt.localeCompare(images[i].alt)).toBeLessThanOrEqual(0);
    }
  });
});
