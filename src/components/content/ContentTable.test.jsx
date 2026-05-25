import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentTable from './ContentTable';

describe('ContentTable', () => {
  it('renders a semantic table for content items', () => {
    const items = [
      { id: 'c-1', title: 'Post draft', platform: 'LinkedIn', status: 'Drafting' },
    ];
    const { getByRole, getAllByRole } = render(
      <ContentTable items={items} />,
    );

    const table = getByRole('table', { name: 'Content pipeline' });
    const rows = getAllByRole('row');

    expect(table).toBeTruthy();
    expect(rows).toHaveLength(2);
    expect(table).toHaveTextContent('Post draft');
  });

  it('renders content type and publish-date columns', () => {
    const items = [
      {
        id: 'c-a',
        title: 'Launch story',
        platform: 'Newsletter',
        contentType: 'Article',
        status: 'Scheduled',
        scheduledFor: '2026-05-14',
      },
      {
        id: 'c-b',
        title: 'Idea seed',
        platform: 'Blog',
        contentType: 'Post',
        status: 'Idea',
        scheduledFor: '',
      },
    ];

    const { getByText } = render(<ContentTable items={items} />);

    expect(getByText('Article')).toBeInTheDocument();
    expect(getByText('May 14, 2026')).toBeInTheDocument();
    expect(getByText('Not scheduled')).toBeInTheDocument();
  });

  it('supports row click and semantic button activation when handler is provided', () => {
    const onOpenItem = vi.fn();
    const items = [
      { id: 'c-2', title: 'Weekly update', platform: 'Blog', status: 'Scheduled' },
    ];

    const { getAllByRole, getByText } = render(
      <ContentTable items={items} onOpenItem={onOpenItem} />,
    );

    const rows = getAllByRole('row');
    const contentRow = rows[1];
    const openButton = getAllByRole('button', { name: /Open/i })[0];

    expect(getByText('Click any row or press Enter/Space to open the piece.')).toBeInTheDocument();

    fireEvent.click(contentRow);
    expect(onOpenItem).toHaveBeenCalledWith(items[0]);

    fireEvent.click(openButton);
    expect(onOpenItem).toHaveBeenCalledTimes(2);
  });

  it('supports row keyboard activation with Enter and Space', () => {
    const onOpenItem = vi.fn();
    const item = {
      id: 'c-3',
      title: 'Founder memo',
      platform: 'Newsletter',
      status: 'Drafting',
    };

    const { getAllByRole } = render(
      <ContentTable items={[item]} onOpenItem={onOpenItem} />,
    );

    const rows = getAllByRole('row');
    const interactiveRow = rows[1];

    fireEvent.keyDown(interactiveRow, { key: 'Enter' });
    fireEvent.keyDown(interactiveRow, { key: ' ' });

    expect(onOpenItem).toHaveBeenCalledTimes(2);
    expect(onOpenItem).toHaveBeenNthCalledWith(1, item);
    expect(onOpenItem).toHaveBeenNthCalledWith(2, item);
  });

  it('ignores row keyboard handler when keydown originates from open button', () => {
    const onOpenItem = vi.fn();
    const item = {
      id: 'c-4',
      title: 'Q2 reflection',
      platform: 'LinkedIn',
      status: 'Drafting',
    };

    const { getAllByRole } = render(
      <ContentTable items={[item]} onOpenItem={onOpenItem} />,
    );

    const openButton = getAllByRole('button', { name: /Open/i })[0];

    fireEvent.keyDown(openButton, { key: 'Enter' });

    expect(onOpenItem).toHaveBeenCalledTimes(0);

    fireEvent.click(openButton);

    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith(item);
  });

  it('keeps interaction behavior stable with larger datasets', () => {
    const onOpenItem = vi.fn();
    const items = Array.from({ length: 200 }, (_, index) => ({
      id: `c-${index + 1}`,
      title: `Content Item ${index + 1}`,
      platform: 'LinkedIn',
      status: index % 2 === 0 ? 'Drafting' : 'Scheduled',
    }));

    const { getAllByRole, container } = render(
      <ContentTable items={items} onOpenItem={onOpenItem} />,
    );

    const rows = getAllByRole('row');
    expect(rows).toHaveLength(201);

    const openButtons = container.querySelectorAll('.crm-table__open-button');
    expect(openButtons).toHaveLength(200);
    const lastOpenButton = openButtons[199];
    fireEvent.click(lastOpenButton);

    expect(onOpenItem).toHaveBeenCalledWith(items[199]);
  });

  it('returns null when items are not an array', () => {
    const { container } = render(
      <ContentTable items={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
