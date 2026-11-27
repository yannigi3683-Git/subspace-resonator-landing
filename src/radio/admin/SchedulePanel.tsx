import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarPlus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { ScheduleApi } from '../hooks/useSchedule';
import type { ShowFiles } from '../showFiles';
import ShowFilesRow from './ShowFilesRow';
import {
  GRACE_MS, ISRAEL, formatRelative, hostTimePreview, msToWallTime, validateShow, wallTimeToMs, type Show,
} from '../scheduleRules';

// SCHEDULE RUNNER (Release 2): this PC's copies of each show's files. Absent, the panel is the
// Release 1 panel exactly.
export interface ScheduleFiles {
  lib: ShowFiles;
  durable: boolean;
  assignHere: boolean;
}

interface Props {
  schedule: ScheduleApi;
  getNow?: () => number;
  deviceZone?: string;
  files?: ScheduleFiles;
}

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ISRAEL;
  } catch {
    return ISRAEL;
  }
};
const hhmm = (ms: number, zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const part = (ms: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: ISRAEL, ...opts }).format(new Date(ms)).toUpperCase();
const zoneName = (zone: string) => (zone === ISRAEL ? 'Israel' : hostTimePreview(Date.now(), zone).lines[0]?.split(' ').pop() ?? zone);

const LABEL = 'font-mono text-[11px] tracking-widest text-muted-foreground';
const INPUT = 'bg-transparent border border-border px-3 font-mono text-sm min-h-[44px] text-white focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 [color-scheme:dark]';
const BTN = 'font-mono text-[11px] tracking-widest min-h-[44px] border';
const ICON_BTN = 'w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground';

interface Draft { title: string; start: string }

