import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import StorageQuotaBanner from './StorageQuotaBanner';
import { SAVE_STATUS_EVENT } from '../../lib/saveStatusBus';

function dispatchSave(detail) {
  act(() => {
    window.dispatchEvent(new CustomEvent(SAVE_STATUS_EVENT, { detail }));
  });
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <StorageQuotaBanner />
    </MemoryRouter>,
  );
}

describe('StorageQuotaBanner', () => {
  afterEach(() => {
    // Each test renders a fresh component; React Testing Library cleans up,
    // but reset any sticky state via a no-op dispatch to confirm isolation.
  });

  it('renders nothing until a quota failure fires', () => {
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });

  it('shows the banner with the affected key when a quota failure fires', () => {
    renderBanner();
    dispatchSave({
      phase: 'failed',
      kind: 'quota',
      key: 'ceo-os-capture-notes',
      message: 'Quota exceeded',
    });
    expect(screen.getByTestId('storage-quota-banner')).toBeInTheDocument();
    expect(screen.getByText(/ceo-os-capture-notes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open workspace data/i })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('uses an assertive live region so quota is announced ahead of polite save status', () => {
    renderBanner();
    dispatchSave({ phase: 'failed', kind: 'quota', key: 'ceo-os-test', message: 'q' });
    const banner = screen.getByTestId('storage-quota-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
  });

  it('does NOT react to generic save failures (only quota)', () => {
    renderBanner();
    dispatchSave({
      phase: 'failed',
      kind: 'generic',
      key: 'ceo-os-test',
      message: 'something else',
    });
    expect(screen.queryByTestId('storage-quota-banner')).toBeNull();
  });

  it('does NOT react to successful saves', () => {
    renderBanner();
    dispatchSave({ phase: 'saved', key: 'ceo-os-test' });
    expect(screen.queryByTestId('storage-quota-banner')).toBeNull();
  });

  it('dismisses cleanly when the user clicks Dismiss', () => {
    renderBanner();
    dispatchSave({ phase: 'failed', kind: 'quota', key: 'ceo-os-test', message: 'q' });
    expect(screen.getByTestId('storage-quota-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByTestId('storage-quota-banner')).toBeNull();
  });
});
