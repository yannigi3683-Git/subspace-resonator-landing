import { existsSync as fsExistsSync, rmSync as fsRmSync } from 'node:fs';

// One teardown path for a single restream attempt's resources, shared by the intentional stop, the
// failed-startup path, and the ffmpeg-died-mid-show handler — before this existed the exit handler
// leaked the pull/sink/dir. Killing ffmpeg then immediately removing its outDir races Windows
// releasing the file handles (EPERM), so the remove retries with backoff. fs fns are injectable for
// tests.
export function makeCleanup({ ff, pull, sink, outDir, existsSync = fsExistsSync, rmSync = fsRmSync }) {
  return function cleanup() {
    try { ff.kill('SIGKILL'); } catch {}
    pull.close();
    sink.stop();
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  };
}
