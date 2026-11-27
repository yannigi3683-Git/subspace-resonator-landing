// SCHEDULE RUNNER's decisions, as a pure state machine. The hook (useScheduleRunner) feeds it the
// server clock, the show list, which shows have files on this PC, a fresh station row and the
// connection status, and carries out the actions it returns through GoLivePanel's existing
// handlers. Nothing here touches audio, the network or the DOM, so every rule is testable.
//
// A broadcast is identified by live_session.startedAt (`broadcastId`), NOT cfSessionId: a host
// reconnect mints a new cfSessionId mid-show, which would make the runner mistake its own show for
// someone else's. startedAt survives a reconnect (api/rtc-session.ts broadcastStartedAt()).
//
// Total: a bad state, bad shows or an unknown event return the state unchanged and no actions,
// because this runs beside GoLivePanel and must never take the console down.

import type { ConnectionStatus } from './rtc/connectionFsm';

const MIN = 60_000;
export const PREFLIGHT_LEAD_MS = 10 * MIN;
export const START_LEAD_MS = 45_000;
export const RETRY_MS = 30_000;
export const MISS_AFTER_MS = 30 * MIN;
// Deep-buffer listeners are 8-20 s behind the room, so ending the moment the last file stops cuts them.
export const END_DELAY_MS = 30_000;
export const HARD_END_MARGIN_MS = 2 * MIN;
// The restreamer polls every 3 s; END then GO LIVE inside that reads as a reconnect, not a new show.
export const SHOW_GAP_MS = 15_000;
// The station row can lag the console by a moment after GO LIVE, so "not my broadcast any more"
// must hold this long before the runner lets go of a show.
const LET_GO_AFTER_MS = 15_000;

export interface RunnerShow {
  id: string;
  title: string;
  starts_at: string;
  aired_at?: string | null;
  neon_mode?: 'tracks' | 'title';
}

export interface ShowFilesInfo {
  count: number;
  totalMs: number;
}

export interface RunnerCtx {
  now: number;
  shows: RunnerShow[];
  files: Record<string, ShowFilesInfo | undefined>;
  station: { mode: 'off' | 'live'; broadcastId: string | null } | null;
  connection: ConnectionStatus;
  pausedMs?: number;
}

export type RunnerEvent =
  | { type: 'tick' }
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'preflightResult'; ok: boolean; reason?: string }
  | { type: 'goLiveResult'; ok: boolean; broadcastId?: string | null; reason?: string }
  | { type: 'queueFinished' }
  | { type: 'fileError' };

export type RunnerAction =
  | { type: 'preflight'; showId: string }
  | { type: 'goLive'; showId: string; title: string; neonMode: 'tracks' | 'title'; expect: string }
  | { type: 'loadAndPlay'; showId: string }
  | { type: 'skipFile' }
  | { type: 'reconnect' }
  | { type: 'end'; expect: string };

export type RunnerPhase = 'off' | 'armed' | 'preflight' | 'starting' | 'on_air' | 'ending';
export type RunnerOutcome = 'ended' | 'missed' | 'host_ended';

export interface RunnerState {
  phase: RunnerPhase;
  showId: string | null;
  showStart: number | null;
  showTitle: string;
  neonMode: 'tracks' | 'title';
  showTotalMs: number;
  ownBroadcast: string | null;
  preflightOk: boolean;
  failure: string | null;
  lastPreflightAt: number | null;
  lastAttemptAt: number | null;
  awaitingGoLive: boolean;
  wentLiveAt: number | null;
  deckStartedAt: number | null;
  finishedAt: number | null;
  endIssuedAt: number | null;
  notMineSince: number | null;
  lastReconnectAt: number | null;
  lastShowFrom: number | null;
  lastEndAt: number | null;
  outcomes: Record<string, RunnerOutcome>;
}

const PHASES: RunnerPhase[] = ['off', 'armed', 'preflight', 'starting', 'on_air', 'ending'];

const CURRENT_SHOW: Pick<RunnerState, 'showId' | 'showStart' | 'showTitle' | 'neonMode' | 'showTotalMs' | 'ownBroadcast'
  | 'preflightOk' | 'failure' | 'lastPreflightAt' | 'lastAttemptAt' | 'awaitingGoLive' | 'wentLiveAt' | 'deckStartedAt'
  | 'finishedAt' | 'endIssuedAt' | 'notMineSince' | 'lastReconnectAt'> = {
  showId: null, showStart: null, showTitle: '', neonMode: 'tracks', showTotalMs: 0, ownBroadcast: null,
  preflightOk: false, failure: null, lastPreflightAt: null, lastAttemptAt: null, awaitingGoLive: false,
  wentLiveAt: null, deckStartedAt: null, finishedAt: null, endIssuedAt: null, notMineSince: null, lastReconnectAt: null,
};

export function initialRunner(): RunnerState {
  return { phase: 'off', ...CURRENT_SHOW, lastShowFrom: null, lastEndAt: null, outcomes: {} };
}

