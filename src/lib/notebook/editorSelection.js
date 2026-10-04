// Selection helpers shared by the selection menu and "Show source". Ported
// from the Study Journal. Takes ProseMirror objects but imports nothing from
// the editor, so it can be unit-tested and loaded without Tiptap.

import { SOURCE_TEXT_LIMIT, truncate } from './items/itemModels';

/** The selected text of an editor, as plain text with one line per block. */
export function getSelectedText(editor) {
  const { from, to } = editor.state.selection;
  return truncate(editor.state.doc.textBetween(from, to, '\n', ' ').trim(), SOURCE_TEXT_LIMIT);
}

/**
 * Finds saved source text in a document so the notebook can reveal it.
 * Matches the first non-empty line within a single text block; returns null
 * when that passage has since been edited or removed.
 */
export function findTextRange(doc, text) {
  const needle = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!needle) return null;

  let found = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isTextblock) return true;

    const positions = [];
    let blockText = '';
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText && child.text) {
        for (let index = 0; index < child.text.length; index += 1) positions.push(start + index);
        blockText += child.text;
      } else {
        // Inline leaves such as hard breaks read as a space, as in getSelectedText.
        positions.push(start);
        blockText += ' ';
      }
    });

    const index = blockText.indexOf(needle);
    if (index !== -1) {
      found = { from: positions[index], to: positions[index + needle.length - 1] + 1 };
    }
    return false;
  });
  return found;
}
