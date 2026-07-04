import { describe, it, expect, vi } from 'vitest';
import { supportsNativeHls, attachHls } from './listenerStream';

function fakeEl(canPlay: string): HTMLMediaElement {
  return {
    canPlayType: () => canPlay,
    src: '',
    removeAttribute(k: string) {
      if (k === 'src') (this as { src: string }).src = '';
    },
    load() {},
  } as unknown as HTMLMediaElement;
}

describe('supportsNativeHls', () => {
  it('true when canPlayType reports support', () => {
    expect(supportsNativeHls(fakeEl('maybe'))).toBe(true);
    expect(supportsNativeHls(fakeEl('probably'))).toBe(true);
  });
  it('false when canPlayType is empty (non-Safari)', () => {
    expect(supportsNativeHls(fakeEl(''))).toBe(false);
  });
});

describe('attachHls native (iOS) path', () => {
  it('sets src directly, no hls.js, and cleans up', async () => {
    const el = fakeEl('maybe');
    const h = await attachHls(el, 'https://cdn/x/stream.m3u8');
    expect(el.src).toBe('https://cdn/x/stream.m3u8');
    h.destroy();
    expect(el.src).toBe('');
  });
});

describe('attachHls hls.js (desktop) path', () => {
  it('loads via hls.js when native unsupported and destroys it', async () => {
    const loadSource = vi.fn();
    const attachMedia = vi.fn();
    const destroy = vi.fn();
    vi.doMock('hls.js', () => ({
      default: class {
        static isSupported() {
          return true;
        }
        loadSource = loadSource;
        attachMedia = attachMedia;
        destroy = destroy;
      },
    }));
    vi.resetModules();
    const { attachHls: fresh } = await import('./listenerStream');
    const el = fakeEl(''); // non-Safari
    const h = await fresh(el, 'https://cdn/y/stream.m3u8');
    expect(loadSource).toHaveBeenCalledWith('https://cdn/y/stream.m3u8');
    expect(attachMedia).toHaveBeenCalledWith(el);
    h.destroy();
    expect(destroy).toHaveBeenCalled();
    vi.doUnmock('hls.js');
  });
});
