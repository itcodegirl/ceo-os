import crypto from 'node:crypto';

const dynamicImport = new Function('modulePath', 'return import(modulePath)');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDateString(value) {
  if (!value) {
    return '';
  }

  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) {
    return '';
  }

  return nextDate.toISOString();
}

function mapAwsSigningAlgorithm(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return 'ed25519';
  }

  if (normalized === 'EDDSA') {
    return 'ed25519';
  }

  if (normalized.startsWith('ECDSA_SHA_')) {
    return `ecdsa-${normalized.replace('ECDSA_SHA_', 'sha-').toLowerCase()}`;
  }

  return normalized.toLowerCase();
}

function mapGcpAlgorithm(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return 'ed25519';
  }

  if (normalized === 'EC_SIGN_ED25519') {
    return 'ed25519';
  }

  if (normalized.startsWith('EC_SIGN_P')) {
    return `ecdsa-${normalized.replace('EC_SIGN_P', 'sha-')}`.toLowerCase();
  }

  return normalized.toLowerCase();
}

function mapAzureAlgorithm(jwk = {}) {
  const normalizedCurve = normalizeText(jwk?.crv).toLowerCase();
  if (normalizedCurve === 'ed25519') {
    return 'ed25519';
  }

  if (normalizedCurve.startsWith('p-')) {
    return `ecdsa-sha-${normalizedCurve.slice(2)}`;
  }

  return normalizeText(jwk?.alg).toLowerCase() || 'ed25519';
}

function convertDerToSpkiPem(derBuffer) {
  const buffer = Buffer.from(derBuffer);
  const base64 = buffer.toString('base64');
  const chunks = base64.match(/.{1,64}/g) || [];
  return [
    '-----BEGIN PUBLIC KEY-----',
    ...chunks,
    '-----END PUBLIC KEY-----',
  ].join('\n');
}

function convertJwkToSpkiPem(jwk) {
  if (!jwk || typeof jwk !== 'object') {
    throw new Error('Azure key material did not include a public JWK object.');
  }

  const keyObject = crypto.createPublicKey({
    key: jwk,
    format: 'jwk',
  });

  return keyObject.export({
    format: 'pem',
    type: 'spki',
  }).toString();
}

function normalizeProviderConfigs(rawJson, providerLabel) {
  const normalized = normalizeText(rawJson);
  if (!normalized) {
    return {
      error: `No ${providerLabel} key configuration found.`,
      configs: [],
    };
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      return {
        error: `${providerLabel} key configuration must be a JSON array.`,
        configs: [],
      };
    }

    return {
      error: '',
      configs: normalizeArray(parsed),
    };
  } catch {
    return {
      error: `${providerLabel} key configuration contains invalid JSON.`,
      configs: [],
    };
  }
}

async function importOptionalModule(modulePath, adapterName) {
  try {
    return await dynamicImport(modulePath);
  } catch (error) {
    const details = normalizeText(error?.message || String(error));
    throw new Error(`${adapterName} requires ${modulePath} to be installed${details ? ` (${details})` : ''}`);
  }
}

export function getProviderNativeKeyConfigs(provider) {
  const normalizedProvider = normalizeText(provider).toLowerCase();

  if (normalizedProvider === 'aws-kms') {
    return normalizeProviderConfigs(process.env.APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON, 'AWS KMS');
  }

  if (normalizedProvider === 'gcp-kms') {
    return normalizeProviderConfigs(process.env.APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON, 'GCP KMS');
  }

  if (normalizedProvider === 'azure-keyvault' || normalizedProvider === 'azure-kv') {
    return normalizeProviderConfigs(process.env.APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON, 'Azure Key Vault');
  }

  return {
    error: `Unsupported telemetry key provider: ${normalizedProvider || 'unknown'}`,
    configs: [],
  };
}

export async function loadAwsKmsTelemetryKeys({ configs = [] } = {}) {
  const { KMSClient, DescribeKeyCommand, GetPublicKeyCommand, GetKeyRotationStatusCommand } = await importOptionalModule(
    '@aws-sdk/client-kms',
    'AWS KMS telemetry adapter',
  );
  const region = normalizeText(process.env.APP_ERROR_TELEMETRY_AWS_REGION || process.env.AWS_REGION);
  const client = new KMSClient(region ? { region } : {});

  const entries = [];
  for (const config of normalizeArray(configs)) {
    const signatureKeyId = normalizeText(config?.signatureKeyId || config?.keyId || config?.id);
    const kmsKeyId = normalizeText(config?.kmsKeyId || config?.awsKeyId || config?.arn || config?.keyId);
    if (!signatureKeyId || !kmsKeyId) {
      continue;
    }

    const [publicKeyResponse, describeResponse] = await Promise.all([
      client.send(new GetPublicKeyCommand({ KeyId: kmsKeyId })),
      client.send(new DescribeKeyCommand({ KeyId: kmsKeyId })),
    ]);

    const publicKeyBytes = publicKeyResponse?.PublicKey;
    if (!publicKeyBytes) {
      continue;
    }

    let rotationEnabled = null;
    try {
      const rotationStatus = await client.send(new GetKeyRotationStatusCommand({ KeyId: kmsKeyId }));
      if (typeof rotationStatus?.KeyRotationEnabled === 'boolean') {
        rotationEnabled = rotationStatus.KeyRotationEnabled;
      }
    } catch {
      rotationEnabled = null;
    }

    const keyMetadata = describeResponse?.KeyMetadata || {};
    entries.push({
      keyId: signatureKeyId,
      publicKeyPem: convertDerToSpkiPem(publicKeyBytes),
      algorithm: normalizeText(config?.algorithm) || mapAwsSigningAlgorithm(publicKeyResponse?.SigningAlgorithms?.[0]),
      version: normalizeText(config?.version || keyMetadata?.KeyId),
      kmsKeyId,
      activeFrom: normalizeText(config?.activeFrom),
      activeUntil: normalizeText(config?.activeUntil),
      createdAt: normalizeDateString(keyMetadata?.CreationDate),
      providerMetadata: {
        provider: 'aws-kms',
        key_arn: normalizeText(keyMetadata?.Arn),
        aws_key_state: normalizeText(keyMetadata?.KeyState),
        aws_region: region,
        rotation_enabled: rotationEnabled,
      },
    });
  }

  return {
    entries,
    metadata: {
      provider: 'aws-kms',
      configured_key_count: normalizeArray(configs).length,
    },
  };
}

