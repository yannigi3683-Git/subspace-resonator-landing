import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrivacyPolicy from './PrivacyPolicy';
import AccessibilityStatement from './AccessibilityStatement';

describe('PrivacyPolicy', () => {
  it('renders heading and privacy contact', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /subspaceresonator@gmail.com/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to site/i })).toHaveAttribute('href', '/');
  });

  it('discloses the GA measurement id', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByText(/G-NS6G58SSCJ/)).toBeInTheDocument();
  });
});

describe('AccessibilityStatement', () => {
  it('renders heading, named coordinator, and contact', () => {
    render(<AccessibilityStatement />);
    expect(screen.getByRole('heading', { level: 1, name: /accessibility statement/i })).toBeInTheDocument();
    expect(screen.getByText(/Yanni/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /subspaceresonator@gmail.com/i })).toBeInTheDocument();
  });
});
