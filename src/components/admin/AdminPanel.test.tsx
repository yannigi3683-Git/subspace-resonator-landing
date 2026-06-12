import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AdminPanel from './AdminPanel';

describe('AdminPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AdminPanel />);
    expect(container.firstChild).toBeNull();
  });
});
