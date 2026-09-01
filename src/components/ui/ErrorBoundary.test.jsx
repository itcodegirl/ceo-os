import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

vi.mock('../../lib/experimental/telemetry/appErrorTelemetry', () => ({
  emitAppErrorTelemetry: vi.fn(),
}));

function BrokenView() {
  throw new Error('Broken route');
}

describe('src/components/ui/ErrorBoundary', () => {
  it('offers a deterministic return-home action when a route crashes', () => {
    const onReturnHome = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary name="Broken view" onReturnHome={onReturnHome}>
        <BrokenView />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Return to Focus Home' }));

    expect(onReturnHome).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('renders a custom fallback when supplied so panel-level boundaries can stay quiet', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary
        name="Panel"
        fallback={<p data-testid="panel-fallback">Panel could not load.</p>}
      >
        <BrokenView />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('panel-fallback')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to Focus Home' })).toBeNull();
    consoleError.mockRestore();
  });
});
