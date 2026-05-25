import { useCallback, useRef, useState } from 'react';
import { createOpportunity, listOpportunities } from '../lib/opportunitiesRepository';
import { createContentItem, listContentItems } from '../lib/contentRepository';
import { createWeeklyItem, getCurrentWeekStart, getWeeklyBriefByWeek } from '../lib/weeklyRepository';
import { FEEDBACK_KIND } from '../lib/chiefFeedback';
import { buildCreateId } from '../lib/utils';

const ACCEPTANCE_STATUS = {
  SAVED: 'saved',
  SKIPPED: 'skipped',
  FAILED: 'failed',
};

const SHARED_TEXT_FIELDS = ['title', 'name', 'text', 'summary', 'task'];
const NAME_FIRST_TEXT_FIELDS = ['name', 'title', 'text', 'summary', 'task'];

function normalizeComparableValue(value) {
  return String(value || '').trim().toLowerCase();
}

function pickFirstString(value, fields) {
  if (!value || typeof value !== 'object') return '';
  for (const field of fields) {
    const candidate = value[field];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate != null && typeof candidate !== 'object') {
      const coerced = String(candidate).trim();
      if (coerced) return coerced;
    }
  }
  return '';
}

function pickFirstNormalized(value, fields) {
  return normalizeComparableValue(pickFirstString(value, fields));
}

function resolveStructuredText(item) {
  if (typeof item === 'string') {
    return item.trim();
  }
  return pickFirstString(item, SHARED_TEXT_FIELDS);
}

function combineParts(primary, secondary) {
  if (!primary) return '';
  return secondary ? `${primary}|${secondary}` : `${primary}|`;
}

/**
 * Pure-data descriptor table that drives every section the Chief of Staff
 * structured-output flow accepts. Both the section-keyed dedup keys and the
 * repository-level signatures are derived from the same primary/secondary
 * field lists, so adding a new section is a one-entry change instead of a
 * three-place scatter.
 */
const SECTION_DESCRIPTORS = {
  opportunities: {
    primaryFields: NAME_FIRST_TEXT_FIELDS,
    keySecondaryFields: ['company', 'organization'],
    signatureSecondaryFields: ['company', 'organization'],
    cacheKey: 'opportunities',
    missingTextMessage: 'This opportunity entry is missing a name.',
    missingTextReason: 'missing_name',
    duplicateMessage: 'That opportunity already exists.',
    successMessage: 'Added an opportunity from the structured AI output.',
    save: ({ itemValue, primaryText }) => createOpportunity({
      name: primaryText,
      company: itemValue.company || '',
      priority: itemValue.priority || 'Medium',
      stage: itemValue.stage || 'New',
      nextStep: itemValue.nextStep || itemValue.next_step || '',
    }),
  },
  contentItems: {
    primaryFields: SHARED_TEXT_FIELDS,
    keySecondaryFields: ['platform', 'channel'],
    signatureSecondaryFields: ['platform', 'channel'],
    cacheKey: 'content',
    missingTextMessage: 'This content entry is missing a title.',
    missingTextReason: 'missing_title',
    duplicateMessage: 'That content item already exists.',
    successMessage: 'Added a content item from the structured AI output.',
    save: ({ itemValue, primaryText }) => createContentItem({
      title: primaryText,
      platform: itemValue.platform || itemValue.channel || '',
      status: itemValue.status || 'Drafting',
    }),
  },
  priorities: {
    primaryFields: SHARED_TEXT_FIELDS,
    keySecondaryFields: ['owner', 'assignee'],
    signatureSecondaryFields: [],
    cacheKey: 'weeklyPriorities',
    missingTextMessage: 'This priority entry is missing a title.',
    missingTextReason: 'missing_title',
    duplicateMessage: 'That weekly priority already exists.',
    successMessage: 'Added a weekly priority from the structured AI output.',
    save: ({ itemValue, primaryText, ctx }) => createWeeklyItem({
      weekStart: ctx.currentWeekStart,
      itemType: 'priority',
      item: {
        id: buildCreateId(),
        title: primaryText,
        owner: itemValue.owner || 'Team Member',
        status: itemValue.status || 'Planned',
      },
    }),
  },
};

