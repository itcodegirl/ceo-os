import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OpportunityCrudPage from './OpportunityCrudPage';
import ToastProvider from '../ui/ToastProvider';

vi.mock('../../lib/opportunitiesRepository', () => ({
  OPPORTUNITIES_UPDATED_EVENT: 'ceo-os:opportunities-updated',
  createOpportunity: vi.fn(),
  deleteOpportunity: vi.fn(),
  getOpportunitiesSource: vi.fn(),
  listOpportunities: vi.fn(),
  updateOpportunity: vi.fn(),
}));

import {
  createOpportunity,
  deleteOpportunity,
  getOpportunitiesSource,
  listOpportunities,
  updateOpportunity,
} from '../../lib/opportunitiesRepository';

function renderWithRouter(ui) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}

describe('OpportunityCrudPage integration', () => {
  let records = [];
  let idCounter = 2;

  beforeEach(() => {
    vi.clearAllMocks();
    records = [
      {
        id: 'opp-1',
        name: 'Advisory Partnership',
        company: 'Studio North',
        priority: 'High',
        stage: 'In Progress',
        nextStep: 'Share proposal',
      },
    ];
    idCounter = 2;

    getOpportunitiesSource.mockReturnValue('local');
    listOpportunities.mockImplementation(async () => records.map((item) => ({ ...item })));
    createOpportunity.mockImplementation(async (payload) => {
      const created = { id: `opp-${idCounter}`, ...payload };
      idCounter += 1;
      records = [created, ...records];
      return { ...created };
    });
    updateOpportunity.mockImplementation(async (id, payload) => {
      const updated = { id, ...payload };
      records = records.map((item) => (item.id === id ? updated : item));
      return { ...updated };
    });
    deleteOpportunity.mockImplementation(async (id) => {
      records = records.filter((item) => item.id !== id);
    });
  });

  it('supports create, edit, and delete through live crud interactions', async () => {
    renderWithRouter(<OpportunityCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create a new opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: 'Women in Product Media' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Women in Product' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'Medium' } });
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Awaiting Reply' } });
    fireEvent.change(screen.getByLabelText('Next Step'), { target: { value: 'Follow up on sponsor package' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create opportunity' }));

    await waitFor(() => {
      expect(screen.getByText('Women in Product Media')).toBeInTheDocument();
      expect(screen.getByText('Women in Product')).toBeInTheDocument();
    });
    expect(screen.getByText('Opportunity added to the pipeline.')).toBeInTheDocument();
    expect(createOpportunity).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Women in Product Media'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit selected opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: 'Product Media Partnership' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Product Media Group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save opportunity changes' }));

    const table = screen.getByRole('table', { name: 'Opportunity pipeline' });
    await waitFor(() => {
      expect(within(table).getByText('Product Media Partnership')).toBeInTheDocument();
      expect(within(table).getByText('Product Media Group')).toBeInTheDocument();
    });
    expect(updateOpportunity).toHaveBeenCalledTimes(1);

    fireEvent.click(within(table).getByText('Product Media Partnership'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected opportunity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(within(table).queryByText('Product Media Partnership')).not.toBeInTheDocument();
    });
    expect(deleteOpportunity).toHaveBeenCalledTimes(1);
  });

  it('shows save error and allows retry from the same create form', async () => {
    createOpportunity.mockImplementationOnce(async () => {
      throw new Error('save failed');
    });

    renderWithRouter(<OpportunityCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create a new opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: 'Retry Opportunity' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Retry Co' } });
    fireEvent.change(screen.getByLabelText('Next Step'), { target: { value: 'Follow up tomorrow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create opportunity' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to save opportunity right now. Refresh and try again if this record changed elsewhere.',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create opportunity' }));

    const table = screen.getByRole('table', { name: 'Opportunity pipeline' });
    await waitFor(() => {
      expect(within(table).getByText('Retry Opportunity')).toBeInTheDocument();
    });
    expect(createOpportunity.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('threads expectedUpdatedAt when editing a Supabase-loaded opportunity row', async () => {
    const expectedUpdatedAt = Date.parse('2026-05-01T12:00:00.000Z');
    records = [
      {
        id: 'opp-1',
        name: 'Advisory Partnership',
        company: 'Studio North',
        priority: 'High',
        stage: 'In Progress',
        nextStep: 'Share proposal',
        updatedAt: expectedUpdatedAt,
      },
    ];
    getOpportunitiesSource.mockReturnValue('supabase');
    updateOpportunity.mockImplementationOnce(async (id, payload) => ({
      id,
      ...payload,
      updatedAt: Date.parse('2026-05-01T12:05:00.000Z'),
    }));

    renderWithRouter(<OpportunityCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Advisory Partnership'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit selected opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: 'Advisory Partnership Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save opportunity changes' }));

    await waitFor(() => {
      expect(updateOpportunity).toHaveBeenCalledWith(
        'opp-1',
        expect.objectContaining({ name: 'Advisory Partnership Updated' }),
        { expectedUpdatedAt },
      );
    });
  });

  it('shows delete error and allows retry to complete deletion', async () => {
    deleteOpportunity.mockImplementationOnce(async () => {
      throw new Error('delete failed');
    });

    renderWithRouter(<OpportunityCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    });
    const table = screen.getByRole('table', { name: 'Opportunity pipeline' });

    fireEvent.click(within(table).getByText('Advisory Partnership'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected opportunity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to delete opportunity right now. Refresh and try again if this record changed elsewhere.',
      );
      expect(within(table).getByText('Advisory Partnership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(within(table).queryByText('Advisory Partnership')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(
      'Unable to delete opportunity right now. Refresh and try again if this record changed elsewhere.',
    )).not.toBeInTheDocument();
    expect(deleteOpportunity.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks duplicate opportunities before writing', async () => {
    renderWithRouter(<OpportunityCrudPage />);

    await waitFor(() => {
      expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create a new opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: ' advisory partnership ' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'studio north' } });
    fireEvent.change(screen.getByLabelText('Next Step'), { target: { value: 'Send another proposal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create opportunity' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This opportunity already exists for that company.',
    );
    expect(createOpportunity).not.toHaveBeenCalled();
  });
});
