import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveNextValue } from '../lib/stateUtils';
import { preserveCorruptStorageValue } from '../lib/storageCorruption';
import { notifySaveFailed, notifySaveSucceeded } from '../lib/saveStatusBus';

const PERSISTENT_STATE_EVENT = 'ceo-os:persistent-state';

function resolveInitialValue(initialValue) {
  return typeof initialValue === 'function' ? initialValue() : initialValue;
}

function loadValue(key, initialValue, tabDraft = false) {
  if (typeof window === 'undefined') {
    return resolveInitialValue(initialValue);
  }

  let rawItem = null;
  try {
    rawItem = (tabDraft ? window.sessionStorage.getItem(key) : null) ?? window.localStorage.getItem(key);
    if (rawItem === null) {
      return resolveInitialValue(initialValue);
    }

    return JSON.parse(rawItem);
  } catch (error) {
    if (rawItem !== null) {
      preserveCorruptStorageValue(key, rawItem, error);
    }
    return resolveInitialValue(initialValue);
  }
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) {
    return true;
  }

  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!Object.is(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }
    if (!Object.is(left[key], right[key])) {
      return false;
    }
  }

  return true;
}

// Tab drafts keep a session copy across reloads and never follow another tab's
// composer. The local copy remains a fallback for a newly opened session.
export function usePersistentState(key, initialValue, { tabDraft = false } = {}) {
  const initialValueRef = useRef(initialValue);

  const [state, setState] = useState(() => ({
    key,
    value: loadValue(key, initialValue, tabDraft),
  }));

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    setState((currentState) => {
      if (currentState.key === key) {
        return currentState;
      }

      return {
        key,
        value: loadValue(key, initialValueRef.current, tabDraft),
      };
    });
  }, [key, tabDraft]);

  const value = state.key === key ? state.value : loadValue(key, initialValue, tabDraft);

  const setValue = useCallback((nextValue) => {
    setState((currentState) => {
      const currentValue = currentState.key === key
        ? currentState.value
        : loadValue(key, initialValueRef.current, tabDraft);
      const resolvedValue = resolveNextValue(nextValue, currentValue);

      if (currentState.key === key && valuesEqual(currentState.value, resolvedValue)) {
        return currentState;
      }

      return { key, value: resolvedValue };
    });
  }, [key, tabDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (state.key !== key) {
      return;
    }

    try {
      if (tabDraft) window.sessionStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(
        new CustomEvent(PERSISTENT_STATE_EVENT, {
          detail: { key, value },
        }),
      );
      notifySaveSucceeded(key);
    } catch (error) {
      notifySaveFailed(key, error);
      if (import.meta.env.DEV) {
        console.error('localStorage save failed', error);
      }
    }
  }, [key, state.key, value, tabDraft]);

  useEffect(() => {
    if (typeof window === 'undefined' || tabDraft) {
      return undefined;
    }

    const handleStorageChange = (event) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key !== key && event.key !== null) {
        return;
      }

      if (event.key === null || event.newValue === null) {
        setState((currentState) => {
          const nextValue = resolveInitialValue(initialValueRef.current);

          if (currentState.key === key && valuesEqual(currentState.value, nextValue)) {
            return currentState;
          }

          return { key, value: nextValue };
        });
        return;
      }

      try {
        const parsedValue = JSON.parse(event.newValue);
        setState((currentState) => {
          if (currentState.key === key && valuesEqual(currentState.value, parsedValue)) {
            return currentState;
          }

          return { key, value: parsedValue };
        });
      } catch (error) {
        preserveCorruptStorageValue(key, event.newValue, error);
        setState((currentState) => {
          const nextValue = resolveInitialValue(initialValueRef.current);

          if (currentState.key === key && valuesEqual(currentState.value, nextValue)) {
            return currentState;
          }

          return { key, value: nextValue };
        });
      }
    };

    const handleInPageStateChange = (event) => {
      const detail = event?.detail;
      if (!detail || detail.key !== key) {
        return;
      }

      setState((currentState) => {
        if (currentState.key === key && valuesEqual(currentState.value, detail.value)) {
          return currentState;
        }

        return { key, value: detail.value };
      });
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(PERSISTENT_STATE_EVENT, handleInPageStateChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(PERSISTENT_STATE_EVENT, handleInPageStateChange);
    };
  }, [key, tabDraft]);

  return [value, setValue];
}
