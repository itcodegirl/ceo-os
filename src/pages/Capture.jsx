import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/Icon';
import StickyNoteCard from '../components/capture/StickyNoteCard';
import { usePersistentState } from '../hooks/usePersistentState';
import {
  CAPTURE_CATEGORY_OPTIONS,
  CAPTURE_NOTES_UPDATED_EVENT,
  createCaptureNote,
  deleteCaptureNote,
  listCaptureNotes,
  updateCaptureNote,
} from '../lib/captureRepository';
import { buildAutosaveHelperText } from '../lib/uiCopy';
import { useToast } from '../hooks/useToast';
import { useCaptureNotePromotions } from '../hooks/useCaptureNotePromotions';
import '../styles/capture.css';

function formatCategoryLabel(category) {
  if (typeof category !== 'string') {
    return 'Idea';
  }

  const normalized = category.trim().toLowerCase();
  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}

function formatRelativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function Capture() {
  const [notes, setNotes] = useState(() => listCaptureNotes());
  // Composer state survives reloads + navigation so a long brain-dump in
  // progress is never lost. The category remembers the last choice so the
  // user does not have to reselect it for every note.
  const [draftText, setDraftText] = usePersistentState('ceo-os-capture-draft-text', '');
  const [storedCategory, setStoredCategory] = usePersistentState(
    'ceo-os-capture-draft-category',
    CAPTURE_CATEGORY_OPTIONS[0],
  );
  const draftCategory = CAPTURE_CATEGORY_OPTIONS.includes(storedCategory)
    ? storedCategory
    : CAPTURE_CATEGORY_OPTIONS[0];
  const setDraftCategory = setStoredCategory;
  const [errorMessage, setErrorMessage] = useState('');
  const [showPromotedNotes, setShowPromotedNotes] = useState(false);
  const composerTextareaRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    const handleCaptureUpdate = () => {
      setNotes(listCaptureNotes());
    };

    window.addEventListener(CAPTURE_NOTES_UPDATED_EVENT, handleCaptureUpdate);
    return () => {
      window.removeEventListener(CAPTURE_NOTES_UPDATED_EVENT, handleCaptureUpdate);
    };
  }, []);

  const sortedNotes = useMemo(() => {
    // Coerce missing/invalid updatedAt to 0 so older or partially-normalized
    // notes sort to the bottom rather than producing NaN comparisons (which
    // give an implementation-defined order and silently corrupt the wall).
    const toMillis = (value) => {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return [...notes].sort((left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt));
  }, [notes]);
  // Stickies that have already been promoted to a reminder/opportunity/content
  // draft are hidden by default so the wall stays a brain-dump space rather
  // than a graveyard. Toggle reveals them with a small "promoted to X" tag.
  // Combined into a single useMemo so both derived values share one pass and
  // don't recompute on unrelated renders (composer textarea keystrokes, etc.).
  const { promotedNotesCount, visibleNotes } = useMemo(() => {
    let promoted = 0;
    const visible = [];
    for (const note of sortedNotes) {
      if (note.promotedTo) {
        promoted += 1;
        if (showPromotedNotes) {
          visible.push(note);
        }
      } else {
        visible.push(note);
      }
    }
    return { promotedNotesCount: promoted, visibleNotes: visible };
  }, [sortedNotes, showPromotedNotes]);
  const captureSaveHelper = buildAutosaveHelperText({
    hasError: Boolean(errorMessage),
    healthyText: 'Auto-saved locally and ready whenever your brain moves fast.',
    pausedText: 'Autosave is paused until sticky notes save successfully again.',
  });
  const captureComposerDescriptionId = [
    'capture-composer-helper',
    errorMessage ? 'capture-composer-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const clearComposerError = () => {
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleDraftTextChange = (event) => {
    clearComposerError();
    setDraftText(event.target.value);
  };

  const handleDraftCategoryChange = (event) => {
    clearComposerError();
    setDraftCategory(event.target.value);
  };

  const createNote = (event) => {
    event.preventDefault();
    const text = draftText.trim();
    if (!text) {
      setErrorMessage('Add a quick note before saving.');
      composerTextareaRef.current?.focus?.();
      return;
    }

    try {
      createCaptureNote({
        text,
        category: draftCategory,
      });
      setDraftText('');
      // Keep draftCategory as the last-used selection so the user does not
      // have to reselect it for the next note.
      setErrorMessage('');
    } catch {
      // Reassure the user that the composer text is still in the field so
      // they can retry without retyping. The composer mirrors to localStorage
      // through usePersistentState, so the draft survives reloads too.
      setErrorMessage('Couldn’t save this note. Your text is still in the composer — try again in a moment.');
      composerTextareaRef.current?.focus?.();
    }
  };

  const updateNote = (id, payload) => {
    try {
      updateCaptureNote(id, payload);
      setErrorMessage('');
    } catch {
      setErrorMessage('Couldn’t update this note. Your last edit is still visible — try again in a moment.');
    }
  };

  const removeNote = (id) => {
    try {
      deleteCaptureNote(id);
      setErrorMessage('');
    } catch {
      setErrorMessage('Couldn’t delete this note. Nothing was changed — try again in a moment.');
    }
  };

  const {
    promoteToReminder: promoteNoteToReminder,
    promoteToOpportunity: promoteNoteToOpportunity,
    promoteToContentDraft: promoteNoteToContentDraft,
  } = useCaptureNotePromotions({ notes, showToast });

  return (
    <section className="capture-page">
      <PageHeader
        title="Capture"
        description="Fast sticky-note style capture for ideas, tasks, opportunities, content drafts, and private thoughts."
      />

      <section className="capture-composer focus-panel" aria-label="Create a capture note">
        <h2>Brain Dump</h2>
        <p className="supportive-copy">
          Drop the thought here. Keep it messy now, organize later.
        </p>
        <p className="helper-text capture-composer__local-only-notice">
          Stays on this device. Promote a note when you want it in your synced workspace.
        </p>
        <form onSubmit={createNote} className="capture-composer__form">
          <label htmlFor="capture-note-text" className="helper-text">Note</label>
          <p id="capture-composer-helper" className="sr-only">
            Capture one thought, task, or idea at a time.
          </p>
          <textarea
            ref={composerTextareaRef}
            id="capture-note-text"
            value={draftText}
            onChange={handleDraftTextChange}
            rows={3}
            placeholder="What do you want to remember?"
            aria-describedby={captureComposerDescriptionId}
            aria-invalid={errorMessage ? 'true' : undefined}
          />

          <label htmlFor="capture-note-category" className="helper-text">Category</label>
          <select
            id="capture-note-category"
            value={draftCategory}
            onChange={handleDraftCategoryChange}
          >
            {CAPTURE_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatCategoryLabel(option)}
              </option>
            ))}
          </select>

          <div className="capture-composer__actions">
            <Button type="submit" icon={{ name: 'add' }}>
              Save sticky note
            </Button>
          </div>
        </form>
        {errorMessage ? (
          <p id="capture-composer-error" role="alert" className="form-error">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="capture-wall" aria-label="Sticky note wall">
        <header className="capture-wall__header">
          <h2>Sticky Notes</h2>
          <p className="helper-text" role="status" aria-live="polite">{captureSaveHelper}</p>
        </header>
        {promotedNotesCount > 0 ? (
          <button
            type="button"
            className="capture-wall__toggle-promoted"
            aria-pressed={showPromotedNotes}
            onClick={() => setShowPromotedNotes((prev) => !prev)}
          >
            {showPromotedNotes
              ? `Hide ${promotedNotesCount} promoted`
              : `Show ${promotedNotesCount} promoted`}
          </button>
        ) : null}
        {visibleNotes.length ? (
          <div className="sticky-wall">
            {visibleNotes.map((note) => (
              <StickyNoteCard
                key={note.id}
                note={note}
                categoryOptions={CAPTURE_CATEGORY_OPTIONS}
                formatCategoryLabel={formatCategoryLabel}
                formatRelativeDate={formatRelativeDate}
                onEdit={updateNote}
                onPromoteToReminder={promoteNoteToReminder}
                onPromoteToOpportunity={promoteNoteToOpportunity}
                onPromoteToContentDraft={promoteNoteToContentDraft}
                onDelete={removeNote}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Icon name="capture" size={20} />}
            title="No sticky notes yet"
            description="Drop the first thing rattling around — an idea, a task, a worry. Keep it messy now; sort it later."
          />
        )}
      </section>
    </section>
  );
}

export default Capture;