function Field({ id, label, value, type = 'text', placeholder, hint, autoFocus, onChange }: {
  id: string; label: string; value: string; type?: 'text' | 'datetime-local'; placeholder?: string; hint?: string;
  autoFocus?: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={type === 'text' ? 80 : undefined}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
      {hint && <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Preview({ draft, zone, now, shows, ignoreId }: { draft: Draft; zone: string; now: number; shows: Show[]; ignoreId?: string }) {
  const ms = wallTimeToMs(draft.start, zone);
  if (!Number.isFinite(ms)) return null;
  const p = hostTimePreview(ms, zone);
  const check = validateShow({ title: draft.title || 'x', startsAt: ms }, now, shows, ignoreId);
  return (
    <div className="flex flex-col gap-2">
      <p data-testid="time-preview" className="font-mono text-xs text-white border-l-2 border-[#26C6DA] pl-3 py-1 leading-relaxed">
        {p.lines.map((l) => <span key={l} className="block">{l}</span>)}
        <span className="block text-muted-foreground">{p.utc} · {formatRelative(ms, now)}</span>
      </p>
      {p.abroad && (
        <p className="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Your device is not on Israel time (it is on {zoneName(zone)}). Check the Israel line before saving.</span>
        </p>
      )}
      {check.warnings.map((w) => (
        <p key={w} className="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}

export default function SchedulePanel({ schedule, getNow = Date.now, deviceZone, files }: Props) {
  const zone = deviceZone ?? deviceTimeZone();
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState<Draft>({ title: '', start: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ title: '', start: '' });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  // The pencil and the bin unmount while their row is open, so focus would fall to <body>.
  // Hand it back to the button that opened the row when the row closes.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [returnFocus, setReturnFocus] = useState<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [orphans, setOrphans] = useState<string[]>([]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!returnFocus) return;
    buttons.current.get(returnFocus)?.focus();
    setReturnFocus(null);
  }, [returnFocus]);

  // A refused change is reported at the top of the panel, which can be off screen on a phone after
  // acting on a row further down.
  useEffect(() => {
    if (schedule.error) alertRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [schedule.error]);

  const now = getNow();
  const { shows, saving, error } = schedule;

  // Copies whose show is deleted or older than the five past shows the host sees. Never a show in
  // this list, so a show on air (aired, so past) keeps its files while they play.
  const canKeepFiles = !!files && files.durable && files.assignHere;
  const showIds = shows.map((s) => s.id).join(',');
  useEffect(() => {
    if (!files || !canKeepFiles) return;
    let live = true;
    files.lib.orphans(showIds ? showIds.split(',') : []).then((ids) => { if (live) setOrphans(ids); }, () => {});
    return () => { live = false; };
  }, [files, canKeepFiles, showIds]);
  async function clearOrphans() {
    if (!files) return;
    const ids = orphans;
    for (const id of ids) await files.lib.removeShow(id).catch(() => {});
    setOrphans((o) => o.filter((x) => !ids.includes(x)));
  }
  const startOf = (s: Show) => Date.parse(s.starts_at);
  const upcoming = shows.filter((s) => !s.aired_at && startOf(s) > now - GRACE_MS).sort((a, b) => startOf(a) - startOf(b));
  const past = shows.filter((s) => !upcoming.includes(s)).sort((a, b) => startOf(b) - startOf(a));

  const draftMs = wallTimeToMs(draft.start, zone);
  const canAdd = !saving && validateShow({ title: draft.title, startsAt: draftMs }, now, shows).ok;
  const editMs = wallTimeToMs(editDraft.start, zone);
  const canSave = !saving && validateShow({ title: editDraft.title, startsAt: editMs }, now, shows, editId ?? undefined).ok;

  async function handleAdd() {
    if (!canAdd) return;
    if (await schedule.add(draft.title.trim(), new Date(draftMs).toISOString())) setDraft({ title: '', start: '' });
  }
  function openEdit(s: Show) {
    setConfirmId(null);
    setEditId(s.id);
    setEditDraft({ title: s.title, start: msToWallTime(startOf(s), zone) });
  }
  async function handleSave() {
    if (!editId || !canSave) return;
    const id = editId;
    if (await schedule.update(id, { title: editDraft.title.trim(), starts_at: new Date(editMs).toISOString() })) {
      setEditId(null);
      setReturnFocus(`edit:${id}`);
    }
  }
  const keepRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(id, el);
    else buttons.current.delete(id);
  };
  async function handleDelete(id: string) {
    setConfirmId(null);
    if ((await schedule.remove(id)) && files) await files.lib.removeShow(id).catch(() => {});
  }

  // A plain render function, not a component: a component declared in here would be a new type on
  // every render, so React would rebuild the row and the edit field would lose the cursor per key.
  function renderRow(s: Show, isPast = false) {
    const ms = startOf(s);
    if (editId === s.id) {
      return (
        <div key={s.id} data-testid="show-row" className="border border-primary p-3 flex flex-col gap-3 bg-primary/5">
          <span className="font-mono text-[11px] tracking-widest text-white">EDITING</span>
          <Field id={`edit-title-${s.id}`} label="TITLE" value={editDraft.title} autoFocus onChange={(title) => setEditDraft((d) => ({ ...d, title }))} />
          <Field id={`edit-start-${s.id}`} label="STARTS" type="datetime-local" value={editDraft.start}
            hint={`Your device time (${zoneName(zone)}).`} onChange={(start) => setEditDraft((d) => ({ ...d, start }))} />
          <Preview draft={editDraft} zone={zone} now={now} shows={shows} ignoreId={s.id} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleSave} disabled={!canSave}
              className={`${BTN} ${canSave ? 'border-primary text-white bg-primary/20' : 'border-border text-muted-foreground/50'}`}>SAVE</button>
            <button type="button" onClick={() => { setEditId(null); setReturnFocus(`edit:${s.id}`); }} className={`${BTN} border-border text-muted-foreground`}>CANCEL</button>
          </div>
        </div>
      );
    }
    const confirming = confirmId === s.id;
    const started = !isPast && ms <= now;
    return (
      <div key={s.id} data-testid="show-row"
        className={`border ${confirming ? 'border-red-500/60 bg-red-500/[0.04]' : started ? 'border-amber-500/60' : 'border-border'} p-3 flex flex-col gap-3 ${isPast ? 'opacity-80' : ''}`}>
        <div className="flex items-stretch gap-3">
          <div className="w-14 shrink-0 text-center border-r border-border pr-3 flex flex-col justify-center">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{part(ms, { weekday: 'short' })}</p>
            <p className="font-display text-xl text-white leading-tight">{part(ms, { day: 'numeric' })}</p>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{part(ms, { month: 'short' })}</p>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <p data-testid="show-title" className="font-mono text-sm text-white break-words line-clamp-3 sm:line-clamp-2">{s.title}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              <span className="whitespace-nowrap">{hhmm(ms, ISRAEL)} Israel</span> · <span className="whitespace-nowrap">{hhmm(ms, 'UTC')} UTC</span>
            </p>
            {!isPast && (
              <p className={`font-mono text-[11px] ${started ? 'text-amber-400' : 'text-[#26C6DA]'}`}>
                {formatRelative(ms, now)}{started ? ' · guests see STARTING SOON' : ''}
              </p>
            )}
          </div>
          {!confirming && (
            <div className="flex flex-col sm:flex-row gap-1 shrink-0 items-start">
              {!isPast && (
                <button type="button" ref={keepRef(`edit:${s.id}`)} aria-label={`Edit ${s.title}`} onClick={() => openEdit(s)}
                  className={`${ICON_BTN} hover:text-white hover:border-primary`}>
                  <Pencil className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                </button>
              )}
              <button type="button" ref={keepRef(`del:${s.id}`)} aria-label={`Delete ${s.title}`} onClick={() => { setEditId(null); setConfirmId(s.id); }}
                className={`${ICON_BTN} hover:text-red-400 hover:border-red-500`}>
                <Trash2 className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
        {confirming && (
          <>
            <p className="font-mono text-[11px] text-red-400">
              Delete this show? Guests stop seeing it within a minute.{canKeepFiles ? ' Its files on this PC are removed too.' : ''}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handleDelete(s.id)} className={`${BTN} border-red-500 text-red-400 bg-red-500/10`}>DELETE</button>
              <button type="button" autoFocus onClick={() => { setConfirmId(null); setReturnFocus(`del:${s.id}`); }} className={`${BTN} border-border text-muted-foreground`}>KEEP</button>
            </div>
          </>
        )}
        {files && !isPast && !confirming && (
          <ShowFilesRow show={s} shows={shows} lib={files.lib} durable={files.durable} assignHere={files.assignHere}
            onNeon={(neon_mode) => schedule.update(s.id, { neon_mode })} />
        )}
      </div>
    );
  }

  return (
    <section className="section-border p-4 sm:p-6 flex flex-col gap-6">
      <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">// SCHEDULE</p>

      {error && (
        <p ref={alertRef} role="alert" className="font-mono text-xs text-red-400 border border-red-500/60 bg-red-500/10 p-3 leading-relaxed flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] tracking-widest text-white">NEW SHOW</span>
        <Field id="schedule-title" label="TITLE" value={draft.title} placeholder="Show title"
          onChange={(title) => setDraft((d) => ({ ...d, title }))} />
        <Field id="schedule-start" label="STARTS" type="datetime-local" value={draft.start}
          hint={`Your device time (${zoneName(zone)}).`} onChange={(start) => setDraft((d) => ({ ...d, start }))} />
        <Preview draft={draft} zone={zone} now={now} shows={shows} />
        <button type="button" data-testid="add-show" aria-busy={saving} onClick={handleAdd} disabled={!canAdd}
          className={`${BTN} inline-flex items-center justify-center gap-2 ${canAdd ? 'border-primary text-white bg-primary/20 hover:bg-primary/30' : 'border-border text-muted-foreground/50 cursor-not-allowed'}`}>
          <CalendarPlus className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
          {saving ? 'SAVING...' : 'ADD TO SCHEDULE'}
        </button>
      </div>

      <div className="flex flex-col gap-2 pt-5 border-t border-border/50">
        <span className="font-mono text-[11px] tracking-widest text-white mb-1">UPCOMING ({upcoming.length})</span>
        {upcoming.length
          ? upcoming.map((s) => renderRow(s))
          : <p className="font-mono text-xs text-muted-foreground border border-dashed border-border p-4">Nothing scheduled. Guests see NEXT TRANSMISSION: TBA.</p>}
        <button type="button" onClick={() => setPastOpen((o) => !o)} aria-expanded={pastOpen}
          className="font-mono text-[11px] tracking-widest text-muted-foreground min-h-[44px] inline-flex items-center gap-2 mt-1 self-start">
          {pastOpen ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          PAST ({past.length})
        </button>
        {pastOpen && past.map((s) => renderRow(s, true))}
      </div>

      {orphans.length > 0 && (
        <div className="flex flex-col gap-2 border border-border p-3">
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Files for {orphans.length} {orphans.length === 1 ? 'show that is' : 'shows that are'} deleted or long past are still on this PC.
          </p>
          <button type="button" onClick={() => void clearOrphans()} className={`${BTN} border-border text-muted-foreground hover:text-white hover:border-primary`}>
            REMOVE THEM
          </button>
        </div>
      )}

      <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
        Guests see changes on the standby screen within a minute, in their own time zone. The schedule never starts a broadcast: GO LIVE is still yours.
      </p>
    </section>
  );
}
