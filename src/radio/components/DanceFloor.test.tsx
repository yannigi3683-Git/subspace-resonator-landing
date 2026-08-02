import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DanceFloor, gridSlot, crowdCapacity, isCheering, CHEER_MS, readCrowdTestParam, padCrowd, LABEL_W, LABEL_GAP, LABEL_H } from './DanceFloor';
import type { PresenceEntry, Station } from '../types';

type Slot = ReturnType<typeof gridSlot>;

// Mirrors the footprint math in gridSlot: the label is wider than the avatar,
// and adds its height + gap below it once shown.
function footprintOf(slot: Slot) {
  return {
    w: slot.hasLabel ? LABEL_W : slot.size,
    h: slot.hasLabel ? slot.size + LABEL_GAP + LABEL_H : slot.size,
  };
}

function footprintsOverlap(a: Slot, b: Slot, boxW: number, boxH: number) {
  const dx = Math.abs(((a.px - b.px) / 100) * boxW);
  const dy = Math.abs(((a.py - b.py) / 100) * boxH);
  const fa = footprintOf(a);
  const fb = footprintOf(b);
  return dx < (fa.w + fb.w) / 2 && dy < (fa.h + fb.h) / 2;
}

const liveStation = {
  mode: 'live',
  live_title: 'Goa Night',
  live_session: null,
  slow_mode_s: 0,
  locked: false,
} as Station;

const entry: PresenceEntry = {
  uid: 'u1',
  name: 'StarWeaver',
  avatarId: 'nebula',
  position: { x: 50, y: 50 },
};

// The old fixed cap of 30 was roughly what a phone's band holds, so a wide desktop window
// threw most of the crowd into the "+N" badge for no reason. Capacity now comes from the
// measured band, and the overlap check below is what keeps it honest.
describe('crowdCapacity', () => {
  it('fits far more on a wide desktop stage than on a phone', () => {
    const phone = crowdCapacity(390, 600);
    const desktop = crowdCapacity(1400, 900);
    expect(desktop).toBeGreaterThan(phone * 2);
  });

  it('never returns less than one, even for a degenerate box', () => {
    expect(crowdCapacity(0, 0)).toBeGreaterThanOrEqual(1);
    expect(crowdCapacity(10, 10)).toBeGreaterThanOrEqual(1);
  });

  it('places a full-capacity crowd without overlapping footprints', () => {
    for (const [w, h] of [[390, 600], [768, 700], [1400, 900]] as const) {
      const total = crowdCapacity(w, h);
      const slots = Array.from({ length: total }, (_, i) => gridSlot(i, total, `uid-${i}`, w, h));
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(
            footprintsOverlap(slots[i], slots[j], w, h),
            `slots ${i} and ${j} overlap at ${w}x${h}`,
          ).toBe(false);
        }
      }
    }
  });

  // The volume pill sits absolute bottom-4 left-4 over this same strip, so the band is lifted
  // clear of it. Without that it covered the bottom-left tiles and the "+N in the crowd" line.
  it('keeps the crowd clear of the bottom controls gutter', () => {
    for (const [w, h] of [[390, 600], [1400, 900]] as const) {
      const total = crowdCapacity(w, h);
      const lowest = Math.max(
        ...Array.from({ length: total }, (_, i) => {
          const s = gridSlot(i, total, `uid-${i}`, w, h);
          return (s.py / 100) * h + (s.hasLabel ? s.size + LABEL_GAP + LABEL_H : s.size) / 2;
        }),
      );
      expect(lowest, `crowd reaches the controls at ${w}x${h}`).toBeLessThanOrEqual(h - 64);
    }
  });
});

// Wander spends the same slack the static jitter came from, so the no-overlap guarantee has to
// hold at the WORST CASE: both neighbours swung fully toward each other at the same instant.
// Weakening this test instead of the amplitude would reintroduce exactly the overlap bug the
// footprint math exists to prevent.
describe('crowd wander', () => {
  function worstCaseOverlap(a: Slot, b: Slot, boxW: number, boxH: number) {
    const dx = Math.abs(((a.px - b.px) / 100) * boxW) - (a.wanderXpx + b.wanderXpx);
    const dy = Math.abs(((a.py - b.py) / 100) * boxH) - (a.wanderYpx + b.wanderYpx);
    const fa = footprintOf(a);
    const fb = footprintOf(b);
    return dx < (fa.w + fb.w) / 2 && dy < (fa.h + fb.h) / 2;
  }

  it('never overlaps even when neighbours drift at each other', () => {
    for (const [w, h] of [[390, 600], [768, 700], [1400, 900]] as const) {
      const total = crowdCapacity(w, h);
      const slots = Array.from({ length: total }, (_, i) => gridSlot(i, total, `uid-${i}`, w, h));
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(
            worstCaseOverlap(slots[i], slots[j], w, h),
            `slots ${i} and ${j} collide while wandering at ${w}x${h}`,
          ).toBe(false);
        }
      }
    }
  });

  it('gives every tile a non-negative drift budget', () => {
    const total = crowdCapacity(390, 600);
    for (let i = 0; i < total; i++) {
      const s = gridSlot(i, total, `uid-${i}`, 390, 600);
      expect(s.wanderXpx).toBeGreaterThanOrEqual(0);
      expect(s.wanderYpx).toBeGreaterThanOrEqual(0);
    }
  });
});

