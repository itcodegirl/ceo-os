import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOURCE_NOTICE_LOCAL_ONLY, SOURCE_NOTICE_OFFLINE } from '../../lib/uiCopy';
import SourceStatusNotice from './SourceStatusNotice';

const originalNavigatorOnline = window.navigator.onLine;

function setNavigatorOnline(isOnline) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: isOnline,
  });
}

describe('SourceStatusNotice', () => {
  afterEach(() => {
    setNavigatorOnline(originalNavigatorOnline);
    vi.restoreAllMocks();
  });

  it('renders local source copy by default', () => {
    render(<SourceStatusNotice />);

    expect(screen.getByText(SOURCE_NOTICE_LOCAL_ONLY)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(SOURCE_NOTICE_LOCAL_ONLY);
  });

  it('renders supabase source copy when source is supabase', () => {
    render(
      <SourceStatusNotice
        source="supabase"
        supabaseText="Weekly data source: Supabase."
      />,
    );

    expect(screen.getByText('Weekly data source: Supabase.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Weekly data source: Supabase.');
  });

  it('shows alert and retry action when loadError is present', () => {
    const onRetry = vi.fn();

    render(
      <SourceStatusNotice
        loadError="Unable to load weekly brief right now."
        onRetry={onRetry}
        retryAriaLabel="Retry loading weekly dashboard data"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load weekly brief right now.');
    expect(screen.getByText('Showing the latest local workspace snapshot while we retry.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading weekly dashboard data' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows an offline recovery cue when Supabase state cannot be confirmed', () => {
    render(
      <SourceStatusNotice
        source="supabase"
        loadError="Unable to refresh live workspace data."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(SOURCE_NOTICE_OFFLINE);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh live workspace data.');
    expect(
      screen.getByText('Showing the latest available workspace data. Retry when the network or Supabase is available; changes are not replayed automatically.'),
    ).toBeInTheDocument();
  });

  it('updates the visible state when the browser goes offline', () => {
    setNavigatorOnline(true);
    render(<SourceStatusNotice source="supabase" />);

    expect(screen.getByRole('status')).toHaveTextContent('Data source: Workspace sync is active.');

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status')).toHaveTextContent(SOURCE_NOTICE_OFFLINE);
  });

  it('hides retry action when no retry callback is provided', () => {
    render(<SourceStatusNotice loadError="Source unavailable" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Source unavailable');
    expect(screen.queryByRole('button', { name: 'Retry loading data' })).not.toBeInTheDocument();
  });
});
