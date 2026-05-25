import { describe, expect, it } from 'vitest';
import { parseStructuredText, toPanelResult } from './chiefPanelResult';

describe('parseStructuredText', () => {
  it('returns null for non-strings, blank strings, and invalid JSON', () => {
    expect(parseStructuredText(undefined)).toBeNull();
    expect(parseStructuredText(42)).toBeNull();
    expect(parseStructuredText('')).toBeNull();
    expect(parseStructuredText('   ')).toBeNull();
    expect(parseStructuredText('not json')).toBeNull();
  });

  it('returns null when the parsed value is not an object', () => {
    expect(parseStructuredText('"hello"')).toBeNull();
    expect(parseStructuredText('123')).toBeNull();
    expect(parseStructuredText('null')).toBeNull();
  });

  it('parses a JSON object payload', () => {
    expect(parseStructuredText('{"title":"Plan"}')).toEqual({ title: 'Plan' });
  });
});

describe('toPanelResult', () => {
  it('returns null when the entry is missing or not an object', () => {
    expect(toPanelResult(null)).toBeNull();
    expect(toPanelResult('entry')).toBeNull();
  });

  it('normalizes a plain-text entry into the panel shape', () => {
    const result = toPanelResult({ content: 'Ship the launch.', source: 'proxy' });

    expect(result.title).toBe('Executive Action Plan');
    expect(result.summary).toBe('Ship the launch.');
    expect(result.source).toBe('proxy');
    expect(result.structured.priorities).toEqual([]);
  });

  it('prefers structured JSON content over the raw fields', () => {
    const content = JSON.stringify({
      title: 'Weekly Focus',
      summary: 'Three priorities this week.',
      structured: {
        priorities: [{ title: 'Close the round' }],
      },
    });

    const result = toPanelResult({ content, source: 'proxy', title: 'Ignored' });

    expect(result.title).toBe('Weekly Focus');
    expect(result.summary).toBe('Three priorities this week.');
    expect(result.structured.priorities).toEqual([
      { title: 'Close the round', owner: 'You', status: 'Planned', reason: '' },
    ]);
  });

  it('uses an explicit structuredPayload when present', () => {
    const result = toPanelResult({
      content: 'plain text',
      structuredPayload: { tasks: [{ title: 'Reply to investor' }] },
    });

    expect(result.summary).toBe('plain text');
    expect(result.structured.tasks).toEqual([
      { title: 'Reply to investor', type: 'task', status: 'Planned' },
    ]);
  });
});
