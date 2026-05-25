import { useCallback, useEffect, useRef, useState } from 'react';
import { createReminder } from '../lib/remindersRepository';

// Short window after a successful save during which the add-reminder form
// stays disabled, so a double-submit (Enter + button click) cannot create
// two reminders before the list re-renders.
const REMINDER_ACTION_SETTLE_DELAY_MS = 160;

// Owns the "add a quick reminder" form state for Focus Home: the draft text,
// the in-flight flag (both as state for the disabled button and as a ref for
// the synchronous double-submit guard), and the settle timer + its cleanup.
export function useReminderComposer({ showToast } = {}) {
  const [reminderDraft, setReminderDraft] = useState('');
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const isAddingReminderRef = useRef(false);
  const releaseTimerRef = useRef(null);

  useEffect(() => () => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }
  }, []);

  const scheduleFormRelease = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }

    releaseTimerRef.current = window.setTimeout(() => {
      isAddingReminderRef.current = false;
      setIsAddingReminder(false);
      releaseTimerRef.current = null;
    }, REMINDER_ACTION_SETTLE_DELAY_MS);
  }, []);

  const handleAddReminder = useCallback((event) => {
    event.preventDefault();
    if (isAddingReminderRef.current) {
      return;
    }

    const nextText = reminderDraft.trim();
    if (!nextText) {
      showToast?.('Add reminder text before saving.');
      return;
    }

    isAddingReminderRef.current = true;
    setIsAddingReminder(true);

    try {
      createReminder({ text: nextText });
      setReminderDraft('');
    } catch {
      showToast?.('Unable to save reminder right now.');
    } finally {
      scheduleFormRelease();
    }
  }, [reminderDraft, scheduleFormRelease, showToast]);

  return {
    reminderDraft,
    setReminderDraft,
    isAddingReminder,
    handleAddReminder,
  };
}
