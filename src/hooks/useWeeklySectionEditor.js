import { useMemo, useRef, useState } from 'react';
import {
  getDefaultFormValues,
  getEditorTitle,
  getFormValuesForEdit,
  buildWeeklyPayload,
} from '../lib/weeklyBriefEditor';
import { isStaleRecordError } from '../lib/staleRecordError';
import { useConfirmDelete } from './useConfirmDelete';

function getItemName(type, item) {
  if (!item) {
    return '';
  }

  return type === 'priority' ? item.title : item.text;
}

export function useWeeklySectionEditor({ type, items, defaultItems, setItems }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorItemId, setEditorItemId] = useState('');
  const [formValues, setFormValues] = useState({});
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [editorRevision, setEditorRevision] = useState();
  const failureMessage = (error) => isStaleRecordError(error)
    ? 'This item changed in another window. Your draft is kept here. Cancel to review the latest item, or reload it before editing again.'
    : 'Could not save this change. Your draft is kept here. Please try again.';

  const {
    isConfirmOpen: isDeleteConfirmOpen,
    confirmMessage: deletePrompt,
    requestConfirm,
    closeConfirm: closeDeleteConfirm,
    confirm: confirmDelete,
    isConfirmPending: isDeleting,
  } = useConfirmDelete(
    async (itemToDelete) => {
      const itemId = itemToDelete?.id;
      if (itemId === null || itemId === undefined) {
        return;
      }

      await setItems((current) => {
        const sourceItems = Array.isArray(current) ? current : defaultItems;
        return sourceItems.filter((item) => String(item.id) !== String(itemId));
      }, { itemId: String(itemId), expectedUpdatedAt: itemToDelete.updatedAt ?? 0 });
    },
    (itemToDelete) => {
      const itemName = getItemName(type, itemToDelete);
      if (!itemName) {
        return 'Delete this item? This cannot be undone.';
      }

      return `Delete "${itemName}"? This cannot be undone.`;
    },
  );

  const isEditing = Boolean(editorItemId);

  const editorTitle = useMemo(() => getEditorTitle(type, isEditing), [isEditing, type]);

  const closeEditor = () => {
    if (savingRef.current) return;
    setIsEditorOpen(false);
    setEditorItemId('');
    setFormValues({});
    setFormError('');
  };

  const openCreateEditor = () => {
    setIsEditorOpen(true);
    setEditorItemId('');
    setEditorRevision(undefined);
    setFormValues(getDefaultFormValues(type));
    setFormError('');
  };

  const openEditEditor = (item) => {
    const itemId = item?.id;
    if (itemId === null || itemId === undefined) {
      return;
    }

    setIsEditorOpen(true);
    setEditorItemId(String(itemId));
    setEditorRevision(item.updatedAt ?? 0);
    setFormValues(getFormValuesForEdit(type, item));
    setFormError('');
  };

  const handleFormChange = (field, value) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const requestDelete = (item) => {
    setDeleteError('');
    requestConfirm(item);
  };

  const handleEditorSubmit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;

    const { payload, error } = buildWeeklyPayload(type, formValues, editorItemId);
    if (error) {
      setFormError(error);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setFormError('');
    try {
      await setItems((current) => {
        const sourceItems = Array.isArray(current) ? current : defaultItems;
        if (!editorItemId) return [payload, ...sourceItems];
        return sourceItems.map((item) => (String(item.id) === editorItemId ? { ...item, ...payload } : item));
      }, { itemId: editorItemId, expectedUpdatedAt: editorRevision });
      savingRef.current = false;
      closeEditor();
    } catch (error) {
      setFormError(failureMessage(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    try { await confirmDelete(); } catch (error) {
      setDeleteError(isStaleRecordError(error)
        ? 'This item changed in another window. Cancel and review the latest item before deleting.'
        : 'Could not delete this item. Please try again.');
    }
  };
  const reloadEditor = () => {
    const latest = items?.find((item) => String(item.id) === editorItemId);
    if (latest) openEditEditor(latest);
    else setFormError('This item is no longer available. You can copy your draft before closing.');
  };

  return {
    formValues,
    formError,
    isSaving,
    isDeleting,
    deleteError,
    reloadEditor,
    isEditorOpen,
    isEditing,
    isDeleteConfirmOpen,
    editorTitle,
    deletePrompt,
    closeEditor,
    openCreateEditor,
    openEditEditor,
    handleFormChange,
    requestDelete,
    closeDeleteConfirm,
    handleConfirmDelete,
    handleEditorSubmit,
  };
}
