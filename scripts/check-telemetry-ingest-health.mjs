import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { persistAppErrorTelemetryBatch } from '../server/experimental/telemetry/appErrorTelemetryIngestRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.resolve(repoRoot, 'artifacts');
const reportPath = path.resolve(artifactsDir, 'telemetry-ingest-health-report.md');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(value, fallback) {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

async function cleanupSyntheticRows({ supabaseUrl, serviceRoleKey, idempotencyKeys }) {
  if (!supabaseUrl || !serviceRoleKey || !idempotencyKeys.length) {
    return;
  }

  for (const idempotencyKey of idempotencyKeys) {
    const encodedKey = encodeURIComponent(`eq.${idempotencyKey}`);
    const url = `${supabaseUrl}/rest/v1/app_error_telemetry_events?idempotency_key=${encodedKey}`;
    await fetch(url, {
      method: 'DELETE',
      headers: {
        ...createHeaders(serviceRoleKey),
        Prefer: 'return=minimal',
      },
    });
  }
}

function createSyntheticPayload(idempotencyKey, index) {
  const now = new Date().toISOString();
  return {
    idempotencyKey,
    source: 'ci-telemetry-healthcheck',
    eventType: 'app_error',
    sentAt: now,
    requestId: `healthcheck-${Date.now()}-${index}`,
    events: [
      {
        event: 'ui_error_boundary',
        timestamp: now,
        name: 'HealthcheckError',
        message: `telemetry-health-attempt-${index}`,
        route: '/ci/healthcheck',
      },
    ],
    signatureVerified: true,
  };
}

async function writeReport(markdown) {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.writeFile(reportPath, markdown, 'utf8');
}

async function main() {
  const supabaseUrl = normalizeText(process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL);
  const serviceRoleKey = normalizeText(
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const attempts = parsePositiveInt(process.env.TELEMETRY_HEALTH_ATTEMPTS, 5);
  const maxFailureRatePct = parseNonNegativeNumber(
    process.env.TELEMETRY_HEALTH_MAX_FAILURE_RATE_PCT,
    20,
  );

  if (!supabaseUrl || !serviceRoleKey) {
    const skippedReport = [
      '# Telemetry Ingest Health Report',
      '',
      'Status: skipped (missing `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY`).',
    ].join('\n');
    await writeReport(skippedReport);
    console.log(skippedReport);
    return;
  }

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

  let failureCount = 0;
  let duplicateCount = 0;
  const idempotencyKeys = [];

  for (let index = 0; index < attempts; index += 1) {
    const idempotencyKey = `health-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    idempotencyKeys.push(idempotencyKey);

    try {
      const result = await persistAppErrorTelemetryBatch(createSyntheticPayload(idempotencyKey, index + 1));
      if (!result.persisted || result.storage !== 'supabase') {
        failureCount += 1;
      } else if (result.duplicate) {
        duplicateCount += 1;
      }
    } catch {
      failureCount += 1;
    }
  }

  await cleanupSyntheticRows({
    supabaseUrl,
    serviceRoleKey,
    idempotencyKeys,
  });

  const failureRatePct = attempts ? (failureCount / attempts) * 100 : 0;
  const passed = failureRatePct <= maxFailureRatePct;

  const reportLines = [
    '# Telemetry Ingest Health Report',
    '',
    `- Attempts: ${attempts}`,
    `- Failed attempts: ${failureCount}`,
    `- Duplicate attempts: ${duplicateCount}`,
    `- Failure rate: ${failureRatePct.toFixed(2)}%`,
    `- Max allowed failure rate: ${maxFailureRatePct.toFixed(2)}%`,
    `- Result: ${passed ? 'pass' : 'fail'}`,
  ];
  const reportMarkdown = reportLines.join('\n');
  await writeReport(reportMarkdown);
  console.log(reportMarkdown);

  if (!passed) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  const report = [
    '# Telemetry Ingest Health Report',
    '',
    '- Result: fail',
    `- Error: ${error?.message || String(error)}`,
  ].join('\n');
  await writeReport(report);
  console.error('Unable to check telemetry ingest health.', error);
  process.exit(1);
});
