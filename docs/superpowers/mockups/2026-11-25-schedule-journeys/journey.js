/* Subspace Radio SCHEDULE - clickable journey prototype. NOT production code.
   One file drives both pages; document.body.dataset.journey is 'host' or 'listener'.
   State is shared through localStorage, so the two pages stay in sync when both are open. */
(() => {
  const JOURNEY = document.body.dataset.journey;
  const KEY = 'sr-schedule-journey-v1';
  const ISRAEL = 'Asia/Jerusalem';
  const DEMO_START = Date.UTC(2026, 10, 24, 16, 37, 52); // Tue 24 Nov 2026, 18:37:52 Israel
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR, GRACE = 30 * MIN, SUGGEST_AHEAD = 6 * HOUR;
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
      // guest UI
      guestInRoom: false, guestName: 'Nebula Drifter', guestAvatar: 1,
      device: JOURNEY === 'host' && window.innerWidth >= 1024 ? 'desktop' : 'phone',
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
  const upcoming = () => S.shows.filter((s) => s.startsAt > now() - GRACE).sort((a, b) => a.startsAt - b.startsAt);
  const past = () => S.shows.filter((s) => s.startsAt <= now() - GRACE).sort((a, b) => b.startsAt - a.startsAt);
  function standbyState() {
    const u = upcoming();
    if (!u.length) return { kind: 'tba', later: [] };
    const next = u[0];
    return { kind: next.startsAt <= now() ? 'soon' : 'countdown', next, later: u.slice(1, 3) };
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
    spark: svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  };

  /* ═════════════ HOST CONSOLE ═════════════ */
  function hostScreen() {
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
        </div>
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
          <p class="font-mono text-[11px] ${soon ? 'text-amber-400' : 'text-[#26C6DA]'}"><span data-rel="${s.startsAt}">${rel(s.startsAt)}</span>${soon ? ' · guests see STARTING SOON' : ''}</p>
        </div>
        ${confirm ? '' : `<div class="flex flex-col sm:flex-row gap-1 shrink-0 items-start">
          ${isPast ? '' : `<button data-a="edit" data-v="${s.id}" aria-label="Edit ${esc(s.title)}" class="w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground hover:text-white hover:border-primary">${I.pencil}</button>`}
          <button data-a="del" data-v="${s.id}" aria-label="Delete ${esc(s.title)}" class="w-11 h-11 border border-border inline-flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-500">${I.trash}</button>
        </div>`}
      </div>
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
    const status = soon
      ? `<p class="font-mono text-[#26C6DA] text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#26C6DA]"></span>STANDING BY</p>`
      : `<p class="font-mono text-white/60 text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-white/50"></span>SIGNAL OFFLINE</p>`;
    return `<div class="min-h-full bg-[#05060f] radio-nebula relative overflow-x-hidden flex flex-col items-center justify-center px-6 py-10 [@media(max-height:500px)]:py-6 text-center">
      <div class="absolute inset-0 radio-stars pointer-events-none"></div>
      <div class="absolute inset-x-0 top-0 h-1/3 radio-aurora pointer-events-none"></div>
      <div class="absolute inset-x-0 bottom-0 h-[30%] radio-floor-glow pointer-events-none"></div>
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
        <p class="font-mono text-[10px] text-white/60 mt-1">${n.track ? 'track name peeking (15 s each minute)' : 'broadcast title'}</p>
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
      <p class="relative z-10 font-mono text-white/60 text-[10px] text-center pb-3 px-4">The room is unchanged and simplified here. Only the neon text is affected, by the title you set.</p>
    </div>`;
  }

  /* ═════════════ STEPS ═════════════ */
  const ensureDemoShows = () => { for (const d of [...DEMO_SHOWS(), ...PAST_SHOWS()]) if (!S.shows.some((s) => s.id === d.id)) S.shows.push(d); };
  const s1 = () => S.shows.find((s) => s.id === 's1');
  const jumpTo = (ms) => { S.simOffset = ms - Date.now(); };
  const HOST_STEPS = [
    { t: 'Your console, off air', b: 'This is your host console as it is today. Nothing here changes except the BROADCAST TITLE field, which you will see later. Tap SCHEDULE in the tab bar, or press Next.', go: () => { Object.assign(S, fresh(), { device: S.device }); S.tab = 'broadcast'; } },
    { t: 'Open SCHEDULE', b: 'The new tab. Nothing is scheduled yet, so guests see NEXT TRANSMISSION: TBA. PAST holds old shows and stays folded.', go: () => { S.tab = 'schedule'; } },
    { t: 'Add your first show', f: '[data-a="add"]', b: 'Type a title and pick the start in your own time. Before saving you see it back with UTC and how far away it is. Press ADD TO SCHEDULE. Next adds it for you if you skip.', go: () => { S.tab = 'schedule'; S.draft = { title: 'Psy Night Vol. 7', start: '2026-11-29T22:00' }; }, leave: () => { if (!s1()) S.shows.push({ id: 's1', title: 'Psy Night Vol. 7', startsAt: wall(2026, 11, 29, 22, 0) }); S.draft = { title: '', start: '' }; } },
    { t: 'Add more, and see a clash warning', f: '#draftPreview', b: 'Two more shows are added. The form now holds "Goa Classics part 2" at 21:30, 30 minutes after another show: you get a heads-up, but can still save it.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.draft = { title: 'Goa Classics part 2', start: '2026-12-06T21:30' }; }, leave: () => { S.draft = { title: '', start: '' }; } },
    { t: 'DJing abroad', f: '#draftPreview', b: 'You are DJing in Goa and your phone is on India time. The preview shows the time on your phone, the Israel time and UTC, with an amber note, so you never save the wrong hour by accident.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.hostZone = 'Asia/Kolkata'; S.draft = { title: 'Goa Sunrise', start: '2026-12-12T06:00' }; }, leave: () => { S.hostZone = ISRAEL; S.draft = { title: '', start: '' }; } },
    { t: 'Edit a show', f: '[data-a="saveEdit"]', b: 'The pencil opens the show in place. Change the time to 22:30 and press SAVE. Only one show is open for editing at a time.', go: () => { ensureDemoShows(); S.tab = 'schedule'; const s = s1(); S.editId = s.id; S.editDraft = { title: s.title, start: utcToLocalInput(s.startsAt, S.hostZone) }; } , leave: () => { S.editId = null; } },
    { t: 'Delete takes two taps', f: '[data-a="delYes"]', b: 'The bin asks first. DELETE removes the show, KEEP backs out. Try it on the last show.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.editId = null; S.confirmId = upcoming().slice(-1)[0]?.id || null; }, leave: () => { S.confirmId = null; } },
    { t: 'If a change fails', f: '[data-a="edit"]', b: 'Here the server refuses every change, as it would if your host sign-in had expired. Try editing or deleting: you get a red message, never a fake success.', go: () => { ensureDemoShows(); S.tab = 'schedule'; S.failWrites = true; S.alert = ''; }, leave: () => { S.failWrites = false; S.alert = ''; } },
    { t: 'Show day: the title is already filled', b: 'It is 50 minutes before Psy Night Vol. 7. On BROADCAST, the title is already filled in from the schedule, with a "From schedule" hint. Type over it, or clear it to show LIVE DJ, and it stays the way you left it.', go: () => { ensureDemoShows(); S.tab = 'broadcast'; S.titleField = ''; S.lastPrefill = null; S.titleEdited = false; jumpTo(s1().startsAt - 50 * MIN); } },
    { t: 'GO LIVE', b: 'Press GO LIVE. On guests\' screens the neon line under the DJ shows this title most of the time, and the track name peeks in for 15 seconds each minute. Open the listener journey in another tab to watch.', go: () => { S.tab = 'broadcast'; }, leave: () => { if (S.hostStatus !== 'live') goLive(); } },
    { t: 'Edit the schedule while ON AIR', b: 'The SCHEDULE tab works mid-show, adding included. The broadcast keeps running underneath; switching tabs never touches it.', go: () => { if (S.hostStatus !== 'live') goLive(); S.tab = 'schedule'; } },
    { t: 'END BROADCAST', b: 'Press END BROADCAST. Psy Night Vol. 7 stays suggested until 30 minutes after its start time. After that, the next show takes over the title field on its own day (within 6 hours of its start).', go: () => { S.tab = 'broadcast'; }, leave: () => { if (S.hostStatus === 'live') endShow(); } },
    { t: 'Running late', f: '[data-soon]', b: 'It is 7 minutes past the start of Goa Classics 1998 and you are not live. The row turns amber: guests see STARTING SOON for 30 minutes, then the countdown moves on to the next show.', go: () => { ensureDemoShows(); if (S.hostStatus === 'live') endShow(); S.tab = 'schedule'; jumpTo(S.shows.find((s) => s.id === 's2').startsAt + 7 * MIN); } },
    { t: 'Done', b: 'That is the whole host side. Open the listener journey to see the same shows from a guest\'s phone. Reset demo starts over.', go: () => {} },
  ];
  const LISTENER_STEPS = [
    { t: 'A guest opens your link, off air', b: 'They see the countdown straight away, with no name, avatar or sign-in first. Then the next two shows under LATER. The countdown is live.', go: () => { Object.assign(S, fresh(), { device: S.device }); ensureDemoShows(); } },
    { t: 'Same moment, a guest in New York', b: 'Same countdown. Times in their own zone and in their phone\'s format.', go: () => { ensureDemoShows(); S.guestZone = 'America/New_York'; S.guestLocale = 'en-US'; }, leave: () => { S.guestZone = ISRAEL; S.guestLocale = 'en-GB'; } },
    { t: 'You move the show', b: 'You moved Psy Night Vol. 7 to 22:30 in the console. A waiting guest sees the change within a minute (instantly in this demo).', go: () => { ensureDemoShows(); const s = s1(); s.startsAt = wall(2026, 11, 29, 22, 30); } },
    { t: 'Show time, you are 7 minutes late', b: 'The countdown hit zero and you are not live yet. Guests see STANDING BY and STARTING SOON for 30 minutes, then it moves on to the next show.', go: () => { ensureDemoShows(); S.station.mode = 'off'; S.guestInRoom = false; jumpTo(s1().startsAt + 7 * MIN); } },
    { t: 'You press GO LIVE', b: 'Within seconds the page switches by itself to the existing entry screen. This is the first time the guest picks a name and avatar.', go: () => { ensureDemoShows(); S.guestInRoom = false; S.station = { mode: 'live', title: s1().title, startedAt: now() }; S.hostStatus = 'live'; } },
    { t: 'The guest tunes in', b: 'Press TUNE IN. The neon line under the DJ shows your title from the schedule, and the track name peeks in for 15 seconds each minute.', go: () => { if (S.station.mode !== 'live') { S.station = { mode: 'live', title: s1()?.title || '', startedAt: now() }; S.hostStatus = 'live'; } }, leave: () => { S.guestInRoom = true; } },
    { t: 'You end the broadcast early', b: 'Known limit: if you end within 30 minutes of the scheduled start, the screen still says STARTING SOON until those 30 minutes are up. Next moves time on 30 minutes.', go: () => { S.station = { mode: 'off', title: S.station.title, startedAt: null }; S.hostStatus = 'idle'; S.guestInRoom = false; } },
    { t: 'Back to the countdown', b: '30 minutes later the screen counts down to the next show, Goa Classics 1998.', go: () => { ensureDemoShows(); S.station.mode = 'off'; S.guestInRoom = false; jumpTo(s1().startsAt + GRACE + MIN); } },
    { t: 'Nothing scheduled', b: 'With no shows at all: NEXT TRANSMISSION TBA and the archive link.', go: () => { S.shows = [...PAST_SHOWS()]; S.station.mode = 'off'; } },
    { t: 'Small and sideways phones', b: 'Use the device buttons above the phone: small phone and sideways. The screen scrolls when it does not fit. Reset demo starts over.', go: () => { ensureDemoShows(); S.device = 'small'; } },
  ];
  steps = JOURNEY === 'host' ? HOST_STEPS : LISTENER_STEPS;

  function goStep(i) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    const cur = steps[S.step];
    if (i === S.step + 1) { if (cur && cur.leave) cur.leave(); }
    else {
      // Any other move (BACK or a jump) replays the demo from scratch, so every step is deterministic.
      S = { ...fresh(), device: S.device };
      for (let k = 0; k < i; k++) { steps[k].go(); if (steps[k].leave) steps[k].leave(); }
    }
    S.step = i;
    steps[S.step].go();
    save(); render();
    scrollScreenTo(steps[S.step].f);
  }
  function goLive() { applyPrefill(); S.hostStatus = 'live'; S.station = { mode: 'live', title: S.titleField.trim() || 'Subspace Radio Live', startedAt: now() }; }
  function endShow() { S.titleEdited = false; S.hostStatus = 'idle'; S.station = { mode: 'off', title: S.station.title, startedAt: null }; }

  /* ═════════════ RENDER ═════════════ */
  const DEVICES = { phone: [390, 844, 'PHONE'], small: [320, 568, 'SMALL'], sideways: [844, 390, 'SIDEWAYS'], desktop: [1280, 800, 'DESKTOP'] };
  const wide = () => window.innerWidth >= 1024;
  let frameKey = '', fdoc = null, uiMore = false, frameH = 0;
  function render() {
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
      case 'device': return set({ device: v });
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
      case 'simDemo': S.shows = [...DEMO_SHOWS(), ...PAST_SHOWS()]; return set({});
    }
  }
  function onInput(e) {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    const val = e.target.value;
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
    return [st.kind, st.next && st.next.id, st.later.map((x) => x.id).join(','), S.station.mode, guestView(), n, sug && sug.id, upcoming().length, past().length].join('|');
  }
  setInterval(() => {
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
