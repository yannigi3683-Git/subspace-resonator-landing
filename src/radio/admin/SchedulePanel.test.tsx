import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SchedulePanel from './SchedulePanel';
import type { ScheduleApi } from '../hooks/useSchedule';
import type { Show } from '../scheduleRules';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const ZONE = 'Asia/Jerusalem';
const iso = (ms: number) => new Date(ms).toISOString();
const PSY = Date.UTC(2026, 10, 29, 20, 0); // Sun 29 Nov 2026, 22:00 Israel
const NOW = PSY - 5 * DAY;

const SHOWS: Show[] = [
  { id: 'p1', title: 'Sunday Session', starts_at: iso(Date.UTC(2026, 10, 22, 18, 0)), aired_at: iso(Date.UTC(2026, 10, 22, 18, 0)) },
  { id: 'u1', title: 'Psy Night Vol. 7', starts_at: iso(PSY), aired_at: null },
  { id: 'u2', title: 'Goa Classics 1998', starts_at: iso(Date.UTC(2026, 11, 6, 19, 0)), aired_at: null },
  { id: 'u3', title: 'Subspace Theory Live', starts_at: iso(Date.UTC(2026, 11, 19, 21, 0)), aired_at: null },
];

function makeApi(overrides: Partial<ScheduleApi> = {}): ScheduleApi {
  return {
    shows: SHOWS,
    error: null,
    saving: false,
    reload: vi.fn(async () => {}),
    add: vi.fn(async () => true),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    markAired: vi.fn(async () => {}),
    ...overrides,
  };
}

function setup(overrides: Partial<ScheduleApi> = {}, zone = ZONE) {
  const api = makeApi(overrides);
  const utils = render(<SchedulePanel schedule={api} getNow={() => NOW} deviceZone={zone} />);
  return { api, ...utils };
}

const rows = () => screen.getAllByTestId('show-row');

describe('SchedulePanel list', () => {
  it('lists upcoming shows soonest first, with Israel and UTC times', () => {
    setup();
    expect(rows().map((r) => within(r).getByTestId('show-title').textContent)).toEqual([
      'Psy Night Vol. 7', 'Goa Classics 1998', 'Subspace Theory Live',
    ]);
    expect(rows()[0].textContent).toContain('22:00 Israel');
    expect(rows()[0].textContent).toContain('20:00 UTC');
    expect(rows()[0].textContent).toContain('in 5 days');
  });

  it('folds past shows behind a count and opens them on tap', () => {
    setup();
    expect(screen.queryByText('Sunday Session')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /past \(1\)/i }));
    expect(screen.getByText('Sunday Session')).toBeTruthy();
  });

  it('says what guests see when nothing is scheduled', () => {
    setup({ shows: [] });
    expect(screen.getByText(/Nothing scheduled\. Guests see NEXT TRANSMISSION: TBA\./)).toBeTruthy();
  });

  it('marks a show that has started but not aired as what guests see', () => {
    const api = makeApi();
    render(<SchedulePanel schedule={api} getNow={() => PSY + 7 * MIN} deviceZone={ZONE} />);
    expect(rows()[0].textContent).toMatch(/started 7 min ago · guests see STARTING SOON/);
  });
});

