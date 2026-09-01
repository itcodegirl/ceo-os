import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./lib/experimental/telemetry/appErrorTelemetry', () => ({
  emitAppErrorTelemetry: vi.fn(),
}));

vi.mock('./layouts/AppLayout', () => ({
  default: () => {
    throw new Error('App shell failed');
  },
}));

describe('src/App', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('keeps app-shell crashes inside the global recovery boundary', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong in this view.');
    expect(screen.getByRole('button', { name: 'Reload the current view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Focus Home' })).toBeInTheDocument();
  });
});
