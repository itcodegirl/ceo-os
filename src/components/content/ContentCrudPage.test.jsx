import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentCrudPage from './ContentCrudPage';

vi.mock('../../hooks/useCrudPage', () => ({
  useCrudPage: vi.fn(),
}));

vi.mock('../../lib/contentRepository', () => ({
  CONTENT_ITEMS_UPDATED_EVENT: 'ceo-os:content-items-updated',
  createContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  getContentSource: vi.fn(),
  listContentItems: vi.fn(),
  updateContentItem: vi.fn(),
}));

import { useCrudPage } from '../../hooks/useCrudPage';
import { getContentSource } from '../../lib/contentRepository';

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
      title: '',
      platform: '',
      status: 'Drafting',
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

describe('ContentCrudPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with source note and board skeleton', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        isLoading: true,
      }),
    );
    getContentSource.mockReturnValue('local');

    renderWithRouter(<ContentCrudPage />);

    expect(screen.getByRole('heading', { name: 'Content OS' })).toBeInTheDocument();
    expect(screen.getByText('Loading content board data.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Publishing pipeline cards' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Demo data is active on this device. It is not synced.')).toBeInTheDocument();
  });

  it('renders empty and error state content when there are no items', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        loadError: 'Unable to load content items right now.',
        items: [],
      }),
    );
    getContentSource.mockReturnValue('supabase');

    renderWithRouter(<ContentCrudPage />);

    expect(screen.getByText('Data source: Offline. No cloud replay queue is active.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load content items right now.');
    expect(screen.getByText('No content in motion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capture your first idea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a content idea or draft' })).toBeInTheDocument();
  });

  it('renders content rows when data is available', () => {
    useCrudPage.mockReturnValue(
      createCrudState({
        items: [
          {
            id: 'content-1',
            title: 'Founder Weekly Brief',
            platform: 'LinkedIn',
            status: 'Editing',
          },
        ],
      }),
    );
    getContentSource.mockReturnValue('local');

    renderWithRouter(<ContentCrudPage />);

    expect(screen.getByRole('table', { name: 'Content pipeline' })).toBeInTheDocument();
    expect(screen.getByText('Founder Weekly Brief')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('handles create interactions through workspace action and form submit', () => {
    const handleOpenCreateModal = vi.fn();
    const handleFormChange = vi.fn();
    const handleFormSubmit = vi.fn((event) => event?.preventDefault?.());

    useCrudPage.mockReturnValue(
      createCrudState({
        isFormOpen: true,
        formValues: {
          title: 'Founder Memo',
          platform: 'LinkedIn',
          status: 'Drafting',
        },
        handleOpenCreateModal,
        handleFormChange,
        handleFormSubmit,
      }),
    );
    getContentSource.mockReturnValue('local');

    renderWithRouter(<ContentCrudPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a content idea or draft' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Founder Memo Updated' } });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'LinkedIn Carousel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create content item' }));

    expect(handleOpenCreateModal).toHaveBeenCalledTimes(1);
    expect(handleFormChange).toHaveBeenCalledWith('title', 'Founder Memo Updated');
    expect(handleFormChange).toHaveBeenCalledWith('platform', 'LinkedIn Carousel');
    expect(handleFormSubmit).toHaveBeenCalledTimes(1);
  });

  it('handles edit and delete interactions for selected content item', () => {
    const handleOpenEditModal = vi.fn();
    const handleOpenDeleteConfirm = vi.fn();
    const handleConfirmDeleteSelected = vi.fn();
    const handleFormSubmit = vi.fn((event) => event?.preventDefault?.());

    useCrudPage.mockReturnValue(
      createCrudState({
        selectedItem: {
          id: 'content-1',
          title: 'Founder Weekly Brief',
          platform: 'LinkedIn',
          status: 'Editing',
        },
        isFormOpen: true,
        isDeleteConfirmOpen: true,
        formValues: {
          title: 'Founder Weekly Brief',
          platform: 'LinkedIn',
          status: 'Editing',
        },
        handleOpenEditModal,
        handleOpenDeleteConfirm,
        handleConfirmDeleteSelected,
        handleFormSubmit,
      }),
    );
    getContentSource.mockReturnValue('local');

    renderWithRouter(<ContentCrudPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit selected content item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected content item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save content changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(handleOpenEditModal).toHaveBeenCalledTimes(1);
    expect(handleOpenDeleteConfirm).toHaveBeenCalledTimes(1);
    expect(handleFormSubmit).toHaveBeenCalledTimes(1);
    expect(handleConfirmDeleteSelected).toHaveBeenCalledTimes(1);
  });
});
