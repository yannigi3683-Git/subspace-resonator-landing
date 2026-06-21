import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeakerStack } from './SpeakerStack';

describe('SpeakerStack', () => {
  it('renders a labelled stack for each side', () => {
    render(<SpeakerStack side="left" live={false} />);
    expect(screen.getByRole('img', { name: /speaker stack left/i })).toBeInTheDocument();
  });

  it('renders both tops and subs (Turbosound branding present)', () => {
    render(<SpeakerStack side="right" live />);
    expect(screen.getByText('TURBOSOUND')).toBeInTheDocument();
    expect(screen.getByText('TSW-R')).toBeInTheDocument();
  });
});
