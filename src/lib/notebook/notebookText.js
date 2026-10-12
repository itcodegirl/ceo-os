// Plain-text helpers for notebook documents (Tiptap/ProseMirror JSON).
//
// Deliberately framework-free: Focus Home, System Pulse, and the Journal
// import read notebook text through these helpers, so they must never pull
// the editor bundle into those routes' chunks.

const BLOCK_SEPARATOR = '\n';

function collectText(node, parts) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (typeof node.text === 'string') {
    parts.push(node.text);
    return;
  }
  if (node.type === 'hardBreak') {
    parts.push(BLOCK_SEPARATOR);
    return;
  }
  if (!Array.isArray(node.content)) {
    return;
  }
  node.content.forEach((child, index) => {
    collectText(child, parts);
    const isBlockChild = child && typeof child === 'object' && typeof child.text !== 'string' && child.type !== 'hardBreak';
    if (isBlockChild && index < node.content.length - 1) {
      parts.push(BLOCK_SEPARATOR);
    }
  });
}

/** Returns the visible text of a notebook document, one line per block. */
export function getPlainText(doc) {
  const parts = [];
  collectText(doc, parts);
  return parts.join('').replace(/\n{2,}/g, BLOCK_SEPARATOR).trim();
}

export function hasWriting(doc) {
  return getPlainText(doc).length > 0;
}

/** Converts plain text (e.g. a legacy Journal textarea) into paragraph JSON. */
export function textToDoc(text) {
  const value = typeof text === 'string' ? text : '';
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => (line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' })),
  };
}
