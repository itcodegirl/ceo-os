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

  it('creates a new item from form values', async () => {
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

    await act(async () => {
      await result.current.handleEditorSubmit(makeSubmitEvent());
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

  it('edits an existing item', async () => {
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

    await act(async () => {
      await result.current.handleEditorSubmit(makeSubmitEvent());
    });

    expect(getItems()[0]).toMatchObject({
      id: 'priority-existing',
      title: 'Updated priority',
      owner: 'Team Member',
      status: 'Planned',
    });
    expect(result.current.isEditorOpen).toBe(false);
  });

  it('validates payload before saving', async () => {
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

    await act(async () => {
      await result.current.handleEditorSubmit(makeSubmitEvent());
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
  it('retains the opening revision and draft while a save fails, then reloads only on request', async () => {
    let reject;
    const pending = new Promise((_, no) => { reject = no; });
    const setItems = vi.fn(() => pending);
    const original = { id: 'p1', title: 'Original', updatedAt: 1000, status: 'Planned' };
    const latest = { ...original, title: 'Other tab', updatedAt: 2000 };
    const { result, rerender } = renderHook(({ items }) => useWeeklySectionEditor({
      type: 'priority', items, defaultItems: [], setItems,
    }), { initialProps: { items: [original] } });
    act(() => result.current.openEditEditor(original));
    act(() => result.current.handleFormChange('title', 'My draft'));
    rerender({ items: [latest] });
    let saving;
    act(() => { saving = result.current.handleEditorSubmit(makeSubmitEvent()); });
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isEditorOpen).toBe(true);
    expect(setItems).toHaveBeenCalledWith(expect.any(Function), { itemId: 'p1', expectedUpdatedAt: 1000 });
    await act(async () => { reject(Object.assign(new Error('changed'), { code: 'STALE_RECORD' })); await saving; });
    expect(result.current.formValues.title).toBe('My draft');
    expect(result.current.isEditorOpen).toBe(true);
    expect(result.current.formError).toContain('changed in another window');
    act(() => result.current.reloadEditor());
    expect(result.current.formValues.title).toBe('Other tab');
    expect(result.current.formError).toBe('');
  });

  it('keeps a failed deletion open and uses the confirmed revision', async () => {
    const setItems = vi.fn().mockRejectedValue(Object.assign(new Error('changed'), { code: 'STALE_RECORD' }));
    const { result } = renderHook(() => useWeeklySectionEditor({ type: 'win', defaultItems: [], setItems }));
    act(() => result.current.requestDelete({ id: 'w1', text: 'A win', updatedAt: 1000 }));
    await act(async () => { await result.current.handleConfirmDelete(); });
    expect(setItems).toHaveBeenCalledWith(expect.any(Function), { itemId: 'w1', expectedUpdatedAt: 1000 });
    expect(result.current.isDeleteConfirmOpen).toBe(true);
    expect(result.current.deleteError).toContain('review the latest');
  });

});
