import { describe, it, expect, vi } from 'vitest';
import { createShowFiles, memoryFileStore, memoryMetaStore, type FileStore } from './showFiles';

const file = (name: string, bytes = 10) => new File(['x'.repeat(bytes)], name, { type: 'audio/mpeg' });

function setup(over: { files?: FileStore; probe?: (f: Blob) => Promise<number>; storage?: StorageManager | null } = {}) {
  const files = over.files ?? memoryFileStore();
  const meta = memoryMetaStore();
  let n = 0;
  const lib = createShowFiles({
    files,
    meta,
    probe: over.probe ?? (async () => 60),
    newId: () => `f${++n}`,
    storage: over.storage === undefined ? null : over.storage,
  });
  return { lib, files, meta };
}

describe('showFiles: adding', () => {
  it('copies files in order with cleaned display names and lengths', async () => {
    const { lib } = setup();
    const res = await lib.add('show1', [file('01_Opening-Track.mp3'), file('Second.flac')]);
    expect(res.failed).toEqual([]);
    const list = await lib.list('show1');
    expect(list.map((e) => e.displayName)).toEqual(['01 Opening Track', 'Second']);
    expect(list.map((e) => e.fileName)).toEqual(['01_Opening-Track.mp3', 'Second.flac']);
    expect(list.every((e) => e.durationMs === 60_000)).toBe(true);
  });

  it('appends to an existing playlist', async () => {
    const { lib } = setup();
    await lib.add('show1', [file('a.mp3')]);
    await lib.add('show1', [file('b.mp3')]);
    expect((await lib.list('show1')).map((e) => e.fileName)).toEqual(['a.mp3', 'b.mp3']);
  });

  it('reports copy progress per file', async () => {
    const { lib } = setup();
    const seen: Array<[string, number]> = [];
    await lib.add('show1', [file('a.mp3'), file('b.mp3')], (name, fraction) => seen.push([name, fraction]));
    expect(seen).toContainEqual(['a.mp3', 1]);
    expect(seen).toContainEqual(['b.mp3', 1]);
  });

  it('a failed copy leaves nothing behind and names the file', async () => {
    const base = memoryFileStore();
    const broken: FileStore = {
      ...base,
      async write(key, data, onProgress) {
        if (key.endsWith('f2')) {
          await base.write(key, data.slice(0, 2));
          throw new Error('QuotaExceededError');
        }
        return base.write(key, data, onProgress);
      },
    };
    const { lib, files } = setup({ files: broken });
    const res = await lib.add('show1', [file('good.mp3'), file('full.mp3')]);
    expect(res.failed).toEqual([{ name: 'full.mp3', reason: 'Not enough space on this PC' }]);
    expect((await lib.list('show1')).map((e) => e.fileName)).toEqual(['good.mp3']);
    expect(await files.keys()).toEqual(['show1/f1']);
  });

  it('rejects a file the browser cannot play, by name, and keeps no copy', async () => {
    const { lib, files } = setup({ probe: async (f) => ((f as File).name === 'broken.mp3' ? 0 : 60) });
    const res = await lib.add('show1', [file('ok.mp3'), file('broken.mp3')]);
    expect(res.failed).toEqual([{ name: 'broken.mp3', reason: 'This file cannot be played' }]);
    expect(await files.keys()).toEqual(['show1/f1']);
  });
});

