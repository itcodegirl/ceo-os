import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseRuntime', () => {
  const supabaseRuntime = {
    getSupabaseClient: vi.fn(),
    requireSupabaseUserId: vi.fn(),
  };
  return {
    isSupabaseRuntimeEnabled: true,
    getSupabaseRuntime: vi.fn(async () => supabaseRuntime),
    __supabaseRuntime: supabaseRuntime,
  };
});

import * as runtimeModule from '../../supabaseRuntime';
import { createFakeSupabase, FAKE_USER_ID as USER } from '../../../test/fakeSupabase';
import { getOfflineQueue } from '../../offlineWriteQueue';
import {
  createNotebookPage,
  deleteNotebookPage,
  ensureDailyPage,
  getNotebookPage,
  saveNotebookPage,
  syncNotebookPages,
} from '../notebookPagesRepository';
import { textToDoc } from '../notebookText';
import {
  createItem,
  deleteItem,
  getNotebookItem,
  listNotebookItems,
  listPageItems,
  NOTEBOOK_ITEM_QUEUE_KIND_PUSH,
  NOTEBOOK_ITEMS_UPDATED_EVENT,
  syncNotebookItem,
  syncNotebookItems,
  updateItem,
} from './notebookItemsRepository';


let fake;

function signIn() {
  runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(fake.client);
  runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue(USER);
}

// Lets background pushes started by local writes (which check the session
// asynchronously) finish before the test changes who is signed in.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function signOut() {
  const authRequired = Object.assign(new Error('auth'), { code: 'SUPABASE_AUTH_REQUIRED' });
  runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockRejectedValue(authRequired);
}

async function syncAll() {
  await syncNotebookPages();
  return syncNotebookItems();
}

const CARD = { prompt: 'Why value pricing?', answer: 'It ties price to results.' };

beforeEach(() => {
  window.localStorage.clear();
  fake = createFakeSupabase();
  runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
  signOut();
});

describe('notebook items on this device', () => {
  it('creates, edits, and deletes items, announcing each change', () => {
    const page = createNotebookPage({ section: 'learning', title: 'Pricing' });
    const events = [];
    const listener = (event) => events.push(event.detail);
    window.addEventListener(NOTEBOOK_ITEMS_UPDATED_EVENT, listener);

    const card = createItem('card', { draft: CARD, pageId: page.id, source: { text: 'Charge for outcomes', blockKey: 'notes' } });
    const idea = createItem('idea', { draft: { title: 'Pricing calculator', description: '', category: 'Product' }, pageId: page.id });
    createItem('idea', { draft: { title: 'Elsewhere', description: '', category: '' }, pageId: 'another-page' });
    updateItem('card', card.id, { prompt: 'Why price on value?', answer: CARD.answer });

    expect(listPageItems('card', page.id).map((item) => item.prompt)).toEqual(['Why price on value?']);
    expect(listPageItems('idea', page.id).map((item) => item.id)).toEqual([idea.id]);
    expect(getNotebookItem('card', card.id)).toMatchObject({ sourceText: 'Charge for outcomes', sourceBlock: 'notes' });

    deleteItem('card', card.id);
    expect(listNotebookItems('card')).toEqual([]);
    window.removeEventListener(NOTEBOOK_ITEMS_UPDATED_EVENT, listener);
    expect(events.map(({ kind, type }) => `${kind}:${type}`)).toEqual([
      'card:create', 'idea:create', 'idea:create', 'card:save', 'card:delete',
    ]);
  });

  it('keeps items when writing changes or the page they came from is deleted', () => {
    const page = createNotebookPage({ section: 'professional', title: 'Q4 planning' });
    createItem('question', { draft: { text: 'Who owns hiring?', answer: '', status: 'unanswered' }, pageId: page.id });

    saveNotebookPage(page.id, { blocks: { notes: textToDoc('') } });
    deleteNotebookPage(page.id);

    expect(listNotebookItems('question')).toHaveLength(1);
    expect(listNotebookItems('question')[0].pageId).toBe(page.id);
  });

  it('stays local, with no remote calls, when signed out', async () => {
    createItem('card', { draft: CARD });
    await expect(syncNotebookItems()).resolves.toBe('local');
    expect(fake.tables.notebook_cards).toEqual([]);
    expect(listNotebookItems('card')[0].sync.pending).toBe(true);
  });
});

