import { describe, it, expect } from 'vitest';
import {
  transition,
  initialState,
  calcDelay,
  MAX_RETRIES,
  type FsmState,
  type ConnectionEvent,
} from './connectionFsm';

const ZERO_RAND = () => 0; // deterministic: delay = floor(base * 0.85)

function applyEvents(events: ConnectionEvent[], start = initialState()): FsmState {
  return events.reduce<FsmState>((s, e) => transition(s, e, ZERO_RAND).next, start);
}

// --- calcDelay ---

describe('calcDelay', () => {
  it('returns floor(base * 0.85) with rand=0', () => {
    expect(calcDelay(0, ZERO_RAND)).toBe(850);
    expect(calcDelay(1, ZERO_RAND)).toBe(1700);
    expect(calcDelay(2, ZERO_RAND)).toBe(3400);
    expect(calcDelay(3, ZERO_RAND)).toBe(6800);
    expect(calcDelay(4, ZERO_RAND)).toBe(13600);
  });

  it('caps base at MAX_DELAY_MS (30 000 ms)', () => {
    expect(calcDelay(5, ZERO_RAND)).toBe(25500); // min(32000, 30000) * 0.85
    expect(calcDelay(10, ZERO_RAND)).toBe(25500); // cap holds
  });

  it('adds jitter with rand=1', () => {
    const full = calcDelay(0, () => 1); // floor(1000 * 1.15)
    expect(full).toBe(1150);
  });
});

// --- initialState ---

describe('initialState', () => {
  it('starts idle with retryCount 0', () => {
    const s = initialState();
    expect(s.status).toBe('idle');
    expect(s.retryCount).toBe(0);
  });
});

// --- idle ---

describe('idle state', () => {
  it('CONNECT → connecting + CONNECT_RTC effect', () => {
    const { next, effects } = transition(initialState(), { type: 'CONNECT' }, ZERO_RAND);
    expect(next.status).toBe('connecting');
    expect(next.retryCount).toBe(0);
    expect(effects).toContainEqual({ type: 'CONNECT_RTC' });
  });

  it('ignores CONNECTED, DISCONNECTED, ERROR, RETRY_TIMER_FIRED', () => {
    const s = initialState();
    for (const type of ['CONNECTED', 'DISCONNECTED', 'ERROR', 'RETRY_TIMER_FIRED'] as const) {
      const { next, effects } = transition(s, { type }, ZERO_RAND);
      expect(next).toBe(s); // same reference = no change
      expect(effects).toHaveLength(0);
    }
  });
});

// --- connecting ---

describe('connecting state', () => {
  const connecting: FsmState = { status: 'connecting', retryCount: 0, nextDelayMs: 1000 };

  it('CONNECTED → live + CANCEL_RETRY effect', () => {
    const { next, effects } = transition(connecting, { type: 'CONNECTED' }, ZERO_RAND);
    expect(next.status).toBe('live');
    expect(next.retryCount).toBe(0);
    expect(effects).toContainEqual({ type: 'CANCEL_RETRY' });
  });

  it('ERROR → reconnecting with incremented retryCount + SCHEDULE_RETRY', () => {
    const { next, effects } = transition(connecting, { type: 'ERROR' }, ZERO_RAND);
    expect(next.status).toBe('reconnecting');
    expect(next.retryCount).toBe(1);
    expect(effects).toContainEqual({ type: 'SCHEDULE_RETRY', delayMs: 850 }); // calcDelay(0)
  });

  it('DISCONNECTED behaves same as ERROR', () => {
    const { next } = transition(connecting, { type: 'DISCONNECTED' }, ZERO_RAND);
    expect(next.status).toBe('reconnecting');
    expect(next.retryCount).toBe(1);
  });

  it('gives up and enters lost after MAX_RETRIES failures', () => {
    let state = initialState();
    // initial CONNECT
    state = transition(state, { type: 'CONNECT' }, ZERO_RAND).next;
    for (let i = 0; i < MAX_RETRIES; i++) {
      // fail
      state = transition(state, { type: 'ERROR' }, ZERO_RAND).next;
      if (state.status === 'lost') break;
      // retry timer fires → back to connecting
      state = transition(state, { type: 'RETRY_TIMER_FIRED' }, ZERO_RAND).next;
    }
    expect(state.status).toBe('lost');
    expect(state.retryCount).toBe(MAX_RETRIES);
  });

  it('CANCEL_RETRY effect emitted when entering lost', () => {
    // drive retryCount up to MAX_RETRIES - 1
    let state: FsmState = { status: 'connecting', retryCount: MAX_RETRIES - 1, nextDelayMs: 850 };
    const { next, effects } = transition(state, { type: 'ERROR' }, ZERO_RAND);
    expect(next.status).toBe('lost');
    expect(effects).toContainEqual({ type: 'CANCEL_RETRY' });
  });

  it('ignores QUALITY_DEGRADED, QUALITY_RECOVERED', () => {
    const s: FsmState = connecting;
    for (const type of ['QUALITY_DEGRADED', 'QUALITY_RECOVERED'] as const) {
      const { next } = transition(s, { type }, ZERO_RAND);
      expect(next).toBe(s);
    }
  });
});

