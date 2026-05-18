import {
  DEFAULT_REVIEW_NOTES,
  defaultBlockers,
  defaultPriorities,
  defaultWins,
} from './weeklyData';
import { buildCreateId } from './utils';
import { getSupabaseRuntime, isSupabaseRuntimeEnabled } from './supabaseRuntime';
import { StaleRecordError, assertRecordIsFresh, readUpdatedAtMs } from './staleRecordError';
import { archiveStorageValue, parseJsonOrPreserveCorruption } from './storageCorruption';
import { STORAGE_DOMAINS } from './dataSchema';
import { readVersionedLocalStorage, writeVersionedLocalStorage } from './versionedStorage';

const LEGACY_PRIORITIES_KEY = 'ceo-os-weekly-priorities';
const LEGACY_WINS_KEY = 'ceo-os-weekly-wins';
const LEGACY_BLOCKERS_KEY = 'ceo-os-weekly-blockers';
const LEGACY_REVIEW_NOTES_KEY = 'ceo-os-weekly-review-notes';

export const WEEKLY_BRIEF_UPDATED_EVENT = 'ceo-os:weekly-brief-updated';

const WEEKLY_ITEM_TYPES = {
  priority: 'priority',
  win: 'win',
  blocker: 'blocker',
};
const DEMO_PRIORITY_IDS = new Set(defaultPriorities.map((item) => String(item.id)));
const DEMO_WIN_IDS = new Set(defaultWins.map((item) => String(item.id)));
const DEMO_BLOCKER_IDS = new Set(defaultBlockers.map((item) => String(item.id)));

/**
 * Single source of truth for the three item types in a weekly brief. Each
 * descriptor declares: which payload collection the item belongs to, the
 * field-by-field shape used during normalization (with defaults), and the
 * Supabase row <-> domain object mapping. The normalize/fallback/create/
 * update/delete code paths all consult this table instead of branching on
 * type so there is one place to add a new field or type.
 */
const ITEM_DESCRIPTORS = {
  [WEEKLY_ITEM_TYPES.priority]: {
    type: WEEKLY_ITEM_TYPES.priority,
    collectionKey: 'priorities',
    legacyStorageKey: LEGACY_PRIORITIES_KEY,
    fallbackSource: defaultPriorities,
    fields: { title: '', owner: '', status: 'Planned' },
    fromSupabaseRow: (row) => ({
      id: row.id,
      title: row.title,
      owner: row.owner,
      status: row.status,
    }),
    toSupabaseFields: (normalized) => ({
      title: normalized.title,
      description: '',
      owner: normalized.owner,
      status: normalized.status,
      category: '',
      severity: '',
    }),
  },
  [WEEKLY_ITEM_TYPES.win]: {
    type: WEEKLY_ITEM_TYPES.win,
    collectionKey: 'wins',
    legacyStorageKey: LEGACY_WINS_KEY,
    fallbackSource: defaultWins,
    fields: { text: '', category: 'Product' },
    fromSupabaseRow: (row) => ({
      id: row.id,
      text: row.description || row.title,
      category: row.category,
    }),
    toSupabaseFields: (normalized) => ({
      title: '',
      description: normalized.text,
      owner: '',
      status: '',
      category: normalized.category,
      severity: '',
    }),
  },
  [WEEKLY_ITEM_TYPES.blocker]: {
    type: WEEKLY_ITEM_TYPES.blocker,
    collectionKey: 'blockers',
    legacyStorageKey: LEGACY_BLOCKERS_KEY,
    fallbackSource: defaultBlockers,
    fields: { text: '', severity: 'decision' },
    fromSupabaseRow: (row) => ({
      id: row.id,
      text: row.description || row.title,
      severity: row.severity,
    }),
    toSupabaseFields: (normalized) => ({
      title: '',
      description: normalized.text,
      owner: '',
      status: '',
      category: '',
      severity: normalized.severity,
    }),
  },
};

