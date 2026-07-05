import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DanceFloor, gridSlot } from './DanceFloor';
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

  it('never overlaps crowd tiles, at any count or screen size', () => {
    for (const total of [2, 15, 30]) {
      for (const [boxW, boxH] of [[340, 560], [430, 700], [1400, 800]]) {
        const slots = Array.from({ length: total }, (_, i) => gridSlot(i, total, `uid-${i}`, boxW, boxH));
        for (let a = 0; a < slots.length; a++) {
          for (let b = a + 1; b < slots.length; b++) {
            const dx = ((slots[a].px - slots[b].px) / 100) * boxW;
            const dy = ((slots[a].py - slots[b].py) / 100) * boxH;
            const dist = Math.hypot(dx, dy);
            const minGap = (slots[a].size + slots[b].size) / 2;
            expect(dist).toBeGreaterThanOrEqual(minGap - 0.01);
          }
        }
      }
    }
  });
});
