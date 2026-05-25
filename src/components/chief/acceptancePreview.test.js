import { describe, expect, it } from 'vitest';
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
  getAcceptancePreviewSentence,
  getItemTitle,
} from './acceptancePreview';

describe('acceptancePreview', () => {
  describe('getItemTitle', () => {
    it('reads `title` for priorities, content, and tasks', () => {
      expect(getItemTitle('priorities', { title: 'Ship pricing v2' })).toBe('Ship pricing v2');
      expect(getItemTitle('contentItems', { title: 'Launch post' })).toBe('Launch post');
      expect(getItemTitle('tasks', { title: 'Reply to Bob' })).toBe('Reply to Bob');
    });

    it('prefers `name` for opportunities', () => {
      expect(getItemTitle('opportunities', { name: 'Acme intro', title: 'ignored' })).toBe('Acme intro');
    });

    it('falls back to alternate fields when primary is missing', () => {
      expect(getItemTitle('priorities', { task: 'Send invoice' })).toBe('Send invoice');
    });

    it('returns empty string for unusable input', () => {
      expect(getItemTitle('priorities', null)).toBe('');
      expect(getItemTitle('priorities', {})).toBe('');
    });
  });

  describe('getAcceptancePreviewCaption', () => {
    it('names the Weekly Brief destination for priorities', () => {
      expect(getAcceptancePreviewCaption('priorities', { title: 'X' })).toBe('Weekly Brief · priority');
    });

    it('names the Opportunities destination with stage', () => {
      expect(getAcceptancePreviewCaption('opportunities', { name: 'A', stage: 'Discovery' })).toBe(
        'Opportunities · stage Discovery',
      );
    });

    it('defaults opportunity stage to "New" when missing', () => {
      expect(getAcceptancePreviewCaption('opportunities', { name: 'A' })).toBe('Opportunities · stage New');
    });

    it('names the Content OS destination with platform when present', () => {
      expect(getAcceptancePreviewCaption('contentItems', { title: 'P', platform: 'LinkedIn' })).toBe(
        'Content OS · LinkedIn',
      );
      expect(getAcceptancePreviewCaption('contentItems', { title: 'P' })).toBe('Content OS');
    });

    it('names the Weekly Brief destination for tasks', () => {
      expect(getAcceptancePreviewCaption('tasks', { title: 'T' })).toBe('Weekly Brief · task');
    });

    it('returns empty for unknown sections or missing items', () => {
      expect(getAcceptancePreviewCaption('mystery', { title: 'X' })).toBe('');
      expect(getAcceptancePreviewCaption('priorities', null)).toBe('');
    });
  });

  describe('getAcceptancePreviewSentence', () => {
    it('quotes the title and names the destination', () => {
      expect(getAcceptancePreviewSentence('priorities', { title: 'Ship pricing v2' })).toBe(
        'Add priority "Ship pricing v2" to this week\'s Weekly Brief',
      );
    });

    it('includes company and stage for opportunities', () => {
      expect(
        getAcceptancePreviewSentence('opportunities', {
          name: 'Acme intro',
          company: 'Acme Inc',
          stage: 'Qualified',
        }),
      ).toBe('Add opportunity "Acme intro" at Acme Inc (stage Qualified) to Opportunities');
    });

    it('includes the platform for content', () => {
      expect(
        getAcceptancePreviewSentence('contentItems', {
          title: 'Launch post',
          platform: 'LinkedIn',
        }),
      ).toBe('Add content draft "Launch post" on LinkedIn to Content OS');
    });

    it('produces a sensible fallback when the item has no title', () => {
      expect(getAcceptancePreviewSentence('priorities', { reason: 'no title here' })).toBe(
        "Add priority to this week's Weekly Brief",
      );
    });
  });

  describe('getAcceptButtonAriaLabel', () => {
    it('returns the sentence on the default ready state', () => {
      expect(
        getAcceptButtonAriaLabel({
          section: 'priorities',
          item: { title: 'X' },
          isAccepting: false,
          isAccepted: false,
        }),
      ).toBe('Add priority "X" to this week\'s Weekly Brief');
    });

    it('appends the saving state', () => {
      expect(
        getAcceptButtonAriaLabel({
          section: 'priorities',
          item: { title: 'X' },
          isAccepting: true,
          isAccepted: false,
        }),
      ).toBe('Add priority "X" to this week\'s Weekly Brief (saving…)');
    });

    it('appends the accepted state', () => {
      expect(
        getAcceptButtonAriaLabel({
          section: 'priorities',
          item: { title: 'X' },
          isAccepting: false,
          isAccepted: true,
        }),
      ).toBe('Add priority "X" to this week\'s Weekly Brief — already added');
    });
  });
});
