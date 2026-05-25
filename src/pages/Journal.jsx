import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import {
  getJournalEntryByDate,
  getTodayJournalDateKey,
  JOURNAL_ENTRIES_UPDATED_EVENT,
  JOURNAL_PROMPTS,
  saveJournalEntry,
} from '../lib/journalRepository';
import { createReminder } from '../lib/remindersRepository';
import { useToast } from '../hooks/useToast';
import { buildAutosaveHelperText } from '../lib/uiCopy';
import '../styles/journal.css';

const SAVE_DEBOUNCE_MS = 600;

function formatSavedAt(value) {
  if (!value) {
    return 'Not saved yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Saved';
  }

  return `Auto-saved ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)}`;
}

function describeSaveStatus({ status, hasError }) {
  if (hasError || status === 'error') {
    return { tone: 'error', text: 'Couldn’t save your reflection. We’ll keep trying.' };
  }
  if (status === 'pending' || status === 'saving') {
    return { tone: 'saving', text: 'Saving your reflection…' };
  }
  if (status === 'saved') {
    return { tone: 'saved', text: 'Saved.' };
  }
  return { tone: 'idle', text: '' };
}

function Journal() {
  const [dateKey, setDateKey] = useState(() => getTodayJournalDateKey());
  const [entry, setEntry] = useState(() => getJournalEntryByDate(getTodayJournalDateKey()));
  const [lastSavedAt, setLastSavedAt] = useState(entry.updatedAt);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  // Tracks the latest entry value synchronously so the debounced save
  // and date-change flush can read the truth without depending on a
  // setState updater (which Strict Mode runs twice in dev).
  const entryRef = useRef(entry);
  const dateKeyRef = useRef(dateKey);
  const debounceTimerRef = useRef(null);

  // Centralized persistence so date changes and unmount can flush a
  // pending debounce window without re-implementing the save call.
  const persistPending = useCallback(() => {
    const pendingDateKey = dateKeyRef.current;
    const pendingEntry = entryRef.current;
    if (!pendingDateKey || !pendingEntry) {
      return;
    }
    setSaveStatus('saving');
    try {
      const persisted = saveJournalEntry({
        dateKey: pendingDateKey,
        entry: pendingEntry,
      });
      setLastSavedAt(persisted.updatedAt);
      setSaveStatus('saved');
      setErrorMessage('');
    } catch {
      // The entry stays in `entryRef.current` and the rendered <textarea>s
      // so the user's latest changes are still on screen even though
      // persistence failed. The copy reflects that explicitly.
      setErrorMessage('Couldn’t auto-save your journal entry. Your latest changes are still in the form — try again in a moment.');
      setSaveStatus('error');
    }
  }, []);

  const cancelPendingSave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current === null) {
      return;
    }
    cancelPendingSave();
    persistPending();
  }, [cancelPendingSave, persistPending]);

  useEffect(() => {
    const handleJournalUpdate = (event) => {
      const updatedDateKey = event?.detail?.dateKey;
      if (updatedDateKey && updatedDateKey !== dateKey) {
        return;
      }

      const nextEntry = getJournalEntryByDate(dateKey);
      entryRef.current = nextEntry;
      setEntry(nextEntry);
      setLastSavedAt(nextEntry.updatedAt);
    };

    window.addEventListener(JOURNAL_ENTRIES_UPDATED_EVENT, handleJournalUpdate);
    return () => {
      window.removeEventListener(JOURNAL_ENTRIES_UPDATED_EVENT, handleJournalUpdate);
    };
  }, [dateKey]);

  // Flush any pending edits when the user navigates away or the tab hides
  // so a brief reflection isn't silently dropped.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave();
      }
    };

    window.addEventListener('beforeunload', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushPendingSave]);

  // Cancel any pending timer on unmount; a flush still happens via the
  // beforeunload listener so we don't double-write here.
  useEffect(() => () => {
    cancelPendingSave();
  }, [cancelPendingSave]);

  const savedAtLabel = useMemo(() => formatSavedAt(lastSavedAt), [lastSavedAt]);
  const journalSaveStatus = buildAutosaveHelperText({
    hasError: Boolean(errorMessage),
    healthyText: savedAtLabel,
    pausedText: 'Autosave is paused. Your latest journal changes are not saved yet.',
  });
  const inlineStatus = describeSaveStatus({ status: saveStatus, hasError: Boolean(errorMessage) });
  const isEntryEmpty = useMemo(
    () => JOURNAL_PROMPTS.every((prompt) => !(entry[prompt.id] || '').trim()),
    [entry],
  );

  const handleDateChange = (nextDateKey) => {
    // Flush any in-flight debounce before swapping the active entry so we
    // never overwrite a different day's entry with a newer day's draft.
    flushPendingSave();
    setDateKey(nextDateKey);
    dateKeyRef.current = nextDateKey;
    const nextEntry = getJournalEntryByDate(nextDateKey);
    entryRef.current = nextEntry;
    setEntry(nextEntry);
    setLastSavedAt(nextEntry.updatedAt);
    setSaveStatus('idle');
    setErrorMessage('');
  };

  const handleMakeReminderFromNextThing = () => {
    const text = (entryRef.current?.oneNextThing || '').trim();
    if (!text) {
      showToast('Write your one next thing first.');
      return;
    }
    try {
      createReminder({ text });
      showToast('Reminder created from your journal next-thing.');
    } catch {
      showToast('Unable to create a reminder right now.');
    }
  };

  const updateField = (fieldId, value) => {
    // Compute the next entry once, in plain code, before calling setEntry.
    // This keeps the persistence side effect out of the state updater so
    // Strict Mode's double-invocation cannot trigger duplicate writes.
    const nextEntry = { ...entryRef.current, [fieldId]: value };
    entryRef.current = nextEntry;
    setEntry(nextEntry);
    setSaveStatus('pending');

    cancelPendingSave();
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      persistPending();
    }, SAVE_DEBOUNCE_MS);
  };

  return (
    <section className="journal-page">
      <PageHeader
        title="Journal"
        description="A calm, private space for low-pressure reflection and one clear next step."
      />

      <section className="journal-panel focus-panel" aria-label="Daily journal prompts">
        <header className="journal-panel__header">
          <div>
            <h2>Daily Reflection</h2>
            <p className="supportive-copy">
              No perfect writing needed. A few honest lines are enough.
            </p>
            <p className="helper-text journal-panel__local-only-notice">
              Private to this device — never synced.
            </p>
          </div>
          <label className="journal-panel__date">
            <span className="helper-text">Journal date</span>
            <input
              type="date"
              value={dateKey}
              onChange={(event) => handleDateChange(event.target.value)}
              aria-label="Journal date"
            />
          </label>
        </header>

        <p className="helper-text" role="status" aria-live="polite">{journalSaveStatus}</p>
        {inlineStatus.tone !== 'idle' ? (
          <p
            className={`helper-text journal-save-status journal-save-status--${inlineStatus.tone}`}
            aria-live="polite"
            data-status={inlineStatus.tone}
          >
            {inlineStatus.text}
          </p>
        ) : null}
        {errorMessage ? <p role="alert" className="form-error">{errorMessage}</p> : null}
        {isEntryEmpty ? (
          <p className="helper-text">Start with one sentence. Small reflections count.</p>
        ) : null}

        <div className="journal-prompts">
          {JOURNAL_PROMPTS.map((prompt) => {
            const isNextThingPrompt = prompt.id === 'oneNextThing';
            const hasNextThingText = isNextThingPrompt && (entry.oneNextThing || '').trim().length > 0;
            return (
              <label key={prompt.id} className="journal-prompts__item" htmlFor={`journal-${prompt.id}`}>
                <span>{prompt.label}</span>
                <textarea
                  id={`journal-${prompt.id}`}
                  rows={4}
                  value={entry[prompt.id] || ''}
                  onChange={(event) => updateField(prompt.id, event.target.value)}
                  onBlur={flushPendingSave}
                />
                {isNextThingPrompt ? (
                  <button
                    type="button"
                    className="journal-prompts__action"
                    onClick={handleMakeReminderFromNextThing}
                    disabled={!hasNextThingText}
                  >
                    Make a reminder from this
                  </button>
                ) : null}
              </label>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default Journal;