type Out = { state: RunnerState; actions: RunnerAction[] };

const startOf = (s: RunnerShow): number => Date.parse(s.starts_at);

function usable(s: unknown): s is RunnerShow {
  if (!s || typeof s !== 'object') return false;
  const show = s as RunnerShow;
  return typeof show.id === 'string' && typeof show.starts_at === 'string' && Number.isFinite(startOf(show)) && !show.aired_at;
}

// The latest a show may still start. A show that was due while the runner's own previous show was
// still playing gets its window from that show's END instead (E4: never cut a set, the next show
// starts as soon as the first ends), so an overrun cannot turn it into MISSED.
function deadline(start: number, state: RunnerState): number {
  const { lastShowFrom, lastEndAt } = state;
  const blocked = lastShowFrom !== null && lastEndAt !== null && start >= lastShowFrom && start <= lastEndAt;
  return (blocked ? (lastEndAt as number) : start) + MISS_AFTER_MS;
}

export function nextRunnerShow(state: RunnerState, ctx: RunnerCtx): RunnerShow | null {
  try {
    const files = ctx.files ?? {};
    const outcomes = state.outcomes ?? {};
    const candidates = (Array.isArray(ctx.shows) ? ctx.shows : [])
      .filter(usable)
      .filter((s) => (files[s.id]?.count ?? 0) > 0 && !outcomes[s.id] && ctx.now < deadline(startOf(s), state))
      .sort((a, b) => startOf(a) - startOf(b));
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

const isMine = (state: RunnerState, ctx: RunnerCtx): boolean =>
  ctx.station?.mode === 'live' && state.ownBroadcast !== null && ctx.station.broadcastId === state.ownBroadcast;

function finish(state: RunnerState, outcome: RunnerOutcome, now: number): RunnerState {
  return {
    ...state,
    ...CURRENT_SHOW,
    phase: 'armed',
    lastShowFrom: state.wentLiveAt ?? state.lastShowFrom,
    lastEndAt: now,
    outcomes: state.showId ? { ...state.outcomes, [state.showId]: outcome } : state.outcomes,
  };
}

function missed(state: RunnerState, ctx: RunnerCtx): Out {
  const actions: RunnerAction[] = isMine(state, ctx) ? [{ type: 'end', expect: state.ownBroadcast as string }] : [];
  const next = finish(state, 'missed', ctx.now);
  // A missed show that never went live did not block anything, so it must not stretch the next deadline.
  return { state: actions.length ? next : { ...next, lastShowFrom: state.lastShowFrom, lastEndAt: state.lastEndAt }, actions };
}

function tryStart(state: RunnerState, ctx: RunnerCtx): Out {
  const { now } = ctx;
  if (!state.preflightOk || state.showStart === null || !state.showId) return { state, actions: [] };
  if (now < state.showStart - START_LEAD_MS) return { state, actions: [] };
  if (state.lastEndAt !== null && now - state.lastEndAt < SHOW_GAP_MS) return { state, actions: [] };
  if (state.lastAttemptAt !== null && now - state.lastAttemptAt < RETRY_MS) return { state, actions: [] };
  if (!ctx.station) return { state, actions: [] };

  let expect: string;
  if (isMine(state, ctx)) expect = state.ownBroadcast as string;
  else if (ctx.station.mode === 'live') return { state: { ...state, failure: 'Station already live' }, actions: [] };
  else expect = 'off';

  return {
    state: { ...state, phase: 'starting', lastAttemptAt: now, awaitingGoLive: true },
    actions: [{ type: 'goLive', showId: state.showId, title: state.showTitle, neonMode: state.neonMode, expect }],
  };
}

function tickOnce(state: RunnerState, ctx: RunnerCtx): Out {
  const { now } = ctx;
  switch (state.phase) {
    case 'off':
      return { state, actions: [] };

    case 'armed': {
      const show = nextRunnerShow(state, ctx);
      if (!show || now < startOf(show) - PREFLIGHT_LEAD_MS) return { state, actions: [] };
      return {
        state: {
          ...state, ...CURRENT_SHOW, phase: 'preflight', showId: show.id, showStart: startOf(show),
          showTitle: show.title ?? '', neonMode: show.neon_mode === 'title' ? 'title' : 'tracks',
          showTotalMs: ctx.files?.[show.id]?.totalMs ?? 0, lastPreflightAt: now,
        },
        actions: [{ type: 'preflight', showId: show.id }],
      };
    }

    case 'preflight':
    case 'starting': {
      if (state.showStart === null || now >= deadline(state.showStart, state)) return missed(state, ctx);
      if (state.phase === 'starting' && state.awaitingGoLive && state.lastAttemptAt !== null && now - state.lastAttemptAt < RETRY_MS) {
        return { state, actions: [] };
      }
      if (!state.preflightOk) {
        if (state.lastPreflightAt === null || now - state.lastPreflightAt >= RETRY_MS) {
          return { state: { ...state, lastPreflightAt: now }, actions: [{ type: 'preflight', showId: state.showId as string }] };
        }
        return { state, actions: [] };
      }
      return tryStart(state, ctx);
    }

    case 'on_air': {
      if (!ctx.station) return { state, actions: [] };
      if (!isMine(state, ctx)) {
        if (state.ownBroadcast === null && ctx.station.mode === 'live' && ctx.station.broadcastId) {
          return { state: { ...state, ownBroadcast: ctx.station.broadcastId }, actions: [] };
        }
        const since = state.notMineSince ?? now;
        if (now - since >= LET_GO_AFTER_MS) return { state: finish(state, 'host_ended', now), actions: [] };
        return { state: { ...state, notMineSince: since }, actions: [] };
      }
      const actions: RunnerAction[] = [];
      let next: RunnerState = { ...state, notMineSince: null };
      if (ctx.connection === 'lost' && (next.lastReconnectAt === null || now - next.lastReconnectAt >= RETRY_MS)) {
        actions.push({ type: 'reconnect' });
        next = { ...next, lastReconnectAt: now };
      }
      if (next.deckStartedAt === null && next.showStart !== null && now >= next.showStart) {
        actions.push({ type: 'loadAndPlay', showId: next.showId as string });
        next = { ...next, deckStartedAt: now };
      }
      if (next.deckStartedAt !== null) {
        const hardEnd = next.deckStartedAt + next.showTotalMs + Math.max(0, ctx.pausedMs ?? 0) + HARD_END_MARGIN_MS;
        if (now >= hardEnd) {
          actions.push({ type: 'end', expect: next.ownBroadcast as string });
          next = { ...next, phase: 'ending', finishedAt: now, endIssuedAt: now };
        }
      }
      return { state: next, actions };
    }

    case 'ending': {
      if (!ctx.station) return { state, actions: [] };
      if (!isMine(state, ctx)) return { state: finish(state, 'ended', now), actions: [] };
      const due = state.endIssuedAt === null
        ? state.finishedAt !== null && now - state.finishedAt >= END_DELAY_MS
        : now - state.endIssuedAt >= RETRY_MS;
      if (!due) return { state, actions: [] };
      return { state: { ...state, endIssuedAt: now }, actions: [{ type: 'end', expect: state.ownBroadcast as string }] };
    }
  }
}

// One tick may cross phases (a show ends and the next one's preflight is due), so it re-runs while
// the phase keeps changing, a bounded number of times.
function tick(state: RunnerState, ctx: RunnerCtx): Out {
  const actions: RunnerAction[] = [];
  let current = state;
  for (let i = 0; i < 3; i++) {
    const out = tickOnce(current, ctx);
    actions.push(...out.actions);
    const changed = out.state.phase !== current.phase;
    current = out.state;
    if (!changed) break;
  }
  return { state: current, actions };
}

function normalize(state: RunnerState): RunnerState {
  if (!state || typeof state !== 'object' || !PHASES.includes(state.phase)) return initialRunner();
  return { ...initialRunner(), ...state, outcomes: state.outcomes && typeof state.outcomes === 'object' ? state.outcomes : {} };
}

export function stepRunner(rawState: RunnerState, event: RunnerEvent, ctx: RunnerCtx): Out {
  const state = normalize(rawState);
  try {
    if (!ctx || !Number.isFinite(ctx.now)) return { state, actions: [] };
    switch (event?.type) {
      case 'tick':
        return tick(state, ctx);
      case 'arm':
        return { state: state.phase === 'off' ? { ...state, ...CURRENT_SHOW, phase: 'armed' } : state, actions: [] };
      case 'disarm':
        return { state: { ...state, ...CURRENT_SHOW, phase: 'off' }, actions: [] };
      case 'preflightResult':
        if (state.phase !== 'preflight' && state.phase !== 'starting') return { state, actions: [] };
        return { state: { ...state, preflightOk: !!event.ok, failure: event.ok ? null : event.reason ?? 'Preflight failed' }, actions: [] };
      case 'goLiveResult': {
        if (state.phase !== 'starting') return { state, actions: [] };
        const ownBroadcast = event.broadcastId ?? state.ownBroadcast;
        if (event.ok) {
          return { state: { ...state, phase: 'on_air', ownBroadcast, awaitingGoLive: false, failure: null, wentLiveAt: ctx.now }, actions: [] };
        }
        const failure = event.reason === 'station_busy' ? 'Station already live' : event.reason ?? 'Start failed';
        return { state: { ...state, ownBroadcast, awaitingGoLive: false, failure }, actions: [] };
      }
      case 'queueFinished':
        if (state.phase !== 'on_air') return { state, actions: [] };
        return { state: { ...state, phase: 'ending', finishedAt: ctx.now }, actions: [] };
      case 'fileError':
        return state.phase === 'on_air' ? { state, actions: [{ type: 'skipFile' }] } : { state, actions: [] };
      default:
        return { state, actions: [] };
    }
  } catch {
    return { state, actions: [] };
  }
}
