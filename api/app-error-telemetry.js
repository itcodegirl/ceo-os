import { handleAppErrorTelemetryIngest } from '../server/experimental/telemetry/appErrorTelemetryIngestCore.js';

function normalizeRawBody(body) {
  if (typeof body === 'string') {
    return body;
  }

  if (!body) {
    return '';
  }

  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  const result = await handleAppErrorTelemetryIngest({
    method: req.method,
    body: req.body,
    headers: req.headers,
    rawBody: normalizeRawBody(req.body),
  });

  res.status(result.status).json(result.body);
}
