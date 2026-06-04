import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GallerySection from './GallerySection';

const mockImages = [
  { id: 'g1', src: '/test1.jpg', alt: 'Hindi Goa — UV night stage' },
  { id: 'g2', src: '/test2.jpg', alt: 'Hindi Goa — crowd daytime' },
  { id: 'g3', src: '/test3.jpg', alt: 'Yanni DJing — Hindi Goa' },
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

  it('clicking an image opens lightbox dialog', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /view image/i });
    fireEvent.click(btns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lightbox has aria-modal and aria-label', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /view image/i });
    fireEvent.click(btns[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Image viewer');
  });

  it('Escape key closes lightbox', () => {
    render(<GallerySection />);
    const btns = screen.getAllByRole('button', { name: /view image/i });
    fireEvent.click(btns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
