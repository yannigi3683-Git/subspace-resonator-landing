import { existsSync as fsExistsSync, rmSync as fsRmSync } from 'node:fs';
import { readdir as fsReaddir, stat as fsStat } from 'node:fs/promises';
import { tmpdir as osTmpdir } from 'node:os';
import { join } from 'node:path';

export const STALE_DIR_MS = 60 * 60 * 1000;

// Reclaim outDirs a previous run couldn't delete (see makeCleanup's EPERM note). Only dirs idle
// for STALE_DIR_MS are touched: start-restreamer.bat is double-clickable, and a second launch must
// never delete the segments of a show that is already on air. Returns how many were removed.
export async function sweepStaleTempDirs({
  now = Date.now(),
  tmpdir = osTmpdir,
  readdir = fsReaddir,
  stat = fsStat,
  rmSync = fsRmSync,
} = {}) {
  const base = tmpdir();
  const cutoff = now - STALE_DIR_MS;
  const names = (await readdir(base).catch(() => [])).filter((f) => f.startsWith('restreamer-'));
  let swept = 0;
  for (const name of names) {
    const dir = join(base, name);
    try {
      if ((await stat(dir)).mtimeMs > cutoff) continue;
      rmSync(dir, { recursive: true, force: true });
      swept++;
    } catch {}
  }
  return swept;
}

// One teardown path for a single restream attempt's resources, shared by the intentional stop, the
// failed-startup path, and the ffmpeg-died-mid-show handler — before this existed the exit handler
// leaked the pull/sink/dir. Killing ffmpeg then immediately removing its outDir races Windows
// releasing the file handles (EPERM), so the remove retries with backoff. fs fns are injectable for
// tests.
export function makeCleanup({ ff, pull, sink, outDir, existsSync = fsExistsSync, rmSync = fsRmSync, log = () => {} }) {
  return function cleanup() {
    try { ff.kill('SIGKILL'); } catch {}
    pull.close();
    sink.stop();
    // ffmpeg runs with cwd=outDir, and Windows refuses to delete a directory that is any live
    // process's cwd — so this throws EPERM when the killed process hasn't released it inside the
    // retry budget. That is a leftover temp dir, not a startup failure: swallow it, because
    // letting it propagate REPLACED the caller's real error ("no HLS segments produced within
    // timeout") and the log then told the wrong story (2026-07-26 incident). The boot sweep in
    // index.mjs reclaims whatever is left behind.
    try {
      if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch (e) {
      log('temp dir left behind (harmless):', outDir, e.message);
    }
  };
}
