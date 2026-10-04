import { useCallback, useState } from 'react';
import { listReminders, REMINDERS_UPDATED_EVENT } from '../lib/remindersRepository';
import { useSilentRefresh } from './useSilentRefresh';

const REMINDER_EVENTS = [REMINDERS_UPDATED_EVENT];
const REMINDER_STORAGE_KEYS = ['ceo-os-reminders'];

/** Every reminder (newest first), refreshed on changes, syncs, and other tabs. */
export function useReminders() {
  const [reminders, setReminders] = useState(listReminders);
  const refresh = useCallback(() => setReminders(listReminders()), []);

  useSilentRefresh({
    events: REMINDER_EVENTS,
    storageKeys: REMINDER_STORAGE_KEYS,
    onRefresh: refresh,
    coalesceMs: 0,
  });

  return reminders;
}

export default useReminders;
