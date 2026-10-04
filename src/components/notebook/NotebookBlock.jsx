import { ChevronRight } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { hasWriting } from '../../lib/notebook/notebookText';
import NotebookEditor from './NotebookEditor';

/**
 * One writing block on a notebook page. Folded blocks (progressive disclosure)
 * show a toggle in their heading and a "has notes" hint while closed.
 * `action` renders under the editor (e.g. Personal's "Make a reminder");
 * `selectionMenu` floats over selected text. A new `revealToken` opens a
 * folded block so the source passage of a card can be shown in it.
 */
function NotebookBlock({ block, initialContent, active, onChange, onFocus, onReady, action, selectionMenu, revealToken }) {
  const titleId = useId();
  const hintId = useId();
  const bodyId = useId();
  const headingRef = useRef(null);
  const [open, setOpen] = useState(() => !block.folded || hasWriting(initialContent));
  const [hasText, setHasText] = useState(() => hasWriting(initialContent));
  const [seenRevealToken, setSeenRevealToken] = useState(revealToken);

  // Opened during render (not in an effect) so a caller using flushSync can
  // select the revealed text right after.
  if (revealToken !== seenRevealToken) {
    setSeenRevealToken(revealToken);
    if (revealToken) setOpen(true);
  }

  const handleChange = useCallback((doc) => {
    onChange(block.key, doc);
    setHasText(hasWriting(doc));
  }, [block.key, onChange]);

  const handleFocus = useCallback(() => onFocus(block.key), [block.key, onFocus]);
  const handleReady = useCallback((editor) => onReady(block.key, editor), [block.key, onReady]);
  const focusHeading = useCallback(() => headingRef.current?.focus(), []);

  const className = [
    'notebook-block',
    active ? 'notebook-block--active' : '',
    block.folded ? 'notebook-block--foldable' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={className} aria-labelledby={titleId} data-block={block.key}>
      <h3 id={titleId} ref={headingRef} tabIndex={-1} className="notebook-block__title">
        {block.folded ? (
          <button
            type="button"
            className="notebook-block__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronRight aria-hidden="true" className="notebook-block__chevron" />
            <span>{block.title}</span>
            {hasText && !open ? <span className="notebook-block__badge">has notes</span> : null}
          </button>
        ) : (
          <>
            <span>{block.title}</span>
            {block.kicker ? <span className="notebook-block__kicker">{block.kicker}</span> : null}
          </>
        )}
      </h3>
      <p id={hintId} className="sr-only">
        Rich text. Use the formatting toolbar above the page, or Markdown shortcuts. Press Escape to leave the editor.
      </p>
      <div id={bodyId} className="notebook-block__body" hidden={!open}>
        <NotebookEditor
          placeholder={block.placeholder}
          initialContent={block.checklist && !initialContent ? CHECKLIST_STARTER : initialContent}
          labelledBy={titleId}
          describedBy={hintId}
          onChange={handleChange}
          onFocus={handleFocus}
          onReady={handleReady}
          onLeave={focusHeading}
        />
        {selectionMenu}
        {action ? <div className="notebook-block__action">{action}</div> : null}
      </div>
    </section>
  );
}

// Checklist blocks open as an empty task list so the first line is a checkbox.
const CHECKLIST_STARTER = {
  type: 'doc',
  content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }],
};

export default NotebookBlock;