const ITEM_DESCRIPTOR_LIST = [
  ITEM_DESCRIPTORS[WEEKLY_ITEM_TYPES.priority],
  ITEM_DESCRIPTORS[WEEKLY_ITEM_TYPES.win],
  ITEM_DESCRIPTORS[WEEKLY_ITEM_TYPES.blocker],
];

function expectedUpdatedAtToIso(expectedUpdatedAt) {
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) {
    return null;
  }
  return new Date(expected).toISOString();
}

function getDescriptor(type) {
  return ITEM_DESCRIPTORS[type] || ITEM_DESCRIPTORS[WEEKLY_ITEM_TYPES.blocker];
}

function resolveItemType(itemType) {
  if (itemType === WEEKLY_ITEM_TYPES.win) return WEEKLY_ITEM_TYPES.win;
  if (itemType === WEEKLY_ITEM_TYPES.blocker) return WEEKLY_ITEM_TYPES.blocker;
  return WEEKLY_ITEM_TYPES.priority;
}

function normalizeItem(type, item, { includeUpdatedAt = true } = {}) {
  const descriptor = getDescriptor(type);
  const normalized = { id: String(item?.id || buildCreateId()) };
  for (const [field, defaultValue] of Object.entries(descriptor.fields)) {
    normalized[field] = item?.[field] || defaultValue;
  }
  if (includeUpdatedAt) {
    normalized.updatedAt = readUpdatedAtMs(item);
  }
  return normalized;
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveCurrentWeekStart(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const shiftToMonday = (day + 6) % 7;
  next.setDate(next.getDate() - shiftToMonday);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

export function getCurrentWeekStart() {
  return resolveCurrentWeekStart();
}

function getFallbackCollection(type) {
  const descriptor = getDescriptor(type);
  return descriptor.fallbackSource.map((item) => normalizeItem(type, item, { includeUpdatedAt: false }));
}

function getDemoPriorities() {
  return defaultPriorities.map((item) => ({
    id: String(item.id || buildCreateId()),
    title: item.title || '',
    owner: item.owner || '',
    status: item.status || 'Planned',
  }));
}

function getDemoWins() {
  return defaultWins.map((item) => ({
    id: String(item.id || buildCreateId()),
    text: item.text || '',
    category: item.category || 'Product',
  }));
}

function getDemoBlockers() {
  return defaultBlockers.map((item) => ({
    id: String(item.id || buildCreateId()),
    text: item.text || '',
    severity: item.severity || 'decision',
  }));
}

function normalizeCollection(type, items) {
  const source = Array.isArray(items) ? items : [];
  return source.map((item) => normalizeItem(type, item));
}

function buildEmptyCollections() {
  return {
    priorities: [],
    wins: [],
    blockers: [],
  };
}

function buildFallbackCollections() {
  return {
    priorities: getFallbackCollection(WEEKLY_ITEM_TYPES.priority),
    wins: getFallbackCollection(WEEKLY_ITEM_TYPES.win),
    blockers: getFallbackCollection(WEEKLY_ITEM_TYPES.blocker),
  };
}

function createDefaultWeekPayload() {
  return {
    reviewNotes: DEFAULT_REVIEW_NOTES,
    ...buildFallbackCollections(),
  };
}

function createDemoWeekPayload() {
  return {
    reviewNotes: DEFAULT_REVIEW_NOTES,
    priorities: getDemoPriorities(),
    wins: getDemoWins(),
    blockers: getDemoBlockers(),
  };
}

function getWeeklySource() {
  return isSupabaseRuntimeEnabled ? 'supabase' : 'local';
}

export function resolveWeeklySource() {
  return getWeeklySource();
}

function notifyWeeklyUpdated(detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(WEEKLY_BRIEF_UPDATED_EVENT, { detail }));
}

export function emitWeeklyBriefUpdated(detail = {}) {
  notifyWeeklyUpdated(detail);
}

function readLegacyCollection(descriptor) {
  try {
    const raw = window.localStorage.getItem(descriptor.legacyStorageKey);
    const parsed = raw
      ? parseJsonOrPreserveCorruption(descriptor.legacyStorageKey, raw, null)
      : null;
    return normalizeCollection(descriptor.type, parsed ?? getFallbackCollection(descriptor.type));
  } catch {
    return getFallbackCollection(descriptor.type);
  }
}

function readLegacyWeekPayload() {
  if (typeof window === 'undefined') {
    return createDefaultWeekPayload();
  }

  let reviewNotes = DEFAULT_REVIEW_NOTES;
  try {
    const rawReviewNotes = window.localStorage.getItem(LEGACY_REVIEW_NOTES_KEY);
    reviewNotes = typeof rawReviewNotes === 'string' ? rawReviewNotes : DEFAULT_REVIEW_NOTES;
  } catch {
    reviewNotes = DEFAULT_REVIEW_NOTES;
  }

  const payload = { reviewNotes };
  ITEM_DESCRIPTOR_LIST.forEach((descriptor) => {
    payload[descriptor.collectionKey] = readLegacyCollection(descriptor);
  });
  return payload;
}

function readLocalWeekStore() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const data = readVersionedLocalStorage(STORAGE_DOMAINS.weeklyBriefs, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeLocalWeekStore(store) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.weeklyBriefs,
    store,
    'Failed to persist weekly brief data to localStorage',
  );
}

