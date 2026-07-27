import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAal, moderationErrorMessage, useModeration } from './useModeration';
import { makeSupabaseFake } from '../test-utils';

function tokenWithAal(aal: string): string {
  return `header.${btoa(JSON.stringify({ sub: 'u1', aal }))}.sig`;
}

describe('readAal', () => {
  it('reads aal2 from an elevated token', () => {
    expect(readAal(tokenWithAal('aal2'))).toBe('aal2');
  });

  it('reads aal1 from an anonymous listener token', () => {
    expect(readAal(tokenWithAal('aal1'))).toBe('aal1');
  });

  it('defaults to aal1 when the claim is missing, the token is junk, or there is no session', () => {
    expect(readAal(`header.${btoa(JSON.stringify({ sub: 'u1' }))}.sig`)).toBe('aal1');
    expect(readAal('not-a-jwt')).toBe('aal1');
    expect(readAal(null)).toBe('aal1');
    expect(readAal(undefined)).toBe('aal1');
  });
});

describe('moderationErrorMessage', () => {
  it('tells the host to sign in again when the session is no longer elevated', () => {
    expect(moderationErrorMessage(403, 'not_aal2')).toMatch(/sign in again/i);
  });

  it('reports a non-admin account plainly', () => {
    expect(moderationErrorMessage(403, 'not_admin')).toMatch(/cannot moderate/i);
  });

  it('names the self-moderation guard', () => {
    expect(moderationErrorMessage(400, 'cannot_moderate_self')).toBe('That is you.');
  });

  it('falls back to a generic message for anything else', () => {
    expect(moderationErrorMessage(500, 'boom')).toMatch(/try again/i);
  });
});

describe('useModeration', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fakeWithToken(token: string | null) {
    const supabase = makeSupabaseFake();
    supabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: token ? { access_token: token } : null },
      error: null,
    });
    return supabase as unknown as SupabaseClient;
  }

  it('does not offer moderation to an anonymous listener', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal1'))));
    await waitFor(() => expect(result.current.canModerate).toBe(false));
  });

  it('does not offer moderation when there is no session at all', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(null)));
    await waitFor(() => expect(result.current.canModerate).toBe(false));
  });

  it('offers moderation to an elevated host session', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));
    await waitFor(() => expect(result.current.canModerate).toBe(true));
  });

  it('posts a delete with the message id', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2')), '/api/rtc-session'));
    await waitFor(() => expect(result.current.canModerate).toBe(true));
    await act(async () => { await result.current.deleteMessage('msg-1'); });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/rtc-session');
    expect(JSON.parse(init.body)).toEqual({ phase: 'moderate', action: 'delete_message', messageId: 'msg-1' });
    expect(init.headers.Authorization).toBe(`Bearer ${tokenWithAal('aal2')}`);
  });

  it('posts a ban with device id and reason', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));
    await act(async () => { await result.current.ban('uid-1', 'dev-1', 'hate speech'); });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      phase: 'moderate',
      action: 'ban',
      uid: 'uid-1',
      deviceId: 'dev-1',
      reason: 'hate speech',
    });
  });

  it('posts a kick', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));
    await act(async () => { await result.current.kick('uid-1', 'dev-1'); });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      action: 'kick',
      uid: 'uid-1',
      deviceId: 'dev-1',
    });
  });

  it('posts chat settings', async () => {
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));
    await act(async () => { await result.current.setChat({ slowModeS: 30, locked: true }); });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      phase: 'moderate',
      action: 'set_chat',
      slowModeS: 30,
      locked: true,
    });
  });

  it('surfaces a readable error when the server refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden', reason: 'not_aal2' }),
    });
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));

    let ok = true;
    await act(async () => { ok = await result.current.ban('uid-1'); });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toMatch(/sign in again/i));

    act(() => result.current.clearError());
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('surfaces a network failure instead of throwing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useModeration(fakeWithToken(tokenWithAal('aal2'))));

    let ok = true;
    await act(async () => { ok = await result.current.deleteMessage('msg-1'); });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toMatch(/network/i));
  });
});
