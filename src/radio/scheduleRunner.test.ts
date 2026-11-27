import { describe, it, expect } from 'vitest';
import {
  initialRunner, stepRunner, nextRunnerShow,
  PREFLIGHT_LEAD_MS, START_LEAD_MS, RETRY_MS, MISS_AFTER_MS, END_DELAY_MS, HARD_END_MARGIN_MS, SHOW_GAP_MS,
  type RunnerCtx, type RunnerEvent, type RunnerState, type RunnerAction, type RunnerShow,
} from './scheduleRunner';

const MIN = 60_000;
const T = Date.UTC(2026, 11, 5, 20, 0); // a show at 22:00 Israel
const iso = (ms: number) => new Date(ms).toISOString();
const show = (id: string, ms: number, extra: Partial<RunnerShow> = {}): RunnerShow => ({ id, title: `Show ${id}`, starts_at: iso(ms), ...extra });
const files = (count: number, minutes: number) => ({ count, totalMs: minutes * MIN });

const OFF = { mode: 'off' as const, broadcastId: null };
const liveAs = (id: string) => ({ mode: 'live' as const, broadcastId: id });

function ctx(over: Partial<RunnerCtx> = {}): RunnerCtx {
  return {
    now: T - 3 * 60 * MIN,
    shows: [show('a', T)],
    files: { a: files(3, 40) },
    station: OFF,
    connection: 'idle',
    pausedMs: 0,
    ...over,
  };
}

// Drives the machine like the hook will: one event at a time, collecting every action.
function drive(steps: Array<[RunnerEvent, Partial<RunnerCtx>]>, start: RunnerState = initialRunner()) {
  let state = start;
  const actions: RunnerAction[] = [];
  for (const [event, over] of steps) {
    const out = stepRunner(state, event, ctx(over));
    state = out.state;
    actions.push(...out.actions);
  }
  return { state, actions };
}

const tick = (now: number, over: Partial<RunnerCtx> = {}): [RunnerEvent, Partial<RunnerCtx>] => [{ type: 'tick' }, { now, ...over }];
const types = (a: RunnerAction[]) => a.map((x) => x.type);
const last = (a: RunnerAction[]) => a[a.length - 1];