function buildWeekPayload(reviewNotes, source) {
  const payload = {
    reviewNotes: typeof reviewNotes === 'string' ? reviewNotes : DEFAULT_REVIEW_NOTES,
  };
  ITEM_DESCRIPTOR_LIST.forEach((descriptor) => {
    payload[descriptor.collectionKey] = normalizeCollection(
      descriptor.type,
      source ? source[descriptor.collectionKey] : [],
    );
  });
  return payload;
}

/**
 * Archive each legacy weekly key under a timestamped backup before removing
 * it. Both call sites (demo reset, demo clear) write a fresh payload into
 * the versioned store first, so the legacy values are technically migrated —
 * but a destructive removeItem with no recovery path violates the
 * local-first data contract established elsewhere in the app. Routing
 * through archiveStorageValue keeps the same outcome (legacy key gone) but
 * preserves the prior value in the corruption backup index, where it can be
 * recovered via listCorruptBackups / restoreCorruptBackup.
 */
function removeLegacyWeeklyKeys() {
  if (typeof window === 'undefined') {
    return;
  }

  archiveStorageValue(LEGACY_PRIORITIES_KEY, { reason: 'weekly-legacy-cleanup' });
  archiveStorageValue(LEGACY_WINS_KEY, { reason: 'weekly-legacy-cleanup' });
  archiveStorageValue(LEGACY_BLOCKERS_KEY, { reason: 'weekly-legacy-cleanup' });
  archiveStorageValue(LEGACY_REVIEW_NOTES_KEY, { reason: 'weekly-legacy-cleanup' });
}

function resolveLocalWeekPayload(weekStart) {
  const store = readLocalWeekStore();
  const weekRecord = store[weekStart];

  if (weekRecord && typeof weekRecord === 'object') {
    return buildWeekPayload(weekRecord.reviewNotes, weekRecord);
  }

  if (weekStart === getCurrentWeekStart()) {
    return readLegacyWeekPayload();
  }

  return {
    reviewNotes: DEFAULT_REVIEW_NOTES,
    ...buildEmptyCollections(),
  };
}

function updateLocalWeekPayload(weekStart, updater) {
  const store = readLocalWeekStore();
  const current = resolveLocalWeekPayload(weekStart);
  const next = updater(current);

  store[weekStart] = buildWeekPayload(next.reviewNotes, next);

  writeLocalWeekStore(store);
  return store[weekStart];
}

function mapItemFromSupabaseRow(row) {
  const descriptor = getDescriptor(row.item_type);
  return normalizeItem(descriptor.type, {
    ...descriptor.fromSupabaseRow(row),
    updatedAt: readUpdatedAtMs(row),
  });
}

