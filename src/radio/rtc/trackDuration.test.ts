import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeDuration, PROBE_TIMEOUT_MS } from './trackDuration';

// jsdom never loads media, so the probe element is stubbed and its handlers fired by hand.
function stubAudioElement() {
  const el = {
    preload: '',
    src: '',
    duration: NaN,
    onloadedmetadata: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  vi.spyOn(document, 'createElement').mockReturnValue(el as unknown as HTMLElement);
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('probeDuration', () => {
  it('resolves the length once metadata loads, and releases the element', async () => {
    const el = stubAudioElement();
    const p = probeDuration('blob:one');
    expect(el.src).toBe('blob:one');
    el.duration = 185;
    el.onloadedmetadata!();

    await expect(p).resolves.toBe(185);
    expect(el.src).toBe('');
    expect(el.onloadedmetadata).toBeNull();
  });

  it('resolves 0 when the file cannot be read', async () => {
    const el = stubAudioElement();
    const p = probeDuration('blob:broken');
    el.onerror!();
    await expect(p).resolves.toBe(0);
  });

  it('resolves 0 for a duration the browser reports as non-finite', async () => {
    const el = stubAudioElement();
    const p = probeDuration('blob:stream');
    el.duration = Infinity;
    el.onloadedmetadata!();
    await expect(p).resolves.toBe(0);
  });

  it('gives up rather than hanging when the file never loads or errors', async () => {
    vi.useFakeTimers();
    stubAudioElement();
    const p = probeDuration('blob:stalled');
    vi.advanceTimersByTime(PROBE_TIMEOUT_MS);
    await expect(p).resolves.toBe(0);
  });
});
