import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NeedsAttentionPanel from './NeedsAttentionPanel';

const baseOpenLoops = {
  headline: 'Three loops are still open today.',
  items: [
    { id: 'loops-priorities', count: 2, label: 'priorities in motion' },
    { id: 'loops-content', count: 1, label: 'content draft to ship' },
  ],
  suggestedLoop: 'Send the recap to the Acme thread.',
  canWait: 'The rest can wait until this focus block ends.',
};

describe('NeedsAttentionPanel', () => {
  it('renders blockers (tagged), open-loop counts, the suggested loop, and helper text', () => {
    render(
      <NeedsAttentionPanel
        blockerItems={['Acme legal review', 'Hiring contract draft']}
        hasBlockers
        openLoops={baseOpenLoops}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Needs Your Attention' })).toBeInTheDocument();
    expect(screen.getByText('Three loops are still open today.')).toBeInTheDocument();
    expect(screen.getByText('Acme legal review')).toBeInTheDocument();
    expect(screen.getByText('Hiring contract draft')).toBeInTheDocument();
    expect(screen.getAllByText('Blocker')).toHaveLength(2);
    expect(screen.getByText('priorities in motion')).toBeInTheDocument();
    expect(screen.getByText('Send the recap to the Acme thread.')).toBeInTheDocument();
    expect(screen.getByText('The rest can wait until this focus block ends.')).toBeInTheDocument();
  });

  it('shows a calm fallback line and omits the loop counts when nothing is stuck', () => {
    render(
      <NeedsAttentionPanel
        blockerItems={['No blockers logged. Keep protecting this focus window.']}
        hasBlockers={false}
        openLoops={{
          headline: 'No open loops need action right now.',
          items: [],
          suggestedLoop: 'Take five.',
          canWait: 'You earned the calm.',
        }}
      />,
    );

    expect(screen.getByText('No blockers logged. Keep protecting this focus window.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open loops summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocker')).not.toBeInTheDocument();
  });
});
