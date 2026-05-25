import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT_ITEMS_UPDATED_EVENT,
  clearLocalContentDemoData,
  createContentItem,
  deleteContentItem,
  listContentItems,
  updateContentItem,
} from './contentRepository';
import { saveWorkspaceSetupMode } from './workspaceSetup';
import {
  CURRENT_DATA_SCHEMA_VERSION,
  STORAGE_DOMAINS,
  createVersionedStorageEnvelope,
} from './dataSchema';
import { DUPLICATE_RECORD_CODE } from './repositoryErrors';

describe('src/lib/contentRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('rejects stale local content updates without emitting a fake update event', async () => {
    const created = await createContentItem({
      title: 'Launch recap post',
      platform: 'LinkedIn',
      status: 'Drafting',
    });
    const updateListener = vi.fn();
    window.addEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);

    try {
      await expect(updateContentItem('missing-content', {
        title: 'Ghost content',
        platform: 'Email',
        status: 'Drafting',
      })).rejects.toThrow('Content item not found');
    } finally {
      window.removeEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);
    }

    const items = await listContentItems();
    expect(updateListener).not.toHaveBeenCalled();
    expect(items.some((item) => item.id === created.id && item.title === created.title)).toBe(true);
    expect(items.some((item) => item.title === 'Ghost content')).toBe(false);
  });

  it('rejects stale local content deletes without emitting a fake update event', async () => {
    const created = await createContentItem({
      title: 'Founder note thread',
      platform: 'Threads',
      status: 'Queued',
    });
    const updateListener = vi.fn();
    window.addEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);

    try {
      await expect(deleteContentItem('missing-content')).rejects.toThrow('Content item not found');
    } finally {
      window.removeEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);
    }

    const items = await listContentItems();
    expect(updateListener).not.toHaveBeenCalled();
    expect(items.some((item) => item.id === created.id && item.title === created.title)).toBe(true);
  });

  it('stamps and bumps updatedAt on local content writes', async () => {
    const created = await createContentItem({
      title: 'Founder note',
      platform: 'Newsletter',
      status: 'Drafting',
    });
    expect(created.updatedAt).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await updateContentItem(
      created.id,
      { ...created, title: 'Founder note (revised)' },
      { expectedUpdatedAt: created.updatedAt },
    );

    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated.title).toBe('Founder note (revised)');
  });

  it('rejects duplicate local content creates without emitting an update event', async () => {
    saveWorkspaceSetupMode('blank');
    await createContentItem({
      title: 'Launch recap',
      platform: 'LinkedIn',
      status: 'Drafting',
    });
    const updateListener = vi.fn();
    window.addEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);

    try {
      await expect(createContentItem({
        title: ' launch recap ',
        platform: 'linkedin',
        status: 'Idea',
      })).rejects.toMatchObject({
        code: DUPLICATE_RECORD_CODE,
        message: 'This content item already exists for that platform.',
      });
    } finally {
      window.removeEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);
    }

    await expect(listContentItems()).resolves.toHaveLength(1);
    expect(updateListener).not.toHaveBeenCalled();
  });

  it('rejects duplicate local content updates without replacing either record', async () => {
    saveWorkspaceSetupMode('blank');
    const existing = await createContentItem({
      title: 'Newsletter plan',
      platform: 'Email',
      status: 'Drafting',
    });
    const next = await createContentItem({
      title: 'Founder reel',
      platform: 'Instagram',
      status: 'Idea',
    });

    await expect(updateContentItem(next.id, {
      ...next,
      title: existing.title,
      platform: existing.platform,
    }, { expectedUpdatedAt: next.updatedAt })).rejects.toMatchObject({
      code: DUPLICATE_RECORD_CODE,
    });

    const items = await listContentItems();
    expect(items.find((item) => item.id === next.id)).toMatchObject({
      title: 'Founder reel',
      platform: 'Instagram',
    });
  });

  it('persists content items in a versioned schema envelope', async () => {
    saveWorkspaceSetupMode('blank');
    const created = await createContentItem({
      title: 'Versioned content',
      platform: 'Newsletter',
      status: 'Drafting',
    });

    const raw = JSON.parse(window.localStorage.getItem('ceo-os-content-items'));
    expect(raw).toMatchObject({
      schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
      domain: STORAGE_DOMAINS.contentItems,
      model: 'ContentItem[]',
    });
    expect(raw.data).toEqual([
      expect.objectContaining({ id: created.id, title: 'Versioned content' }),
    ]);
  });

  it('continues reading legacy raw content arrays', async () => {
    window.localStorage.setItem('ceo-os-content-items', JSON.stringify([
      {
        id: 'legacy-content',
        title: 'Legacy draft',
        platform: 'LinkedIn',
        status: 'Drafting',
        updatedAt: 1745190000000,
      },
    ]));

    await expect(listContentItems()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy-content', title: 'Legacy draft' }),
    ]);
  });

  it('reads content items from the current schema envelope', async () => {
    window.localStorage.setItem(
      'ceo-os-content-items',
      JSON.stringify(createVersionedStorageEnvelope(STORAGE_DOMAINS.contentItems, [
        {
          id: 'versioned-content',
          title: 'Versioned draft',
          platform: 'LinkedIn',
          status: 'Drafting',
          updatedAt: 1745190000000,
        },
      ])),
    );

    await expect(listContentItems()).resolves.toEqual([
      expect.objectContaining({ id: 'versioned-content', title: 'Versioned draft' }),
    ]);
  });

  it('rejects a local content update when the expected updatedAt is stale', async () => {
    const created = await createContentItem({
      title: 'Two-tab content',
      platform: 'Newsletter',
      status: 'Drafting',
    });

    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateContentItem(
      created.id,
      { ...created, title: 'Tab B saved first' },
      { expectedUpdatedAt: created.updatedAt },
    );

    const updateListener = vi.fn();
    window.addEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);
    try {
      await expect(
        updateContentItem(
          created.id,
          { ...created, title: 'Tab A tried second' },
          { expectedUpdatedAt: created.updatedAt },
        ),
      ).rejects.toMatchObject({ name: 'StaleRecordError' });
    } finally {
      window.removeEventListener(CONTENT_ITEMS_UPDATED_EVENT, updateListener);
    }

    const items = await listContentItems();
    const persisted = items.find((item) => item.id === created.id);
    expect(persisted.title).toBe('Tab B saved first');
    expect(updateListener).not.toHaveBeenCalled();
  });

  it('does not auto-seed demo content after the workspace starts blank', async () => {
    saveWorkspaceSetupMode('blank');

    await expect(listContentItems()).resolves.toEqual([]);
  });

  it('clears known demo content without deleting user-created records', async () => {
    const created = await createContentItem({
      title: 'Real founder note',
      platform: 'Newsletter',
      status: 'Drafting',
    });

    clearLocalContentDemoData();

    const items = await listContentItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: created.id, title: 'Real founder note' });
  });
});
