import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
  Underline,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useRovingFocus } from '../../hooks/useRovingFocus';
import { describeShortcut } from '../../lib/notebook/shortcuts';
import LinkEditor from './LinkEditor';

const FORMAT_GROUPS = [
  {
    label: 'Text style',
    controls: [
      { key: 'bold', label: 'Bold', shortcut: 'Mod+B', icon: Bold, apply: (chain) => chain.toggleBold() },
      { key: 'italic', label: 'Italic', shortcut: 'Mod+I', icon: Italic, apply: (chain) => chain.toggleItalic() },
      { key: 'underline', label: 'Underline', shortcut: 'Mod+U', icon: Underline, apply: (chain) => chain.toggleUnderline() },
      { key: 'highlight', label: 'Highlight', shortcut: 'Mod+Shift+H', icon: Highlighter, apply: (chain) => chain.toggleHighlight() },
    ],
  },
  {
    label: 'Blocks',
    controls: [
      { key: 'heading', label: 'Heading', shortcut: 'Mod+Alt+2', icon: Heading2, apply: (chain) => chain.toggleHeading({ level: 2 }) },
      { key: 'bulletList', label: 'Bulleted list', shortcut: 'Mod+Shift+8', icon: List, apply: (chain) => chain.toggleBulletList() },
      { key: 'orderedList', label: 'Numbered list', shortcut: 'Mod+Shift+7', icon: ListOrdered, apply: (chain) => chain.toggleOrderedList() },
      { key: 'taskList', label: 'Checklist', shortcut: 'Mod+Shift+9', icon: ListChecks, apply: (chain) => chain.toggleTaskList() },
      { key: 'blockquote', label: 'Quote', shortcut: 'Mod+Shift+B', icon: Quote, apply: (chain) => chain.toggleBlockquote() },
    ],
  },
  {
    label: 'Code',
    controls: [
      { key: 'code', label: 'Inline code', shortcut: 'Mod+E', icon: Code, apply: (chain) => chain.toggleCode() },
      { key: 'codeBlock', label: 'Code block', shortcut: 'Mod+Alt+C', icon: SquareCode, apply: (chain) => chain.toggleCodeBlock() },
    ],
  },
];

const readMarks = (editor) => (editor
  ? {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    highlight: editor.isActive('highlight'),
    heading: editor.isActive('heading', { level: 2 }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    blockquote: editor.isActive('blockquote'),
    code: editor.isActive('code'),
    codeBlock: editor.isActive('codeBlock'),
    link: editor.isActive('link'),
  }
  : null);

/** Keeps the editor's focus and selection when a toolbar button is clicked with a pointer. */
const keepEditorSelection = (event) => event.preventDefault();

/** One formatting toolbar for the page; it acts on whichever block was last focused. */
function EditorToolbar({ editor, label, trailing }) {
  const toolbarRef = useRef(null);
  const linkButtonRef = useRef(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  useRovingFocus(toolbarRef);
  const marks = useEditorState({ editor, selector: ({ editor: current }) => readMarks(current) });

  return (
    <div className="notebook-toolbar">
      <div ref={toolbarRef} role="toolbar" aria-label={label} className="notebook-toolbar__controls">
        {FORMAT_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label} className="notebook-toolbar__group">
            {group.controls.map((control) => {
              const { key, label: controlLabel, shortcut, apply } = control;
              const ControlIcon = control.icon;
              const keys = describeShortcut(shortcut);
              return (
                <button
                  key={key}
                  type="button"
                  data-roving-item
                  className="notebook-toolbar__button"
                  aria-label={controlLabel}
                  aria-pressed={marks?.[key] ?? false}
                  aria-keyshortcuts={keys.aria}
                  title={`${controlLabel} (${keys.label})`}
                  disabled={!editor}
                  onMouseDown={keepEditorSelection}
                  onClick={() => editor && apply(editor.chain().focus()).run()}
                >
                  <ControlIcon aria-hidden="true" />
                </button>
              );
            })}
            {group.label === 'Code' ? (
              <button
                ref={linkButtonRef}
                type="button"
                data-roving-item
                className="notebook-toolbar__button"
                aria-label="Link"
                aria-pressed={marks?.link ?? false}
                aria-expanded={linkEditorOpen}
                aria-haspopup="true"
                title="Link"
                disabled={!editor}
                onMouseDown={keepEditorSelection}
                onClick={() => setLinkEditorOpen((open) => !open)}
              >
                <Link2 aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {trailing ? <div className="notebook-toolbar__trailing">{trailing}</div> : null}
      {linkEditorOpen && editor ? (
        <LinkEditor
          editor={editor}
          anchorRef={linkButtonRef}
          onClose={(restoreFocus) => {
            setLinkEditorOpen(false);
            if (restoreFocus) editor.commands.focus();
          }}
        />
      ) : null}
    </div>
  );
}

export default EditorToolbar;
