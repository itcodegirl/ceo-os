import fs from 'node:fs/promises';
import { transitionOpsIncidentLifecycleState } from '../server/experimental/telemetry/opsIncidentLifecycleRepository.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function writeGithubOutputs(outputs) {
  const outputPath = normalizeText(process.env.GITHUB_OUTPUT);
  if (!outputPath) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${String(value)}`);
  await fs.appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const incidentKey = normalizeText(process.env.OPS_INCIDENT_KEY)
    || `${normalizeText(process.env.GITHUB_REPOSITORY)}:scheduled-ops-alert`;
  const nextState = normalizeText(process.env.OPS_INCIDENT_NEXT_STATE) || 'recovered';

  const transition = await transitionOpsIncidentLifecycleState({
    incidentKey,
    nextState,
    transitionReason: normalizeText(process.env.OPS_INCIDENT_REASON),
    routeTrendOutcome: normalizeText(process.env.OPS_INCIDENT_ROUTE_OUTCOME),
    telemetryHealthOutcome: normalizeText(process.env.OPS_INCIDENT_TELEMETRY_HEALTH_OUTCOME),
    telemetryEndpointSloOutcome: normalizeText(process.env.OPS_INCIDENT_TELEMETRY_ENDPOINT_SLO_OUTCOME),
    issueNumber: normalizeText(process.env.OPS_INCIDENT_ISSUE_NUMBER),
    issueUrl: normalizeText(process.env.OPS_INCIDENT_ISSUE_URL),
    runId: normalizeText(process.env.GITHUB_RUN_ID),
    runUrl: normalizeText(process.env.GITHUB_RUN_URL),
    metadata: {
      workflow: normalizeText(process.env.GITHUB_WORKFLOW),
      actor: normalizeText(process.env.GITHUB_ACTOR),
    },
  });

  const outputs = {
    previous_state: transition.previousState || '',
    next_state: transition.nextState || '',
    state_changed: transition.stateChanged ? 'true' : 'false',
    storage: transition.storage || 'transient',
  };
  await writeGithubOutputs(outputs);

  console.log(
    `Incident lifecycle transition: ${outputs.previous_state || 'none'} -> ${outputs.next_state} (changed=${outputs.state_changed}, storage=${outputs.storage})`,
  );
}

main().catch((error) => {
  console.error('Unable to transition ops incident lifecycle state.', error);
  process.exit(1);
});
