// Chief of Staff output types — the single source of truth shared by the
// client picker (`src/pages/ChiefOfStaff.jsx`) and the server proxy
// (`server/chiefOfStaffProxyCore.js`). Each entry carries:
//   title       — heading shown on the generated output card
//   label       — short name shown in the "Make a…" picker
//   group       — picker section (see CHIEF_ACTION_GROUPS)
//   hint         — one-line "best when…" guidance for the picker
//   instruction  — system-prompt instruction sent to the model
//   fallback     — deterministic local template used when the AI is
//                  unavailable; receives { notes }
//
// `actions` is kept as a convenience output even though the product's
// headline list folds it into "Action plan"; it produces a tasks-shaped
// payload that routes into the Weekly Brief.

export const CHIEF_ACTION_GROUPS = [
  { id: 'decide', label: 'Decide' },
  { id: 'plan', label: 'Plan' },
  { id: 'communicate', label: 'Communicate' },
  { id: 'pipeline', label: 'Pipeline' },
];

function trimmedLines(notes) {
  return String(notes || '')
    .split(/\r?\n|\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function firstLine(notes) {
  return trimmedLines(notes)[0] || '';
}

export const CHIEF_ACTIONS = {
  'decision-brief': {
    title: 'Decision Brief',
    label: 'Decision brief',
    group: 'decide',
    hint: 'Best when you are weighing one choice and want the options, trade-offs, and a clear recommendation laid out.',
    instruction:
      'Write a concise decision brief: state the decision in one sentence, list two or three options each with a short pros/cons, then give a single recommendation with the reasoning. Plain prose — no structured action lists.',
    fallback: ({ notes }) =>
      `Decision Brief:\n- Decision: ${firstLine(notes) || 'Name the decision in one sentence.'}\n- Option A: outline the first path (pros / cons).\n- Option B: outline the second path (pros / cons).\n- Recommendation: choose the option that protects momentum this week; set a date to revisit.`,
  },
  'blocker-analysis': {
    title: 'Blocker Analysis',
    label: 'Blocker analysis',
    group: 'decide',
    hint: 'Best when something is stuck and you want the cause, the owner, and the smallest move that unblocks it.',
    instruction:
      'Analyze the blockers described in the notes. For each blocker give: what is blocked, the likely root cause, the owner, and the single next move to unblock it. You may include a short structured tasks list for the next moves.',
    fallback: ({ notes }) => {
      const lines = trimmedLines(notes).slice(0, 3);
      const body = lines.length
        ? lines
            .map(
              (line) =>
                `- Blocked: ${line}\n  Likely cause: unclear owner or a missing decision\n  Next move: assign an owner and a date`,
            )
            .join('\n')
        : '- Blocked: name the blocker\n  Likely cause: unclear owner or a missing decision\n  Next move: assign an owner and a date';
      return `Blocker Analysis:\n${body}`;
    },
  },
  plan: {
    title: 'Executive Action Plan',
    label: 'Action plan',
    group: 'plan',
    hint: 'Best when you have a pile of mixed notes and need them turned into priorities, follow-ups, content, and tasks you can route.',
    instruction:
      'Return a concise founder action plan with structured sections for priorities, opportunities, content items, and tasks. Include practical next steps this week.',
    fallback: ({ notes }) =>
      `Executive Action Plan:\n- Priority: Clarify top execution lane for this week.\n- Opportunity: Follow up active partner or pipeline threads.\n- Content: Draft one founder-facing leadership update.\n- Task: Convert notes into owned actions.\n\nContext:\n${String(notes || '').slice(0, 280)}`,
  },
  priorities: {
    title: 'Priority Recommendation',
    label: 'Priority list',
    group: 'plan',
    hint: 'Best when you want this week ranked by impact, urgency, and the order things need to happen in.',
    instruction:
      'Recommend the top priorities for this week using impact, urgency, and sequence. Keep to three ranked bullets. Where useful, return a structured priorities list.',
    fallback: () =>
      'Priority Recommendation:\n1. Resolve high-urgency follow-ups with clear owners.\n2. Ship one high-leverage content artifact this week.\n3. Remove one strategic blocker that is slowing execution.',
  },
  actions: {
    title: 'Action Item List',
    label: 'Action list (next 72h)',
    group: 'plan',
    hint: 'Best when you want the notes broken into owned, dated actions for the next 72 hours.',
    instruction:
      'Return a prioritized action list for the next 72 hours. Include owner, outcome, and due timing for each item. Where useful, return a structured tasks list.',
    fallback: () =>
      'Action Items:\n- Owner: Team Member | Outcome: Confirm owner for each critical thread | Due: Today\n- Owner: Team Member | Outcome: Assign dates to each blocked item | Due: Tomorrow\n- Owner: Team | Outcome: Lock top 3 priorities for next 72 hours | Due: End of day',
  },
  summarize: {
    title: 'Weekly Update',
    label: 'Weekly update',
    group: 'communicate',
    hint: 'Best when you need the shareable version of "here is where things stand."',
    instruction:
      'Write a concise weekly update with three short paragraphs: context, key updates, and immediate risks. Plain prose, ready to send to a team or an investor.',
    fallback: ({ notes }) =>
      `Weekly Update:\n${trimmedLines(notes)
        .slice(0, 3)
        .map((line) => `- ${line}.`)
        .join('\n') || '- Add a few notes and regenerate for a fuller update.'}`,
  },
  'founder-memo': {
    title: 'Founder Memo',
    label: 'Founder memo',
    group: 'communicate',
    hint: 'Best when you want an internal narrative memo in your own voice — context, what you believe, what changes.',
    instruction:
      'Write an internal founder memo: a short narrative with a clear thesis, the reasoning behind it, and what changes as a result. First person, calm, direct. Prose only — no structured lists.',
    fallback: ({ notes }) =>
      `Founder Memo\n\nWhere we are:\n${String(notes || '').slice(0, 240) || 'Summarize the current moment in two sentences.'}\n\nWhat I believe:\n- The next win comes from focus, not more inputs.\n\nWhat changes now:\n- We commit to the top lane and protect it for the week.`,
  },
  'meeting-summary': {
    title: 'Meeting Summary',
    label: 'Meeting summary',
    group: 'communicate',
    hint: 'Best right after a call — paste the raw notes, get decisions, owners, and follow-ups.',
    instruction:
      'Summarize the meeting notes into three parts: decisions made, open questions, and follow-up actions with owners. Return a structured tasks list for the follow-ups when possible.',
    fallback: ({ notes }) =>
      `Meeting Summary:\nDecisions:\n- ${firstLine(notes) || 'Capture the key decision.'}\nOpen questions:\n- Note anything still unresolved.\nFollow-ups:\n- Owner: Team Member | Action: Confirm the next step | Due: This week`,
  },
  draft: {
    title: 'Content Draft',
    label: 'Content idea / post draft',
    group: 'communicate',
    hint: 'Best when you want a polished post or content idea in your founder voice — hook, insight, call to action.',
    instruction:
      'Draft a polished social post or content idea in the founder voice with a clear hook, an insight, and a call to action. Where useful, return a structured content list.',
    fallback: ({ notes }) =>
      `Content Draft:\n- Hook: This week we moved from planning to execution.\n- Insight: ${String(notes || '').slice(0, 180) || 'Share one practical leadership lesson from the week.'}\n- CTA: What is one operating-system habit that keeps your team aligned?`,
  },
  'opportunity-followup': {
    title: 'Opportunity Follow-up',
    label: 'Opportunity follow-up',
    group: 'pipeline',
    hint: 'Best when you have "talked to X" notes you want turned into tracked pipeline entries with next steps.',
    instruction:
      'From the notes, identify opportunities — partners, customers, roles, or outreach threads. For each, return a name, company, priority, stage, and the next step. Return a structured opportunities list.',
    fallback: ({ notes }) =>
      `Opportunity Follow-up:\n- Name: ${firstLine(notes) || 'Name the opportunity'} | Stage: New | Next step: Send a short follow-up this week.`,
  },
};

export function getChiefActionConfig(actionKey) {
  return CHIEF_ACTIONS[actionKey] || CHIEF_ACTIONS.summarize;
}

export function getChiefActionKeys() {
  return Object.keys(CHIEF_ACTIONS);
}

export function getChiefActionsByGroup() {
  return CHIEF_ACTION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    actions: getChiefActionKeys()
      .filter((key) => CHIEF_ACTIONS[key].group === group.id)
      .map((key) => {
        const { label, title, hint } = CHIEF_ACTIONS[key];
        return { key, label, title, hint };
      }),
  })).filter((group) => group.actions.length > 0);
}
