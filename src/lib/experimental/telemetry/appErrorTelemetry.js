import { parseJsonOrPreserveCorruption } from '../../storageCorruption';
import { safeLocalStorageSetItem } from '../../utils';

export const APP_ERROR_TELEMETRY_EVENT = 'ceo-os:app-error';

const APP_ERROR_STORAGE_KEY = 'ceo-os-app-error-events';
const APP_ERROR_REMOTE_QUEUE_KEY = 'ceo-os-app-error-remote-queue';
const MAX_APP_ERROR_EVENTS = 25;
const MAX_REMOTE_QUEUE_EVENTS = 100;
const MAX_REMOTE_BATCH_SIZE = 10;
const MAX_STACK_LINES = 8;
const MAX_LINE_LENGTH = 240;

let isFlushInFlight = false;
let flushTimerId = null;

function normalizeText(value) {
  return typeof value === 'string' ? scrubSensitive(value.trim()) : '';
}

// Strips identifiers that don't belong in remote telemetry: emails, URL query
// strings, long opaque tokens (uuids, JWTs, base64 blobs), and platform-prefix
// home-directory paths that often carry the user's name. Pure string in/out
// so it is safe to compose into normalizeText / normalizeStack.
function scrubSensitive(line) {
  if (typeof line !== 'string' || line.length === 0) {
    return '';
  }
  let scrubbed = line;
  scrubbed = scrubbed.replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<email>');
  scrubbed = scrubbed.replace(/\?[^\s)]+/g, '?<redacted>');
  scrubbed = scrubbed.replace(/\/(?:Users|home)\/[^/\s)]+/g, '/<user>');
  scrubbed = scrubbed.replace(/\b(?:[A-Za-z0-9_-]{32,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g, '<token>');
  if (scrubbed.length > MAX_LINE_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_LINE_LENGTH)}…`;
  }
  return scrubbed;
}

function normalizeStack(stack) {
  if (typeof stack !== 'string') {
    return '';
  }
  const trimmed = stack.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .split('\n')
    .slice(0, MAX_STACK_LINES)
    .map((line) => scrubSensitive(line.trim()))
    .filter((line) => line.length > 0)
    .join('\n');
}

export const __testables = { scrubSensitive, normalizeStack };

function sanitizeError(error) {
  if (!error || typeof error !== 'object') {
    return {
      name: 'UnknownError',
      message: '',
      stack: '',
    };
  }

  return {
    name: normalizeText(error.name) || 'UnknownError',
    message: normalizeText(error.message),
    stack: normalizeStack(error.stack),
  };
}

function sanitizeInfo(info) {
  if (!info || typeof info !== 'object') {
    return '';
  }

  return normalizeStack(info.componentStack);
}

function readStoredArray(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = parseJsonOrPreserveCorruption(storageKey, raw, null);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredArray(storageKey, items) {
  // Telemetry persistence is best-effort housekeeping — failure here should
  // NOT surface in the user-facing SaveStatusPill (the user did not initiate
  // a save). `silent: true` keeps the DEV log path but skips the bus event so
  // we share one helper with the user-data write path without overloading the
  // trust pill with internal telemetry noise.
  safeLocalStorageSetItem(
    storageKey,
    JSON.stringify(items),
    `Unable to persist ${storageKey}.`,
    { silent: true },
  );
}

function getRemoteTelemetryEndpoint() {
  return normalizeText(import.meta.env.VITE_APP_ERROR_TELEMETRY_URL);
}

function getRemoteTelemetryToken() {
  return normalizeText(import.meta.env.VITE_APP_ERROR_TELEMETRY_TOKEN);
}

function getRemoteTelemetryHmacSecret() {
  return normalizeText(import.meta.env.VITE_APP_ERROR_TELEMETRY_HMAC_SECRET);
}

function getRemoteTelemetrySignatureKeyId() {
  return normalizeText(import.meta.env.VITE_APP_ERROR_TELEMETRY_SIGNATURE_KEY_ID);
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

async function sha256Hex(input) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const normalizedHash = (hash >>> 0).toString(16).padStart(8, '0');
  return `${normalizedHash}${normalizedHash}${normalizedHash}${normalizedHash}`;
}

async function computeBatchIdempotencyKey(events) {
  const hashInput = stableSerialize(
    Array.isArray(events)
      ? events.map((event) => ({
        event: normalizeText(event?.event),
        timestamp: normalizeText(event?.timestamp),
        name: normalizeText(event?.name),
        message: normalizeText(event?.message),
        route: normalizeText(event?.route),
        componentStack: normalizeText(event?.componentStack),
      }))
      : [],
  );
  const hash = await sha256Hex(hashInput);
  return `app-error:${hash.slice(0, 48)}`;
}

async function computeHmacSignature(bodyText) {
  const hmacSecret = getRemoteTelemetryHmacSecret();
  if (!hmacSecret || typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
    return '';
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(bodyText),
  );

  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `sha256=${signatureHex}`;
}

export function isAppErrorTelemetryRemoteEnabled() {
  return Boolean(
    getRemoteTelemetryEndpoint()
    && typeof fetch === 'function',
  );
}

function enqueueRemoteTelemetryEvent(eventDetail) {
  if (!isAppErrorTelemetryRemoteEnabled()) {
    return;
  }

  const currentQueue = readStoredArray(APP_ERROR_REMOTE_QUEUE_KEY);
  const nextQueue = [...currentQueue, eventDetail].slice(-MAX_REMOTE_QUEUE_EVENTS);
  writeStoredArray(APP_ERROR_REMOTE_QUEUE_KEY, nextQueue);
}

function dequeueRemoteBatch(batchSize = MAX_REMOTE_BATCH_SIZE) {
  const currentQueue = readStoredArray(APP_ERROR_REMOTE_QUEUE_KEY);
  if (!currentQueue.length) {
    return [];
  }

  return currentQueue.slice(0, Math.max(1, batchSize));
}

function removeRemoteBatch(batchSize) {
  const currentQueue = readStoredArray(APP_ERROR_REMOTE_QUEUE_KEY);
  if (!currentQueue.length) {
    return;
  }

  const nextQueue = currentQueue.slice(Math.max(1, batchSize));
  writeStoredArray(APP_ERROR_REMOTE_QUEUE_KEY, nextQueue);
}

async function postRemoteBatch(events) {
  if (!events.length) {
    return true;
  }

  const endpoint = getRemoteTelemetryEndpoint();
  if (!endpoint || typeof fetch !== 'function') {
    return false;
  }

  const ingestToken = getRemoteTelemetryToken();
  const idempotencyKey = await computeBatchIdempotencyKey(events);
  const requestPayload = {
    source: 'codeherway-ceo-os',
    eventType: 'app_error',
    sentAt: new Date().toISOString(),
    idempotencyKey,
    events,
  };
  const requestBody = JSON.stringify(requestPayload);
  const hmacSignature = await computeHmacSignature(requestBody);
  const signatureKeyId = getRemoteTelemetrySignatureKeyId();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ingestToken ? { 'x-app-telemetry-token': ingestToken } : {}),
      ...(hmacSignature ? { 'x-app-telemetry-signature': hmacSignature } : {}),
      ...(hmacSignature && signatureKeyId ? { 'x-app-telemetry-signature-key-id': signatureKeyId } : {}),
    },
    body: requestBody,
    keepalive: true,
  });

  return Boolean(response?.ok || response?.status === 409);
}

export async function flushAppErrorTelemetryRemote() {
  if (flushTimerId) {
    clearTimeout(flushTimerId);
    flushTimerId = null;
  }

  if (!isAppErrorTelemetryRemoteEnabled() || isFlushInFlight) {
    return false;
  }

  const batch = dequeueRemoteBatch();
  if (!batch.length) {
    return true;
  }

  isFlushInFlight = true;

  try {
    const didSend = await postRemoteBatch(batch);
    if (didSend) {
      removeRemoteBatch(batch.length);
      return true;
    }

    if (import.meta.env.DEV) {
      console.warn('App error telemetry remote sink rejected a batch.');
    }
    return false;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to flush app error telemetry remote batch.', error);
    }
    return false;
  } finally {
    isFlushInFlight = false;
  }
}

export function listPendingAppErrorTelemetryRemoteEvents() {
  return readStoredArray(APP_ERROR_REMOTE_QUEUE_KEY);
}

export function resetAppErrorTelemetryStateForTests() {
  if (flushTimerId) {
    clearTimeout(flushTimerId);
    flushTimerId = null;
  }
  isFlushInFlight = false;
}

function scheduleRemoteFlush() {
  if (!isAppErrorTelemetryRemoteEnabled() || typeof window === 'undefined') {
    return;
  }

  if (flushTimerId) {
    window.clearTimeout(flushTimerId);
  }

  flushTimerId = window.setTimeout(() => {
    flushTimerId = null;
    void flushAppErrorTelemetryRemote();
  }, 500);
}

export function emitAppErrorTelemetry(error, info, context = {}) {
  const normalizedContext = context && typeof context === 'object' ? context : {};
  const sanitizedError = sanitizeError(error);
  const componentStack = sanitizeInfo(info);
  const detail = {
    event: 'ui_error_boundary',
    timestamp: new Date().toISOString(),
    route: typeof window !== 'undefined' ? window.location?.pathname || '' : '',
    ...sanitizedError,
    componentStack,
    context: normalizedContext,
  };

  const current = readStoredArray(APP_ERROR_STORAGE_KEY);
  const next = [detail, ...current].slice(0, MAX_APP_ERROR_EVENTS);
  writeStoredArray(APP_ERROR_STORAGE_KEY, next);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(APP_ERROR_TELEMETRY_EVENT, { detail }));
  }

  enqueueRemoteTelemetryEvent(detail);
  scheduleRemoteFlush();

  if (import.meta.env.DEV) {
    console.error('[app-error-telemetry]', detail);
  }

  return detail;
}

export function listAppErrorTelemetryEvents() {
  return readStoredArray(APP_ERROR_STORAGE_KEY);
}
