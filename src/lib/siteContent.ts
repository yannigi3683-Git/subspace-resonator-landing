import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

import gallery01 from "@/assets/gallery-01.webp";
import gallery02 from "@/assets/gallery-02.webp";
import gallery03 from "@/assets/gallery-03.webp";
import gallery04 from "@/assets/gallery-04.webp";
import gallery05 from "@/assets/gallery-05.webp";
import gallery06 from "@/assets/gallery-06.webp";
import gallery07 from "@/assets/gallery-07.webp";
import gallery08 from "@/assets/gallery-08.webp";
import gallery09 from "@/assets/gallery-09.webp";
import gallery11 from "@/assets/gallery-11.webp";
import gallery12 from "@/assets/gallery-12.webp";
import gallery13 from "@/assets/gallery-13.webp";
import gallery14 from "@/assets/gallery-14.webp";
import gallery15 from "@/assets/gallery-15.webp";
import gallery16 from "@/assets/gallery-16.webp";
import gallery17 from "@/assets/gallery-17.webp";
import gallery18 from "@/assets/gallery-18.webp";
import gallery20 from "@/assets/gallery-20.webp";
import gallery21 from "@/assets/gallery-21.webp";
import gallery22 from "@/assets/gallery-22.webp";
import gallery23 from "@/assets/gallery-23.webp";
import liveAlpha from "@/assets/live-alpha.webp";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GalleryItem  = { id: string; src: string; alt: string; mediaType?: 'image' | 'video'; videoEmbedUrl?: string };
export type EventItem    = { id: string; date: string; title: string; location: string; link?: string };
export type SocialItem   = { name: string; url: string };
export type BioContent   = { signal: string; reactivation: string; mission: string };
export type BookingContent = { email: string; phone: string };
export type Release = {
  id: string;
  date: string;
  title: string;
  kind: 'EP' | 'Single' | 'LP' | 'Remix' | 'Compilation';
  label: string;
  trackCount?: number;
  trackName?: string;
  url?: string;
};
export type ReleasesContent = { solo: Release[]; compilations: Release[] };

export type GalleryOverrides = {
  order: string[];
  deleted: string[];
  alt: Record<string, string>;
  added: GalleryItem[];
};

type SiteContent = {
  events: EventItem[];
  gallery: GalleryOverrides;
  bio: BioContent;
  socials: SocialItem[];
  releases: ReleasesContent;
  booking: BookingContent;
};

// ─── Limits ───────────────────────────────────────────────────────────────────

export const LIMITS = {
  MAX_GALLERY_ITEMS: 80,
  MAX_EVENTS: 40,
  MAX_TEXT_LEN: 2000,
  MAX_SHORT_TEXT: 200,
  MAX_URL_LEN: 2000,
} as const;

// ─── Sanitizers ───────────────────────────────────────────────────────────────

export class AdminValidationError extends Error {}

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeText(v: unknown, max: number = LIMITS.MAX_TEXT_LEN): string {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_CHARS, '').trim().slice(0, max);
}

export function sanitizeUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s) return '';
  if (s.length > LIMITS.MAX_URL_LEN) throw new AdminValidationError('URL too long.');
  const lower = s.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('/')) return s;
  throw new AdminValidationError('Only http(s) URLs are allowed.');
}

function sanitizeId(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function sanitizeDate(v: unknown): string {
  if (typeof v !== 'string') return '';
  if (/^\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))) return v;
  return '';
}

// ─── Defaults (= current production content) ──────────────────────────────────

