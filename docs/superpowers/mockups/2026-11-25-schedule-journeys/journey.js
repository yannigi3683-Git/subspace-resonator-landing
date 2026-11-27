/* Subspace Radio SCHEDULE - clickable journey prototype. NOT production code.
   One file drives both pages; document.body.dataset.journey is 'host' or 'listener'.
   State is shared through localStorage, so the two pages stay in sync when both are open. */
(() => {
  const JOURNEY = document.body.dataset.journey;
  const KEY = 'sr-schedule-journey-v1';
  const ISRAEL = 'Asia/Jerusalem';
  const DEMO_START = Date.UTC(2026, 10, 24, 16, 37, 52); // Tue 24 Nov 2026, 18:37:52 Israel
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR, GRACE = 30 * MIN, SUGGEST_AHEAD = 6 * HOUR, SOON = 10 * MIN, LEAD = 45e3;
  const TRACKS = ['Galaxy 604', 'Subspace Disturbance', 'Nightmare In Heaven'];

  const wall = (y, mo, d, h, mi, zone = ISRAEL) => zonedToUtc(`${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}`, zone);
  const DEMO_SHOWS = () => [
    { id: 's1', title: 'Psy Night Vol. 7', startsAt: wall(2026, 11, 29, 22, 0) },
    { id: 's2', title: 'Goa Classics 1998', startsAt: wall(2026, 12, 6, 21, 0) },
    { id: 's3', title: 'Subspace Theory Live', startsAt: wall(2026, 12, 19, 23, 0) },
  ];
  const PAST_SHOWS = () => [
    { id: 'p1', title: 'Sunday Session', startsAt: wall(2026, 11, 22, 20, 0) },
    { id: 'p2', title: 'Sunday Session', startsAt: wall(2026, 11, 15, 20, 0) },
  ];

  function fresh() {
    return {
      simOffset: DEMO_START - Date.now(),
      shows: [...PAST_SHOWS()],
      station: { mode: 'off', title: '', startedAt: null },
      failWrites: false,
      hostZone: ISRAEL,
      guestZone: ISRAEL,
      guestLocale: 'en-GB',
      // host UI
      tab: 'broadcast', draft: { title: '', start: '' }, editId: null, editDraft: null, confirmId: null,
      alert: '', pastOpen: false, saving: false,
      titleField: '', lastPrefill: null, titleEdited: false, hostStatus: 'idle',
      auto: { armed: false, state: 'off', running: null, startAt: 0, done: [], missed: [], fail: null, next: null, msg: '', stale: false },
      playlists: {}, filesOpenId: null, hostView: 'console', reviewEditor: false,
      // guest UI
      guestInRoom: false, guestName: 'Nebula Drifter', guestAvatar: 1,
      device: JOURNEY === 'host' && window.innerWidth >= 1024 ? 'desktop' : 'phone',
      userDevice: JOURNEY === 'host' && window.innerWidth >= 1024 ? 'desktop' : 'phone',
      step: 0,
    };
  }
  let hadStored = false;
  let S = load();
  let steps = [];

  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.shows) { hadStored = true; } if (v && v.shows) return { ...fresh(), ...v, step: 0, device: fresh().device, tab: v.tab || 'broadcast' }; } catch {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
  window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { const v = JSON.parse(e.newValue); const keep = { step: S.step, device: S.device, tab: S.tab, draft: S.draft, editId: S.editId, editDraft: S.editDraft, confirmId: S.confirmId, guestInRoom: S.guestInRoom, alert: S.alert, pastOpen: S.pastOpen }; S = { ...v, ...keep }; render(); } });
  const now = () => Date.now() + S.simOffset;
  const set = (patch) => { Object.assign(S, patch); save(); render(); };

  /* ── time helpers ── */
  function p2(n) { return String(n).padStart(2, '0'); }
  function zoneOffset(ms, zone) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const o = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - ms;
  }
  function zonedToUtc(local, zone) {
    const [d, t] = local.split('T'); const [y, mo, da] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    let ms = guess - zoneOffset(guess, zone);
    ms = guess - zoneOffset(ms, zone);
    return ms;
  }
  function utcToLocalInput(ms, zone) {
    const l = new Date(ms + zoneOffset(ms, zone));
    return `${l.getUTCFullYear()}-${p2(l.getUTCMonth() + 1)}-${p2(l.getUTCDate())}T${p2(l.getUTCHours())}:${p2(l.getUTCMinutes())}`;
  }
  const fmt = (ms, zone, opts, locale = 'en-GB') => new Intl.DateTimeFormat(locale, { timeZone: zone, ...opts }).format(new Date(ms));
  const showTime = (ms, zone, locale) => fmt(ms, zone, { weekday: 'short', day: 'numeric', month: 'short', hour: locale === 'en-US' ? 'numeric' : '2-digit', minute: '2-digit', timeZoneName: 'short' }, locale);
  const shortTime = (ms, zone, locale) => fmt(ms, zone, { weekday: 'short', day: 'numeric', month: 'short', hour: locale === 'en-US' ? 'numeric' : '2-digit', minute: '2-digit' }, locale);
  const hhmm = (ms, zone) => fmt(ms, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const zoneCity = (z) => z === ISRAEL ? 'Israel' : new Intl.DateTimeFormat('en-GB', { timeZone: z, timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName').value;
  function countdown(ms) {
    if (ms <= 0) return '00:00';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const hms = (h || d ? `${p2(h)}:` : '') + `${p2(m)}:${p2(x)}`;
    return d ? `${d}<span class="text-2xl text-white/60">d</span> ${hms}` : hms;
  }
  function rel(ms) {
    const diff = ms - now();
    if (diff <= 0) { const ago = Math.round(-diff / MIN); return ago < 60 ? `started ${ago} min ago` : `started ${Math.round(ago / 60)} h ago`; }
    const d = Math.floor(diff / DAY), h = Math.floor((diff % DAY) / HOUR), m = Math.round((diff % HOUR) / MIN);
    if (d >= 10) return `in ${d} days`;
    if (d) return `in ${d}d ${h}h`;
    if (h) return `in ${h}h ${m}m`;
    return `in ${m} min`;
  }

  /* ── rules (mirror the spec) ── */
  const upcoming = () => S.shows.filter((s) => s.startsAt > now() - GRACE && !s.aired).sort((a, b) => a.startsAt - b.startsAt);
  const past = () => S.shows.filter((s) => s.startsAt <= now() - GRACE).sort((a, b) => b.startsAt - a.startsAt);
  function standbyState() {
    const u = upcoming();
    if (!u.length) return { kind: 'tba', later: [] };
    const next = u[0];
    return { kind: next.startsAt <= now() ? (now() - next.startsAt < SOON ? 'soon' : 'delayed') : 'countdown', next, later: u.slice(1, 3) };
  }
  function suggestion() { return S.shows.filter((s) => s.startsAt >= now() - GRACE && s.startsAt <= now() + SUGGEST_AHEAD).sort((a, b) => a.startsAt - b.startsAt)[0] || null; }
  function applyPrefill() {
    if (S.hostStatus !== 'idle' || S.station.mode === 'live' || S.titleEdited) return;
    const sug = suggestion();
    if (!sug) return;
    if (S.titleField === '' || S.titleField === S.lastPrefill) {
      if (S.titleField !== sug.title || S.lastPrefill !== sug.title) { S.titleField = sug.title; S.lastPrefill = sug.title; save(); }
    }
  }
  function validate(d, ignoreId) {
    const out = { ok: true, errors: [], warnings: [] };
    const t = (d.title || '').trim();
    if (!t) { out.ok = false; }
    if (t.length > 80) { out.ok = false; out.errors.push('Title is over 80 characters.'); }
    if (!d.start) { out.ok = false; return out; }
    const ms = zonedToUtc(d.start, S.hostZone);
    if (ms < now()) out.warnings.push('This time is in the past. Guests will not see it.');
    const near = S.shows.find((s) => s.id !== ignoreId && Math.abs(s.startsAt - ms) < HOUR);
    if (near) { const gap = Math.round(Math.abs(near.startsAt - ms) / MIN); out.warnings.push(`${near.title} starts ${gap === 0 ? 'at the same time' : `${gap} min ${near.startsAt < ms ? 'before' : 'after'} this`}. You can still save it.`); }
    out.ms = ms;
    return out;
  }

  /* ── icons ── */
  const svg = (d, cls = '') => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${d}</svg>`;
  const I = {
    pencil: svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    chevR: svg('<path d="m9 18 6-6-6-6"/>'), chevD: svg('<path d="m6 9 6 6 6-6"/>'),
    warn: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'shrink-0 mt-0.5'),
    cal: svg('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4"/><path d="M3 10h18"/>'),
    vol: svg('<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/>'),
    up: svg('<path d="m18 15-6-6-6 6"/>'), down: svg('<path d="m6 9 6 6 6-6"/>'), x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    lock: svg('<rect width="18" height="11" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    spark: svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  };

  /* ═════════════ HOST CONSOLE ═════════════ */
  function hostScreen() {
    if (S.hostView === 'phone') return standby();
    const live = S.hostStatus === 'live';
    const badge = live
      ? `<button data-a="tab" data-v="broadcast" class="font-mono text-[11px] tracking-widest px-3 min-h-[44px] border border-red-500 text-red-400 shrink-0 inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>ON AIR</button>`
      : `<button data-a="tab" data-v="broadcast" class="font-mono text-[11px] tracking-widest px-3 min-h-[44px] border border-border text-muted-foreground shrink-0">OFF AIR</button>`;
    const tabs = ['broadcast', 'schedule', 'moderation'].map((t) => `<button data-a="tab" data-v="${t}" class="font-mono text-[11px] tracking-widest px-2 sm:px-5 min-h-[44px] inline-flex items-center justify-center ${S.tab === t ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'}">${t.toUpperCase()}</button>`).join('');
    const body = S.tab === 'schedule' ? schedulePanel() : S.tab === 'broadcast' ? broadcastPanel() : `<section class="section-border p-6"><p class="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-4">// MODERATION</p><p class="font-mono text-xs text-muted-foreground">Unchanged, not part of this feature.</p></section>`;
    return `<main class="bg-background text-foreground px-4 py-8 max-w-2xl mx-auto min-h-full">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div><p class="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-2">// SUBSPACE RADIO LIVE</p><h1 class="font-display text-2xl text-white">HOST CONSOLE</h1></div>${badge}
      </div>
      ${autoBar()}
      <nav class="grid grid-cols-3 w-full sm:flex sm:w-fit mb-6 border border-border">${tabs}</nav>
      ${body}
    </main>`;
  }

  function broadcastPanel() {
    const live = S.hostStatus === 'live';
    const sug = suggestion();
    const hint = !live && sug && S.titleField === sug.title && S.lastPrefill === sug.title
      ? `<span class="font-mono text-[11px] text-[#26C6DA]">From schedule: ${esc(sug.title)} · ${hhmm(sug.startsAt, ISRAEL)} Israel</span>` : '';
    return `<section class="section-border p-4 sm:p-6 flex flex-col gap-5">
      <p class="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">// BROADCAST</p>
      ${live ? `<div class="border border-red-500/40 bg-red-500/[0.06] p-4 flex flex-col gap-2">
          <p class="font-mono text-xs text-red-400 tracking-widest">ON AIR</p>
          <p class="font-mono text-xs text-muted-foreground">LISTENERS: 12 · 256 kbps</p>
        </div>${autoDeck()}
        <p class="font-mono text-xs text-muted-foreground"><span class="text-muted-foreground/60">TITLE </span><span class="text-white">${esc(S.station.title)}</span></p>`
      : `<label class="flex flex-col gap-1">
          <span class="font-mono text-[11px] tracking-widest text-muted-foreground">BROADCAST TITLE</span>
          <input id="titleField" data-a="titleField" maxlength="80" value="${esc(S.titleField)}" placeholder="Subspace Radio Live" class="bg-transparent border border-border px-3 font-mono text-sm min-h-[44px] text-white focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
          ${hint}
        </label>`}
      <div class="border border-dashed border-border p-4 flex flex-col gap-1">
        <span class="font-mono text-[11px] tracking-widest text-muted-foreground">AUDIO INPUT · FILE DECK · MIXER</span>
        <span class="font-mono text-[11px] text-muted-foreground">Unchanged by this feature. Left out of the prototype.</span>
      </div>
      ${live
        ? `<button data-a="end" class="font-display font-bold tracking-[0.2em] text-sm min-h-[52px] border border-red-500 text-red-400 hover:bg-red-500/10">END BROADCAST</button>`
        : `<button data-a="golive" class="font-display font-bold tracking-[0.2em] text-sm min-h-[52px] bg-primary text-white hover:bg-primary/80">GO LIVE</button>`}
    </section>`;
  }

  function field(id, label, value, { type = 'text', placeholder = '', hint = '' } = {}) {
    return `<label class="flex flex-col gap-1">
      <span class="font-mono text-[11px] tracking-widest text-muted-foreground">${label}</span>
      <input id="${id}" data-a="${id}" type="${type}" value="${esc(value)}" ${type === 'text' ? 'maxlength="80"' : ''} placeholder="${placeholder}" class="bg-transparent border border-border px-3 font-mono text-sm min-h-[44px] text-white focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 [color-scheme:dark]" />
      ${hint ? `<span class="font-mono text-[10px] text-muted-foreground">${hint}</span>` : ''}
    </label>`;
  }
  function preview(d, ignoreId) {
    if (!d.start) return '';
    const v = validate(d, ignoreId);
    const devZone = S.hostZone;
    const lines = [`${shortTime(v.ms, devZone)} ${zoneCity(devZone)}`];
    if (devZone !== ISRAEL) lines.push(`${shortTime(v.ms, ISRAEL)} Israel`);
    return `<div class="flex flex-col gap-2">
      <p class="font-mono text-xs text-white border-l-2 border-[#26C6DA] pl-3 py-1 leading-relaxed">${lines.join('<br>')}<br><span class="text-muted-foreground">${hhmm(v.ms, 'UTC')} UTC · <span data-rel="${v.ms}">${rel(v.ms)}</span></span></p>
      ${devZone !== ISRAEL ? `<p class="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">${I.warn}<span>Your device is not on Israel time (it is on ${zoneCity(devZone)}). Check the Israel line before saving.</span></p>` : ''}
      ${v.errors.concat(v.warnings).map((w) => `<p class="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">${I.warn}<span>${esc(w)}</span></p>`).join('')}
    </div>`;
  }
  function schedulePanel() {
    const v = validate(S.draft);
    const u = upcoming(), pa = past();
    return `<section class="section-border p-4 sm:p-6 flex flex-col gap-6">
      <p class="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">// SCHEDULE</p>
      ${S.alert ? `<p role="alert" class="font-mono text-xs text-red-400 border border-red-500/60 bg-red-500/10 p-3 flex gap-2 leading-relaxed">${I.warn}<span>${esc(S.alert)}</span></p>` : ''}
      <div class="flex flex-col gap-3">
        <span class="font-mono text-[11px] tracking-widest text-white">NEW SHOW</span>
        ${field('draftTitle', 'TITLE', S.draft.title, { placeholder: 'Show title' })}
        ${field('draftStart', 'STARTS', S.draft.start, { type: 'datetime-local', hint: `Your device time (${zoneCity(S.hostZone)}).` })}
        <div id="draftPreview">${preview(S.draft)}</div>
        <button data-a="add" ${v.ok && !S.saving ? '' : 'disabled'} class="font-mono text-[11px] tracking-widest min-h-[44px] border inline-flex items-center justify-center gap-2 ${v.ok && !S.saving ? 'border-primary text-white bg-primary/20 hover:bg-primary/30' : 'border-border text-muted-foreground/50 cursor-not-allowed'}">${I.cal} ${S.saving ? 'SAVING...' : 'ADD TO SCHEDULE'}</button>
      </div>
      <div class="flex flex-col gap-2 pt-5 border-t border-border/50">
        <span class="font-mono text-[11px] tracking-widest text-white mb-1">UPCOMING (${u.length})</span>
        ${u.length ? u.map((x) => showRow(x)).join('') : `<p class="font-mono text-xs text-muted-foreground border border-dashed border-border p-4">Nothing scheduled. Guests see NEXT TRANSMISSION: TBA.</p>`}
        <button data-a="past" class="font-mono text-[11px] tracking-widest text-muted-foreground min-h-[44px] inline-flex items-center gap-2 mt-1 self-start">${S.pastOpen ? I.chevD : I.chevR} PAST (${pa.length})</button>
        ${S.pastOpen ? pa.slice(0, 5).map((s) => showRow(s, true)).join('') : ''}
      </div>
      <p class="font-mono text-[10px] text-muted-foreground leading-relaxed">Guests see changes on the standby screen within a minute, in their own time zone. The schedule never starts a broadcast: GO LIVE is still yours.</p>
    </section>`;
  }
  function showRow(s, isPast = false) {
    if (S.editId === s.id) {
      const d = S.editDraft; const v = validate(d, s.id);
      return `<div class="border border-primary p-3 flex flex-col gap-3 bg-primary/5">
        <span class="font-mono text-[11px] tracking-widest text-white">EDITING</span>
        ${field('editTitle', 'TITLE', d.title)}
        ${field('editStart', 'STARTS', d.start, { type: 'datetime-local', hint: `Your device time (${zoneCity(S.hostZone)}).` })}
        <div id="editPreview">${preview(d, s.id)}</div>
        <div class="grid grid-cols-2 gap-2">
          <button data-a="saveEdit" ${v.ok ? '' : 'disabled'} class="font-mono text-[11px] tracking-widest min-h-[44px] border ${v.ok ? 'border-primary text-white bg-primary/20' : 'border-border text-muted-foreground/50'}">SAVE</button>
          <button data-a="cancelEdit" class="font-mono text-[11px] tracking-widest min-h-[44px] border border-border text-muted-foreground">CANCEL</button>
        </div>
      </div>`;
    }
    const confirm = S.confirmId === s.id;
    const soon = s.startsAt <= now() && s.startsAt > now() - GRACE;
    const date = new Date(s.startsAt + zoneOffset(s.startsAt, ISRAEL));
    const dow = fmt(s.startsAt, ISRAEL, { weekday: 'short' }).toUpperCase(), mon = fmt(s.startsAt, ISRAEL, { month: 'short' }).toUpperCase();
    return `<div ${soon ? 'data-soon' : ''} class="border ${confirm ? 'border-red-500/60 bg-red-500/[0.04]' : soon ? 'border-amber-500/60' : 'border-border'} p-3 flex flex-col gap-3 ${isPast ? 'opacity-70' : ''}">
      <div class="flex items-stretch gap-3">
        <div class="w-14 shrink-0 text-center border-r border-border pr-3 flex flex-col justify-center">
          <p class="font-mono text-[10px] tracking-widest text-muted-foreground">${dow}</p>
          <p class="font-display text-xl text-white leading-tight">${date.getUTCDate()}</p>
          <p class="font-mono text-[10px] tracking-widest text-muted-foreground">${mon}</p>
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <p class="font-mono text-sm text-white break-words line-clamp-2">${esc(s.title)}</p>
          <p class="font-mono text-[11px] text-muted-foreground"><span class="whitespace-nowrap">${hhmm(s.startsAt, ISRAEL)} Israel</span> · <span class="whitespace-nowrap">${hhmm(s.startsAt, 'UTC')} UTC</span></p>
          <p class="font-mono text-[11px] ${soon ? 'text-amber-400' : 'text-[#26C6DA]'}"><span data-rel="${s.startsAt}">${rel(s.startsAt)}</span>${soon ? (now() - s.startsAt < SOON ? ' · guests see STARTING SOON' : ' · guests see DELAYED') : ''}</p>
        </div>
        ${confirm ? '' : `<div class="flex flex-col sm:flex-row gap-1 shrink-0 items-start">
          ${isPast ? '' : `<button data-a="edit" data-v="${s.id}" aria-label="Edit ${esc(s.title)}" class="w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground hover:text-white hover:border-primary">${I.pencil}</button>`}
          <button data-a="del" data-v="${s.id}" aria-label="Delete ${esc(s.title)}" class="w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-500">${I.trash}</button>
        </div>`}
      </div>
      ${isPast || confirm ? '' : filesRow(s)}
      ${confirm ? `<p class="font-mono text-[11px] text-red-400">Delete this show? Guests stop seeing it within a minute.</p>
      <div class="grid grid-cols-2 gap-2">
        <button data-a="delYes" data-v="${s.id}" class="font-mono text-[11px] tracking-widest min-h-[44px] border border-red-500 text-red-400 bg-red-500/10">DELETE</button>
        <button data-a="delNo" class="font-mono text-[11px] tracking-widest min-h-[44px] border border-border text-muted-foreground">KEEP</button>
      </div>` : ''}
    </div>`;
  }

  /* ═════════════ GUEST ═════════════ */
  function guestView() {
    if (S.station.mode === 'live') return S.guestInRoom ? 'room' : 'gate';
    return 'standby';
  }
  function guestScreen() {
    const v = guestView();
    if (v === 'gate') return gate();
    if (v === 'room') return room();
    return standby();
  }
  function standbyShell(inner, soon) {
    const status = soon === 'delayed'
      ? `<p class="font-mono text-amber-300 text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-300"></span>STANDING BY</p>`
      : soon
      ? `<p class="font-mono text-[#26C6DA] text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#26C6DA]"></span>STANDING BY</p>`
      : `<p class="font-mono text-white/60 text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-white/50"></span>SIGNAL OFFLINE</p>`;
    return `<div class="min-h-full bg-[#05060f] radio-nebula relative overflow-x-hidden flex flex-col items-center justify-center px-6 py-10 [@media(max-height:500px)]:py-6 text-center">
      <div class="absolute inset-0 radio-stars pointer-events-none"></div>
      <div class="absolute inset-x-0 top-0 h-1/3 radio-aurora pointer-events-none"></div>
      <div class="absolute inset-x-0 bottom-0 h-[30%] radio-floor-glow pointer-events-none"></div>
      <button aria-label="Host sign-in" class="absolute top-2 right-2 z-20 w-11 h-11 inline-flex items-center justify-center text-white/60 hover:text-white">${I.lock}</button>
      ${JOURNEY === 'host' && S.hostView === 'phone' ? phoneLine() : ''}
      <div class="relative z-10 w-full max-w-sm flex flex-col items-center">
        <h1 class="font-display text-white text-2xl sm:text-3xl font-bold tracking-[0.2em] mb-2" style="text-shadow:0 0 24px rgba(38,198,218,0.5)">SUBSPACE RADIO</h1>
        ${status}
        ${inner}
        <a class="font-mono text-[#B388F0] text-sm underline underline-offset-4 tracking-wide min-h-[44px] inline-flex items-center mt-8 [@media(max-height:500px)]:mt-4">Browse the archive</a>
        <p class="font-mono text-white/55 text-[10px] mt-6 [@media(max-height:500px)]:mt-2 tracking-wide">Subspace Radio · Goa / Psychedelic Trance</p>
      </div>
    </div>`;
  }
  function laterList(rows) {
    if (!rows.length) return '';
    return `<div class="w-full mt-8 [@media(max-height:500px)]:mt-4 text-left">
      <p class="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-2">LATER</p>
      ${rows.map((s) => `<div class="flex items-baseline justify-between gap-3 py-2 border-t border-white/10">
        <span class="font-mono text-white/80 text-xs truncate">${esc(s.title)}</span>
        <span class="font-mono text-white/60 text-[11px] tabular-nums shrink-0">${shortTime(s.startsAt, S.guestZone, S.guestLocale)}</span>
      </div>`).join('')}
    </div>`;
  }
  const keepOpen = `<p class="font-mono text-white/60 text-[11px] leading-relaxed mt-8 [@media(max-height:500px)]:mt-4 max-w-[260px]">Keep this page open. It switches over by itself when the signal goes live.</p>`;
  function standby() {
    const st = standbyState();
    if (st.kind === 'tba') return standbyShell(`<div class="w-full border border-white/10 bg-white/[0.04] backdrop-blur px-5 py-6">
        <p class="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-3">NEXT TRANSMISSION</p>
        <p class="font-display text-white text-2xl tracking-[0.2em]">TBA</p></div>`);
    if (st.kind === 'delayed') return standbyShell(`<div class="w-full border border-amber-500/50 bg-amber-500/[0.06] backdrop-blur px-5 py-6" aria-live="polite">
        <p class="font-mono text-amber-300 text-[10px] tracking-[0.3em] mb-3">DELAYED</p>
        <p class="font-display text-white text-lg tracking-wide mb-1 uppercase break-words">${esc(st.next.title)}</p>
        <p class="font-mono text-white/70 text-xs">Scheduled for ${fmt(st.next.startsAt, S.guestZone, { hour: S.guestLocale === 'en-US' ? 'numeric' : '2-digit', minute: '2-digit', timeZoneName: 'short' }, S.guestLocale)}</p>
        <p class="font-mono text-white/60 text-[11px] mt-3 leading-relaxed">The signal is late.</p>
      </div>` + laterList(st.later) + keepOpen, 'delayed');
    if (st.kind === 'soon') return standbyShell(`<div class="w-full border border-[#26C6DA]/40 bg-[#26C6DA]/[0.06] backdrop-blur px-5 py-6" aria-live="polite">
        <p class="font-mono text-[#26C6DA] text-[10px] tracking-[0.3em] mb-3 inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-[#26C6DA] radio-soon-pulse" style="box-shadow:0 0 10px #26C6DA"></span>STARTING SOON</p>
        <p class="font-display text-white text-lg tracking-wide mb-1 uppercase break-words">${esc(st.next.title)}</p>
        <p class="font-mono text-white/70 text-xs">Scheduled for ${fmt(st.next.startsAt, S.guestZone, { hour: S.guestLocale === 'en-US' ? 'numeric' : '2-digit', minute: '2-digit', timeZoneName: 'short' }, S.guestLocale)}</p>
        <p class="font-mono text-white/60 text-[11px] mt-3 leading-relaxed">Due any minute.</p>
      </div>` + laterList(st.later) + keepOpen, true);
    return standbyShell(`<div class="w-full border border-white/10 bg-white/[0.04] backdrop-blur px-5 py-6">
        <p class="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-3">NEXT TRANSMISSION</p>
        <p class="font-mono text-white text-4xl [@media(max-height:500px)]:text-3xl tabular-nums tracking-tight mb-4" style="text-shadow:0 0 18px rgba(123,47,190,0.6)" data-cd="${st.next.startsAt}">${countdown(st.next.startsAt - now())}</p>
        <p class="font-display text-white text-lg tracking-wide mb-1 uppercase break-words">${esc(st.next.title)}</p>
        <p class="font-mono text-white/70 text-xs">${fmt(st.next.startsAt, S.guestZone, { weekday: 'short', day: 'numeric', month: 'short' }, S.guestLocale)}, <span class="whitespace-nowrap">${fmt(st.next.startsAt, S.guestZone, { hour: S.guestLocale === 'en-US' ? 'numeric' : '2-digit', minute: '2-digit', timeZoneName: 'short' }, S.guestLocale)} <span class="text-white/60">· your time</span></span></p>
      </div>` + laterList(st.later) + keepOpen);
  }
  const AV = ['#26C6DA', '#7B2FBE', '#E91E63', '#FFC107', '#4CAF50', '#FF7043', '#5C6BC0', '#EC407A'];
  function gate() {
    return `<div class="min-h-full bg-[#05060f] radio-nebula relative overflow-x-hidden flex flex-col items-center justify-center p-6">
      <div class="absolute inset-x-0 top-0 h-1/3 radio-aurora pointer-events-none"></div>
      <div class="relative z-10 w-full flex flex-col items-center">
        <h1 class="font-display text-white text-2xl sm:text-3xl font-bold tracking-[0.2em] mb-1" style="text-shadow:0 0 24px rgba(38,198,218,0.5)">SUBSPACE RADIO</h1>
        <p class="font-mono text-[#26C6DA]/70 text-xs tracking-widest mb-8 uppercase">Choose your identity</p>
        <div class="grid grid-cols-4 gap-2 mb-8 w-full max-w-xs" role="radiogroup" aria-label="Avatar">
          ${AV.map((c, i) => `<button data-a="avatar" data-v="${i}" role="radio" aria-checked="${S.guestAvatar === i}" aria-label="Avatar ${i + 1}" class="flex items-center justify-center p-2 min-h-[72px] rounded-xl border ${S.guestAvatar === i ? 'border-white/40 bg-white/10' : 'border-white/5 bg-white/[0.03]'}"><span class="w-10 h-10 rounded-full" style="background:radial-gradient(circle at 35% 35%, ${c}, ${c}33)"></span></button>`).join('')}
        </div>
        <div class="w-full max-w-xs mb-6">
          <label for="guestName" class="font-mono text-white/60 text-[10px] uppercase tracking-widest block mb-2">Your name</label>
          <input id="guestName" data-a="guestName" maxlength="24" value="${esc(S.guestName)}" class="w-full bg-white/[0.06] border border-white/10 text-white font-mono px-4 py-3 rounded-xl min-h-[44px] focus:outline-none focus:ring-1 focus:ring-[#7B2FBE]" />
        </div>
        <button data-a="tunein" ${S.guestName.trim().length >= 2 ? '' : 'disabled'} class="w-full max-w-xs py-4 font-display font-bold tracking-[0.25em] text-sm rounded-xl bg-[#7B2FBE] text-white hover:bg-[#9B4FDE] disabled:opacity-40 min-h-[52px]">TUNE IN</button>
        <p class="font-mono text-white/60 text-[10px] mt-4 max-w-xs text-center">Existing screen, unchanged. Shown here so the flow is complete.</p>
      </div>
    </div>`;
  }
  function neonText() {
    if (S.auto.running && S.station.mode === 'live') {
      const show = S.shows.find((x) => x.id === S.auto.running); const tr = nowTrack();
      if ((show.neon || 'tracks') === 'tracks') return { text: tr && tr.i >= 0 ? tr.f.name : show.title, track: true, label: 'track name (this show shows TRACK NAMES)' };
    }
    const t = S.station.title || 'Subspace Radio Live';
    const cycle = Math.floor(Date.now() / 1000) % 20;
    if (cycle >= 15) return { text: TRACKS[Math.floor(Date.now() / 20000) % TRACKS.length], track: true };
    return { text: t.trim().toLowerCase() === 'subspace radio live' ? 'LIVE DJ' : t, track: false };
  }
  function room() {
    const n = neonText();
    const dots = Array.from({ length: 14 }, (_, i) => `<span class="absolute w-5 h-5 rounded-full" style="left:${8 + ((i * 37) % 84)}%;top:${58 + ((i * 23) % 30)}%;background:radial-gradient(circle at 35% 35%, ${AV[i % 8]}, ${AV[i % 8]}33);box-shadow:0 0 10px ${AV[i % 8]}88"></span>`).join('');
    return `<div class="min-h-full bg-[#05060f] radio-nebula relative overflow-hidden flex flex-col">
      <div class="absolute inset-0 radio-stars pointer-events-none"></div>
      <div class="relative z-10 flex items-center justify-between px-4 pt-4">
        <p class="font-display text-white text-[13px] font-bold tracking-[0.15em]">SUBSPACE RESONATOR LIVE RADIO</p>
        <span class="font-mono text-[10px] tracking-widest text-red-400 border border-red-500/60 px-2 py-1 inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>ON AIR</span>
      </div>
      <div class="relative z-10 flex flex-col items-center mt-6">
        <div class="w-14 h-14 rounded-full border border-[#26C6DA]/60 flex items-center justify-center text-[#26C6DA] text-lg font-display" style="box-shadow:0 0 18px rgba(38,198,218,0.35)">DJ</div>
        <p class="mt-3 font-display font-bold text-[14px] text-[#FF5CCB] text-center px-3 py-1.5 rounded-md bg-black/80 border border-[#FF00AA]/40 max-w-[80%]" style="text-shadow:0 0 8px #FF00AA">${esc(n.text)}</p>
        <p class="font-mono text-[10px] text-white/60 mt-1">${n.label || (n.track ? 'track name peeking (15 s each minute)' : 'broadcast title')}</p>
      </div>
      <div class="relative flex-1 min-h-[260px]">
        <div class="absolute left-1/2 top-[30%] -translate-x-1/2 w-40 h-40 rounded-full" style="background:conic-gradient(from 0deg,#7B2FBE,#26C6DA,#FF00AA,#7B2FBE);filter:blur(18px);opacity:.55"></div>
        ${dots}
      </div>
      <div class="relative z-10 flex items-center justify-between gap-3 px-4 pb-4">
        <span class="font-mono text-[10px] text-white/60">ABOARD 14</span>
        <div class="flex gap-2">
          <span class="w-11 h-11 border border-white/15 rounded-full inline-flex items-center justify-center text-white/70">${I.vol}</span>
          <span class="min-h-[44px] px-4 border border-[#FF00AA]/50 rounded-full inline-flex items-center gap-2 font-mono text-[11px] text-[#FF5CCB]">${I.spark} CHEER</span>
        </div>
      </div>
      <p class="relative z-10 font-mono text-white/60 text-[10px] text-center pb-3 px-4">The room is unchanged and simplified here. Only the neon text is affected.</p>
    </div>`;
  }

  /* ═════════════ SCHEDULE RUNNER (Release 2) ═════════════ */
  const DEMO_PLAYLIST = () => [
    { file: 'SR_GALAXY604_FINAL_v3_master.wav', name: 'Galaxy 604', dur: 7 * MIN + 48e3 },
    { file: 'subspace disturbance (club edit) 24bit.wav', name: 'Subspace Disturbance', dur: 8 * MIN + 32e3 },
    { file: 'NIH_timewarp_master_final2.flac', name: 'Nightmare In Heaven', dur: 9 * MIN + 5e3 },
    { file: 'theory_pt1_live_take_03.wav', name: 'The Subspace Theory (Live)', dur: 11 * MIN + 40e3 },
  ];
  const EXTRA_FILES = [
    { file: 'quantum_jam_2025-11-03_rough.wav', name: 'quantum_jam_2025-11-03_rough', dur: 12 * MIN + 10e3 },
    { file: 'galaxy604_dub_rework_DRAFT.wav', name: 'galaxy604_dub_rework_DRAFT', dur: 6 * MIN + 50e3 },
  ];
  const plist = (id) => S.playlists[id] || [];
  const total = (id) => plist(id).reduce((a, f) => a + f.dur, 0);
  const dur = (ms) => { const x = Math.round(ms / 1000), h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = x % 60; return (h ? `${h}:${p2(m)}` : `${m}`) + `:${p2(sec)}`; };
  const nextWithFiles = () => upcoming().find((x) => plist(x.id).length && !S.auto.done.includes(x.id) && !S.auto.missed.includes(x.id));
  function nowTrack() {
    const A = S.auto; if (!A.running) return null;
    let e = now() - A.startAt; if (e < 0) return { i: -1 };
    const l = plist(A.running);
    for (let i = 0; i < l.length; i++) { if (e < l[i].dur) return { i, f: l[i], pos: e }; e -= l[i].dur; }
    return { i: l.length - 1, f: l[l.length - 1], pos: l[l.length - 1].dur };
  }
  function markAired(id) { const x = S.shows.find((y) => y.id === id); if (x) x.aired = true; }
  function autoTick() {
    const A = S.auto; if (!A.armed) return;
    const t = now();
    if (A.running) {
      if (t >= A.startAt + total(A.running) + 30e3) { endShow(); A.last = { title: (S.shows.find((x) => x.id === A.running) || {}).title, at: A.startAt + total(A.running) + 30e3 }; A.done.push(A.running); A.running = null; A.state = 'armed'; }
      else A.state = t < A.startAt ? 'starting' : 'on_air';
      return;
    }
    const next = nextWithFiles();
    if (!next) { A.state = 'armed'; A.next = null; return; }
    const T = next.startsAt; A.next = next.id;
    if (t >= T + GRACE) { A.missed.push(next.id); A.state = 'missed'; A.msg = next.title; return; }
    if (t >= T - LEAD) {
      if (A.fail) { A.state = 'failed'; return; }
      if (S.station.mode === 'live') { A.state = 'failed'; A.msg = 'already'; return; }
      S.titleField = next.title; S.lastPrefill = next.title; S.titleEdited = false;
      S.hostStatus = 'live'; S.station = { mode: 'live', title: next.title, startedAt: t };
      markAired(next.id);
      A.running = next.id; A.startAt = Math.max(T, t); A.state = t < T ? 'starting' : 'on_air';
      return;
    }
    A.state = t >= T - 10 * MIN ? 'preflight' : 'armed';
  }
  function autoBar() {
    const A = S.auto; const nxt = nextWithFiles();
    const noFiles = upcoming().find((x) => !plist(x.id).length && x.startsAt - now() < DAY && x.startsAt > now());
    const btn = 'font-mono text-[11px] tracking-widest min-h-[44px] px-3 border shrink-0';
    if (!A.armed) {
      const warn = nxt && nxt.startsAt - now() < DAY;
      return `<div class="border ${warn ? 'border-red-500/60 bg-red-500/[0.06]' : 'border-border'} p-3 mb-4 flex items-center justify-between gap-3">
        <div class="min-w-0"><p class="font-mono text-[11px] tracking-widest ${warn ? 'text-red-400' : 'text-muted-foreground'}">SCHEDULE RUNNER OFF</p>
        <p class="font-mono text-[11px] mt-0.5 leading-relaxed ${warn ? 'text-red-300' : 'text-muted-foreground'}">${warn ? `${esc(nxt.title)} at ${hhmm(nxt.startsAt, ISRAEL)} has files, but SCHEDULE RUNNER is off.` : 'Shows with files start and end by themselves once armed.'}</p></div>
        <button data-a="arm" class="${btn} border-primary text-white bg-primary/20 px-4">ARM</button></div>`;
    }
    const M = { armed: ['ARMED', 'text-emerald-400', 'border-emerald-500/50'], preflight: ['ARMED · CHECKS OK', 'text-emerald-400', 'border-emerald-500/50'], starting: ['GOING LIVE', 'text-red-400', 'border-red-500/50'], on_air: ['ON AIR', 'text-red-400', 'border-red-500/50'], failed: ['START FAILED', 'text-red-400', 'border-red-500/60 bg-red-500/[0.06]'], missed: ['MISSED', 'text-amber-400', 'border-amber-500/60'] };
    const [label, tc, bc] = M[A.state] || M.armed;
    const run = A.running && S.shows.find((x) => x.id === A.running);
    const nx = A.next && S.shows.find((x) => x.id === A.next);
    let line;
    if (A.state === 'starting') line = `${esc(run.title)}: on air now, the deck starts at ${hhmm(A.startAt, ISRAEL)}.`;
    else if (A.state === 'on_air') { const tr = nowTrack(); line = `${esc(run.title)} · track ${tr.i + 1} of ${plist(A.running).length} · ends by itself about ${hhmm(A.startAt + total(A.running), ISRAEL)}.`; }
    else if (A.state === 'failed') line = A.msg === 'already' ? `${esc(nx.title)}: the station is already live, so SCHEDULE RUNNER will not start on top of it.` : `${esc(nx.title)}: no network. Retrying every 30 s until ${hhmm(nx.startsAt + GRACE, ISRAEL)}.`;
    else if (A.state === 'missed') line = `${esc(A.msg)} could not start within 30 min and was skipped.`;
    else line = (A.last ? `Last: ${esc(A.last.title)} ended ${hhmm(A.last.at, ISRAEL)}, chat log saved. ` : '') + (nxt ? `Next: ${esc(nxt.title)} at ${hhmm(nxt.startsAt, ISRAEL)}${A.state === 'preflight' ? '. Sign-in, files, audio and network checked' : ''}. Checked 1 min ago.` : 'No upcoming show has files on this PC.');
    return `<div class="border ${bc} p-3 mb-4 flex items-center justify-between gap-3">
      <div class="min-w-0"><p class="font-mono text-[11px] tracking-widest ${tc}">SCHEDULE RUNNER ${label}</p><p class="font-mono text-[11px] text-foreground mt-0.5 leading-relaxed">${line}</p>
      ${noFiles && A.state !== 'on_air' ? `<p class="font-mono text-[11px] text-amber-400 mt-0.5 leading-relaxed">${esc(noFiles.title)} has no files on this PC: announced, not played.</p>` : ''}</div>
      <button data-a="disarm" class="${btn} border-border text-muted-foreground">DISARM</button></div>`;
  }
  function autoDeck() {
    if (!S.auto.running) return '';
    if (now() < S.auto.startAt) return `<p class="font-mono text-xs text-muted-foreground">FILE DECK · SCHEDULE RUNNER: empty until ${hhmm(S.auto.startAt, ISRAEL)}, then the show's ${plist(S.auto.running).length} files load and play.</p>`;
    const tr = nowTrack(); const l = plist(S.auto.running);
    return `<div class="flex flex-col gap-1"><span class="font-mono text-[11px] tracking-widest text-muted-foreground mt-2">FILE DECK · SCHEDULE RUNNER</span>
      ${l.map((f, i) => `<p class="font-mono text-xs ${tr && tr.i === i ? 'text-white' : 'text-muted-foreground'} flex justify-between gap-3"><span class="truncate">${tr && tr.i === i ? 'NOW ' : ''}${esc(f.name)}</span><span class="tabular-nums shrink-0">${dur(f.dur)}</span></p>`).join('')}
      <p class="font-mono text-[11px] text-muted-foreground mt-1">PAUSE, NEXT and END work. END finishes this show.</p></div>`;
  }
  function filesRow(x) {
    const l = plist(x.id); const open = S.filesOpenId === x.id;
    return `<button data-a="files" data-v="${x.id}" aria-expanded="${open}" class="font-mono text-[11px] tracking-widest min-h-[44px] px-3 border ${l.length ? 'border-emerald-500/60 text-emerald-300' : 'border-dashed border-border text-muted-foreground'} text-left flex items-center justify-between gap-2"><span>${onPhone() && !S.reviewEditor ? 'FILES · assign on the broadcasting PC' : l.length ? `FILES · ${l.length} files · ${dur(total(x.id))} · on this PC` : 'FILES · none on this PC'}</span>${open ? I.chevD : I.chevR}</button>${open ? filesEditor(x) : ''}`;
  }
  const onPhone = () => S.device === 'phone' || S.device === 'small';
  function filesEditor(x) {
    if (onPhone() && !S.reviewEditor) return `<p class="font-mono text-[11px] text-muted-foreground border border-border p-3 leading-relaxed">Files are added on the PC that will play the show. Open the console there.</p>`;
    const l = plist(x.id); const nx = upcoming().find((y) => y.startsAt > x.startsAt);
    const over = nx && l.length && x.startsAt + total(x.id) > nx.startsAt;
    const sq = 'w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground disabled:opacity-30 disabled:border-transparent';
    return `<div class="border border-border p-3 flex flex-col gap-3 bg-white/[0.02]">
      ${S.reviewEditor && onPhone() ? `<p class="font-mono text-[10px] text-[#26C6DA] leading-relaxed">Shown at phone size so you can review it. On a real phone this row only says: assign on the broadcasting PC.</p>` : ''}
      ${l.length ? l.map((f, i) => `<div class="flex flex-col gap-1 border-b border-border/60 pb-3">
          <label for="disp-${x.id}-${i}" class="font-mono text-[10px] tracking-widest text-muted-foreground">TRACK ${i + 1} · NEON NAME</label>
          <input id="disp-${x.id}-${i}" data-a="disp" data-v="${x.id}:${i}" value="${esc(f.name)}" maxlength="80" class="w-full bg-transparent border border-border px-2 font-mono text-xs min-h-[44px] text-white focus:outline-none focus:ring-1 focus:ring-primary" />
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] text-muted-foreground break-all min-w-0">${esc(f.file)} · ${dur(f.dur)}</span>
            <div class="flex gap-1 shrink-0">
              <button data-a="fup" data-v="${x.id}:${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up" class="${sq}">${I.up}</button>
              <button data-a="fdown" data-v="${x.id}:${i}" ${i === l.length - 1 ? 'disabled' : ''} aria-label="Move down" class="${sq}">${I.down}</button>
              <button data-a="frm" data-v="${x.id}:${i}" aria-label="Remove file" class="${sq} hover:text-red-400">${I.x}</button>
            </div>
          </div></div>`).join('') : `<p class="font-mono text-xs text-muted-foreground leading-relaxed">No files yet. Add the set this show should play.</p>`}
      <button data-a="fadd" data-v="${x.id}" class="font-mono text-[11px] tracking-widest min-h-[44px] border border-primary text-white bg-primary/20">ADD FILES</button>
      <div class="flex flex-col gap-1"><span class="font-mono text-[11px] tracking-widest text-muted-foreground">NEON SHOWS</span>
        <div class="grid grid-cols-2 gap-2">${['tracks', 'title'].map((m) => `<button data-a="neon" data-v="${x.id}:${m}" class="font-mono text-[11px] tracking-widest min-h-[44px] border ${(x.neon || 'tracks') === m ? 'border-primary text-white bg-primary/20' : 'border-border text-muted-foreground'}">${m === 'tracks' ? 'TRACK NAMES' : 'SHOW TITLE'}</button>`).join('')}</div></div>
      ${l.length ? `<p class="font-mono text-[11px] text-foreground">Total ${dur(total(x.id))} · ends about ${hhmm(x.startsAt + total(x.id), ISRAEL)} Israel</p>` : ''}
      ${over ? `<p class="font-mono text-[11px] text-amber-400 flex gap-2 leading-relaxed">${I.warn}<span>Runs ${Math.round((x.startsAt + total(x.id) - nx.startsAt) / MIN)} min into ${esc(nx.title)}. That show will start when this one ends.</span></p>` : ''}
      <p class="font-mono text-[10px] text-muted-foreground leading-relaxed">Copied into the console's storage on this PC (${Math.round((total(x.id) / MIN) * 10)} MB). Storage is protected. Nothing is uploaded.</p>
    </div>`;
  }
  function phoneLine() {
    const A = S.auto; const n = nextWithFiles();
    const lastMissed = A.missed.length ? S.shows.find((x) => x.id === A.missed[A.missed.length - 1]) : null;
    const kind = A.stale ? 'stale' : !A.armed ? 'off' : lastMissed ? 'missed' : 'ok';
    const nextTxt = n ? `next ${esc(n.title)} ${hhmm(n.startsAt, ISRAEL)}` : 'no next show with files';
    const txt = { stale: 'SCHEDULE RUNNER · PC-STUDIO last seen 2 h ago. The PC may be off or asleep: shows will not start.', off: 'SCHEDULE RUNNER · off', missed: `SCHEDULE RUNNER · MISSED ${esc(lastMissed && lastMissed.title)} (no network) · still armed on PC-STUDIO · ${nextTxt}`, ok: `SCHEDULE RUNNER · armed on PC-STUDIO · ${nextTxt} · seen 1 min ago` }[kind];
    const cls = { stale: 'border-amber-500/60 text-amber-300', off: 'border-white/20 text-white/70', missed: 'border-red-500/60 text-red-300', ok: 'border-emerald-500/60 text-emerald-300' }[kind];
    return `<div class="relative z-10 w-full max-w-sm mb-6 border ${cls} bg-black/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-left">${txt}<span class="block text-white/60 text-[10px] mt-1">Only you see this line (signed in as host on this phone).</span></div>`;
  }

  /* ═════════════ STEPS ═════════════ */
  const ensureDemoShows = () => { for (const d of [...DEMO_SHOWS(), ...PAST_SHOWS()]) if (!S.shows.some((s) => s.id === d.id)) S.shows.push(d); };
  const s1 = () => S.shows.find((s) => s.id === 's1');
  const jumpTo = (ms) => { S.simOffset = ms - Date.now(); };
  const sid = (id) => S.shows.find((x) => x.id === id);
  const R2 = '<span class="text-[#26C6DA]">Release 2.</span> ';
  const R1 = '<span class="text-[#26C6DA]">Release 1.</span> ';
  const HOST_STEPS = [
    { t: 'Your console, off air', b: 'Your host console as it is today, with one new bar at the top: SCHEDULE RUNNER. It is OFF until you arm it. Tap SCHEDULE, or press Next.', go: () => { Object.assign(S, fresh(), { device: S.userDevice || S.device, userDevice: S.userDevice }); S.tab = 'broadcast'; } },
    { t: 'Open SCHEDULE', b: R1 + 'The new tab. Nothing is scheduled yet, so guests see NEXT TRANSMISSION: TBA. PAST holds old shows and stays folded.', go: () => { S.tab = 'schedule'; } },
    { t: 'Add your first show', f: '[data-a="add"]', b: R1 + 'Type a title and pick the start in your own time. Before saving you see it back with UTC and how far away it is. Press ADD TO SCHEDULE. Next adds it for you if you skip.', go: () => { S.tab = 'schedule'; S.draft = { title: 'Psy Night Vol. 7', start: '2026-11-29T22:00' }; }, leave: () => { if (!s1()) S.shows.push({ id: 's1', title: 'Psy Night Vol. 7', startsAt: wall(2026, 11, 29, 22, 0) }); S.draft = { title: '', start: '' }; } },
    { t: 'Add more, and see a clash warning', f: '#draftPreview', b: R1 + 'Two more shows are added. The form now holds "Goa Classics part 2" at 21:30, 30 minutes after another show: you get a heads-up, but can still save it.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.draft = { title: 'Goa Classics part 2', start: '2026-12-06T21:30' }; }, leave: () => { S.draft = { title: '', start: '' }; } },
    { t: 'DJing abroad', f: '#draftPreview', b: R1 + 'You are in Goa and your phone is on India time. The preview shows the time on your phone, the Israel time and UTC, with an amber note, so you never save the wrong hour.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.hostZone = 'Asia/Kolkata'; S.draft = { title: 'Goa Sunrise', start: '2026-12-12T06:00' }; }, leave: () => { S.hostZone = ISRAEL; S.draft = { title: '', start: '' }; } },
    { t: 'Edit a show', f: '[data-a="saveEdit"]', b: R1 + 'The pencil opens the show in place. Change the time and press SAVE. Only one show is open for editing at a time.', go: () => { ensureDemoShows(); S.tab = 'schedule'; const x = s1(); S.editId = x.id; S.editDraft = { title: x.title, start: utcToLocalInput(x.startsAt, S.hostZone) }; }, leave: () => { S.editId = null; } },
    { t: 'Delete takes two taps', f: '[data-a="delYes"]', b: R1 + 'The bin asks first. DELETE removes the show, KEEP backs out.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.editId = null; S.confirmId = upcoming().slice(-1)[0]?.id || null; }, leave: () => { S.confirmId = null; } },
    { t: 'If a change fails', f: '[data-a="edit"]', b: R1 + 'Here the server refuses every change, as it would if your host sign-in had expired. Try editing or deleting: a red message, never a fake success.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.failWrites = true; S.alert = ''; }, leave: () => { S.failWrites = false; S.alert = ''; } },
    { t: 'Give a show its files', f: '[data-a="fadd"]', b: R2 + 'Open FILES on a show and add the set it should play. Files are copied into the console\'s storage on this PC; nothing is uploaded. Set the NEON NAME of each track, reorder, and choose TRACK NAMES or SHOW TITLE. A test show at 22:30 shows the overrun warning (removed on Next). If the browser ever refuses to protect the storage, the last line turns amber. Goa Classics 1998 has no files, so it is announced but not played.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.playlists.s1 = DEMO_PLAYLIST(); S.filesOpenId = 's1'; S.reviewEditor = true; S.shows.push({ id: 'ov', title: 'Afterparty', startsAt: wall(2026, 11, 29, 22, 30) }); }, leave: () => { S.filesOpenId = null; S.reviewEditor = false; S.shows = S.shows.filter((x) => x.id !== 'ov'); } },
    { t: 'ARM SCHEDULE RUNNER', b: R2 + 'Press ARM. One click, on purpose: a browser only lets a page start sound after you have clicked on it. From now on this console runs shows with files by itself. Reload the page or restart the PC and it is OFF again, and asks for your sign-in.', go: () => { ensureDemoShows(); if (!S.playlists.s1) S.playlists.s1 = DEMO_PLAYLIST(); S.tab = 'schedule'; }, leave: () => { S.auto.armed = true; S.auto.state = 'armed'; } },
    { t: 'Ten minutes before: checks', b: R2 + 'SCHEDULE RUNNER checks your sign-in, the files, audio permission and the network. If one fails it retries every 30 seconds and the bar says why.', go: () => { S.auto.armed = true; S.tab = 'broadcast'; jumpTo(s1().startsAt - 9 * MIN); } },
    { t: 'Show time: it goes live by itself', b: R2 + '45 seconds early it goes live for you, with the show title and an empty deck (no microphone or input device, so no Windows sounds). Guests waiting on the countdown move to the entry screen. At the start time it loads the files and plays.', go: () => { S.tab = 'broadcast'; jumpTo(s1().startsAt - 30e3); } },
    { t: 'Track by track', b: R2 + 'Track 2 is playing. Guests\' neon line shows its NEON NAME, because this show is set to TRACK NAMES. PAUSE, NEXT and END work; a pause just moves the safety END later. You can edit the schedule while on air.', go: () => { S.tab = 'broadcast'; jumpTo(s1().startsAt + 9 * MIN); } },
    { t: 'It ends by itself', b: R2 + '30 seconds after the last file ends (so deep-buffer listeners hear the very end) it ends the broadcast and saves the chat log. If a file will not play it is skipped. If the PC crashes mid-show, the server takes the station off air within 5 minutes.', go: () => { S.tab = 'broadcast'; jumpTo(s1().startsAt + total('s1') + 31e3); } },
    { t: 'If a start fails', b: R2 + 'Here the network is down at show time. SCHEDULE RUNNER retries every 30 seconds until 30 minutes after the start, then the bar says MISSED and it moves on. Guests see STARTING SOON, then DELAYED, then the next show.', go: () => { S.playlists.s3 = DEMO_PLAYLIST().slice(0, 2); S.auto.fail = 'network'; S.tab = 'broadcast'; jumpTo(sid('s3').startsAt + 2 * MIN); }, leave: () => { S.auto.fail = null; S.auto.missed.push('s3'); } },
    { t: 'Check it from your phone', b: R2 + 'Open /radio on your phone, signed in as host (the padlock). One line only you can see says whether SCHEDULE RUNNER is armed, on which PC, the next show, and when the PC last checked in. It is red here because Subspace Theory Live was just MISSED.', go: () => { S.hostView = 'phone'; S.device = 'phone'; jumpTo(sid('s3').startsAt + GRACE + 2 * MIN); S.shows.push({ id: 's5', title: 'Psy Night Vol. 8', startsAt: wall(2027, 1, 2, 22, 0) }); S.playlists.s5 = DEMO_PLAYLIST(); }, leave: () => { S.hostView = 'console'; } },
    { t: 'If the PC goes to sleep', b: R2 + 'The line turns amber when the PC has not checked in for 3 minutes. Nothing will start until you wake it, sign in and ARM.', go: () => { S.hostView = 'phone'; S.auto.stale = true; }, leave: () => { S.auto.stale = false; S.hostView = 'console'; S.device = S.userDevice || (wide() ? 'desktop' : 'phone'); } },
    { t: 'DJing yourself still works', b: R1 + 'Goa Classics 1998 has no files, so you DJ it yourself as today. SCHEDULE RUNNER leaves it alone. The title is already filled in from the schedule. Type over it, or clear it to show LIVE DJ, and it stays as you left it.', go: () => { S.auto.armed = false; S.auto.state = 'off'; S.tab = 'broadcast'; S.titleField = ''; S.lastPrefill = null; S.titleEdited = false; jumpTo(sid('s2').startsAt - 50 * MIN); } },
    { t: 'Done', b: 'That is the host side, both releases. Open the listener journey to see it from a guest\'s phone. Reset demo starts over.', go: () => {} },
  ];
  const LISTENER_STEPS = [
    { t: 'A guest opens your link, off air', b: R1 + 'They see the countdown straight away, with no name, avatar or sign-in first. Then the next two shows under LATER. The countdown is live.', go: () => { Object.assign(S, fresh(), { device: S.userDevice || S.device, userDevice: S.userDevice }); ensureDemoShows(); S.playlists.s1 = DEMO_PLAYLIST(); S.auto.armed = true; S.auto.state = 'armed'; } },
    { t: 'Same moment, a guest in New York', b: R1 + 'Same countdown. Times in their own zone and their phone\'s format.', go: () => { S.guestZone = 'America/New_York'; S.guestLocale = 'en-US'; }, leave: () => { S.guestZone = ISRAEL; S.guestLocale = 'en-GB'; } },
    { t: 'You move the show', b: R1 + 'You moved Psy Night Vol. 7 to 22:30 in the console. A waiting guest sees the change within a minute (instantly in this demo).', go: () => { s1().startsAt = wall(2026, 11, 29, 22, 30); } },
    { t: 'SCHEDULE RUNNER goes live, 45 s early', b: R2 + 'Your console goes live by itself just before 22:30. The page switches to the entry screen, so guests pick a name and avatar before the music starts.', go: () => { S.guestInRoom = false; jumpTo(s1().startsAt - 30e3); } },
    { t: 'The guest tunes in', b: R2 + 'Press TUNE IN. This show is set to TRACK NAMES, so the neon line shows each track\'s name as it plays.', go: () => { jumpTo(s1().startsAt + 2 * MIN); }, leave: () => { S.guestInRoom = true; } },
    { t: 'Next track', b: R2 + 'Nine minutes in, track 2: the neon line changes by itself.', go: () => { S.guestInRoom = true; jumpTo(s1().startsAt + 9 * MIN); } },
    { t: 'The show ends by itself', b: R2 + 'The last file ends, the broadcast ends, and guests are back on the countdown, now for Goa Classics 1998. A show that has aired never shows as late.', go: () => { jumpTo(s1().startsAt + total('s1') + 31e3); } },
    { t: 'A show does not start: STARTING SOON', b: 'Goa Classics 1998 has not started (no files on the PC and you are not live, or SCHEDULE RUNNER could not start). For the first 10 minutes guests see STARTING SOON.', go: () => { S.guestInRoom = false; jumpTo(sid('s2').startsAt + 4 * MIN); } },
    { t: 'Then DELAYED', b: R2 + 'From 10 to 30 minutes after the start time the card says DELAYED: "The signal is late."', go: () => { jumpTo(sid('s2').startsAt + 15 * MIN); } },
    { t: 'Then the next show', b: '30 minutes after the start time the screen moves on to the next show.', go: () => { jumpTo(sid('s2').startsAt + GRACE + MIN); } },
    { t: 'Nothing scheduled', b: R1 + 'With no shows at all: NEXT TRANSMISSION TBA and the archive link.', go: () => { S.shows = [...PAST_SHOWS()]; } },
    { t: 'Small and sideways phones', b: 'Use the device buttons: small phone and sideways. The screen scrolls when it does not fit. Reset demo starts over.', go: () => { ensureDemoShows(); S.device = 'small'; } },
  ];
  steps = JOURNEY === 'host' ? HOST_STEPS : LISTENER_STEPS;

  function goStep(i) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    const cur = steps[S.step];
    if (i === S.step + 1) { if (cur && cur.leave) cur.leave(); }
    else {
      // Any other move (BACK or a jump) replays the demo from scratch, so every step is deterministic.
      S = { ...fresh(), device: S.userDevice || S.device, userDevice: S.userDevice };
      for (let k = 0; k < i; k++) { steps[k].go(); autoTick(); if (steps[k].leave) steps[k].leave(); autoTick(); }
    }
    S.step = i;
    steps[S.step].go();
    save(); render();
    scrollScreenTo(steps[S.step].f);
  }
  function goLive() { applyPrefill(); const w = S.shows.find((x) => !x.aired && x.startsAt >= now() - GRACE && x.startsAt <= now() + HOUR); if (w) w.aired = true; S.hostStatus = 'live'; S.station = { mode: 'live', title: S.titleField.trim() || 'Subspace Radio Live', startedAt: now() }; }
  function endShow() { S.titleEdited = false; S.hostStatus = 'idle'; S.station = { mode: 'off', title: S.station.title, startedAt: null }; }

  /* ═════════════ RENDER ═════════════ */
  const DEVICES = { phone: [390, 844, 'PHONE'], small: [320, 568, 'SMALL'], sideways: [844, 390, 'SIDEWAYS'], desktop: [1280, 800, 'DESKTOP'] };
  const wide = () => window.innerWidth >= 1024;
  let frameKey = '', fdoc = null, uiMore = false, frameH = 0;
  function render() {
    autoTick();
    if (JOURNEY === 'host') applyPrefill();
    const key = [S.device, wide()].join('|');
    if (key !== frameKey) { buildLayout(); frameKey = key; }
    fillChrome();
    fit();
    renderScreen();
    lastKey = phaseKey();
  }
  function renderScreen() {
    if (!fdoc) return;
    const act = fdoc.activeElement; const fid = act && act.id; let sel = null;
    try { sel = fid && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null; } catch {}
    fdoc.getElementById('screen').innerHTML = JOURNEY === 'host' ? hostScreen() : guestScreen();
    if (fid) { const el = fdoc.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  }
  function scrollScreenTo(selector) {
    if (!fdoc) return;
    const sc = fdoc.scrollingElement; const el = selector && fdoc.querySelector(selector);
    if (!el) { sc.scrollTop = 0; return; }
    const h = frameH || DEVICES[S.device][1];
    sc.scrollTop = Math.max(0, el.getBoundingClientRect().top + sc.scrollTop - h / 2);
  }
  function controls() {
    const hostSim = JOURNEY === 'listener'
      ? `<p class="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mt-4 mb-2">SIMULATE THE HOST</p>
         <div class="flex flex-wrap gap-2">
           <button data-a="simGo" class="sim-btn">GO LIVE</button><button data-a="simEnd" class="sim-btn">END</button>
           <button data-a="simShift" class="sim-btn">MOVE NEXT +30 MIN</button><button data-a="simDemo" class="sim-btn">RESTORE SHOWS</button>
         </div>` : '';
    return `<p class="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mb-2">DEMO CLOCK</p>
      <p class="font-mono text-sm text-white tabular-nums" data-clock>${clockText()}</p>
      <div class="flex flex-wrap gap-2 mt-2">
        <button data-a="time" data-v="${HOUR}" class="sim-btn">+1 HOUR</button>
        <button data-a="time" data-v="${DAY}" class="sim-btn">+1 DAY</button>
        <button data-a="jumpNext" class="sim-btn">10 MIN BEFORE NEXT SHOW</button>
      </div>
      ${hostSim}
      <button data-a="reset" class="font-mono text-[11px] tracking-widest min-h-[44px] px-3 border border-border text-muted-foreground mt-4 w-full">RESET DEMO</button>`;
  }
  function buildLayout() {
    const other = JOURNEY === 'host' ? ['listener.html', 'Listener journey'] : ['host.html', 'Host journey'];
    const name = JOURNEY === 'host' ? 'Host journey' : 'Listener journey';
    const sync = `<a href="${other[0]}" class="underline text-[#B388F0]">${other[1]}</a> shares this demo's shows and clock when open in the same browser.`;
    document.getElementById('app').innerHTML = `<div class="min-h-screen bg-[#111] text-foreground lg:flex">
      <aside class="hidden lg:flex lg:w-[400px] lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto border-r border-border bg-background p-5 flex-col gap-4">
        <div>
          <p class="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-1">// PROTOTYPE · NOT BUILT</p>
          <h1 class="font-display text-2xl text-white">${name}</h1>
          <p class="font-mono text-[11px] text-muted-foreground mt-1">Radio SCHEDULE. ${sync}</p>
        </div>
        <div id="guideCard"></div>
        <ol id="stepList" class="flex flex-col gap-1"></ol>
        <div class="border-t border-border pt-4">${controls()}</div>
      </aside>
      <section class="flex-1 min-w-0 lg:p-8 flex flex-col items-center gap-3 pb-[260px] lg:pb-8">
        <div class="lg:hidden w-full px-3 pt-3">
          <p class="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">// PROTOTYPE · NOT BUILT</p>
          <p class="font-display text-lg text-white">${name}</p>
        </div>
        <div id="devices" class="grid grid-cols-4 gap-1 w-full px-3 lg:px-0 lg:w-auto lg:flex lg:gap-2"></div>
        <div id="frameWrap" class="w-full flex justify-center">
          <div id="frameBox" class="overflow-hidden lg:border lg:border-white/25 bg-background"><iframe id="frame" title="Simulated app screen" class="block border-0 bg-background" style="transform-origin:0 0"></iframe></div>
        </div>
        <p id="devInfo" class="font-mono text-[10px] text-muted-foreground"></p>
        <details class="lg:hidden w-full px-3 border-t border-border pt-2">
          <summary class="font-mono text-[11px] tracking-widest text-muted-foreground min-h-[44px] flex items-center cursor-pointer">DEMO CONTROLS</summary>
          <div class="pb-4">${controls()}</div>
          <p class="font-mono text-[11px] text-muted-foreground pb-4">${sync}</p>
        </details>
      </section>
      <div id="bar" class="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-background border-t border-primary/60 px-3 pt-2 pb-3"></div>
    </div>`;
    const iframe = document.getElementById('frame');
    fdoc = iframe.contentDocument;
    fdoc.open();
    fdoc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="${new URL('journeys.css', location.href).href}"><style>html,body{height:100%;margin:0;background:hsl(0 0% 1%)}#screen{height:100%}</style></head><body><div id="screen"></div></body></html>`);
    fdoc.close();
    fdoc.addEventListener('click', onClick);
    fdoc.addEventListener('input', onInput);
    const link = fdoc.querySelector('link'); if (link) link.addEventListener('load', () => scrollScreenTo(steps[S.step].f));
    fit();
  }
  function fillChrome() {
    const st = steps[S.step];
    const nav = (cls) => `<div class="grid grid-cols-2 gap-2 ${cls}">
      <button data-a="back" ${S.step === 0 ? 'disabled' : ''} class="font-mono text-[11px] tracking-widest min-h-[44px] border border-border text-muted-foreground disabled:opacity-40">BACK</button>
      <button data-a="next" ${S.step === steps.length - 1 ? 'disabled' : ''} class="font-mono text-[11px] tracking-widest min-h-[44px] border border-primary bg-primary/20 text-white disabled:opacity-40">NEXT</button></div>`;
    const card = document.getElementById('guideCard');
    if (card) card.innerHTML = `<div class="border border-primary/60 bg-primary/[0.06] p-4">
      <p class="font-mono text-[11px] tracking-widest text-[#26C6DA] mb-1">STEP ${S.step + 1} OF ${steps.length}</p>
      <h2 class="font-display text-lg text-white mb-2">${st.t}</h2>
      <p class="font-mono text-xs text-foreground leading-relaxed">${st.b}</p>${nav('mt-4')}</div>`;
    const list = document.getElementById('stepList');
    if (list) list.innerHTML = steps.map((x, i) => `<li><button data-a="step" data-v="${i}" class="w-full text-left font-mono text-[11px] min-h-[36px] px-2 ${i === S.step ? 'text-white bg-primary/15' : 'text-muted-foreground hover:text-white'}">${i + 1}. ${x.t}</button></li>`).join('');
    const bar = document.getElementById('bar');
    if (bar) bar.innerHTML = `<div class="flex items-center justify-between gap-2">
        <p class="font-mono text-[11px] tracking-widest text-[#26C6DA]">STEP ${S.step + 1} OF ${steps.length}</p>
        <button data-a="more" class="font-mono text-[11px] tracking-widest text-muted-foreground min-h-[44px] px-2">${uiMore ? 'LESS' : 'MORE'}</button>
      </div>
      <h2 class="font-display text-base text-white leading-tight">${st.t}</h2>
      <p class="font-mono text-xs leading-relaxed mt-1 ${uiMore ? '' : 'line-clamp-2'}">${st.b}</p>${nav('mt-2')}`;
    const dev = document.getElementById('devices');
    if (dev) dev.innerHTML = Object.entries(DEVICES).map(([k, [, , label]]) => `<button data-a="device" data-v="${k}" class="font-mono text-[11px] tracking-widest px-1 lg:px-3 min-h-[44px] border ${S.device === k ? 'border-primary text-white bg-primary/20' : 'border-border text-muted-foreground hover:text-white'}">${label}</button>`).join('');
    const info = document.getElementById('devInfo'); if (info) info.textContent = !wide() && (S.device === 'phone' || S.device === 'small') ? 'Fitted to your screen height' : DEVICES[S.device].slice(0, 2).join(' x ') + (!wide() && DEVICES[S.device][0] > 600 ? ' · shrunk to fit, best viewed on a computer' : '');
  }
  function clockText() { return `${fmt(now(), JOURNEY === 'host' ? S.hostZone : S.guestZone, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })}`; }
  function fit() {
    const fr = document.getElementById('frame'), box = document.getElementById('frameBox'), wrap = document.getElementById('frameWrap'); if (!fr) return;
    const [w, dh] = DEVICES[S.device]; const z = Math.min(1, wrap.clientWidth / w);
    let h = dh;
    if (!wide() && (S.device === 'phone' || S.device === 'small')) {
      const bar = document.getElementById('bar'); const top = box.getBoundingClientRect().top + window.scrollY;
      h = Math.max(420, Math.min(dh, Math.floor(window.innerHeight - top - (bar ? bar.offsetHeight : 180) - 8)));
    }
    frameH = h;
    fr.style.width = w + 'px'; fr.style.height = h + 'px'; fr.style.transform = z < 1 ? `scale(${z})` : '';
    box.style.width = w * z + 'px'; box.style.height = h * z + 'px';
  }
  window.addEventListener('resize', () => { if ([S.device, wide()].join('|') !== frameKey) render(); else fit(); });

  /* ═════════════ EVENTS ═════════════ */
  function refuse(msg) { S.alert = msg; S.confirmId = null; S.editId = null; save(); render(); scrollScreenTo('[role="alert"]'); }
  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
    const a = b.dataset.a, v = b.dataset.v;
    switch (a) {
      case 'next': return goStep(S.step + 1);
      case 'back': return goStep(S.step - 1);
      case 'step': return goStep(+v);
      case 'more': uiMore = !uiMore; return render();
      case 'device': return set({ device: v, userDevice: v });
      case 'reset': try { localStorage.removeItem(KEY); } catch {} S = fresh(); steps[0].go(); save(); render(); return scrollScreenTo(null);
      case 'time': S.simOffset += +v; return set({});
      case 'jumpNext': { const n = upcoming().find((x) => x.startsAt > now()); if (n) jumpTo(n.startsAt - 10 * MIN); return set({}); }
      case 'tab': set({ tab: v, confirmId: null }); return scrollScreenTo(null);
      case 'past': return set({ pastOpen: !S.pastOpen });
      case 'add': {
        const val = validate(S.draft); if (!val.ok) return;
        if (S.failWrites) return refuse('Not saved. The server refused the change: your host sign-in has expired. Reload the console and sign in again.');
        S.saving = true; render();
        return setTimeout(() => { S.shows.push({ id: 'n' + Date.now(), title: S.draft.title.trim(), startsAt: val.ms }); S.draft = { title: '', start: '' }; S.saving = false; S.alert = ''; save(); render(); }, 600);
      }
      case 'edit': { const x = S.shows.find((y) => y.id === v); return set({ editId: v, confirmId: null, editDraft: { title: x.title, start: utcToLocalInput(x.startsAt, S.hostZone) } }); }
      case 'cancelEdit': return set({ editId: null });
      case 'saveEdit': {
        if (S.failWrites) return refuse('Not saved. The server refused the change: your host sign-in has expired. Reload the console and sign in again.');
        const val = validate(S.editDraft, S.editId); if (!val.ok) return;
        const x = S.shows.find((y) => y.id === S.editId); x.title = S.editDraft.title.trim(); x.startsAt = val.ms;
        return set({ editId: null, alert: '' });
      }
      case 'del': return set({ confirmId: v, editId: null });
      case 'delNo': return set({ confirmId: null });
      case 'delYes': {
        if (S.failWrites) return refuse('Not deleted. The server refused the change: your host sign-in has expired. Reload the console and sign in again.');
        S.shows = S.shows.filter((x) => x.id !== v); return set({ confirmId: null, alert: '' });
      }
      case 'golive': goLive(); return set({});
      case 'end': endShow(); return set({});
      case 'avatar': return set({ guestAvatar: +v });
      case 'tunein': return set({ guestInRoom: true });
      case 'simGo': S.station = { mode: 'live', title: (suggestion() || upcoming()[0] || {}).title || 'Subspace Radio Live', startedAt: now() }; S.hostStatus = 'live'; return set({ guestInRoom: false });
      case 'simEnd': S.station = { mode: 'off', title: S.station.title, startedAt: null }; S.hostStatus = 'idle'; return set({ guestInRoom: false });
      case 'simShift': { const n = upcoming()[0]; if (n) n.startsAt += 30 * MIN; return set({}); }
      case 'arm': S.auto.armed = true; S.auto.state = 'armed'; S.auto.fail = null; return set({});
      case 'disarm': S.auto.armed = false; S.auto.state = 'off'; return set({});
      case 'files': return set({ filesOpenId: S.filesOpenId === v ? null : v });
      case 'fadd': { const l = S.playlists[v] || (S.playlists[v] = []); const f = EXTRA_FILES[l.length % 2] || EXTRA_FILES[0]; l.push({ ...f }); return set({}); }
      case 'fup': case 'fdown': case 'frm': { const [id, ix] = v.split(':'); const l = S.playlists[id]; const i = +ix; if (a === 'frm') l.splice(i, 1); else { const j = a === 'fup' ? i - 1 : i + 1; [l[i], l[j]] = [l[j], l[i]]; } return set({}); }
      case 'neon': { const [id, m] = v.split(':'); S.shows.find((x) => x.id === id).neon = m; return set({}); }
      case 'simDemo': S.shows = [...DEMO_SHOWS(), ...PAST_SHOWS()]; return set({});
    }
  }
  function onInput(e) {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    const val = e.target.value;
    if (a === 'disp') { const [id, ix] = e.target.dataset.v.split(':'); S.playlists[id][+ix].name = val; save(); return; }
    if (a === 'titleField') { S.titleField = val; S.lastPrefill = null; S.titleEdited = true; save(); return; }
    if (a === 'guestName') { S.guestName = val; save(); const t = fdoc.querySelector('[data-a="tunein"]'); if (t) t.disabled = val.trim().length < 2; return; }
    if (a === 'draftTitle') S.draft.title = val;
    if (a === 'draftStart') S.draft.start = val;
    if (a === 'editTitle') S.editDraft.title = val;
    if (a === 'editStart') S.editDraft.start = val;
    save();
    if (a === 'draftStart' || a === 'editStart') return render();
    const isEdit = a.startsWith('edit');
    const pv = fdoc.getElementById(isEdit ? 'editPreview' : 'draftPreview'); if (pv) pv.innerHTML = preview(isEdit ? S.editDraft : S.draft, isEdit ? S.editId : undefined);
    const okNow = validate(isEdit ? S.editDraft : S.draft, isEdit ? S.editId : undefined).ok;
    const btn = fdoc.querySelector(isEdit ? '[data-a="saveEdit"]' : '[data-a="add"]');
    if (btn && btn.disabled === okNow) render();
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);

  /* ═════════════ TICK ═════════════ */
  let lastKey = '';
  function phaseKey() {
    const st = standbyState(); const n = JOURNEY === 'listener' && guestView() === 'room' ? neonText().text : '';
    const sug = suggestion();
    const tr = nowTrack();
    return [S.auto.state, S.auto.running, tr && tr.i, st.kind, st.next && st.next.id, st.later.map((x) => x.id).join(','), S.station.mode, guestView(), n, sug && sug.id, upcoming().length, past().length].join('|');
  }
  setInterval(() => {
    autoTick();
    if (phaseKey() !== lastKey) { const a = fdoc && fdoc.activeElement; if (!(a && a.tagName === 'INPUT' && a.type === 'datetime-local')) return render(); }
    if (fdoc) {
      fdoc.querySelectorAll('[data-cd]').forEach((el) => { el.innerHTML = countdown(+el.dataset.cd - now()); });
      fdoc.querySelectorAll('[data-rel]').forEach((el) => { el.textContent = rel(+el.dataset.rel); });
    }
    document.querySelectorAll('[data-clock]').forEach((c) => { c.textContent = clockText(); });
  }, 1000);

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  if (!hadStored) steps[0].go(); else if (JOURNEY === 'listener') { ensureDemoShows(); S.guestInRoom = false; }
  save(); render();
})();
