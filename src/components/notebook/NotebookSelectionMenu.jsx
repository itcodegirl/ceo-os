import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Highlighter, Underline } from 'lucide-react';
import { useRef } from 'react';
import { useRovingFocus } from '../../hooks/useRovingFocus';
import { getSelectedText } from '../../lib/notebook/editorSelection';
import { ITEM_LABELS, NOTEBOOK_ITEM_KINDS } from '../../lib/notebook/items/itemModels';
import KindIcon from './KindIcon';

const CREATE_LABELS = {
  card: 'Make a card from the selection',
  question: 'Save the selection as a question',
  idea: 'Save the selection as an idea',
};

const keepEditorSelection = (event) => event.preventDefault();

function shouldShowSelectionMenu({ editor, element, view, state, from, to }) {
  if (!editor.isEditable || state.selection.empty) return false;
  if (!state.doc.textBetween(from, to, ' ', ' ').trim()) return false;
  return view.hasFocus() || element.contains(document.activeElement);
}

/**
 * Floats above selected writing. Highlight and underline apply immediately;
 * the create actions open a composer with the selection as its source and
 * never save anything on their own. Ported from the Study Journal.
 */
function NotebookSelectionMenu({ editor, blockKey, blockTitle, onCreate }) {
  const toolbarRef = useRef(null);
  useRovingFocus(toolbarRef);
  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      highlight: current.isActive('highlight'),
      underline: current.isActive('underline'),
      canFormat: current.can().toggleHighlight(),
    }),
  });

  const create = (kind) => {
    const text = getSelectedText(editor);
    if (text) onCreate(kind, { text, blockKey }, editor);
  };

  const dismiss = () => {
    editor.chain().focus().setTextSelection(editor.state.selection.to).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      className="notebook-selection-menu"
      updateDelay={120}
      options={{ placement: 'top', offset: 10 }}
      shouldShow={shouldShowSelectionMenu}
    >
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label={`Selection actions in ${blockTitle}`}
        className="notebook-selection-menu__toolbar"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }
        }}
      >
        <button
          type="button"
          data-roving-item
          className="notebook-selection-menu__button"
          aria-label="Highlight"
          title="Highlight"
          aria-pressed={marks?.highlight ?? false}
          disabled={!marks?.canFormat}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter aria-hidden="true" />
        </button>
        <button
          type="button"
          data-roving-item
          className="notebook-selection-menu__button"
          aria-label="Underline"
          title="Underline"
          aria-pressed={marks?.underline ?? false}
          disabled={!marks?.canFormat}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline aria-hidden="true" />
        </button>
        <span className="notebook-selection-menu__divider" role="separator" aria-orientation="vertical" />
        {NOTEBOOK_ITEM_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            data-roving-item
            data-kind={kind}
            className="notebook-selection-menu__button notebook-selection-menu__button--create"
            aria-label={CREATE_LABELS[kind]}
            onMouseDown={keepEditorSelection}
            onClick={() => create(kind)}
          >
            <KindIcon kind={kind} />
            <span>{ITEM_LABELS[kind].fromSelection}</span>
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}

export default NotebookSelectionMenu;
