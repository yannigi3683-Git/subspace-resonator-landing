import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SiteHeader from './SiteHeader';

describe('SiteHeader', () => {
  it('renders without crashing', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('has nav links pointing to correct anchors', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /MUSIC/i })).toHaveAttribute('href', '#music');
    expect(screen.getByRole('link', { name: /LABELS/i })).toHaveAttribute('href', '#labels');
    expect(screen.getByRole('link', { name: /BIO/i })).toHaveAttribute('href', '#bio');
    expect(screen.getByRole('link', { name: /ARCHIVE/i })).toHaveAttribute('href', '#gallery');
    expect(screen.getByRole('link', { name: /SOCIAL/i })).toHaveAttribute('href', '#connect');
  });

  it('has BOOK button linking to #contact', () => {
    render(<SiteHeader />);
    const bookLink = screen.getByRole('link', { name: /BOOK/i });
    expect(bookLink).toHaveAttribute('href', '#contact');
  });

  it('hamburger button has aria-expanded', () => {
    render(<SiteHeader />);
    const btn = screen.getByRole('button', { name: /menu/i });
    expect(btn).toHaveAttribute('aria-expanded');
  });

  it('mobile menu opens and closes', () => {
    render(<SiteHeader />);
    const btn = screen.getByRole('button', { name: /menu/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});
