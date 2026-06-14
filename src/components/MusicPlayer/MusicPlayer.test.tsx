import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import MusicPlayer from './MusicPlayer';

describe('MusicPlayer', () => {
  it('renders without crashing', () => {
    render(<MusicPlayer />);
  });

  it('has id="music"', () => {
    render(<MusicPlayer />);
    expect(document.getElementById('music')).toBeInTheDocument();
  });

  it('renders TRACKS and PLAYLISTS tab buttons', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('button', { name: /tracks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /playlists/i })).toBeInTheDocument();
  });

  it('play/pause button has aria-label', () => {
    render(<MusicPlayer />);
    const btns = screen.getAllByRole('button', { name: /play|pause/i });
    expect(btns.length).toBeGreaterThan(0);
  });

  it('progress bar is present', () => {
    render(<MusicPlayer />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('external streaming links present', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('link', { name: /bandcamp/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spotify/i })).toBeInTheDocument();
  });
});

// --- TRACKS sequencing (next/auto-advance follows the visible list) ---------

// Mirrors the real SoundCloud data shape: excluded + title-less sounds sit at
// gaps, so SC index space != visible index space.
//   SC0 excluded, SC1 Alpha(v0), SC2 Bravo(v1), SC3 excluded, SC4 Charlie(v2),
//   SC5 title-less(dropped), SC6 Delta(v3)  ->  map = [1,2,4,6]
const SOUNDS = [
  { title: 'Return To Goa -  DJ Set', permalink_url: 'u0' },
  { title: 'Alpha', permalink_url: 'u1' },
  { title: 'Bravo', permalink_url: 'u2' },
  { title: 'Old School Night Live Mix', permalink_url: 'u3' },
  { title: 'Charlie', permalink_url: 'u4' },
  { title: null, permalink_url: 'u5' },
  { title: 'Delta', permalink_url: 'u6' },
];
const MAP = [1, 2, 4, 6]; // visible index -> SC index

function makeMock(sounds: any[]) {
  const handlers: Record<string, (...a: any[]) => void> = {};
  const calls = { skip: [] as number[], next: 0, prev: 0, play: 0, pause: 0 };
  let cur = 0;
  return {
    _fire: (e: string, ...a: any[]) => handlers[e] && handlers[e](...a),
    _setCur: (i: number) => { cur = i; },
    _calls: calls,
    bind: (e: string, cb: (...a: any[]) => void) => { handlers[e] = cb; },
    unbind: (e: string) => { delete handlers[e]; },
    getSounds: (cb: (s: any[]) => void) => cb(sounds),
    getCurrentSoundIndex: (cb: (i: number) => void) => cb(cur),
    getCurrentSound: (cb: (s: any) => void) => cb(sounds[cur]),
    getPosition: (cb: (n: number) => void) => cb(0),
    getDuration: (cb: (n: number) => void) => cb(0),
    skip: (i: number) => { calls.skip.push(i); cur = i; },
    next: () => { calls.next++; },
    prev: () => { calls.prev++; },
    play: () => { calls.play++; },
    pause: () => { calls.pause++; },
    setVolume: () => {},
    load: () => {},
  };
}

function installSC(widget: any) {
  const Widget: any = () => widget;
  Widget.Events = {
    READY: 'ready', PLAY: 'play', PAUSE: 'pause', FINISH: 'finish',
    LOAD_PROGRESS: 'lp', PLAY_PROGRESS: 'pp', SEEK: 'seek', ERROR: 'error',
  };
  (window as any).SC = { Widget };
}

function setupTracks() {
  const widget = makeMock(SOUNDS);
  installSC(widget);
  render(<MusicPlayer />);
  const iframe = document.querySelector('iframe[title="SoundCloud Player"]')!;
  fireEvent.load(iframe);
  act(() => { widget._fire('ready'); });
  const lastSkip = () => widget._calls.skip[widget._calls.skip.length - 1];
  return { widget, lastSkip };
}

