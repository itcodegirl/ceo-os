import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCrudPage } from './useCrudPage';
import { StaleRecordError } from '../lib/staleRecordError';
import { createDuplicateRecordError } from '../lib/repositoryErrors';

function createSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  };
}

describe('useCrudPage', () => {
  it('loads items and handles create, update, and delete lifecycle', async () => {
    const listItems = vi.fn(() => Promise.resolve([{ id: '1', name: 'Opportunity A' }]));
    const createItem = vi.fn((payload) => Promise.resolve({ id: '2', ...payload }));
    const updateItem = vi.fn((id, payload) => Promise.resolve({ id, ...payload }));
    const deleteItem = vi.fn((id) => Promise.resolve({ id }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem,
      deleteItem,
      defaultFormValues: { name: '', status: '' },
      mapItemToFormValues: (item) => ({ name: item.name, status: item.status || '' }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      getDeleteLabel: (item) => item.name,
      messages: {
        load: 'Unable to load.',
        save: 'Unable to save.',
        delete: 'Unable to delete.',
      },
      logPrefix: 'unit test',
    }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: '1', name: 'Opportunity A' }]);

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Opportunity B');
      result.current.handleFormChange('status', 'Draft');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(createItem).toHaveBeenCalledWith({ name: 'Opportunity B', status: 'Draft' });
    expect(result.current.items).toEqual([
      { id: '2', name: 'Opportunity B', status: 'Draft' },
      { id: '1', name: 'Opportunity A' },
    ]);

    act(() => {
      result.current.setSelectedItem({ id: '2', name: 'Opportunity B', status: 'Draft' });
    });

    await waitFor(() => {
      expect(result.current.selectedItem?.id).toBe('2');
    });

    act(() => {
      result.current.handleOpenEditModal();
    });

    act(() => {
      result.current.handleFormChange('status', 'Active');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(updateItem).toHaveBeenCalledWith('2', { name: 'Opportunity B', status: 'Active' });
    expect(result.current.items.find((item) => item.id === '2')).toEqual({ id: '2', name: 'Opportunity B', status: 'Active' });

    act(() => {
      result.current.handleOpenDeleteConfirm();
    });

    await act(async () => {
      await result.current.handleConfirmDeleteSelected();
    });

    expect(deleteItem).toHaveBeenCalledWith('2');
    expect(result.current.items.find((item) => item.id === '2')).toBeUndefined();
    expect(result.current.selectedItem).toBeNull();
  });

  it('surfaces load errors', async () => {
    const listItems = vi.fn(() => Promise.reject(new Error('load failed')));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '1' }),
      updateItem: () => Promise.resolve({ id: '1' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: {},
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadError).toBe('Unable to load items right now.');
    expect(result.current.items).toEqual([]);
  });

  it('surfaces malformed load responses instead of showing a false empty state', async () => {
    const listItems = vi.fn(() => Promise.resolve({ id: 'not-an-array' }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '1' }),
      updateItem: () => Promise.resolve({ id: '1' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: {},
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      messages: {
        load: 'Unable to load opportunities right now.',
      },
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadError).toBe('Unable to load opportunities right now.');
    expect(result.current.items).toEqual([]);
  });

  it('handles missing list function as a recoverable load error', async () => {
    const { result } = renderHook(() => useCrudPage({
      createItem: () => Promise.resolve({ id: '1' }),
      updateItem: () => Promise.resolve({ id: '1' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: {},
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadError).toBe('Unable to load items right now.');
    expect(result.current.items).toEqual([]);
  });

  it('surfaces save errors when create returns malformed data', async () => {
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn(() => Promise.resolve({ name: 'Missing Id' }));
    const updateItem = vi.fn(() => Promise.resolve({ id: '1', name: 'Valid' }));
    const deleteItem = vi.fn(() => Promise.resolve({ id: '1' }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem,
      deleteItem,
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Draft item');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(result.current.formError).toBe('Unable to save item right now.');
    expect(result.current.items).toEqual([]);
  });

  it('surfaces create errors and keeps the form open for retry', async () => {
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn(() => Promise.reject(new Error('create failed')));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem: () => Promise.resolve({ id: '1', name: 'Valid' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      messages: {
        save: 'Unable to save this record right now.',
      },
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Draft item');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(result.current.formError).toBe('Unable to save this record right now.');
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('surfaces repository duplicate errors instead of generic save copy', async () => {
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn(() => Promise.reject(
      createDuplicateRecordError('This opportunity already exists for that company.'),
    ));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem: () => Promise.resolve({ id: '1', name: 'Valid' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      messages: {
        save: 'Unable to save this record right now.',
      },
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Duplicate lead');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(result.current.formError).toBe('This opportunity already exists for that company.');
    expect(result.current.isFormOpen).toBe(true);
  });

  it('ignores duplicate save submissions while a create is in flight', async () => {
    let resolveCreate;
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn((payload) => new Promise((resolve) => {
      resolveCreate = () => resolve({ id: '2', ...payload });
    }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem: () => Promise.resolve({ id: '1' }),
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Draft item');
    });

    let firstSubmit;
    await act(async () => {
      firstSubmit = result.current.handleFormSubmit(createSubmitEvent());
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(createItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate();
      await firstSubmit;
    });

    expect(result.current.items).toEqual([{ id: '2', name: 'Draft item' }]);
  });

  it('surfaces update errors and preserves the current item state', async () => {
    const listItems = vi.fn(() => Promise.resolve([{ id: '1', name: 'Opportunity A', status: 'Draft' }]));
    const updateItem = vi.fn(() => Promise.reject(new Error('update failed')));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'Opportunity B', status: 'Draft' }),
      updateItem,
      deleteItem: () => Promise.resolve({ id: '1' }),
      defaultFormValues: { name: '', status: '' },
      mapItemToFormValues: (item) => ({ name: item.name, status: item.status }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      messages: {
        save: 'Unable to update this record right now.',
      },
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Opportunity A', status: 'Draft' });
    });

    await waitFor(() => {
      expect(result.current.selectedItem?.id).toBe('1');
    });

    act(() => {
      result.current.handleOpenEditModal();
      result.current.handleFormChange('status', 'Active');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(updateItem).toHaveBeenCalledWith('1', { name: 'Opportunity A', status: 'Active' });
    expect(result.current.formError).toBe('Unable to update this record right now.');
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.items).toEqual([{ id: '1', name: 'Opportunity A', status: 'Draft' }]);
    expect(result.current.selectedItem).toEqual({ id: '1', name: 'Opportunity A', status: 'Draft' });
  });

  it('surfaces delete errors and keeps confirmation open for retry', async () => {
    const listItems = vi.fn(() => Promise.resolve([{ id: '1', name: 'Opportunity A' }]));
    const deleteItem = vi.fn(() => Promise.reject(new Error('delete failed')));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'Opportunity B' }),
      updateItem: () => Promise.resolve({ id: '1', name: 'Opportunity A' }),
      deleteItem,
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      getDeleteLabel: (item) => item.name,
      messages: {
        delete: 'Unable to delete this record right now.',
      },
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Opportunity A' });
    });

    await waitFor(() => {
      expect(result.current.selectedItem?.id).toBe('1');
    });

    act(() => {
      result.current.handleOpenDeleteConfirm();
    });

    await waitFor(() => {
      expect(result.current.isDeleteConfirmOpen).toBe(true);
    });

    await act(async () => {
      await result.current.handleConfirmDeleteSelected();
    });

    expect(deleteItem).toHaveBeenCalledWith('1');
    expect(result.current.loadError).toBe('Unable to delete this record right now.');
    expect(result.current.isDeleteConfirmOpen).toBe(true);
    expect(result.current.selectedItem).toEqual({ id: '1', name: 'Opportunity A' });
    expect(result.current.items).toEqual([{ id: '1', name: 'Opportunity A' }]);
  });

  it('uses parsePayload as the single source for normalization + validation when provided', async () => {
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn((payload) => Promise.resolve({ id: '2', ...payload }));

    const parsePayload = vi.fn((values) => {
      const trimmed = values.name.trim();
      if (!trimmed) {
        return { payload: null, error: 'Name is required.' };
      }
      return { payload: { name: trimmed }, error: '' };
    });

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem: vi.fn(),
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      parsePayload,
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Whitespace-only -> error from parsePayload, no createItem call.
    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', '   ');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(result.current.formError).toBe('Name is required.');
    expect(createItem).not.toHaveBeenCalled();

    // Surrounding whitespace -> trimmed payload reaches createItem.
    act(() => {
      result.current.handleFormChange('name', '  Opportunity B  ');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(createItem).toHaveBeenCalledWith({ name: 'Opportunity B' });
  });

  it('runs secondary payload validation after parsePayload succeeds', async () => {
    const listItems = vi.fn(() => Promise.resolve([{ id: '1', name: 'Existing' }]));
    const createItem = vi.fn((payload) => Promise.resolve({ id: '2', ...payload }));
    const validatePayload = vi.fn((payload, context) => (
      context.items.some((item) => item.name === payload.name)
        ? 'Name already exists.'
        : ''
    ));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem: vi.fn(),
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      parsePayload: (values) => ({ payload: { name: values.name.trim() }, error: '' }),
      validatePayload,
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleOpenCreateModal();
      result.current.handleFormChange('name', 'Existing');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(validatePayload).toHaveBeenCalledWith(
      { name: 'Existing' },
      expect.objectContaining({ items: [{ id: '1', name: 'Existing' }] }),
    );
    expect(result.current.formError).toBe('Name already exists.');
    expect(createItem).not.toHaveBeenCalled();
  });

  it('blocks submit when validation fails', async () => {
    const listItems = vi.fn(() => Promise.resolve([]));
    const createItem = vi.fn();
    const updateItem = vi.fn();

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem,
      updateItem,
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: (payload) => (!payload.name ? 'Name is required.' : ''),
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleOpenCreateModal();
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(result.current.formError).toBe('Name is required.');
    expect(createItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('threads expectedUpdatedAt into updateFn for items that carry a timestamp', async () => {
    const listItems = vi.fn(() => Promise.resolve([
      { id: '1', name: 'Opportunity A', updatedAt: 1700000000000 },
    ]));
    const updateItem = vi.fn((id, payload) => Promise.resolve({ id, ...payload, updatedAt: 1700000111111 }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'Opportunity B' }),
      updateItem,
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapItemToFormValues: (item) => ({ name: item.name }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Opportunity A', updatedAt: 1700000000000 });
    });
    await waitFor(() => expect(result.current.selectedItem?.id).toBe('1'));

    act(() => {
      result.current.handleOpenEditModal();
      result.current.handleFormChange('name', 'Opportunity A2');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(updateItem).toHaveBeenCalledWith(
      '1',
      { name: 'Opportunity A2' },
      { expectedUpdatedAt: 1700000000000 },
    );
    expect(result.current.formError).toBe('');
  });

  it('shows a friendly stale-record message and keeps the form open when updateFn rejects with StaleRecordError', async () => {
    const listItems = vi.fn(() => Promise.resolve([
      { id: '1', name: 'Opportunity A', updatedAt: 1700000000000 },
    ]));
    const updateItem = vi.fn(() => Promise.reject(new StaleRecordError()));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'Opportunity B' }),
      updateItem,
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapItemToFormValues: (item) => ({ name: item.name }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      messages: {
        save: 'Generic save error.',
      },
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Opportunity A', updatedAt: 1700000000000 });
    });
    await waitFor(() => expect(result.current.selectedItem?.id).toBe('1'));

    act(() => {
      result.current.handleOpenEditModal();
      result.current.handleFormChange('name', 'Opportunity A2');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    expect(result.current.formError).toContain('changed in another window');
    expect(result.current.formError).not.toBe('Generic save error.');
    expect(result.current.isFormOpen).toBe(true);
  });

  it('does NOT refresh the items list when an update fails with a non-stale error', async () => {
    const listItems = vi.fn(() => Promise.resolve([
      { id: '1', name: 'Original', updatedAt: 1700000000000 },
    ]));
    const updateItem = vi.fn(() => Promise.reject(new Error('network down')));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'B' }),
      updateItem,
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapItemToFormValues: (item) => ({ name: item.name }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listItems).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Original', updatedAt: 1700000000000 });
    });
    await waitFor(() => expect(result.current.selectedItem?.id).toBe('1'));

    act(() => {
      result.current.handleOpenEditModal();
      result.current.handleFormChange('name', 'Local edit');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    // Non-stale errors should NOT trigger a refetch — only stale-record errors do.
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(result.current.formError).toBeTruthy();
    expect(result.current.formError).not.toContain('changed in another window');
  });

  it('refreshes the items list when an update fails with StaleRecordError', async () => {
    const listItems = vi.fn();
    listItems
      .mockResolvedValueOnce([{ id: '1', name: 'Original', updatedAt: 1700000000000 }])
      .mockResolvedValueOnce([{ id: '1', name: 'From other tab', updatedAt: 1700000999999 }]);
    const updateItem = vi.fn(() => Promise.reject(new StaleRecordError()));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: '2', name: 'B' }),
      updateItem,
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapItemToFormValues: (item) => ({ name: item.name }),
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listItems).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSelectedItem({ id: '1', name: 'Original', updatedAt: 1700000000000 });
    });
    await waitFor(() => expect(result.current.selectedItem?.id).toBe('1'));

    act(() => {
      result.current.handleOpenEditModal();
      result.current.handleFormChange('name', 'Local edit');
    });

    await act(async () => {
      await result.current.handleFormSubmit(createSubmitEvent());
    });

    // Stale-record path should trigger a fresh list fetch.
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.items.find((item) => item.id === '1')?.name).toBe('From other tab'),
    );
  });

  it('keeps isLoading false during event-driven refreshes so the page does not flash a skeleton', async () => {
    const listItems = vi.fn();
    listItems
      .mockResolvedValueOnce([{ id: '1', name: 'First' }])
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve([
          { id: '1', name: 'First' },
          { id: '2', name: 'Refreshed' },
        ]), 25);
      }));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: 'x' }),
      updateItem: () => Promise.resolve({ id: 'x' }),
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      updatedEventName: 'ceo-os:silent-refresh-test',
    }));

    // First mount: isLoading flips to false once items arrive.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:silent-refresh-test'));
    });

    // While the refetch is in flight, isLoading must stay false (no flash).
    expect(result.current.isLoading).toBe(false);

    await waitFor(() =>
      expect(result.current.items.some((item) => item.id === '2')).toBe(true),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('refreshes items when the configured updatedEventName is dispatched', async () => {
    const listItems = vi.fn();
    listItems
      .mockResolvedValueOnce([{ id: '1', name: 'Initial' }])
      .mockResolvedValueOnce([
        { id: '1', name: 'Initial' },
        { id: '2', name: 'Promoted from another surface' },
      ]);

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: 'x', name: 'x' }),
      updateItem: () => Promise.resolve({ id: 'x', name: 'x' }),
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
      updatedEventName: 'ceo-os:test-updated',
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listItems).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:test-updated', {
        detail: { source: 'local', type: 'create' },
      }));
    });

    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.items.some((item) => item.id === '2')).toBe(true),
    );
  });

  it('does not subscribe to any event when updatedEventName is omitted', async () => {
    const listItems = vi.fn(() => Promise.resolve([{ id: '1', name: 'Initial' }]));

    const { result } = renderHook(() => useCrudPage({
      listItems,
      createItem: () => Promise.resolve({ id: 'x', name: 'x' }),
      updateItem: () => Promise.resolve({ id: 'x', name: 'x' }),
      deleteItem: () => Promise.resolve(),
      defaultFormValues: { name: '' },
      mapFormValuesToPayload: (values) => values,
      validatePayload: () => '',
    }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listItems).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:test-updated', { detail: {} }));
    });

    // No subscription, so the event must not trigger a refetch.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(listItems).toHaveBeenCalledTimes(1);
  });
});
