import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveTelemetryVerificationKeys,
  resetTelemetryKeyProviderCacheForTests,
} from './appErrorTelemetryKeyProvider.js';

describe('server/experimental/telemetry/appErrorTelemetryKeyProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    delete process.env.APP_ERROR_TELEMETRY_KEY_PROVIDER;
    delete process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_KMS_KEYS_URL;
    delete process.env.APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN;
    delete process.env.APP_ERROR_TELEMETRY_KMS_CACHE_MS;
    delete process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_MIN_ACTIVE_KEYS;
    delete process.env.APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY;
    resetTelemetryKeyProviderCacheForTests();
  });

  afterEach(() => {
    resetTelemetryKeyProviderCacheForTests();
    process.env = { ...originalEnv };
  });

  it('returns unconfigured state when no asymmetric key source is set', async () => {
    const result = await resolveTelemetryVerificationKeys();

    expect(result.configured).toBe(false);
    expect(result.required).toBe(false);
    expect(result.source).toBe('none');
  });

  it('resolves active keys from env-based asymmetric key map', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON = JSON.stringify({
      'env-key': {
        publicKeyPem,
        algorithm: 'ed25519',
        version: 'v1',
      },
    });

    const result = await resolveTelemetryVerificationKeys();

    expect(result.configured).toBe(true);
    expect(result.source).toBe('env');
    expect(result.keysById['env-key']).toMatchObject({
      keyId: 'env-key',
      version: 'v1',
      source: 'env',
    });
  });

  it('fetches KMS keys and reuses cached keysets within cache ttl', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_KMS_KEYS_URL = 'https://kms.example.com/keys';
    process.env.APP_ERROR_TELEMETRY_KMS_CACHE_MS = '60000';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        keys: [
          {
            keyId: 'kms-key',
            publicKeyPem,
            algorithm: 'ed25519',
            version: 'v3',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await resolveTelemetryVerificationKeys({ nowMs: Date.now() });
    const second = await resolveTelemetryVerificationKeys({ nowMs: Date.now() + 500 });

    expect(first.configured).toBe(true);
    expect(first.source).toBe('kms');
    expect(first.keysById['kms-key']).toBeTruthy();
    expect(second.metadata.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads provider-native keys through configured aws adapter overrides', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_KEY_PROVIDER = 'aws-kms';
    process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON = JSON.stringify([
      {
        signatureKeyId: 'aws-telemetry-key-v1',
        kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/sample',
      },
    ]);

    const result = await resolveTelemetryVerificationKeys({
      adapterOverrides: {
        'aws-kms': async () => ({
          entries: [
            {
              keyId: 'aws-telemetry-key-v1',
              kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/sample',
              publicKeyPem,
              algorithm: 'ed25519',
              version: 'v1',
              createdAt: '2026-04-01T00:00:00.000Z',
              providerMetadata: { provider: 'aws-kms', key_arn: 'arn:aws:kms:us-east-1:123456789012:key/sample' },
            },
          ],
          metadata: {
            provider: 'aws-kms',
          },
        }),
      },
    });

    expect(result.configured).toBe(true);
    expect(result.source).toBe('aws-kms');
    expect(result.keysById['aws-telemetry-key-v1']).toMatchObject({
      keyId: 'aws-telemetry-key-v1',
      source: 'aws-kms',
      kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/sample',
      keyProvenance: expect.objectContaining({
        provider: 'aws-kms',
      }),
    });
  });

  it('enforces telemetry key max-age rotation policy', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON = JSON.stringify({
      'env-key': {
        publicKeyPem,
        algorithm: 'ed25519',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    });
    process.env.APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS = '30';

    const result = await resolveTelemetryVerificationKeys({
      nowMs: Date.parse('2026-04-23T00:00:00.000Z'),
    });

    expect(result.configured).toBe(true);
    expect(result.source).toBe('env');
    expect(result.configError).toContain('max age exceeded');
  });

  it('enforces telemetry key future-key rotation policy when required', async () => {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON = JSON.stringify({
      'env-key': {
        publicKeyPem,
        algorithm: 'ed25519',
      },
    });
    process.env.APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY = 'true';

    const result = await resolveTelemetryVerificationKeys({
      nowMs: Date.parse('2026-04-23T00:00:00.000Z'),
    });

    expect(result.configured).toBe(true);
    expect(result.configError).toContain('future-dated key');
  });
});
