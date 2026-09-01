import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProviderNativeKeyConfigs } from './appErrorTelemetryProviderNativeAdapters.js';

describe('server/experimental/telemetry/appErrorTelemetryProviderNativeAdapters', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON;
    delete process.env.APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reads provider-specific json configs', () => {
    process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON = JSON.stringify([
      { signatureKeyId: 'aws-key-v1', kmsKeyId: 'arn:aws:kms:us-east-1:acct:key/key-id' },
    ]);

    const result = getProviderNativeKeyConfigs('aws-kms');

    expect(result.error).toBe('');
    expect(result.configs).toHaveLength(1);
    expect(result.configs[0]).toMatchObject({
      signatureKeyId: 'aws-key-v1',
    });
  });

  it('returns helpful config errors for malformed provider json', () => {
    process.env.APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON = '{bad-json}';

    const result = getProviderNativeKeyConfigs('gcp-kms');

    expect(result.configs).toEqual([]);
    expect(result.error).toContain('invalid JSON');
  });

  it('normalizes azure-kv alias to azure keyvault config', () => {
    process.env.APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON = JSON.stringify([
      { signatureKeyId: 'azure-key-v1', vaultUrl: 'https://example.vault.azure.net', keyName: 'telemetry-signing' },
    ]);

    const result = getProviderNativeKeyConfigs('azure-kv');

    expect(result.error).toBe('');
    expect(result.configs[0]).toMatchObject({
      signatureKeyId: 'azure-key-v1',
      keyName: 'telemetry-signing',
    });
  });
});
