import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShowFilesRow from './ShowFilesRow';
import { createShowFiles, memoryFileStore, memoryMetaStore, type ShowFiles } from '../showFiles';
import type { Show } from '../scheduleRules';

const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const PSY = Date.UTC(2026, 10, 29, 20, 0); // Sun 29 Nov 2026, 22:00 Israel
const SHOW: Show = { id: 'u1', title: 'Psy Night Vol. 7', starts_at: iso(PSY), aired_at: null };
const NEXT: Show = { id: 'u2', title: 'Goa Classics 1998', starts_at: iso(PSY + 60 * MIN), aired_at: null };

// Seconds per file, read from the name: "a_600.mp3" lasts 600 s. "broken" cannot be played.
const probe = async (f: Blob) => {
  const m = /_(\d+)\./.exec((f as File).name ?? '');
  if (!m) throw new Error('unplayable');
  return Number(m[1]);
};
const mp3 = (name: string) => new File([new Uint8Array(1000)], name, { type: 'audio/mpeg' });

let n = 0;
function makeLib(storage: StorageManager | null = null): ShowFiles {
  return createShowFiles({ files: memoryFileStore(), meta: memoryMetaStore(), probe, newId: () => `f${++n}`, storage });
}
const persisted = (ok: boolean, usage = 812 * 1024 * 1024) =>
  ({ persist: async () => ok, estimate: async () => ({ usage, quota: 10e9 }) }) as unknown as StorageManager;

function setup(over: Partial<Parameters<typeof ShowFilesRow>[0]> = {}) {
  const lib = over.lib ?? makeLib(persisted(true));
  const onNeon = vi.fn(async () => true);
  const utils = render(
    <ShowFilesRow show={SHOW} shows={[SHOW, NEXT]} lib={lib} durable assignHere onNeon={onNeon} {...over} />,
  );
  return { lib, onNeon, ...utils };
}
const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^FILES/ }));
  return screen.findByTestId('files-editor');
};
const pick = (files: File[]) => fireEvent.change(screen.getByTestId('files-input'), { target: { files } });

