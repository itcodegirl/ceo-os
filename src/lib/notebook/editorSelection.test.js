import { getSchema } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { findTextRange, getSelectedText } from './editorSelection';
import { createNotebookExtensions } from './notebookExtensions';

const schema = getSchema(createNotebookExtensions());

const doc = ProseMirrorNode.fromJSON(schema, {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Pricing is a promise.' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Charge for ' },
        { type: 'text', text: 'the outcome', marks: [{ type: 'highlight' }] },
        { type: 'text', text: ', not the hours.' },
      ],
    },
  ],
});

describe('findTextRange', () => {
  it('finds text that spans marks inside one block', () => {
    const range = findTextRange(doc, 'for the outcome, not');
    expect(range).not.toBeNull();
    expect(doc.textBetween(range.from, range.to)).toBe('for the outcome, not');
  });

  it('matches the first line of a selection that crossed blocks', () => {
    const range = findTextRange(doc, 'Pricing is a promise.\nCharge for');
    expect(doc.textBetween(range.from, range.to)).toBe('Pricing is a promise.');
  });

  it('returns null when the source passage is gone', () => {
    expect(findTextRange(doc, 'Charge by the hour')).toBeNull();
    expect(findTextRange(doc, '   ')).toBeNull();
  });
});

describe('getSelectedText', () => {
  it('reads the selection as plain text with one line per block', () => {
    const editor = { state: { doc, selection: { from: 1, to: doc.content.size - 1 } } };
    expect(getSelectedText(editor)).toBe('Pricing is a promise.\nCharge for the outcome, not the hours.');
  });
});
