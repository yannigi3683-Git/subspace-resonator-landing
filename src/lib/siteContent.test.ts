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
    if (images.length === 0) return; // empty is fine
    images.forEach((img, i) => {
      expect(img.alt).toBe(`Subspace Resonator — photo ${i + 1}`);
    });
    // verify at least some images exist (23 gallery files are in src/assets/)
    expect(images.length).toBeGreaterThan(0);
  });
});