describe('MusicPlayer TRACKS sequencing', () => {
  afterEach(() => { delete (window as any).SC; });

  it('shows only titled, non-excluded tracks in list order', () => {
    setupTracks();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delta').length).toBeGreaterThan(0);
    expect(screen.queryByText('Return To Goa -  DJ Set')).toBeNull();
    expect(screen.queryByText('Old School Night Live Mix')).toBeNull();
  });

  it('auto-advance on FINISH moves exactly one track and never calls widget.next()', () => {
    const { widget, lastSkip } = setupTracks();
    act(() => { widget._fire('finish'); }); // from visible 0 -> visible 1
    expect(widget._calls.next).toBe(0);
    expect(lastSkip()).toBe(MAP[1]); // 2 (Bravo), NOT MAP[2] (the double-skip bug)
  });

  it('auto-advance loops to the first track after the last finishes', () => {
    const { widget, lastSkip } = setupTracks();
    fireEvent.click(screen.getByText('Delta')); // select last visible (index 3)
    act(() => { widget._fire('finish'); });
    expect(lastSkip()).toBe(MAP[0]); // 1 (Alpha) — looped
  });

  it('PLAY landing on an excluded SC index does not trigger widget.next()', () => {
    const { widget } = setupTracks();
    widget._setCur(3); // SC3 = excluded "Old School Night"
    act(() => { widget._fire('play'); });
    expect(widget._calls.next).toBe(0);
  });

  it('Next button advances by one and wraps at the end', () => {
    const { widget, lastSkip } = setupTracks();
    const nextBtn = screen.getAllByRole('button', { name: /next track/i })[0];
    fireEvent.click(nextBtn); // visible 0 -> 1
    expect(lastSkip()).toBe(MAP[1]);
    fireEvent.click(screen.getByText('Delta')); // -> visible 3 (last)
    fireEvent.click(nextBtn); // wrap -> visible 0
    expect(lastSkip()).toBe(MAP[0]);
    expect(widget._calls.next).toBe(0);
  });

  it('Previous button wraps from the first track to the last', () => {
    const { widget, lastSkip } = setupTracks();
    const prevBtn = screen.getAllByRole('button', { name: /previous track/i })[0];
    fireEvent.click(prevBtn); // visible 0 -> last (3)
    expect(lastSkip()).toBe(MAP[3]); // 6 (Delta)
    expect(widget._calls.prev).toBe(0);
  });

  it('first play starts at the first visible track (skips excluded SC0)', () => {
    const { widget, lastSkip } = setupTracks();
    const playBtn = screen.getAllByRole('button', { name: /^play$/i })[0];
    fireEvent.click(playBtn);
    expect(lastSkip()).toBe(MAP[0]); // 1 (Alpha), never SC0 (excluded)
    expect(widget._calls.next).toBe(0);
  });
});

// --- PLAYLISTS sequencing (same double-advance fix on the sibling widget) ----

// A curated playlist: all titled, no exclusions, so array index == SC index.
const PL_SOUNDS = [
  { title: 'P0', permalink_url: 'q0' },
  { title: 'P1', permalink_url: 'q1' },
  { title: 'P2', permalink_url: 'q2' },
  { title: 'P3', permalink_url: 'q3' },
];

function installSCMulti(tracksW: any, playlistW: any) {
  const Widget: any = (iframe: any) =>
    iframe && /Playlist/.test(iframe.title) ? playlistW : tracksW;
  Widget.Events = {
    READY: 'ready', PLAY: 'play', PAUSE: 'pause', FINISH: 'finish',
    LOAD_PROGRESS: 'lp', PLAY_PROGRESS: 'pp', SEEK: 'seek', ERROR: 'error',
  };
  (window as any).SC = { Widget };
}

function setupPlaylist() {
  const tracksW = makeMock(PL_SOUNDS);
  const playlistW = makeMock(PL_SOUNDS);
  installSCMulti(tracksW, playlistW);
  render(<MusicPlayer />);
  const tIframe = document.querySelector('iframe[title="SoundCloud Player"]')!;
  fireEvent.load(tIframe);
  act(() => { tracksW._fire('ready'); });
  fireEvent.click(screen.getByRole('button', { name: /playlists/i }));
  const pIframe = document.querySelector('iframe[title="SoundCloud Playlist Player"]')!;
  fireEvent.load(pIframe);
  act(() => { playlistW._fire('ready'); });
  const lastSkip = () => playlistW._calls.skip[playlistW._calls.skip.length - 1];
  return { playlistW, lastSkip };
}

describe('MusicPlayer PLAYLISTS sequencing', () => {
  afterEach(() => { delete (window as any).SC; });

  it('auto-advance on FINISH moves exactly one track and never calls widget.next()', () => {
    const { playlistW, lastSkip } = setupPlaylist();
    act(() => { playlistW._fire('finish'); }); // from index 0 -> 1
    expect(playlistW._calls.next).toBe(0);
    expect(lastSkip()).toBe(1);
  });

  it('auto-advance loops to the first track after the last finishes', () => {
    const { playlistW, lastSkip } = setupPlaylist();
    fireEvent.click(screen.getByText('P3')); // select last (index 3)
    act(() => { playlistW._fire('finish'); });
    expect(lastSkip()).toBe(0); // looped
  });
});