export const DEFAULT_GALLERY: GalleryItem[] = [
  { id: "g1",         src: gallery01,  alt: "Hindi Goa — UV night stage" },
  { id: "g2",         src: gallery02,  alt: "Hindi Goa — crowd daytime" },
  { id: "g4",         src: gallery04,  alt: "Hindi Goa — crowd energy" },
  { id: "g23",        src: gallery23,  alt: "UV stage — night banner glow" },
  { id: "g18",        src: gallery18,  alt: "Unleash Your Mind — hands up to the crowd" },
  { id: "live-alpha", src: liveAlpha,  alt: "Live performance — outdoor stage" },
  { id: "g3",         src: gallery03,  alt: "Yanni DJing — Hindi Goa" },
  { id: "g17",        src: gallery17,  alt: "Yanni mixing — Pioneer DJ outdoor set" },
  { id: "g5",         src: gallery05,  alt: "Behind the decks — psytrance backdrop" },
  { id: "g13",        src: gallery13,  alt: "Yanni mixing — night session" },
  { id: "g14",        src: gallery14,  alt: "Yanni on Pioneer DJ — golden hour" },
  { id: "g8",         src: gallery08,  alt: "Yanni live — Subspace Resonator hoodie" },
  { id: "g6",         src: gallery06,  alt: "Yanni backstage" },
  { id: "g7",         src: gallery07,  alt: "Yanni & Ido — behind the scenes" },
  { id: "g9",         src: gallery09,  alt: "Yanni & fan — forest party" },
  { id: "g11",        src: gallery11,  alt: "Yanni with fan — Subspace Resonator flyer" },
  { id: "g12",        src: gallery12,  alt: "Backstage with fellow DJ" },
  { id: "g20",        src: gallery20,  alt: "Yanni & friend — forest gathering selfie" },
  { id: "g21",        src: gallery21,  alt: "Jungle Sounds — b2b mixing session" },
  { id: "g22",        src: gallery22,  alt: "Crew selfie — Subspace Resonator tee" },
  { id: "g15",        src: gallery15,  alt: "Jungle Sounds — full crew photo" },
  { id: "g16",        src: gallery16,  alt: "Yanni with artists — outdoor stage" },
];

export const DEFAULT_EVENTS: EventItem[] = [];

export const DEFAULT_BIO: BioContent = {
  signal: "Emerging from the late-'90s Goa Trance movement, I operated when the underground was still a guarded frequency. No stage names, no digital footprints. If you knew the coordinates, you were part of the resonance. That's the signal I carry.",
  reactivation: "Back after two decades off the radar. Bringing Goa-inspired grooves, multidimensional textures, and alien frequencies. This is sharp production, engineered for the underground, with a lot of soul, not for the algorithm.",
  mission: "To deliver mind-bending frequencies and grant direct access to new sonic dimensions. Catch upcoming releases to be a part of the resonance. The Subspace Resonator is back transmitting sonic adventures through space and time. Join me on a voyage to the unfamiliar parts of the universe. Unleash your mind.",
};

