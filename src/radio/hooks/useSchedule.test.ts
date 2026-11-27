import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSchedule } from './useSchedule';

type Op = { m: string; args: unknown[] };
type Reply = { data: unknown; error: { message: string } | null };

// A chainable stand-in for supabase-js. Every builder method is recorded; awaiting the chain asks
// `respond` for the result, so a test can answer per operation (read, insert, update, delete).
function makeSupabase(respond: (table: string, ops: Op[]) => Reply | Promise<Reply>) {
  const calls: Op[][] = [];
  const from = vi.fn((table: string) => {
    const ops: Op[] = [];
    calls.push(ops);
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'gte', 'lt', 'order', 'limit', 'insert', 'update', 'delete', 'eq', 'is']) {
      builder[m] = (...args: unknown[]) => { ops.push({ m, args }); return builder; };
    }
    builder.then = (ok: (r: Reply) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve().then(() => respond(table, ops)).then(ok, bad);
    return builder;
  });
  return { supabase: { from } as unknown as SupabaseClient, from, calls };
}

const has = (ops: Op[], m: string) => ops.some((o) => o.m === m);
const isRead = (ops: Op[]) => has(ops, 'select') && !has(ops, 'insert') && !has(ops, 'update') && !has(ops, 'delete');
const isPastRead = (ops: Op[]) => isRead(ops) && has(ops, 'lt');

const UP = [{ id: 'u1', title: 'Psy Night Vol. 7', starts_at: '2099-01-01T20:00:00Z', aired_at: null }];
const PAST = [{ id: 'p1', title: 'Sunday Session', starts_at: '2000-01-01T20:00:00Z', aired_at: '2000-01-01T20:00:00Z' }];

function readsOk(ops: Op[]): Reply {
  return { data: isPastRead(ops) ? PAST : UP, error: null };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('useSchedule reads', () => {
  it('reads upcoming and the last five past shows on mount, soonest first', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) => readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows.map((s) => s.id)).toEqual(['p1', 'u1']));
    const past = calls.find(isPastRead)!;
    expect(past.find((o) => o.m === 'limit')?.args[0]).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it('reads the table itself, never the guest function, so no show is ever hidden from the host', async () => {
    const { supabase, from } = makeSupabase((_t, ops) => readsOk(ops));
    renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(from).toHaveBeenCalled());
    expect(from.mock.calls.every(([t]) => t === 'scheduled_shows')).toBe(true);
  });

  it('re-reads every 60 s while the tab is visible, and not while it is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { supabase, calls } = makeSupabase((_t, ops) => readsOk(ops));
    renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(calls.filter(isRead)).toHaveLength(2));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls.filter(isRead)).toHaveLength(4);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls.filter(isRead)).toHaveLength(4);
  });

  it('re-reads when the tab becomes visible again', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) => readsOk(ops));
    renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(calls.filter(isRead)).toHaveLength(2));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(calls.filter(isRead)).toHaveLength(4));
  });

  it('keeps the last good list and reports an error when a read fails', async () => {
    let fail = false;
    const { supabase } = makeSupabase((_t, ops) => (fail ? { data: null, error: { message: 'offline' } } : readsOk(ops)));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    fail = true;
    await act(async () => { await result.current.reload(); });
    expect(result.current.shows).toHaveLength(2);
    expect(result.current.error).toMatch(/could not load/i);
  });

  it('never throws, even if the client itself throws', async () => {
    const { supabase } = makeSupabase(() => { throw new Error('boom'); });
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.error).toMatch(/could not load/i));
    expect(result.current.shows).toEqual([]);
  });
});

describe('useSchedule neon mode (Release 2)', () => {
  it('reads each show\'s neon mode', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) => readsOk(ops));
    renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(calls.filter(isRead)).toHaveLength(2));
    expect(calls.filter(isRead).every((ops) => String(ops.find((o) => o.m === 'select')?.args[0]).includes('neon_mode'))).toBe(true);
  });

  it('still loads the schedule when the database does not have the column yet', async () => {
    const { supabase } = makeSupabase((_t, ops) => {
      const cols = String(ops.find((o) => o.m === 'select')?.args[0]);
      return cols.includes('neon_mode')
        ? { data: null, error: { message: 'column scheduled_shows.neon_mode does not exist' } }
        : readsOk(ops);
    });
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows.map((s) => s.id)).toEqual(['p1', 'u1']));
    expect(result.current.error).toBeNull();
  });

  it('saves a neon mode on its own', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) => (has(ops, 'update') ? { data: [{ id: 'u1' }], error: null } : readsOk(ops)));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let ok = false;
    await act(async () => { ok = await result.current.update('u1', { neon_mode: 'title' }); });
    expect(ok).toBe(true);
    expect(calls.find((ops) => has(ops, 'update'))?.find((o) => o.m === 'update')?.args[0]).toEqual({ neon_mode: 'title' });
  });
});

