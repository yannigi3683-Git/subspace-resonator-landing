import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Guards the outage that shipped three times (974ced0, 082971f, be01237): package.json is
// "type": "module" and Vercel's Node runtime does not bundle sibling files, so an extensionless
// relative import passes tsc and vitest but makes the deployed function die on boot with
// ERR_MODULE_NOT_FOUND — every phase 500s, host and listeners alike.
// Test files are exempt: .vercelignore keeps api/*.test.ts out of the deployment entirely.

const API_DIR = join(import.meta.dirname, '.');
const RELATIVE_IMPORT = /\b(?:import|export)\b[^;]*?\bfrom\s+['"](\.[^'"]*)['"]/g;

function deployedFiles(): string[] {
  return readdirSync(API_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
}

describe('api/ relative imports', () => {
  it('finds the deployed source files', () => {
    expect(deployedFiles().length).toBeGreaterThan(0);
  });

  it.each(deployedFiles())('%s imports siblings with a .js extension', (file) => {
    const source = readFileSync(join(API_DIR, file), 'utf8');
    const bad = [...source.matchAll(RELATIVE_IMPORT)]
      .map((m) => m[1])
      .filter((spec) => !spec.endsWith('.js'));

    expect(bad, `${file}: relative import(s) missing the .js extension`).toEqual([]);
  });
});
