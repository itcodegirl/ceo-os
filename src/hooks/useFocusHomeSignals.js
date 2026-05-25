import { useCallback, useState } from 'react';
import { CAPTURE_NOTES_UPDATED_EVENT, listCaptureNotes } from '../lib/captureRepository';
import {
  JOURNAL_ENTRIES_UPDATED_EVENT,
  getJournalEntryByDate,
  getTodayJournalDateKey,
} from '../lib/journalRepository';
import { REMINDERS_UPDATED_EVENT, listReminders } from '../lib/remindersRepository';
import { shallowEqualRecordArrays, shallowEqualRecords } from '../lib/stateUtils';
import { useSilentRefresh } from './useSilentRefresh';

// Module-scope constants keep useSilentRefresh's subscription deps stable.
const FOCUS_HOME_SIGNAL_EVENTS = [
  CAPTURE_NOTES_UPDATED_EVENT,
  JOURNAL_ENTRIES_UPDATED_EVENT,
  REMINDERS_UPDATED_EVENT,
];
const FOCUS_HOME_SIGNAL_STORAGE_KEYS = [
  'ceo-os-capture-notes',
  'ceo-os-journal-entries',
  'ceo-os-reminders',
];

export function useFocusHomeSignals() {
  const [captureNotes, setCaptureNotes] = useState(() => listCaptureNotes());
  const [journalEntry, setJournalEntry] = useState(() => getJournalEntryByDate(getTodayJournalDateKey()));
  const [reminders, setReminders] = useState(() => listReminders());

  // Reference-stable updaters: skip setState when the next value is
  // shallowly equal to the current one. Without this, every focus /
  // visibility / storage event swaps to a fresh array reference, which
  // invalidates Dashboard's derived memos (nextMoveQueue, suggestions,
  // mainFocus) on every tab switch even when nothing changed.
  const syncCaptureNotes = useCallback(() => {
    setCaptureNotes((current) => {
      const next = listCaptureNotes();
      return shallowEqualRecordArrays(current, next) ? current : next;
    });
  }, []);

  const syncJournalEntry = useCallback(() => {
    setJournalEntry((current) => {
      const next = getJournalEntryByDate(getTodayJournalDateKey());
      return shallowEqualRecords(current, next) ? current : next;
    });
  }, []);

  const syncReminders = useCallback(() => {
    setReminders((current) => {
      const next = listReminders();
      return shallowEqualRecordArrays(current, next) ? current : next;
    });
  }, []);

  const syncAllSignals = useCallback(() => {
    syncCaptureNotes();
    syncJournalEntry();
    syncReminders();
  }, [syncCaptureNotes, syncJournalEntry, syncReminders]);

  // Shared subscription manager (replaces four hand-rolled listeners): refresh
  // all three signals on any capture/journal/reminder event, on a watched
  // storage key changing in another tab, or on focus/visibility. A single
  // event now re-reads all three sources rather than one, but the shallowEqual
  // guards above make that free of spurious re-renders. coalesceMs:0 preserves
  // the previous fire-on-every-event timing (the signals are cheap to read).
  useSilentRefresh({
    events: FOCUS_HOME_SIGNAL_EVENTS,
    storageKeys: FOCUS_HOME_SIGNAL_STORAGE_KEYS,
    onRefresh: syncAllSignals,
    coalesceMs: 0,
  });

  return {
    captureNotes,
    journalEntry,
    reminders,
  };
}

export default useFocusHomeSignals;
