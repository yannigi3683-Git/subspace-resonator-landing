import { describe, it, expect } from 'vitest';
import { pictureToBlob } from './artwork';

describe('pictureToBlob', () => {
  it('wraps Uint8Array picture data with its declared format', () => {
    const blob = pictureToBlob({ data: new Uint8Array([1, 2, 3, 4]), format: 'image/png' });
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(4);
  });

  it('accepts plain number[] data and defaults the type to jpeg', () => {
    const blob = pictureToBlob({ data: [1, 2, 3] });
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(3);
  });
});
