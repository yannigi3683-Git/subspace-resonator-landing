import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StandbyScreen } from './StandbyScreen';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const START = Date.UTC(2026, 10, 29, 20, 0); // Sun 29 Nov 2026, 22:00 Israel
const iso = (ms: number) => new Date(ms).toISOString();
const show = (id: string, ms: number) => ({ id, title: id, starts_at: iso(ms) });

type Reply = { data: unknown; error: { message: string } | null };

function makeSupabase(reply: () => Reply) {
  const rpc = vi.fn(async () => reply());
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

let clock = START - (5 * DAY + 3 * HOUR + 22 * MIN + 8_000);
const getServerTime = () => new Date(clock);

async function mount(reply: () => Reply) {
  const { supabase, rpc } = makeSupabase(reply);
  const utils = render(<StandbyScreen supabase={supabase} getServerTime={getServerTime} zone="Asia/Jerusalem" locale="en-GB" />);
  await act(async () => {});
  return { rpc, ...utils };
}

afterEach(() => {
  vi.useRealTimers();
  clock = START - (5 * DAY + 3 * HOUR + 22 * MIN + 8_000);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('StandbyScreen', () => {
  it('names the station and says the signal is offline', async () => {
    await mount(() => ({ data: [], error: null }));
    expect(screen.getByRole('heading', { name: 'SUBSPACE RADIO' })).toBeInTheDocument();
    expect(screen.getByText('SIGNAL OFFLINE')).toBeInTheDocument();
  });

  it('asks the server for the next three shows', async () => {
    const { rpc } = await mount(() => ({ data: [], error: null }));
    expect(rpc).toHaveBeenCalledWith('upcoming_shows', { _limit: 3 });
  });

  it('counts down in days, with the show title and the guest’s own time', async () => {
    await mount(() => ({ data: [show('Psy Night Vol. 7', START)], error: null }));
    expect(screen.getByTestId('countdown')).toHaveTextContent('5d 03:22:08');
    expect(screen.getByText('Psy Night Vol. 7')).toBeInTheDocument();
    expect(screen.getByTestId('show-when')).toHaveTextContent('Sun 29 Nov, 22:00 GMT+2 · your time');
  });

  it('ticks every second against the server clock', async () => {
    vi.useFakeTimers();
    await mount(() => ({ data: [show('A', START)], error: null }));
    clock += 1000;
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('5d 03:22:07');
  });

  it('switches to STARTING SOON at the start time, with the station STANDING BY', async () => {
    clock = START + 7 * MIN;
    await mount(() => ({ data: [show('Psy Night Vol. 7', START)], error: null }));
    expect(screen.getByText('STARTING SOON')).toBeInTheDocument();
    expect(screen.getByText('STANDING BY')).toBeInTheDocument();
    expect(screen.getByText('Due any minute.')).toBeInTheDocument();
    expect(screen.queryByTestId('countdown')).toBeNull();
  });

  it('moves on to the next show 30 minutes after a start that never went live', async () => {
    clock = START + 30 * MIN;
    await mount(() => ({ data: [show('Late', START), show('Next', START + DAY)], error: null }));
    expect(screen.queryByText('STARTING SOON')).toBeNull();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('lists at most two shows under LATER', async () => {
    await mount(() => ({ data: [show('First', START), show('Second', START + DAY), show('Third', START + 2 * DAY), show('Fourth', START + 3 * DAY)], error: null }));
    const later = screen.getByTestId('later');
    expect(later).toHaveTextContent('Second');
    expect(later).toHaveTextContent('Third');
    expect(later).not.toHaveTextContent('Fourth');
  });

  it('says TBA only when the schedule really is empty', async () => {
    await mount(() => ({ data: [], error: null }));
    expect(screen.getByText('TBA')).toBeInTheDocument();
  });

  it('shows no card at all when the read failed, never a false TBA', async () => {
    await mount(() => ({ data: null, error: { message: 'offline' } }));
    expect(screen.queryByText('TBA')).toBeNull();
    expect(screen.queryByText(/NEXT TRANSMISSION/)).toBeNull();
    expect(screen.getByText('SIGNAL OFFLINE')).toBeInTheDocument();
  });

  it('re-reads every 60 s while visible, not while hidden, and on return', async () => {
    vi.useFakeTimers();
    const { rpc } = await mount(() => ({ data: [], error: null }));
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('keeps screen readers quiet on the ticking digits and announces the state instead', async () => {
    await mount(() => ({ data: [show('A', START)], error: null }));
    expect(screen.getByTestId('countdown').closest('[aria-live]')).toBeNull();
    expect(screen.getByText('SIGNAL OFFLINE').closest('[aria-live]')).not.toBeNull();
  });

  it('tells the guest to keep the page open, and links to the archive', async () => {
    await mount(() => ({ data: [show('A', START)], error: null }));
    expect(screen.getByText('Keep this page open. It switches over by itself when the signal goes live.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse the archive/i })).toHaveAttribute('href', '/#archive');
  });

  it('uses no em dash', async () => {
    const { container } = await mount(() => ({ data: [show('A', START), show('B', START + DAY)], error: null }));
    expect(container.textContent).not.toContain('—');
  });

  it('never throws when the client itself throws', async () => {
    const supabase = { rpc: vi.fn(() => { throw new Error('boom'); }) } as unknown as SupabaseClient;
    render(<StandbyScreen supabase={supabase} getServerTime={getServerTime} zone="Asia/Jerusalem" locale="en-GB" />);
    await act(async () => {});
    expect(screen.getByText('SIGNAL OFFLINE')).toBeInTheDocument();
  });

  it('shows New York times on a New York phone', async () => {
    const { supabase } = makeSupabase(() => ({ data: [show('Psy Night Vol. 7', START)], error: null }));
    render(<StandbyScreen supabase={supabase} getServerTime={getServerTime} zone="America/New_York" locale="en-US" />);
    await act(async () => {});
    expect(screen.getByTestId('show-when')).toHaveTextContent('Sun, Nov 29, 3:00 PM EST · your time');
  });

  it('keeps a good countdown when a later refresh fails (weak signal)', async () => {
    vi.useFakeTimers();
    let fail = false;
    await mount(() => (fail ? { data: null, error: { message: 'offline' } } : { data: [show('Psy Night Vol. 7', START)], error: null }));
    expect(screen.getByTestId('countdown')).toBeInTheDocument();
    fail = true;
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('countdown')).toBeInTheDocument();
  });

  it('still tells the guest to keep the page open when the schedule could not load', async () => {
    await mount(() => ({ data: null, error: { message: 'offline' } }));
    expect(screen.getByText('Keep this page open. It switches over by itself when the signal goes live.')).toBeInTheDocument();
  });

  it('reads LATER as a list, one show per item', async () => {
    await mount(() => ({ data: [show('First', START), show('Second', START + DAY), show('Third', START + 2 * DAY)], error: null }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
