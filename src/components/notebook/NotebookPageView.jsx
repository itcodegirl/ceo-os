import { ExternalLink } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Button from '../ui/Button';
import DeleteConfirmModal from '../ui/DeleteConfirmModal';
import Modal from '../ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNotebookAutosave } from '../../hooks/useNotebookAutosave';
import { useNotebookItems } from '../../hooks/useNotebookItems';
import { useReminders } from '../../hooks/useReminders';
import { useToast } from '../../hooks/useToast';
import { findTextRange } from '../../lib/notebook/editorSelection';
import { NOTEBOOK_ITEM_KINDS, truncate } from '../../lib/notebook/items/itemModels';
import { normalizeLinkHref } from '../../lib/notebook/links';
import { deleteNotebookPage, resolveNotebookConflict } from '../../lib/notebook/notebookPagesRepository';
import { PANEL_LABEL } from '../../lib/notebook/notebookPanel';
import { notebookPageHref } from '../../lib/notebook/notebookRoutes';
import { getNotebookBlock } from '../../lib/notebook/notebookSections';
import { getPlainText, hasWriting } from '../../lib/notebook/notebookText';
import { createReminder, REMINDER_SOURCE_NOTEBOOK_PAGE } from '../../lib/remindersRepository';
import EditorToolbar from './EditorToolbar';
import ItemComposer from './ItemComposer';
import NotebookBlock from './NotebookBlock';
import NotebookContextPanel, { NotebookContextStrip } from './NotebookContextPanel';
import NotebookSelectionMenu from './NotebookSelectionMenu';

// Below this width the panel moves into a sheet; matches notebook.css.
const NARROW_QUERY = '(max-width: 1100px)';

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function describeStatus(autosave, page) {
  if (autosave.status === 'error') {
    return autosave.error === 'stale' ? 'Not saved: changed in another tab' : 'Not saved on this device';
  }
  if (autosave.status === 'dirty') return 'Unsaved changes';
  if (page.sync.conflict) return 'Saved here · sync needs you';
  const time = timeFormatter.format(new Date(autosave.savedAt ?? page.updatedAt));
  if (page.sync.ownerId) return page.sync.pending ? `Saved ${time} · waiting to sync` : `Saved ${time} · synced`;
  const written = autosave.savedAt || Object.values(page.blocks).some(hasWriting);
  return written ? `Saved on this device ${time}` : 'Autosaves as you write';
}

