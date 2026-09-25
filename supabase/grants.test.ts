import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guards the defect class Supabase created on 2026-10-30, when it stopped auto-granting Data
// API access to newly created public tables. A browser-side write needs BOTH an RLS policy and
// a table-level GRANT, and the two fail differently: a missing policy is usually noticed, while
// a missing grant leaves a policy that reads perfectly correct next to a feature that silently
// cannot write. chat_messages shipped in exactly that state -- policy chat_insert present, no
// insert grant -- so on any fresh project chat would have been readable and unpostable.
//
// Scope is client-side writes only. Server-side writes (api/) use the service key, which every
// table already grants `all` to, and which bypasses RLS anyway.
//
// Lives here rather than under src/ because it reads files off disk: tsconfig.app.json sets
// types to vite/client only, so node:fs does not typecheck there, and adding node types to the
// app project would let real app code reach for Node globals. tsconfig.node.json already has
// them, which is the same reason api/importExtensions.test.ts works where it sits.

const ROOT = join(import.meta.dirname, '..');

// .upsert() can insert or update, so it needs both privileges.
const VERB_PRIVILEGES: Record<string, string[]> = {
  insert: ['insert'],
  upsert: ['insert', 'update'],
  update: ['update'],
  delete: ['delete'],
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

type Grant = { privileges: string[]; tables: string[]; roles: string[] };

function parseGrants(): Grant[] {
  const dir = join(ROOT, 'supabase');
  const statement = /grant\s+([\s\S]*?)\s+on\s+([\s\S]*?)\s+to\s+([^;]*);/gi;
  const list = (s: string) => s.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .flatMap((f) => [...stripSqlComments(readFileSync(join(dir, f), 'utf8')).matchAll(statement)])
    .map(([, privileges, target, roles]) => ({
      privileges: list(privileges),
      // "grant execute on function foo() to ..." names no table, so it matches nothing below.
      tables: list(target.replace(/^table\s+/i, '')),
      roles: list(roles),
    }));
}

// Every "supabase.from('x') ... .insert(" in the app, tolerant of the chain being split across
// lines. The window stops at the statement's semicolon so a later, unrelated call cannot bleed in.
function clientWrites(): { table: string; verb: string; file: string }[] {
  const found = new Map<string, { table: string; verb: string; file: string }>();
  for (const file of walk(join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/gi)) {
      const rest = source.slice(match.index + match[0].length);
      const statement = rest.slice(0, Math.max(rest.indexOf(';'), 0) || rest.length);
      for (const verb of Object.keys(VERB_PRIVILEGES)) {
        if (statement.includes(`.${verb}(`)) {
          const table = match[1].toLowerCase();
          found.set(`${table}:${verb}`, { table, verb, file: file.slice(ROOT.length + 1) });
        }
      }
    }
  }
  return [...found.values()];
}

const WRITES = clientWrites();
const GRANTS = parseGrants();

describe('schema grants cover every client-side write', () => {
  // Canaries. A regex that quietly stops matching would make every assertion below pass
  // vacuously, which is worse than having no test at all.
  it('finds client-side writes, including the known ones', () => {
    expect(WRITES.length).toBeGreaterThan(0);
    const keys = WRITES.map((w) => `${w.table}:${w.verb}`);
    expect(keys).toContain('chat_messages:insert');
    expect(keys).toContain('site_content:upsert');
  });

  it('parses grants out of the schema files', () => {
    expect(GRANTS.length).toBeGreaterThan(0);
    expect(GRANTS.some((g) => g.tables.includes('chat_messages'))).toBe(true);
  });

  it.each(WRITES)('$file writes $table with .$verb(), so it needs a grant', ({ table, verb }) => {
    for (const privilege of VERB_PRIVILEGES[verb]) {
      const granted = GRANTS.some(
        (g) =>
          g.tables.includes(table) &&
          g.roles.includes('authenticated') &&
          (g.privileges.includes(privilege) || g.privileges.includes('all')),
      );
      expect(granted, `supabase/*.sql needs: grant ${privilege} on ${table} to authenticated`).toBe(true);
    }
  });
});
