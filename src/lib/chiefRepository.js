import { buildCreateId } from './utils';
import { getSupabaseRuntime, isSupabaseRuntimeEnabled } from './supabaseRuntime';
import { STORAGE_DOMAINS, readVersionedStoragePayload } from './dataSchema';
import {
  getVersionedStorageKey,
  readVersionedLocalStorage,
  writeVersionedLocalStorage,
} from './versionedStorage';

const MAX_CHIEF_RESPONSES = 30;

function normalizeChiefResponse(item) {
  return {
    id: String(item?.id || buildCreateId()),
    title: item?.title || 'Executive Output',
    content: item?.content || '',
    source: item?.source || 'proxy',
    fallbackReason: item?.fallbackReason || '',
    errorCode: item?.errorCode || '',
    errorMessage: item?.errorMessage || '',
    structuredPayload:
      item?.structuredPayload && typeof item.structuredPayload === 'object'
        ? item.structuredPayload
        : {},
  };
}

function getBrowserLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

// Chief notes are persisted as a plain string. The rest of the storage layer
// uses the versioned-envelope pattern (see src/lib/dataSchema.js), so we
// also wrap notes in an envelope going forward. Older installs already have
// the bare string at the same key — we read that path explicitly so we do
// NOT trigger storage-corruption preservation on the JSON.parse failure
// that a bare string would otherwise produce. The first envelope write
// upgrades the entry for that user.
function readLocalChiefNotes() {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return '';
  }

  let raw;
  try {
    raw = storage.getItem(getVersionedStorageKey(STORAGE_DOMAINS.chiefNotes));
  } catch {
    return '';
  }

  if (typeof raw !== 'string' || raw.length === 0) {
    return '';
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Legacy bare-string write — not JSON. Use it directly.
    return raw;
  }

  const { data, isDomainMismatch } = readVersionedStoragePayload(STORAGE_DOMAINS.chiefNotes, parsed);
  if (isDomainMismatch) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  // Pre-envelope writes that happened to be valid JSON (e.g. the string
  // `"\"hi\""` because someone double-stringified) end up here. Treat as
  // empty rather than risk surfacing the wrong text.
  return '';
}

function writeLocalChiefNotes(notes) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.chiefNotes,
    typeof notes === 'string' ? notes : '',
    'Failed to persist chief notes to localStorage',
  );
}

function readLocalChiefResponses() {
  const fallback = [];
  const parsed = readVersionedLocalStorage(STORAGE_DOMAINS.chiefResponses, fallback);
  if (!Array.isArray(parsed)) {
    return fallback;
  }
  return parsed.map(normalizeChiefResponse);
}

function writeLocalChiefResponses(responses) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.chiefResponses,
    Array.isArray(responses) ? responses : [],
    'Failed to persist chief responses to localStorage',
  );
}

function isSupabaseAuthError(error) {
  const authErrorCode = error?.code || '';
  const statusCode = Number(error?.status) || 0;
  return (
    authErrorCode === 'SUPABASE_AUTH_REQUIRED'
    || authErrorCode === 'PGRST301'
    || authErrorCode === 'PGRST116'
    || statusCode === 401
    || statusCode === 403
  );
}

