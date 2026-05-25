import { describe, expect, it } from 'vitest';
import {
  contentStatusRank,
  findNextScheduledItem,
  formatPublishDate,
} from './contentFormatting';

describe('formatPublishDate', () => {
  it('renders a human label for a YYYY-MM-DD value', () => {
    expect(formatPublishDate('2026-05-14')).toBe('May 14, 2026');
    expect(formatPublishDate(' 2026-12-01 ')).toBe('Dec 1, 2026');
  });

  it('returns an empty string for blank, malformed, or non-string values', () => {
    expect(formatPublishDate('')).toBe('');
    expect(formatPublishDate('05/14/2026')).toBe('');
    expect(formatPublishDate('2026-13-40')).toBe('');
    expect(formatPublishDate(undefined)).toBe('');
    expect(formatPublishDate(20260514)).toBe('');
  });
});

describe('contentStatusRank', () => {
  it('orders statuses along the lifecycle', () => {
    expect(contentStatusRank('Idea')).toBeLessThan(contentStatusRank('Drafting'));
    expect(contentStatusRank('Drafting')).toBeLessThan(contentStatusRank('Editing'));
    expect(contentStatusRank('Editing')).toBeLessThan(contentStatusRank('Ready'));
    expect(contentStatusRank('Ready')).toBeLessThan(contentStatusRank('Scheduled'));
    expect(contentStatusRank('Scheduled')).toBeLessThan(contentStatusRank('Published'));
  });

  it('sorts unknown statuses last', () => {
    expect(contentStatusRank('Mystery')).toBeGreaterThanOrEqual(contentStatusRank('Published'));
  });
});

describe('findNextScheduledItem', () => {
  it('returns the soonest dated scheduled item', () => {
    const items = [
      { id: '1', status: 'Scheduled', scheduledFor: '2026-06-01' },
      { id: '2', status: 'Scheduled', scheduledFor: '2026-05-20' },
      { id: '3', status: 'Drafting', scheduledFor: '2026-05-01' },
      { id: '4', status: 'Scheduled', scheduledFor: '' },
    ];
    expect(findNextScheduledItem(items)).toMatchObject({ id: '2' });
  });

  it('falls back to any scheduled item when none have dates', () => {
    const items = [
      { id: '1', status: 'Drafting' },
      { id: '2', status: 'Scheduled', scheduledFor: '' },
    ];
    expect(findNextScheduledItem(items)).toMatchObject({ id: '2' });
  });

  it('returns null when nothing is scheduled or input is not an array', () => {
    expect(findNextScheduledItem([{ id: '1', status: 'Idea' }])).toBeNull();
    expect(findNextScheduledItem(null)).toBeNull();
  });
});
