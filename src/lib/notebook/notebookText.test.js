import { describe, expect, it } from 'vitest';
import { getPlainText, hasWriting, textToDoc } from './notebookText';

describe('notebookText', () => {
  it('reads text across marks, blocks, lists, and hard breaks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Ship ' }, { type: 'text', text: 'Friday', marks: [{ type: 'highlight' }] }] },
        { type: 'taskList', content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft post' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Book call' }] }] },
        ] },
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
      ],
    };

    expect(getPlainText(doc)).toBe('Plan\nShip Friday\nDraft post\nBook call\na\nb');
  });

  it('treats missing, empty, and whitespace-only documents as no writing', () => {
    expect(hasWriting(undefined)).toBe(false);
    expect(hasWriting({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false);
    expect(hasWriting(textToDoc('   '))).toBe(false);
    expect(hasWriting(textToDoc('x'))).toBe(true);
  });

  it('round-trips plain text through paragraph JSON', () => {
    expect(getPlainText(textToDoc('one\r\ntwo\n\nthree'))).toBe('one\ntwo\nthree');
    expect(textToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
