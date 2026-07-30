import { useEffect, useRef, useState } from 'react';
import { emptyMemo, nextProbeState, type DeepBufferState, type ProbeMemo } from '../hls/deepBufferProbe';

const PROBE_MS = 10000;

// Tells the host whether listeners are actually getting the deep-buffer HLS stream. Polls the
// playlist index only (a few hundred bytes) — never plays it, so the console makes no sound and
// pulls no audio bandwidth. Inert when off air or when no streamUrl is advertised: no fetch at all.
export function useDeepBufferStatus(streamUrl: string | undefined, active: boolean): DeepBufferState {
  const [state, setState] = useState<DeepBufferState>('off');
  const memoRef = useRef<ProbeMemo>(emptyMemo());

  useEffect(() => {
    if (!streamUrl || !active) {
      memoRef.current = emptyMemo();
      setState('off');
      return;
    }

    let cancelled = false;
    memoRef.current = emptyMemo();

    const probe = async () => {
      let body: string | null = null;
      try {
        const res = await fetch(streamUrl, { cache: 'no-store' });
        body = res.ok ? await res.text() : null;
      } catch {
        body = null; // network/CORS failure counts as "no change", not as an error state
      }
      if (cancelled) return;
      const next = nextProbeState(memoRef.current, body, Date.now());
      memoRef.current = next.memo;
      setState(next.state);
    };

    void probe();
    const id = setInterval(probe, PROBE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [streamUrl, active]);

  return state;
}
