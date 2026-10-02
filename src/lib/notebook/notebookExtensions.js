import { Highlight } from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { StarterKit } from '@tiptap/starter-kit';

/**
 * Notebook schema: StarterKit (which includes Underline, Link, and CodeBlock in
 * Tiptap v3), a single highlight mark, and checklists. Typography is left out
 * on purpose: smart quotes and dashes corrupt code typed in technical notes.
 *
 * Only notebook components import this module, so the editor bundle stays in
 * the Notebook route chunk.
 */
export function createNotebookExtensions(placeholder = '') {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    Highlight.configure({ multicolor: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
  ];
}
