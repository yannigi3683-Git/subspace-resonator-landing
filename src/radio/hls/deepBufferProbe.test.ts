import { describe, it, expect } from 'vitest';
import { emptyMemo, nextProbeState, STALL_MS } from './deepBufferProbe';

// Walk a sequence of [body, elapsedMs] steps through the reducer and return the final state.
function run(steps: Array<[string | null, number]>) {
  let memo = emptyMemo();
  let state = 'off' as ReturnType<typeof nextProbeState>['state'];
  let now = 1000;
  for (const [body, dt] of steps) {
    now += dt;
    ({ memo, state } = nextProbeState(memo, body, now));
  }
  return state;
}

describe('nextProbeState', () => {
  it('reports STARTING on the first successful fetch', () => {
    expect(run([['#EXTM3U\nseq1', 0]])).toBe('starting');
  });

  it('stays STARTING while the playlist has not changed yet', () => {
    expect(run([['a', 0], ['a', 4000], ['a', 4000]])).toBe('starting');
  });

  it('goes ON once the playlist changes', () => {
    expect(run([['a', 0], ['b', 4000]])).toBe('on');
  });

  it('stays ON while the playlist keeps changing', () => {
    expect(run([['a', 0], ['b', 4000], ['c', 4000], ['d', 4000]])).toBe('on');
  });

  it('goes STALLED when the playlist freezes past the threshold', () => {
    expect(run([['a', 0], ['b', 4000], ['b', STALL_MS]])).toBe('stalled');
  });

  it('goes STALLED even if it never left STARTING', () => {
    expect(run([['a', 0], ['a', STALL_MS]])).toBe('stalled');
  });

  it('does not flip on a single failed fetch', () => {
    expect(run([['a', 0], ['b', 4000], [null, 4000]])).toBe('on');
  });

  it('treats a run of failed fetches like a freeze', () => {
    expect(run([['a', 0], ['b', 4000], [null, 8000], [null, 8000]])).toBe('stalled');
  });

  it('recovers to ON when the playlist starts moving again', () => {
    expect(run([['a', 0], ['b', 4000], ['b', STALL_MS], ['c', 4000]])).toBe('on');
  });

  it('is stable across an identical body seen at the same instant', () => {
    expect(run([['a', 0], ['a', 0]])).toBe('starting');
  });
});
