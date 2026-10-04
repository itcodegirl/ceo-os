// Cards, questions, and ideas made from notebook writing.
//
// Ported from the Study Journal models (cards.model / questions.model /
// ideas.model), with one change: an item links to a notebook *page* (and the
// block its source text came from) instead of a course topic. Items are only
// ever created by an explicit save in a composer; writing, highlighting, or
// deleting notes never creates or removes one (see the guard test).

import { buildCreateId } from '../../utils';
import { createInitialSchedule } from './cardSchedule';
import { SR_GRADES, SR_STARTING_EASE, SR_STARTING_INTERVAL } from './srAlgorithm';

export const NOTEBOOK_ITEM_KINDS = Object.freeze(['card', 'question', 'idea']);

export const ITEM_LABELS = Object.freeze({
  card: Object.freeze({ singular: 'card', plural: 'Cards', create: 'New card', fromSelection: 'Make card' }),
  question: Object.freeze({ singular: 'question', plural: 'Questions', create: 'New question', fromSelection: 'Question' }),
  idea: Object.freeze({ singular: 'idea', plural: 'Ideas', create: 'New idea', fromSelection: 'Idea' }),
});

export const CARD_LIMITS = Object.freeze({ prompt: 300, answer: 1000 });
export const QUESTION_LIMITS = Object.freeze({ text: 500, answer: 2000 });
export const IDEA_LIMITS = Object.freeze({ title: 120, description: 2000, category: 40 });
/** Upper bound on the source text stored with an item. */
export const SOURCE_TEXT_LIMIT = 2000;

export const QUESTION_STATUS_LABELS = Object.freeze({ unanswered: 'Unanswered', answered: 'Answered' });
export const IDEA_CATEGORY_SUGGESTIONS = Object.freeze(['Project', 'Experiment', 'Content', 'Product', 'Practice']);

// ── Text helpers ─────────────────────────────────────────────────────────────

export function truncate(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function collapseWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}

/** Validates a trimmed text field; returns the error message or undefined. */
function checkText({ value, maxLength, requiredMessage, tooLongMessage }) {
  const trimmed = asText(value).trim();
  if (!trimmed) return requiredMessage;
  if (trimmed.length > maxLength) return tooLongMessage;
  return undefined;
}

function collectErrors(entries) {
  return Object.fromEntries(entries.filter(([, message]) => message));
}

// ── Drafts and validation ────────────────────────────────────────────────────

export function validateCardDraft(draft) {
  return collectErrors([
    ['prompt', checkText({
      value: draft.prompt,
      maxLength: CARD_LIMITS.prompt,
      requiredMessage: 'Write the prompt you want to answer from memory.',
      tooLongMessage: `Keep the prompt under ${CARD_LIMITS.prompt} characters.`,
    })],
    ['answer', checkText({
      value: draft.answer,
      maxLength: CARD_LIMITS.answer,
      requiredMessage: 'Add the answer you want to recall.',
      tooLongMessage: `Keep the answer under ${CARD_LIMITS.answer} characters.`,
    })],
  ]);
}

export function validateQuestionDraft(draft) {
  return collectErrors([
    ['text', checkText({
      value: draft.text,
      maxLength: QUESTION_LIMITS.text,
      requiredMessage: 'Write the question you want to come back to.',
      tooLongMessage: `Keep the question under ${QUESTION_LIMITS.text} characters.`,
    })],
    ['answer', checkText({
      value: draft.answer,
      maxLength: QUESTION_LIMITS.answer,
      tooLongMessage: `Keep the answer under ${QUESTION_LIMITS.answer} characters.`,
    })],
  ]);
}

export function validateIdeaDraft(draft) {
  return collectErrors([
    ['title', checkText({
      value: draft.title,
      maxLength: IDEA_LIMITS.title,
      requiredMessage: 'Give the idea a short title.',
      tooLongMessage: `Keep the title under ${IDEA_LIMITS.title} characters.`,
    })],
    ['description', checkText({
      value: draft.description,
      maxLength: IDEA_LIMITS.description,
      tooLongMessage: `Keep the description under ${IDEA_LIMITS.description} characters.`,
    })],
    ['category', checkText({
      value: draft.category,
      maxLength: IDEA_LIMITS.category,
      tooLongMessage: `Keep the category under ${IDEA_LIMITS.category} characters.`,
    })],
  ]);
}

export const validateItemDraft = Object.freeze({
  card: validateCardDraft,
  question: validateQuestionDraft,
  idea: validateIdeaDraft,
});

function firstLine(text) {
  return asText(text).split('\n').map((line) => line.trim()).find(Boolean) ?? '';
}