// An armed runner that has passed preflight, gone live as broadcast B1 and started the deck at T.
function onAir() {
  return drive([
    [{ type: 'arm' }, { now: T - 60 * MIN }],
    tick(T - PREFLIGHT_LEAD_MS),
    [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
    tick(T - START_LEAD_MS),
    [{ type: 'goLiveResult', ok: true, broadcastId: 'B1' }, { now: T - START_LEAD_MS + 2000, station: liveAs('B1'), connection: 'live' }],
    tick(T, { station: liveAs('B1'), connection: 'live' }),
  ]);
}

describe('scheduleRunner: the normal show', () => {
  it('does nothing until armed', () => {
    const { state, actions } = drive([tick(T - START_LEAD_MS)]);
    expect(state.phase).toBe('off');
    expect(actions).toEqual([]);
  });

  it('runs preflight 10 minutes before the start', () => {
    const { state, actions } = drive([[{ type: 'arm' }, {}], tick(T - PREFLIGHT_LEAD_MS - 1000), tick(T - PREFLIGHT_LEAD_MS)]);
    expect(actions).toEqual([{ type: 'preflight', showId: 'a' }]);
    expect(state.phase).toBe('preflight');
  });

  it('goes live 45 s early with an empty deck, the show title, the neon mode and "only if off air"', () => {
    const { state, actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS),
    ]);
    expect(actions[1]).toEqual({ type: 'goLive', showId: 'a', title: 'Show a', neonMode: 'tracks', expect: 'off' });
    expect(state.phase).toBe('starting');
  });

  it('passes a SHOW TITLE neon choice through', () => {
    const { actions } = drive([
      [{ type: 'arm' }, { shows: [show('a', T, { neon_mode: 'title' })] }],
      tick(T - PREFLIGHT_LEAD_MS, { shows: [show('a', T, { neon_mode: 'title' })] }),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS, { shows: [show('a', T, { neon_mode: 'title' })] }),
    ]);
    expect(actions.find((a) => a.type === 'goLive')).toMatchObject({ neonMode: 'title' });
  });

  it('loads and plays the files at T, not before', () => {
    const before = drive([
      [{ type: 'arm' }, { now: T - 60 * MIN }],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS),
      [{ type: 'goLiveResult', ok: true, broadcastId: 'B1' }, { now: T - 40_000, station: liveAs('B1'), connection: 'live' }],
      tick(T - 1000, { station: liveAs('B1'), connection: 'live' }),
    ]);
    expect(types(before.actions)).not.toContain('loadAndPlay');
    expect(before.state.phase).toBe('on_air');
    const { state, actions } = onAir();
    expect(last(actions)).toEqual({ type: 'loadAndPlay', showId: 'a' });
    expect(state.ownBroadcast).toBe('B1');
  });

  it('ends 30 s after the last file finishes, only if it is still its own broadcast', () => {
    const live = { station: liveAs('B1'), connection: 'live' as const };
    const { state, actions } = drive([
      [{ type: 'queueFinished' }, { now: T + 40 * MIN, ...live }],
      tick(T + 40 * MIN + END_DELAY_MS - 1000, live),
      tick(T + 40 * MIN + END_DELAY_MS, live),
    ], onAir().state);
    expect(actions).toEqual([{ type: 'end', expect: 'B1' }]);
    expect(state.phase).toBe('ending');
  });

  it('marks the show ended and re-arms once the station is off', () => {
    const live = { station: liveAs('B1'), connection: 'live' as const };
    const { state } = drive([
      [{ type: 'queueFinished' }, { now: T + 40 * MIN, ...live }],
      tick(T + 40 * MIN + END_DELAY_MS, live),
      tick(T + 41 * MIN, { station: OFF }),
    ], onAir().state);
    expect(state.phase).toBe('armed');
    expect(state.outcomes.a).toBe('ended');
    expect(state.lastEndAt).toBe(T + 41 * MIN);
  });

  it('repeats the END if the station still holds its broadcast 30 s later', () => {
    const live = { station: liveAs('B1'), connection: 'live' as const };
    const { actions } = drive([
      [{ type: 'queueFinished' }, { now: T + 40 * MIN, ...live }],
      tick(T + 40 * MIN + END_DELAY_MS, live),
      tick(T + 40 * MIN + END_DELAY_MS + RETRY_MS, live),
    ], onAir().state);
    expect(types(actions)).toEqual(['end', 'end']);
  });

  it('has a hard END at start + total length + time paused + 2 min, whatever the deck reports', () => {
    const live = { station: liveAs('B1'), connection: 'live' as const };
    const hard = T + 40 * MIN + 5 * MIN + HARD_END_MARGIN_MS;
    const early = drive([tick(hard - 1000, { ...live, pausedMs: 5 * MIN })], onAir().state);
    expect(early.actions).toEqual([]);
    const late = drive([tick(hard, { ...live, pausedMs: 5 * MIN })], onAir().state);
    expect(late.actions).toEqual([{ type: 'end', expect: 'B1' }]);
  });
});

