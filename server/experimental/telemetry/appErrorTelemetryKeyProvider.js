import crypto from 'node:crypto';
import {
  getProviderNativeKeyConfigs,
  loadAwsKmsTelemetryKeys,
  loadAzureKeyVaultTelemetryKeys,
  loadGcpKmsTelemetryKeys,
} from './appErrorTelemetryProviderNativeAdapters.js';

const DEFAULT_KMS_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_KMS_TIMEOUT_MS = 3000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const keyStateCache = new Map();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOptionalDateMs(value) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return null;
  }

  const parsed = Date.parse(normalizedValue);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value, fallback = false) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
}

function normalizeAlgorithm(value, fallback = 'ed25519') {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || fallback;
}

function normalizeProviderName(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'azure-kv') {
    return 'azure-keyvault';
  }

  return normalized;
}

function computeKeyFingerprint(publicKeyPem) {
  return crypto
    .createHash('sha256')
    .update(publicKeyPem)
    .digest('hex');
}

function normalizeKeyEntry(candidate, source, fetchedAtIso) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const keyId = normalizeText(candidate.keyId || candidate.key_id || candidate.id);
  const publicKeyPem = normalizeText(
    candidate.publicKeyPem || candidate.public_key_pem || candidate.publicKey,
  );
  if (!keyId || !publicKeyPem) {
    return null;
  }

  const activeFromMs = parseOptionalDateMs(
    candidate.activeFrom || candidate.active_from || candidate.validFrom || candidate.valid_from,
  );
  const activeUntilMs = parseOptionalDateMs(
    candidate.activeUntil || candidate.active_until || candidate.validUntil || candidate.valid_until,
  );
  const createdAtMs = parseOptionalDateMs(
    candidate.createdAt || candidate.created_at || candidate.generatedAt || candidate.generated_at,
  );
  if (Number.isNaN(activeFromMs) || Number.isNaN(activeUntilMs) || Number.isNaN(createdAtMs)) {
    return null;
  }

  const fingerprintSha256 = computeKeyFingerprint(publicKeyPem);
  const providerMetadata = candidate.providerMetadata && typeof candidate.providerMetadata === 'object'
    ? candidate.providerMetadata
    : {};

  return {
    keyId,
    publicKeyPem,
    algorithm: normalizeAlgorithm(candidate.algorithm),
    version: normalizeText(candidate.version || candidate.keyVersion || candidate.key_version),
    kmsKeyId: normalizeText(candidate.kmsKeyId || candidate.kms_key_id),
    activeFromMs,
    activeUntilMs,
    createdAtMs,
    source,
    keyProvenance: {
      provider: source,
      fetched_at: fetchedAtIso,
      key_fingerprint_sha256: fingerprintSha256,
      kms_key_id: normalizeText(candidate.kmsKeyId || candidate.kms_key_id),
      provider_metadata: providerMetadata,
    },
  };
}

function isEntryActive(entry, nowMs) {
  const isAfterStart = entry.activeFromMs === null || nowMs >= entry.activeFromMs;
  const isBeforeEnd = entry.activeUntilMs === null || nowMs <= entry.activeUntilMs;
  return isAfterStart && isBeforeEnd;
}

function buildKeyState({
  configured,
  required,
  source,
  configError = '',
  entries = [],
  metadata = {},
}) {
  const keysById = entries.reduce((accumulator, entry) => {
    accumulator[entry.keyId] = entry;
    return accumulator;
  }, {});

  return {
    configured,
    required,
    source,
    configError,
    entries,
    keysById,
    metadata: {
      activeKeyCount: entries.length,
      ...metadata,
    },
  };
}

function buildCachedState(state) {
  return buildKeyState({
    ...state,
    metadata: {
      ...state.metadata,
      cacheHit: true,
    },
  });
}

