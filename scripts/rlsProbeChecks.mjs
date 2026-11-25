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

export async function insertRefused({ attacker, admin, table, row, match }) {
  const attempt = await attacker.insert(table, row);
  const { data: leaked = [] } = await admin.select(table, match);
  if (leaked.length) {
    await admin.remove(table, match);
    return { pass: false, detail: `insert went through (${leaked.length} row, removed)` };
  }
  return { pass: true, detail: attempt.error ? `refused: ${attempt.error.code ?? attempt.error.message}` : 'no row written' };
}

export async function updateRefused({ attacker, admin, table, match, patch }) {
  const { data: before = [] } = await admin.select(table, match, 1);
  if (!before.length) return { pass: null, detail: 'no row to test against' };
  const original = Object.fromEntries(Object.keys(patch).map((k) => [k, before[0][k]]));
  await attacker.update(table, match, patch);
  const { data: after = [] } = await admin.select(table, match, 1);
  const now = Object.fromEntries(Object.keys(patch).map((k) => [k, after[0]?.[k]]));
  if (!same(now, original)) {
    await admin.update(table, match, original);
    return { pass: false, detail: 'update went through (restored)' };
  }
  return { pass: true, detail: 'row unchanged' };
}

export async function deleteRefused({ attacker, admin, table, match, restoreRow }) {
  const { data: before = [] } = await admin.select(table, match, 1);
  if (!before.length) return { pass: null, detail: 'no row to test against' };
  await attacker.remove(table, match);
  const { data: after = [] } = await admin.select(table, match, 1);
  if (!after.length) {
    await admin.insert(table, restoreRow ?? before[0]);
    return { pass: false, detail: 'delete went through (row put back)' };
  }
  return { pass: true, detail: 'row still there' };
}

export async function selectHidden({ attacker, admin, table }) {
  const { data: exists = [] } = await admin.select(table, {}, 1);
  if (!exists.length) return { pass: null, detail: 'table is empty, nothing to leak' };
  const { data: seen = [] } = await attacker.select(table, {}, 1);
  return seen.length ? { pass: false, detail: `${seen.length} row visible` } : { pass: true, detail: 'no rows visible' };
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
