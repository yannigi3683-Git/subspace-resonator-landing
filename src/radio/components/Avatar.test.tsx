import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';

describe('Avatar', () => {
  it('renders an SVG image with an accessible name (not just initials)', () => {
    render(<Avatar avatarId="nebula" label="StarWeaver" />);
    const img = screen.getByRole('img', { name: 'StarWeaver' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    // It is a real glyph, not a two-letter label.
    expect(img.textContent).toBe('');
  });

  it('falls back to the avatar label when no name is given', () => {
    render(<Avatar avatarId="vortex" />);
    expect(screen.getByRole('img', { name: 'Vortex' })).toBeInTheDocument();
  });

  it('renders a visually distinct shape variant for every avatar id', () => {
    const { container } = render(
      <div>
        {AVATARS.map((a) => (
          <Avatar key={a.id} avatarId={a.id} />
        ))}
      </div>,
    );
    const variants = new Set(
      Array.from(container.querySelectorAll('svg[data-variant]')).map((s) =>
        s.getAttribute('data-variant'),
      ),
    );
    expect(variants.size).toBe(AVATARS.length);
  });

  it('falls back gracefully for an unknown avatar id', () => {
    render(<Avatar avatarId="does-not-exist" label="Ghost" />);
    expect(screen.getByRole('img', { name: 'Ghost' })).toBeInTheDocument();
  });
});