async function getSupabaseBriefRow({
  supabase,
  supabaseClient,
  weekStart,
  createIfMissing = false,
}) {
  const userId = await supabase.requireSupabaseUserId();
  const { data, error } = await supabaseClient
    .from('weekly_briefs')
    .select('id, week_start, review_notes')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data || !createIfMissing) {
    return { userId, brief: data || null };
  }

  const { data: insertedBrief, error: insertError } = await supabaseClient
    .from('weekly_briefs')
    .insert({
      user_id: userId,
      week_start: weekStart,
      review_notes: DEFAULT_REVIEW_NOTES,
    })
    .select('id, week_start, review_notes')
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    userId,
    brief: insertedBrief,
  };
}

async function listSupabaseWeeklyItems({
  supabaseClient,
  briefId,
  userId,
}) {
  const { data, error } = await supabaseClient
    .from('weekly_brief_items')
    .select('id, item_type, title, description, owner, status, category, severity, sort_order, updated_at')
    .eq('brief_id', briefId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const collections = buildEmptyCollections();

  rows.forEach((row) => {
    const descriptor = getDescriptor(row.item_type);
    collections[descriptor.collectionKey].push(mapItemFromSupabaseRow(row));
  });

  return collections;
}

export async function getWeeklyBriefByWeek(weekStart = getCurrentWeekStart()) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const { userId, brief } = await getSupabaseBriefRow({
      supabase,
      supabaseClient,
      weekStart: normalizedWeekStart,
      createIfMissing: false,
    });

    if (!brief) {
      return {
        weekStart: normalizedWeekStart,
        reviewNotes: DEFAULT_REVIEW_NOTES,
        ...buildEmptyCollections(),
        source: 'supabase',
      };
    }

    const collections = await listSupabaseWeeklyItems({
      supabaseClient,
      briefId: brief.id,
      userId,
    });

    return {
      weekStart: normalizedWeekStart,
      reviewNotes: brief.review_notes || DEFAULT_REVIEW_NOTES,
      ...collections,
      source: 'supabase',
    };
  }

  const payload = resolveLocalWeekPayload(normalizedWeekStart);
  return {
    weekStart: normalizedWeekStart,
    reviewNotes: payload.reviewNotes,
    priorities: payload.priorities,
    wins: payload.wins,
    blockers: payload.blockers,
    source: 'local',
  };
}

export async function saveWeeklyBriefReviewNotes({
  weekStart = getCurrentWeekStart(),
  reviewNotes = DEFAULT_REVIEW_NOTES,
  emitEvent = true,
}) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const normalizedReviewNotes = typeof reviewNotes === 'string'
    ? reviewNotes
    : DEFAULT_REVIEW_NOTES;

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const userId = await supabase.requireSupabaseUserId();
    const { error } = await supabaseClient
      .from('weekly_briefs')
      .upsert(
        {
          user_id: userId,
          week_start: normalizedWeekStart,
          review_notes: normalizedReviewNotes,
        },
        { onConflict: 'user_id,week_start' },
      );

    if (error) {
      throw error;
    }

    if (emitEvent) {
      notifyWeeklyUpdated({
        weekStart: normalizedWeekStart,
        source: 'supabase',
        mutation: 'review_notes',
      });
    }
    return normalizedReviewNotes;
  }

  updateLocalWeekPayload(normalizedWeekStart, (current) => ({
    ...current,
    reviewNotes: normalizedReviewNotes,
  }));

  if (emitEvent) {
    notifyWeeklyUpdated({
      weekStart: normalizedWeekStart,
      source: 'local',
      mutation: 'review_notes',
    });
  }
  return normalizedReviewNotes;
}

