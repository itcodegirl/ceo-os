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
  defaultBlockers,
  defaultPriorities,
  defaultWins,
} from '../lib/weeklyData';
import { resolveNextValue, shallowEqualRecordArrays, shallowEqualRecords } from '../lib/stateUtils';
import { isStaleRecordError } from '../lib/staleRecordError';

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
  const [reviewNotes, setReviewNotesState] = useState(DEFAULT_REVIEW_NOTES);
  const [reviewNotesStatus, setReviewNotesStatus] = useState('idle');
  const [priorities, setPrioritiesState] = useState(defaultPriorities);
  const [wins, setWinsState] = useState(defaultWins);
  const [blockers, setBlockersState] = useState(defaultBlockers);

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

      setLoadError('');
      setSource((current) => (current === nextSource ? current : nextSource));
      setReviewNotesState((current) => (current === nextReviewNotes ? current : nextReviewNotes));
      setPrioritiesState((current) => (
        shallowEqualRecordArrays(current, nextPriorities) ? current : nextPriorities
      ));
      setWinsState((current) => (
        shallowEqualRecordArrays(current, nextWins) ? current : nextWins
      ));
      setBlockersState((current) => (
        shallowEqualRecordArrays(current, nextBlockers) ? current : nextBlockers
      ));
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
  }, [isMountedRef, weekStart]);

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

  const persistCollectionDiff = useCallback(async (itemType, previousItems, nextItems) => {
    const previousMap = new Map(previousItems.map((item) => [String(item.id), item]));
    const nextMap = new Map(nextItems.map((item) => [String(item.id), item]));
    let hasChanges = false;

    const deletedItems = [];
    previousMap.forEach((item, id) => {
      if (!nextMap.has(id)) {
        deletedItems.push(item);
      }
    });

    for (let index = 0; index < deletedItems.length; index += 1) {
      const deletedItem = deletedItems[index];
      const expectedUpdatedAt = Number(deletedItem?.updatedAt);
      await deleteWeeklyItem({
        weekStart,
        itemType,
        itemId: String(deletedItem.id),
        emitEvent: false,
        ...(Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt > 0
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
        await createWeeklyItem({
          weekStart,
          itemType,
          item: nextItem,
          sortOrder: index,
          emitEvent: false,
        });
        hasChanges = true;
        continue;
      }

      if (!shallowEqualRecords(previousItem, nextItem)) {
        const expectedUpdatedAt = Number(previousItem?.updatedAt);
        await updateWeeklyItem({
          weekStart,
          itemType,
          itemId: nextId,
          item: nextItem,
          sortOrder: index,
          emitEvent: false,
          ...(Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt > 0
            ? { expectedUpdatedAt }
            : {}),
        });
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
  }, [weekStart]);

  const setReviewNotes = useCallback((nextValue) => {
    setReviewNotesState((currentValue) => {
      const resolvedValue = resolveNextValue(nextValue, currentValue);
      const normalizedValue = typeof resolvedValue === 'string' ? resolvedValue : DEFAULT_REVIEW_NOTES;

      setReviewNotesStatus('saving');

      Promise.resolve(saveWeeklyBriefReviewNotes({
        weekStart,
        reviewNotes: normalizedValue,
      }))
        .then(() => {
          if (isMountedRef.current) {
            setReviewNotesStatus('saved');
          }
        })
        .catch((error) => {
          if (isMountedRef.current) {
            setReviewNotesStatus('error');
          }
          recoverAfterPersistenceFailure(
            'Unable to save weekly review notes right now.',
            'Failed to save weekly review notes',
            error,
          );
        });

      return normalizedValue;
    });
  }, [isMountedRef, recoverAfterPersistenceFailure, weekStart]);

  const setPriorities = useCallback((nextValue) => {
    setPrioritiesState((currentValue) => {
      const resolvedValue = resolveNextValue(nextValue, currentValue);
      const normalizedValue = normalizeArrayValue(resolvedValue, []);

      void persistCollectionDiff('priority', currentValue, normalizedValue).catch((error) => {
        recoverAfterPersistenceFailure(
          isStaleRecordError(error) ? STALE_RECORD_MESSAGE : 'Unable to save weekly priorities right now.',
          'Failed to persist weekly priorities',
          error,
        );
      });

      return normalizedValue;
    });
  }, [persistCollectionDiff, recoverAfterPersistenceFailure]);

  const setWins = useCallback((nextValue) => {
    setWinsState((currentValue) => {
      const resolvedValue = resolveNextValue(nextValue, currentValue);
      const normalizedValue = normalizeArrayValue(resolvedValue, []);

      void persistCollectionDiff('win', currentValue, normalizedValue).catch((error) => {
        recoverAfterPersistenceFailure(
          isStaleRecordError(error) ? STALE_RECORD_MESSAGE : 'Unable to save weekly wins right now.',
          'Failed to persist weekly wins',
          error,
        );
      });

      return normalizedValue;
    });
  }, [persistCollectionDiff, recoverAfterPersistenceFailure]);

  const setBlockers = useCallback((nextValue) => {
    setBlockersState((currentValue) => {
      const resolvedValue = resolveNextValue(nextValue, currentValue);
      const normalizedValue = normalizeArrayValue(resolvedValue, []);

      void persistCollectionDiff('blocker', currentValue, normalizedValue).catch((error) => {
        recoverAfterPersistenceFailure(
          isStaleRecordError(error) ? STALE_RECORD_MESSAGE : 'Unable to save weekly blockers right now.',
          'Failed to persist weekly blockers',
          error,
        );
      });

      return normalizedValue;
    });
  }, [persistCollectionDiff, recoverAfterPersistenceFailure]);

  return {
    weekStart,
    source,
    isLoading,
    loadError,
    reviewNotes,
    reviewNotesStatus,
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
