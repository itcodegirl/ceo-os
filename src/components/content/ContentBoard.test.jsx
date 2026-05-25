import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentBoard from './ContentBoard';

function makeItems() {
  return [
    { id: 'p1', title: 'Shipped essay', platform: 'LinkedIn', contentType: 'Post', status: 'Published', scheduledFor: '2026-05-01' },
    { id: 'p2', title: 'Idea seed', platform: 'Blog', contentType: 'Article', status: 'Idea', scheduledFor: '' },
    { id: 'p3', title: 'Launch post', platform: 'LinkedIn', contentType: 'Post', status: 'Scheduled', scheduledFor: '2026-05-20' },
    { id: 'p4', title: 'Newsletter draft', platform: 'Newsletter', contentType: 'Newsletter', status: 'Drafting', scheduledFor: '' },
    { id: 'p5', title: 'Sooner launch post', platform: 'X', contentType: 'Post', status: 'Scheduled', scheduledFor: '2026-05-14' },
  ];
}

function rowTitles() {
  const table = screen.getByRole('table', { name: 'Content pipeline' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('rowheader').textContent);
}

describe('ContentBoard', () => {
  it('sorts rows by lifecycle stage, then by soonest publish date', () => {
    render(<ContentBoard items={makeItems()} onOpenItem={vi.fn()} />);

    const titles = rowTitles();
    // Idea → Drafting → Scheduled(May 14) → Scheduled(May 20) → Published
    expect(titles[0]).toContain('Idea seed');
    expect(titles[1]).toContain('Newsletter draft');
    expect(titles[2]).toContain('Sooner launch post');
    expect(titles[3]).toContain('Launch post');
    expect(titles[4]).toContain('Shipped essay');
  });

  it('filters the table to a single stage and back to all', () => {
    render(<ContentBoard items={makeItems()} onOpenItem={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Scheduled/ }));

    const scheduledTitles = rowTitles();
    expect(scheduledTitles).toHaveLength(2);
    expect(scheduledTitles.join(' ')).toContain('Sooner launch post');
    expect(scheduledTitles.join(' ')).toContain('Launch post');
    expect(scheduledTitles.join(' ')).not.toContain('Idea seed');

    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(rowTitles()).toHaveLength(5);
  });

  it('hides the filter bar when only one stage has content', () => {
    render(
      <ContentBoard
        items={[{ id: 'a', title: 'Only draft', platform: 'Blog', contentType: 'Post', status: 'Drafting', scheduledFor: '' }]}
        onOpenItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Filter content by stage' })).not.toBeInTheDocument();
  });
});
