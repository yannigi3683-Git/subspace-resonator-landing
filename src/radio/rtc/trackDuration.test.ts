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
    removeAttribute: vi.fn(function (this: { src: string }, name: string) {
      if (name === 'src') this.src = '';
    }),
    load: vi.fn(),
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
    expect(el.onloadedmetadata).toBeNull();
    // Detached with removeAttribute + load(). Assigning `el.src = ''` instead would resolve the
    // empty string against the document URL and send the element off to fetch the page HTML as
    // media, once per probed file.
    expect(el.removeAttribute).toHaveBeenCalledWith('src');
    expect(el.load).toHaveBeenCalled();
    expect(el.src).toBe('');
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