// --- live ---

describe('live state', () => {
  const live: FsmState = { status: 'live', retryCount: 0, nextDelayMs: 1000 };

  it('QUALITY_DEGRADED → degraded', () => {
    const { next, effects } = transition(live, { type: 'QUALITY_DEGRADED' }, ZERO_RAND);
    expect(next.status).toBe('degraded');
    expect(effects).toHaveLength(0);
  });

  it('DISCONNECTED → reconnecting with retryCount reset to 0 + SCHEDULE_RETRY', () => {
    const { next, effects } = transition(
      { ...live, retryCount: 3 }, // pretend prior retries
      { type: 'DISCONNECTED' },
      ZERO_RAND,
    );
    expect(next.status).toBe('reconnecting');
    expect(next.retryCount).toBe(0); // reset — we were live
    expect(effects).toContainEqual({ type: 'SCHEDULE_RETRY', delayMs: 850 });
  });

  it('ERROR behaves same as DISCONNECTED', () => {
    const { next } = transition(live, { type: 'ERROR' }, ZERO_RAND);
    expect(next.status).toBe('reconnecting');
    expect(next.retryCount).toBe(0);
  });

  it('ignores CONNECTED, QUALITY_RECOVERED, RETRY_TIMER_FIRED', () => {
    for (const type of ['CONNECTED', 'QUALITY_RECOVERED', 'RETRY_TIMER_FIRED'] as const) {
      const { next } = transition(live, { type }, ZERO_RAND);
      expect(next).toBe(live);
    }
  });
});

// --- degraded ---

describe('degraded state', () => {
  const degraded: FsmState = { status: 'degraded', retryCount: 0, nextDelayMs: 1000 };

  it('QUALITY_RECOVERED → live', () => {
    const { next, effects } = transition(degraded, { type: 'QUALITY_RECOVERED' }, ZERO_RAND);
    expect(next.status).toBe('live');
    expect(effects).toHaveLength(0);
  });

  it('DISCONNECTED → reconnecting', () => {
    const { next } = transition(degraded, { type: 'DISCONNECTED' }, ZERO_RAND);
    expect(next.status).toBe('reconnecting');
    expect(next.retryCount).toBe(0);
  });

  it('ERROR → reconnecting', () => {
    const { next } = transition(degraded, { type: 'ERROR' }, ZERO_RAND);
    expect(next.status).toBe('reconnecting');
  });

  it('ignores CONNECTED, QUALITY_DEGRADED, RETRY_TIMER_FIRED', () => {
    for (const type of ['CONNECTED', 'QUALITY_DEGRADED', 'RETRY_TIMER_FIRED'] as const) {
      const { next } = transition(degraded, { type }, ZERO_RAND);
      expect(next).toBe(degraded);
    }
  });
});

// --- reconnecting ---

