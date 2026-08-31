import { contentItems as mockContentItems } from '../data/mockData';
import { deleteRecordById, replaceRecordById } from './stateUtils';
import { buildCreateId } from './utils';
import { getSupabaseRuntime, isSupabaseRuntimeEnabled } from './supabaseRuntime';
import {
  StaleRecordError,
  assertRecordIsFresh,
  applyExpectedUpdatedAtFilter,
  readUpdatedAtMs,
} from './staleRecordError';
import { tryRemoteOrEnqueue } from './offlineWriteQueueIntegration';
import { isDemoWorkspaceEnabled } from './workspaceSetup';
import { STORAGE_DOMAINS } from './dataSchema';
import { buildContentSignature } from './recordIdentity';
import { createDuplicateRecordError } from './repositoryErrors';
import {
  readVersionedLocalStorage,
  safeWriteVersionedLocalStorage,
  writeVersionedLocalStorage,
} from './versionedStorage';

export const CONTENT_QUEUE_KIND_CREATE = 'content:create';
export const CONTENT_QUEUE_KIND_UPDATE = 'content:update';
export const CONTENT_QUEUE_KIND_DELETE = 'content:delete';
const DUPLICATE_CONTENT_MESSAGE = 'This content item already exists for that platform.';

export const CONTENT_ITEMS_UPDATED_EVENT = 'ceo-os:content-items-updated';
const DEMO_CONTENT_ITEM_IDS = new Set(mockContentItems.map((item) => String(item.id)));

function normalizeDateOnly(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  // Postgres `date` columns come back as YYYY-MM-DD, but tolerate a full
  // timestamp just in case the column type changes underneath us.
  return trimmed.slice(0, 10);
}

function normalizeContentItem(item) {
  return {
    id: String(item.id),
    title: item.title || '',
    platform: item.platform || '',
    contentType: item.contentType || item.content_type || 'Post',
    status: item.status || 'Idea',
    purpose: item.purpose || '',
    scheduledFor: normalizeDateOnly(item.scheduledFor ?? item.scheduled_for),
    notes: item.notes || '',
    updatedAt: readUpdatedAtMs(item),
  };
}

function toContentItemRow(normalizedPayload) {
  return {
    title: normalizedPayload.title,
    platform: normalizedPayload.platform,
    content_type: normalizedPayload.contentType,
    status: normalizedPayload.status,
    purpose: normalizedPayload.purpose,
    scheduled_for: normalizedPayload.scheduledFor || null,
    notes: normalizedPayload.notes,
  };
}

const CONTENT_ITEM_COLUMNS = 'id, title, platform, content_type, status, purpose, scheduled_for, notes, updated_at';

function getSeededLocalItems() {
  if (!isDemoWorkspaceEnabled()) {
    return [];
  }

  return getDemoLocalItems();
}

function getDemoLocalItems() {
  return mockContentItems.map((item) => normalizeContentItem(item));
}

function readLocalContentItems() {
  if (typeof window === 'undefined') {
    return getSeededLocalItems();
  }

  try {
    const parsed = readVersionedLocalStorage(STORAGE_DOMAINS.contentItems, null);
    if (!parsed) {
      const seeded = getSeededLocalItems();
      safeWriteVersionedLocalStorage(
        STORAGE_DOMAINS.contentItems,
        seeded,
        'Failed to seed content items in localStorage',
      );
      return seeded;
    }

    if (!Array.isArray(parsed)) {
      return getSeededLocalItems();
    }

    return parsed.map((item) => normalizeContentItem(item));
  } catch {
    return getSeededLocalItems();
  }
}

function writeLocalContentItems(items) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.contentItems,
    items,
    'Failed to persist content items to localStorage',
  );
}

function notifyContentItemsUpdated(detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CONTENT_ITEMS_UPDATED_EVENT, { detail }));
}

function hasDuplicateContentItem(items, payload, { excludeId = '' } = {}) {
  const nextSignature = buildContentSignature(payload);
  if (!nextSignature) {
    return false;
  }

  return items.some((item) => {
    if (excludeId && String(item.id) === String(excludeId)) {
      return false;
    }

    return buildContentSignature(item) === nextSignature;
  });
}

async function assertNoSupabaseContentDuplicate({ supabaseClient, userId, payload, excludeId = '' }) {
  const { data, error } = await supabaseClient
    .from('content_items')
    .select(CONTENT_ITEM_COLUMNS)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const existingItems = (Array.isArray(data) ? data : []).map((item) => normalizeContentItem(item));
  if (hasDuplicateContentItem(existingItems, payload, { excludeId })) {
    throw createDuplicateRecordError(DUPLICATE_CONTENT_MESSAGE);
  }
}

export function getContentSource() {
  return isSupabaseRuntimeEnabled ? 'supabase' : 'local';
}