// Regression: lifting the band to clear the volume pill pushed its top row up INTO the
// visualizer on a phone, where 64vmin is a large share of the screen. The band is squeezed
// between two obstacles, and honouring only one of them puts avatars inside the other.
describe('crowd band clearance', () => {
  const vizBottom = (w: number, h: number) => h * 0.52 + Math.min(0.64 * Math.min(w, h), 460) / 2;

  it('keeps every avatar below the visualizer and above the controls', () => {
    for (const [w, h] of [[360, 576], [390, 780], [412, 850], [448, 1024], [1120, 900], [1600, 1080]] as const) {
      const total = crowdCapacity(w, h);
      for (let i = 0; i < total; i++) {
        const s = gridSlot(i, total, `uid-${i}`, w, h);
        const top = (s.py / 100) * h - s.size / 2 - s.wanderYpx;
        const bottom = (s.py / 100) * h + (s.hasLabel ? s.size + LABEL_GAP + LABEL_H : s.size) / 2 + s.wanderYpx;
        expect(top, `tile ${i} overlaps the visualizer at ${w}x${h}`).toBeGreaterThanOrEqual(vizBottom(w, h));
        expect(bottom, `tile ${i} reaches the controls at ${w}x${h}`).toBeLessThanOrEqual(h - 64);
      }
    }
  });
});

describe('isCheering', () => {
  const t = 1_000_000;

  it('is false without a cheer', () => {
    expect(isCheering(undefined, t)).toBe(false);
  });

  it('is true inside the window and false once it lapses', () => {
    expect(isCheering(t - 1, t)).toBe(true);
    expect(isCheering(t - (CHEER_MS - 1), t)).toBe(true);
    expect(isCheering(t - CHEER_MS, t)).toBe(false);
    expect(isCheering(t - 60_000, t)).toBe(false);
  });

  // Presence carries the sender's clock, so a skewed device can hand us a future timestamp.
  // Treating that as "cheering forever" would leave an avatar stuck lit.
  it('ignores a timestamp from the future', () => {
    expect(isCheering(t + 5000, t)).toBe(false);
  });
});

// ?crowdtest=N exists so density can be judged without minting hundreds of anonymous Supabase
// users or pushing fake people into the real room. It must stay inert unless explicitly asked for.
describe('crowdtest param', () => {
  it('is off unless the param is present and sane', () => {
    for (const q of ['', '?debug', '?crowdtest=0', '?crowdtest=-5', '?crowdtest=abc']) {
      expect(readCrowdTestParam(q)).toBe(0);
    }
  });

  it('reads a count and clamps it', () => {
    expect(readCrowdTestParam('?crowdtest=200')).toBe(200);
    expect(readCrowdTestParam('?crowdtest=99999')).toBe(500);
  });

  it('pads the roster with distinct devices so dedupe keeps them all', () => {
    const padded = padCrowd([], 50);
    expect(padded).toHaveLength(50);
    expect(new Set(padded.map((e) => e.deviceId)).size).toBe(50);
  });

  it('leaves the roster untouched when off', () => {
    const real = [entry];
    expect(padCrowd(real, 0)).toBe(real);
  });
});