function readCachedState(cacheKey, nowMs, cacheMs) {
  const cached = keyStateCache.get(cacheKey);
  if (!cached || nowMs - cached.fetchedAt >= cacheMs) {
    return null;
  }

  return buildCachedState(cached.state);
}

function writeCachedState(cacheKey, state, nowMs) {
  keyStateCache.set(cacheKey, {
    fetchedAt: nowMs,
    state,
  });
}

function evaluateRotationPolicy(entries, nowMs) {
  const maxAgeDays = parsePositiveInt(process.env.APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS, 0);
  const minActiveKeys = parsePositiveInt(process.env.APP_ERROR_TELEMETRY_ROTATION_MIN_ACTIVE_KEYS, 1);
  const requireFutureKey = parseBoolean(process.env.APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY, false);

  const activeEntries = entries.filter((entry) => isEntryActive(entry, nowMs));
  if (activeEntries.length < minActiveKeys) {
    return `Telemetry key rotation policy requires at least ${minActiveKeys} active key(s)`;
  }

  if (requireFutureKey) {
    const hasFutureKey = entries.some((entry) => (
      Number.isFinite(entry.activeFromMs)
      && entry.activeFromMs > nowMs
    ));
    if (!hasFutureKey) {
      return 'Telemetry key rotation policy requires at least one future-dated key';
    }
  }

  if (maxAgeDays > 0 && activeEntries.length > 0) {
    const maxAgeMs = maxAgeDays * ONE_DAY_MS;
    const ageCheckedEntries = activeEntries.filter((entry) => Number.isFinite(entry.createdAtMs));
    if (ageCheckedEntries.length > 0) {
      const allEntriesStale = ageCheckedEntries.every((entry) => nowMs - entry.createdAtMs > maxAgeMs);
      if (allEntriesStale) {
        return `Telemetry key rotation policy max age exceeded (${maxAgeDays} day window)`;
      }
    }
  }

  return '';
}

function parseEnvAsymmetricKeyMap(rawJson, nowMs) {
  const normalizedJson = normalizeText(rawJson);
  if (!normalizedJson) {
    return buildKeyState({
      configured: false,
      required: false,
      source: 'none',
      entries: [],
      metadata: {
        rawKeyCount: 0,
      },
    });
  }

  try {
    const parsed = JSON.parse(normalizedJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return buildKeyState({
        configured: true,
        required: true,
        source: 'env',
        configError: 'Telemetry asymmetric key configuration must be a JSON object',
      });
    }

    const fetchedAtIso = new Date(nowMs).toISOString();
    const rawEntries = Object.entries(parsed).map(([keyId, value]) => {
      if (typeof value === 'string') {
        return normalizeKeyEntry({ keyId, publicKeyPem: value }, 'env', fetchedAtIso);
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return normalizeKeyEntry({ keyId, ...value }, 'env', fetchedAtIso);
      }

      return null;
    }).filter(Boolean);

    const policyError = evaluateRotationPolicy(rawEntries, nowMs);
    const activeEntries = rawEntries.filter((entry) => isEntryActive(entry, nowMs));
    if (!rawEntries.length) {
      return buildKeyState({
        configured: true,
        required: true,
        source: 'env',
        configError: 'No asymmetric telemetry public keys are configured',
        metadata: {
          rawKeyCount: 0,
        },
      });
    }

    if (!activeEntries.length) {
      return buildKeyState({
        configured: true,
        required: true,
        source: 'env',
        configError: 'No active asymmetric telemetry public keys are valid for the current time window',
        metadata: {
          rawKeyCount: rawEntries.length,
        },
      });
    }

    if (policyError) {
      return buildKeyState({
        configured: true,
        required: true,
        source: 'env',
        configError: policyError,
        metadata: {
          rawKeyCount: rawEntries.length,
          rotationPolicyError: policyError,
        },
      });
    }

    return buildKeyState({
      configured: true,
      required: true,
      source: 'env',
      entries: activeEntries,
      metadata: {
        rawKeyCount: rawEntries.length,
      },
    });
  } catch {
    return buildKeyState({
      configured: true,
      required: true,
      source: 'env',
      configError: 'Telemetry asymmetric key configuration contains invalid JSON',
    });
  }
}