/** The composer's starting values: from an existing item, or prefilled from the selection. */
export function draftFor(kind, existing, source) {
  const selected = source?.text ?? '';
  if (kind === 'card') {
    return existing
      ? { prompt: existing.prompt, answer: existing.answer }
      : { prompt: '', answer: truncate(selected, CARD_LIMITS.answer) };
  }
  if (kind === 'question') {
    return existing
      ? { text: existing.text, answer: existing.answer, status: existing.status }
      : { text: truncate(selected, QUESTION_LIMITS.text), answer: '', status: 'unanswered' };
  }
  return existing
    ? { title: existing.title, description: existing.description, category: existing.category }
    : { title: truncate(firstLine(selected), IDEA_LIMITS.title), description: '', category: '' };
}

// ── Content fields per kind ──────────────────────────────────────────────────

function contentFromDraft(kind, draft) {
  if (kind === 'card') {
    return { prompt: asText(draft.prompt).trim(), answer: asText(draft.answer).trim() };
  }
  if (kind === 'question') {
    const answer = asText(draft.answer).trim();
    return {
      text: asText(draft.text).trim(),
      answer,
      status: draft.status === 'answered' ? 'answered' : 'unanswered',
    };
  }
  return {
    title: asText(draft.title).trim(),
    description: asText(draft.description).trim(),
    category: asText(draft.category).trim(),
  };
}

function normalizeSchedule(schedule) {
  const value = schedule && typeof schedule === 'object' ? schedule : {};
  const number = (candidate, fallback) => (Number.isFinite(candidate) ? candidate : fallback);
  const normalized = {
    ease: number(value.ease, SR_STARTING_EASE),
    intervalDays: number(value.intervalDays, SR_STARTING_INTERVAL),
    repetitionCount: number(value.repetitionCount, 0),
    nextReviewAt: typeof value.nextReviewAt === 'string' && value.nextReviewAt
      ? value.nextReviewAt
      : createInitialSchedule().nextReviewAt,
  };
  if (SR_GRADES.includes(value.lastGrade)) normalized.lastGrade = value.lastGrade;
  if (typeof value.gradedAt === 'string' && value.gradedAt) normalized.gradedAt = value.gradedAt;
  return normalized;
}

/** The fields a learner edits, used to compare a local item with its remote row. */
export function itemContent(kind, item) {
  return contentFromDraft(kind, item);
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSync(sync) {
  const value = sync && typeof sync === 'object' ? sync : {};
  return {
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : '',
    remoteUpdatedAt: toMs(value.remoteUpdatedAt),
    pending: value.pending !== false,
  };
}

export function normalizeItem(kind, raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    pageId: asText(raw.pageId),
    sourceText: truncate(asText(raw.sourceText), SOURCE_TEXT_LIMIT),
    sourceBlock: asText(raw.sourceBlock),
    ...contentFromDraft(kind, raw),
    ...(kind === 'card' ? { schedule: normalizeSchedule(raw.schedule) } : {}),
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString(),
    updatedAt: toMs(raw.updatedAt) || Date.now(),
    sync: normalizeSync(raw.sync),
  };
}

// ── Create and revise ────────────────────────────────────────────────────────

/**
 * Builds a new item. `source` is the selected notebook text and the block it
 * came from; items created from the panel's "New" button have none.
 */
export function createNotebookItem(kind, { draft, pageId = '', source, now = new Date(), id = buildCreateId() }) {
  return normalizeItem(kind, {
    id,
    pageId,
    sourceText: source?.text ?? '',
    sourceBlock: source?.blockKey ?? '',
    ...contentFromDraft(kind, draft),
    ...(kind === 'card' ? { schedule: createInitialSchedule(now) } : {}),
    createdAt: now.toISOString(),
    updatedAt: now.getTime(),
    sync: { pending: true },
  });
}

/** Editing never changes identity, page link, provenance, or review schedule. */
export function reviseNotebookItem(kind, item, draft) {
  return { ...item, ...contentFromDraft(kind, draft) };
}

/** Duplicate detection is a warning only; prompts are never identity. */
export function findCardWithSamePrompt(cards, prompt, excludeId) {
  const normalized = collapseWhitespace(prompt).toLowerCase();
  if (!normalized) return undefined;
  return cards.find((card) => card.id !== excludeId && collapseWhitespace(card.prompt).toLowerCase() === normalized);
}

/** Short text that names an item in lists and action labels. */
export function itemName(kind, item) {
  if (kind === 'card') return item.prompt;
  if (kind === 'question') return item.text;
  return item.title;
}
