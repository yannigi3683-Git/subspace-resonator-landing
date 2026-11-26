// The checks behind scripts/rls-probe.mjs, kept free of Supabase so they can be tested offline.
//
// Every check confirms the outcome with a privileged read instead of trusting the attacker's
// response. Two ways a refused write can look in PostgREST: an error (insert without a grant or
// policy), or 200 with zero rows (update/delete filtered out by RLS). The old probe treated any
// non-OK response as PASS while authenticating with a key that is always rejected, so it could
// never fail. Here a check fails only when the privileged read shows the write really happened,
// and it puts the data back when it does.
//
// `db` objects expose: insert(table,row), update(table,match,patch), remove(table,match),
// select(table,match,limit). Each resolves to { data, error }.

export const PROBE_TAG = 'rls-probe';
export const PAST_ISO = '2000-01-01T00:00:00.000Z';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// supabase-js answers a refused or failed request with `data: null`, and a destructuring default
// only replaces `undefined`, so every read goes through these. A privileged read that errors means
// the outcome cannot be confirmed: that is a SKIP, never a PASS.
const rows = (res) => (Array.isArray(res?.data) ? res.data : []);
const unconfirmed = (res) => (res?.error ? { pass: null, detail: `could not confirm (${res.error.code ?? res.error.message})` } : null);

export async function insertRefused({ attacker, admin, table, row, match }) {
  const attempt = await attacker.insert(table, row);
  const check = await admin.select(table, match);
  if (unconfirmed(check)) return unconfirmed(check);
  const leaked = rows(check);
  if (leaked.length) {
    await admin.remove(table, match);
    return { pass: false, detail: `insert went through (${leaked.length} row, removed)` };
  }
  return { pass: true, detail: attempt?.error ? `refused: ${attempt.error.code ?? attempt.error.message}` : 'no row written' };
}

export async function updateRefused({ attacker, admin, table, match, patch }) {
  const first = await admin.select(table, match, 1);
  if (unconfirmed(first)) return unconfirmed(first);
  const before = rows(first);
  if (!before.length) return { pass: null, detail: 'no row to test against' };
  const original = Object.fromEntries(Object.keys(patch).map((k) => [k, before[0][k]]));
  await attacker.update(table, match, patch);
  const second = await admin.select(table, match, 1);
  if (unconfirmed(second)) return unconfirmed(second);
  const after = rows(second);
  const now = Object.fromEntries(Object.keys(patch).map((k) => [k, after[0]?.[k]]));
  if (!same(now, original)) {
    await admin.update(table, match, original);
    return { pass: false, detail: 'update went through (restored)' };
  }
  return { pass: true, detail: 'row unchanged' };
}

export async function deleteRefused({ attacker, admin, table, match, restoreRow }) {
  const first = await admin.select(table, match, 1);
  if (unconfirmed(first)) return unconfirmed(first);
  const before = rows(first);
  if (!before.length) return { pass: null, detail: 'no row to test against' };
  await attacker.remove(table, match);
  const second = await admin.select(table, match, 1);
  if (unconfirmed(second)) return unconfirmed(second);
  if (!rows(second).length) {
    await admin.insert(table, restoreRow ?? before[0]);
    return { pass: false, detail: 'delete went through (row put back)' };
  }
  return { pass: true, detail: 'row still there' };
}

export async function selectHidden({ attacker, admin, table }) {
  const check = await admin.select(table, {}, 1);
  if (unconfirmed(check)) return unconfirmed(check);
  if (!rows(check).length) return { pass: null, detail: 'table is empty, nothing to leak' };
  const attempt = await attacker.select(table, {}, 1);
  const seen = rows(attempt);
  if (seen.length) return { pass: false, detail: `${seen.length} row visible` };
  return { pass: true, detail: attempt?.error ? `refused: ${attempt.error.code ?? attempt.error.message}` : 'no rows visible' };
}

// The opposite of the checks above: a call that MUST work for a visitor (an execute grant).
export function rpcAnswers(res, { list = false } = {}) {
  if (res?.error) return { pass: false, detail: `refused: ${res.error.code ?? res.error.message}` };
  const ok = list ? Array.isArray(res?.data) : res?.data != null;
  return ok ? { pass: true, detail: 'answered' } : { pass: false, detail: 'no answer' };
}

// pass: true = PASS, false = FAIL, null = SKIP (could not be tested, never counted as a pass).
export function summarize(results, { selftest = false } = {}) {
  const tested = results.filter((r) => r.pass !== null);
  const skipped = results.length - tested.length;
  if (selftest) {
    const missed = tested.filter((r) => r.pass);
    return {
      ok: tested.length > 0 && missed.length === 0,
      line: missed.length === 0 && tested.length > 0
        ? `SELFTEST OK: all ${tested.length} checks caught the privileged writes${skipped ? ` (${skipped} skipped)` : ''}`
        : `SELFTEST BROKEN: ${missed.length} of ${tested.length} checks reported PASS for a write that went through`,
    };
  }
  const failed = tested.filter((r) => !r.pass);
  if (failed.length) return { ok: false, line: `${failed.length} PROBE(S) FAILED` };
  if (skipped) return { ok: false, line: `INCOMPLETE: ${tested.length} passed, ${skipped} could not be tested` };
  return { ok: true, line: `ALL ${tested.length} PROBES PASS` };
}