async function fetchProviderNativeAsymmetricKeys({ nowMs, adapterOverrides = {} }) {
  const provider = normalizeProviderName(process.env.APP_ERROR_TELEMETRY_KEY_PROVIDER);
  if (!provider) {
    return null;
  }

  const cacheMs = parsePositiveInt(process.env.APP_ERROR_TELEMETRY_KMS_CACHE_MS, DEFAULT_KMS_CACHE_MS);
  const cacheKey = `native-provider:${provider}`;
  const cachedState = readCachedState(cacheKey, nowMs, cacheMs);
  if (cachedState) {
    return cachedState;
  }

  const { error: providerConfigError, configs } = getProviderNativeKeyConfigs(provider);
  if (providerConfigError) {
    return buildKeyState({
      configured: true,
      required: true,
      source: provider,
      configError: providerConfigError,
    });
  }

  const providerLoaders = {
    'aws-kms': adapterOverrides['aws-kms'] || loadAwsKmsTelemetryKeys,
    'gcp-kms': adapterOverrides['gcp-kms'] || loadGcpKmsTelemetryKeys,
    'azure-keyvault': adapterOverrides['azure-keyvault'] || loadAzureKeyVaultTelemetryKeys,
  };

  const providerLoader = providerLoaders[provider];
  if (typeof providerLoader !== 'function') {
    return buildKeyState({
      configured: true,
      required: true,
      source: provider,
      configError: `No provider adapter is available for ${provider}`,
    });
  }

  try {
    const fetchedAtIso = new Date(nowMs).toISOString();
    const providerResult = await providerLoader({ configs, nowMs });
    const rawEntries = (Array.isArray(providerResult?.entries) ? providerResult.entries : [])
      .map((entry) => normalizeKeyEntry(entry, provider, fetchedAtIso))
      .filter(Boolean);

    if (!rawEntries.length) {
      return buildKeyState({
        configured: true,
        required: true,
        source: provider,
        configError: `${provider} adapter returned no usable asymmetric telemetry keys`,
        metadata: {
          rawKeyCount: 0,
          fetchedAt: fetchedAtIso,
          cacheHit: false,
        },
      });
    }

    const activeEntries = rawEntries.filter((entry) => isEntryActive(entry, nowMs));
    if (!activeEntries.length) {
      return buildKeyState({
        configured: true,
        required: true,
        source: provider,
        configError: `No active ${provider} telemetry keys are valid for the current time window`,
        metadata: {
          rawKeyCount: rawEntries.length,
          fetchedAt: fetchedAtIso,
          cacheHit: false,
        },
      });
    }

    const rotationPolicyError = evaluateRotationPolicy(rawEntries, nowMs);
    if (rotationPolicyError) {
      return buildKeyState({
        configured: true,
        required: true,
        source: provider,
        configError: rotationPolicyError,
        metadata: {
          rawKeyCount: rawEntries.length,
          fetchedAt: fetchedAtIso,
          cacheHit: false,
          rotationPolicyError,
        },
      });
    }

    const state = buildKeyState({
      configured: true,
      required: true,
      source: provider,
      entries: activeEntries,
      metadata: {
        rawKeyCount: rawEntries.length,
        fetchedAt: fetchedAtIso,
        cacheHit: false,
        ...(providerResult?.metadata && typeof providerResult.metadata === 'object'
          ? providerResult.metadata
          : {}),
      },
    });

    writeCachedState(cacheKey, state, nowMs);
    return state;
  } catch (error) {
    return buildKeyState({
      configured: true,
      required: true,
      source: provider,
      configError: `${provider} key retrieval failed: ${normalizeText(error?.message || String(error))}`,
    });
  }
}

