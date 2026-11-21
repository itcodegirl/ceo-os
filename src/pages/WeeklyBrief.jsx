import Button from '../components/ui/Button';
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

function describeReviewNotesStatus({ status, hasPending, hasError }) {
  if (hasError) {
    return { tone: 'error', text: 'Couldn’t save your reflection. Your draft is kept here; retry to save it.' };
  }
  if (hasPending || status === 'dirty' || status === 'saving') {
    return { tone: 'saving', text: 'Saving your reflection…' };
  }
  if (status === 'saved') {
    return { tone: 'saved', text: 'Saved.' };
  }
  return { tone: 'idle', text: 'Notes are saved automatically for this workspace.' };
}

function WeeklyBrief() {
  const {
    weekStart,
    source,
    isLoading,
    loadError,
    reviewNotes,
    reviewNotesStatus,
    retryReviewNotes,
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

  const reviewNotesStatusDescriptor = describeReviewNotesStatus({
    status: reviewNotesStatus,

    hasError: reviewNotesStatus === 'error',
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

      <div className="weekly-grid">
        <SectionCard title="Look back" iconName="weekly">
          <Textarea
            id="weekly-review-notes"
            label="What actually happened this week?"
            className="form-field weekly-review-notes__field"
            labelClassName="form-field__label"
            controlClassName="weekly-review-notes__control"
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
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
          {reviewNotesStatus === 'error' ? (
            <Button type="button" onClick={retryReviewNotes}>Retry saving reflection</Button>
          ) : <p className="helper-text" aria-live="polite">{reviewNotesHelper}</p>}
        </SectionCard>

        <WinsSection key={`${weekStart}-WinsSection`}
          items={winItems}
          setItems={setWins}
          defaultItems={defaultWins}
        />

        <BlockersSection key={`${weekStart}-BlockersSection`}
          items={blockerItems}
          setItems={setBlockers}
          defaultItems={defaultBlockers}
        />

        <PrioritiesSection key={`${weekStart}-PrioritiesSection`}
          items={priorityItems}
          setItems={setPriorities}
          defaultItems={defaultPriorities}
        />
      </div>

      <WeeklyBriefSummary
        priorities={priorityItems}
        wins={winItems}
        blockers={blockerItems}
        reviewNotes={reviewNotes}
      />
    </section>
  );
}

export default WeeklyBrief;
