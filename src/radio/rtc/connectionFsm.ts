export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'degraded'
  | 'reconnecting'
  | 'lost';

export type ConnectionEvent =
  | { type: 'CONNECT' }
  | { type: 'CONNECTED' }
  | { type: 'QUALITY_DEGRADED' }
  | { type: 'QUALITY_RECOVERED' }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR' }
  | { type: 'RETRY_TIMER_FIRED' }
  | { type: 'RESET' };

export type FsmEffect =
  | { type: 'SCHEDULE_RETRY'; delayMs: number }
  | { type: 'CANCEL_RETRY' }
  | { type: 'CONNECT_RTC' }
  | { type: 'DISCONNECT_RTC' };

export interface FsmState {
  status: ConnectionStatus;
  retryCount: number;
  nextDelayMs: number;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
export const MAX_RETRIES = 6;

export function calcDelay(retryCount: number, rand: () => number = Math.random): number {
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  return Math.floor(base * (0.85 + rand() * 0.30));
}

export function initialState(): FsmState {
  return { status: 'idle', retryCount: 0, nextDelayMs: BASE_DELAY_MS };
}

/**
 * Whether a browser `online` event should resume the broadcast on its own.
 *
 * The retry budget is 6 attempts over ~31s of backoff. While the network is down every attempt
 * fails the instant it is made, so a WiFi outage longer than half a minute burns the whole budget
 * and parks the FSM in `lost`, which is terminal. Restoring the network then did nothing: the host
 * had to notice and press GO LIVE by hand (verified live 2026-07-31).
 *
 * Only `lost` resumes. A shorter blip is still mid-backoff and its scheduled retry fires anyway,
 * and `hasLiveStream` keeps a fatal setup error (mic blocked, not-admin, no mixer) from
 * auto-retrying forever — those need the host, not another attempt.
 */
export function shouldResumeOnOnline(status: ConnectionStatus, hasLiveStream: boolean): boolean {
  return status === 'lost' && hasLiveStream;
}

export function transition(
  state: FsmState,
  event: ConnectionEvent,
  rand: () => number = Math.random,
): { next: FsmState; effects: FsmEffect[] } {
  const { status } = state;

  if (event.type === 'RESET') {
    return {
      next: initialState(),
      effects: status !== 'idle' ? [{ type: 'DISCONNECT_RTC' }] : [],
    };
  }

  switch (status) {
    case 'idle': {
      if (event.type === 'CONNECT') {
        return {
          next: { status: 'connecting', retryCount: 0, nextDelayMs: BASE_DELAY_MS },
          effects: [{ type: 'CONNECT_RTC' }],
        };
      }
      break;
    }

    case 'connecting': {
      if (event.type === 'CONNECTED') {
        return {
          next: { status: 'live', retryCount: 0, nextDelayMs: BASE_DELAY_MS },
          effects: [{ type: 'CANCEL_RETRY' }],
        };
      }
      if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
        const newRetryCount = state.retryCount + 1;
        if (newRetryCount >= MAX_RETRIES) {
          return {
            next: { status: 'lost', retryCount: newRetryCount, nextDelayMs: MAX_DELAY_MS },
            effects: [{ type: 'CANCEL_RETRY' }],
          };
        }
        const delayMs = calcDelay(state.retryCount, rand);
        return {
          next: { status: 'reconnecting', retryCount: newRetryCount, nextDelayMs: delayMs },
          effects: [{ type: 'SCHEDULE_RETRY', delayMs }],
        };
      }
      break;
    }

    case 'live': {
      if (event.type === 'QUALITY_DEGRADED') {
        return { next: { ...state, status: 'degraded' }, effects: [] };
      }
      if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
        const delayMs = calcDelay(0, rand);
        return {
          next: { status: 'reconnecting', retryCount: 0, nextDelayMs: delayMs },
          effects: [{ type: 'SCHEDULE_RETRY', delayMs }],
        };
      }
      break;
    }

    case 'degraded': {
      if (event.type === 'QUALITY_RECOVERED') {
        return { next: { ...state, status: 'live' }, effects: [] };
      }
      if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
        const delayMs = calcDelay(0, rand);
        return {
          next: { status: 'reconnecting', retryCount: 0, nextDelayMs: delayMs },
          effects: [{ type: 'SCHEDULE_RETRY', delayMs }],
        };
      }
      break;
    }

    case 'reconnecting': {
      if (event.type === 'RETRY_TIMER_FIRED') {
        return {
          next: { ...state, status: 'connecting' },
          effects: [{ type: 'CONNECT_RTC' }],
        };
      }
      if (event.type === 'CONNECTED') {
        return {
          next: { status: 'live', retryCount: 0, nextDelayMs: BASE_DELAY_MS },
          effects: [{ type: 'CANCEL_RETRY' }],
        };
      }
      break;
    }

    case 'lost': {
      if (event.type === 'CONNECT') {
        return {
          next: { status: 'connecting', retryCount: 0, nextDelayMs: BASE_DELAY_MS },
          effects: [{ type: 'CONNECT_RTC' }],
        };
      }
      break;
    }
  }

  return { next: state, effects: [] };
}