describe('scheduleRunner: failures before the start', () => {
  it('retries a failed preflight every 30 s', () => {
    const { actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: false, reason: 'files' }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - PREFLIGHT_LEAD_MS + RETRY_MS - 1000),
      tick(T - PREFLIGHT_LEAD_MS + RETRY_MS),
    ]);
    expect(types(actions)).toEqual(['preflight', 'preflight']);
  });

  it('never goes live on a failed preflight, and reports why', () => {
    const { state, actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: false, reason: 'Files missing: b.mp3' }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS),
    ]);
    expect(types(actions)).not.toContain('goLive');
    expect(state.failure).toBe('Files missing: b.mp3');
  });

  it('starts late, inside the 30 min window, once a retried preflight passes', () => {
    const { actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: false, reason: 'network' }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T + 5 * MIN),
      [{ type: 'preflightResult', ok: true }, { now: T + 5 * MIN }],
      tick(T + 5 * MIN + 1000),
    ]);
    expect(last(actions)).toMatchObject({ type: 'goLive', expect: 'off' });
  });

  it('marks the show MISSED at T + 30 min and moves on to the next', () => {
    const shows = [show('a', T), show('b', T + 3 * 60 * MIN)];
    const { state } = drive([
      [{ type: 'arm' }, { shows, files: { a: files(1, 30), b: files(1, 30) } }],
      tick(T - PREFLIGHT_LEAD_MS, { shows, files: { a: files(1, 30), b: files(1, 30) } }),
      [{ type: 'preflightResult', ok: false, reason: 'network' }, { now: T - PREFLIGHT_LEAD_MS, shows }],
      tick(T + MISS_AFTER_MS, { shows, files: { a: files(1, 30), b: files(1, 30) } }),
    ]);
    expect(state.outcomes.a).toBe('missed');
    expect(state.phase).toBe('armed');
    expect(nextRunnerShow(state, ctx({ now: T + MISS_AFTER_MS, shows, files: { a: files(1, 30), b: files(1, 30) } }))?.id).toBe('b');
  });

  it('does not go live over a show someone else is running, and says so', () => {
    const { state, actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS, { station: liveAs('MANUAL') }),
      tick(T - START_LEAD_MS + RETRY_MS, { station: liveAs('MANUAL') }),
    ]);
    expect(types(actions)).not.toContain('goLive');
    expect(state.failure).toBe('Station already live');
  });

  it('starts once the manual show ends inside the window', () => {
    const { actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS, { station: liveAs('MANUAL') }),
      tick(T + 10 * MIN, { station: OFF }),
    ]);
    expect(last(actions)).toMatchObject({ type: 'goLive', expect: 'off' });
  });

  it('never ends a manual show at MISSED', () => {
    const { actions } = drive([
      [{ type: 'arm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS, { station: liveAs('MANUAL') }),
      tick(T + MISS_AFTER_MS, { station: liveAs('MANUAL') }),
    ]);
    expect(types(actions)).not.toContain('end');
  });

  it('skips a show with no files on this PC', () => {
    const shows = [show('a', T), show('b', T + 60 * MIN)];
    const c = ctx({ shows, files: { b: files(1, 20) } });
    expect(nextRunnerShow(initialRunner(), c)?.id).toBe('b');
  });

  it('skips aired shows and shows with an unreadable date', () => {
    const shows = [show('a', T, { aired_at: iso(T) }), { id: 'x', title: 'x', starts_at: 'nonsense' }, show('b', T + 60 * MIN)];
    const c = ctx({ shows, files: { a: files(1, 1), x: files(1, 1), b: files(1, 1) } });
    expect(nextRunnerShow(initialRunner(), c)?.id).toBe('b');
  });

  it('after a sleep, never starts a show more than 30 min past its start', () => {
    const { actions } = drive([
      [{ type: 'arm' }, { now: T - 60 * MIN }],
      tick(T + MISS_AFTER_MS + 1000),
    ]);
    expect(types(actions)).not.toContain('goLive');
    expect(types(actions)).not.toContain('preflight');
  });
});

