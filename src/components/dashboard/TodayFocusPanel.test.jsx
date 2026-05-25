import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TodayFocusPanel from './TodayFocusPanel';

function renderPanel(props) {
  const baseProps = {
    mainFocus: { title: 'x', context: 'y', isEmpty: false },
    nextMove: 'Send one unblock message.',
    nextMoveReason: 'Recommended because: it clears the only thing in the way.',
    safeToIgnoreItems: [],
    onDoThisNext: vi.fn(),
    onOverwhelmed: vi.fn(),
    isFocusDataLoading: false,
  };

  return render(
    <MemoryRouter>
      <TodayFocusPanel {...baseProps} {...props} />
    </MemoryRouter>,
  );
}

describe('TodayFocusPanel (hero)', () => {
  it('renders the focus, the next step, the reason, and the safe-to-ignore fallback', () => {
    renderPanel({
      mainFocus: {
        title: 'Ship onboarding flow',
        context: 'This is already in motion.',
        isEmpty: false,
      },
      nextMove: 'Spend 20 focused minutes on the onboarding copy.',
      nextMoveReason: 'Recommended because: this priority is in motion.',
    });

    expect(screen.getByRole('heading', { level: 2, name: "Today's Focus" })).toBeInTheDocument();
    expect(screen.getByText('Ship onboarding flow')).toBeInTheDocument();
    expect(screen.getByText('This is already in motion.')).toBeInTheDocument();
    expect(screen.getByText('Next step')).toBeInTheDocument();
    expect(screen.getByText('Spend 20 focused minutes on the onboarding copy.')).toBeInTheDocument();
    expect(screen.getByText('Recommended because: this priority is in motion.')).toBeInTheDocument();
    expect(screen.getByText('Nothing else needs attention during this focus block.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tell me what to do next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "I'm overwhelmed" })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /chief of staff/i })).not.toBeInTheDocument();
  });

  it('renders provided safe-to-ignore items', () => {
    renderPanel({ safeToIgnoreItems: ['Inbox triage', 'Slack pings'] });

    expect(screen.getByText('Inbox triage')).toBeInTheDocument();
    expect(screen.getByText('Slack pings')).toBeInTheDocument();
  });

  it('surfaces a Chief-of-Staff link only when the focus is empty', () => {
    renderPanel({
      mainFocus: {
        title: 'Create one calming priority for today',
        context: 'Start with a 10-minute planning pass.',
        isEmpty: true,
      },
    });

    const link = screen.getByRole('link', { name: /chief of staff/i });
    expect(link).toHaveAttribute('href', '/chief-of-staff');
  });

  it('renders an aria-live status while loading focus context', () => {
    renderPanel({ isFocusDataLoading: true });

    expect(screen.getByText(/loading your focus context/i)).toHaveAttribute('role', 'status');
  });
});
