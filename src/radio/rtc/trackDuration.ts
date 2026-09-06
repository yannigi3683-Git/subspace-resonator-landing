// Read a queued file's length without playing it: a detached element that loads metadata
// only. Resolves 0 when the browser cannot read it (unsupported codec, broken file).
// The object URL belongs to LocalDeck, so it is never revoked here.
export function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => resolve(0);
    el.src = url;
  });
}
