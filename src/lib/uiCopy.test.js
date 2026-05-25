import { describe, expect, it } from 'vitest';
import {
  SOURCE_NOTICE_BLANK_LOCAL,
  SOURCE_NOTICE_DEMO_DATA,
  SOURCE_NOTICE_LOCAL_ONLY,
  SOURCE_NOTICE_OFFLINE,
  SOURCE_LABEL_SUPABASE,
  SOURCE_NOTICE_SUPABASE,
  AUTOSAVE_PAUSED_COPY,
  buildAutosaveHelperText,
  buildSourceNotice,
  resolveLocalSourceNotice,
} from './uiCopy';

describe('src/lib/uiCopy', () => {
  it('returns canonical source labels', () => {
    expect(SOURCE_LABEL_SUPABASE).toBe('Workspace sync is active.');
    expect(SOURCE_NOTICE_SUPABASE).toBe('Data source: Workspace sync is active.');
    expect(SOURCE_NOTICE_LOCAL_ONLY).toBe('This workspace is stored on this device only.');
    expect(SOURCE_NOTICE_DEMO_DATA).toBe('Demo data is active on this device. It is not synced.');
    expect(SOURCE_NOTICE_BLANK_LOCAL).toBe('Blank local workspace is active on this device.');
    expect(SOURCE_NOTICE_OFFLINE).toBe('Data source: Offline. No cloud replay queue is active.');
    expect(AUTOSAVE_PAUSED_COPY).toBe('Autosave is paused until this workspace saves successfully again.');
  });

  it('exposes a local-first-only notice for Capture / Journal / Reminders', async () => {
    const { SOURCE_NOTICE_LOCAL_FIRST_ONLY } = await import('./uiCopy');
    expect(SOURCE_NOTICE_LOCAL_FIRST_ONLY)
      .toBe('This surface stays on this device — it is not part of the synced workspace.');
  });

  it('builds source notice for supabase with default prefix', () => {
    expect(buildSourceNotice('supabase')).toBe('Data source: Workspace sync is active.');
  });

  it('builds source notice with state-specific local copy and custom prefixes', () => {
    expect(buildSourceNotice('supabase', { supabasePrefix: 'Weekly data source: ' }))
      .toBe('Weekly data source: Workspace sync is active.');
    expect(buildSourceNotice('local', { localMode: 'demo', localPrefix: 'Weekly data source: ' }))
      .toBe('Weekly data source: Demo data is active on this device. It is not synced.');
    expect(buildSourceNotice('local', { localMode: 'blank' }))
      .toBe('Blank local workspace is active on this device.');
    expect(buildSourceNotice('supabase', { isOnline: false }))
      .toBe('Data source: Offline. No cloud replay queue is active.');
    expect(buildSourceNotice('supabase', { hasError: true, offlinePrefix: 'Weekly data source: ' }))
      .toBe('Weekly data source: Offline. No cloud replay queue is active.');
    expect(resolveLocalSourceNotice('unknown')).toBe('This workspace is stored on this device only.');
  });

  it('builds autosave helper text from save health', () => {
    expect(buildAutosaveHelperText({
      healthyText: 'Notes are saved automatically for this workspace.',
    })).toBe('Notes are saved automatically for this workspace.');

    expect(buildAutosaveHelperText({
      hasError: true,
      healthyText: 'Notes are saved automatically for this workspace.',
    })).toBe(AUTOSAVE_PAUSED_COPY);

    expect(buildAutosaveHelperText({
      hasError: true,
      pausedText: 'Autosave needs attention.',
    })).toBe('Autosave needs attention.');
  });
});
