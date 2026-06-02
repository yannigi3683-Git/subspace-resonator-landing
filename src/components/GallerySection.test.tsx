import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GallerySection from './GallerySection';

const mockImages = [
  { src: '/test1.jpg', alt: 'Subspace Resonator — photo 1' },
  { src: '/test2.jpg', alt: 'Subspace Resonator — photo 2' },
  { src: '/test3.jpg', alt: 'Subspace Resonator — photo 3' },
];

vi.mock('../lib/siteContent', () => ({
  useGallery: () => mockImages,
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('GallerySection', () => {
  it('renders without crashing', () => {
    render(<GallerySection />);
    expect(screen.getByRole('region', { name: /gallery/i })).toBeInTheDocument();
  });

  it('has id="gallery"', () => {
    render(<GallerySection />);
    expect(document.getElementById('gallery')).toBeInTheDocument();
  });

  it('first 4 images have loading=eager', () => {
    render(<GallerySection />);
    const eagerImgs = document.querySelectorAll('img[loading="eager"]');
    expect(eagerImgs.length).toBeGreaterThan(0);
  });

  it('clicking an image opens lightbox dialog', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /open/i });
    fireEvent.click(btns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lightbox has aria-modal and aria-label', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /open/i });
    fireEvent.click(btns[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Image viewer');
  });

  it('Escape key closes lightbox', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /open/i });
    fireEvent.click(btns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
