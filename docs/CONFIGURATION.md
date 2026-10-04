# Configuration reference

This file holds the long-form environment variable reference for CodeHerWay
CEO OS, including the telemetry / key-rotation surface. It used to live in
`README.md`, but the audit (`docs/audits/ceo-os-product-readiness-audit.md`)
flagged that the README had grown to 619 lines and buried the product story.
Splitting the env reference out keeps the README focused on what the project
*is* while preserving the full operational detail for anyone deploying.

The core product runs entirely on **local-first** storage. None of the
variables below are required for the app to function locally. The Supabase
variables are needed to enable sync; the OpenAI proxy variable is needed for
Chief of Staff AI generation; the telemetry stack is only needed if you
intend to run signed error-event ingest in production.

## Frontend (Vite) environment

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_OPENAI_PROXY_URL` | No | Defaults to `/api/chief-of-staff`. Override if the proxy is hosted elsewhere. |
| `VITE_SUPABASE_URL` | For sync | Enables Supabase-backed persistence for Opportunities, Content OS, Weekly Brief, and Settings. |
| `VITE_SUPABASE_ANON_KEY` | For sync | Paired with `VITE_SUPABASE_URL`. |
| `VITE_APP_ERROR_TELEMETRY_URL` | No | Remote ingest endpoint for app error telemetry. |
| `VITE_APP_ERROR_TELEMETRY_TOKEN` | No | Shared ingest token header. |
| `VITE_APP_ERROR_TELEMETRY_HMAC_SECRET` | No | HMAC signing secret for trusted/internal deployments only. |
| `VITE_APP_ERROR_TELEMETRY_SIGNATURE_KEY_ID` | No | Key-id header used with signed payloads. |

## Server-side environment

### Chief of Staff proxy

| Variable | Notes |
| --- | --- |
| `OPENAI_API_KEY` | Required for proxy responses. Never exposed to the browser. |
| `OPENAI_MODEL` | Optional override (default `gpt-4.1-mini`). |
| `CHIEF_STAFF_PROXY_TOKEN` | Shared secret token that clients must send in `Authorization: Bearer <token>` or `X-Chief-Staff-Token`. The proxy fails closed by default, so production deployments MUST set this. |
| `CHIEF_STAFF_REQUIRE_TOKEN` | Set to `false` to explicitly disable token auth for local dev. When unset, the proxy refuses unauthenticated requests. |
| `CHIEF_STAFF_RATE_LIMIT_PER_MINUTE` | Default `10` per source IP/header. Set to `0` to disable. |

### Error telemetry ingest

The telemetry stack is currently more elaborate than a single-founder
portfolio app requires, including support for asymmetric ed25519 keys and
KMS adapters across AWS / GCP / Azure. It is documented here for
completeness; the `docs/audits/ceo-os-product-readiness-audit.md` follow-up
section discusses scoping this down.

| Variable | Notes |
| --- | --- |
| `APP_ERROR_TELEMETRY_INGEST_TOKEN` | Validates telemetry ingest requests when set. |
| `APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT` | Active HMAC key for ingest signature validation. |
| `APP_ERROR_TELEMETRY_HMAC_SECRET_NEXT` | Next HMAC key used during overlap windows. |
| `APP_ERROR_TELEMETRY_HMAC_NEXT_VALID_FROM` | ISO datetime cutoff for when `*_NEXT` becomes valid. |
| `APP_ERROR_TELEMETRY_HMAC_CURRENT_VALID_UNTIL` | ISO datetime cutoff for current key sunset. |
| `APP_ERROR_TELEMETRY_HMAC_SECRET` | Legacy fallback when rotation keys are not configured. |
| `APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON` | JSON map of `keyId -> PEM public key` for ed25519 verification. |
| `APP_ERROR_TELEMETRY_KMS_KEYS_URL` | KMS-backed key distribution endpoint for asymmetric verification. |
| `APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN` | Bearer token used to fetch KMS keysets. |
| `APP_ERROR_TELEMETRY_KMS_CACHE_MS` | Keyset cache TTL in ms (default `300000`). |
| `APP_ERROR_TELEMETRY_KEY_PROVIDER` | Provider-native key adapter: `aws-kms`, `gcp-kms`, or `azure-keyvault`. |
| `APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON` | JSON array for AWS KMS signature key mappings. |
| `APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON` | JSON array for GCP KMS signature key mappings. |
| `APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON` | JSON array for Azure Key Vault signature key mappings. |
| `APP_ERROR_TELEMETRY_AWS_REGION` | AWS region for provider-native key lookups. |
| `APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS` | Asymmetric key max-age enforcement window. |
| `APP_ERROR_TELEMETRY_ROTATION_MIN_ACTIVE_KEYS` | Minimum active asymmetric keys required (default `1`). |
| `APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY` | Require at least one future-dated key to validate rollout readiness. |
| `APP_ERROR_TELEMETRY_KEY_AUDIT_ENABLED` | Set to `false` to disable key verification audit writes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for durable telemetry ingest persistence in Supabase. |
| `APP_ERROR_TELEMETRY_RETENTION_DAYS` | Default `45`. |
| `APP_ERROR_TELEMETRY_MAX_ROWS` | Default `50000`. |

### Scheduled SLO probe / ops fanout

| Variable | Notes |
| --- | --- |
| `OPS_INCIDENT_SUPABASE_URL` | Durable lifecycle state persistence for scheduled ops incidents. |
| `OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY` | Service role key for lifecycle event writes. |
| `OPS_INCIDENT_KEY` | Override for incident dedupe key (default `<repo>:scheduled-ops-alert`). |
| `TELEMETRY_INGEST_MONITOR_URL` | Used by the scheduled SLO probe job. |
| `TELEMETRY_INGEST_MONITOR_TOKEN` | Ingest token for SLO probe requests. |
| `TELEMETRY_INGEST_MONITOR_SIGNATURE_MODE` | `hmac-sha256` or `ed25519`. |
| `TELEMETRY_INGEST_MONITOR_SIGNATURE_KEY_ID` | Key-id header for SLO probe signatures. |
| `SLACK_OPS_WEBHOOK_URL` | Webhook used by scheduled ops fanout alerts. |
| `PAGERDUTY_EVENTS_ROUTING_KEY` | PagerDuty Events v2 routing key for on-call fanout. |

### CI integration tests

| Variable | Notes |
| --- | --- |
| `SUPABASE_TEST_URL` | When set in CI alongside `SUPABASE_TEST_SERVICE_ROLE_KEY`, the telemetry ingest integration tests run against a real Supabase project. |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | See above. |

## Data model references

Supabase migration scripts live under `supabase/migrations/`. The primary
tables are:

- `opportunities`
- `content_items`
- `weekly_briefs`
- `weekly_brief_items`
- `notebook_pages`
- `notebook_cards`, `notebook_questions`, `notebook_ideas`
- `profiles`
- `chief_sessions`
- `chief_outputs`
- `chief_telemetry_events`
- `app_error_telemetry_events`
- `app_error_telemetry_key_audit_events`
- `ops_slo_snapshots`
- `ops_incident_lifecycle_events`

## Local-only surfaces

Capture and Reminders are intentionally local-only — there are no Supabase
tables for them, and they never sync even when the user is signed in. The
in-product copy on those pages says so explicitly. If you want a record to
participate in the synced workspace, promote it (Capture sticky →
Opportunity / Content draft / Reminder, Reminder → Weekly priority) so it
lands in one of the synced repositories.

The Notebook (which replaced the Journal) is local-first with account sync:
every page saves to this browser immediately, and when the user is signed in
`notebookPagesRepository.syncNotebookPages()` pushes and pulls the
`notebook_pages` table. Existing Journal entries are copied into Personal
pages once; the original `ceo-os-journal-entries` key is kept as a backup.
