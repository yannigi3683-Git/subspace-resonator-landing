import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LabelPedigree from './LabelPedigree';

describe('LabelPedigree', () => {
  it('renders without crashing', () => {
    render(<LabelPedigree />);
    expect(screen.getByRole('region', { name: /labels/i })).toBeInTheDocument();
  });

  it('has id="labels"', () => {
    render(<LabelPedigree />);
    expect(document.getElementById('labels')).toBeInTheDocument();
  });

  it('renders all 4 label links', () => {
    render(<LabelPedigree />);
    expect(screen.getByRole('link', { name: /geomagnetic/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /timewarp/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goa records/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spiral trax/i })).toBeInTheDocument();
  });

  it('all label links open in new tab with security attrs', () => {
    render(<LabelPedigree />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