describe('SchedulePanel add', () => {
  const title = () => screen.getByLabelText('TITLE');
  const starts = () => screen.getByLabelText('STARTS');
  const addBtn = () => screen.getByRole('button', { name: /add to schedule/i });

  it('keeps ADD disabled until the title and time are valid', () => {
    setup();
    expect((addBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(title(), { target: { value: 'New Year Transmission' } });
    expect((addBtn() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(starts(), { target: { value: '2027-01-02T22:00' } });
    expect((addBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it('previews the time in Israel and UTC before saving, then saves the exact instant', () => {
    const { api } = setup();
    fireEvent.change(title(), { target: { value: '  New Year Transmission  ' } });
    fireEvent.change(starts(), { target: { value: '2027-01-02T22:00' } });
    const preview = screen.getByTestId('time-preview');
    expect(preview.textContent).toContain('Sat, 2 Jan 2027, 22:00 Israel');
    expect(preview.textContent).toContain('20:00 UTC');
    fireEvent.click(addBtn());
    expect(api.add).toHaveBeenCalledWith('New Year Transmission', '2027-01-02T20:00:00.000Z');
  });

  it('warns about a nearby show without blocking ADD', () => {
    setup();
    fireEvent.change(title(), { target: { value: 'Goa Classics part 2' } });
    fireEvent.change(starts(), { target: { value: '2026-12-06T21:30' } });
    expect(screen.getByText(/Goa Classics 1998 starts 30 min before this\. You can still save it\./)).toBeTruthy();
    expect((addBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it('warns when the device is not on Israel time', () => {
    setup({}, 'Asia/Kolkata');
    fireEvent.change(starts(), { target: { value: '2026-12-12T06:00' } });
    expect(screen.getByText(/Your device is not on Israel time/)).toBeTruthy();
    expect(screen.getByTestId('time-preview').textContent).toContain('Israel');
  });

  it('cannot add while a save is in progress', () => {
    setup({ saving: true });
    fireEvent.change(title(), { target: { value: 'A show' } });
    fireEvent.change(starts(), { target: { value: '2027-01-02T22:00' } });
    const btn = screen.getByTestId('add-show') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/saving/i);
  });
});

describe('SchedulePanel edit and delete', () => {
  it('opens one show at a time for editing', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    expect(screen.getByDisplayValue('Psy Night Vol. 7')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Goa Classics 1998' }));
    expect(screen.queryByDisplayValue('Psy Night Vol. 7')).toBeNull();
    expect(screen.getByDisplayValue('Goa Classics 1998')).toBeTruthy();
  });

  it('keeps the cursor in the edit field while typing', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    const field = screen.getByDisplayValue('Psy Night Vol. 7') as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: 'Psy Night Vol. 7b' } });
    expect(field.isConnected).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('saves an edit with the new title and time', () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    expect(screen.getByDisplayValue('2026-11-29T22:00')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('2026-11-29T22:00'), { target: { value: '2026-11-29T22:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));
    expect(api.update).toHaveBeenCalledWith('u1', { title: 'Psy Night Vol. 7', starts_at: '2026-11-29T20:30:00.000Z' });
  });

  it('CANCEL closes the editor without saving', () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(api.update).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Psy Night Vol. 7')).toBeNull();
  });

  it('deletes only on the second tap; KEEP backs out', () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Subspace Theory Live' }));
    expect(screen.getByText(/Delete this show\? Guests stop seeing it within a minute\./)).toBeTruthy();
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'KEEP' }));
    expect(screen.queryByText(/Delete this show\?/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Subspace Theory Live' }));
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));
    expect(api.remove).toHaveBeenCalledWith('u3');
  });
});

describe('SchedulePanel keyboard focus', () => {
  it('moves focus into the edit title, and back to the pencil on CANCEL', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    expect(document.activeElement).toBe(screen.getByDisplayValue('Psy Night Vol. 7'));
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
  });

  it('puts focus on KEEP, the safe choice, and back on the bin after KEEP', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Goa Classics 1998' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'KEEP' }));
    fireEvent.click(screen.getByRole('button', { name: 'KEEP' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Goa Classics 1998' }));
  });
});

describe('SchedulePanel honesty and house rules', () => {
  it('shows a refused change in an alert', () => {
    setup({ error: 'Not deleted. The server refused the change: your host sign-in may have expired. Reload the console and sign in again.' });
    expect(screen.getByRole('alert').textContent).toMatch(/^Not deleted\./);
  });

  it('gives every button a 44px touch target', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /past \(1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Psy Night Vol. 7' }));
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toMatch(/min-h-\[44px\]|\bh-11\b/);
    }
  });

  it('uses no em dash anywhere', () => {
    const { container } = setup();
    expect(container.textContent).not.toContain('—');
  });
});
