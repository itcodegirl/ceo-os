import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildWorkspaceBackupMock,
  buildWorkspaceBackupFileNameMock,
  getLocalWorkspaceDataHealthMock,
  importWorkspaceBackupMock,
} = vi.hoisted(() => ({
  buildWorkspaceBackupMock: vi.fn(),
  buildWorkspaceBackupFileNameMock: vi.fn(() => 'ceo-os-backup.json'),
  getLocalWorkspaceDataHealthMock: vi.fn(() => ({
    isAvailable: true,
    localRecordCount: 0,
    restorableStoreCount: 0,
    invalidStoreCount: 0,
    lastSettingsSavedAt: 0,
  })),
  importWorkspaceBackupMock: vi.fn(),
}));

vi.mock('../lib/workspacePortability', () => ({
  buildWorkspaceBackup: buildWorkspaceBackupMock,
  buildWorkspaceBackupFileName: buildWorkspaceBackupFileNameMock,
  getLocalWorkspaceDataHealth: getLocalWorkspaceDataHealthMock,
  importWorkspaceBackup: importWorkspaceBackupMock,
}));

import { formatCount, useWorkspaceBackup } from './useWorkspaceBackup';

describe('formatCount', () => {
  it('pluralizes based on the count and coerces nullish to zero', () => {
    expect(formatCount(1, 'local store')).toBe('1 local store');
    expect(formatCount(2, 'local store')).toBe('2 local stores');
    expect(formatCount(0, 'supported write')).toBe('0 supported writes');
    expect(formatCount(undefined, 'local store')).toBe('0 local stores');
  });
});

describe('useWorkspaceBackup', () => {
  let createObjectURL;
  let revokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL = vi.fn(() => 'blob:ceo-os');
    revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a backup and reports a success status', () => {
    buildWorkspaceBackupMock.mockReturnValue({
      exportedAt: 123,
      summary: { includedStoreCount: 2 },
    });

    const { result } = renderHook(() => useWorkspaceBackup());

    act(() => {
      result.current.handleExportBackup();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.portabilityStatus.tone).toBe('success');
    expect(result.current.portabilityStatus.message).toContain('2 local stores exported');
  });

  it('reports an error status when the export throws', () => {
    buildWorkspaceBackupMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const { result } = renderHook(() => useWorkspaceBackup());

    act(() => {
      result.current.handleExportBackup();
    });

    expect(result.current.portabilityStatus.tone).toBe('error');
    expect(result.current.portabilityStatus.message).toBe('boom');
  });

  it('imports a backup, refreshes settings, and reports success', async () => {
    importWorkspaceBackupMock.mockReturnValue({ importedStoreCount: 3 });
    const onRefreshSettings = vi.fn(async () => {});
    const { result } = renderHook(() => useWorkspaceBackup({ onRefreshSettings }));

    const input = { value: 'x', files: [{ text: async () => '{}' }] };

    await act(async () => {
      await result.current.handleImportBackup({ currentTarget: input });
    });

    await waitFor(() => {
      expect(onRefreshSettings).toHaveBeenCalledTimes(1);
    });
    expect(result.current.portabilityStatus.tone).toBe('success');
    expect(result.current.portabilityStatus.message).toContain('3 local stores imported');
    expect(input.value).toBe('');
  });

  it('reports an error status when the import throws', async () => {
    importWorkspaceBackupMock.mockImplementation(() => {
      throw new Error('bad backup');
    });
    const { result } = renderHook(() => useWorkspaceBackup());

    const input = { value: 'x', files: [{ text: async () => 'not json' }] };

    await act(async () => {
      await result.current.handleImportBackup({ currentTarget: input });
    });

    expect(result.current.portabilityStatus.tone).toBe('error');
    expect(result.current.portabilityStatus.message).toBe('bad backup');
    expect(input.value).toBe('');
  });

  it('ignores an import event with no selected file', async () => {
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.handleImportBackup({ currentTarget: { files: [] } });
    });

    expect(importWorkspaceBackupMock).not.toHaveBeenCalled();
    expect(result.current.portabilityStatus.message).toBe('');
  });
});
