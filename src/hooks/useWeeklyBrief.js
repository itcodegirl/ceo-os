import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMountedRef } from './useIsMountedRef';
import { useSilentRefresh } from './useSilentRefresh';
import {
  WEEKLY_BRIEF_UPDATED_EVENT,
  createWeeklyItem,
  deleteWeeklyItem,
  emitWeeklyBriefUpdated,
  getCurrentWeekStart,
  getWeeklyBriefByWeek,
  resolveWeeklySource,
  saveWeeklyBriefReviewNotes,
  updateWeeklyItem,
} from '../lib/weeklyRepository';
import {
  DEFAULT_REVIEW_NOTES,
} from '../lib/weeklyData';
import { resolveNextValue, shallowEqualRecordArrays, shallowEqualRecords } from '../lib/stateUtils';
import { getWorkspaceOwnerId, assertWorkspaceOwner } from '../lib/workspaceOwnership';
import { useTextAutosave } from './useTextAutosave';
import { enqueueTextWrite } from '../lib/textAutosave';
import { isStaleRecordError, StaleRecordError } from '../lib/staleRecordError';

const STALE_RECORD_MESSAGE = 'A weekly item was changed in another window. We pulled the latest version. Try your edit again.';

// Module-scope constants keep useSilentRefresh's subscription deps stable.
const WEEKLY_REFRESH_EVENTS = [WEEKLY_BRIEF_UPDATED_EVENT];
const WEEKLY_STORAGE_KEYS = [
  'ceo-os-weekly-briefs',
  'ceo-os-weekly-priorities',
  'ceo-os-weekly-wins',
  'ceo-os-weekly-blockers',
  'ceo-os-weekly-review-notes',
];

function normalizeCollectionPayload(payload, key) {
  const values = Array.isArray(payload?.[key]) ? payload[key] : [];
  return values.map((item) => item);
}

function normalizeArrayValue(nextValue, fallbackValue) {
  return Array.isArray(nextValue) ? nextValue : fallbackValue;
}

