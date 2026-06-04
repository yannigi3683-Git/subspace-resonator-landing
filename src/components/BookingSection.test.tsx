import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BookingSection from './BookingSection';

describe('BookingSection', () => {
  it('renders without crashing', () => {
    render(<BookingSection />);
    expect(screen.getByRole('region', { name: /booking/i })).toBeInTheDocument();
  });

  it('has id="contact"', () => {
    render(<BookingSection />);
    expect(document.getElementById('contact')).toBeInTheDocument();
  });

  it('has mailto link for INITIATE CONTACT', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /initiate contact/i });
    expect(link).toHaveAttribute('href', 'mailto:subspaceresonator@gmail.com');
  });

  it('has tel link for CALL', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /fast channel/i });
    expect(link).toHaveAttribute('href', 'tel:+972507974184');
  });

  it('has WhatsApp link', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/972507974184');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