// `tasks` shares everything with `priorities` except its section key (which is
// what gates the in-flight/accepted maps). Reusing the descriptor means the
// save behavior, signature shape, and copy stay in lock-step automatically.
SECTION_DESCRIPTORS.tasks = SECTION_DESCRIPTORS.priorities;

function buildItemKey(sectionKey, item) {
  const descriptor = SECTION_DESCRIPTORS[sectionKey];
  if (!descriptor) return '';
  const itemValue = item && typeof item === 'object'
    ? item
    : { title: resolveStructuredText(item) };
  const primary = pickFirstNormalized(itemValue, descriptor.primaryFields);
  if (!primary) return '';
  const secondary = pickFirstNormalized(itemValue, descriptor.keySecondaryFields);
  return `${sectionKey}:${combineParts(primary, secondary)}`;
}

function buildItemSignature(descriptor, item) {
  const itemValue = item && typeof item === 'object' ? item : {};
  const primary = pickFirstNormalized(itemValue, descriptor.primaryFields);
  if (!primary) return '';
  if (!descriptor.signatureSecondaryFields.length) {
    return primary;
  }
  const secondary = pickFirstNormalized(itemValue, descriptor.signatureSecondaryFields);
  return combineParts(primary, secondary);
}

export function useChiefStructuredAcceptance({
  responses = [],
  // (kind, text) — see src/lib/chiefFeedback.js. Each call site here is
  // tagged with the kind that matches the user-facing outcome.
  pushFeedback,
  setLoadError,
  trackTelemetry,
  isMountedRef,
}) {
  const [acceptedStructuredItemMap, setAcceptedStructuredItemMap] = useState({});
  const [acceptingStructuredItemMap, setAcceptingStructuredItemMap] = useState({});
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const acceptedStructuredItemMapRef = useRef({});
  const acceptingStructuredItemMapRef = useRef({});
  const acceptingStructuredItemRef = useRef(new Set());
  const acceptingAllRef = useRef(false);
  const opportunitySignaturesRef = useRef(null);
  const contentSignaturesRef = useRef(null);
  const weeklyPrioritySignaturesByWeekRef = useRef(new Map());

  const notifyTelemetry = useCallback((eventName, payload = {}) => {
    if (typeof trackTelemetry === 'function') {
      trackTelemetry(eventName, payload);
    }
  }, [trackTelemetry]);

  const updateAcceptedStructuredItemMap = useCallback((nextOrUpdater) => {
    setAcceptedStructuredItemMap((current) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater;
      acceptedStructuredItemMapRef.current = next;
      return next;
    });
  }, []);

  const updateAcceptingStructuredItemMap = useCallback((nextOrUpdater) => {
    setAcceptingStructuredItemMap((current) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater;
      acceptingStructuredItemMapRef.current = next;
      return next;
    });
  }, []);

  const resetAcceptanceCaches = useCallback(() => {
    opportunitySignaturesRef.current = null;
    contentSignaturesRef.current = null;
    weeklyPrioritySignaturesByWeekRef.current = new Map();
  }, []);

  const resetAcceptanceState = useCallback(() => {
    updateAcceptedStructuredItemMap({});
    updateAcceptingStructuredItemMap({});
    setIsAcceptingAll(false);
    acceptingStructuredItemRef.current.clear();
    acceptingAllRef.current = false;
  }, [updateAcceptedStructuredItemMap, updateAcceptingStructuredItemMap]);

  const getOpportunitySignatures = useCallback(async () => {
    if (opportunitySignaturesRef.current) {
      return opportunitySignaturesRef.current;
    }

    const items = await listOpportunities();
    const signatures = new Set(
      items
        .map((entry) => buildItemSignature(SECTION_DESCRIPTORS.opportunities, entry))
        .filter(Boolean),
    );
    opportunitySignaturesRef.current = signatures;
    return signatures;
  }, []);

  const getContentSignatures = useCallback(async () => {
    if (contentSignaturesRef.current) {
      return contentSignaturesRef.current;
    }

    const items = await listContentItems();
    const signatures = new Set(
      items
        .map((entry) => buildItemSignature(SECTION_DESCRIPTORS.contentItems, entry))
        .filter(Boolean),
    );
    contentSignaturesRef.current = signatures;
    return signatures;
  }, []);

  const getWeeklyPrioritySignatures = useCallback(async (weekStart) => {
    if (weeklyPrioritySignaturesByWeekRef.current.has(weekStart)) {
      return weeklyPrioritySignaturesByWeekRef.current.get(weekStart);
    }

    const brief = await getWeeklyBriefByWeek(weekStart);
    const priorities = Array.isArray(brief.priorities) ? brief.priorities : [];
    const signatures = new Set(
      priorities
        .map((entry) => buildItemSignature(SECTION_DESCRIPTORS.priorities, entry))
        .filter(Boolean),
    );

    weeklyPrioritySignaturesByWeekRef.current.set(weekStart, signatures);
    return signatures;
  }, []);

  // Maps a descriptor's cacheKey to the appropriate cached-Set loader. Each
  // section uses its own loader: opportunities/content read from their
  // repositories on first call; priorities/tasks share a per-week cache.
  const loadSignatures = useCallback(async (descriptor) => {
    if (descriptor.cacheKey === 'opportunities') {
      return getOpportunitySignatures();
    }
    if (descriptor.cacheKey === 'content') {
      return getContentSignatures();
    }
    if (descriptor.cacheKey === 'weeklyPriorities') {
      return getWeeklyPrioritySignatures(getCurrentWeekStart());
    }
    return new Set();
  }, [getContentSignatures, getOpportunitySignatures, getWeeklyPrioritySignatures]);

  const pushFeedbackIfAllowed = useCallback((kind, message, suppressFeedback = false) => {
    if (!suppressFeedback && typeof pushFeedback === 'function') {
      pushFeedback(kind, message);
    }
  }, [pushFeedback]);

  const hydrateAcceptedStructuredItems = useCallback(async (workspaceResponses) => {
    const responseEntries = Array.isArray(workspaceResponses) ? workspaceResponses : [];
    if (!responseEntries.length) {
      updateAcceptedStructuredItemMap({});
      return;
    }

    try {
      const opportunitySignatures = await getOpportunitySignatures();
      const contentSignatures = await getContentSignatures();
      const weeklySignatures = await getWeeklyPrioritySignatures(getCurrentWeekStart());
      const signaturesByCacheKey = {
        opportunities: opportunitySignatures,
        content: contentSignatures,
        weeklyPriorities: weeklySignatures,
      };
      const accepted = {};

      responseEntries.forEach((entry) => {
        const payload = entry?.structuredPayload;
        if (!payload || typeof payload !== 'object') {
          return;
        }

        Object.entries(SECTION_DESCRIPTORS).forEach(([sectionKey, descriptor]) => {
          const items = Array.isArray(payload[sectionKey]) ? payload[sectionKey] : [];
          const knownSignatures = signaturesByCacheKey[descriptor.cacheKey];
          if (!knownSignatures) return;

          items.forEach((item) => {
            const key = buildItemKey(sectionKey, item);
            const signature = buildItemSignature(descriptor, item);
            if (key && signature && knownSignatures.has(signature)) {
              accepted[key] = true;
            }
          });
        });
      });

      if (isMountedRef?.current === false) {
        return;
      }

      updateAcceptedStructuredItemMap(accepted);
    } catch {
      if (isMountedRef?.current === false) {
        return;
      }

      updateAcceptedStructuredItemMap({});
    }
  }, [
    getContentSignatures,
    getOpportunitySignatures,
    getWeeklyPrioritySignatures,
    isMountedRef,
    updateAcceptedStructuredItemMap,
  ]);

  const acceptStructuredItem = useCallback(async (section, item, options = {}) => {
    const { suppressFeedback = false } = options;
    const sectionKey = typeof section === 'string' ? section : '';
    const descriptor = SECTION_DESCRIPTORS[sectionKey];
    const itemValue = item && typeof item === 'object' ? item : resolveStructuredText(item);
    const itemKey = buildItemKey(sectionKey, itemValue);

    if (!itemKey) {
      pushFeedbackIfAllowed(FEEDBACK_KIND.error, 'This item is missing required details and cannot be saved yet.', suppressFeedback);
      notifyTelemetry('accept_item_skipped', {
        section: sectionKey || 'unknown',
        reason: 'missing_required_details',
      });
      return ACCEPTANCE_STATUS.SKIPPED;
    }

    if (!descriptor) {
      pushFeedbackIfAllowed(FEEDBACK_KIND.error, 'This structured item type is not supported yet.', suppressFeedback);
      notifyTelemetry('accept_item_skipped', {
        section: sectionKey || 'unknown',
        reason: 'unsupported_section',
      });
      return ACCEPTANCE_STATUS.SKIPPED;
    }

    if (acceptedStructuredItemMapRef.current[itemKey]) {
      // The item is already accepted in this session — that's a positive
      // outcome (no action needed), not an error. Treat it as `result` so the
      // autosave timer can't paint over it.
      pushFeedbackIfAllowed(FEEDBACK_KIND.result, 'This structured item was already added.', suppressFeedback);
      notifyTelemetry('accept_item_skipped', {
        section: sectionKey,
        reason: 'already_accepted',
      });
      return ACCEPTANCE_STATUS.SKIPPED;
    }

    if (acceptingStructuredItemMapRef.current[itemKey] || acceptingStructuredItemRef.current.has(itemKey)) {
      notifyTelemetry('accept_item_skipped', {
        section: sectionKey,
        reason: 'in_flight',
      });
      return ACCEPTANCE_STATUS.SKIPPED;
    }

    acceptingStructuredItemRef.current.add(itemKey);
    updateAcceptingStructuredItemMap((current) => ({
      ...current,
      [itemKey]: true,
    }));

    try {
      const itemAsObject = typeof itemValue === 'object' && itemValue
        ? itemValue
        : { title: resolveStructuredText(itemValue) };
      const primaryText = pickFirstString(itemAsObject, descriptor.primaryFields);
      if (!primaryText) {
        pushFeedbackIfAllowed(FEEDBACK_KIND.error, descriptor.missingTextMessage, suppressFeedback);
        notifyTelemetry('accept_item_skipped', {
          section: sectionKey,
          reason: descriptor.missingTextReason,
        });
        return ACCEPTANCE_STATUS.SKIPPED;
      }

      const signatureItem = descriptor.signatureSecondaryFields.length
        ? itemAsObject
        : { title: primaryText };
      const signature = buildItemSignature(descriptor, signatureItem);
      const existingSignatures = await loadSignatures(descriptor);

      if (signature && existingSignatures.has(signature)) {
        updateAcceptedStructuredItemMap((current) => ({
          ...current,
          [itemKey]: true,
        }));
        // Underlying repo already has the item — that's a positive outcome
        // the user should be able to read without it being overwritten.
        pushFeedbackIfAllowed(FEEDBACK_KIND.result, descriptor.duplicateMessage, suppressFeedback);
        notifyTelemetry('accept_item_skipped', {
          section: sectionKey,
          reason: 'already_exists',
        });
        return ACCEPTANCE_STATUS.SKIPPED;
      }

      await descriptor.save({
        itemValue: itemAsObject,
        primaryText,
        ctx: { currentWeekStart: getCurrentWeekStart() },
      });

      if (signature) {
        existingSignatures.add(signature);
      }
      updateAcceptedStructuredItemMap((current) => ({
        ...current,
        [itemKey]: true,
      }));
      pushFeedbackIfAllowed(FEEDBACK_KIND.result, descriptor.successMessage, suppressFeedback);
      notifyTelemetry('accept_item_saved', { section: sectionKey });
      return ACCEPTANCE_STATUS.SAVED;
    } catch (error) {
      if (typeof setLoadError === 'function') {
        setLoadError('Unable to accept this structured AI item right now.');
      }
      pushFeedbackIfAllowed(FEEDBACK_KIND.error, 'Unable to save this item right now. Try again.', suppressFeedback);
      if (import.meta.env.DEV) {
        console.error('Failed to accept structured AI item', error);
      }
      notifyTelemetry('accept_item_failed', {
        section: sectionKey || 'unknown',
      });
      return ACCEPTANCE_STATUS.FAILED;
    } finally {
      acceptingStructuredItemRef.current.delete(itemKey);
      if (isMountedRef?.current !== false) {
        updateAcceptingStructuredItemMap((current) => {
          if (!current[itemKey]) {
            return current;
          }

          const next = { ...current };
          delete next[itemKey];
          return next;
        });
      }
    }
  }, [
    isMountedRef,
    loadSignatures,
    notifyTelemetry,
    pushFeedbackIfAllowed,
    setLoadError,
    updateAcceptedStructuredItemMap,
    updateAcceptingStructuredItemMap,
  ]);

  const acceptAllStructured = useCallback(async (structuredPayload) => {
    const effectivePayload = structuredPayload && typeof structuredPayload === 'object'
      ? structuredPayload
      : responses[0]?.structuredPayload;

    if (!effectivePayload || typeof effectivePayload !== 'object') {
      if (typeof pushFeedback === 'function') {
        pushFeedback(FEEDBACK_KIND.info, 'No structured items are available to add.');
      }
      notifyTelemetry('accept_all_skipped', { reason: 'no_payload' });
      return false;
    }

    if (acceptingAllRef.current) {
      if (typeof pushFeedback === 'function') {
        pushFeedback(FEEDBACK_KIND.info, 'Add all is already running.');
      }
      notifyTelemetry('accept_all_skipped', { reason: 'already_running' });
      return false;
    }

    acceptingAllRef.current = true;
    setIsAcceptingAll(true);
    notifyTelemetry('accept_all_started');

    let saved = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Order matters: priorities first preserves the legacy ordering callers
      // (and tests) rely on for the "Add all" feedback string.
      const queueOrder = ['priorities', 'opportunities', 'contentItems', 'tasks'];
      const queue = queueOrder.flatMap((section) => {
        const items = effectivePayload[section];
        return Array.isArray(items) ? items.map((item) => ({ section, item })) : [];
      });

      if (!queue.length) {
        if (typeof pushFeedback === 'function') {
          pushFeedback(FEEDBACK_KIND.info, 'No valid structured items found to add.');
        }
        notifyTelemetry('accept_all_skipped', { reason: 'no_valid_items' });
        return false;
      }

      for (let index = 0; index < queue.length; index += 1) {
        const { section, item } = queue[index];
        const status = await acceptStructuredItem(section, item, { suppressFeedback: true });
        if (status === ACCEPTANCE_STATUS.SAVED) {
          saved += 1;
        } else if (status === ACCEPTANCE_STATUS.FAILED) {
          failed += 1;
        } else {
          skipped += 1;
        }
      }

      if (typeof pushFeedback === 'function') {
        pushFeedback(FEEDBACK_KIND.result, `Add all complete: ${saved} saved, ${skipped} skipped, ${failed} failed.`);
      }
      notifyTelemetry('accept_all_completed', {
        saved,
        skipped,
        failed,
      });
      return failed === 0;
    } finally {
      acceptingAllRef.current = false;
      if (isMountedRef?.current !== false) {
        setIsAcceptingAll(false);
      }
    }
  }, [acceptStructuredItem, isMountedRef, notifyTelemetry, pushFeedback, responses]);

  const isStructuredItemAccepted = useCallback(
    (section, item) => {
      const itemKey = buildItemKey(section, item);
      return itemKey ? Boolean(acceptedStructuredItemMap[itemKey]) : false;
    },
    [acceptedStructuredItemMap],
  );

  const isStructuredItemAccepting = useCallback(
    (section, item) => {
      const itemKey = buildItemKey(section, item);
      return itemKey ? Boolean(acceptingStructuredItemMap[itemKey]) : false;
    },
    [acceptingStructuredItemMap],
  );

  return {
    isAcceptingAll,
    acceptStructuredItem,
    acceptAllStructured,
    isStructuredItemAccepted,
    isStructuredItemAccepting,
    hydrateAcceptedStructuredItems,
    resetAcceptanceCaches,
    resetAcceptanceState,
  };
}