describe('showFiles: editing', () => {
  async function three() {
    const s = setup();
    await s.lib.add('show1', [file('a.mp3'), file('b.mp3'), file('c.mp3')]);
    return s;
  }

  it('reorders', async () => {
    const { lib } = await three();
    await lib.reorder('show1', ['f3', 'f1', 'f2']);
    expect((await lib.list('show1')).map((e) => e.id)).toEqual(['f3', 'f1', 'f2']);
  });

  it('ignores a reorder that is not the same set of files', async () => {
    const { lib } = await three();
    await expect(lib.reorder('show1', ['f3', 'f1'])).rejects.toThrow();
    expect((await lib.list('show1')).map((e) => e.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('renames for the neon line, and an empty name falls back to the file name', async () => {
    const { lib } = await three();
    await lib.rename('show1', 'f2', '  Goa Classic 1998  ');
    await lib.rename('show1', 'f3', '   ');
    const list = await lib.list('show1');
    expect(list[1].displayName).toBe('Goa Classic 1998');
    expect(list[2].displayName).toBe('c');
  });

  it('removes a file and its copy', async () => {
    const { lib, files } = await three();
    await lib.remove('show1', 'f2');
    expect((await lib.list('show1')).map((e) => e.id)).toEqual(['f1', 'f3']);
    expect(await files.keys()).toEqual(['show1/f1', 'show1/f3']);
  });

  it('removes a whole show', async () => {
    const { lib, files } = await three();
    await lib.removeShow('show1');
    expect(await lib.list('show1')).toEqual([]);
    expect(await files.keys()).toEqual([]);
  });
});

describe('showFiles: what the runner needs', () => {
  it('summarises count and total length', async () => {
    const { lib } = setup();
    await lib.add('show1', [file('a.mp3'), file('b.mp3')]);
    expect(await lib.summary('show1')).toEqual({ count: 2, totalMs: 120_000 });
    expect(await lib.summary('none')).toEqual({ count: 0, totalMs: 0 });
  });

  it('hands back the copies in playlist order with their display names', async () => {
    const { lib } = setup();
    await lib.add('show1', [file('a.mp3'), file('b.mp3')]);
    await lib.reorder('show1', ['f2', 'f1']);
    const tracks = await lib.playable('show1');
    expect(tracks.map((t) => t.name)).toEqual(['b', 'a']);
    expect(tracks[0].file).toBeInstanceOf(Blob);
  });

  it('verify names every missing or damaged copy', async () => {
    const { lib, files } = setup();
    await lib.add('show1', [file('a.mp3'), file('b.mp3'), file('c.mp3', 10)]);
    await files.remove('show1/f2');
    await files.write('show1/f3', new Blob(['xx']));
    expect(await lib.verify('show1')).toEqual({ ok: false, missing: ['b.mp3'], damaged: ['c.mp3'] });
  });

  it('verify passes when every copy is whole', async () => {
    const { lib } = setup();
    await lib.add('show1', [file('a.mp3')]);
    expect(await lib.verify('show1')).toEqual({ ok: true, missing: [], damaged: [] });
  });

  it('finds playlists for shows that no longer exist, and stray copies', async () => {
    const { lib, files } = setup();
    await lib.add('kept', [file('a.mp3')]);
    await lib.add('deleted', [file('b.mp3')]);
    await files.write('ghost/x', new Blob(['x']));
    expect(await lib.orphans(['kept'])).toEqual(['deleted', 'ghost']);
  });
});

describe('showFiles: storage', () => {
  it('asks for persistent storage and reports usage', async () => {
    const storage = {
      persist: vi.fn(async () => true),
      persisted: vi.fn(async () => false),
      estimate: vi.fn(async () => ({ usage: 812_000_000, quota: 50_000_000_000 })),
    } as unknown as StorageManager;
    const { lib } = setup({ storage });
    expect(await lib.storageInfo()).toEqual({ persisted: true, usage: 812_000_000, quota: 50_000_000_000 });
    expect(storage.persist).toHaveBeenCalled();
  });

  it('reports "not protected" when the browser refuses or has no storage API', async () => {
    const refusing = {
      persist: async () => false, persisted: async () => false, estimate: async () => ({}),
    } as unknown as StorageManager;
    expect(await setup({ storage: refusing }).lib.storageInfo()).toEqual({ persisted: false, usage: null, quota: null });
    expect(await setup({ storage: null }).lib.storageInfo()).toEqual({ persisted: false, usage: null, quota: null });
  });
});
