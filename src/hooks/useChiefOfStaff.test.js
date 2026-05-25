import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChiefOfStaff } from './useChiefOfStaff';

vi.mock('../lib/openai', () => ({
  aiConfig: {
    hasProxyEndpoint: true,
    endpoint: '/api/chief-of-staff',
    configuredEndpoint: '/api/chief-of-staff',
  },
  generateChiefOfStaffResponse: vi.fn(),
  getChiefActionTitle: vi.fn((actionKey) => `${actionKey} title`),
}));

vi.mock('../lib/opportunitiesRepository', () => ({
  createOpportunity: vi.fn(),
  listOpportunities: vi.fn(),
}));

vi.mock('../lib/contentRepository', () => ({
  createContentItem: vi.fn(),
  listContentItems: vi.fn(),
}));

vi.mock('../lib/weeklyRepository', () => ({
  createWeeklyItem: vi.fn(),
  getCurrentWeekStart: vi.fn(() => '2026-04-20'),
  getWeeklyBriefByWeek: vi.fn(() => Promise.resolve({ priorities: [] })),
}));

vi.mock('../lib/chiefRepository', () => ({
  createChiefSession: vi.fn(),
  getChiefSource: vi.fn(() => 'local'),
  loadChiefWorkspace: vi.fn(() => ({
    notes: 'Initial notes',
    responses: [],
    source: 'local',
  })),
  resetChiefWorkspace: vi.fn(),
  saveChiefNotes: vi.fn(() => Promise.resolve('')),
  saveChiefOutput: vi.fn(),
}));

import { createOpportunity, listOpportunities } from '../lib/opportunitiesRepository';
import { createContentItem, listContentItems } from '../lib/contentRepository';
import { createWeeklyItem, getWeeklyBriefByWeek } from '../lib/weeklyRepository';
import { createChiefSession, loadChiefWorkspace, saveChiefOutput } from '../lib/chiefRepository';
import { generateChiefOfStaffResponse } from '../lib/openai';

