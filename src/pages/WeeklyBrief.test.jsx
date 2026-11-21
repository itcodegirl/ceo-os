import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WeeklyBrief from './WeeklyBrief';

vi.mock('../hooks/useWeeklyBrief', () => ({
  useWeeklyBrief: vi.fn(),
}));

import { useWeeklyBrief } from '../hooks/useWeeklyBrief';

function createWeeklyState(overrides = {}) {
  return {
    source: 'local',
    isLoading: false,
    loadError: '',
    reviewNotes: 'Review the week.',
    reviewNotesStatus: 'idle',
    priorities: [],
    wins: [],
    blockers: [],
    setReviewNotes: vi.fn(),
    setPriorities: vi.fn(),
    setWins: vi.fn(),
    setBlockers: vi.fn(),
    refreshWeeklyBrief: vi.fn(),
    ...overrides,
  };
}

function renderWeeklyBrief() {
  return render(
    <MemoryRouter>
      <WeeklyBrief />
    </MemoryRouter>,
  );
}

describe('src/pages/WeeklyBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows normal autosave confidence copy when the workspace is healthy', () => {
    useWeeklyBrief.mockReturnValue(createWeeklyState());

    renderWeeklyBrief();

    expect(screen.getByText('Notes are saved automatically for this workspace.')).toBeInTheDocument();
  });

  it('shows paused-autosave copy when weekly persistence has an error', () => {
    useWeeklyBrief.mockReturnValue(createWeeklyState({
      loadError: 'Unable to save weekly review notes right now.',
    }));

    renderWeeklyBrief();

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save weekly review notes right now.');
    expect(screen.getByText('Autosave is paused until the weekly brief saves successfully again.')).toBeInTheDocument();
  });

  it('shows a Saved indicator when reviewNotesStatus is saved', () => {
    useWeeklyBrief.mockReturnValue(createWeeklyState({ reviewNotesStatus: 'saved' }));
    renderWeeklyBrief();
    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });

  it('shows the hook autosave state and stages each keystroke immediately', () => {
    const setReviewNotes = vi.fn();
    useWeeklyBrief.mockReturnValue(createWeeklyState({ setReviewNotes, reviewNotesStatus: 'dirty' }));
    renderWeeklyBrief();
    fireEvent.change(screen.getByLabelText('What actually happened this week?'), { target: { value: 'New thought' } });
    expect(screen.getByText('Saving your reflection…')).toBeInTheDocument();
    expect(setReviewNotes).toHaveBeenCalledWith('New thought');
  });

  it('connects saved priorities and blockers back to Focus Home recommendations', async () => {
    useWeeklyBrief.mockReturnValue(createWeeklyState());

    renderWeeklyBrief();

    fireEvent.click(screen.getByRole('button', { name: 'Add weekly priority' }));
    fireEvent.change(await screen.findByLabelText('Priority'), {
      target: { value: 'Confirm scholarship partner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add weekly blocker' }));
    fireEvent.change(await screen.findByLabelText('Blocker'), {
      target: { value: 'Waiting on curriculum review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getAllByText('This will influence your Focus Home recommendations.')).toHaveLength(2));
  });
});
