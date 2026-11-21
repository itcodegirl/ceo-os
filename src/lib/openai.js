import { getSupabaseRuntime } from './supabaseRuntime';
import { getChiefActionConfig } from './chiefActions';
import { buildCreateId } from './utils';
import {
  createEmptyStructuredPayload,
  extractResponseText,
  extractStructuredPayload,
  hasStructuredContent,
} from './chiefStructuredPayload';

const configuredProxyUrl = (import.meta.env.VITE_OPENAI_PROXY_URL || '').trim();
const fallbackProxyUrl = '/api/chief-of-staff';
const OPENAI_PROXY_URL = configuredProxyUrl || fallbackProxyUrl;
const shouldLogProxyDebug = import.meta.env.DEV && import.meta.env.VITE_CHIEF_PROXY_DEBUG === 'true';

if (!configuredProxyUrl && shouldLogProxyDebug) {
  console.info(
    'Chief proxy URL is not explicitly configured. Using the default /api/chief-of-staff endpoint.',
  );
}

const REQUEST_TIMEOUT_MS = 12000;

export const aiConfig = {
  hasProxyEndpoint: Boolean(configuredProxyUrl),
  endpoint: OPENAI_PROXY_URL,
  configuredEndpoint: configuredProxyUrl || null,
};

function normalizeCorrelationId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized.slice(0, 96);
}

function parseRequestId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeErrorCode(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 80);
}

function normalizeErrorMessage(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 220);
}

function createChiefProxyError(message, metadata = {}) {
  const error = new Error(message);
  error.code = normalizeErrorCode(metadata.code);
  error.status = Number(metadata.status) || 0;
  error.requestId = parseRequestId(metadata.requestId);
  error.correlationId = normalizeCorrelationId(metadata.correlationId);
  error.userMessage = normalizeErrorMessage(metadata.userMessage);
  return error;
}

async function readProxyError(response) {
  const rawBody = await response.text().catch(() => '');
  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { error: rawBody };
  }
}

function createFallback(actionKey, notes, metadata = {}) {
  const config = getChiefActionConfig(actionKey);
  return {
    title: config.title,
    content: config.fallback({ notes }),
    structuredPayload: createEmptyStructuredPayload(),
    source: 'fallback',
    requestId: parseRequestId(metadata.requestId),
    correlationId: normalizeCorrelationId(metadata.correlationId),
    fallbackReason: normalizeErrorMessage(metadata.fallbackReason || 'AI output was unavailable.'),
    errorCode: normalizeErrorCode(metadata.errorCode),
    errorMessage: normalizeErrorMessage(metadata.errorMessage),
  };
}

async function fetchChiefProxy(payload, options = {}) {
  const correlationId = normalizeCorrelationId(options.correlationId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const runtime = await getSupabaseRuntime();
    const client = runtime ? await runtime.getSupabaseClient() : null;
    const sessionResult = client ? await client.auth.getSession() : null;
    if (sessionResult?.error) throw sessionResult.error;
    const accessToken = sessionResult?.data?.session?.access_token;
    return await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(correlationId ? { 'x-chief-correlation-id': correlationId } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createChiefProxyError('Chief of staff proxy request timed out', {
        code: 'CHIEF_PROXY_TIMEOUT',
        userMessage: 'The AI request timed out before a response came back.',
        correlationId,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getChiefActionTitle = (actionKey) => getChiefActionConfig(actionKey).title;

export async function generateChiefOfStaffResponse({ actionKey, notes, correlationId = '' }) {
  const normalizedNotes = notes?.trim() || '';
  const normalizedCorrelationId = normalizeCorrelationId(correlationId) || buildCreateId();

  if (!normalizedNotes) {
    return {
      title: getChiefActionConfig(actionKey).title,
      content: '',
      structuredPayload: createEmptyStructuredPayload(),
      source: 'empty',
      requestId: '',
      correlationId: normalizedCorrelationId,
    };
  }

  if (!aiConfig.endpoint) {
    return createFallback(actionKey, normalizedNotes, {
      correlationId: normalizedCorrelationId,
      fallbackReason: 'The AI proxy endpoint is not configured.',
      errorCode: 'CHIEF_PROXY_NOT_CONFIGURED',
      errorMessage: 'AI proxy endpoint is missing.',
    });
  }

  const config = getChiefActionConfig(actionKey);

  try {
    const response = await fetchChiefProxy({
      actionKey,
      notes: normalizedNotes,
    }, {
      correlationId: normalizedCorrelationId,
    });

    if (!response.ok) {
      const errorPayload = await readProxyError(response);
      throw createChiefProxyError(`AI proxy request failed with status ${response.status}`, {
        status: response.status,
        code: errorPayload?.error_code || `CHIEF_PROXY_HTTP_${response.status}`,
        requestId: errorPayload?.request_id,
        correlationId: errorPayload?.correlation_id || normalizedCorrelationId,
        userMessage: errorPayload?.error || 'The AI service returned an error.',
      });
    }

    const payload = await response.json();
    const requestId = parseRequestId(payload?.request_id);
    const responseCorrelationId = normalizeCorrelationId(payload?.correlation_id) || normalizedCorrelationId;
    const output = extractResponseText(payload);
    const structuredPayload = extractStructuredPayload(payload, output);

    if (!output) {
      const fallback = createFallback(actionKey, normalizedNotes);
      return {
        ...fallback,
        structuredPayload: hasStructuredContent(structuredPayload)
          ? structuredPayload
          : fallback.structuredPayload,
        requestId,
        correlationId: responseCorrelationId,
        fallbackReason: 'The AI service returned no readable output.',
        errorCode: 'CHIEF_EMPTY_OUTPUT',
        errorMessage: 'AI response did not include output text.',
      };
    }

    return {
      title: config.title,
      content: output,
      structuredPayload,
      source: 'proxy',
      requestId,
      correlationId: responseCorrelationId,
    };
  } catch (error) {
    return createFallback(actionKey, normalizedNotes, {
      requestId: error?.requestId,
      correlationId: error?.correlationId || normalizedCorrelationId,
      fallbackReason: 'AI generation is unavailable; this is a local template fallback.',
      errorCode: error?.code || 'CHIEF_PROXY_UNAVAILABLE',
      errorMessage: error?.userMessage || error?.message || 'AI generation failed.',
    });
  }
}