export const DEFAULT_SOCIALS: SocialItem[] = [
  { name: 'SoundCloud',   url: 'https://soundcloud.com/subspaceresonance' },
  { name: 'Bandcamp',     url: 'https://yannig.bandcamp.com/' },
  { name: 'Spotify',      url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk' },
  { name: 'Beatport',     url: 'https://www.beatport.com/artist/subspace-resonator/1354950' },
  { name: 'YouTube',      url: 'https://www.youtube.com/@SubspaceResonator' },
  { name: 'Facebook',     url: 'https://www.facebook.com/profile.php?id=61559198105695' },
  { name: 'Instagram',    url: 'https://www.instagram.com/subspace_resonator' },
  { name: 'TikTok',       url: 'https://www.tiktok.com/@subspace.resonato' },
  { name: 'Discogs',      url: 'https://www.discogs.com/artist/15101171-Subspace-Resonator' },
  { name: 'Live Events',  url: 'https://soundcloudevents.velvetcake.live/' },
  { name: 'Linktree',     url: 'https://linktr.ee/yanni_subspace_resonator' },
];

export const DEFAULT_RELEASES: ReleasesContent = {
  solo: [
    { id: 'subspace-theory',    date: '2025-12-26', title: 'The Subspace Theory',  kind: 'EP',     label: 'Goa Records',      trackCount: 4, url: 'https://yannig.bandcamp.com/album/the-subspace-theory-ep' },
    { id: 'nightmare-in-heaven',date: '2025-10-31', title: 'Nightmare In Heaven',  kind: 'Single', label: 'Timewarp Records',  url: 'https://yannig.bandcamp.com/track/nightmare-in-heaven' },
    { id: 'galaxy-604',          date: '2025',       title: 'Galaxy 604',           kind: 'Single', label: 'Goa Records' },
  ],
  compilations: [
    { id: 'call-of-goa-5',       date: '2026',       title: 'The Call Of Goa, Vol. 5',                kind: 'Compilation', label: 'Timewarp Records',   trackName: 'Subspace Disturbance', url: 'https://timewarprecords.bandcamp.com/album/the-call-of-goa-vol-5' },
    { id: 'psychedelic-goa-2026', date: '2026-01-09', title: 'Psychedelic Goa Trance 2026 100 Aliens', kind: 'Compilation', label: 'Fresh Frequencies',  trackName: 'Galaxy 604',           url: 'https://freshfrequencies.bandcamp.com/album/psychedelic-goa-trance-2026-100-aliens' },
    { id: 'psy-trance-2026',      date: '2026',       title: 'Psy Trance 2026 Space DJ',               kind: 'Compilation', label: 'Fresh Frequencies',  trackName: 'Galaxy 604',           url: 'https://open.spotify.com/album/73EV8DxuOgSoAhqSXSYhwn?si=NOD-pJajTYKP-Yr6trlgqg' },
  ],
};

export const DEFAULT_BOOKING: BookingContent = {
  email: 'subspaceresonator@gmail.com',
  phone: '+972507974184',
};

// ─── Validators ───────────────────────────────────────────────────────────────

function emptyGalleryOverrides(): GalleryOverrides {
  return { order: [], deleted: [], alt: {}, added: [] };
}

function validateGalleryOverrides(raw: unknown): GalleryOverrides {
  if (!raw || typeof raw !== 'object') return emptyGalleryOverrides();
  const g = raw as Record<string, unknown>;
  const order = Array.isArray(g.order)
    ? Array.from(new Set(g.order.map(sanitizeId).filter(Boolean))).slice(0, LIMITS.MAX_GALLERY_ITEMS * 2)
    : [];
  const deleted = Array.isArray(g.deleted)
    ? Array.from(new Set(g.deleted.map(sanitizeId).filter(Boolean))).slice(0, LIMITS.MAX_GALLERY_ITEMS * 2)
    : [];
  const altSource = g.alt && typeof g.alt === 'object' ? (g.alt as Record<string, unknown>) : {};
  const alt: Record<string, string> = {};
  let altCount = 0;
  for (const [k, v] of Object.entries(altSource)) {
    if (altCount >= LIMITS.MAX_GALLERY_ITEMS * 2) break;
    const id = sanitizeId(k);
    if (!id) continue;
    alt[id] = sanitizeText(v, LIMITS.MAX_SHORT_TEXT);
    altCount++;
  }
  const added: GalleryItem[] = [];
  for (const item of Array.isArray(g.added) ? g.added : []) {
    if (added.length >= LIMITS.MAX_GALLERY_ITEMS) break;
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    try {
      const src = sanitizeUrl(it.src);
      if (!src) continue;
      const mediaType = it.mediaType === 'video' ? 'video' : 'image';
      let videoEmbedUrl: string | undefined;
      try { videoEmbedUrl = it.videoEmbedUrl ? sanitizeUrl(it.videoEmbedUrl) : undefined; } catch { videoEmbedUrl = undefined; }
      added.push({ id: sanitizeId(it.id) || `u-${added.length}`, src, alt: sanitizeText(it.alt, LIMITS.MAX_SHORT_TEXT) || 'Untitled', mediaType, videoEmbedUrl });
    } catch { /* skip malformed */ }
  }
  return { order, deleted, alt, added };
}

function validateEvents(arr: unknown[]): EventItem[] {
  const out: EventItem[] = [];
  for (const item of arr) {
    if (out.length >= LIMITS.MAX_EVENTS) break;
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    let link = '';
    try { link = it.link ? sanitizeUrl(it.link) : ''; } catch { link = ''; }
    out.push({
      id: sanitizeId(it.id) || `e-${out.length}`,
      date: sanitizeDate(it.date),
      title: sanitizeText(it.title, LIMITS.MAX_SHORT_TEXT) || 'Untitled',
      location: sanitizeText(it.location, LIMITS.MAX_SHORT_TEXT),
      link: link || undefined,
    });
  }
  return out;
}

function validateBio(raw: unknown): BioContent {
  if (!raw || typeof raw !== 'object') return DEFAULT_BIO;
  const b = raw as Record<string, unknown>;
  return {
    signal: sanitizeText(b.signal) || DEFAULT_BIO.signal,
    reactivation: sanitizeText(b.reactivation) || DEFAULT_BIO.reactivation,
    mission: sanitizeText(b.mission) || DEFAULT_BIO.mission,
  };
}

function validateSocials(arr: unknown[]): SocialItem[] {
  const urlMap: Record<string, string> = {};
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const name = sanitizeText(it.name, LIMITS.MAX_SHORT_TEXT);
    let url = '';
    try { url = sanitizeUrl(it.url); } catch { url = ''; }
    if (name) urlMap[name] = url;
  }
  return DEFAULT_SOCIALS.map(s => ({ name: s.name, url: urlMap[s.name] || s.url }));
}

function validateBooking(raw: unknown): BookingContent {
  if (!raw || typeof raw !== 'object') return DEFAULT_BOOKING;
  const b = raw as Record<string, unknown>;
  return {
    email: sanitizeText(b.email, 254) || DEFAULT_BOOKING.email,
    phone: sanitizeText(b.phone, 20) || DEFAULT_BOOKING.phone,
  };
}

