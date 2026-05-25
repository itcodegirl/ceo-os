import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfirmDelete } from './useConfirmDelete';
import { useIsMountedRef } from './useIsMountedRef';
import { useToast } from './useToast';
import { getRepositoryErrorMessage } from '../lib/repositoryErrors';
import { isStaleRecordError } from '../lib/staleRecordError';

const STALE_RECORD_FORM_MESSAGE =
  'This record was changed in another window. Reload to see the latest version before saving.';

function isValidCrudItem(value) {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim());
}

export function useCrudPage(config) {
  const {
    defaultFormValues,
    validate,
    validatePayload,
    parsePayload,
    listItems,
    createItem,
    updateItem,
    deleteItem,
    updatedEventName,
    mapItemToFormValues,
    mapFormValuesToPayload,
    getDeleteLabel,
    messages = {},
    logPrefix = 'items',
  } = config || {};

  const validatePayloadFn = useMemo(() => (
    typeof (validate ?? validatePayload) === 'function'
      ? validate ?? validatePayload
      : () => ''
  ), [validate, validatePayload]);
  const defaultFormValuesResolved = useMemo(
    () => defaultFormValues ?? {},
    [defaultFormValues],
  );
  const loadErrorMessage = messages.load || 'Unable to load items right now.';
  const saveErrorMessage = messages.save || 'Unable to save item right now.';
  const deleteErrorMessage = messages.delete || 'Unable to delete item right now.';
  const createSuccessMessage = messages.createSuccess || 'Item created.';
  const updateSuccessMessage = messages.updateSuccess || 'Item updated.';
  const deleteSuccessMessage = messages.deleteSuccess || 'Item deleted.';
  const { showToast, hideToast } = useToast();
  const resolveDeleteMessage = useCallback((itemToDelete) => {
    if (!itemToDelete) {
      return 'Delete this item? This cannot be undone.';
    }

    return typeof getDeleteLabel === 'function'
      ? `Delete "${getDeleteLabel(itemToDelete)}"? This cannot be undone.`
      : 'Delete this item? This cannot be undone.';
  }, [getDeleteLabel]);

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedItemState, setSelectedItemState] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValuesResolved);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const selectedItem = selectedItemState;
  const isSavingRef = useRef(false);
  const resetSavingRef = useCallback(() => {
    isSavingRef.current = false;
  }, []);
  const isMountedRef = useIsMountedRef(resetSavingRef);

  const {
    isConfirmOpen: isDeleteConfirmOpen,
    confirmMessage: deletePrompt,
    isConfirmPending: isDeleting,
    requestConfirm,
    closeConfirm: closeDeleteConfirm,
    resetConfirm,
    confirm: confirmDelete,
  } = useConfirmDelete(
    async (itemToDelete) => {
      if (!itemToDelete) {
        return;
      }

      try {
        setLoadError('');
        if (typeof deleteItem !== 'function') {
          throw new Error('Delete operation is not configured.');
        }
        await deleteItem(itemToDelete.id);
        if (!isMountedRef.current) {
          return;
        }
        setItems((current) => current.filter((item) => item.id !== itemToDelete.id));
        setSelectedItemState(null);
        showToast(deleteSuccessMessage);
      } catch (error) {
        if (isMountedRef.current) {
          setLoadError(deleteErrorMessage);
        }
        if (import.meta.env.DEV) {
          console.error(`Failed to delete ${logPrefix}`, error);
        }
        throw error;
      }
    },
    resolveDeleteMessage,
  );

  const setSelectedItem = useCallback((nextItem) => {
    setSelectedItemState(nextItem);
    if (!nextItem) {
      resetConfirm();
    }
  }, [resetConfirm]);

  useEffect(() => {
    let isActive = true;
    // refreshToken === 0 is the first mount (cold load); any positive value
    // is a refresh triggered by refreshItems(). Refreshes already have items
    // on screen, so we keep the loading state quiet and avoid a skeleton
    // flash whenever the repository fires its UPDATED_EVENT after a write.
    const isInitialLoad = refreshToken === 0;

    const load = async () => {
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setLoadError('');
      if (typeof listItems !== 'function') {
        if (isActive) {
          setItems([]);
          setLoadError(loadErrorMessage);
          if (isInitialLoad) {
            setIsLoading(false);
          }
        }
        return;
      }
      try {
        const nextItems = await listItems();
        if (!Array.isArray(nextItems)) {
          if (isActive) {
            setItems([]);
            setLoadError(loadErrorMessage);
          }
          if (import.meta.env.DEV) {
            console.error(`Failed to load ${logPrefix}`, new Error('List operation returned a non-array result.'));
          }
          return;
        }
        if (isActive) {
          setItems(nextItems);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        setLoadError(loadErrorMessage);
        if (import.meta.env.DEV) {
          console.error(`Failed to load ${logPrefix}`, error);
        }
      } finally {
        if (isActive && isInitialLoad) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [listItems, loadErrorMessage, logPrefix, refreshToken]);

  const refreshItems = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  // When the repository advertises an updated-event name, subscribe so that
  // writes from other surfaces (cross-page promotions, other tabs) silently
  // refresh this page's list without forcing the user to reload. We
  // intentionally ignore detail.source so events fired by both local and
  // supabase paths trigger a refetch.
  useEffect(() => {
    if (typeof updatedEventName !== 'string' || !updatedEventName) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleUpdate = () => {
      refreshItems();
    };

    window.addEventListener(updatedEventName, handleUpdate);
    return () => {
      window.removeEventListener(updatedEventName, handleUpdate);
    };
  }, [refreshItems, updatedEventName]);

  const resetForm = useCallback(() => {
    setFormValues(defaultFormValuesResolved);
    setFormError('');
  }, [defaultFormValuesResolved]);

  const handleOpenCreateModal = useCallback(() => {
    hideToast();
    setSelectedItem(null);
    resetForm();
    setIsFormOpen(true);
  }, [hideToast, resetForm, setSelectedItem]);

  const handleOpenEditModal = useCallback(() => {
    if (!selectedItem || !mapItemToFormValues) {
      return;
    }

    setFormValues(mapItemToFormValues(selectedItem));
    setFormError('');
    hideToast();
    closeDeleteConfirm();
    setIsFormOpen(true);
  }, [closeDeleteConfirm, hideToast, mapItemToFormValues, selectedItem]);

  const handleCloseFormModal = useCallback(() => {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setFormError('');
  }, [isSaving]);

  const handleOpenDeleteConfirm = useCallback(() => {
    if (!selectedItem || isDeleting) {
      return;
    }

    requestConfirm(selectedItem);
  }, [isDeleting, requestConfirm, selectedItem]);

  const handleCloseDeleteConfirm = useCallback(() => {
    closeDeleteConfirm();
  }, [closeDeleteConfirm]);

  const handleFormChange = useCallback((field, value) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const handleFormSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (isSavingRef.current) {
      return;
    }

    let payload;
    let validationError = '';
    if (typeof parsePayload === 'function') {
      // Single-step parse + normalize via valibot schema. The schema's
      // transformed output is the payload sent to the repository, so the
      // page no longer needs a sibling mapFormValuesToPayload helper.
      const parsed = parsePayload(formValues);
      payload = parsed?.payload;
      validationError = parsed?.error || '';
      if (!validationError) {
        validationError = validatePayloadFn(payload, { items, selectedItem });
      }
    } else {
      payload = mapFormValuesToPayload ? mapFormValuesToPayload(formValues) : formValues;
      validationError = validatePayloadFn(payload, { items, selectedItem });
    }

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (selectedItem && typeof updateItem !== 'function') {
      setFormError(saveErrorMessage);
      return;
    }
    if (!selectedItem && typeof createItem !== 'function') {
      setFormError(saveErrorMessage);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setFormError('');
    setLoadError('');

    try {
      if (selectedItem) {
        const expectedUpdatedAt = Number(selectedItem.updatedAt);
        const updated = Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt > 0
          ? await updateItem(selectedItem.id, payload, { expectedUpdatedAt })
          : await updateItem(selectedItem.id, payload);
        if (!isMountedRef.current) {
          return;
        }
        if (!isValidCrudItem(updated)) {
          throw new Error('Update operation returned an invalid item shape.');
        }
        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedItemState(updated);
        showToast(updateSuccessMessage);
      } else {
        const created = await createItem(payload);
        if (!isMountedRef.current) {
          return;
        }
        if (!isValidCrudItem(created)) {
          throw new Error('Create operation returned an invalid item shape.');
        }
        setItems((current) => [created, ...current]);
        showToast(createSuccessMessage);
      }

      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      const isStale = isStaleRecordError(error);
      if (isMountedRef.current) {
        setFormError(isStale ? STALE_RECORD_FORM_MESSAGE : getRepositoryErrorMessage(error, saveErrorMessage));
      }
      if (isStale) {
        // Pull the latest snapshot so closing the modal shows the up-to-date row.
        refreshItems();
      }
      if (import.meta.env.DEV) {
        console.error(`Failed to save ${logPrefix}`, error);
      }
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [
    createItem,
    createSuccessMessage,
    formValues,
    items,
    isMountedRef,
    logPrefix,
    mapFormValuesToPayload,
    parsePayload,
    refreshItems,
    saveErrorMessage,
    resetForm,
    selectedItem,
    showToast,
    updateSuccessMessage,
    updateItem,
    validatePayloadFn,
  ]);

  const handleConfirmDeleteSelected = useCallback(async () => {
    try {
      await confirmDelete();
    } catch {
      // Error state is already set in onConfirm; keep modal open so the user can retry.
    }
  }, [confirmDelete]);

  return {
    isLoading,
    items,
    selectedItem,
    setSelectedItem,
    isFormOpen,
    isDeleteConfirmOpen,
    isSaving,
    isDeleting,
    formValues,
    formError,
    loadError,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseFormModal,
    handleFormChange,
    handleFormSubmit,
    handleOpenDeleteConfirm,
    handleCloseDeleteConfirm,
    handleConfirmDeleteSelected,
    deletePrompt,
    refreshItems,
  };
}
