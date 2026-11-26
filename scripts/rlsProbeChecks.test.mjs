import { describe, it, expect } from 'vitest';
import { insertRefused, updateRefused, deleteRefused, selectHidden, rpcAnswers, summarize } from './rlsProbeChecks.mjs';

// In-memory stand-in for a Supabase client. A "locked" client behaves like RLS refusing it:
// inserts error, updates and deletes silently touch zero rows, selects return nothing.
function makeStore(tables) {
  const store = structuredClone(tables);
  const matches = (row, match) => Object.entries(match).every(([k, v]) => row[k] === v);
  const db = (locked) => ({
    async insert(t, row) {
      if (locked) return { data: null, error: { code: '42501', message: 'permission denied' } };
      store[t].push({ ...row });
      return { data: null, error: null };
    },
    async update(t, match, patch) {
      if (!locked) store[t].filter((r) => matches(r, match)).forEach((r) => Object.assign(r, patch));
      return { data: [], error: null };
    },
    async remove(t, match) {
      if (!locked) store[t] = store[t].filter((r) => !matches(r, match));
      return { data: [], error: null };
    },
    async select(t, match, limit = 1000) {
      return { data: locked ? [] : store[t].filter((r) => matches(r, match)).slice(0, limit), error: null };
    },
  });
  return { store, admin: db(false), locked: db(true), open: db(false) };
}

describe('insertRefused', () => {
  it('passes when the write is refused', async () => {
    const { admin, locked } = makeStore({ bans: [] });
    const r = await insertRefused({ attacker: locked, admin, table: 'bans', row: { uid: 'u1' }, match: { uid: 'u1' } });
    expect(r.pass).toBe(true);
  });
  it('fails, and removes the row, when the write went through', async () => {
    const s = makeStore({ bans: [] });
    const r = await insertRefused({ attacker: s.open, admin: s.admin, table: 'bans', row: { uid: 'u1' }, match: { uid: 'u1' } });
    expect(r.pass).toBe(false);
    expect(s.store.bans).toHaveLength(0);
  });
});

describe('updateRefused', () => {
  const seed = () => makeStore({ station: [{ id: true, live_title: 'Real title' }] });
  it('passes when RLS filters the update to zero rows (no error)', async () => {
    const s = seed();
    const r = await updateRefused({ attacker: s.locked, admin: s.admin, table: 'station', match: { id: true }, patch: { live_title: 'rls-probe' } });
    expect(r.pass).toBe(true);
  });
  it('fails, and restores the original, when the update went through', async () => {
    const s = seed();
    const r = await updateRefused({ attacker: s.open, admin: s.admin, table: 'station', match: { id: true }, patch: { live_title: 'rls-probe' } });
    expect(r.pass).toBe(false);
    expect(s.store.station[0].live_title).toBe('Real title');
  });
  it('skips, never passes, when there is no row to test', async () => {
    const s = makeStore({ station: [] });
    const r = await updateRefused({ attacker: s.open, admin: s.admin, table: 'station', match: { id: true }, patch: { live_title: 'x' } });
    expect(r.pass).toBeNull();
  });
});

describe('deleteRefused', () => {
  const seed = () => makeStore({ scheduled_shows: [{ id: 'f1', title: 'fixture' }] });
  it('passes when the row survives', async () => {
    const s = seed();
    const r = await deleteRefused({ attacker: s.locked, admin: s.admin, table: 'scheduled_shows', match: { id: 'f1' } });
    expect(r.pass).toBe(true);
  });
  it('fails, and puts the row back, when the delete went through', async () => {
    const s = seed();
    const r = await deleteRefused({ attacker: s.open, admin: s.admin, table: 'scheduled_shows', match: { id: 'f1' } });
    expect(r.pass).toBe(false);
    expect(s.store.scheduled_shows).toEqual([{ id: 'f1', title: 'fixture' }]);
  });
});