function validateReleaseArray(arr: unknown[]): Release[] {
  const out: Release[] = [];
  for (const item of arr) {
    if (out.length >= 100) break;
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const kind = it.kind === 'EP' || it.kind === 'Single' || it.kind === 'LP' || it.kind === 'Remix' || it.kind === 'Compilation' ? it.kind : 'Single';
    let url = '';
    try { url = it.url ? sanitizeUrl(it.url) : ''; } catch { url = ''; }
    out.push({
      id: sanitizeId(it.id) || `r-${out.length}`,
      date: sanitizeDate(it.date) || sanitizeText(it.date, 10),
      title: sanitizeText(it.title, LIMITS.MAX_SHORT_TEXT) || 'Untitled',
      kind,
      label: sanitizeText(it.label, LIMITS.MAX_SHORT_TEXT),
      trackCount: typeof it.trackCount === 'number' ? it.trackCount : undefined,
      trackName: it.trackName ? sanitizeText(it.trackName, LIMITS.MAX_SHORT_TEXT) : undefined,
      url: url || undefined,
    });
  }
  return out;
}

function validateReleases(raw: unknown): ReleasesContent {
  if (!raw || typeof raw !== 'object') return DEFAULT_RELEASES;
  const r = raw as Record<string, unknown>;
  return {
    solo: Array.isArray(r.solo) ? validateReleaseArray(r.solo) : DEFAULT_RELEASES.solo,
    compilations: Array.isArray(r.compilations) ? validateReleaseArray(r.compilations) : DEFAULT_RELEASES.compilations,
  };
}

function mergeWithDefaults(data: Record<string, unknown>): SiteContent {
  return {
    events:   Array.isArray(data.events) ? validateEvents(data.events) : DEFAULT_EVENTS,
    gallery:  data.gallery ? validateGalleryOverrides(data.gallery) : emptyGalleryOverrides(),
    bio:      data.bio ? validateBio(data.bio) : DEFAULT_BIO,
    socials:  Array.isArray(data.socials) ? validateSocials(data.socials) : DEFAULT_SOCIALS,
    releases: data.releases ? validateReleases(data.releases) : DEFAULT_RELEASES,
    booking:  data.booking ? validateBooking(data.booking) : DEFAULT_BOOKING,
  };
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let store: SiteContent = mergeWithDefaults({});

function emit() { listeners.forEach((l) => l()); }

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): SiteContent { return store; }

// Hydrate from Supabase once on load; silently falls back to defaults on error
let hydrated = false;
async function hydrate() {
  if (hydrated || !supabase) return;
  hydrated = true;
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'singleton')
      .maybeSingle();
    if (error || !data) return;
    store = mergeWithDefaults(data.data as Record<string, unknown>);
    emit();
  } catch { /* network error — stay on defaults */ }
}

hydrate();

// ─── Public hooks ─────────────────────────────────────────────────────────────

export function useGallery(): GalleryItem[] {
  const { gallery: o } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const map = new Map<string, GalleryItem>();
  for (const item of DEFAULT_GALLERY) map.set(item.id, item);
  for (const item of o.added) map.set(item.id, item);
  for (const [id, altText] of Object.entries(o.alt)) {
    const cur = map.get(id);
    if (cur) map.set(id, { ...cur, alt: altText });
  }
  for (const id of o.deleted) map.delete(id);
  const seen = new Set<string>();
  const out: GalleryItem[] = [];
  for (const id of o.order) {
    const item = map.get(id);
    if (item && !seen.has(id)) { out.push(item); seen.add(id); }
  }
  for (const item of map.values()) {
    if (!seen.has(item.id)) out.push(item);
  }
  return out.slice(0, LIMITS.MAX_GALLERY_ITEMS);
}

export function useGalleryOverrides(): GalleryOverrides { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).gallery; }
export function useEvents():   EventItem[]     { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).events; }
export function useBio():      BioContent      { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).bio; }
export function useSocials():  SocialItem[]    { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).socials; }
export function useReleases(): ReleasesContent { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).releases; }
export function useBooking():  BookingContent  { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).booking; }

// ─── Admin: persist to Supabase ───────────────────────────────────────────────

export async function saveContent(patch: Partial<SiteContent>): Promise<void> {
  if (!supabase) throw new AdminValidationError('Supabase not configured.');
  const next = { ...store, ...patch };
  const { error } = await supabase
    .from('site_content')
    .upsert({ id: 'singleton', data: next, updated_at: new Date().toISOString() });
  if (error) throw new AdminValidationError(error.message);
  store = next;
  emit();
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
