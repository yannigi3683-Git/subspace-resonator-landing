// Timestamped logging that also survives the console window closing.
//
// The restreamer's only record used to be the console window it prints to, which dies with the
// process. A host who is away from the screen (the normal case — GO LIVE is triggered from
// wherever they are DJing) had no way to answer "what happened at 14:52". Reconstructing one host
// reconnect on 2026-08-21 took an R2 bucket listing and a process-start-time check.
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs');

// Returns a log(...args) with the same console shape as before, that additionally appends to
// logs/YYYY-MM-DD.log. A file that cannot be written is given up on permanently: a full disk or a
// read-only folder must never take a live broadcast down, and retrying every line would bury the
// console in errors at exactly the moment the host needs to read it.
export function makeLog({ dir = DEFAULT_DIR, out = console.log, clock = () => new Date() } = {}) {
  let stream = null;
  let day = null;
  let broken = false;

  return (...args) => {
    const at = clock();
    const msg = format(...args);
    out(at.toISOString().slice(11, 19), msg);
    if (broken) return;
    try {
      const today = at.toISOString().slice(0, 10);
      if (today !== day) {
        stream?.end();
        mkdirSync(dir, { recursive: true });
        stream = createWriteStream(join(dir, `${today}.log`), { flags: 'a' });
        // Async write failures surface here, not from write(), so they need their own handler or
        // they become an unhandled 'error' event and kill the process.
        stream.on('error', () => { broken = true; });
        day = today;
      }
      // Full ISO date in the file: the console only ever needed the time of day, but a log read
      // days later needs to say which broadcast it belongs to.
      stream.write(`${at.toISOString()} ${msg}\n`);
    } catch {
      broken = true;
    }
  };
}
