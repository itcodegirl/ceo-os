import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChiefGeneration } from './useChiefGeneration';
import { generateChiefOfStaffResponse } from '../lib/openai';
import { createChiefSession, saveChiefOutput } from '../lib/chiefRepository';
import { invalidateChiefWorkspace } from '../lib/chiefLifecycle';

vi.mock('../lib/openai', () => ({ generateChiefOfStaffResponse: vi.fn(), getChiefActionTitle: () => 'Plan' }));
vi.mock('../lib/chiefRepository', () => ({ createChiefSession: vi.fn(), saveChiefOutput: vi.fn() }));

describe('Chief generation lifetime', () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
  const setup = () => {
    let resolve;
    generateChiefOfStaffResponse.mockImplementation(() => new Promise((yes) => { resolve = yes; }));
    createChiefSession.mockResolvedValue({ id: 'session' });
    saveChiefOutput.mockResolvedValue({ id: 'output' });
    const args = { isMountedRef: { current: true }, canGenerate: true, hasNotes: true,
      notesText: 'Founder notes', pushFeedback: vi.fn(), setLoadError: vi.fn(),
      setResponses: vi.fn(), trackTelemetry: vi.fn() };
    const hook = renderHook(() => useChiefGeneration(args));
    return { ...hook, args, finish: () => resolve({ content: 'Completed plan', source: 'proxy' }) };
  };

  it('persists a completed generation after navigation without updating the departed page', async () => {
    const test = setup();
    let pending;
    await act(async () => { pending = test.result.current.handleAction('plan'); });
    test.args.isMountedRef.current = false;
    test.unmount();
    test.finish();
    await pending;
    expect(saveChiefOutput).toHaveBeenCalledWith(expect.objectContaining({ content: 'Completed plan' }), expect.any(Object));
    expect(test.args.setResponses).not.toHaveBeenCalled();
  });

  it.each(['account change', 'reset'])('does not save an obsolete generation after %s', async (reason) => {
    const test = setup();
    let pending;
    await act(async () => { pending = test.result.current.handleAction('plan'); });
    if (reason === 'reset') invalidateChiefWorkspace();
    else localStorage.setItem('ceo-os:auth', JSON.stringify({ user: { id: 'other' } }));
    await act(async () => { test.finish(); await pending; });
    expect(saveChiefOutput).not.toHaveBeenCalled();
  });

  it('ignores a second click before the first render commits', async () => {
    const test = setup();
    let pending;
    await act(async () => {
      pending = test.result.current.handleAction('plan');
      void test.result.current.handleAction('plan');
    });
    await act(async () => { test.finish(); await pending; });
    expect(createChiefSession).toHaveBeenCalledTimes(1);
  });
});
