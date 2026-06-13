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
