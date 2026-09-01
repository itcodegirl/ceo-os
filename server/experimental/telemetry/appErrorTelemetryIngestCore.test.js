import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAppErrorTelemetryIngest } from './appErrorTelemetryIngestCore.js';
import * as telemetryRepository from './appErrorTelemetryIngestRepository.js';
import * as keyAuditRepository from './appErrorTelemetryKeyAuditRepository.js';
import { resetTelemetryKeyProviderCacheForTests } from './appErrorTelemetryKeyProvider.js';

describe('server/experimental/telemetry/appErrorTelemetryIngestCore', () => {
  const originalEnv = { ...process.env };

  function createValidPayload() {
    return {
      source: 'codeherway-ceo-os',
      eventType: 'app_error',
      sentAt: '2026-04-22T20:00:00.000Z',
      events: [
        {
          event: 'ui_error_boundary',
          timestamp: '2026-04-22T20:00:00.000Z',
          name: 'TypeError',
          message: 'Cannot read properties of undefined',
          route: '/dashboard',
          componentStack: 'in Dashboard',
          context: { boundary: 'AppLayout' },
        },
      ],
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    delete process.env.APP_ERROR_TELEMETRY_INGEST_TOKEN;
    delete process.env.APP_ERROR_TELEMETRY_HMAC_SECRET;
    delete process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT;
    delete process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_NEXT;
    delete process.env.APP_ERROR_TELEMETRY_HMAC_NEXT_VALID_FROM;
    delete process.env.APP_ERROR_TELEMETRY_HMAC_CURRENT_VALID_UNTIL;
    delete process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_KMS_KEYS_URL;
    delete process.env.APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN;
    delete process.env.APP_ERROR_TELEMETRY_KMS_CACHE_MS;
    delete process.env.APP_ERROR_TELEMETRY_KEY_PROVIDER;
    delete process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_AWS_REGION;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_MIN_ACTIVE_KEYS;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY;
    resetTelemetryKeyProviderCacheForTests();
    vi.spyOn(telemetryRepository, 'persistAppErrorTelemetryBatch').mockResolvedValue({
      persisted: false,
      duplicate: false,
      storage: 'transient',
    });
    vi.spyOn(keyAuditRepository, 'recordTelemetryKeyVerificationAudit').mockResolvedValue({
      recorded: false,
      storage: 'transient',
    });
  });

  afterEach(() => {
    resetTelemetryKeyProviderCacheForTests();
    process.env = { ...originalEnv };
  });

  it('rejects non-POST methods with taxonomy error code', async () => {
    const result = await handleAppErrorTelemetryIngest({
      method: 'GET',
      body: null,
      headers: {},
    });

    expect(result.status).toBe(405);
    expect(result.body.error_code).toBe('METHOD_NOT_ALLOWED');
    expect(typeof result.body.request_id).toBe('string');
  });

  it('rejects invalid JSON strings', async () => {
    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: '{not json}',
      headers: {},
    });

    expect(result.status).toBe(400);
    expect(result.body.error_code).toBe('INVALID_BODY');
  });

  it('rejects malformed event payloads with validation message', async () => {
    const payload = createValidPayload();
    payload.events[0].timestamp = 'bad timestamp';

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      headers: {},
    });

    expect(result.status).toBe(400);
    expect(result.body.error_code).toBe('INVALID_PAYLOAD');
    expect(result.body.error).toContain('events[0].timestamp');
  });

  it('requires ingest token when configured', async () => {
    process.env.APP_ERROR_TELEMETRY_INGEST_TOKEN = 'secret';

    const invalidTokenResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: createValidPayload(),
      headers: {},
    });

    expect(invalidTokenResult.status).toBe(401);
    expect(invalidTokenResult.body.error_code).toBe('INGEST_AUTH_INVALID');

    const validTokenResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: createValidPayload(),
      headers: {
        'x-app-telemetry-token': 'secret',
      },
    });

    expect(validTokenResult.status).toBe(202);
    expect(validTokenResult.body.accepted_count).toBe(1);
  });

  it('requires valid signature when HMAC verification is enabled', async () => {
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET = 'hmac-secret';
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);

    const invalidSignatureResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {},
    });

    expect(invalidSignatureResult.status).toBe(401);
    expect(invalidSignatureResult.body.error_code).toBe('INGEST_SIGNATURE_INVALID');

    const signature = crypto
      .createHmac('sha256', process.env.APP_ERROR_TELEMETRY_HMAC_SECRET)
      .update(rawBody)
      .digest('hex');

    const validSignatureResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature': `sha256=${signature}`,
      },
    });

    expect(validSignatureResult.status).toBe(202);
    expect(validSignatureResult.body.signature_verified).toBe(true);
    expect(validSignatureResult.body.signature_required).toBe(true);
    expect(validSignatureResult.body.signature_key_id).toBe('legacy');
    expect(validSignatureResult.body.signature_algorithm).toBe('hmac-sha256');
  });

  it('accepts current and next rotation keys within active windows', async () => {
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT = 'hmac-current';
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_NEXT = 'hmac-next';
    process.env.APP_ERROR_TELEMETRY_HMAC_NEXT_VALID_FROM = '2000-01-01T00:00:00.000Z';
    process.env.APP_ERROR_TELEMETRY_HMAC_CURRENT_VALID_UNTIL = '2999-01-01T00:00:00.000Z';
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);

    const currentSignature = crypto
      .createHmac('sha256', process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT)
      .update(rawBody)
      .digest('hex');
    const currentResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature': `sha256=${currentSignature}`,
      },
    });
    expect(currentResult.status).toBe(202);
    expect(currentResult.body.signature_key_id).toBe('current');

    const nextSignature = crypto
      .createHmac('sha256', process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_NEXT)
      .update(rawBody)
      .digest('hex');
    const nextResult = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature': `sha256=${nextSignature}`,
      },
    });
    expect(nextResult.status).toBe(202);
    expect(nextResult.body.signature_key_id).toBe('next');
  });

  it('rejects keys outside configured rotation windows', async () => {
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT = 'hmac-current';
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_NEXT = 'hmac-next';
    process.env.APP_ERROR_TELEMETRY_HMAC_NEXT_VALID_FROM = '2999-01-01T00:00:00.000Z';
    process.env.APP_ERROR_TELEMETRY_HMAC_CURRENT_VALID_UNTIL = '2000-01-01T00:00:00.000Z';
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);
    const currentSignature = crypto
      .createHmac('sha256', process.env.APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT)
      .update(rawBody)
      .digest('hex');

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature': `sha256=${currentSignature}`,
      },
    });

    expect(result.status).toBe(503);
    expect(result.body.error_code).toBe('INGEST_SIGNATURE_CONFIG_INVALID');
  });

  it('supports asymmetric ed25519 verification with key-id headers', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON = JSON.stringify({
      'telemetry-key-2026-04': publicKeyPem,
    });
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);
    const signature = crypto.sign(null, Buffer.from(rawBody), keyPair.privateKey).toString('base64');

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature-key-id': 'telemetry-key-2026-04',
        'x-app-telemetry-signature': `ed25519=${signature}`,
      },
    });

    expect(result.status).toBe(202);
    expect(result.body.signature_verified).toBe(true);
    expect(result.body.signature_required).toBe(true);
    expect(result.body.signature_key_id).toBe('telemetry-key-2026-04');
    expect(result.body.signature_algorithm).toBe('ed25519');
    expect(result.body.signature_key_source).toBe('env');
  });

  it('rejects unknown asymmetric key ids safely', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON = JSON.stringify({
      'telemetry-key-2026-04': publicKeyPem,
    });
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);
    const signature = crypto.sign(null, Buffer.from(rawBody), keyPair.privateKey).toString('base64');

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature-key-id': 'unknown-key',
        'x-app-telemetry-signature': `ed25519=${signature}`,
      },
    });

    expect(result.status).toBe(401);
    expect(result.body.error_code).toBe('INGEST_SIGNATURE_INVALID');
  });

  it('supports KMS-backed asymmetric key retrieval and verification', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_KMS_KEYS_URL = 'https://kms.example.com/telemetry-keys';
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('kms.example.com')) {
        return {
          ok: true,
          json: async () => ({
            keys: [
              {
                keyId: 'kms-key-2026',
                publicKeyPem,
                algorithm: 'ed25519',
                version: 'v3',
                kmsKeyId: 'projects/demo/keys/telemetry/versions/3',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({}),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);
    const signature = crypto.sign(null, Buffer.from(rawBody), keyPair.privateKey).toString('base64');

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature-key-id': 'kms-key-2026',
        'x-app-telemetry-signature': `ed25519=${signature}`,
      },
    });

    expect(result.status).toBe(202);
    expect(result.body.signature_verified).toBe(true);
    expect(result.body.signature_key_source).toBe('kms');
    expect(result.body.signature_key_version).toBe('v3');
  });

  it('records signature audit metadata for verification attempts', async () => {
    process.env.APP_ERROR_TELEMETRY_HMAC_SECRET = 'hmac-secret';
    const payload = createValidPayload();
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', process.env.APP_ERROR_TELEMETRY_HMAC_SECRET)
      .update(rawBody)
      .digest('hex');
    const auditSpy = vi.spyOn(keyAuditRepository, 'recordTelemetryKeyVerificationAudit');

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      rawBody,
      headers: {
        'x-app-telemetry-signature': `hmac-sha256=${signature}`,
      },
    });

    expect(result.status).toBe(202);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationMode: 'hmac-sha256',
        signatureAlgorithm: 'hmac-sha256',
        verificationResult: true,
      }),
    );
  });

  it('persists valid payloads and forwards explicit idempotency keys', async () => {
    const persistSpy = vi.spyOn(telemetryRepository, 'persistAppErrorTelemetryBatch').mockResolvedValue({
      persisted: true,
      duplicate: false,
      storage: 'supabase',
    });

    const payload = {
      ...createValidPayload(),
      idempotencyKey: 'custom-idempotency-key',
    };
    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: payload,
      headers: {},
      rawBody: JSON.stringify(payload),
    });

    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({
      ok: true,
      accepted_count: 1,
      persisted: true,
      duplicate: false,
      storage: 'supabase',
      idempotency_key: 'custom-idempotency-key',
    });
    expect(persistSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'custom-idempotency-key',
        source: 'codeherway-ceo-os',
        eventType: 'app_error',
      }),
    );
    expect(typeof result.body.request_id).toBe('string');
  });

  it('returns a retryable error when persistence fails', async () => {
    vi.spyOn(telemetryRepository, 'persistAppErrorTelemetryBatch').mockRejectedValue(
      new Error('supabase unavailable'),
    );

    const result = await handleAppErrorTelemetryIngest({
      method: 'POST',
      body: createValidPayload(),
      headers: {},
    });

    expect(result.status).toBe(503);
    expect(result.body.error_code).toBe('PERSISTENCE_UNAVAILABLE');
    expect(result.body.retryable).toBe(true);
  });
});
