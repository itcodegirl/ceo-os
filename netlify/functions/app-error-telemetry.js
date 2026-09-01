import { handleAppErrorTelemetryIngest } from '../../server/experimental/telemetry/appErrorTelemetryIngestCore.js';

export async function handler(event) {
  const normalizedRawBody = typeof event.body === 'string'
    ? event.body
    : JSON.stringify(event.body || {});

  const result = await handleAppErrorTelemetryIngest({
    method: event.httpMethod,
    body: event.body,
    headers: event.headers,
    rawBody: normalizedRawBody,
  });

  return {
    statusCode: result.status,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result.body),
  };
}