export async function listContentItems() {
  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const userId = await supabase.requireSupabaseUserId();
    const { data, error } = await supabaseClient
      .from('content_items')
      .select(CONTENT_ITEM_COLUMNS)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data || []).map((item) => normalizeContentItem(item));
  }

  return readLocalContentItems();
}

export async function createContentItem(payload, options = {}) {
  const normalizedPayload = normalizeContentItem({
    id: buildCreateId(),
    updatedAt: Date.now(),
    ...payload,
  });

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const attempt = async () => {
      const userId = await supabase.requireSupabaseUserId();
      await assertNoSupabaseContentDuplicate({
        supabaseClient,
        userId,
        payload: normalizedPayload,
      });

      const { data, error } = await supabaseClient
        .from('content_items')
        .insert({
          user_id: userId,
          ...toContentItemRow(normalizedPayload),
        })
        .select(CONTENT_ITEM_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      notifyContentItemsUpdated({ source: 'supabase', type: 'create' });
      return normalizeContentItem(data);
    };

    return tryRemoteOrEnqueue(
      { kind: CONTENT_QUEUE_KIND_CREATE, payload, options },
      attempt,
    );
  }

  const current = readLocalContentItems();
  if (hasDuplicateContentItem(current, normalizedPayload)) {
    throw createDuplicateRecordError(DUPLICATE_CONTENT_MESSAGE);
  }

  const next = [normalizedPayload, ...current];
  writeLocalContentItems(next);
  notifyContentItemsUpdated({ source: 'local', type: 'create' });
  return normalizedPayload;
}

export async function updateContentItem(id, payload, options = {}) {
  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const attempt = async () => {
      const normalizedPayload = normalizeContentItem({ id, ...payload });
      const userId = await supabase.requireSupabaseUserId();
      await assertNoSupabaseContentDuplicate({
        supabaseClient,
        userId,
        payload: normalizedPayload,
        excludeId: id,
      });

      let query = supabaseClient
        .from('content_items')
        .update(toContentItemRow(normalizedPayload))
        .eq('id', id)
        .eq('user_id', userId);

      // Optimistic locking — see opportunitiesRepository for the rationale.
      query = applyExpectedUpdatedAtFilter(query, options.expectedUpdatedAt);

      const { data, error } = await query
        .select(CONTENT_ITEM_COLUMNS)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new StaleRecordError(
          'This content item was changed in another window. Reload to see the latest version before saving.',
        );
      }

      notifyContentItemsUpdated({ source: 'supabase', type: 'update' });
      return normalizeContentItem(data);
    };

    return tryRemoteOrEnqueue(
      {
        kind: CONTENT_QUEUE_KIND_UPDATE,
        payload: { id, payload, expectedUpdatedAt: options.expectedUpdatedAt },
        options,
      },
      attempt,
    );
  }

  // Local-only optimistic locking via updatedAt.
  const current = readLocalContentItems();
  const persisted = current.find((item) => String(item.id) === String(id));

  assertRecordIsFresh(
    persisted,
    options.expectedUpdatedAt,
    'This content item was changed in another window. Reload to see the latest version before saving.',
  );
  if (hasDuplicateContentItem(current, payload, { excludeId: id })) {
    throw createDuplicateRecordError(DUPLICATE_CONTENT_MESSAGE);
  }

  const normalizedPayload = normalizeContentItem({
    id,
    ...payload,
    updatedAt: Date.now(),
  });
  const next = replaceRecordById(current, id, normalizedPayload, {
    notFoundMessage: 'Content item not found',
  });
  writeLocalContentItems(next);
  notifyContentItemsUpdated({ source: 'local', type: 'update' });
  return normalizedPayload;
}

export async function deleteContentItem(id, options = {}) {
  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const attempt = async () => {
      const userId = await supabase.requireSupabaseUserId();
      const { error } = await supabaseClient
        .from('content_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
      notifyContentItemsUpdated({ source: 'supabase', type: 'delete' });
    };

    await tryRemoteOrEnqueue(
      { kind: CONTENT_QUEUE_KIND_DELETE, payload: { id }, options },
      attempt,
    );
    return;
  }

  const current = readLocalContentItems();
  const next = deleteRecordById(current, id, {
    notFoundMessage: 'Content item not found',
  });
  writeLocalContentItems(next);
  notifyContentItemsUpdated({ source: 'local', type: 'delete' });
}

export function clearLocalContentDemoData() {
  const current = readLocalContentItems();
  const next = current.filter((item) => !DEMO_CONTENT_ITEM_IDS.has(String(item.id)));
  writeLocalContentItems(next);
  notifyContentItemsUpdated({ source: 'local', type: 'clear_demo' });
  return next;
}

export function resetLocalContentDemoData() {
  const seeded = getDemoLocalItems();
  writeLocalContentItems(seeded);
  notifyContentItemsUpdated({ source: 'local', type: 'load_demo' });
  return seeded;
}
