import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SyncStatusPill from './SyncStatusPill';
import { describeSyncStatus } from '../../lib/syncStatusDescriptors';

vi.mock('../../hooks/useWorkspaceSettings', () => ({
  useWorkspaceSettings: vi.fn(),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock('../../hooks/useOfflineWriteQueue', () => ({
  useOfflineWriteQueueSize: vi.fn(),
}));

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: vi.fn(),
}));

import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useOfflineWriteQueueSize } from '../../hooks/useOfflineWriteQueue';
import { useAuthSession } from '../../hooks/useAuthSession';

function authSessionValue(overrides = {}) {
  // Default to "Supabase disabled" so existing local-only assertions don't
  // accidentally light up the sign-in-available branch.
  return {
    isAuthenticated: false,
    isInitializing: false,
    isDisabled: true,
    user: null,
    ...overrides,
  };
}

function renderPill() {
  return render(
    <MemoryRouter>
      <SyncStatusPill />
    </MemoryRouter>,
  );
}

function workspaceSettingsValue(overrides = {}) {
  return {
    source: 'local',
    loadError: '',
    refreshWorkspaceSettings: vi.fn(),
    ...overrides,
  };
}

describe('describeSyncStatus', () => {
  it('returns the offline descriptor regardless of source when offline', () => {
    expect(describeSyncStatus('supabase', false).label).toBe('Offline');
    expect(describeSyncStatus('local', false).label).toBe('Offline');
  });

  it('returns synced when supabase and online', () => {
    expect(describeSyncStatus('supabase', true).label).toBe('Synced');
  });

  it('returns local-only when source is local and online', () => {
    expect(describeSyncStatus('local', true).label).toBe('Local only');
  });

  it('falls back to local-only for unknown sources when online', () => {
    expect(describeSyncStatus(undefined, true).label).toBe('Local only');
  });

  it('returns the error descriptor when online but a load error is present', () => {
    expect(describeSyncStatus('supabase', true, true).label).toBe('Sync error');
    expect(describeSyncStatus('local', true, true).tone).toBe('error');
  });

  it('still prefers offline over error when both are true', () => {
    expect(describeSyncStatus('supabase', false, true).label).toBe('Offline');
  });

  it('shows "Sign in to sync" when Supabase is wired but the user is not signed in', () => {
    expect(describeSyncStatus('local', true, false, true).label).toBe('Sign in to sync');
  });

  it('does NOT show "Sign in to sync" when the user is already signed in (source === supabase)', () => {
    expect(describeSyncStatus('supabase', true, false, true).label).toBe('Synced');
  });

  it('prefers the error and offline branches over sign-in-available', () => {
    expect(describeSyncStatus('local', false, false, true).label).toBe('Offline');
    expect(describeSyncStatus('local', true, true, true).label).toBe('Sync error');
  });
});

describe('SyncStatusPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOnlineStatus.mockReturnValue(true);
    useOfflineWriteQueueSize.mockReturnValue(0);
    useAuthSession.mockReturnValue(authSessionValue());
  });

  it('renders the synced state when source is supabase and online', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'supabase' }));
    renderPill();
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('renders the local-only state when source is local and online', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'local' }));
    renderPill();
    expect(screen.getByText('Local only')).toBeInTheDocument();
  });

  it('falls back to local-only when source is unknown and online', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: undefined }));
    renderPill();
    expect(screen.getByText('Local only')).toBeInTheDocument();
  });

  it('shows Offline when the browser is offline, regardless of source', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'supabase' }));
    useOnlineStatus.mockReturnValue(false);
    renderPill();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('does not show a pending suffix when the queue is empty', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'supabase' }));
    useOfflineWriteQueueSize.mockReturnValue(0);
    renderPill();
    expect(screen.queryByText(/pending/i)).toBeNull();
  });

  it('shows pending sync when the offline queue has entries and the workspace is online + supabase-backed', () => {
    useWorkspaceSettings.mockReturnValue({ source: 'supabase' });
    useOfflineWriteQueueSize.mockReturnValue(3);
    renderPill();
    expect(screen.getByText(/Pending sync/)).toBeInTheDocument();
    expect(screen.getByText(/3 waiting/)).toBeInTheDocument();
    expect(screen.queryByText(/^Synced$/)).toBeNull();
  });

  it('does not advertise queued writes while offline because replay cannot drain yet', () => {
    useWorkspaceSettings.mockReturnValue({ source: 'supabase' });
    useOnlineStatus.mockReturnValue(false);
    useOfflineWriteQueueSize.mockReturnValue(2);
    renderPill();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText(/waiting/i)).toBeNull();
  });

  it('does NOT show pending suffix in local-only mode (queue has nowhere to drain)', () => {
    useWorkspaceSettings.mockReturnValue({ source: 'local' });
    useOfflineWriteQueueSize.mockReturnValue(2);
    renderPill();
    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).toBeNull();
  });

  it('renders a retry button when loadError is present and online', () => {
    const refreshWorkspaceSettings = vi.fn();
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({
      source: 'supabase',
      loadError: 'Unable to load workspace settings right now.',
      refreshWorkspaceSettings,
    }));

    renderPill();

    const retryButton = screen.getByRole('button', { name: /Sync error\. Retry loading workspace settings\./i });
    expect(retryButton).toHaveTextContent('Sync error');
    expect(retryButton).toHaveAttribute(
      'title',
      expect.stringContaining('Unable to load workspace settings right now.'),
    );

    fireEvent.click(retryButton);
    expect(refreshWorkspaceSettings).toHaveBeenCalledTimes(1);
  });

  it('still shows Offline (not a retry button) when loadError occurs while offline', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({
      source: 'supabase',
      loadError: 'Unable to load workspace settings right now.',
    }));
    useOnlineStatus.mockReturnValue(false);

    renderPill();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders as a Link to /sign-in when Supabase is wired but the user is not signed in', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'local' }));
    useAuthSession.mockReturnValue(authSessionValue({ isDisabled: false, isAuthenticated: false }));

    renderPill();

    const link = screen.getByRole('link', { name: 'Sign in to enable cloud sync.' });
    expect(link).toHaveAttribute('href', '/sign-in');
    expect(link).toHaveTextContent('Sign in to sync');
  });

  it('keeps the plain "Local only" pill (not a sign-in link) when Supabase is not configured', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'local' }));
    useAuthSession.mockReturnValue(authSessionValue({ isDisabled: true }));

    renderPill();
    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not flash the sign-in prompt while auth is still initializing', () => {
    useWorkspaceSettings.mockReturnValue(workspaceSettingsValue({ source: 'local' }));
    useAuthSession.mockReturnValue(authSessionValue({ isDisabled: false, isInitializing: true }));

    renderPill();
    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to sync')).toBeNull();
  });
});
