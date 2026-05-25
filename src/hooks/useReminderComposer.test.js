import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReminderComposer } from './useReminderComposer';

const createReminderMock = vi.fn();

vi.mock('../lib/remindersRepository', () => ({
  createReminder: (...args) => createReminderMock(...args),
}));

function submitEvent() {
  return { preventDefault: vi.fn() };
}

describe('useReminderComposer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createReminderMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('warns and does not create a reminder when the draft is blank', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useReminderComposer({ showToast }));

    act(() => {
      result.current.setReminderDraft('   ');
    });
    act(() => {
      result.current.handleAddReminder(submitEvent());
    });

    expect(createReminderMock).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Add reminder text before saving.');
    expect(result.current.isAddingReminder).toBe(false);
  });

  it('creates a reminder, clears the draft, and settles the form after the delay', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useReminderComposer({ showToast }));

    act(() => {
      result.current.setReminderDraft('Email the investor');
    });
    act(() => {
      result.current.handleAddReminder(submitEvent());
    });

    expect(createReminderMock).toHaveBeenCalledWith({ text: 'Email the investor' });
    expect(result.current.reminderDraft).toBe('');
    expect(result.current.isAddingReminder).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isAddingReminder).toBe(false);
  });

  it('ignores a second submit while the first is still settling', () => {
    const { result } = renderHook(() => useReminderComposer({ showToast: vi.fn() }));

    act(() => {
      result.current.setReminderDraft('First');
    });
    act(() => {
      result.current.handleAddReminder(submitEvent());
    });
    act(() => {
      result.current.setReminderDraft('Second');
    });
    act(() => {
      result.current.handleAddReminder(submitEvent());
    });

    expect(createReminderMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a save failure without leaving the form stuck disabled', () => {
    const showToast = vi.fn();
    createReminderMock.mockImplementationOnce(() => {
      throw new Error('storage full');
    });
    const { result } = renderHook(() => useReminderComposer({ showToast }));

    act(() => {
      result.current.setReminderDraft('Risky save');
    });
    act(() => {
      result.current.handleAddReminder(submitEvent());
    });

    expect(showToast).toHaveBeenCalledWith('Unable to save reminder right now.');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isAddingReminder).toBe(false);
  });
});
