import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RemindersPanel from './RemindersPanel';

function renderPanel(visibleReminders) {
  return render(
    <MemoryRouter>
      <RemindersPanel
        reminderDraft=""
        onReminderDraftChange={vi.fn()}
        isAddingReminder={false}
        onAddReminderSubmit={vi.fn()}
        reminderProgress={{ total: visibleReminders.length, completed: 0, pending: visibleReminders.length, completionRate: 0 }}
        visibleReminders={visibleReminders}
        suggestions={[]}
        onToggleReminder={vi.fn()}
        onDeleteReminder={vi.fn()}
      />
    </MemoryRouter>,
  );
}

const BASE = { isDone: false, completedAt: '', createdAt: '2026-10-04T09:00:00.000Z', snoozedUntil: '' };

describe('src/components/dashboard/RemindersPanel', () => {
  it('links a notebook to-do back to its page, and leaves plain reminders unlinked', () => {
    renderPanel([
      {
        ...BASE,
        id: 'todo-1',
        text: 'Draft the pricing page',
        sourceType: 'notebook-page',
        sourceId: 'page-1',
        sourceTitle: 'Value pricing',
        sourceHref: '/notebook?section=learning&page=page-1',
      },
      { ...BASE, id: 'plain-1', text: 'Call the bank', sourceType: '', sourceId: '', sourceTitle: '', sourceHref: '' },
    ]);

    const link = screen.getByRole('link', { name: 'Value pricing: open the page this reminder came from' });
    expect(link).toHaveAttribute('href', '/notebook?section=learning&page=page-1');
    expect(link).toHaveTextContent('Value pricing');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