function normalizeSupabaseId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function writeLatestSupabaseChiefNotes({
  supabase,
  supabaseClient,
  notes,
}) {
  const userId = await supabase.requireSupabaseUserId();
  const { data: latestSession, error: lookupError } = await supabaseClient
    .from('chief_sessions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  const sessionId = normalizeSupabaseId(latestSession?.id);
  if (!sessionId) {
    const { error: insertError } = await supabaseClient
      .from('chief_sessions')
      .insert({
        user_id: userId,
        action_key: 'draft',
        notes,
      });

    if (insertError) {
      throw insertError;
    }

    return true;
  }

  const { error: updateError } = await supabaseClient
    .from('chief_sessions')
    .update({ notes: notes })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (updateError) {
    throw updateError;
  }

  return true;
}

async function withSupabaseAuthFallback(operation, localFallback) {
  if (!isSupabaseRuntimeEnabled) {
    return localFallback();
  }

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (!supabaseClient) {
    return localFallback();
  }

  try {
    return await operation({
      supabase,
      supabaseClient,
    });
  } catch (error) {
    if (isSupabaseAuthError(error)) {
      return localFallback();
    }
    throw error;
  }
}

function getLocalChiefWorkspace() {
  return {
    notes: readLocalChiefNotes(),
    responses: readLocalChiefResponses(),
    source: 'local',
  };
}

export function getChiefSource() {
  return isSupabaseRuntimeEnabled ? 'supabase' : 'local';
}

export async function loadChiefWorkspace() {
  return withSupabaseAuthFallback(
    async ({ supabase, supabaseClient }) => {
      const userId = await supabase.requireSupabaseUserId();
      const { data: latestSession, error: sessionError } = await supabaseClient
        .from('chief_sessions')
        .select('id, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      const { data: outputRows, error: outputError } = await supabaseClient
        .from('chief_outputs')
        .select('id, title, content, source, structured_payload')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_CHIEF_RESPONSES);

      if (outputError) {
        throw outputError;
      }

      return {
        notes: latestSession?.notes || '',
        responses: (Array.isArray(outputRows) ? outputRows : []).map((row) =>
          normalizeChiefResponse({
            id: row.id,
            title: row.title,
            content: row.content,
            source: row.source,
            structuredPayload: row.structured_payload,
          })),
        source: 'supabase',
      };
    },
    getLocalChiefWorkspace,
  );
}

export async function saveChiefNotes(notes) {
  const normalizedNotes = typeof notes === 'string' ? notes : '';
  writeLocalChiefNotes(normalizedNotes);

  return withSupabaseAuthFallback(
    async ({ supabase, supabaseClient }) => {
      await writeLatestSupabaseChiefNotes({
        supabase,
        supabaseClient,
        notes: normalizedNotes,
      });
      return normalizedNotes;
    },
    () => normalizedNotes,
  );
}

export async function createChiefSession({ actionKey, notes }) {
  const normalizedActionKey = typeof actionKey === 'string' ? actionKey : '';
  const normalizedNotes = typeof notes === 'string' ? notes : '';

  return withSupabaseAuthFallback(
    async ({ supabase, supabaseClient }) => {
      const userId = await supabase.requireSupabaseUserId();
      const { data, error } = await supabaseClient
        .from('chief_sessions')
        .insert({
          user_id: userId,
          action_key: normalizedActionKey,
          notes: normalizedNotes,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        source: 'supabase',
      };
    },
    () => {
      writeLocalChiefNotes(normalizedNotes);
      return {
        id: buildCreateId(),
        source: 'local',
      };
    },
  );
}

export async function saveChiefOutput({
  sessionId,
  outputType = 'response',
  title,
  content,
  structuredPayload,
  source = 'proxy',
  fallbackReason = '',
  errorCode = '',
  errorMessage = '',
}) {
  const normalizedOutput = normalizeChiefResponse({
    id: buildCreateId(),
    title,
    content,
    source,
    fallbackReason,
    errorCode,
    errorMessage,
    structuredPayload:
      structuredPayload && typeof structuredPayload === 'object'
        ? structuredPayload
        : {},
  });

  return withSupabaseAuthFallback(
    async ({ supabase, supabaseClient }) => {
      const userId = await supabase.requireSupabaseUserId();
      const { data, error } = await supabaseClient
        .from('chief_outputs')
        .insert({
          session_id: sessionId,
          user_id: userId,
          output_type: outputType,
          title: normalizedOutput.title,
          content: normalizedOutput.content,
          structured_payload: normalizedOutput.structuredPayload,
          source: normalizedOutput.source,
        })
        .select('id, title, content, source, structured_payload')
        .single();

      if (error) {
        throw error;
      }

      return normalizeChiefResponse({
        id: data.id,
        title: data.title,
        content: data.content,
        source: data.source,
        fallbackReason: normalizedOutput.fallbackReason,
        errorCode: normalizedOutput.errorCode,
        errorMessage: normalizedOutput.errorMessage,
        structuredPayload: data.structured_payload,
      });
    },
    () => {
      const current = readLocalChiefResponses();
      const next = [normalizedOutput, ...current].slice(0, MAX_CHIEF_RESPONSES);
      writeLocalChiefResponses(next);
      return normalizedOutput;
    },
  );
}

export async function resetChiefWorkspace() {
  return withSupabaseAuthFallback(
    async ({ supabase, supabaseClient }) => {
      const userId = await supabase.requireSupabaseUserId();
      const { error: outputDeleteError } = await supabaseClient
        .from('chief_outputs')
        .delete()
        .eq('user_id', userId);

      if (outputDeleteError) {
        throw outputDeleteError;
      }

      const { error } = await supabaseClient
        .from('chief_sessions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    },
    () => {
      const storage = getBrowserLocalStorage();
      if (!storage) {
        return;
      }

      try {
        storage.removeItem(getVersionedStorageKey(STORAGE_DOMAINS.chiefNotes));
        storage.removeItem(getVersionedStorageKey(STORAGE_DOMAINS.chiefResponses));
      } catch {
        // best-effort: a failed remove on one key shouldn't crash the reset.
      }
    },
  );
}
