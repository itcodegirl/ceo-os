import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWeeklySectionEditor } from './useWeeklySectionEditor';

describe('useWeeklySectionEditor', () => {
  const makeStatefulSetter = (initialItems) => {
    let current = initialItems;

    const setItems = (update) => {
      current = typeof update === 'function' ? update(current) : update;
      return undefined;
    };

    const getItems = () => current;

    return { setItems, getItems };
  };

  const makeSubmitEvent = () => ({ preventDefault: vi.fn() });

  it('creates a new item from form values', () => {
    const { setItems, getItems } = makeStatefulSetter([
      {
        id: 'priority-existing',
        title: 'Existing priority',
        owner: 'Team Member',
        status: 'Planned',
      },
    ]);

    const { result } = renderHook(() => useWeeklySectionEditor({
      type: 'priority',
      defaultItems: [{ id: 'fallback', title: 'Fallback', owner: 'Team', status: 'Planned' }],
      setItems,
    }));

    act(() => {
      result.current.openCreateEditor();
    });

    act(() => {
      result.current.handleFormChange('title', 'Ship roadmap');
      result.current.handleFormChange('owner', 'Product Lead');
      result.current.handleFormChange('status', 'In Progress');
    });

    act(() => {
      result.current.handleEditorSubmit(makeSubmitEvent());
    });

    const items = getItems();

    expect(items[0]).toMatchObject({
      title: 'Ship roadmap',
      owner: 'Product Lead',
      status: 'In Progress',
    });
    expect(result.current.isEditorOpen).toBe(false);
    expect(result.current.formValues).toEqual({});
  });

  it('edits an existing item', () => {
    const { setItems, getItems } = makeStatefulSetter([
      {
        id: 'priority-existing',
        title: 'Existing priority',
        owner: 'Team Member',
        status: 'Planned',
      },
    ]);

    const { result } = renderHook(() => useWeeklySectionEditor({
      type: 'priority',
      defaultItems: [],
      setItems,
    }));

    act(() => {
      result.current.openEditEditor(getItems()[0]);
    });

    act(() => {
      result.current.handleFormChange('title', 'Updated priority');
    });

    act(() => {
      result.current.handleEditorSubmit(makeSubmitEvent());
    });

    expect(getItems()[0]).toMatchObject({
      id: 'priority-existing',
      title: 'Updated priority',
      owner: 'Team Member',
      status: 'Planned',
    });
    expect(result.current.isEditorOpen).toBe(false);
  });

  it('validates payload before saving', () => {
    const { setItems, getItems } = makeStatefulSetter([]);

    const { result } = renderHook(() => useWeeklySectionEditor({
      type: 'priority',
      defaultItems: [],
      setItems,
    }));

    act(() => {
      result.current.openCreateEditor();
    });

    act(() => {
      result.current.handleFormChange('title', ' ');
    });

    act(() => {
      result.current.handleEditorSubmit(makeSubmitEvent());
    });

    expect(result.current.formError).toBe('Add a title for this priority.');
    expect(getItems()).toEqual([]);
  });

  it('deletes an item after confirmation', async () => {
    const { setItems, getItems } = makeStatefulSetter([
      {
        id: 'priority-delete',
        title: 'Priority to remove',
        owner: 'Team',
        status: 'Blocked',
      },
    ]);

    const { result } = renderHook(() => useWeeklySectionEditor({
      type: 'priority',
      defaultItems: [],
      setItems,
    }));

    act(() => {
      result.current.requestDelete({ id: 'priority-delete', title: 'Priority to remove' });
    });

    expect(result.current.isDeleteConfirmOpen).toBe(true);

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(result.current.isDeleteConfirmOpen).toBe(false);
    expect(getItems()).toEqual([]);
    expect(result.current.deletePrompt).toBe('');
  });
});
