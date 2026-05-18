import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageLoading from './PageLoading';

describe('PageLoading', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(<PageLoading visible={false} label="Loading anything" />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes a polite live region with status role so screen readers announce the load', () => {
    render(<PageLoading visible label="Loading settings" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading settings...');
  });

  it('uses sr-only styling when the variant is sr-only so a visible skeleton carries the visual load state', () => {
    render(<PageLoading visible label="Loading weekly brief" variant="sr-only" />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('sr-only');
    expect(status).not.toHaveClass('helper-text');
  });

  it('does not append an ellipsis when the label already ends with punctuation', () => {
    render(<PageLoading visible label="Working on it." />);
    expect(screen.getByRole('status')).toHaveTextContent('Working on it.');
  });

  it('defaults to a generic label so callers do not have to pass one', () => {
    render(<PageLoading visible />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });
});