async function fetchKmsAsymmetricKeys({ nowMs }) {
  const kmsUrl = normalizeText(process.env.APP_ERROR_TELEMETRY_KMS_KEYS_URL);
  if (!kmsUrl || typeof fetch !== 'function') {
    return null;
  }

  const cacheMs = parsePositiveInt(process.env.APP_ERROR_TELEMETRY_KMS_CACHE_MS, DEFAULT_KMS_CACHE_MS);
  const cacheKey = 'kms-endpoint';
  const cachedState = readCachedState(cacheKey, nowMs, cacheMs);
  if (cachedState) {
    return cachedState;
  }

  const timeoutMs = parsePositiveInt(process.env.APP_ERROR_TELEMETRY_KMS_TIMEOUT_MS, DEFAULT_KMS_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(kmsUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(normalizeText(process.env.APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN)
          ? { Authorization: `Bearer ${normalizeText(process.env.APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN)}` }
          : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return buildKeyState({
        configured: true,
        required: true,
        source: 'kms',
        configError: `KMS asymmetric key retrieval failed (${response.status})${details ? `: ${details}` : ''}`,
      });
    }

    const body = await response.json().catch(() => null);
    const keys = Array.isArray(body) ? body : body?.keys;
    if (!Array.isArray(keys)) {
      return buildKeyState({
        configured: true,
        required: true,
        source: 'kms',
        configError: 'KMS key response must include a keys array',
      });
    }

    const fetchedAtIso = new Date(nowMs).toISOString();
    const rawEntries = keys
      .map((entry) => normalizeKeyEntry(entry, 'kms', fetchedAtIso))
      .filter(Boolean);
    const activeEntries = rawEntries.filter((entry) => isEntryActive(entry, nowMs));
    const policyError = evaluateRotationPolicy(rawEntries, nowMs);

    const state = !rawEntries.length
      ? buildKeyState({
        configured: true,
        required: true,
        source: 'kms',
        configError: 'KMS returned no usable asymmetric telemetry keys',
        metadata: {
          rawKeyCount: 0,
          fetchedAt: fetchedAtIso,
          cacheHit: false,
        },
      })
      : !activeEntries.length
        ? buildKeyState({
          configured: true,
          required: true,
          source: 'kms',
          configError: 'No active KMS telemetry keys are valid for the current time window',
          metadata: {
            rawKeyCount: rawEntries.length,
            fetchedAt: fetchedAtIso,
            cacheHit: false,
          },
        })
        : policyError
          ? buildKeyState({
            configured: true,
            required: true,
            source: 'kms',
            configError: policyError,
            metadata: {
              rawKeyCount: rawEntries.length,
              fetchedAt: fetchedAtIso,
              cacheHit: false,
              rotationPolicyError: policyError,
            },
          })
          : buildKeyState({
            configured: true,
            required: true,
            source: 'kms',
            entries: activeEntries,
            metadata: {
              rawKeyCount: rawEntries.length,
              fetchedAt: fetchedAtIso,
              cacheHit: false,
            },
          });

    writeCachedState(cacheKey, state, nowMs);
    return state;
  } catch (error) {
    clearTimeout(timeoutId);
    return buildKeyState({
      configured: true,
      required: true,
      source: 'kms',
      configError: `KMS asymmetric key retrieval failed: ${normalizeText(error?.message || String(error))}`,
    });
  }
}

export async function resolveTelemetryVerificationKeys({ nowMs = Date.now(), adapterOverrides = {} } = {}) {
  const providerState = await fetchProviderNativeAsymmetricKeys({ nowMs, adapterOverrides });
  if (providerState) {
    return providerState;
  }

  const kmsState = await fetchKmsAsymmetricKeys({ nowMs });
  if (kmsState) {
    return kmsState;
  }

  return parseEnvAsymmetricKeyMap(process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON, nowMs);
}

export function resetTelemetryKeyProviderCacheForTests() {
  keyStateCache.clear();
}