describe('selectHidden', () => {
  it('passes when rows exist but the attacker sees none', async () => {
    const s = makeStore({ admin_audit: [{ action: 'x' }] });
    expect((await selectHidden({ attacker: s.locked, admin: s.admin, table: 'admin_audit' })).pass).toBe(true);
  });
  it('fails when the attacker can see rows', async () => {
    const s = makeStore({ admin_audit: [{ action: 'x' }] });
    expect((await selectHidden({ attacker: s.open, admin: s.admin, table: 'admin_audit' })).pass).toBe(false);
  });
  it('skips on an empty table: an empty result there proves nothing', async () => {
    const s = makeStore({ admin_audit: [] });
    expect((await selectHidden({ attacker: s.locked, admin: s.admin, table: 'admin_audit' })).pass).toBeNull();
  });
});

// What supabase-js really returns when the database refuses: `data: null` plus an error.
// The first live run crashed on exactly this (2026-11-26), because `= []` does not replace null.
const refused = { data: null, error: { code: '42501', message: 'permission denied' } };
const deny = (db) => ({ ...db, select: async () => refused, update: async () => refused, remove: async () => refused });
const brokenAdmin = (db) => ({ ...db, select: async () => ({ data: null, error: { code: 'PGRST000', message: 'down' } }) });

describe('a refusal that comes back as data: null', () => {
  it('selectHidden passes and names the refusal', async () => {
    const s = makeStore({ admin_audit: [{ action: 'x' }] });
    const r = await selectHidden({ attacker: deny(s.locked), admin: s.admin, table: 'admin_audit' });
    expect(r).toEqual({ pass: true, detail: 'refused: 42501' });
  });
  it('update and delete checks pass when the attacker gets data: null', async () => {
    const s = makeStore({ station: [{ id: true, live_title: 'a' }] });
    expect((await updateRefused({ attacker: deny(s.locked), admin: s.admin, table: 'station', match: { id: true }, patch: { live_title: 'b' } })).pass).toBe(true);
    expect((await deleteRefused({ attacker: deny(s.locked), admin: s.admin, table: 'station', match: { id: true } })).pass).toBe(true);
  });
  it('a failed privileged read is a SKIP, never a PASS, in every check', async () => {
    const s = makeStore({ bans: [], station: [{ id: true, live_title: 'a' }], admin_audit: [{ action: 'x' }] });
    const admin = brokenAdmin(s.admin);
    expect((await insertRefused({ attacker: s.locked, admin, table: 'bans', row: { uid: 'u1' }, match: { uid: 'u1' } })).pass).toBeNull();
    expect((await updateRefused({ attacker: s.locked, admin, table: 'station', match: { id: true }, patch: { live_title: 'b' } })).pass).toBeNull();
    expect((await deleteRefused({ attacker: s.locked, admin, table: 'station', match: { id: true } })).pass).toBeNull();
    expect((await selectHidden({ attacker: s.locked, admin, table: 'admin_audit' })).pass).toBeNull();
  });
});

describe('rpcAnswers', () => {
  it('passes when the function answers, including an empty schedule', () => {
    expect(rpcAnswers({ data: '2026-11-26T10:00:00Z', error: null }).pass).toBe(true);
    expect(rpcAnswers({ data: [], error: null }, { list: true }).pass).toBe(true);
  });
  it('fails when the call is refused, so a missing execute grant cannot hide', () => {
    expect(rpcAnswers({ data: null, error: { code: '42501', message: 'permission denied' } }, { list: true }))
      .toEqual({ pass: false, detail: 'refused: 42501' });
  });
  it('fails when a list call answers with something that is not a list', () => {
    expect(rpcAnswers({ data: null, error: null }, { list: true }).pass).toBe(false);
  });
});

describe('summarize', () => {
  it('reports ALL PASS only when every check ran and passed', () => {
    expect(summarize([{ pass: true }, { pass: true }])).toEqual({ ok: true, line: 'ALL 2 PROBES PASS' });
  });
  it('never reports a skipped check as a pass', () => {
    expect(summarize([{ pass: true }, { pass: null }]).ok).toBe(false);
  });
  it('fails on any failed check', () => {
    expect(summarize([{ pass: true }, { pass: false }]).line).toBe('1 PROBE(S) FAILED');
  });
  it('selftest is OK only when every check caught the privileged write', () => {
    expect(summarize([{ pass: false }, { pass: false }], { selftest: true }).ok).toBe(true);
    expect(summarize([{ pass: false }, { pass: true }], { selftest: true }).ok).toBe(false);
    expect(summarize([{ pass: null }], { selftest: true }).ok).toBe(false);
  });
});
