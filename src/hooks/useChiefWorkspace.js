import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getChiefSource,
  loadChiefWorkspace,
  resetChiefWorkspace,
  saveChiefNotes,
} from '../lib/chiefRepository';
import { getWorkspaceOwnerId, assertWorkspaceOwner } from '../lib/workspaceOwnership';
import { CHIEF_OUTPUT_SAVED_EVENT } from '../lib/chiefLifecycle';
import { useTextAutosave } from './useTextAutosave';
import { resolveNextValue } from '../lib/stateUtils';

function resolveNotes(nextNotes) {
  return typeof nextNotes === 'string' ? nextNotes : '';
}

function normalizeWorkspaceResponses(nextResponses) {
  if (!Array.isArray(nextResponses)) {
    return [];
  }

  return nextResponses.filter((item) => item && typeof item === 'object');
}

export function useChiefWorkspace({ isMountedRef }) {
  const ownerId = getWorkspaceOwnerId();
  const persistNotes = useCallback((value) => {
    assertWorkspaceOwner(ownerId);
    return saveChiefNotes(value, { ownerId });
  }, [ownerId]);
  const { draft, value: notes, status: notesStatus } = useTextAutosave({
    resourceKey: `chief-notes:${ownerId}`, save: persistNotes,
  });
  const [responses, setResponsesState] = useState([]);
  const responsesRef = useRef([]);
  const [source, setSource] = useState(getChiefSource());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requestIdRef = useRef(0);

  const beginWorkspaceRequest = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    return requestId;
  }, []);

  const invalidatePendingWorkspaceLoad = useCallback(() => {
    const requestId = beginWorkspaceRequest();
    setIsLoading(false);
    return requestId;
  }, [beginWorkspaceRequest]);

  const loadWorkspace = useCallback(async () => {
    const requestId = beginWorkspaceRequest();
    const draftRevision = draft.getRevision();
    setIsLoading(true);
    setLoadError('');

    try {
      const workspace = await loadChiefWorkspace();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return [];
      }

      const workspaceResponses = normalizeWorkspaceResponses(workspace.responses);
      draft.receive(resolveNotes(workspace.notes), draftRevision);
      responsesRef.current = workspaceResponses;
      setResponsesState(workspaceResponses);
      setSource(workspace.source || getChiefSource());
      return workspaceResponses;
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return [];
      }

      setLoadError('Unable to load chief of staff workspace right now.');
      if (import.meta.env.DEV) {
        console.error('Failed to load chief workspace', error);
      }
      return [];
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [beginWorkspaceRequest, draft, isMountedRef]);

  const setResponses = useCallback((nextValue) => {
    invalidatePendingWorkspaceLoad();
    const next = normalizeWorkspaceResponses(resolveNextValue(nextValue, responsesRef.current));
    responsesRef.current = next;
    setResponsesState(next);
    return next;
  }, [invalidatePendingWorkspaceLoad]);

  const setNotes = useCallback((nextNotes) => {
    draft.set(resolveNotes(nextNotes));
  }, [draft]);

  const appendPrompt = useCallback((value) => {
    const prompt = resolveNotes(value).trim();
    if (!prompt) return;
    const existing = draft.getSnapshot().value.trimEnd();
    draft.set(existing ? `${existing}\n\n${prompt}` : prompt);
  }, [draft]);

  useEffect(() => {
    const refresh = () => { void loadWorkspace(); };
    window.addEventListener(CHIEF_OUTPUT_SAVED_EVENT, refresh);
    return () => window.removeEventListener(CHIEF_OUTPUT_SAVED_EVENT, refresh);
  }, [loadWorkspace]);

  const clearWorkspace = useCallback(async () => {
    const requestId = invalidatePendingWorkspaceLoad();

    try {
      await draft.flush();
      await resetChiefWorkspace();
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return false;
      }

      draft.clear();
      responsesRef.current = [];
      setResponsesState([]);
      setLoadError('');
      return true;
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return false;
      }

      setLoadError('Unable to clear workspace right now.');
      if (import.meta.env.DEV) {
        console.error('Failed to clear chief workspace', error);
      }
      return false;
    }
  }, [draft, invalidatePendingWorkspaceLoad, isMountedRef]);

  return {
    notes,
    notesStatus,
    retryNotes: draft.flush,
    responses,
    source,
    isLoading,
    loadError,
    setResponses,
    setLoadError,
    setNotes,
    appendPrompt,
    loadWorkspace,
    clearWorkspace,
  };
}