describe('useSchedule writes', () => {
  it('adds a show, then re-reads', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) =>
      has(ops, 'insert') ? { data: [{ id: 'n1' }], error: null } : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let ok = false;
    await act(async () => { ok = await result.current.add('Goa Classics', '2099-02-01T20:00:00.000Z'); });
    expect(ok).toBe(true);
    const insert = calls.find((ops) => has(ops, 'insert'))!;
    expect(insert.find((o) => o.m === 'insert')?.args[0]).toEqual({ title: 'Goa Classics', starts_at: '2099-02-01T20:00:00.000Z' });
    expect(calls.filter(isRead).length).toBeGreaterThanOrEqual(4);
  });

  it('ignores a second add while the first is still saving (a double tap cannot insert twice)', async () => {
    let release: (r: Reply) => void = () => {};
    const { supabase, calls } = makeSupabase((_t, ops) =>
      has(ops, 'insert') ? new Promise<Reply>((r) => { release = r; }) : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let first: Promise<boolean> = Promise.resolve(false);
    let second = true;
    await act(async () => {
      first = result.current.add('A', '2099-02-01T20:00:00.000Z');
    });
    await waitFor(() => expect(result.current.saving).toBe(true));
    await act(async () => { second = await result.current.add('A', '2099-02-01T20:00:00.000Z'); });
    expect(second).toBe(false);
    await act(async () => { release({ data: [{ id: 'n1' }], error: null }); await first; });
    expect(calls.filter((ops) => has(ops, 'insert'))).toHaveLength(1);
    expect(result.current.saving).toBe(false);
  });

  it('reports a refused insert in plain words', async () => {
    const { supabase } = makeSupabase((_t, ops) =>
      has(ops, 'insert') ? { data: null, error: { message: 'new row violates row-level security policy' } } : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let ok = true;
    await act(async () => { ok = await result.current.add('A', '2099-02-01T20:00:00.000Z'); });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/^Not saved\./);
  });

  it('treats an update that changed zero rows as refused, not as success', async () => {
    const { supabase } = makeSupabase((_t, ops) =>
      has(ops, 'update') ? { data: [], error: null } : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let ok = true;
    await act(async () => { ok = await result.current.update('u1', { title: 'X', starts_at: '2099-01-01T21:00:00.000Z' }); });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/^Not saved\. The server refused the change/);
  });

  it('treats a delete that removed zero rows as refused', async () => {
    const { supabase } = makeSupabase((_t, ops) =>
      has(ops, 'delete') ? { data: [], error: null } : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    let ok = true;
    await act(async () => { ok = await result.current.remove('u1'); });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/^Not deleted\./);
  });

  it('deletes by id and re-reads on success, clearing an earlier error', async () => {
    let refuse = true;
    const { supabase, calls } = makeSupabase((_t, ops) =>
      has(ops, 'delete') ? { data: refuse ? [] : [{ id: 'u1' }], error: null } : readsOk(ops));
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    await act(async () => { await result.current.remove('u1'); });
    expect(result.current.error).not.toBeNull();
    refuse = false;
    let ok = false;
    await act(async () => { ok = await result.current.remove('u1'); });
    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    const del = calls.filter((ops) => has(ops, 'delete')).pop()!;
    expect(del.find((o) => o.m === 'eq')?.args).toEqual(['id', 'u1']);
  });

  it('marks a show aired only if it is not already, and a failure stays quiet', async () => {
    const { supabase, calls } = makeSupabase((_t, ops) =>
      has(ops, 'update') ? { data: null, error: { message: 'nope' } } : readsOk(ops));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useSchedule(supabase));
    await waitFor(() => expect(result.current.shows).toHaveLength(2));
    await act(async () => { await result.current.markAired('u1'); });
    const upd = calls.find((ops) => has(ops, 'update'))!;
    expect(Object.keys(upd.find((o) => o.m === 'update')?.args[0] as object)).toEqual(['aired_at']);
    expect(upd.find((o) => o.m === 'is')?.args).toEqual(['aired_at', null]);
    expect(result.current.error).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