describe('DanceFloor', () => {
  it('renders the broadcaster (DJ) on the stage', () => {
    render(<DanceFloor presenceList={[entry]} station={liveStation} uid="u1" />);
    expect(screen.getByTestId('broadcaster')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Broadcaster' })).toBeInTheDocument();
  });

  it('shows ON AIR and LIVE DJ while live', () => {
    render(<DanceFloor presenceList={[entry]} station={liveStation} uid="u1" />);
    expect(screen.getByText(/on air/i)).toBeInTheDocument();
    expect(screen.getByText(/live dj/i)).toBeInTheDocument();
  });

  it('lights up a cheering listener with the fast animation and the halo', () => {
    render(
      <DanceFloor
        presenceList={[{ ...entry, cheerAt: Date.now() }]}
        station={liveStation}
        uid="u2"
      />,
    );
    const tile = screen.getByRole('img', { name: 'StarWeaver' }).parentElement!;
    expect(tile.className).toContain('radio-dance');
    expect(tile.className).toContain('radio-cheer');
    expect(tile.className).not.toContain('radio-bob');
    // Sized off the avatar, not fixed: a constant radius bled onto neighbours when packed.
    expect(tile.getAttribute('style')).toMatch(/--halo:\s*\d+px/);
  });

  // Every tile used to share z-[5], so paint order was DOM order and a cheer could land behind
  // a neighbour's avatar - exactly when the listener wants to be seen.
  it('lifts a cheering tile above the rest of the crowd', () => {
    const { container, unmount } = render(
      <DanceFloor presenceList={[{ ...entry, cheerAt: Date.now() }]} station={liveStation} uid="u2" />,
    );
    expect(container.querySelector('.radio-slot')!.className).toContain('z-[7]');
    unmount();

    const idle = render(<DanceFloor presenceList={[entry]} station={liveStation} uid="u2" />);
    expect(idle.container.querySelector('.radio-slot')!.className).toContain('z-[5]');
  });

  it('returns a listener to the idle bob once the cheer lapses', () => {
    render(
      <DanceFloor
        presenceList={[{ ...entry, cheerAt: Date.now() - CHEER_MS - 1 }]}
        station={liveStation}
        uid="u2"
      />,
    );
    const tile = screen.getByRole('img', { name: 'StarWeaver' }).parentElement!;
    expect(tile.className).toContain('radio-bob');
    expect(tile.className).not.toContain('radio-cheer');
  });

  it('renders a graphical avatar per listener (not two-letter initials)', () => {
    render(<DanceFloor presenceList={[entry]} station={liveStation} uid="u1" />);
    const avatar = screen.getByRole('img', { name: 'StarWeaver' });
    expect(avatar.tagName.toLowerCase()).toBe('svg');
  });

  it('shows STANDBY / OFF AIR when not live', () => {
    render(
      <DanceFloor presenceList={[entry]} station={{ ...liveStation, mode: 'off' } as Station} uid="u1" />,
    );
    expect(screen.getByText(/standby/i)).toBeInTheDocument();
    expect(screen.getByText(/off air/i)).toBeInTheDocument();
  });

  it('never overlaps crowd tile footprints (avatar + label), at any count or screen size', () => {
    for (const total of [2, 4, 8, 15, 30]) {
      for (const [boxW, boxH] of [[340, 560], [375, 667], [430, 700], [1400, 800]]) {
        const slots = Array.from({ length: total }, (_, i) => gridSlot(i, total, `uid-${i}`, boxW, boxH));
        for (let a = 0; a < slots.length; a++) {
          for (let b = a + 1; b < slots.length; b++) {
            expect(footprintsOverlap(slots[a], slots[b], boxW, boxH)).toBe(false);
          }
        }
      }
    }
  });

  it('keeps labels visible for a typical guest count on a narrow phone', () => {
    const boxW = 375;
    const boxH = 667;
    const total = 4;
    const slots = Array.from({ length: total }, (_, i) => gridSlot(i, total, `uid-${i}`, boxW, boxH));
    for (const slot of slots) {
      expect(slot.hasLabel).toBe(true);
    }
    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        expect(footprintsOverlap(slots[a], slots[b], boxW, boxH)).toBe(false);
      }
    }
  });

  it('does not reshuffle the crowd order when a device reconnects with a new uid', () => {
    const guests: PresenceEntry[] = [
      { uid: 'u1', deviceId: 'd1', name: 'Guy', avatarId: 'nebula', position: { x: 0, y: 0 } },
      { uid: 'u2', deviceId: 'd2', name: 'Dvir', avatarId: 'nebula', position: { x: 0, y: 0 } },
      { uid: 'u3', deviceId: 'd3', name: 'Asaf', avatarId: 'nebula', position: { x: 0, y: 0 } },
    ];
    const { container, rerender } = render(
      <DanceFloor presenceList={guests} station={liveStation} uid="u1" />,
    );
    const namesBefore = Array.from(container.querySelectorAll('.radio-slot')).map(
      (el) => el.textContent,
    );

    // Anonymous re-auth on d2's device: uid changes, deviceId doesn't. A uid-keyed
    // sort would move this guest (and reshuffle the others) since 'zzz...' sorts
    // after 'u3'; a deviceId-keyed sort keeps d1 < d2 < d3 unchanged.
    const reconnected = guests.map((g) => (g.deviceId === 'd2' ? { ...g, uid: 'zzz-reconnected' } : g));
    rerender(<DanceFloor presenceList={reconnected} station={liveStation} uid="u1" />);
    const namesAfter = Array.from(container.querySelectorAll('.radio-slot')).map(
      (el) => el.textContent,
    );

    expect(namesAfter).toEqual(namesBefore);
  });

  it('routes the no-listener ghost preview through the same grid layout as live guests', () => {
    const { container } = render(<DanceFloor presenceList={[]} station={liveStation} uid="u1" />);
    const tiles = container.querySelectorAll('.radio-slot');
    expect(tiles.length).toBe(3);
    const lefts = Array.from(tiles).map((el) => (el as HTMLElement).style.left);
    expect(new Set(lefts).size).toBe(3);
  });
});