export async function createWeeklyItem({
  weekStart = getCurrentWeekStart(),
  itemType,
  item,
  sortOrder = 0,
  emitEvent = true,
}) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const normalizedType = resolveItemType(itemType);
  const descriptor = getDescriptor(normalizedType);

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const { userId, brief } = await getSupabaseBriefRow({
      supabase,
      supabaseClient,
      weekStart: normalizedWeekStart,
      createIfMissing: true,
    });
    const normalizedItem = normalizeItem(normalizedType, item);

    const { data, error } = await supabaseClient
      .from('weekly_brief_items')
      .insert({
        ...(isUuid(normalizedItem.id) ? { id: normalizedItem.id } : {}),
        brief_id: brief.id,
        user_id: userId,
        item_type: normalizedType,
        sort_order: sortOrder,
        ...descriptor.toSupabaseFields(normalizedItem),
      })
      .select('id, item_type, title, description, owner, status, category, severity, sort_order, updated_at')
      .single();

    if (error) {
      throw error;
    }

    const nextItem = mapItemFromSupabaseRow(data);
    if (emitEvent) {
      notifyWeeklyUpdated({
        weekStart: normalizedWeekStart,
        source: 'supabase',
        mutation: 'create_item',
        itemType: normalizedType,
      });
    }
    return nextItem;
  }

  const itemWithStamp = { ...item, updatedAt: Date.now() };
  const normalizedItem = normalizeItem(normalizedType, itemWithStamp);

  updateLocalWeekPayload(normalizedWeekStart, (current) => ({
    ...current,
    [descriptor.collectionKey]: [...current[descriptor.collectionKey], normalizedItem],
  }));

  if (emitEvent) {
    notifyWeeklyUpdated({
      weekStart: normalizedWeekStart,
      source: 'local',
      mutation: 'create_item',
      itemType: normalizedType,
    });
  }
  return normalizedItem;
}

export async function updateWeeklyItem({
  weekStart = getCurrentWeekStart(),
  itemType,
  itemId,
  item,
  sortOrder = 0,
  emitEvent = true,
  expectedUpdatedAt,
}) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const normalizedType = resolveItemType(itemType);
  const descriptor = getDescriptor(normalizedType);
  const normalizedItemId = String(itemId || '');

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const userId = await supabase.requireSupabaseUserId();
    const normalizedItem = normalizeItem(normalizedType, { ...item, id: normalizedItemId });

    let query = supabaseClient
      .from('weekly_brief_items')
      .update({
        sort_order: sortOrder,
        ...descriptor.toSupabaseFields(normalizedItem),
      })
      .eq('id', normalizedItemId)
      .eq('user_id', userId);

    const expectedIso = expectedUpdatedAtToIso(expectedUpdatedAt);
    if (expectedIso) {
      query = query.eq('updated_at', expectedIso);
    }

    const { data, error } = await query
      .select('id, item_type, title, description, owner, status, category, severity, sort_order, updated_at')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new StaleRecordError(
        'This weekly item was changed in another window. Reload to see the latest version before saving.',
      );
    }

    const nextItem = mapItemFromSupabaseRow(data);
    if (emitEvent) {
      notifyWeeklyUpdated({
        weekStart: normalizedWeekStart,
        source: 'supabase',
        mutation: 'update_item',
        itemType: normalizedType,
      });
    }
    return nextItem;
  }

  const stamp = Date.now();

  let nextItem = null;
  updateLocalWeekPayload(normalizedWeekStart, (current) => {
    const persisted = current[descriptor.collectionKey].find(
      (entry) => String(entry.id) === normalizedItemId,
    ) || null;

    assertRecordIsFresh(
      persisted,
      expectedUpdatedAt,
      'This weekly item was changed in another window. Reload to see the latest version before saving.',
    );

    const itemWithStamp = { ...item, id: normalizedItemId, updatedAt: stamp };
    const updatedCollection = current[descriptor.collectionKey].map((currentItem) => {
      if (String(currentItem.id) !== normalizedItemId) {
        return currentItem;
      }
      nextItem = normalizeItem(normalizedType, itemWithStamp);
      return nextItem;
    });

    if (!nextItem) {
      throw new Error('Weekly item not found');
    }

    return {
      ...current,
      [descriptor.collectionKey]: updatedCollection,
    };
  });

  if (emitEvent) {
    notifyWeeklyUpdated({
      weekStart: normalizedWeekStart,
      source: 'local',
      mutation: 'update_item',
      itemType: normalizedType,
    });
  }
  return nextItem;
}

