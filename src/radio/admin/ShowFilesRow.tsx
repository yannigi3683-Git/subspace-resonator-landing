import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, X } from 'lucide-react';
import type { ShowFileEntry, ShowFiles, StorageInfo } from '../showFiles';
import { ISRAEL, overrun, type NeonMode, type Show } from '../scheduleRules';
import { formatSetClock } from '../format';

// A show's FILES row in the SCHEDULE tab (SCHEDULE RUNNER, Release 2, spec 4.1). Files are copied
// into this browser's storage on the PC that will play the show; nothing is uploaded. Every call
// into storage is caught: this renders beside the live GoLivePanel's tab, and a disk error must
// read as a message, never as a crash.
interface Props {
  show: Show;
  shows: Show[];
  lib: ShowFiles;
  durable: boolean;
  assignHere: boolean;
  onNeon: (mode: NeonMode) => Promise<boolean>;
}

const ROW_DRAG = 'text/x-show-file';
const FAILED = 'Could not change the files on this PC.';
const SQ = 'w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground disabled:opacity-30 disabled:border-transparent';
const BTN = 'font-mono text-[11px] tracking-widest min-h-[44px] border';

const hhmmIsrael = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: ISRAEL, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const clock = (ms: number) => formatSetClock(ms / 1000);
const plural = (n: number) => `${n} file${n === 1 ? '' : 's'}`;