describe('useChiefOfStaff', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();

    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 11;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('hydrates acceptance state for already persisted structured opportunities', async () => {
    listOpportunities.mockResolvedValue([
      {
        id: 'o-1',
        name: 'Acme Intro',
        company: 'Acme',
      },
    ]);

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.acceptStructuredItem('opportunities', {
        name: 'Acme Intro',
        company: 'Acme',
      });
    });

    expect(createOpportunity).not.toHaveBeenCalled();
    expect(result.current.feedback).toBe('That opportunity already exists.');
    expect(result.current.isStructuredItemAccepted('opportunities', {
      name: 'Acme Intro',
      company: 'Acme',
    })).toBe(true);
  });

  it('dedupes rapid acceptance for the same structured opportunity', async () => {
    listOpportunities.mockResolvedValue([]);
    createOpportunity.mockResolvedValue({ id: 'opportunity-1' });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    let firstAcceptPromise;
    let secondAcceptPromise;

    act(() => {
      firstAcceptPromise = result.current.acceptStructuredItem('opportunities', {
        name: 'Rapid Save',
        company: 'Acme',
      });
      secondAcceptPromise = result.current.acceptStructuredItem('opportunities', {
        name: 'Rapid Save',
        company: 'Acme',
      });
    });

    await act(async () => {
      await Promise.all([firstAcceptPromise, secondAcceptPromise]);
    });

    expect(createOpportunity).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBe('Added an opportunity from the structured AI output.');
  });

  it('ignores malformed structured opportunities without required fields', async () => {
    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.acceptStructuredItem('opportunities', {
        company: 'Acme',
      });
    });

    expect(createOpportunity).not.toHaveBeenCalled();
    expect(result.current.feedback).toBe('This item is missing required details and cannot be saved yet.');
  });

  it('keeps feedback behavior idempotent for duplicate malformed structured items', async () => {
    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.acceptStructuredItem('contentItems', {});
    });
    await act(async () => {
      await result.current.acceptStructuredItem('contentItems', {});
    });

    expect(result.current.feedback).toBe('This item is missing required details and cannot be saved yet.');
  });

  it('treats malformed and valid payload entries as independent during acceptance hydration', async () => {
    listOpportunities.mockResolvedValue([
      {
        id: 'o-1',
        name: 'Existing Opp',
        company: 'Acme',
      },
    ]);
    listContentItems.mockResolvedValue([
      {
        id: 'c-1',
        title: 'Weekly Roundup',
        platform: 'LinkedIn',
      },
    ]);
    loadChiefWorkspace.mockResolvedValue({
      notes: 'Initial notes',
      responses: [
        {
          structuredPayload: {
            opportunities: [
              { name: 'Existing Opp', company: 'Acme' },
              { name: '' },
            ],
            contentItems: [
              { title: 'Weekly Roundup', platform: 'LinkedIn' },
              { title: '', platform: 'LinkedIn' },
            ],
            priorities: [
              { title: 'Do Something' },
              { title: '' },
            ],
            tasks: [{ title: 'Follow up' }, {}],
          },
        },
      ],
      source: 'local',
    });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        result.current.isStructuredItemAccepted('opportunities', {
          name: 'Existing Opp',
          company: 'Acme',
        }),
      ).toBe(true);
    });
    expect(result.current.isStructuredItemAccepted('opportunities', { name: '', company: 'Acme' })).toBe(
      false,
    );
    expect(
      result.current.isStructuredItemAccepted('contentItems', {
        title: 'Weekly Roundup',
        platform: 'LinkedIn',
      }),
    ).toBe(true);
    expect(result.current.isStructuredItemAccepted('contentItems', { title: '', platform: 'LinkedIn' })).toBe(
      false,
    );
  });

  it('hydrates accepted task entries using task section keys', async () => {
    listOpportunities.mockResolvedValue([]);
    listContentItems.mockResolvedValue([]);
    getWeeklyBriefByWeek.mockResolvedValue({
      priorities: [{ title: 'Follow up with partner' }],
    });
    loadChiefWorkspace.mockResolvedValue({
      notes: 'Initial notes',
      responses: [
        {
          structuredPayload: {
            priorities: [],
            opportunities: [],
            contentItems: [],
            tasks: [{ title: 'Follow up with partner' }],
          },
        },
      ],
      source: 'local',
    });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.isStructuredItemAccepted('tasks', { title: 'Follow up with partner' })).toBe(true);
    });
    expect(result.current.isStructuredItemAccepted('priorities', { title: 'Follow up with partner' })).toBe(false);
  });

  it('adds a structured fallback output to local responses when proxy returns fallback source', async () => {
    createChiefSession.mockResolvedValue({ id: 'session-1' });
    listOpportunities.mockResolvedValue([]);
    listContentItems.mockResolvedValue([]);
    saveChiefOutput.mockResolvedValue({
      id: 'output-1',
      title: 'summarize title',
      content: 'Fallback executive summary',
      source: 'fallback',
      fallbackReason: 'AI generation is unavailable; this is a local template fallback.',
      errorCode: 'OPENAI_API_KEY_MISSING',
      errorMessage: 'OPENAI_API_KEY is not configured on the server',
      structuredPayload: {
        priorities: [],
        opportunities: [],
        contentItems: [],
        tasks: [],
      },
    });
    generateChiefOfStaffResponse.mockResolvedValue({
      title: 'summarize title',
      content: 'Fallback executive summary',
      source: 'fallback',
      fallbackReason: 'AI generation is unavailable; this is a local template fallback.',
      errorCode: 'OPENAI_API_KEY_MISSING',
      errorMessage: 'OPENAI_API_KEY is not configured on the server',
      structuredPayload: {
        priorities: [],
        opportunities: [],
        contentItems: [],
        tasks: [],
      },
    });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setNotes('Status update: closed 3 opportunities');
    });

    await act(async () => {
      await result.current.handleAction('summarize');
    });

    await waitFor(() => {
      expect(result.current.responses[0]).toMatchObject({
        id: 'output-1',
        content: 'Fallback executive summary',
      });
    });
    expect(generateChiefOfStaffResponse).toHaveBeenCalledWith(expect.objectContaining({
      actionKey: 'summarize',
      notes: 'Status update: closed 3 opportunities',
      correlationId: expect.any(String),
    }));
    expect(createChiefSession).toHaveBeenCalledWith({
      actionKey: 'summarize',
      notes: 'Status update: closed 3 opportunities',
    });
    expect(saveChiefOutput).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      outputType: 'response',
      title: 'summarize title',
      content: 'Fallback executive summary',
      source: 'fallback',
      fallbackReason: 'AI generation is unavailable; this is a local template fallback.',
      errorCode: 'OPENAI_API_KEY_MISSING',
      errorMessage: 'OPENAI_API_KEY is not configured on the server',
    }));
    expect(result.current.feedback).toBe('AI unavailable. Saved local fallback: summarize title. Review before using.');
    expect(result.current.hasHistory).toBe(true);
  });

  it('accepts all structured items from the latest saved live response', async () => {
    listOpportunities.mockResolvedValue([]);
    listContentItems.mockResolvedValue([]);
    createOpportunity.mockResolvedValue({ id: 'opp-1' });
    createContentItem.mockResolvedValue({ id: 'content-1' });
    createWeeklyItem.mockResolvedValue({ id: 'weekly-1' });
    loadChiefWorkspace.mockResolvedValue({
      notes: 'Initial notes',
      responses: [
        {
          id: 'output-1',
          title: 'Executive Action Plan',
          content: 'Generated plan content',
          source: 'proxy',
          structuredPayload: {
            priorities: [{ title: 'Priority A' }],
            opportunities: [{ name: 'Opportunity A', company: 'Acme' }],
            contentItems: [{ title: 'Content A', platform: 'LinkedIn' }],
            tasks: [{ title: 'Task A' }],
          },
        },
      ],
      source: 'local',
    });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.responses).toHaveLength(1);
    });

    await act(async () => {
      await result.current.acceptAllStructured();
    });

    expect(createOpportunity).toHaveBeenCalledTimes(1);
    expect(createContentItem).toHaveBeenCalledTimes(1);
    expect(createWeeklyItem).toHaveBeenCalledTimes(2);
    expect(result.current.feedback).toBe('Add all complete: 4 saved, 0 skipped, 0 failed.');
    expect(result.current.feedbackKind).toBe('result');
    expect(result.current.isAcceptingAll).toBe(false);
  });

  it('autosave timer cannot paint over a durable error message', async () => {
    // Force the generation flow to fail so the hook surfaces an error-kind
    // feedback that should survive the autosave timer.
    generateChiefOfStaffResponse.mockRejectedValueOnce(new Error('boom'));
    createChiefSession.mockResolvedValueOnce({ id: 'session-x' });

    const { result } = renderHook(() => useChiefOfStaff());

    await waitFor(() => {
      expect(loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setNotes('Some founder notes');
    });

    await act(async () => {
      await result.current.handleAction('plan');
    });

    // After the failure, the error should be surfaced as a durable kind.
    expect(result.current.feedback).toBe('Unable to generate output right now. Try again in a moment.');
    expect(result.current.feedbackKind).toBe('error');

    // Wait past the 2.5s autosave threshold — used to clobber the error with
    // "Notes saved. Pick an action when you are ready." Now the durable kind
    // blocks the soft update.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2700));
    });

    expect(result.current.feedback).toBe('Unable to generate output right now. Try again in a moment.');
    expect(result.current.feedbackKind).toBe('error');
  }, 10000);
});
