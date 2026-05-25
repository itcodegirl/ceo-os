import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentCrudPage from './ContentCrudPage';
import ToastProvider from '../ui/ToastProvider';

vi.mock('../../lib/contentRepository', () => ({
  CONTENT_ITEMS_UPDATED_EVENT: 'ceo-os:content-items-updated',
  createContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  getContentSource: vi.fn(),
  listContentItems: vi.fn(),
  updateContentItem: vi.fn(),
}));

import {
  createContentItem,
  deleteContentItem,
  getContentSource,
  listContentItems,
  updateContentItem,
} from '../../lib/contentRepository';

function renderWithRouter(ui) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}

describe('ContentCrudPage integration', () => {
  let records = [];
  let idCounter = 2;

  beforeEach(() => {
    vi.clearAllMocks();
    records = [
      {
        id: 'content-1',
        title: 'Founder Weekly Brief',
        platform: 'LinkedIn',
        status: 'Drafting',
      },
    ];
    idCounter = 2;

    getContentSource.mockReturnValue('local');
    listContentItems.mockImplementation(async () => records.map((item) => ({ ...item })));
    createContentItem.mockImplementation(async (payload) => {
      const created = { id: `content-${idCounter}`, ...payload };
      idCounter += 1;
      records = [created, ...records];
      return { ...created };
    });
    updateContentItem.mockImplementation(async (id, payload) => {
      const updated = { id, ...payload };
      records = records.map((item) => (item.id === id ? updated : item));
      return { ...updated };
    });
    deleteContentItem.mockImplementation(async (id) => {
      records = records.filter((item) => item.id !== id);
    });
  });

  it('supports create, edit, and delete through live crud interactions', async () => {
    renderWithRouter(<ContentCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a content idea or draft' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Founder Strategy Update' } });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'Newsletter' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Editing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create content item' }));

    await waitFor(() => {
      expect(screen.getByText('Founder Strategy Update')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });
    expect(screen.getByText('Content item added to the workflow.')).toBeInTheDocument();
    expect(createContentItem).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Founder Strategy Update'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit selected content item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Founder Strategy Memo' } });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'LinkedIn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save content changes' }));

    const table = screen.getByRole('table', { name: 'Content pipeline' });
    await waitFor(() => {
      expect(within(table).getByText('Founder Strategy Memo')).toBeInTheDocument();
    });
    expect(updateContentItem).toHaveBeenCalledTimes(1);

    fireEvent.click(within(table).getByText('Founder Strategy Memo'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected content item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(within(table).queryByText('Founder Strategy Memo')).not.toBeInTheDocument();
    });
    expect(deleteContentItem).toHaveBeenCalledTimes(1);
  });

  it('shows save error and allows retry from the same create form', async () => {
    createContentItem.mockImplementationOnce(async () => {
      throw new Error('save failed');
    });

    renderWithRouter(<ContentCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a content idea or draft' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retry Content Item' } });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'Newsletter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create content item' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to save content item right now. Refresh and try again if this record changed elsewhere.',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create content item' }));

    const table = screen.getByRole('table', { name: 'Content pipeline' });
    await waitFor(() => {
      expect(within(table).getByText('Retry Content Item')).toBeInTheDocument();
    });
    expect(createContentItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('threads expectedUpdatedAt when editing a Supabase-loaded content row', async () => {
    const expectedUpdatedAt = Date.parse('2026-05-01T13:00:00.000Z');
    records = [
      {
        id: 'content-1',
        title: 'Founder Weekly Brief',
        platform: 'LinkedIn',
        status: 'Drafting',
        updatedAt: expectedUpdatedAt,
      },
    ];
    getContentSource.mockReturnValue('supabase');
    updateContentItem.mockImplementationOnce(async (id, payload) => ({
      id,
      ...payload,
      updatedAt: Date.parse('2026-05-01T13:05:00.000Z'),
    }));

    renderWithRouter(<ContentCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Founder Weekly Brief'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit selected content item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Founder Weekly Brief Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save content changes' }));

    await waitFor(() => {
      expect(updateContentItem).toHaveBeenCalledWith(
        'content-1',
        expect.objectContaining({ title: 'Founder Weekly Brief Updated' }),
        { expectedUpdatedAt },
      );
    });
  });

  it('shows delete error and allows retry to complete deletion', async () => {
    deleteContentItem.mockImplementationOnce(async () => {
      throw new Error('delete failed');
    });

    renderWithRouter(<ContentCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    });
    const table = screen.getByRole('table', { name: 'Content pipeline' });

    fireEvent.click(within(table).getByText('Founder Weekly Brief'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected content item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to delete content item right now. Refresh and try again if this record changed elsewhere.',
      );
      expect(within(table).getByText('Founder Weekly Brief')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(within(table).queryByText('Founder Weekly Brief')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(
      'Unable to delete content item right now. Refresh and try again if this record changed elsewhere.',
    )).not.toBeInTheDocument();
    expect(deleteContentItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks duplicate content items before writing', async () => {
    renderWithRouter(<ContentCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a content idea or draft' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' founder weekly brief ' } });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'linkedin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create content item' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This content item already exists for that platform.',
    );
    expect(createContentItem).not.toHaveBeenCalled();
  });
});
