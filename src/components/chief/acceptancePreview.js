// Per-item acceptance preview: what an accept-button click will do once
// confirmed. The ChiefSummaryCard's `buildAcceptanceSummary` already
// describes the "Add All" effect at the count level; this helper does the
// same job for an individual structured item so the user can verify the
// downstream effect before they click.
//
// Used as both visible caption ("→ Weekly Brief · priority") and
// accessible label / title ("Add priority 'Ship pricing v2' to this
// week's Weekly Brief") on the four per-item accept buttons.

function readField(item, ...fields) {
  if (!item || typeof item !== 'object') return '';
  for (const field of fields) {
    const value = item[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function quoteTitle(title) {
  return title ? `"${title}"` : '';
}

export function getItemTitle(section, item) {
  if (!item || typeof item !== 'object') return '';
  if (section === 'opportunities') {
    return readField(item, 'name', 'title');
  }
  return readField(item, 'title', 'name', 'task');
}

// Short caption suitable for a small "→ destination" line next to the
// button. Returns a destination + the most useful one-word qualifier
// (priority / stage / platform). No leading arrow — the caller can pick.
export function getAcceptancePreviewCaption(section, item) {
  if (!item || typeof item !== 'object') return '';
  switch (section) {
    case 'priorities':
      return 'Weekly Brief · priority';
    case 'opportunities': {
      const stage = readField(item, 'stage') || 'New';
      return `Opportunities · stage ${stage}`;
    }
    case 'contentItems': {
      const platform = readField(item, 'platform', 'channel');
      return platform ? `Content OS · ${platform}` : 'Content OS';
    }
    case 'tasks':
      return 'Weekly Brief · task';
    default:
      return '';
  }
}

// Long sentence suitable for an aria-label / title — names the item and
// the exact destination. Stays short enough that a screen reader can
// announce it in one breath.
export function getAcceptancePreviewSentence(section, item) {
  if (!item || typeof item !== 'object') return '';
  const title = getItemTitle(section, item);
  const quoted = quoteTitle(title);

  switch (section) {
    case 'priorities':
      return title
        ? `Add priority ${quoted} to this week's Weekly Brief`
        : 'Add priority to this week\'s Weekly Brief';
    case 'opportunities': {
      const company = readField(item, 'company', 'organization');
      const stage = readField(item, 'stage') || 'New';
      const where = company ? ` at ${company}` : '';
      return title
        ? `Add opportunity ${quoted}${where} (stage ${stage}) to Opportunities`
        : `Add opportunity (stage ${stage}) to Opportunities`;
    }
    case 'contentItems': {
      const platform = readField(item, 'platform', 'channel');
      const where = platform ? ` on ${platform}` : '';
      return title
        ? `Add content draft ${quoted}${where} to Content OS`
        : 'Add content draft to Content OS';
    }
    case 'tasks':
      return title
        ? `Add task ${quoted} to this week's Weekly Brief`
        : 'Add task to this week\'s Weekly Brief';
    default:
      return title ? `Add ${quoted}` : 'Add structured item';
  }
}

// Convenience: full button accessibility label that respects the
// in-flight / accepted states the button is already rendering.
export function getAcceptButtonAriaLabel({ section, item, isAccepting, isAccepted }) {
  const sentence = getAcceptancePreviewSentence(section, item);
  if (isAccepting) {
    return sentence ? `${sentence} (saving…)` : 'Saving…';
  }
  if (isAccepted) {
    return sentence ? `${sentence} — already added` : 'Already added';
  }
  return sentence;
}