describe('reconnecting state', () => {
  const reconnecting: FsmState = { status: 'reconnecting', retryCount: 2, nextDelayMs: 3400 };

  it('RETRY_TIMER_FIRED → connecting + CONNECT_RTC', () => {
    const { next, effects } = transition(reconnecting, { type: 'RETRY_TIMER_FIRED' }, ZERO_RAND);
    expect(next.status).toBe('connecting');
    expect(next.retryCount).toBe(2); // preserved
    expect(effects).toContainEqual({ type: 'CONNECT_RTC' });
  });

  it('CONNECTED → live + CANCEL_RETRY (early success, rare)', () => {
    const { next, effects } = transition(reconnecting, { type: 'CONNECTED' }, ZERO_RAND);
    expect(next.status).toBe('live');
    expect(next.retryCount).toBe(0);
    expect(effects).toContainEqual({ type: 'CANCEL_RETRY' });
  });

  it('ignores ERROR, DISCONNECTED while waiting', () => {
    for (const type of ['ERROR', 'DISCONNECTED'] as const) {
      const { next } = transition(reconnecting, { type }, ZERO_RAND);
      expect(next).toBe(reconnecting);
    }
  });

  it('backoff delay grows exponentially across retry sequence', () => {
    const delays: number[] = [];
    let state = applyEvents([{ type: 'CONNECT' }]);
    for (let i = 0; i < 5; i++) {
      const { next, effects } = transition(state, { type: 'ERROR' }, ZERO_RAND);
      const scheduleEffect = effects.find((e) => e.type === 'SCHEDULE_RETRY');
      if (scheduleEffect && scheduleEffect.type === 'SCHEDULE_RETRY') {
        delays.push(scheduleEffect.delayMs);
      }
      // advance through reconnecting to connecting for next iteration
      state = transition(next, { type: 'RETRY_TIMER_FIRED' }, ZERO_RAND).next;
    }
    expect(delays).toEqual([850, 1700, 3400, 6800, 13600]);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

// --- lost ---

describe('lost state', () => {
  const lost: FsmState = { status: 'lost', retryCount: MAX_RETRIES, nextDelayMs: 30000 };

  it('CONNECT → connecting (manual retry)', () => {
    const { next, effects } = transition(lost, { type: 'CONNECT' }, ZERO_RAND);
    expect(next.status).toBe('connecting');
    expect(next.retryCount).toBe(0);
    expect(effects).toContainEqual({ type: 'CONNECT_RTC' });
  });

  it('ignores other events', () => {
    for (const type of ['CONNECTED', 'DISCONNECTED', 'ERROR', 'RETRY_TIMER_FIRED', 'QUALITY_DEGRADED'] as const) {
      const { next } = transition(lost, { type }, ZERO_RAND);
      expect(next).toBe(lost);
    }
  });
});

// --- RESET ---

describe('RESET event', () => {
  it('returns to idle from any non-idle state with DISCONNECT_RTC', () => {
    const states: FsmState[] = [
      { status: 'connecting', retryCount: 2, nextDelayMs: 1000 },
      { status: 'live', retryCount: 0, nextDelayMs: 1000 },
      { status: 'degraded', retryCount: 0, nextDelayMs: 1000 },
      { status: 'reconnecting', retryCount: 3, nextDelayMs: 6800 },
      { status: 'lost', retryCount: 6, nextDelayMs: 30000 },
    ];
    for (const s of states) {
      const { next, effects } = transition(s, { type: 'RESET' }, ZERO_RAND);
      expect(next.status).toBe('idle');
      expect(effects).toContainEqual({ type: 'DISCONNECT_RTC' });
    }
  });

  it('RESET from idle emits no effects', () => {
    const { next, effects } = transition(initialState(), { type: 'RESET' }, ZERO_RAND);
    expect(next.status).toBe('idle');
    expect(effects).toHaveLength(0);
  });
});

// --- full happy path ---

describe('full happy path', () => {
  it('idle → live via CONNECT + CONNECTED', () => {
    const state = applyEvents([{ type: 'CONNECT' }, { type: 'CONNECTED' }]);
    expect(state.status).toBe('live');
    expect(state.retryCount).toBe(0);
  });

  it('live → degraded → live via quality events', () => {
    const state = applyEvents([
      { type: 'CONNECT' },
      { type: 'CONNECTED' },
      { type: 'QUALITY_DEGRADED' },
      { type: 'QUALITY_RECOVERED' },
    ]);
    expect(state.status).toBe('live');
  });

  it('live → reconnecting → live via disconnect + retry', () => {
    const state = applyEvents([
      { type: 'CONNECT' },
      { type: 'CONNECTED' },
      { type: 'DISCONNECTED' },
      { type: 'RETRY_TIMER_FIRED' },
      { type: 'CONNECTED' },
    ]);
    expect(state.status).toBe('live');
    expect(state.retryCount).toBe(0);
  });
});
