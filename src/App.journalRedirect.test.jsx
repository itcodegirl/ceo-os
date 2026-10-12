import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Only the routing table is under test, not the shell.
vi.mock('./layouts/AppLayout', () => ({
  default: function ShellStub() {
    const location = useLocation();
    return (
      <>
        <p data-testid="location">{location.pathname}</p>
        <Outlet />
      </>
    );
  },
}));

describe('legacy /journal URL', () => {
  it('redirects to the Notebook, which replaced the Journal', async () => {
    render(
      <MemoryRouter initialEntries={['/journal']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Notebook' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/notebook');
  });
});
