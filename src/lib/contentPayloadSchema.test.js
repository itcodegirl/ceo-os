import { describe, expect, it } from 'vitest';
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  parseContentPayload,
  validateContentPayload,
} from './contentPayloadSchema';

const VALID = {
  title: 'Founder Weekly',
  platform: 'LinkedIn',
  contentType: 'Post',
  status: 'Drafting',
  purpose: '',
  scheduledFor: '',
  notes: '',
};

describe('validateContentPayload', () => {
  it('returns empty string for a valid payload', () => {
    expect(validateContentPayload(VALID)).toBe('');
  });

  it('returns an error when title is empty', () => {
    const error = validateContentPayload({ ...VALID, title: '' });
    expect(error).toBeTruthy();
    expect(error).toContain('Title');
  });

  it('returns an error when platform is empty', () => {
    const error = validateContentPayload({ ...VALID, platform: '' });
    expect(error).toBeTruthy();
    expect(error).toContain('Platform');
  });

  it('returns an error for an invalid status value', () => {
    const error = validateContentPayload({ ...VALID, status: 'Nope' });
    expect(error).toBeTruthy();
  });

  it('returns an error for an invalid content type', () => {
    const error = validateContentPayload({ ...VALID, contentType: 'Hologram' });
    expect(error).toBeTruthy();
  });

  it('returns an error for a malformed publish date', () => {
    const error = validateContentPayload({ ...VALID, scheduledFor: '05/14/2026' });
    expect(error).toBeTruthy();
  });

  it('accepts a blank publish date', () => {
    expect(validateContentPayload({ ...VALID, scheduledFor: '' })).toBe('');
  });

  it('accepts a well-formed publish date', () => {
    expect(validateContentPayload({ ...VALID, scheduledFor: '2026-05-14' })).toBe('');
  });

  it('accepts every lifecycle status', () => {
    for (const status of CONTENT_STATUSES) {
      expect(validateContentPayload({ ...VALID, status })).toBe('');
    }
  });

  it('accepts every content type', () => {
    for (const contentType of CONTENT_TYPES) {
      expect(validateContentPayload({ ...VALID, contentType })).toBe('');
    }
  });
});

describe('parseContentPayload', () => {
  it('returns the trimmed payload and no error for valid input', () => {
    const { payload, error } = parseContentPayload({
      title: '  Founder Weekly  ',
      platform: ' LinkedIn ',
      contentType: 'Newsletter',
      status: 'Editing',
      purpose: '  Community trust  ',
      scheduledFor: ' 2026-05-14 ',
      notes: '  Repurpose into a thread  ',
    });

    expect(error).toBe('');
    expect(payload).toEqual({
      title: 'Founder Weekly',
      platform: 'LinkedIn',
      contentType: 'Newsletter',
      status: 'Editing',
      purpose: 'Community trust',
      scheduledFor: '2026-05-14',
      notes: 'Repurpose into a thread',
    });
  });

  it('fills in defaults for omitted optional fields', () => {
    const { payload, error } = parseContentPayload({
      title: 'Idea seed',
      platform: 'Blog',
    });

    expect(error).toBe('');
    expect(payload).toEqual({
      title: 'Idea seed',
      platform: 'Blog',
      contentType: 'Post',
      status: 'Idea',
      purpose: '',
      scheduledFor: '',
      notes: '',
    });
  });

  it('returns an error and null payload when a required field is whitespace-only', () => {
    const { payload, error } = parseContentPayload({
      ...VALID,
      title: '   ',
    });

    expect(payload).toBeNull();
    expect(error).toContain('Title');
  });
});