describe('scheduleRunner: a start that half-worked', () => {
  const started = () => drive([
    [{ type: 'arm' }, {}],
    tick(T - PREFLIGHT_LEAD_MS),
    [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
    tick(T - START_LEAD_MS),
  ]);

  it('retries a failed GO LIVE every 30 s', () => {
    const { actions } = drive([
      [{ type: 'goLiveResult', ok: false, reason: 'network' }, { now: T - START_LEAD_MS + 1000 }],
      tick(T - START_LEAD_MS + RETRY_MS - 1000),
      tick(T - START_LEAD_MS + RETRY_MS + 1000),
    ], started().state);
    expect(types(actions)).toEqual(['goLive']);
  });

  it('resumes its own broadcast when a failed attempt left the station live with it', () => {
    const { actions } = drive([
      [{ type: 'goLiveResult', ok: false, broadcastId: 'B1', reason: 'ice' }, { now: T - START_LEAD_MS + 1000, station: liveAs('B1') }],
      tick(T - START_LEAD_MS + RETRY_MS + 1000, { station: liveAs('B1') }),
    ], started().state);
    expect(actions).toEqual([{ type: 'goLive', showId: 'a', title: 'Show a', neonMode: 'tracks', expect: 'B1' }]);
  });

  it('ends its own half-started broadcast at MISSED, so guests are not left in a silent room', () => {
    const { state, actions } = drive([
      [{ type: 'goLiveResult', ok: false, broadcastId: 'B1', reason: 'ice' }, { now: T - START_LEAD_MS + 1000, station: liveAs('B1') }],
      tick(T + MISS_AFTER_MS, { station: liveAs('B1') }),
    ], started().state);
    expect(last(actions)).toEqual({ type: 'end', expect: 'B1' });
    expect(state.outcomes.a).toBe('missed');
  });

  it('treats a GO LIVE refused with "station busy" as someone else being on air', () => {
    const { state } = drive([
      [{ type: 'goLiveResult', ok: false, reason: 'station_busy' }, { now: T - START_LEAD_MS + 1000, station: liveAs('MANUAL') }],
    ], started().state);
    expect(state.failure).toBe('Station already live');
  });
});

describe('scheduleRunner: during the show', () => {
  const live = { station: liveAs('B1'), connection: 'live' as const };

  it('skips a file that will not play', () => {
    const { actions } = drive([[{ type: 'fileError' }, { now: T + MIN, ...live }]], onAir().state);
    expect(actions).toEqual([{ type: 'skipFile' }]);
  });

  it('sends the reconnect event every 30 s while the connection is lost, never a fresh GO LIVE or a deck reload', () => {
    const lost = { station: liveAs('B1'), connection: 'lost' as const };
    const { actions } = drive([
      tick(T + 5 * MIN, lost),
      tick(T + 5 * MIN + 10_000, lost),
      tick(T + 5 * MIN + RETRY_MS, lost),
    ], onAir().state);
    expect(types(actions)).toEqual(['reconnect', 'reconnect']);
  });

  it('keeps the show through a host reconnect, which keeps the broadcast id', () => {
    const { state, actions } = drive([tick(T + 5 * MIN, { station: liveAs('B1'), connection: 'reconnecting' })], onAir().state);
    expect(state.phase).toBe('on_air');
    expect(actions).toEqual([]);
  });

  it('lets go when the host pressed END: show done, no retry', () => {
    const { state, actions } = drive([
      tick(T + 10 * MIN, { station: OFF, connection: 'idle' }),
      tick(T + 11 * MIN, { station: OFF, connection: 'idle' }),
    ], onAir().state);
    expect(state.outcomes.a).toBe('host_ended');
    expect(types(actions)).toEqual([]);
  });

  it('lets go when someone else took the station over', () => {
    const { state, actions } = drive([
      tick(T + 10 * MIN, { station: liveAs('OTHER') }),
      tick(T + 10 * MIN + 15_000, { station: liveAs('OTHER') }),
    ], onAir().state);
    expect(state.outcomes.a).toBe('host_ended');
    expect(actions).toEqual([]);
  });

  it('does not let go on a station row that lags a moment behind its own GO LIVE', () => {
    const { state, actions } = drive([tick(T, { station: OFF, connection: 'live' })], drive([
      [{ type: 'arm' }, { now: T - 60 * MIN }],
      tick(T - PREFLIGHT_LEAD_MS),
      [{ type: 'preflightResult', ok: true }, { now: T - PREFLIGHT_LEAD_MS }],
      tick(T - START_LEAD_MS),
      [{ type: 'goLiveResult', ok: true, broadcastId: 'B1' }, { now: T - START_LEAD_MS + 2000, connection: 'live' }],
    ]).state);
    expect(state.phase).toBe('on_air');
    expect(state.outcomes.a).toBeUndefined();
    expect(actions).toEqual([]);
  });

  it('ignores a queue-finished or file error that arrives when it is not on air', () => {
    const { actions } = drive([[{ type: 'fileError' }, {}], [{ type: 'queueFinished' }, {}]]);
    expect(actions).toEqual([]);
  });
});

describe('scheduleRunner: back to back', () => {
  it('waits at least 15 s after its own END before the next GO LIVE', () => {
    const shows = [show('a', T), show('b', T + 41 * MIN)];
    const both = { a: files(3, 40), b: files(2, 30) };
    const live = { station: liveAs('B1'), connection: 'live' as const, shows, files: both };
    const ended = drive([
      [{ type: 'queueFinished' }, { now: T + 40 * MIN, ...live }],
      tick(T + 40 * MIN + END_DELAY_MS, live),
      tick(T + 40 * MIN + END_DELAY_MS + 1000, { station: OFF, shows, files: both }),
      [{ type: 'preflightResult', ok: true }, { now: T + 40 * MIN + END_DELAY_MS + 2000, shows, files: both }],
    ], onAir().state);
    const endAt = ended.state.lastEndAt as number;
    const tooSoon = drive([tick(endAt + SHOW_GAP_MS - 1000, { shows, files: both })], ended.state);
    expect(types(tooSoon.actions)).not.toContain('goLive');
    const after = drive([tick(Math.max(endAt + SHOW_GAP_MS, T + 41 * MIN - START_LEAD_MS), { shows, files: both })], ended.state);
    expect(last(after.actions)).toMatchObject({ type: 'goLive', showId: 'b' });
  });

  it('an overrun never makes the next show MISSED: it starts as soon as the first ends (E4)', () => {
    const shows = [show('a', T), show('b', T + 30 * MIN)];
    const both = { a: files(3, 75), b: files(2, 30) };
    const live = { station: liveAs('B1'), connection: 'live' as const, shows, files: both };
    const finish = T + 75 * MIN;
    const { state, actions } = drive([
      tick(T + 30 * MIN, live),
      [{ type: 'queueFinished' }, { now: finish, ...live }],
      tick(finish + END_DELAY_MS, live),
      tick(finish + END_DELAY_MS + 1000, { station: OFF, shows, files: both }),
      [{ type: 'preflightResult', ok: true }, { now: finish + END_DELAY_MS + 2000, shows, files: both }],
      tick(finish + END_DELAY_MS + 1000 + SHOW_GAP_MS, { shows, files: both }),
    ], onAir().state);
    expect(state.outcomes.b).toBeUndefined();
    expect(last(actions)).toMatchObject({ type: 'goLive', showId: 'b' });
  });
});

describe('scheduleRunner: arming', () => {
  it('DISARM stops every future start', () => {
    const { state, actions } = drive([
      [{ type: 'arm' }, {}],
      [{ type: 'disarm' }, {}],
      tick(T - PREFLIGHT_LEAD_MS),
      tick(T - START_LEAD_MS),
    ]);
    expect(state.phase).toBe('off');
    expect(actions).toEqual([]);
  });

  it('DISARM during a show leaves the show to the host at the PC', () => {
    const { state, actions } = drive([[{ type: 'disarm' }, { now: T + MIN, station: liveAs('B1') }]], onAir().state);
    expect(state.phase).toBe('off');
    expect(actions).toEqual([]);
  });
});

describe('scheduleRunner: never throws', () => {
  it('survives a garbage state, garbage shows and an unknown event', () => {
    const junk = { phase: 'nonsense' } as unknown as RunnerState;
    const c = ctx({ shows: [null as unknown as RunnerShow, { id: 'q' } as RunnerShow], files: undefined as unknown as RunnerCtx['files'], station: null });
    expect(() => stepRunner(junk, { type: 'tick' }, c)).not.toThrow();
    expect(() => stepRunner(initialRunner(), { type: 'what' } as unknown as RunnerEvent, c)).not.toThrow();
    expect(() => stepRunner(initialRunner(), { type: 'tick' }, null as unknown as RunnerCtx)).not.toThrow();
    expect(stepRunner(junk, { type: 'tick' }, c).actions).toEqual([]);
  });
});