describe('notebook items account sync', () => {
  it('waits for its page to reach the account, then uploads with the page link', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Pricing' });
    const card = createItem('card', { draft: CARD, pageId: page.id });
    await settle();
    signIn();

    await syncNotebookItems();
    expect(fake.tables.notebook_cards).toEqual([]);
    expect(getNotebookItem('card', card.id).sync.pending).toBe(true);

    await syncAll();
    expect(fake.tables.notebook_cards).toEqual([
      expect.objectContaining({ id: card.id, page_id: page.id, prompt: CARD.prompt, ease: 2.5, interval_days: 1 }),
    ]);
    expect(getNotebookItem('card', card.id).sync).toMatchObject({ pending: false, ownerId: USER });
  });

  it('uploads items with no page right away, and pushes edits under the update guard', async () => {
    await settle();
    signIn();
    const idea = createItem('idea', { draft: { title: 'Podcast', description: '', category: '' } });
    await syncNotebookItems();
    expect(fake.tables.notebook_ideas[0]).toMatchObject({ id: idea.id, page_id: null, title: 'Podcast', description: null });

    updateItem('idea', idea.id, { title: 'Founder podcast', description: 'Weekly', category: 'Content' });
    await syncNotebookItems();
    expect(fake.tables.notebook_ideas[0]).toMatchObject({ title: 'Founder podcast', description: 'Weekly', category: 'Content' });
    expect(getNotebookItem('idea', idea.id).sync.pending).toBe(false);
  });

  it('brings in items made on another device and applies their edits', async () => {
    await settle();
    signIn();
    fake.insertElsewhere('notebook_questions', { page_id: null, source_text: null, source_block: null, id: 'q-remote', text: 'Which niche first?', answer: null, status: 'unanswered' });
    await syncNotebookItems();
    expect(getNotebookItem('question', 'q-remote')).toMatchObject({ text: 'Which niche first?', answer: '', status: 'unanswered' });

    fake.editElsewhere('notebook_questions', 'q-remote', { status: 'answered', answer: 'Bootcamp grads' });
    await syncNotebookItems();
    expect(getNotebookItem('question', 'q-remote')).toMatchObject({ status: 'answered', answer: 'Bootcamp grads' });
  });

  it('keeps both versions when an item changed here and on another device', async () => {
    await settle();
    signIn();
    const card = createItem('card', { draft: CARD });
    await syncNotebookItems();

    signOut();
    updateItem('card', card.id, { prompt: 'Mine', answer: CARD.answer });
    fake.editElsewhere('notebook_cards', card.id, { prompt: 'Theirs' });
    await settle();
    signIn();
    await syncNotebookItems();
    await syncNotebookItems();

    const prompts = listNotebookItems('card').map((item) => item.prompt).sort();
    expect(prompts).toEqual(['Mine', 'Theirs']);
    expect(getNotebookItem('card', card.id).prompt).toBe('Theirs');
    expect(fake.tables.notebook_cards.map((row) => row.prompt).sort()).toEqual(['Mine', 'Theirs']);
    expect(listNotebookItems('card').every((item) => !item.sync.pending)).toBe(true);
  });

  it('removes items deleted on another device, unless they have unsynced changes here', async () => {
    await settle();
    signIn();
    const kept = createItem('idea', { draft: { title: 'Edited here', description: '', category: '' } });
    const dropped = createItem('idea', { draft: { title: 'Untouched', description: '', category: '' } });
    await syncNotebookItems();

    signOut();
    updateItem('idea', kept.id, { title: 'Edited here, again', description: '', category: '' });
    fake.deleteElsewhere('notebook_ideas', kept.id);
    fake.deleteElsewhere('notebook_ideas', dropped.id);
    await settle();
    signIn();
    await syncNotebookItems();

    expect(getNotebookItem('idea', dropped.id)).toBeNull();
    expect(fake.tables.notebook_ideas.map((row) => row.title)).toEqual(['Edited here, again']);
  });

  it('does not duplicate an insert whose response was lost, when the queue replays it', async () => {
    await settle();
    signIn();
    fake.loseNextResponse();
    const card = createItem('card', { draft: CARD });
    await settle();
    // The offline queue replays a single push, without a pull first.
    await syncNotebookItem('card', card.id, { skipQueue: true });

    expect(fake.tables.notebook_cards).toHaveLength(1);
    expect(getNotebookItem('card', card.id).sync.pending).toBe(false);
  });

  it('uploads without the link when the page was deleted remotely a moment before', async () => {
    await settle();
    signIn();
    const page = createNotebookPage({ section: 'learning', title: 'Pricing' });
    await syncNotebookPages();
    signOut();
    const card = createItem('card', { draft: CARD, pageId: page.id });
    fake.deleteElsewhere('notebook_pages', page.id);
    await settle();
    signIn();

    await syncNotebookItems();
    expect(fake.tables.notebook_cards[0]).toMatchObject({ id: card.id, page_id: null });
  });

  it('follows a Personal page whose id changes when it merges with the same day from another device', async () => {
    const local = ensureDailyPage('2026-10-04');
    const card = createItem('card', { draft: CARD, pageId: local.id });
    fake.insertElsewhere('notebook_pages', {
      id: 'remote-day',
      section: 'personal',
      title: 'Sunday',
      page_date: '2026-10-04',
      source_url: null,
      blocks: { onMyMind: textToDoc('From my phone') },
    });
    await settle();
    signIn();

    await syncAll();
    expect(getNotebookPage(local.id)).toBeNull();
    expect(getNotebookItem('card', card.id).pageId).toBe('remote-day');
    expect(fake.tables.notebook_cards[0]).toMatchObject({ id: card.id, page_id: 'remote-day' });
  });

  it('queues a push for later when the network drops', async () => {
    await settle();
    signIn();
    fake.failNextWith(new TypeError('Failed to fetch'));
    const card = createItem('card', { draft: CARD });
    await syncNotebookItems().catch(() => {});

    expect(getOfflineQueue().map((entry) => [entry.kind, entry.payload])).toContainEqual([
      NOTEBOOK_ITEM_QUEUE_KIND_PUSH,
      { kind: 'card', id: card.id },
    ]);
  });

  it('pushes local deletions before pulling, so deleted items do not come back', async () => {
    await settle();
    signIn();
    const card = createItem('card', { draft: CARD });
    await syncNotebookItems();

    signOut();
    deleteItem('card', card.id);
    await settle();
    signIn();
    await syncNotebookItems();

    expect(fake.tables.notebook_cards).toEqual([]);
    expect(listNotebookItems('card')).toEqual([]);
  });
});
