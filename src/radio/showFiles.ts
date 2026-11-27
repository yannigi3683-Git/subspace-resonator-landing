// Each scheduled show's files, copied into this browser's own storage on the PC that will play
// them (spec E2). Copies, not links: a link to the original needs a permission click after every
// Chrome restart, and SCHEDULE RUNNER starts shows with nobody at the PC. Nothing here goes to the
// database or the cloud.
//
// Storage is behind two small adapters so the rules are testable in jsdom, which has neither
// OPFS nor IndexedDB: file bodies (OPFS in the browser) and the playlist per show (IndexedDB).

import { makeName } from './rtc/localDeck';
import { probeDuration } from './rtc/trackDuration';

export interface ShowFileEntry {
  id: string;
  fileName: string;
  displayName: string;
  size: number;
  type: string;
  durationMs: number;
}

export interface FileStore {
  write(key: string, data: Blob, onProgress?: (fraction: number) => void): Promise<void>;
  read(key: string): Promise<Blob | null>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface MetaStore {
  get(showId: string): Promise<ShowFileEntry[]>;
  set(showId: string, entries: ShowFileEntry[]): Promise<void>;
  remove(showId: string): Promise<void>;
  showIds(): Promise<string[]>;
}

export interface StorageInfo {
  persisted: boolean;
  usage: number | null;
  quota: number | null;
}

export interface AddResult {
  added: ShowFileEntry[];
  failed: Array<{ name: string; reason: string }>;
}

export interface ShowFilesDeps {
  files: FileStore;
  meta: MetaStore;
  probe?: (file: Blob) => Promise<number>;
  newId?: () => string;
  storage?: StorageManager | null;
}

const keyOf = (showId: string, id: string) => `${showId}/${id}`;

async function probeBlob(file: Blob): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await probeDuration(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function failureReason(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  const message = (err as { message?: string })?.message ?? '';
  return name === 'QuotaExceededError' || /quota/i.test(message) ? 'Not enough space on this PC' : 'Could not copy this file';
}

export function createShowFiles(deps: ShowFilesDeps) {
  const { files, meta } = deps;
  const probe = deps.probe ?? probeBlob;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const storage = deps.storage === undefined ? (typeof navigator !== 'undefined' ? navigator.storage ?? null : null) : deps.storage;

  async function list(showId: string): Promise<ShowFileEntry[]> {
    return [...(await meta.get(showId))];
  }

  return {
    list,

    async add(showId: string, picked: File[], onProgress?: (name: string, fraction: number) => void): Promise<AddResult> {
      const added: ShowFileEntry[] = [];
      const failed: AddResult['failed'] = [];
      for (const file of picked) {
        const id = newId();
        const seconds = await probe(file).catch(() => 0);
        if (!(seconds > 0)) {
          failed.push({ name: file.name, reason: 'This file cannot be played' });
          continue;
        }
        try {
          await files.write(keyOf(showId, id), file, (f) => onProgress?.(file.name, f));
          onProgress?.(file.name, 1);
        } catch (err) {
          await files.remove(keyOf(showId, id)).catch(() => {});
          failed.push({ name: file.name, reason: failureReason(err) });
          continue;
        }
        added.push({
          id, fileName: file.name, displayName: makeName(file), size: file.size, type: file.type,
          durationMs: Math.round(seconds * 1000),
        });
      }
      if (added.length) await meta.set(showId, [...(await meta.get(showId)), ...added]);
      return { added, failed };
    },

    async reorder(showId: string, ids: string[]): Promise<void> {
      const current = await meta.get(showId);
      const byId = new Map(current.map((e) => [e.id, e]));
      if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) {
        throw new Error('Reorder must list every file exactly once');
      }
      await meta.set(showId, ids.map((id) => byId.get(id) as ShowFileEntry));
    },

    async rename(showId: string, id: string, displayName: string): Promise<void> {
      const current = await meta.get(showId);
      await meta.set(showId, current.map((e) => {
        if (e.id !== id) return e;
        const name = displayName.trim();
        return { ...e, displayName: name || makeName(new File([], e.fileName)) };
      }));
    },

    async remove(showId: string, id: string): Promise<void> {
      await files.remove(keyOf(showId, id));
      await meta.set(showId, (await meta.get(showId)).filter((e) => e.id !== id));
    },

    async removeShow(showId: string): Promise<void> {
      for (const e of await meta.get(showId)) await files.remove(keyOf(showId, e.id));
      await meta.remove(showId);
    },

    async summary(showId: string): Promise<{ count: number; totalMs: number }> {
      const entries = await meta.get(showId);
      return { count: entries.length, totalMs: entries.reduce((sum, e) => sum + e.durationMs, 0) };
    },

    // What the deck plays: real File objects (LocalDeck takes File[]), in playlist order.
    async playable(showId: string): Promise<Array<{ file: File; name: string }>> {
      const out: Array<{ file: File; name: string }> = [];
      for (const e of await meta.get(showId)) {
        const blob = await files.read(keyOf(showId, e.id));
        if (!blob) continue;
        const asFile = blob instanceof File ? blob : new File([blob], e.fileName, { type: e.type });
        out.push({ file: asFile, name: e.displayName });
      }
      return out;
    },

    // Preflight: every copy present and the size it was when copied.
    async verify(showId: string): Promise<{ ok: boolean; missing: string[]; damaged: string[] }> {
      const missing: string[] = [];
      const damaged: string[] = [];
      for (const e of await meta.get(showId)) {
        const size = await files.size(keyOf(showId, e.id)).catch(() => null);
        if (size === null) missing.push(e.fileName);
        else if (size !== e.size) damaged.push(e.fileName);
      }
      return { ok: missing.length === 0 && damaged.length === 0, missing, damaged };
    },

    // Playlists and copies whose show is gone, offered for clean-up.
    async orphans(liveShowIds: string[]): Promise<string[]> {
      const live = new Set(liveShowIds);
      const found = new Set<string>();
      for (const id of await meta.showIds()) if (!live.has(id)) found.add(id);
      for (const key of await files.keys()) {
        const showId = key.split('/')[0];
        if (!live.has(showId)) found.add(showId);
      }
      return [...found].sort();
    },

    async storageInfo(): Promise<StorageInfo> {
      if (!storage) return { persisted: false, usage: null, quota: null };
      const persisted = await storage.persist?.().catch(() => false) ?? false;
      const est = await storage.estimate?.().catch(() => ({} as StorageEstimate)) ?? {};
      return { persisted: !!persisted, usage: est.usage ?? null, quota: est.quota ?? null };
    },
  };
}

export type ShowFiles = ReturnType<typeof createShowFiles>;

export function memoryFileStore(): FileStore {
  const map = new Map<string, Blob>();
  return {
    async write(key, data, onProgress) {
      map.set(key, data);
      onProgress?.(1);
    },
    async read(key) { return map.get(key) ?? null; },
    async size(key) { return map.has(key) ? (map.get(key) as Blob).size : null; },
    async remove(key) { map.delete(key); },
    async keys() { return [...map.keys()].sort(); },
  };
}

export function memoryMetaStore(): MetaStore {
  const map = new Map<string, ShowFileEntry[]>();
  return {
    async get(showId) { return [...(map.get(showId) ?? [])]; },
    async set(showId, entries) { if (entries.length) map.set(showId, [...entries]); else map.delete(showId); },
    async remove(showId) { map.delete(showId); },
    async showIds() { return [...map.keys()].sort(); },
  };
}

// ---- Browser adapters: OPFS for file bodies, IndexedDB for playlists. Not reachable from jsdom;
// they are exercised on the owner's PC (plan V-A5: files survive a Chrome restart).

const OPFS_ROOT = 'show-files';
const CHUNK = 4 * 1024 * 1024;

export function opfsFileStore(): FileStore {
  async function root(): Promise<FileSystemDirectoryHandle> {
    const top = await navigator.storage.getDirectory();
    return top.getDirectoryHandle(OPFS_ROOT, { create: true });
  }
  async function locate(key: string, create: boolean) {
    const [showId, id] = key.split('/');
    const dir = await (await root()).getDirectoryHandle(showId, { create });
    return { dir, id };
  }
  return {
    async write(key, data, onProgress) {
      const { dir, id } = await locate(key, true);
      const handle = await dir.getFileHandle(id, { create: true });
      const writable = await handle.createWritable();
      try {
        for (let off = 0; off < data.size; off += CHUNK) {
          await writable.write(data.slice(off, off + CHUNK));
          onProgress?.(Math.min(1, (off + CHUNK) / data.size));
        }
        await writable.close();
      } catch (err) {
        await writable.abort().catch(() => {});
        throw err;
      }
    },
    async read(key) {
      try {
        const { dir, id } = await locate(key, false);
        return await (await dir.getFileHandle(id)).getFile();
      } catch {
        return null;
      }
    },
    async size(key) {
      const f = await this.read(key);
      return f ? f.size : null;
    },
    async remove(key) {
      try {
        const { dir, id } = await locate(key, false);
        await dir.removeEntry(id);
      } catch { /* already gone */ }
    },
    async keys() {
      const out: string[] = [];
      const r = await root();
      for await (const [showId, handle] of (r as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        if (handle.kind !== 'directory') continue;
        for await (const [id] of (handle as unknown as AsyncIterable<[string, FileSystemHandle]>)) out.push(`${showId}/${id}`);
      }
      return out.sort();
    },
  };
}

const IDB_NAME = 'subspace-show-files';
const IDB_STORE = 'playlists';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return idbOpen().then((db) => new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
    req.onsuccess = () => { resolve(req.result as T); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

export function idbMetaStore(): MetaStore {
  return {
    async get(showId) { return (await idbRun<ShowFileEntry[] | undefined>('readonly', (s) => s.get(showId))) ?? []; },
    async set(showId, entries) {
      await idbRun('readwrite', (s) => (entries.length ? s.put(entries, showId) : s.delete(showId)));
    },
    async remove(showId) { await idbRun('readwrite', (s) => s.delete(showId)); },
    async showIds() { return ((await idbRun<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) as string[]).sort(); },
  };
}

// The PC's real storage when the browser has it; otherwise memory, which is lost on reload and is
// reported as unprotected so the console never pretends a show's files are safe.
export function openShowFiles(): { lib: ShowFiles; durable: boolean } {
  const durable = typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory && typeof indexedDB !== 'undefined';
  return durable
    ? { lib: createShowFiles({ files: opfsFileStore(), meta: idbMetaStore() }), durable }
    : { lib: createShowFiles({ files: memoryFileStore(), meta: memoryMetaStore(), storage: null }), durable };
}
