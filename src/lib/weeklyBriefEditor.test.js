import { describe, expect, it } from 'vitest';
import {
  createEditorPayload,
  buildWeeklyPayload,
  getDefaultFormValues,
  getEditorTitle,
  getFormValuesForEdit,
} from './weeklyBriefEditor';

describe('weeklyBriefEditor helpers', () => {
  it('returns defaults for each editor type', () => {
    expect(getDefaultFormValues('priority')).toEqual({
      title: '',
      owner: '',
      status: 'Planned',
    });
    expect(getDefaultFormValues('win')).toEqual({
      text: '',
      category: 'Product',
    });
    expect(getDefaultFormValues('blocker')).toEqual({
      text: '',
      severity: 'decision',
    });
  });

  it('builds form values for edit mode with fallbacks', () => {
    expect(getFormValuesForEdit('priority', {})).toEqual({
      title: '',
      owner: '',
      status: 'Planned',
    });
    expect(getFormValuesForEdit('win', { text: 'Shipped', category: 'Product' })).toEqual({
      text: 'Shipped',
      category: 'Product',
    });
  });

  it('returns correct editor titles', () => {
    expect(getEditorTitle('priority', false)).toBe('Add Priority');
    expect(getEditorTitle('priority', true)).toBe('Edit Priority');
    expect(getEditorTitle('blocker', true)).toBe('Edit Blocker');
  });

  it('creates and trims priority payloads', () => {
    const result = buildWeeklyPayload(
      'priority',
      { title: '  Review roadmap ', owner: ' Team Member ', status: 'In Progress' },
      'priority-123',
    );

    expect(result).toEqual({
      payload: {
        id: 'priority-123',
        title: 'Review roadmap',
        owner: 'Team Member',
        status: 'In Progress',
      },
    });
  });

  it('generates a new win id and validates required fields', () => {
    const winResult = buildWeeklyPayload('win', { text: '  Closed launch post ', category: 'Execution' });
    expect(typeof winResult.payload.id).toBe('string');
    expect(winResult.payload.id.length).toBeGreaterThan(0);
    expect(winResult.payload.text).toBe('Closed launch post');

    expect(buildWeeklyPayload('win', { text: ' ' })).toEqual({
      error: 'Add a few words for this win.',
    });
  });

  it('returns a safe error for unsupported types', () => {
    expect(createEditorPayload('unknown', {})).toEqual({
      error: 'Select a valid item type before saving.',
    });
  });
});
