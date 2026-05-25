import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OpportunityCrudPage from './OpportunityCrudPage';

vi.mock('../../hooks/useCrudPage', () => ({
  useCrudPage: vi.fn(),
}));

vi.mock('../../lib/opportunitiesRepository', () => ({
  OPPORTUNITIES_UPDATED_EVENT: 'ceo-os:opportunities-updated',
  createOpportunity: vi.fn(),
  deleteOpportunity: vi.fn(),
  getOpportunitiesSource: vi.fn(),
  listOpportunities: vi.fn(),
  updateOpportunity: vi.fn(),
}));

import { useCrudPage } from '../../hooks/useCrudPage';
import { getOpportunitiesSource } from '../../lib/opportunitiesRepository';

function createCrudState(overrides = {}) {
  return {
    isLoading: false,
    items: [],
    selectedItem: null,
    setSelectedItem: vi.fn(),
    isFormOpen: false,
    isDeleteConfirmOpen: false,
    isSaving: false,
    isDeleting: false,
    formValues: {
      name: '',
      company: '',
      priority: 'Medium',
      stage: 'New',
      nextStep: '',
    },
    formError: '',
    loadError: '',
    handleOpenCreateModal: vi.fn(),
    handleOpenEditModal: vi.fn(),
    handleCloseFormModal: vi.fn(),
    handleFormChange: vi.fn(),
    handleFormSubmit: vi.fn((event) => event?.preventDefault?.()),
    handleOpenDeleteConfirm: vi.fn(),
    handleCloseDeleteConfirm: vi.fn(),
    handleConfirmDeleteSelected: vi.fn(),
    deletePrompt: 'Delete this item? This cannot be undone.',
    ...overrides,
  };
}

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('OpportunityCrudPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with source note and pipeline skeleton', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        isLoading: true,
      }),
    );
    getOpportunitiesSource.mockReturnValue('local');

    renderWithRouter(<OpportunityCrudPage />);

    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument();
    expect(screen.getByText('Loading opportunities data.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Opportunity pipeline' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Demo data is active on this device. It is not synced.')).toBeInTheDocument();
  });

  it('renders empty and error state content when there are no opportunities', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        loadError: 'Unable to load opportunities right now.',
        items: [],
      }),
    );
    getOpportunitiesSource.mockReturnValue('supabase');

    renderWithRouter(<OpportunityCrudPage />);

    expect(screen.getByText('Data source: Offline. No cloud replay queue is active.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load opportunities right now.');
    expect(screen.getByText('Nothing in the pipeline yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add opportunity/i }).length).toBeGreaterThan(0);
  });

  it('renders opportunity rows when data is available', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        items: [
          {
            id: 'opp-1',
            name: 'Advisory Partnership',
            company: 'Studio North',
            priority: 'High',
            stage: 'In Progress',
            nextStep: 'Send deck follow-up',
          },
        ],
      }),
    );
    getOpportunitiesSource.mockReturnValue('local');

    renderWithRouter(<OpportunityCrudPage />);

    expect(screen.getByRole('table', { name: 'Opportunity pipeline' })).toBeInTheDocument();
    expect(screen.getByText('Advisory Partnership')).toBeInTheDocument();
    expect(screen.getByText('Studio North')).toBeInTheDocument();
  });

  it('handles create interactions through workspace action and form submit', () => {
    const handleOpenCreateModal = vi.fn();
    const handleFormChange = vi.fn();
    const handleFormSubmit = vi.fn((event) => event?.preventDefault?.());

    useCrudPage.mockReturnValue(
      createCrudState({
        isFormOpen: true,
        formValues: {
          name: 'Advisory partnership',
          company: 'Studio North',
          priority: 'High',
          stage: 'In Progress',
          nextStep: 'Send intro',
        },
        handleOpenCreateModal,
        handleFormChange,
        handleFormSubmit,
      }),
    );
    getOpportunitiesSource.mockReturnValue('local');

    renderWithRouter(<OpportunityCrudPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Create a new opportunity' }));
    fireEvent.change(screen.getByLabelText('Opportunity'), { target: { value: 'Advisory partnership updated' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Studio North Labs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create opportunity' }));

    expect(handleOpenCreateModal).toHaveBeenCalledTimes(1);
    expect(handleFormChange).toHaveBeenCalledWith('name', 'Advisory partnership updated');
    expect(handleFormChange).toHaveBeenCalledWith('company', 'Studio North Labs');
    expect(handleFormSubmit).toHaveBeenCalledTimes(1);
  });

  it('handles edit and delete interactions for selected opportunity', () => {
    const handleOpenEditModal = vi.fn();
    const handleOpenDeleteConfirm = vi.fn();
    const handleConfirmDeleteSelected = vi.fn();
    const handleFormSubmit = vi.fn((event) => event?.preventDefault?.());

    useCrudPage.mockReturnValue(
      createCrudState({
        selectedItem: {
          id: 'opp-1',
          name: 'Advisory Partnership',
          company: 'Studio North',
          priority: 'High',
          stage: 'In Progress',
          nextStep: 'Send deck follow-up',
        },
        isFormOpen: true,
        isDeleteConfirmOpen: true,
        formValues: {
          name: 'Advisory Partnership',
          company: 'Studio North',
          priority: 'High',
          stage: 'In Progress',
          nextStep: 'Send deck follow-up',
        },
        handleOpenEditModal,
        handleOpenDeleteConfirm,
        handleConfirmDeleteSelected,
        handleFormSubmit,
      }),
    );
    getOpportunitiesSource.mockReturnValue('local');

    renderWithRouter(<OpportunityCrudPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit selected opportunity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected opportunity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save opportunity changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(handleOpenEditModal).toHaveBeenCalledTimes(1);
    expect(handleOpenDeleteConfirm).toHaveBeenCalledTimes(1);
    expect(handleFormSubmit).toHaveBeenCalledTimes(1);
    expect(handleConfirmDeleteSelected).toHaveBeenCalledTimes(1);
  });
});