export function useWeeklyBrief() {
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekStart());
  const weekStartRef = useRef(weekStart);
  const isMountedRef = useIsMountedRef();
  const requestIdRef = useRef(0);
  const [source, setSource] = useState(resolveWeeklySource());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const ownerId = getWorkspaceOwnerId();
  const saveNotes = useCallback((value) => {
    assertWorkspaceOwner(ownerId);
    return saveWeeklyBriefReviewNotes({ weekStart, reviewNotes: value, ownerId });
  }, [ownerId, weekStart]);
  const { draft: reviewDraft, value: reviewNotes, status: reviewNotesStatus } = useTextAutosave({
    resourceKey: `weekly:${ownerId}:${weekStart}`, save: saveNotes,
  });
  const [priorities, setPrioritiesState] = useState([]);
  const [wins, setWinsState] = useState([]);
  const [blockers, setBlockersState] = useState([]);

  // Refs mirror the latest committed value of each editable collection so the
  // setters can read the "previous" value synchronously (like Journal.jsx's
  // entryRef) instead of inside a setState updater. Keeping persistence out of
  // the updaters means React 18 StrictMode's dev-only double-invocation of
  // updaters can't fire duplicate writes. Every place that commits one of these
  // values updates both the state and its ref in lock-step.
  const prioritiesRef = useRef(priorities);
  const winsRef = useRef(wins);
  const blockersRef = useRef(blockers);

  useEffect(() => {
    weekStartRef.current = weekStart;
  }, [weekStart]);

  useEffect(() => {
    const msUntilNextMinute = 60 * 1000 - (Date.now() % (60 * 1000));
    let intervalId = null;

    const checkAndUpdateWeek = () => {
      const currentWeekStart = getCurrentWeekStart();
      if (currentWeekStart !== weekStartRef.current) {
        setWeekStart(currentWeekStart);
      }
    };

    const timerId = window.setTimeout(() => {
      checkAndUpdateWeek();
      intervalId = window.setInterval(checkAndUpdateWeek, 60 * 1000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timerId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const loadWeeklyBrief = useCallback(async ({ silent = false } = {}) => {
    const draftRevision = reviewDraft.getRevision();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!silent) {
      setIsLoading(true);
      setLoadError('');
    }

    try {
      const payload = await getWeeklyBriefByWeek(weekStart);
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      const nextSource = payload.source || resolveWeeklySource();
      const nextReviewNotes = typeof payload.reviewNotes === 'string'
        ? payload.reviewNotes
        : DEFAULT_REVIEW_NOTES;
      const nextPriorities = normalizeCollectionPayload(payload, 'priorities');
      const nextWins = normalizeCollectionPayload(payload, 'wins');
      const nextBlockers = normalizeCollectionPayload(payload, 'blockers');

      // Commit each value and keep its ref in lock-step. The refs mirror the
      // committed React state, so comparing against `*Ref.current` reproduces
      // the previous functional-updater bail-out (skip the write, preserve the
      // reference) without reading state inside an updater.
      setLoadError('');
      setSource((current) => (current === nextSource ? current : nextSource));

      reviewDraft.receive(nextReviewNotes, draftRevision);
      if (!shallowEqualRecordArrays(prioritiesRef.current, nextPriorities)) {
        prioritiesRef.current = nextPriorities;
        setPrioritiesState(nextPriorities);
      }
      if (!shallowEqualRecordArrays(winsRef.current, nextWins)) {
        winsRef.current = nextWins;
        setWinsState(nextWins);
      }
      if (!shallowEqualRecordArrays(blockersRef.current, nextBlockers)) {
        blockersRef.current = nextBlockers;
        setBlockersState(nextBlockers);
      }
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setLoadError('Unable to load weekly brief right now.');
      if (import.meta.env.DEV) {
        console.error('Failed to load weekly brief', error);
      }
    } finally {
      if (!silent && isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [isMountedRef, reviewDraft, weekStart]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      loadWeeklyBrief();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loadWeeklyBrief]);

  const handleSilentRefresh = useCallback(() => {
    void loadWeeklyBrief({ silent: true });
  }, [loadWeeklyBrief]);

  // Skip weekly-brief events aimed at a different week than the one we're
  // showing; storage / focus / visibility refreshes always apply. Reads the
  // ref so the filter stays stable across week rollovers.
  const matchesCurrentWeek = useCallback((event) => {
    const updatedWeekStart = event?.detail?.weekStart;
    return !updatedWeekStart || updatedWeekStart === weekStartRef.current;
  }, []);

  // Shared subscription manager (replaces four hand-rolled listeners + a
  // manual 400ms coalesce). useSilentRefresh's default coalesce window matches
  // the previous SILENT_REFRESH_COALESCE_MS.
  useSilentRefresh({
    events: WEEKLY_REFRESH_EVENTS,
    storageKeys: WEEKLY_STORAGE_KEYS,
    eventFilter: matchesCurrentWeek,
    onRefresh: handleSilentRefresh,
  });

  const recoverAfterPersistenceFailure = useCallback((message, logLabel, error) => {
    setLoadError(message);
    if (import.meta.env.DEV) {
      console.error(logLabel, error);
    }
    void loadWeeklyBrief({ silent: true });
  }, [loadWeeklyBrief]);

  const persistCollectionDiff = useCallback(async (itemType, previousItems, nextItems, options = {}) => {
    assertWorkspaceOwner(ownerId);
    if (options.itemId && !previousItems.some((item) => String(item.id) === String(options.itemId))) {
      throw new StaleRecordError('This item was removed in another window. Your draft is still here.');
    }
    const previousMap = new Map(previousItems.map((item) => [String(item.id), item]));
    const nextMap = new Map(nextItems.map((item) => [String(item.id), item]));
    let hasChanges = false;
    const persistedItems = [...nextItems];

    const deletedItems = [];
    previousMap.forEach((item, id) => {
      if (!nextMap.has(id)) {
        deletedItems.push(item);
      }
    });

    for (let index = 0; index < deletedItems.length; index += 1) {
      const deletedItem = deletedItems[index];
      const expectedUpdatedAt = Number(options.itemId === String(deletedItem.id) ? options.expectedUpdatedAt : deletedItem?.updatedAt);
      await deleteWeeklyItem({
        weekStart,
        ownerId,
        itemType,
        itemId: String(deletedItem.id),
        emitEvent: false,
        ...(Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt >= 0
          ? { expectedUpdatedAt }
          : {}),
      });
      hasChanges = true;
    }

    for (let index = 0; index < nextItems.length; index += 1) {
      const nextItem = nextItems[index];
      const nextId = String(nextItem.id);
      const previousItem = previousMap.get(nextId);

      if (!previousItem) {
        const saved = await createWeeklyItem({
          weekStart,
          ownerId,
          itemType,
          item: nextItem,
          sortOrder: index,
          emitEvent: false,
        });
        if (saved) persistedItems[index] = saved;
        hasChanges = true;
        continue;
      }

      if (!shallowEqualRecords(previousItem, nextItem)) {
        const expectedUpdatedAt = Number(options.itemId === nextId ? options.expectedUpdatedAt : previousItem?.updatedAt);
        const saved = await updateWeeklyItem({
          weekStart,
          ownerId,
          itemType,
          itemId: nextId,
          item: nextItem,
          sortOrder: index,
          emitEvent: false,
          ...(Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt >= 0
            ? { expectedUpdatedAt }
            : {}),
        });
        if (saved) persistedItems[index] = saved;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      emitWeeklyBriefUpdated({
        weekStart,
        source: resolveWeeklySource(),
        mutation: 'sync_items',
        itemType,
      });
    }
    return persistedItems;
  }, [ownerId, weekStart]);

  const setReviewNotes = useCallback((nextValue) => {
    const resolved = resolveNextValue(nextValue, reviewDraft.getSnapshot().value);
    reviewDraft.set(typeof resolved === 'string' ? resolved : DEFAULT_REVIEW_NOTES);
  }, [reviewDraft]);

  // Shared implementation for the three collection setters. Reads the previous
  // value from the ref, commits the optimistic next value (state + ref), then
  // diffs and persists — all outside any setState updater so StrictMode's
  // double-invoke can't fire duplicate writes. On failure it recovers from the
  // persisted state via a silent reload.
  const commitCollection = useCallback((ref, setState, itemType, nextValue, errorMessage, logLabel, options) => {
    const currentValue = ref.current;
    const resolvedValue = resolveNextValue(nextValue, currentValue);
    const normalizedValue = normalizeArrayValue(resolvedValue, []);

    ref.current = normalizedValue;
    setState(normalizedValue);

    return enqueueTextWrite(`weekly-items:${ownerId}:${weekStart}:${itemType}`, () =>
      persistCollectionDiff(itemType, currentValue, normalizedValue, options)).then((persisted) => {
      if (ref.current === normalizedValue) {
        ref.current = persisted;
        if (isMountedRef.current) setState(persisted);
      }
    }).catch((error) => {
      if (ref.current === normalizedValue) { ref.current = currentValue; setState(currentValue); }
      recoverAfterPersistenceFailure(
        isStaleRecordError(error) ? STALE_RECORD_MESSAGE : errorMessage,
        logLabel,
        error,
      );
      throw error;
    });
  }, [isMountedRef, ownerId, weekStart, persistCollectionDiff, recoverAfterPersistenceFailure]);

  const setPriorities = useCallback((nextValue, options) => {
    return commitCollection(
      prioritiesRef,
      setPrioritiesState,
      'priority',
      nextValue,
      'Unable to save weekly priorities right now.',
      'Failed to persist weekly priorities',
      options,
    );
  }, [commitCollection]);

  const setWins = useCallback((nextValue, options) => {
    return commitCollection(
      winsRef,
      setWinsState,
      'win',
      nextValue,
      'Unable to save weekly wins right now.',
      'Failed to persist weekly wins',
      options,
    );
  }, [commitCollection]);

  const setBlockers = useCallback((nextValue, options) => {
    return commitCollection(
      blockersRef,
      setBlockersState,
      'blocker',
      nextValue,
      'Unable to save weekly blockers right now.',
      'Failed to persist weekly blockers',
      options,
    );
  }, [commitCollection]);

  return {
    weekStart,
    source,
    isLoading,
    loadError,
    reviewNotes,
    reviewNotesStatus,
    retryReviewNotes: reviewDraft.flush,
    priorities,
    wins,
    blockers,
    setReviewNotes,
    setPriorities,
    setWins,
    setBlockers,
    refreshWeeklyBrief: loadWeeklyBrief,
  };
}