export async function deleteWeeklyItem({
  weekStart = getCurrentWeekStart(),
  itemType,
  itemId,
  emitEvent = true,
  expectedUpdatedAt,
}) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const normalizedType = resolveItemType(itemType);
  const descriptor = getDescriptor(normalizedType);
  const normalizedItemId = String(itemId || '');

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const userId = await supabase.requireSupabaseUserId();
    let query = supabaseClient
      .from('weekly_brief_items')
      .delete()
      .eq('id', normalizedItemId)
      .eq('user_id', userId);

    const expectedIso = expectedUpdatedAtToIso(expectedUpdatedAt);
    if (expectedIso) {
      query = query.eq('updated_at', expectedIso);
    }

    const { data, error } = await query
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (expectedIso && !data) {
      throw new StaleRecordError(
        'This weekly item was changed in another window. Reload to see the latest version before deleting.',
      );
    }

    if (emitEvent) {
      notifyWeeklyUpdated({
        weekStart: normalizedWeekStart,
        source: 'supabase',
        mutation: 'delete_item',
        itemType: normalizedType,
      });
    }
    return;
  }

  updateLocalWeekPayload(normalizedWeekStart, (current) => {
    const collection = current[descriptor.collectionKey];
    const persisted = collection.find((entry) => String(entry.id) === normalizedItemId) || null;
    if (!persisted) {
      throw new Error('Weekly item not found');
    }

    assertRecordIsFresh(
      persisted,
      expectedUpdatedAt,
      'This weekly item was changed in another window. Reload to see the latest version before deleting.',
    );

    return {
      ...current,
      [descriptor.collectionKey]: collection.filter((entry) => String(entry.id) !== normalizedItemId),
    };
  });

  if (emitEvent) {
    notifyWeeklyUpdated({
      weekStart: normalizedWeekStart,
      source: 'local',
      mutation: 'delete_item',
      itemType: normalizedType,
    });
  }
}

export function clearLocalWeeklyDemoData(weekStart = getCurrentWeekStart()) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const store = readLocalWeekStore();
  const current = resolveLocalWeekPayload(normalizedWeekStart);

  store[normalizedWeekStart] = {
    reviewNotes: current.reviewNotes,
    priorities: normalizeCollection(
      WEEKLY_ITEM_TYPES.priority,
      current.priorities.filter((item) => !DEMO_PRIORITY_IDS.has(String(item.id))),
    ),
    wins: normalizeCollection(
      WEEKLY_ITEM_TYPES.win,
      current.wins.filter((item) => !DEMO_WIN_IDS.has(String(item.id))),
    ),
    blockers: normalizeCollection(
      WEEKLY_ITEM_TYPES.blocker,
      current.blockers.filter((item) => !DEMO_BLOCKER_IDS.has(String(item.id))),
    ),
  };

  writeLocalWeekStore(store);
  removeLegacyWeeklyKeys();
  notifyWeeklyUpdated({
    weekStart: normalizedWeekStart,
    source: 'local',
    mutation: 'clear_demo',
  });
  return store[normalizedWeekStart];
}

export function resetLocalWeeklyDemoData(weekStart = getCurrentWeekStart()) {
  const normalizedWeekStart = typeof weekStart === 'string' && weekStart
    ? weekStart
    : getCurrentWeekStart();
  const store = readLocalWeekStore();
  store[normalizedWeekStart] = createDemoWeekPayload();

  writeLocalWeekStore(store);
  removeLegacyWeeklyKeys();
  notifyWeeklyUpdated({
    weekStart: normalizedWeekStart,
    source: 'local',
    mutation: 'load_demo',
  });
  return store[normalizedWeekStart];
}
