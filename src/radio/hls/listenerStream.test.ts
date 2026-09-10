import { describe, it, expect, vi } from 'vitest';
import { supportsNativeHls, attachHls, recoveryAction } from './listenerStream';

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
    const on = vi.fn();
    vi.doMock('hls.js', () => ({
      default: class {
        static isSupported() {
          return true;
        }
        // attachHls registers a fatal-error recovery handler, so the stub needs the event API.
        static Events = { ERROR: 'hlsError' };
        static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
        on = on;
        startLoad = vi.fn();
        recoverMediaError = vi.fn();
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
    // The recovery handler must be wired BEFORE loadSource, or an error during the very first
    // load is missed and the instance dies before anything is listening.
    expect(on).toHaveBeenCalledWith('hlsError', expect.any(Function));
    h.destroy();
    expect(destroy).toHaveBeenCalled();
    vi.doUnmock('hls.js');
  });
});

describe('recoveryAction', () => {
  it('ignores non-fatal errors, which hls.js handles by itself', () => {
    expect(recoveryAction(false, 'network', 99_999)).toBe('none');
  });

  it('reloads the stream after a fatal network error', () => {
    // This is the listener-dropped-their-wifi case: hls.js exhausts its retries, gives up, and
    // without this stays dead for the whole broadcast.
    expect(recoveryAction(true, 'network', 99_999)).toBe('startLoad');
  });

  it('recovers the decoder after a fatal media error', () => {
    expect(recoveryAction(true, 'media', 99_999)).toBe('recoverMedia');
  });

  it('throttles, so a stream that is really gone is not retried in a tight loop', () => {
    // Every listener would otherwise hammer R2 while the restreamer is off.
    expect(recoveryAction(true, 'network', 500)).toBe('none');
  });

  it('gives up on error types neither call can fix', () => {
    // The transport's stall detection then drops the listener back to WebRTC.
    expect(recoveryAction(true, 'other', 99_999)).toBe('none');
  });
});
