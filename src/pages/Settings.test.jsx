import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';
import { WORKSPACE_BACKUP_FORMAT } from '../lib/workspacePortability';

vi.mock('../hooks/useSettings', () => ({
  useSettings: vi.fn(),
}));

vi.mock('../hooks/useWorkspaceSetup', () => ({
  useWorkspaceSetup: vi.fn(),
}));

import { useSettings } from '../hooks/useSettings';
import { useWorkspaceSetup } from '../hooks/useWorkspaceSetup';

function createSettingsState(overrides = {}) {
  return {
    settings: {
      teamName: 'CodeHerWay',
      timezone: 'America/Chicago',
      emailDigest: true,
      keyboardShortcuts: false,
      autoSave: true,
    },
    savedAt: 0,
    source: 'local',
    isLoading: false,
    isSaving: false,
    loadError: '',
    timezoneIsValid: true,
    normalizeTimezone: vi.fn(),
    updateSetting: vi.fn(),
    saveSettings: vi.fn(),
    refreshSettings: vi.fn(),
    ...overrides,
  };
}

function renderSettings({ initialEntries } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Settings />
    </MemoryRouter>,
  );
}

describe('src/pages/Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useWorkspaceSetup.mockReturnValue({
      hasChoice: true,
      isDemoMode: true,
      startBlankWorkspace: vi.fn(),
      loadDemoWorkspace: vi.fn(),
      clearDemoData: vi.fn(),
    });
  });

  it('announces saving state through form busy state and button name', () => {
    useSettings.mockReturnValue(createSettingsState({
      isSaving: true,
    }));

    const { container } = renderSettings();

    expect(screen.getByRole('button', { name: 'Saving settings' })).toBeDisabled();
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('explains why saving is unavailable when timezone is invalid', () => {
    useSettings.mockReturnValue(createSettingsState({
      settings: {
        teamName: 'CodeHerWay',
        timezone: 'Invalid/Timezone',
        emailDigest: true,
        keyboardShortcuts: false,
        autoSave: true,
      },
      timezoneIsValid: false,
    }));

    renderSettings();

    expect(screen.getByRole('button', {
      name: 'Save settings unavailable until timezone is valid',
    })).toBeDisabled();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Timezone is invalid. Pick one from the list, for example America/Chicago.',
    );
  });

  it('sends changed workspace fields through the settings hook', () => {
    const updateSetting = vi.fn();
    const saveSettings = vi.fn();
    useSettings.mockReturnValue(createSettingsState({
      updateSetting,
      saveSettings,
    }));

    renderSettings();

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'CodeHerWay Studio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(updateSetting).toHaveBeenCalledWith('teamName', 'CodeHerWay Studio');
    expect(saveSettings).toHaveBeenCalledTimes(1);
  });

  it('uses confirmed Supabase save copy without implying replay', () => {
    useSettings.mockReturnValue(createSettingsState({
      source: 'supabase',
    }));

    renderSettings();

    expect(screen.getByText('Last save is confirmed in your Supabase profile.')).toBeInTheDocument();
  });

  it('normalizes the timezone field on blur without saving early', () => {
    const normalizeTimezone = vi.fn();
    const saveSettings = vi.fn();
    useSettings.mockReturnValue(createSettingsState({
      normalizeTimezone,
      saveSettings,
    }));

    renderSettings();

    const timezoneField = screen.getByLabelText('Timezone');
    fireEvent.blur(timezoneField, {
      target: { value: 'UTC' },
    });

    expect(normalizeTimezone).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('shows explicit local data setup actions and coming-soon paths', () => {
    const clearDemoData = vi.fn();
    useSettings.mockReturnValue(createSettingsState());
    useWorkspaceSetup.mockReturnValue({
      hasChoice: true,
      isDemoMode: true,
      startBlankWorkspace: vi.fn(),
      loadDemoWorkspace: vi.fn(),
      clearDemoData,
    });

    renderSettings();

    expect(screen.getByText('Demo data is active on this device. It is not synced.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export local workspace backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import local workspace backup' })).toBeInTheDocument();
    // Audit follow-up: the "Connect Supabase account: setup required" chip
    // overstated the gap — Supabase is wired and just needs env config — so
    // it was removed. We assert it's gone here so a future re-add gets a
    // test failure rather than silently regressing the audit fix.
    expect(screen.queryByText(/Connect Supabase account: setup required/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear demo data from this device' }));
    expect(clearDemoData).toHaveBeenCalledTimes(1);
  });

  it('summarizes local data health and pending sync calmly', () => {
    window.localStorage.setItem('ceo-os-capture-notes', JSON.stringify([
      { id: 'note-1', text: 'First' },
      { id: 'note-2', text: 'Second' },
    ]));
    window.localStorage.setItem('ceo-os-reminders', JSON.stringify([
      { id: 'reminder-1', text: 'Follow up' },
    ]));
    window.localStorage.setItem('ceo-os-offline-write-queue', JSON.stringify([
      { id: 'q-1', kind: 'content:update' },
    ]));
    useSettings.mockReturnValue(createSettingsState());

    renderSettings();

    const dataHealth = screen.getByRole('group', { name: 'Local data health' });
    expect(dataHealth).toHaveTextContent('3Local records');
    expect(dataHealth).toHaveTextContent('2Backup stores');
    expect(dataHealth).toHaveTextContent('1Pending sync');
    expect(screen.getByText(/Backups cover the local workspace data stored in this browser/)).toBeInTheDocument();
    expect(screen.getByText(/1 supported write waiting to sync/)).toBeInTheDocument();
  });

  it('exports a local workspace backup from Settings', () => {
    window.localStorage.setItem('ceo-os-settings', JSON.stringify({ teamName: 'CodeHerWay' }));
    const createObjectURL = vi.fn(() => 'blob:ceo-os-backup');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    useSettings.mockReturnValue(createSettingsState());

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Export local workspace backup' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/local stores? exported/)).toBeInTheDocument();
  });

  it('imports a local workspace backup and refreshes Settings state', async () => {
    const refreshSettings = vi.fn(async () => {});
    useSettings.mockReturnValue(createSettingsState({ refreshSettings }));

    renderSettings();

    const backupFile = {
      text: vi.fn(async () => JSON.stringify({
        format: WORKSPACE_BACKUP_FORMAT,
        schemaVersion: 1,
        keys: {
          'ceo-os-settings': JSON.stringify({ teamName: 'Imported Team' }),
        },
      })),
    };

    fireEvent.change(screen.getByLabelText('Import local workspace backup file'), {
      target: { files: [backupFile] },
    });

    await waitFor(() => {
      expect(refreshSettings).toHaveBeenCalledTimes(1);
    });
    expect(window.localStorage.getItem('ceo-os-settings')).toContain('Imported Team');
    expect(screen.getByText(/1 local store imported/)).toBeInTheDocument();
  });

  it('no longer renders the legacy coming-soon experience toggles', () => {
    // Audit follow-up: the disabled "Weekly digest" and "Keyboard shortcuts"
    // toggles read as half-finished and were removed. The auto-save toggle
    // remains as the one experience preference that is actually wired.
    useSettings.mockReturnValue(createSettingsState());

    renderSettings();

    expect(screen.queryByLabelText(/Weekly digest reminders/)).toBeNull();
    expect(screen.queryByLabelText(/Keyboard shortcuts/)).toBeNull();
    expect(screen.getByLabelText('Enable auto-save for drafts and notes')).toBeInTheDocument();
  });

  it('moves focus to the Workspace Data section when opened via the #workspace-data deep link', () => {
    // The StorageQuotaBanner recovery CTA links to /settings#workspace-data so
    // a storage-full user lands directly on the backup/clear controls. React
    // Router does not scroll/focus the hash target on its own.
    useSettings.mockReturnValue(createSettingsState());

    renderSettings({ initialEntries: ['/settings#workspace-data'] });

    const target = document.getElementById('workspace-data');
    expect(target).not.toBeNull();
    expect(target).toHaveFocus();
  });
});
