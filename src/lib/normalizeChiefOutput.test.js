import { describe, expect, it } from 'vitest';
import { normalizeChiefOutput, normalizeChiefSuggestion } from './normalizeChiefOutput';
import { toPanelResult } from './chiefPanelResult';

describe('canonical Chief acceptance fields', () => {
  it('keeps absent metadata empty and canonicalizes legacy aliases without inventing facts', () => {
    const result = normalizeChiefOutput({ structured: { opportunities: [{ title: 'Meet partner' }], contentItems: [{ title: 'Share progress', summary: 'Keep this context' }], priorities: [{ title: 'Ship' }] } });
    expect(result.structured.opportunities[0]).toMatchObject({ name: 'Meet partner', company: '', priority: '', stage: '' });
    expect(result.structured.contentItems[0]).toMatchObject({ platform: '', notes: 'Keep this context' });
    expect(result.structured.priorities[0].owner).toBe('');
    expect(normalizeChiefSuggestion('opportunities', { title: 'Intro', organization: 'Acme' })).toMatchObject({ name: 'Intro', company: 'Acme' });
  });
  it('uses the same canonical values when history is loaded again', () => {
    const original = { content: 'Plan', structuredPayload: { priorities: [{ title: 'Ship' }], tasks: [{ task: 'Follow up', assignee: 'Alex' }], contentItems: [{ title: 'Notes', channel: 'Email' }] } };
    const panel = toPanelResult(original);
    const reloaded = toPanelResult(JSON.parse(JSON.stringify(original)));
    expect(reloaded.structured).toEqual(panel.structured);
    expect(normalizeChiefSuggestion('tasks', original.structuredPayload.tasks[0])).toEqual(panel.structured.tasks[0]);
  });
});
