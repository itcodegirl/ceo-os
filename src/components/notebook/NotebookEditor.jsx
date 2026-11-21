import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { createNotebookExtensions } from '../../lib/notebook/notebookExtensions';

// Keeps the caret clear of the sticky toolbar when ProseMirror scrolls it into view.
const SCROLL_MARGIN = { top: 132, right: 16, bottom: 96, left: 16 };
const SELECTION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

function syncKeyboardSelection(view, event) {
  if (!SELECTION_KEYS.has(event.key) || event.isComposing || view.composing || !view.hasFocus()) return false;
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode
    || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return false;

  // Native navigation updates the DOM selection before selectionchange fires.
  // Commit it now so a pending editor focus restoration cannot replace it with
  // the old caret. Keep native line wrapping and forward/backward selection.
  const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
  const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
  const next = TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head));
  if (!next.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(next));
  return false;
}

/**
 * One rich-text writing block. Ported from the Study Journal editor; the
 * editor owns its document after mount (`initialContent` is read once), and
 * Escape with nothing selected hands focus back to the block heading so the
 * editor never traps the keyboard.
 */
function NotebookEditor({
  placeholder,
  initialContent,
  labelledBy,
  describedBy,
  onChange,
  onFocus,
  onReady,
  onLeave,
}) {
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  // useEditor compares options by identity on every render, so everything that
  // is not a callback is created exactly once.
  const [staticOptions] = useState(() => ({
    extensions: createNotebookExtensions(placeholder),
    content: initialContent ?? null,
    editorProps: {
      attributes: {
        class: 'notebook-editor__content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelledBy,
        'aria-describedby': describedBy,
      },
      scrollMargin: SCROLL_MARGIN,
      scrollThreshold: SCROLL_MARGIN,
      handleDOMEvents: { keyup: syncKeyboardSelection },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Escape') return false;
        const { selection, doc, tr } = view.state;
        if (!selection.empty) {
          view.dispatch(tr.setSelection(TextSelection.create(doc, selection.to)));
        } else {
          onLeaveRef.current?.();
        }
        return true;
      },
    },
  }));

  const editor = useEditor({
    ...staticOptions,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    onFocus: () => onFocus?.(),
  });

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  return (
    <div className="notebook-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

export default NotebookEditor;
