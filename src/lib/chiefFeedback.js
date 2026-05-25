// Chief of Staff feedback kinds. The page renders the bare `text`, but the
// hook layer tracks `kind` so transient hints (autosave confirmations, helper
// nudges) can't paint over the high-value `result` / `error` messages the
// user still needs to act on. Replaces the earlier prefix-regex hack
// (/^(Created:|AI unavailable|Unable to)/) which broke whenever a result
// message was reworded.
export const FEEDBACK_KIND = Object.freeze({
  info: 'info',
  progress: 'progress',
  result: 'result',
  error: 'error',
});

const DURABLE_KINDS = new Set([FEEDBACK_KIND.result, FEEDBACK_KIND.error]);

export function isDurableFeedbackKind(kind) {
  return DURABLE_KINDS.has(kind);
}

export function buildFeedback(kind, text) {
  return {
    kind: typeof kind === 'string' && kind ? kind : FEEDBACK_KIND.info,
    text: typeof text === 'string' ? text : '',
  };
}
