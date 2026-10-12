import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { createNotebookExtensions } from '../../lib/notebook/notebookExtensions';

// Keeps the caret clear of the sticky toolbar when ProseMirror scrolls it into view.
const SCROLL_MARGIN = { top: 132, right: 16, bottom: 96, left: 16 };

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
