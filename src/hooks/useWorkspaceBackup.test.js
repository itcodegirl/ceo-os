import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceBackup } from './useWorkspaceBackup';
import {
  buildWorkspaceBackup,
  getLocalWorkspaceDataHealth,
  importWorkspaceBackup,
} from '../lib/workspacePortability';

vi.mock('../lib/workspacePortability', () => ({
  buildWorkspaceBackup: vi.fn(),
  buildWorkspaceBackupFileName: vi.fn(() => 'ceo-os-backup.json'),
  getLocalWorkspaceDataHealth: vi.fn(() => ({
    isAvailable: true,
    localRecordCount: 3,
    restorableStoreCount: 2,
    invalidStoreCount: 0,
    lastSettingsSavedAt: 0,
  })),
  importWorkspaceBackup: vi.fn(),
}));

describe('useWorkspaceBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalWorkspaceDataHealth.mockReturnValue({
      isAvailable: true,
      localRecordCount: 3,
      restorableStoreCount: 2,
      invalidStoreCount: 0,
      lastSettingsSavedAt: 0,
    });
    window.URL.createObjectURL = vi.fn(() => 'blob:ceo-os-backup');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    delete window.URL.createObjectURL;
    delete window.URL.revokeObjectURL;
  });

  it('returns the current data-health snapshot', () => {
    const { result } = renderHook(() => useWorkspaceBackup());
    expect(result.current.dataHealth.localRecordCount).toBe(3);
    expect(result.current.portabilityStatus).toEqual({ tone: '', message: '' });
  });

  it('exportBackup downloads a blob and reports success', () => {
    buildWorkspaceBackup.mockReturnValue({
      exportedAt: 1700000000000,
      summary: { includedStoreCount: 2 },
    });
    const { result } = renderHook(() => useWorkspaceBackup());

    act(() => {
      result.current.exportBackup();
    });

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(result.current.portabilityStatus.tone).toBe('success');
    expect(result.current.portabilityStatus.message).toMatch(/2 local stores exported/);
  });

  it('exportBackup reports an error when the build throws', () => {
    buildWorkspaceBackup.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useWorkspaceBackup());

    act(() => {
      result.current.exportBackup();
    });

    expect(result.current.portabilityStatus).toEqual({ tone: 'error', message: 'boom' });
  });

  it('importBackup parses the file, refreshes settings, and reports success', async () => {
    importWorkspaceBackup.mockReturnValue({ importedStoreCount: 1 });
    const onRefreshSettings = vi.fn().mockResolvedValue(undefined);
    const file = { text: () => Promise.resolve('{"format":"x"}') };
    const { result } = renderHook(() => useWorkspaceBackup({ onRefreshSettings }));

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(importWorkspaceBackup).toHaveBeenCalledWith('{"format":"x"}');
    expect(onRefreshSettings).toHaveBeenCalledTimes(1);
    expect(result.current.portabilityStatus.tone).toBe('success');
    expect(result.current.portabilityStatus.message).toMatch(/1 local store imported/);
  });

  it('importBackup reports an error when import fails', async () => {
    importWorkspaceBackup.mockImplementation(() => {
      throw new Error('bad backup');
    });
    const file = { text: () => Promise.resolve('{}') };
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(result.current.portabilityStatus).toEqual({ tone: 'error', message: 'bad backup' });
  });

  it('importBackup is a no-op when no file is provided', async () => {
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importBackup(undefined);
    });

    expect(importWorkspaceBackup).not.toHaveBeenCalled();
    expect(result.current.portabilityStatus).toEqual({ tone: '', message: '' });
  });
});
