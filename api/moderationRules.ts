// Validation for host moderation requests. Pure so it can be tested without Supabase, and
// so a malformed payload is rejected with a readable error before any write is attempted.

export type ModerationRequest =
  | { action: 'delete_message'; messageId: string }
  | { action: 'kick'; uid: string; deviceId: string | null }
  | { action: 'ban'; uid: string; deviceId: string | null; reason: string | null }
  | { action: 'unban'; uid: string }
  | { action: 'set_chat'; slowModeS?: number; locked?: boolean };

export type ModerationParse =
  | { ok: true; request: ModerationRequest }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DEVICE_ID = 64;
const MAX_REASON = 200;
const MAX_SLOW_MODE_S = 300; // matches the CHECK on station.slow_mode_s

// null = not supplied (the server resolves it from chat_messages); false = supplied but junk.
export function readDeviceId(raw: unknown): string | null | false {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_DEVICE_ID) return false;
  return trimmed;
}

export function parseModerationRequest(body: Record<string, unknown>, selfUid: string): ModerationParse {
  const action = body.action;

  if (action === 'delete_message') {
    const messageId = body.messageId;
    if (typeof messageId !== 'string' || !UUID.test(messageId)) {
      return { ok: false, error: 'invalid_message_id' };
    }
    return { ok: true, request: { action, messageId } };
  }

  if (action === 'kick' || action === 'ban' || action === 'unban') {
    const uid = body.uid;
    if (typeof uid !== 'string' || !UUID.test(uid)) return { ok: false, error: 'invalid_uid' };
    // Unbanning yourself is harmless; kicking or banning yourself would lock the host out of
    // his own room mid-broadcast.
    if (uid === selfUid && action !== 'unban') return { ok: false, error: 'cannot_moderate_self' };

    if (action === 'unban') return { ok: true, request: { action, uid } };

    const deviceId = readDeviceId(body.deviceId);
    if (deviceId === false) return { ok: false, error: 'invalid_device_id' };

    if (action === 'kick') return { ok: true, request: { action, uid, deviceId } };

    const rawReason = body.reason;
    const reason =
      typeof rawReason === 'string' && rawReason.trim()
        ? rawReason.trim().slice(0, MAX_REASON)
        : null;
    return { ok: true, request: { action, uid, deviceId, reason } };
  }

  if (action === 'set_chat') {
    const request: { action: 'set_chat'; slowModeS?: number; locked?: boolean } = { action };

    if (body.slowModeS !== undefined) {
      const slowModeS = body.slowModeS;
      if (
        typeof slowModeS !== 'number' ||
        !Number.isInteger(slowModeS) ||
        slowModeS < 0 ||
        slowModeS > MAX_SLOW_MODE_S
      ) {
        return { ok: false, error: 'invalid_slow_mode' };
      }
      request.slowModeS = slowModeS;
    }

    if (body.locked !== undefined) {
      if (typeof body.locked !== 'boolean') return { ok: false, error: 'invalid_locked' };
      request.locked = body.locked;
    }

    if (request.slowModeS === undefined && request.locked === undefined) {
      return { ok: false, error: 'nothing_to_update' };
    }
    return { ok: true, request };
  }

  return { ok: false, error: 'unknown_action' };
}
