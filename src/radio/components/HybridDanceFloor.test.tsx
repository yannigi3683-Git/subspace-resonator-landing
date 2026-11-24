import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  HybridDanceFloor, hybridCrowdCapacity, hybridLayout, hybridObstacleRects,
  HYBRID_AVATAR_MIN, HYBRID_AVATAR_BASE, HYBRID_LABEL_MIN_W, HYBRID_LABEL_MAX_W, PHONE_GUTTER_PX,
} from './HybridDanceFloor';
import type { PresenceEntry, Station } from '../types';

const liveStation = {
  mode: 'live',
  live_title: 'Goa Night',
  live_session: null,
  slow_mode_s: 0,
  locked: false,
} as Station;

const entry = (i: number): PresenceEntry => ({
  uid: `u${i}`,
  deviceId: `u${i}`,
  name: `Listener${i}`,
  avatarId: 'nebula',
  position: { x: 50, y: 50 },
});

describe('hybrid crowd sizing', () => {
  it('keeps both PA stacks as obstacles at every width, phones included', () => {
    for (const [w, h] of [[360, 576], [390, 780], [448, 1024], [1120, 900], [1600, 1080]] as const) {
      expect(hybridObstacleRects(w, h), `PA obstacles at ${w}x${h}`).toHaveLength(2);
    }
  });

  it('shrinks the avatar and the name width as the room fills, within their floors', () => {
    const roomy = hybridLayout(5, 390, 780);
    const named = hybridLayout(16, 390, 780);
    expect(roomy.size).toBeGreaterThanOrEqual(named.size);
    expect(roomy.size).toBeLessThanOrEqual(HYBRID_AVATAR_BASE);
    expect(roomy.labelW).toBeLessThanOrEqual(HYBRID_LABEL_MAX_W);
    expect(named.hasLabel).toBe(true);
    expect(named.labelW).toBeGreaterThanOrEqual(HYBRID_LABEL_MIN_W);
  });

  it('drops names and keeps shrinking avatars once the floor is packed', () => {
    const cap = hybridCrowdCapacity(390, 780);
    const packed = hybridLayout(cap, 390, 780);
    expect(packed.hasLabel).toBe(false);
    expect(packed.size).toBeGreaterThanOrEqual(HYBRID_AVATAR_MIN);
    expect(packed.size).toBeLessThan(hybridLayout(16, 390, 780).size);
  });

  it('keeps a name or an avatar from ever reaching either screen edge, at any crowd size', () => {
    for (const n of [1, 5, 16, 40, 60, 150]) {
      const { region, labelW, size } = hybridLayout(n, 390, 780);
      const half = Math.max(labelW, size) / 2;
      expect(region.x0 - half, `left edge at ${n}`).toBeGreaterThanOrEqual(0);
      expect(region.x1 + half, `right edge at ${n}`).toBeLessThanOrEqual(390);
    }
  });

  it('holds a big crowd on a phone', () => {
    expect(hybridCrowdCapacity(390, 654, PHONE_GUTTER_PX)).toBeGreaterThanOrEqual(100);
  });

  it('gives phones the floor the desktop volume pill would cover', () => {
    expect(hybridCrowdCapacity(390, 724, PHONE_GUTTER_PX)).toBeGreaterThan(hybridCrowdCapacity(390, 724));
  });
});

describe('HybridDanceFloor', () => {
  it('renders a name for every listener on the floor', () => {
    const list = Array.from({ length: 16 }, (_, i) => entry(i));
    render(<HybridDanceFloor presenceList={list} station={liveStation} uid="u0" />);
    expect(screen.getAllByTestId('crowd-name')).toHaveLength(16);
    expect(screen.getByText('Listener15')).toBeInTheDocument();
  });

  it('shows the DJ, the flower visualizer and both speaker stacks', () => {
    render(<HybridDanceFloor presenceList={[entry(1)]} station={liveStation} uid="u1" />);
    expect(screen.getByTestId('broadcaster')).toBeInTheDocument();
    expect(screen.getByTestId('psyviz')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Turbosound Floodlight speaker stack')).toHaveLength(2);
  });

  it('shows the aboard count', () => {
    const list = [entry(1), entry(2), entry(3)];
    render(<HybridDanceFloor presenceList={list} station={liveStation} uid="u1" />);
    expect(screen.getByTestId('aboard')).toHaveTextContent('ABOARD 03');
  });
});
