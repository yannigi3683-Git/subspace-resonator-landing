// Read a queued file's length without playing it: a detached element that loads metadata
// only. Resolves 0 when the browser cannot read it (unsupported codec, broken file) and
// after PROBE_TIMEOUT_MS if it neither loads nor errors, so a stalled file can never leave
// a promise (and its element) pending for the whole session. The object URL belongs to
// LocalDeck, so it is never revoked here.
export const PROBE_TIMEOUT_MS = 10_000;

export function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    let timer: ReturnType<typeof setTimeout>;
    const settle = (secs: number) => {
      clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onerror = null;
      el.src = '';
      resolve(secs);
    };
    timer = setTimeout(() => settle(0), PROBE_TIMEOUT_MS);
    el.preload = 'metadata';
    el.onloadedmetadata = () => settle(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => settle(0);
    el.src = url;
  });
}
