import { describe, it, expect } from 'vitest';
import { parseModerationRequest } from './moderationRules';

const SELF = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MSG = '33333333-3333-4333-8333-333333333333';

describe('parseModerationRequest', () => {
  it('rejects an unknown action', () => {
    expect(parseModerationRequest({ action: 'nuke_everything' }, SELF)).toEqual({
      ok: false,
      error: 'unknown_action',
    });
  });

  it('rejects a missing action', () => {
    expect(parseModerationRequest({}, SELF)).toEqual({ ok: false, error: 'unknown_action' });
  });

  describe('delete_message', () => {
    it('accepts a uuid message id', () => {
      expect(parseModerationRequest({ action: 'delete_message', messageId: MSG }, SELF)).toEqual({
        ok: true,
        request: { action: 'delete_message', messageId: MSG },
      });
    });

    it('rejects a non-uuid message id', () => {
      expect(parseModerationRequest({ action: 'delete_message', messageId: 'abc' }, SELF)).toEqual({
        ok: false,
        error: 'invalid_message_id',
      });
    });
  });

  describe('kick and ban', () => {
    it('accepts a uid with no device id (server resolves it)', () => {
      expect(parseModerationRequest({ action: 'kick', uid: OTHER }, SELF)).toEqual({
        ok: true,
        request: { action: 'kick', uid: OTHER, deviceId: null },
      });
    });

    it('accepts a uid with a device id', () => {
      expect(parseModerationRequest({ action: 'kick', uid: OTHER, deviceId: 'dev-1' }, SELF)).toEqual({
        ok: true,
        request: { action: 'kick', uid: OTHER, deviceId: 'dev-1' },
      });
    });

    it('rejects a non-uuid uid', () => {
      expect(parseModerationRequest({ action: 'ban', uid: 'not-a-uuid' }, SELF)).toEqual({
        ok: false,
        error: 'invalid_uid',
      });
    });

    it('rejects an over-long device id', () => {
      const long = 'd'.repeat(65);
      expect(parseModerationRequest({ action: 'ban', uid: OTHER, deviceId: long }, SELF)).toEqual({
        ok: false,
        error: 'invalid_device_id',
      });
    });

    it('rejects an empty device id rather than treating it as absent', () => {
      expect(parseModerationRequest({ action: 'kick', uid: OTHER, deviceId: '  ' }, SELF)).toEqual({
        ok: false,
        error: 'invalid_device_id',
      });
    });

    // A mis-tap during a live show must never lock the host out of his own room.
    it('refuses to kick yourself', () => {
      expect(parseModerationRequest({ action: 'kick', uid: SELF }, SELF)).toEqual({
        ok: false,
        error: 'cannot_moderate_self',
      });
    });

    it('refuses to ban yourself', () => {
      expect(parseModerationRequest({ action: 'ban', uid: SELF }, SELF)).toEqual({
        ok: false,
        error: 'cannot_moderate_self',
      });
    });

    it('carries a trimmed reason on ban', () => {
      expect(parseModerationRequest({ action: 'ban', uid: OTHER, reason: '  hate speech  ' }, SELF)).toEqual({
        ok: true,
        request: { action: 'ban', uid: OTHER, deviceId: null, reason: 'hate speech' },
      });
    });

    it('truncates an over-long reason instead of failing', () => {
      const parsed = parseModerationRequest({ action: 'ban', uid: OTHER, reason: 'x'.repeat(500) }, SELF);
      expect(parsed.ok).toBe(true);
      if (parsed.ok && parsed.request.action === 'ban') {
        expect(parsed.request.reason).toHaveLength(200);
      }
    });
  });

  describe('unban', () => {
    it('accepts a uuid', () => {
      expect(parseModerationRequest({ action: 'unban', uid: OTHER }, SELF)).toEqual({
        ok: true,
        request: { action: 'unban', uid: OTHER },
      });
    });

    // Unbanning yourself is harmless, so it is not blocked like kick/ban is.
    it('allows unbanning yourself', () => {
      expect(parseModerationRequest({ action: 'unban', uid: SELF }, SELF)).toEqual({
        ok: true,
        request: { action: 'unban', uid: SELF },
      });
    });
  });

  describe('set_chat', () => {
    it('accepts slow mode alone', () => {
      expect(parseModerationRequest({ action: 'set_chat', slowModeS: 30 }, SELF)).toEqual({
        ok: true,
        request: { action: 'set_chat', slowModeS: 30 },
      });
    });

    it('accepts lock alone', () => {
      expect(parseModerationRequest({ action: 'set_chat', locked: true }, SELF)).toEqual({
        ok: true,
        request: { action: 'set_chat', locked: true },
      });
    });

    it('accepts both together', () => {
      expect(parseModerationRequest({ action: 'set_chat', slowModeS: 0, locked: false }, SELF)).toEqual({
        ok: true,
        request: { action: 'set_chat', slowModeS: 0, locked: false },
      });
    });

    it('rejects an empty update', () => {
      expect(parseModerationRequest({ action: 'set_chat' }, SELF)).toEqual({
        ok: false,
        error: 'nothing_to_update',
      });
    });

    // Mirrors the CHECK constraint on station.slow_mode_s (0-300), so a bad value is
    // rejected here with a readable error instead of as a raw Postgres violation.
    it('rejects slow mode above the column limit', () => {
      expect(parseModerationRequest({ action: 'set_chat', slowModeS: 301 }, SELF)).toEqual({
        ok: false,
        error: 'invalid_slow_mode',
      });
    });

    it('rejects a negative slow mode', () => {
      expect(parseModerationRequest({ action: 'set_chat', slowModeS: -1 }, SELF)).toEqual({
        ok: false,
        error: 'invalid_slow_mode',
      });
    });

    it('rejects a fractional slow mode', () => {
      expect(parseModerationRequest({ action: 'set_chat', slowModeS: 2.5 }, SELF)).toEqual({
        ok: false,
        error: 'invalid_slow_mode',
      });
    });

    it('rejects a non-boolean lock', () => {
      expect(parseModerationRequest({ action: 'set_chat', locked: 'yes' }, SELF)).toEqual({
        ok: false,
        error: 'invalid_locked',
      });
    });
  });
});
