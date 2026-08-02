import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DanceFloor, crowdCapacity, crowdRegion, crowdTileSize, vizCircle, roamPath, roamVars,
  isCheering, CHEER_MS, readCrowdTestParam, padCrowd, obstacleRects,
} from './DanceFloor';
import type { PresenceEntry, Station } from '../types';

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

const BOXES = [[360, 576], [390, 780], [412, 850], [448, 1024], [1120, 900], [1600, 1080]] as const;

// The crowd used to be a grid of fixed cells in a bottom strip, drifting ~2px inside its own
// cell. It read as a formation and nobody could reach the speakers, because there was no floor
// under them. Positions now come from a roaming path over the whole region. The guarantee that
// replaced "tiles never overlap" is this: a waypoint is always on the floor and never inside the
// visualizer or a PA stack. Crossing each other is expected - that is what a crowd does.
describe('roamPath', () => {
  it('keeps every waypoint on the floor and out of the visualizer', () => {
    for (const [w, h] of BOXES) {
      const region = crowdRegion(w, h);
      const viz = vizCircle(w, h);
      for (let i = 0; i < 60; i++) {
        for (const p of roamPath(`uid-${i}`, w, h)) {
          expect(p.x, `x off-floor at ${w}x${h}`).toBeGreaterThanOrEqual(region.x0);
          expect(p.x, `x off-floor at ${w}x${h}`).toBeLessThanOrEqual(region.x1);
          expect(p.y, `y off-floor at ${w}x${h}`).toBeGreaterThanOrEqual(region.y0);
          expect(p.y, `y off-floor at ${w}x${h}`).toBeLessThanOrEqual(region.y1);
          expect(
            Math.hypot(p.x - viz.cx, p.y - viz.cy),
            `waypoint inside the visualizer at ${w}x${h}`,
          ).toBeGreaterThan(viz.r);
        }
      }
    }
  });

  // The animation interpolates in a straight line between waypoints, so clear waypoints are not
  // enough: two on opposite sides walk the avatar straight through the artwork. Found on the
  // preview, because the original test only sampled the waypoints themselves.
  it('never crosses the visualizer or the PA stacks between waypoints', () => {
    // Collected rather than asserted per sample: this walks ~500k points, and an expect() per
    // point takes long enough to time the test out.
    const breaches: string[] = [];
    for (const [w, h] of BOXES) {
      const viz = vizCircle(w, h);
      const rects = obstacleRects(w, h);
      for (let i = 0; i < 60; i++) {
        const path = roamPath(`uid-${i}`, w, h);
        for (let k = 0; k < path.length; k++) {
          const a = path[k];
          const b = path[(k + 1) % path.length]; // the tour loops, so the last leg home counts
          for (let t = 0; t <= 1; t += 0.02) {
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            if (Math.hypot(x - viz.cx, y - viz.cy) < viz.r) {
              breaches.push(`uid-${i} through the visualizer, leg ${k}, ${w}x${h}`);
            }
            if (rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) {
              breaches.push(`uid-${i} through a PA stack, leg ${k}, ${w}x${h}`);
            }
          }
        }
      }
    }
    expect(breaches.slice(0, 5)).toEqual([]);
  });

  it('models the PA stacks as obstacles wherever they are rendered', () => {
    // Hidden below 400px by the JSX, so there is nothing to avoid there.
    expect(obstacleRects(360, 576)).toHaveLength(0);
    for (const [w, h] of [[412, 850], [448, 1024], [1120, 900], [1600, 1080]] as const) {
      expect(obstacleRects(w, h), `no PA obstacles at ${w}x${h}`).toHaveLength(2);
    }
  });

  it('is deterministic per listener and different between listeners', () => {
    expect(roamPath('uid-a', 1120, 900)).toEqual(roamPath('uid-a', 1120, 900));
    expect(roamPath('uid-a', 1120, 900)).not.toEqual(roamPath('uid-b', 1120, 900));
  });

  // The whole point: they should actually cross the floor, not shuffle in place. The old wander
  // managed about 2px at density, which is what prompted this.
  it('travels a real distance rather than shuffling in place', () => {
    const [w, h] = [1120, 900];
    const region = crowdRegion(w, h);
    const span = Math.min(region.x1 - region.x0, region.y1 - region.y0);
    const reach = Array.from({ length: 40 }, (_, i) => {
      const p = roamPath(`uid-${i}`, w, h);
      return Math.max(...p.map((q) => Math.hypot(q.x - p[0].x, q.y - p[0].y)));
    });
    const median = reach.sort((a, b) => a - b)[Math.floor(reach.length / 2)];
    expect(median).toBeGreaterThan(span * 0.25);
  });

  it('exposes the tour to CSS as offsets from the anchor', () => {
    const { anchor, vars } = roamVars('uid-a', 1120, 900);
    expect(anchor).toEqual(roamPath('uid-a', 1120, 900)[0]);
    for (const k of ['--r1x', '--r1y', '--r4x', '--r4y']) {
      expect(vars[k]).toMatch(/^-?\d+px$/);
    }
  });
});

describe('crowd sizing', () => {
  // The region is several times the old bottom strip, so far fewer people fall into the badge.
  it('holds more people than the old bottom strip did', () => {
    expect(crowdCapacity(1600, 1080)).toBeGreaterThan(150);
    expect(crowdCapacity(390, 780)).toBeGreaterThan(84);
  });

  it('shrinks avatars as the floor fills, never below the readable floor', () => {
    const roomy = crowdTileSize(5, 1120, 900);
    const packed = crowdTileSize(200, 1120, 900);
    expect(roomy.size).toBeGreaterThan(packed.size);
    expect(packed.size).toBeGreaterThanOrEqual(16);
    expect(roomy.hasLabel).toBe(true);
    expect(packed.hasLabel).toBe(false);
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

  // A ring around the avatar read as a bulky square, because the svg's artwork is inset from its
  // box so the band never hugged the glyph. "You" is a pool of light on the floor instead.
  it('marks your own avatar with a follow-spot, and nobody else', () => {
    const others: PresenceEntry[] = [entry, { ...entry, uid: 'u2', name: 'Other' }];
    const mine = render(<DanceFloor presenceList={others} station={liveStation} uid="u1" />);
    expect(mine.container.querySelectorAll('[data-testid="you-marker"]')).toHaveLength(1);
    mine.unmount();

    const stranger = render(<DanceFloor presenceList={others} station={liveStation} uid="nobody" />);
    expect(stranger.container.querySelectorAll('[data-testid="you-marker"]')).toHaveLength(0);
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
