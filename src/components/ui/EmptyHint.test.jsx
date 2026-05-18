import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyHint from './EmptyHint';

describe('EmptyHint', () => {
  it('renders the message inside a polite live region with status role', () => {
    render(<EmptyHint>No items yet</EmptyHint>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('No items yet');
  });

  it('applies the helper-text class by default', () => {
    render(<EmptyHint>No items yet</EmptyHint>);
    expect(screen.getByRole('status')).toHaveClass('helper-text');
  });

  it('composes a page-specific className alongside helper-text without replacing it', () => {
    render(<EmptyHint className="momentum-chart__empty">No data</EmptyHint>);
    const region = screen.getByRole('status');
    expect(region).toHaveClass('helper-text');
    expect(region).toHaveClass('momentum-chart__empty');
  });

  it('renders rich children (links, inline emphasis)', () => {
    render(
      <EmptyHint>
        No items yet. <a href="/start">Add one</a> to begin.
      </EmptyHint>,
    );
    expect(screen.getByRole('link', { name: 'Add one' })).toHaveAttribute('href', '/start');
  });
});