describe('ShowFilesRow, closed', () => {
  it('says there are no files on this PC', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'FILES · none on this PC' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the count and total length once files are assigned', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_600.mp3'), mp3('b_1505.mp3')]);
    setup({ lib });
    expect(await screen.findByRole('button', { name: 'FILES · 2 files · 35:05 · on this PC' })).toBeInTheDocument();
  });

  it('on a phone says files are assigned on the broadcasting PC, with no way to add them', async () => {
    setup({ assignHere: false });
    fireEvent.click(await screen.findByRole('button', { name: 'FILES · assign on the broadcasting PC' }));
    expect(screen.getByText(/added on the PC that will play the show/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ADD FILES' })).toBeNull();
  });

  it('says so plainly when this browser cannot keep files', async () => {
    setup({ durable: false });
    fireEvent.click(await screen.findByRole('button', { name: /^FILES/ }));
    expect(screen.getByText(/cannot keep show files/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ADD FILES' })).toBeNull();
  });
});

describe('ShowFilesRow, editor', () => {
  it('adds picked files, with a neon name per track, and updates the row', async () => {
    setup();
    await open();
    pick([mp3('Deep_Space-Ritual_600.mp3'), mp3('b_1505.mp3')]);
    expect(await screen.findByLabelText('TRACK 1 · NEON NAME')).toHaveValue('Deep Space Ritual 600');
    expect(screen.getByLabelText('TRACK 2 · NEON NAME')).toHaveValue('b 1505');
    expect(screen.getByRole('button', { name: /^FILES · 2 files · 35:05/ })).toBeInTheDocument();
  });

  it('names every file it could not add, and why', async () => {
    setup();
    await open();
    pick([mp3('broken.mp3'), mp3('ok_60.mp3')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not added: broken.mp3. This file cannot be played');
    expect(screen.getByLabelText('TRACK 1 · NEON NAME')).toHaveValue('ok 60');
  });

  it('accepts files dropped on the editor', async () => {
    setup();
    const editor = await open();
    fireEvent.drop(editor, { dataTransfer: { files: [mp3('drop_60.mp3')], types: ['Files'] } });
    expect(await screen.findByLabelText('TRACK 1 · NEON NAME')).toHaveValue('drop 60');
  });

  it('saves a neon name when the field is left, and keeps the old one if cleared', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_60.mp3')]);
    setup({ lib });
    await open();
    const field = await screen.findByLabelText('TRACK 1 · NEON NAME');
    fireEvent.change(field, { target: { value: 'Opening Ritual' } });
    fireEvent.blur(field);
    await waitFor(async () => expect((await lib.list('u1'))[0].displayName).toBe('Opening Ritual'));
  });

  it('moves tracks with the up and down buttons, the first and last end disabled', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_60.mp3'), mp3('b_60.mp3')]);
    setup({ lib });
    await open();
    expect(await screen.findByRole('button', { name: 'Move a 60 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move b 60 down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move a 60 down' }));
    await waitFor(() => expect(screen.getByLabelText('TRACK 1 · NEON NAME')).toHaveValue('b 60'));
    expect((await lib.list('u1')).map((e) => e.displayName)).toEqual(['b 60', 'a 60']);
  });

  it('reorders by dragging one track onto another', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_60.mp3'), mp3('b_60.mp3'), mp3('c_60.mp3')]);
    setup({ lib });
    await open();
    const rows = await screen.findAllByTestId('file-row');
    const data = new Map<string, string>();
    const dataTransfer = { types: [] as string[], setData: (k: string, v: string) => { data.set(k, v); dataTransfer.types.push(k); }, getData: (k: string) => data.get(k) ?? '', effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(rows[2], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    await waitFor(async () => expect((await lib.list('u1')).map((e) => e.displayName)).toEqual(['c 60', 'a 60', 'b 60']));
  });

  it('removes a track', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_60.mp3'), mp3('b_60.mp3')]);
    setup({ lib });
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove a 60' }));
    await waitFor(async () => expect((await lib.list('u1')).map((e) => e.displayName)).toEqual(['b 60']));
    expect(screen.getByRole('button', { name: /^FILES · 1 file · 1:00/ })).toBeInTheDocument();
  });

  it('switches the neon line between track names and the show title', async () => {
    const { onNeon } = setup({ show: { ...SHOW, neon_mode: 'tracks' } });
    await open();
    expect(screen.getByRole('button', { name: 'TRACK NAMES' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'SHOW TITLE' }));
    expect(onNeon).toHaveBeenCalledWith('title');
  });

  it('shows the total and when the set ends, Israel time', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_1800.mp3'), mp3('b_1500.mp3')]);
    setup({ lib });
    await open();
    expect(await screen.findByText('Total 55:00 · ends about 22:55 Israel')).toBeInTheDocument();
    expect(screen.queryByText(/Runs .* into/)).toBeNull();
  });

  it('warns when the set runs into the next show', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_5100.mp3')]);
    setup({ lib });
    await open();
    expect(await screen.findByText('Runs 25 min into Goa Classics 1998. That show will start when this one ends.')).toBeInTheDocument();
  });

  it('says the storage is protected, and how much it uses', async () => {
    setup();
    await open();
    expect(await screen.findByText(/Using 812 MB on this PC\. Storage is protected\./)).toBeInTheDocument();
  });

  it('warns in amber when the browser would not protect the storage', async () => {
    setup({ lib: makeLib(persisted(false)) });
    await open();
    expect(await screen.findByText(/The browser may clear these files if the disk fills up\./)).toBeInTheDocument();
  });

  it('reports a storage failure instead of crashing', async () => {
    const lib = makeLib();
    lib.reorder = async () => { throw new Error('disk'); };
    await lib.add('u1', [mp3('a_60.mp3'), mp3('b_60.mp3')]);
    setup({ lib });
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Move a 60 down' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the files on this PC.');
  });

  it('keeps every control at the 44 px touch target and no em dash in the copy', async () => {
    const lib = makeLib();
    await lib.add('u1', [mp3('a_60.mp3')]);
    const { container } = setup({ lib });
    const editor = await open();
    await within(editor).findByLabelText('TRACK 1 · NEON NAME');
    for (const b of container.querySelectorAll('button')) {
      expect(b.className).toMatch(/min-h-\[44px\]|w-11 h-11/);
    }
    expect(container.textContent).not.toContain('—');
  });
});
