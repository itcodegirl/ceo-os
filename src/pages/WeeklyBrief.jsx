import { useEffect, useRef, useState } from 'react';
import SectionCard from '../components/ui/SectionCard';
import PageHeader from '../components/ui/PageHeader';
import SummaryCards from '../components/ui/SummaryCards';
import SourceStatusNotice from '../components/ui/SourceStatusNotice';
import PageLoading from '../components/ui/PageLoading';
import PrioritiesSection from '../components/weekly/PrioritiesSection';
import WinsSection from '../components/weekly/WinsSection';
import BlockersSection from '../components/weekly/BlockersSection';
import WeeklyBriefSummary from '../components/weekly/WeeklyBriefSummary';
import Textarea from '../components/ui/Textarea';
import {
  defaultBlockers,
  defaultPriorities,
  defaultWins,
} from '../lib/weeklyData';
import { useWeeklyBrief } from '../hooks/useWeeklyBrief';
import { buildAutosaveHelperText, buildSourceNotice } from '../lib/uiCopy';
import '../styles/forms.css';
import '../styles/weekly.css';

const REVIEW_NOTES_DEBOUNCE_MS = 600;

function describeReviewNotesStatus({ status, hasPending, hasError }) {
  if (hasError) {
    return { tone: 'error', text: 'Couldn’t save your reflection. We’ll keep trying.' };
  }
  if (hasPending || status === 'saving') {
    return { tone: 'saving', text: 'Saving your reflection…' };
  }
  if (status === 'saved') {
    return { tone: 'saved', text: 'Saved.' };
  }
  return { tone: 'idle', text: 'Notes are saved automatically for this workspace.' };
}

function WeeklyBrief() {
  const {
    source,
    isLoading,
    loadError,
    reviewNotes,
    reviewNotesStatus,
    priorities,
    wins,
    blockers,
    setReviewNotes,
    setPriorities,
    setWins,
    setBlockers,
    refreshWeeklyBrief,
  } = useWeeklyBrief();

  const priorityItems = Array.isArray(priorities) ? priorities : defaultPriorities;
  const winItems = Array.isArray(wins) ? wins : defaultWins;
  const blockerItems = Array.isArray(blockers) ? blockers : defaultBlockers;
  const reviewNotesHelper = buildAutosaveHelperText({
    hasError: Boolean(loadError),
    healthyText: 'Notes are saved automatically for this workspace.',
    pausedText: 'Autosave is paused until the weekly brief saves successfully again.',
  });

  // Debounced review-notes autosave. Local draft mirrors the input synchronously
  // so typing stays instant; commits to the hook fire 600ms after the last keystroke.
  const [reviewNotesDraft, setReviewNotesDraft] = useState(reviewNotes);
  const draftRef = useRef(reviewNotes);
  const debounceTimerRef = useRef(null);
  const [hasPendingSave, setHasPendingSave] = useState(false);

  useEffect(() => {
    if (reviewNotesStatus !== 'saving' && reviewNotes !== draftRef.current) {
      draftRef.current = reviewNotes;
      setReviewNotesDraft(reviewNotes);
    }
  }, [reviewNotes, reviewNotesStatus]);

  useEffect(() => () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const handleReviewNotesChange = (event) => {
    const value = event.target.value;
    draftRef.current = value;
    setReviewNotesDraft(value);
    setHasPendingSave(true);
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      setHasPendingSave(false);
      setReviewNotes(draftRef.current);
    }, REVIEW_NOTES_DEBOUNCE_MS);
  };

  const reviewNotesStatusDescriptor = describeReviewNotesStatus({
    status: reviewNotesStatus,
    hasPending: hasPendingSave,
    hasError: Boolean(loadError) || reviewNotesStatus === 'error',
  });

  return (
    <section className="weekly-page">
      <PageHeader
        title="Weekly Brief"
        description="Review last week, name 1–3 priorities for this one, then close it out with a short reflection."
      />

      <SourceStatusNotice
        source={source}
        supabaseText={buildSourceNotice('supabase', { supabasePrefix: '' })}
        localText={buildSourceNotice('local')}
        loadError={loadError}
        onRetry={refreshWeeklyBrief}
        retryAriaLabel="Retry loading weekly brief"
      />
      <PageLoading visible={isLoading} label="Loading weekly brief" variant="sr-only" />

      <SummaryCards
        className="weekly-overview"
        isLoading={isLoading}
        cards={[
          {
            id: 'weekly-priorities',
            label: 'Active Priorities',
            // Show '—' instead of a literal 0 when the load failed — the
            // user could have priorities we couldn't fetch, and a numeric 0
            // next to a "couldn't load" notice reads as a contradiction.
            value: loadError ? '—' : priorityItems.length,
            description: 'Priorities currently scheduled across roles, content, and partnerships.',
          },
          {
            id: 'weekly-wins',
            label: 'Wins This Week',
            value: loadError ? '—' : winItems.length,
            description: 'Progress markers you can cite in a status update.',
          },
          {
            id: 'weekly-blockers',
            label: 'Open Blockers',
            value: loadError ? '—' : blockerItems.length,
            description: 'Risks that need active follow-up.',
          },
        ]}
      />

      <p className="helper-text weekly-brief__intent">
        What you log here shapes the next-move recommendations on Focus Home.
      </p>

      <WeeklyBriefSummary
        priorities={priorityItems}
        wins={winItems}
        blockers={blockerItems}
        reviewNotes={reviewNotesDraft}
      />

      <div className="weekly-grid">
        <SectionCard title="Look back" iconName="weekly">
          <Textarea
            id="weekly-review-notes"
            label="What actually happened this week?"
            className="form-field weekly-review-notes__field"
            labelClassName="form-field__label"
            controlClassName="weekly-review-notes__control"
            value={reviewNotesDraft}
            onChange={handleReviewNotesChange}
            rows={5}
            placeholder="Two or three honest sentences: what moved, what stalled, what surprised you. No need to make it tidy."
          />
          {reviewNotesStatusDescriptor.tone !== 'idle' ? (
            <p
              className={`helper-text weekly-review-notes__status weekly-review-notes__status--${reviewNotesStatusDescriptor.tone}`}
              aria-live="polite"
              data-status={reviewNotesStatusDescriptor.tone}
            >
              <span aria-hidden="true" className="weekly-review-notes__status-dot" />
              {reviewNotesStatusDescriptor.text}
            </p>
          ) : null}
          <p className="helper-text" aria-live="polite">{reviewNotesHelper}</p>
        </SectionCard>

        <WinsSection
          items={winItems}
          setItems={setWins}
          defaultItems={defaultWins}
        />

        <BlockersSection
          items={blockerItems}
          setItems={setBlockers}
          defaultItems={defaultBlockers}
        />

        <PrioritiesSection
          items={priorityItems}
          setItems={setPriorities}
          defaultItems={defaultPriorities}
        />
      </div>

      <WeeklyBriefSummary
        priorities={priorityItems}
        wins={winItems}
        blockers={blockerItems}
        reviewNotes={reviewNotesDraft}
      />
    </section>
  );
}

export default WeeklyBrief;
