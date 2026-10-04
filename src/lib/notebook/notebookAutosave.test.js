import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleRecordError } from '../staleRecordError';
import { createNotebookAutosave, NOTEBOOK_AUTOSAVE_DEBOUNCE_MS } from './notebookAutosave';
import { textToDoc } from './notebookText';

function setup({ save } = {}) {
  let updatedAt = 1000;
  const saveSpy = vi.fn(save || (() => {
    updatedAt += 1;
    return { updatedAt };
  }));
  const autosave = createNotebookAutosave({ page: { updatedAt: 1000 }, save: saveSpy });
  return { autosave, save: saveSpy };
}

describe('createNotebookAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a burst of typing once, after the debounce, with the latest text', () => {
    const { autosave, save } = setup();
    autosave.update('notes', textToDoc('a'));
    autosave.update('notes', textToDoc('ab'));
    autosave.update('notes', textToDoc('abc'));

    expect(autosave.getSnapshot().status).toBe('dirty');
    vi.advanceTimersByTime(NOTEBOOK_AUTOSAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ blocks: { notes: textToDoc('abc') } }, { expectedUpdatedAt: 1000 });
    expect(autosave.getSnapshot()).toMatchObject({ status: 'saved', savedAt: 1001, error: null });
  });

  it('saves edits to several blocks together and guards on the last saved version', () => {
    const { autosave, save } = setup();
    autosave.update('notes', textToDoc('one'));
    autosave.flush();
    autosave.update('notes', textToDoc('two'));
    autosave.update('wins', textToDoc('shipped'));
    autosave.flush();

    expect(save).toHaveBeenLastCalledWith(
      { blocks: { notes: textToDoc('two'), wins: textToDoc('shipped') } },
      { expectedUpdatedAt: 1001 },
    );
  });

  it('keeps unsaved writing after a failed save and retries it with the next edit', () => {
    let fail = true;
    let updatedAt = 1000;
    const { autosave, save } = setup({
      save: () => {
        if (fail) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        updatedAt += 1;
        return { updatedAt };
      },
    });

    autosave.update('notes', textToDoc('do not lose me'));
    expect(autosave.flush()).toBe(false);
    expect(autosave.getSnapshot()).toMatchObject({ status: 'error', error: 'storage' });
    expect(autosave.hasUnsavedChanges()).toBe(true);

    fail = false;
    autosave.update('wins', textToDoc('later edit'));
    autosave.flush();
    expect(save).toHaveBeenLastCalledWith(
      { blocks: { notes: textToDoc('do not lose me'), wins: textToDoc('later edit') } },
      { expectedUpdatedAt: 1000 },
    );
    expect(autosave.getSnapshot().status).toBe('saved');
  });

  it('reports a page changed in another tab, and can save this version over it', () => {
    const { autosave, save } = setup({
      save: (_blocks, options) => {
        if (options.expectedUpdatedAt) throw new StaleRecordError('changed elsewhere');
        return { updatedAt: 5000 };
      },
    });

    autosave.update('notes', textToDoc('mine'));
    autosave.flush();
    expect(autosave.getSnapshot()).toMatchObject({ status: 'error', error: 'stale' });

    expect(autosave.forceSave()).toBe(true);
    expect(save).toHaveBeenLastCalledWith({ blocks: { notes: textToDoc('mine') } }, {});
    expect(autosave.getSnapshot()).toMatchObject({ status: 'saved', savedAt: 5000 });
  });

  it('saves page fields with the blocks through the same version guard', () => {
    const { autosave, save } = setup();
    autosave.updateFields({ title: 'Renamed' });
    autosave.flush();
    autosave.update('notes', textToDoc('after rename'));
    autosave.flush();

    expect(save).toHaveBeenNthCalledWith(1, { title: 'Renamed' }, { expectedUpdatedAt: 1000 });
    expect(save).toHaveBeenNthCalledWith(2, { blocks: { notes: textToDoc('after rename') } }, { expectedUpdatedAt: 1001 });
  });

  it('does nothing when flushed with no changes, and stops its timer when disposed', () => {
    const { autosave, save } = setup();
    expect(autosave.flush()).toBe(true);

    autosave.update('notes', textToDoc('typed then left'));
    autosave.dispose();
    vi.advanceTimersByTime(NOTEBOOK_AUTOSAVE_DEBOUNCE_MS * 2);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.hasUnsavedChanges()).toBe(true);
  });
});
