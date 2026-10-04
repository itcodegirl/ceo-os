import { describe, expect, it } from 'vitest';
import {
  CARD_LIMITS,
  createNotebookItem,
  draftFor,
  findCardWithSamePrompt,
  hasErrors,
  normalizeItem,
  reviseNotebookItem,
  validateCardDraft,
  validateIdeaDraft,
  validateQuestionDraft,
} from './itemModels';

const NOW = new Date('2026-10-04T09:00:00.000Z');
const SOURCE = { text: 'Charge for the outcome, not the hours.', blockKey: 'notes' };

describe('notebook item validation', () => {
  it('requires a card prompt and answer, within their limits', () => {
    expect(validateCardDraft({ prompt: ' ', answer: '' })).toEqual({
      prompt: 'Write the prompt you want to answer from memory.',
      answer: 'Add the answer you want to recall.',
    });
    expect(validateCardDraft({ prompt: 'x'.repeat(CARD_LIMITS.prompt + 1), answer: 'ok' }).prompt).toMatch(/under 300/);
    expect(hasErrors(validateCardDraft({ prompt: 'Why value pricing?', answer: 'It ties price to results.' }))).toBe(false);
  });

  it('requires only the question text and the idea title', () => {
    expect(validateQuestionDraft({ text: '', answer: '', status: 'unanswered' })).toEqual({
      text: 'Write the question you want to come back to.',
    });
    expect(validateIdeaDraft({ title: '', description: '', category: '' })).toEqual({
      title: 'Give the idea a short title.',
    });
  });
});

describe('creating and revising items', () => {
  it('creates a card linked to its page and source, with a review schedule due tomorrow', () => {
    const card = createNotebookItem('card', {
      draft: { prompt: '  Why value pricing?  ', answer: 'Ties price to results.' },
      pageId: 'page-1',
      source: SOURCE,
      now: NOW,
      id: 'card-1',
    });
    expect(card).toMatchObject({
      id: 'card-1',
      pageId: 'page-1',
      sourceText: SOURCE.text,
      sourceBlock: 'notes',
      prompt: 'Why value pricing?',
      answer: 'Ties price to results.',
      createdAt: NOW.toISOString(),
      sync: { pending: true, remoteUpdatedAt: 0, ownerId: '' },
    });
    expect(card.schedule).toEqual({
      ease: 2.5,
      intervalDays: 1,
      repetitionCount: 0,
      nextReviewAt: '2026-10-05T09:00:00.000Z',
    });
  });

  it('revising changes only the content, never identity, link, source, or schedule', () => {
    const card = createNotebookItem('card', { draft: { prompt: 'A', answer: 'B' }, pageId: 'page-1', source: SOURCE, now: NOW });
    const revised = reviseNotebookItem('card', card, { prompt: 'A2', answer: 'B2' });
    expect(revised).toEqual({ ...card, prompt: 'A2', answer: 'B2' });
  });

  it('stores an empty optional answer as empty text and keeps only known statuses', () => {
    const question = createNotebookItem('question', { draft: { text: 'Who is the buyer?', answer: '   ', status: 'bogus' }, now: NOW });
    expect(question).toMatchObject({ text: 'Who is the buyer?', answer: '', status: 'unanswered', pageId: '', sourceText: '' });
  });

  it('drops malformed stored records and fills in missing fields', () => {
    expect(normalizeItem('idea', null)).toBeNull();
    expect(normalizeItem('idea', { title: 'No id' })).toBeNull();
    expect(normalizeItem('idea', { id: 'i1', title: 'Mentor matching' })).toMatchObject({
      id: 'i1',
      title: 'Mentor matching',
      description: '',
      category: '',
      sync: { pending: true },
    });
  });
});

describe('composer drafts', () => {
  it('prefills from the selection: a card answer, a question, an idea title from the first line', () => {
    expect(draftFor('card', undefined, SOURCE)).toEqual({ prompt: '', answer: SOURCE.text });
    expect(draftFor('question', undefined, SOURCE)).toEqual({ text: SOURCE.text, answer: '', status: 'unanswered' });
    expect(draftFor('idea', undefined, { text: '\n  A mentor matching app\nmore detail' })).toEqual({
      title: 'A mentor matching app',
      description: '',
      category: '',
    });
  });

  it('edits start from the saved item', () => {
    const idea = createNotebookItem('idea', { draft: { title: 'Podcast', description: 'Weekly', category: 'Content' }, now: NOW });
    expect(draftFor('idea', idea)).toEqual({ title: 'Podcast', description: 'Weekly', category: 'Content' });
  });
});

describe('findCardWithSamePrompt', () => {
  const cards = [createNotebookItem('card', { draft: { prompt: 'What is  CAC?', answer: 'x' }, now: NOW, id: 'c1' })];

  it('warns on the same prompt ignoring case and spacing, but not for the card being edited', () => {
    expect(findCardWithSamePrompt(cards, 'what is cac?')?.id).toBe('c1');
    expect(findCardWithSamePrompt(cards, 'what is cac?', 'c1')).toBeUndefined();
    expect(findCardWithSamePrompt(cards, '  ')).toBeUndefined();
  });
});