export default function ShowFilesRow({ show, shows, lib, durable, assignHere, onNeon }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ShowFileEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const alive = useRef(true);
  const canEdit = assignHere && durable;

  const refresh = useCallback(async () => {
    try {
      const list = await lib.list(show.id);
      if (!alive.current) return;
      setEntries(list);
      setDrafts(Object.fromEntries(list.map((e) => [e.id, e.displayName])));
    } catch {
      if (alive.current) setProblem(FAILED);
    }
  }, [lib, show.id]);

  useEffect(() => {
    alive.current = true;
    if (canEdit) void refresh();
    return () => { alive.current = false; };
  }, [canEdit, refresh]);

  useEffect(() => {
    if (!open || !canEdit) return;
    lib.storageInfo().then((info) => { if (alive.current) setStorage(info); }, () => {});
  }, [open, canEdit, lib, entries.length]);

  async function run(change: () => Promise<unknown>) {
    try {
      await change();
      if (alive.current) setProblem(null);
    } catch {
      if (alive.current) setProblem(FAILED);
    }
    await refresh();
  }

  async function addFiles(picked: File[]) {
    if (busy || !picked.length) return;
    setBusy(true);
    setProblem(null);
    try {
      const { failed } = await lib.add(show.id, picked, (name, f) => {
        if (alive.current) setProgress(`Copying ${name} · ${Math.round(f * 100)}%`);
      });
      if (alive.current && failed.length) setProblem(failed.map((x) => `Not added: ${x.name}. ${x.reason}.`).join(' '));
    } catch {
      if (alive.current) setProblem(FAILED);
    } finally {
      if (alive.current) { setBusy(false); setProgress(null); }
    }
    await refresh();
  }

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= entries.length) return;
    const ids = entries.map((e) => e.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    void run(() => lib.reorder(show.id, ids));
  }

  function commitName(e: ShowFileEntry) {
    const next = (drafts[e.id] ?? '').trim();
    if (!next || next === e.displayName) {
      setDrafts((d) => ({ ...d, [e.id]: e.displayName }));
      return;
    }
    void run(() => lib.rename(show.id, e.id, next));
  }

  function onEditorDrop(ev: DragEvent) {
    const files = Array.from(ev.dataTransfer?.files ?? []);
    if (!files.length) return;
    ev.preventDefault();
    void addFiles(files);
  }

  const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0);
  const startMs = Date.parse(show.starts_at);
  const late = entries.length ? overrun(show, totalMs, shows) : null;
  const neon: NeonMode = show.neon_mode ?? 'tracks';
  // Parts, not one string, so a narrow screen wraps only between parts ("on / this PC" read badly).
  const parts = !assignHere
    ? ['FILES', 'assign on the broadcasting PC']
    : !durable
      ? ['FILES', 'this browser cannot keep files']
      : entries.length
        ? ['FILES', plural(entries.length), clock(totalMs), 'on this PC']
        : ['FILES', 'none on this PC'];
  const usageMb = storage?.usage != null ? Math.round(storage.usage / (1024 * 1024)) : null;

  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} aria-label={parts.join(' · ')} onClick={() => setOpen((o) => !o)}
        className={`${BTN} px-3 text-left flex items-center justify-between gap-2 ${canEdit && entries.length ? 'border-emerald-500/60 text-emerald-300' : 'border-dashed border-border text-muted-foreground'}`}>
        <span className="min-w-0">
          {parts.map((p, i) => <span key={p}>{i > 0 && ' · '}<span className="whitespace-nowrap">{p}</span></span>)}
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      </button>

      {open && !assignHere && (
        <p className="font-mono text-[11px] text-muted-foreground border border-border p-3 leading-relaxed">
          Files are added on the PC that will play the show. Open the console there.
        </p>
      )}
      {open && assignHere && !durable && (
        <p className="font-mono text-[11px] text-amber-400 border border-amber-500/60 p-3 leading-relaxed">
          This browser cannot keep show files. Use Chrome on the PC that will play the show.
        </p>
      )}

      {open && canEdit && (
        <div data-testid="files-editor" className="border border-border p-3 flex flex-col gap-3 bg-white/[0.02]"
          onDragOver={(ev) => { if (Array.from(ev.dataTransfer?.types ?? []).includes('Files')) ev.preventDefault(); }}
          onDrop={onEditorDrop}>
          {problem && (
            <p role="alert" className="font-mono text-[11px] text-red-400 border border-red-500/60 bg-red-500/10 p-2 leading-relaxed flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{problem}</span>
            </p>
          )}

          {entries.length ? entries.map((e, i) => (
            <div key={e.id} data-testid="file-row" draggable
              onDragStart={(ev) => { ev.dataTransfer.setData(ROW_DRAG, e.id); ev.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(ev) => { if (Array.from(ev.dataTransfer?.types ?? []).includes(ROW_DRAG)) ev.preventDefault(); }}
              onDrop={(ev) => {
                const id = ev.dataTransfer?.getData(ROW_DRAG);
                if (!id) return;
                ev.preventDefault();
                ev.stopPropagation();
                move(entries.findIndex((x) => x.id === id), i);
              }}
              className="flex flex-col gap-1 border-b border-border/60 pb-3 cursor-grab active:cursor-grabbing">
              <label htmlFor={`neon-${show.id}-${e.id}`} className="font-mono text-[10px] tracking-widest text-muted-foreground">
                TRACK {i + 1} · NEON NAME
              </label>
              <input id={`neon-${show.id}-${e.id}`} value={drafts[e.id] ?? e.displayName} maxLength={80}
                onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                onBlur={() => commitName(e)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                className="w-full bg-transparent border border-border px-2 font-mono text-xs min-h-[44px] text-white focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground flex min-w-0 gap-1">
                  <span className="truncate" title={e.fileName}>{e.fileName}</span>
                  <span className="shrink-0 tabular-nums">· {clock(e.durationMs)}</span>
                </span>
                <div className="flex gap-1 shrink-0">
                  <button type="button" disabled={i === 0} aria-label={`Move ${e.displayName} up`} onClick={() => move(i, i - 1)} className={`${SQ} hover:text-white`}>
                    <ChevronUp className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                  </button>
                  <button type="button" disabled={i === entries.length - 1} aria-label={`Move ${e.displayName} down`} onClick={() => move(i, i + 1)} className={`${SQ} hover:text-white`}>
                    <ChevronDown className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                  </button>
                  <button type="button" aria-label={`Remove ${e.displayName}`} onClick={() => void run(() => lib.remove(show.id, e.id))} className={`${SQ} hover:text-red-400`}>
                    <X className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">No files yet. Add the set this show should play, or drop files here.</p>
          )}

          <input data-testid="files-input" type="file" multiple accept="audio/*" className="hidden" aria-hidden="true" tabIndex={-1}
            onChange={(ev) => { const files = Array.from(ev.target.files ?? []); ev.target.value = ''; void addFiles(files); }} />
          <button type="button" disabled={busy} aria-busy={busy}
            onClick={(ev) => (ev.currentTarget.previousElementSibling as HTMLInputElement | null)?.click()}
            className={`${BTN} ${busy ? 'border-border text-muted-foreground/60' : 'border-primary text-white bg-primary/20 hover:bg-primary/30'}`}>
            {busy ? 'COPYING...' : 'ADD FILES'}
          </button>
          {progress && <p aria-live="polite" className="font-mono text-[11px] text-[#26C6DA]">{progress}</p>}

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground">NEON SHOWS</span>
            <div className="grid grid-cols-2 gap-2">
              {(['tracks', 'title'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={neon === m} onClick={() => { if (neon !== m) void onNeon(m); }}
                  className={`${BTN} ${neon === m ? 'border-primary text-white bg-primary/20' : 'border-border text-muted-foreground'}`}>
                  {m === 'tracks' ? 'TRACK NAMES' : 'SHOW TITLE'}
                </button>
              ))}
            </div>
          </div>

          {entries.length > 0 && Number.isFinite(startMs) && (
            <p className="font-mono text-[11px] text-white">Total {clock(totalMs)} · ends about {hhmmIsrael(startMs + totalMs)} Israel</p>
          )}
          {late && (
            <p className="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Runs {late.minutes} min into {late.next.title}. That show will start when this one ends.</span>
            </p>
          )}
          {storage && !storage.persisted && (
            <p className="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>The browser may clear these files if the disk fills up.</span>
            </p>
          )}
          {storage && (
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Copied into the console&apos;s storage on this PC, nothing is uploaded.
              {usageMb !== null && ` Using ${usageMb} MB on this PC.`}
              {storage.persisted && ' Storage is protected.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