function ConflictNotice({ page }) {
  const { conflict } = page.sync;
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const resolve = async (choice) => {
    setBusy(true);
    try {
      await resolveNotebookConflict(page.id, choice);
    } catch {
      showToast('Could not reach your account. Your writing is still saved here.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notebook-notice" role="alert">
      <p>
        {conflict.deletedElsewhere
          ? 'This page was deleted on another device, but it has new writing here.'
          : 'This page was also changed on another device. Both versions are safe until you choose.'}
      </p>
      <div className="notebook-notice__actions">
        <Button size="small" onClick={() => resolve('mine')} disabled={busy}>
          {conflict.deletedElsewhere ? 'Keep this page' : 'Keep this version'}
        </Button>
        <Button size="small" variant="ghost" onClick={() => resolve('theirs')} disabled={busy}>
          {conflict.deletedElsewhere ? 'Delete it here too' : 'Use the other version'}
        </Button>
      </div>
    </div>
  );
}

/**
 * One open notebook page, with the cards, questions, and ideas panel beside
 * it. The parent keys this component by page id and remote revision, so a
 * page replaced by sync re-mounts with fresh editors (its unsaved writing was
 * saved before the pull; see registerNotebookSyncFlush). Panel state lives in
 * the parent so it survives that re-mount.
 */
function NotebookPageView({ page, section, headerMeta, onReload, onDeleted, panel, onPanelChange }) {
  const autosave = useNotebookAutosave(page);
  const { showToast } = useToast();
  const titleInputId = useId();
  const sourceInputId = useId();
  const [editors, setEditors] = useState({});
  const [activeBlock, setActiveBlock] = useState(section.blocks[0].key);
  const [title, setTitle] = useState(page.title);
  const [sourceUrl, setSourceUrl] = useState(page.sourceUrl);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const latestDocs = useRef({ ...page.blocks });
  const [nextThingText, setNextThingText] = useState(() => getPlainText(page.blocks.oneNextThing));
  const isDaily = section.pageMode === 'daily';
  const { update, updateFields } = autosave;
  const items = useNotebookItems();
  const reminders = useReminders();
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [composer, setComposer] = useState(null);
  const [reveal, setReveal] = useState({ blockKey: null, token: 0 });

  const handleChange = useCallback((blockKey, doc) => {
    latestDocs.current[blockKey] = doc;
    update(blockKey, doc);
    if (blockKey === 'oneNextThing') setNextThingText(getPlainText(doc));
  }, [update]);

  const handleReady = useCallback((blockKey, editor) => {
    setEditors((current) => {
      if (current[blockKey] === editor) return current;
      const next = { ...current };
      if (editor) next[blockKey] = editor;
      else delete next[blockKey];
      return next;
    });
  }, []);

  // Links a to-do back to this page, for the Lists tab and Focus Home.
  const todoSource = {
    type: REMINDER_SOURCE_NOTEBOOK_PAGE,
    id: page.id,
    title: title.trim() || page.title,
    href: notebookPageHref(page),
  };

  const makeReminderFromNextThing = () => {
    const text = getPlainText(latestDocs.current.oneNextThing);
    if (!text) {
      showToast('Write your one next thing first.');
      return;
    }
    try {
      createReminder({ text, source: todoSource });
      showToast('Reminder created from your next thing.');
    } catch {
      showToast('Unable to create a reminder right now.');
    }
  };

  const openComposer = (request) => {
    setSheetOpen(false);
    setComposer(request);
  };

  const closeComposer = (outcome) => {
    const { editor } = composer ?? {};
    setComposer(null);
    if (outcome === 'saved') onPanelChange({ tab: composer.kind, collapsed: false });
    // Back to the writing the item was made from, once the dialog has let go of focus.
    if (editor) requestAnimationFrame(() => editor.commands.focus());
  };

  const showSource = (item) => {
    const editor = editors[item.sourceBlock];
    if (!editor) {
      showToast('That passage is no longer on this page.');
      return;
    }
    flushSync(() => setReveal(({ token }) => ({ blockKey: item.sourceBlock, token: token + 1 })));
    const range = findTextRange(editor.state.doc, item.sourceText);
    if (!range) {
      showToast('That passage was edited since, so it could not be found.');
      editor.commands.focus();
      return;
    }
    editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  };

  const revealSource = (item) => {
    if (!sheetOpen) {
      showSource(item);
      return;
    }
    setSheetOpen(false);
    // Wait for the sheet to close and return focus before selecting the text.
    requestAnimationFrame(() => showSource(item));
  };

  const counts = {
    ...Object.fromEntries(NOTEBOOK_ITEM_KINDS.map((kind) => [
      kind,
      items[kind].filter((item) => item.pageId === page.id).length,
    ])),
    list: reminders.filter((reminder) => (
      !reminder.isDone && reminder.sourceType === REMINDER_SOURCE_NOTEBOOK_PAGE && reminder.sourceId === page.id
    )).length,
  };

  const addTodoFromSelection = (source) => {
    try {
      createReminder({ text: truncate(source.text, 500), source: todoSource });
    } catch {
      showToast('Could not save this to-do on this device.');
      return;
    }
    onPanelChange({ tab: 'list', scope: 'page', collapsed: false });
    showToast("Added to this page's to-dos. It shows on Focus Home too.");
  };

  const panelProps = {
    items,
    reminders,
    todoSource,
    page,
    tab: panel.tab,
    onTabChange: (tab) => onPanelChange({ tab }),
    scope: panel.scope,
    onScopeChange: (scope) => onPanelChange({ scope }),
    onCreate: (kind) => openComposer({ kind }),
    onEdit: (kind, existing) => openComposer({ kind, existing }),
    onRevealSource: revealSource,
  };

  const sourceHref = normalizeLinkHref(sourceUrl);
  const toolbarEditor = editors[activeBlock] ?? editors[section.blocks[0].key] ?? null;
  const activeBlockTitle = section.blocks.find((block) => block.key === activeBlock)?.title ?? section.blocks[0].title;

  return (
    <div className="notebook-workspace" data-panel={!isNarrow && !panel.collapsed ? 'open' : 'closed'}>
      <article className="notebook-sheet" aria-labelledby={isDaily ? `${titleInputId}-heading` : titleInputId}>
        <header className="notebook-sheet__header">
          {isDaily ? (
            <h2 id={`${titleInputId}-heading`} className="notebook-sheet__title">{page.title}</h2>
          ) : (
            <>
              <label htmlFor={titleInputId} className="sr-only">Page title</label>
              <input
                id={titleInputId}
                className="notebook-sheet__title notebook-sheet__title-input"
                value={title}
                maxLength={160}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (event.target.value.trim()) updateFields({ title: event.target.value.trim() });
                }}
                onBlur={() => {
                  if (!title.trim()) setTitle(page.title);
                }}
              />
            </>
          )}
          <div className="notebook-sheet__meta">
            {headerMeta}
            {section.sourceLink ? (
              <div className="notebook-sheet__source">
                <label htmlFor={sourceInputId} className="helper-text">Source</label>
                <input
                  id={sourceInputId}
                  type="url"
                  inputMode="url"
                  className="input-field__control notebook-sheet__source-input"
                  placeholder="Link to what you are studying"
                  value={sourceUrl}
                  onChange={(event) => {
                    setSourceUrl(event.target.value);
                    updateFields({ sourceUrl: event.target.value });
                  }}
                />
                {sourceHref ? (
                  <a className="notebook-sheet__source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">
                    Open<ExternalLink aria-hidden="true" /><span className="sr-only"> source in a new tab</span>
                  </a>
                ) : null}
              </div>
            ) : null}
            {!isDaily ? (
              <Button size="small" variant="ghost" onClick={() => setConfirmingDelete(true)}>Delete page</Button>
            ) : null}
          </div>
        </header>

        {page.sync.conflict ? <ConflictNotice page={page} /> : null}
        {autosave.status === 'error' && autosave.error === 'stale' ? (
          <div className="notebook-notice" role="alert">
            <p>This page was changed in another tab, so this tab&apos;s latest changes are not saved yet.</p>
            <div className="notebook-notice__actions">
              <Button size="small" onClick={() => autosave.forceSave()}>Save this tab&apos;s version</Button>
              <Button size="small" variant="ghost" onClick={onReload}>Load the other version</Button>
            </div>
          </div>
        ) : null}
        {autosave.status === 'error' && autosave.error === 'storage' ? (
          <p className="form-error" role="alert">
            Your latest writing could not be saved on this device (storage may be full). It is still on this page; keep this tab open.
          </p>
        ) : null}

        <div className="notebook-sheet__toolbar">
          <EditorToolbar
            editor={toolbarEditor}
            label={`Formatting for ${activeBlockTitle}`}
            trailing={<span className="notebook-status" data-status={autosave.status}>{describeStatus(autosave, page)}</span>}
          />
        </div>

        <div className="notebook-paper">
          {section.blocks.map((block) => (
            <NotebookBlock
              key={block.key}
              block={block}
              initialContent={page.blocks[block.key]}
              active={activeBlock === block.key}
              onChange={handleChange}
              onFocus={setActiveBlock}
              onReady={handleReady}
              revealToken={reveal.blockKey === block.key ? reveal.token : 0}
              selectionMenu={editors[block.key] ? (
                <NotebookSelectionMenu
                  editor={editors[block.key]}
                  blockKey={block.key}
                  blockTitle={block.title}
                  onCreate={(kind, source, editor) => (kind === 'todo'
                    ? addTodoFromSelection(source)
                    : openComposer({ kind, source, editor }))}
                />
              ) : null}
              action={block.key === 'oneNextThing' ? (
                <Button size="small" variant="ghost" onClick={makeReminderFromNextThing} disabled={!nextThingText}>
                  Make a reminder from this
                </Button>
              ) : null}
            />
          ))}
        </div>

        <DeleteConfirmModal
          isOpen={confirmingDelete}
          title="Delete this page?"
          message={`"${page.title}" will be removed from this device${page.sync.ownerId ? ' and your account' : ''}. Cards, questions, and ideas made from it are kept.`}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            deleteNotebookPage(page.id);
            onDeleted?.();
          }}
        />

        {isNarrow ? (
          <div className="notebook-panel-bar">
            <NotebookContextStrip
              counts={counts}
              label="Open"
              onExpand={(tab) => {
                onPanelChange({ tab, scope: 'page' });
                setSheetOpen(true);
              }}
            />
          </div>
        ) : null}
      </article>

    {!isNarrow && !panel.collapsed ? (
      <NotebookContextPanel {...panelProps} onCollapse={() => onPanelChange({ collapsed: true })} />
    ) : null}
    {!isNarrow && panel.collapsed ? (
      <NotebookContextStrip counts={counts} onExpand={(tab) => onPanelChange({ tab, scope: 'page', collapsed: false })} />
    ) : null}
    {isNarrow && sheetOpen ? (
      <Modal isOpen title={PANEL_LABEL} onClose={() => setSheetOpen(false)} className="notebook-panel-sheet">
        <NotebookContextPanel {...panelProps} variant="sheet" />
      </Modal>
    ) : null}
    {composer ? (
      <ItemComposer
        kind={composer.kind}
        existing={composer.existing}
        source={composer.source}
        sourceLabel={getNotebookBlock(section.id, composer.source?.blockKey)?.title ?? page.title}
        pageId={composer.existing ? composer.existing.pageId : page.id}
        cards={items.card}
        onClose={closeComposer}
      />
    ) : null}
    </div>
  );
}

export default NotebookPageView;
