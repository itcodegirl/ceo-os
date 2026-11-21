import { useCallback, useMemo, useRef, useState } from 'react';
import { useIsMountedRef } from './useIsMountedRef';

const DEFAULT_CONFIRM_STATE = {
  isOpen: false,
  message: '',
  payload: null,
};

function resolveOptions(input, maybeMessageResolver) {
  if (typeof input === 'function') {
    return {
      onConfirm: input,
      getMessage: maybeMessageResolver,
    };
  }

  return {
    onConfirm: input?.onConfirm,
    getMessage: input?.getMessage || maybeMessageResolver,
  };
}

export function useConfirmDelete(onConfirm, getMessage) {
  const { onConfirmFn, getMessageFn } = useMemo(() => {
    const options = resolveOptions(onConfirm, getMessage);
    return {
      onConfirmFn: typeof options.onConfirm === 'function' ? options.onConfirm : null,
      getMessageFn: typeof options.getMessage === 'function' ? options.getMessage : null,
    };
  }, [onConfirm, getMessage]);

  const [confirmState, setConfirmState] = useState(DEFAULT_CONFIRM_STATE);
  const [isConfirmPending, setIsConfirmPending] = useState(false);
  const isMountedRef = useIsMountedRef();
  const pendingRef = useRef(false);

  const requestConfirm = useCallback((payload) => {
    if (isConfirmPending) {
      return;
    }

    const safePayload = payload === null || payload === undefined ? null : payload;
    const message = getMessageFn
      ? getMessageFn(safePayload)
      : safePayload?.message || '';

    setConfirmState({
      isOpen: true,
      message,
      payload: safePayload,
    });
  }, [getMessageFn, isConfirmPending]);

  const closeConfirm = useCallback(() => {
    if (isConfirmPending) {
      return;
    }

    setConfirmState(DEFAULT_CONFIRM_STATE);
  }, [isConfirmPending]);

  const resetConfirm = useCallback(() => {
    setConfirmState(DEFAULT_CONFIRM_STATE);
    setIsConfirmPending(false);
  }, []);

  const confirm = useCallback(async () => {
    if (!confirmState.isOpen || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsConfirmPending(true);
    try {
      await onConfirmFn?.(confirmState.payload);
      if (isMountedRef.current) {
        setConfirmState(DEFAULT_CONFIRM_STATE);
      }
    } finally {
      pendingRef.current = false;
      if (isMountedRef.current) {
        setIsConfirmPending(false);
      }
    }
  }, [confirmState.isOpen, confirmState.payload, isMountedRef, onConfirmFn]);

  return {
    isConfirmOpen: confirmState.isOpen,
    confirmMessage: confirmState.message,
    confirmPayload: confirmState.payload,
    isConfirmPending,
    requestConfirm,
    closeConfirm,
    resetConfirm,
    confirm,
  };
}
