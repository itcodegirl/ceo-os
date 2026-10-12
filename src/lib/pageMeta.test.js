import { describe, expect, it } from 'vitest';
import {
  buildDefaultPageMeta,
  buildPageMetaByRoute,
  resolvePageMeta,
  setCanonical,
  setMetaTag,
} from './pageMeta';

describe('src/lib/pageMeta', () => {
  it('returns route-level metadata for all primary pages', () => {
    const meta = buildPageMetaByRoute('Acme CEO OS');

    expect(meta['/']).toMatchObject({
      title: 'Focus Home | Acme CEO OS',
      description: expect.any(String),
    });
    expect(meta['/opportunities']).toMatchObject({
      title: 'Opportunities | Acme CEO OS',
      description: expect.any(String),
    });
    expect(meta['/capture']).toMatchObject({
      title: 'Capture | Acme CEO OS',
      description: expect.any(String),
    });
    expect(meta['/notebook']).toMatchObject({
      title: 'Notebook | Acme CEO OS',
      description: expect.any(String),
    });
    expect(meta['/content']).toMatchObject({
      title: 'Content OS | Acme CEO OS',
      description: expect.any(String),
    });
    expect(meta['/ops-reliability']).toMatchObject({
      title: 'Ops Reliability | Acme CEO OS',
      description: expect.any(String),
    });
  });

  it('creates and updates head metadata tags deterministically', () => {
    document.head.innerHTML = '';

    setMetaTag({
      selector: 'meta[name="description"]',
      attribute: 'name',
      key: 'description',
      value: 'Initial description',
    });
    setMetaTag({
      selector: 'meta[name="description"]',
      attribute: 'name',
      key: 'description',
      value: 'Updated description',
    });

    const descriptionTag = document.head.querySelector('meta[name="description"]');
    const allDescriptionTags = document.head.querySelectorAll('meta[name="description"]');

    expect(allDescriptionTags).toHaveLength(1);
    expect(descriptionTag?.getAttribute('content')).toBe('Updated description');
  });

  it('adds a canonical link tag with the current URL', () => {
    document.head.innerHTML = '';

    setCanonical('https://example.com/weekly-brief');

    const canonical = document.head.querySelector('link[rel="canonical"]');

    expect(canonical).toBeInstanceOf(HTMLLinkElement);
    expect(canonical?.getAttribute('href')).toBe('https://example.com/weekly-brief');
  });

  it('resolves fallback metadata for unknown routes', () => {
    const defaultMeta = buildDefaultPageMeta('Acme CEO OS');
    const resolvedMeta = resolvePageMeta('Acme CEO OS', '/not-a-route');

    expect(resolvedMeta).toEqual(defaultMeta);
  });

  it('normalizes trailing slashes when resolving route metadata', () => {
    const rawMeta = resolvePageMeta('Acme CEO OS', '/chief-of-staff/');
    const normalizedMeta = resolvePageMeta('Acme CEO OS', '/chief-of-staff');

    expect(rawMeta).toEqual(normalizedMeta);
    expect(rawMeta.title).toBe('Chief of Staff | Acme CEO OS');
  });

  it('resolves explicit route metadata through buildPageMetaByRoute', () => {
    const meta = resolvePageMeta('Acme CEO OS', '/chief-of-staff');

    expect(meta).toEqual({
      title: 'Chief of Staff | Acme CEO OS',
      description: 'Transform notes into executive summaries, action items, and communication-ready drafts.',
    });
  });
});