export async function loadGcpKmsTelemetryKeys({ configs = [] } = {}) {
  const { KeyManagementServiceClient } = await importOptionalModule(
    '@google-cloud/kms',
    'GCP KMS telemetry adapter',
  );
  const client = new KeyManagementServiceClient();

  const entries = [];
  for (const config of normalizeArray(configs)) {
    const signatureKeyId = normalizeText(config?.signatureKeyId || config?.keyId || config?.id);
    const keyVersionName = normalizeText(config?.keyVersionName || config?.kmsKeyId || config?.resourceName);
    if (!signatureKeyId || !keyVersionName) {
      continue;
    }

    const [publicKeyResponseTuple, keyVersionTuple] = await Promise.all([
      client.getPublicKey({ name: keyVersionName }),
      client.getCryptoKeyVersion({ name: keyVersionName }),
    ]);

    const publicKeyResponse = publicKeyResponseTuple?.[0] || {};
    const keyVersion = keyVersionTuple?.[0] || {};
    const publicKeyPem = normalizeText(publicKeyResponse?.pem);
    if (!publicKeyPem) {
      continue;
    }

    entries.push({
      keyId: signatureKeyId,
      publicKeyPem,
      algorithm: normalizeText(config?.algorithm) || mapGcpAlgorithm(publicKeyResponse?.algorithm),
      version: normalizeText(config?.version || keyVersion?.name?.split('/').pop()),
      kmsKeyId: keyVersionName,
      activeFrom: normalizeText(config?.activeFrom),
      activeUntil: normalizeText(config?.activeUntil),
      createdAt: normalizeDateString(keyVersion?.createTime),
      providerMetadata: {
        provider: 'gcp-kms',
        gcp_key_version: keyVersionName,
        gcp_key_state: normalizeText(keyVersion?.state),
      },
    });
  }

  return {
    entries,
    metadata: {
      provider: 'gcp-kms',
      configured_key_count: normalizeArray(configs).length,
    },
  };
}

export async function loadAzureKeyVaultTelemetryKeys({ configs = [] } = {}) {
  const { KeyClient } = await importOptionalModule(
    '@azure/keyvault-keys',
    'Azure Key Vault telemetry adapter',
  );
  const { DefaultAzureCredential } = await importOptionalModule(
    '@azure/identity',
    'Azure Key Vault telemetry adapter',
  );

  const credential = new DefaultAzureCredential();
  const clientsByVault = new Map();

  function getKeyClient(vaultUrl) {
    const cacheKey = vaultUrl.toLowerCase();
    if (!clientsByVault.has(cacheKey)) {
      clientsByVault.set(cacheKey, new KeyClient(vaultUrl, credential));
    }

    return clientsByVault.get(cacheKey);
  }

  const entries = [];
  for (const config of normalizeArray(configs)) {
    const signatureKeyId = normalizeText(config?.signatureKeyId || config?.keyId || config?.id);
    const vaultUrl = normalizeText(config?.vaultUrl);
    const keyName = normalizeText(config?.keyName);
    const keyVersion = normalizeText(config?.keyVersion || config?.version);
    if (!signatureKeyId || !vaultUrl || !keyName) {
      continue;
    }

    const keyClient = getKeyClient(vaultUrl);
    const keyBundle = await keyClient.getKey(keyName, {
      ...(keyVersion ? { version: keyVersion } : {}),
    });

    const publicKeyPem = convertJwkToSpkiPem(keyBundle?.key);
    entries.push({
      keyId: signatureKeyId,
      publicKeyPem,
      algorithm: normalizeText(config?.algorithm) || mapAzureAlgorithm(keyBundle?.key),
      version: normalizeText(keyVersion || keyBundle?.properties?.version),
      kmsKeyId: normalizeText(keyBundle?.id),
      activeFrom: normalizeText(config?.activeFrom || normalizeDateString(keyBundle?.properties?.notBefore)),
      activeUntil: normalizeText(config?.activeUntil || normalizeDateString(keyBundle?.properties?.expiresOn)),
      createdAt: normalizeDateString(keyBundle?.properties?.createdOn),
      providerMetadata: {
        provider: 'azure-keyvault',
        azure_vault_url: vaultUrl,
        azure_key_name: keyName,
        azure_key_id: normalizeText(keyBundle?.id),
        azure_key_enabled: typeof keyBundle?.properties?.enabled === 'boolean'
          ? keyBundle.properties.enabled
          : null,
      },
    });
  }

  return {
    entries,
    metadata: {
      provider: 'azure-keyvault',
      configured_key_count: normalizeArray(configs).length,
    },
  };
}
