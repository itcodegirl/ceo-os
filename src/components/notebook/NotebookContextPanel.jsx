import { PanelRightClose, Pencil, Plus, TextQuote, Trash } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { ITEM_LABELS, itemName, NOTEBOOK_ITEM_KINDS, QUESTION_STATUS_LABELS, truncate } from '../../lib/notebook/items/itemModels';
import { deleteItem } from '../../lib/notebook/items/notebookItemsRepository';
import { getNotebookPage } from '../../lib/notebook/notebookPagesRepository';
import { notebookHref } from '../../lib/notebook/notebookRoutes';
import { getNotebookBlock } from '../../lib/notebook/notebookSections';
import KindIcon from './KindIcon';

function blockTitleFor(page, blockKey) {
  return getNotebookBlock(page.section, blockKey)?.title ?? page.title;
}

function pageHref(page) {
  return page.section === 'personal'
    ? notebookHref(page.section, { date: page.pageDate })
    : notebookHref(page.section, { page: page.id });
}

function ItemBody({ kind, item }) {
  if (kind === 'card') {
    return <p className="notebook-item__text">{truncate(item.answer, 160)}</p>;
  }
  if (kind === 'question') {
    return (
      <>
        <span className="notebook-item__badge" data-status={item.status}>{QUESTION_STATUS_LABELS[item.status]}</span>
        {item.answer ? <p className="notebook-item__text">{truncate(item.answer, 160)}</p> : null}
      </>
    );
  }
  return (
    <>
      {item.category ? <span className="notebook-item__badge">{item.category}</span> : null}
      {item.description ? <p className="notebook-item__text">{truncate(item.description, 160)}</p> : null}
    </>
  );
}

function NotebookItem({ kind, item, currentPage, scope, onEdit, onRevealSource, onRemoved }) {
  const [confirming, setConfirming] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const deleteRef = useRef(null);
  const keepRef = useRef(null);
  const noun = ITEM_LABELS[kind].singular;
  const shortName = truncate(itemName(kind, item), 48);
  const onThisPage = Boolean(currentPage) && item.pageId === currentPage.id;
  const origin = scope === 'all' && !onThisPage ? (item.pageId ? getNotebookPage(item.pageId) : null) : undefined;

  const startConfirm = () => {
    setRemoveFailed(false);
    flushSync(() => setConfirming(true));
    keepRef.current?.focus();
  };

  const keep = () => {
    flushSync(() => setConfirming(false));
    deleteRef.current?.focus();
  };

  const confirmRemove = () => {
    try {
      deleteItem(kind, item.id);
      onRemoved();
    } catch {
      flushSync(() => {
        setConfirming(false);
        setRemoveFailed(true);
      });
      deleteRef.current?.focus();
    }
  };

  return (
    <li className="notebook-item" data-kind={kind}>
      <article aria-label={`${ITEM_LABELS[kind].singular}: ${shortName}`}>
        <h3 className="notebook-item__heading">{itemName(kind, item)}</h3>
        <ItemBody kind={kind} item={item} />
        {onThisPage && item.sourceText ? (
          <button
            type="button"
            className="notebook-item__source"
            onClick={() => onRevealSource(item)}
            aria-label={`Show source in ${blockTitleFor(currentPage, item.sourceBlock)}: ${truncate(item.sourceText, 80)}`}
          >
            <TextQuote aria-hidden="true" />
            <span className="notebook-item__source-text">{truncate(item.sourceText, 90)}</span>
          </button>
        ) : null}
        {origin !== undefined ? (
          <p className="notebook-item__origin">
            {origin
              ? <>From <Link to={pageHref(origin)}>{origin.title}</Link></>
              : 'From a deleted page'}
          </p>
        ) : null}
        {confirming ? (
          <div className="notebook-item__confirm" role="group" aria-label={`Delete ${noun}: ${shortName}`}>
            <span>Delete this {noun}?</span>
            <Button size="small" onClick={confirmRemove}>Delete</Button>
            <Button ref={keepRef} size="small" variant="ghost" onClick={keep}>Keep</Button>
          </div>
        ) : (
          <div className="notebook-item__actions">
            <button type="button" className="notebook-icon-button" aria-label={`Edit ${noun}: ${shortName}`} title="Edit" onClick={() => onEdit(kind, item)}>
              <Pencil aria-hidden="true" />
            </button>
            <button
              ref={deleteRef}
              type="button"
              className="notebook-icon-button"
              aria-label={`Delete ${noun}: ${shortName}`}
              title="Delete"
              onClick={startConfirm}
            >
              <Trash aria-hidden="true" />
            </button>
          </div>
        )}
        {removeFailed ? (
          <p role="alert" className="form-error">Couldn&apos;t delete this {noun}. It is still saved.</p>
        ) : null}
      </article>
    </li>
  );
}

const EMPTY_HINTS = {
  card: 'Select writing on the page and choose Make card, or start a new one here.',
  question: 'Select something you want to come back to and choose Question.',
  idea: 'Select a spark of an idea and choose Idea, or jot one down here.',
};

/**
 * The right-hand panel: cards, questions, and ideas, one tab at a time, for
 * this page or across the whole notebook. On narrow screens the same panel
 * opens in a sheet (see NotebookPageView).
 */
function NotebookContextPanel({
  items,
  page,
  tab,
  onTabChange,
  scope,
  onScopeChange,
  onCreate,
  onEdit,
  onRevealSource,
  onCollapse,
  variant = 'inline',
}) {
  const baseId = useId();
  const newButtonId = `${baseId}-new`;
  const panelId = `${baseId}-panel`;
  const tabId = (kind) => `${baseId}-tab-${kind}`;
  const pageItems = (kind) => items[kind].filter((item) => page && item.pageId === page.id);
  const shown = scope === 'all' ? items[tab] : pageItems(tab);
  const labels = ITEM_LABELS[tab];

  const moveTab = (event) => {
    const index = NOTEBOOK_ITEM_KINDS.indexOf(tab);
    const last = NOTEBOOK_ITEM_KINDS.length - 1;
    const nextIndex = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = NOTEBOOK_ITEM_KINDS[nextIndex];
    onTabChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <aside className={`notebook-panel notebook-panel--${variant}`} aria-label="Cards, questions, and ideas">
      <div className="notebook-panel__header">
        <div className="notebook-panel__scope" role="group" aria-label="Show items from">
          {[['page', 'This page'], ['all', 'All pages']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="notebook-panel__scope-button"
              aria-pressed={scope === value}
              onClick={() => onScopeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {onCollapse ? (
          <button type="button" className="notebook-icon-button" aria-label="Hide the cards, questions, and ideas panel" title="Hide panel" onClick={onCollapse}>
            <PanelRightClose aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div role="tablist" aria-label="Item types" className="notebook-panel__tabs" onKeyDown={moveTab}>
        {NOTEBOOK_ITEM_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            id={tabId(kind)}
            data-kind={kind}
            className="notebook-panel__tab"
            aria-selected={tab === kind}
            aria-controls={panelId}
            tabIndex={tab === kind ? 0 : -1}
            onClick={() => onTabChange(kind)}
          >
            <KindIcon kind={kind} />
            <span>{ITEM_LABELS[kind].plural}</span>
            <span className="notebook-panel__count">
              {(scope === 'all' ? items[kind] : pageItems(kind)).length}
            </span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(tab)} className="notebook-panel__body">
        <Button id={newButtonId} size="small" variant="ghost" className="notebook-panel__new" onClick={() => onCreate(tab)}>
          <Plus aria-hidden="true" />
          {labels.create}
        </Button>
        {shown.length === 0 ? (
          <div className="notebook-panel__empty">
            <KindIcon kind={tab} />
            <p>{scope === 'all' ? `No ${labels.plural.toLowerCase()} yet.` : EMPTY_HINTS[tab]}</p>
          </div>
        ) : (
          <ul className="notebook-panel__list">
            {shown.map((item) => (
              <NotebookItem
                key={item.id}
                kind={tab}
                item={item}
                currentPage={page}
                scope={scope}
                onEdit={onEdit}
                onRevealSource={onRevealSource}
                // The removed item's buttons go with it; focus the list's stable control.
                onRemoved={() => document.getElementById(newButtonId)?.focus()}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** The collapsed panel: counts stay visible, and each one reopens the panel on its tab. */
export function NotebookContextStrip({ counts, onExpand, label = 'Show' }) {
  return (
    <div className="notebook-panel-strip" role="group" aria-label="Cards, questions, and ideas">
      {NOTEBOOK_ITEM_KINDS.map((kind) => {
        const name = `${label} ${ITEM_LABELS[kind].plural.toLowerCase()} (${counts[kind]})`;
        return (
          <button key={kind} type="button" className="notebook-panel-strip__button" data-kind={kind} aria-label={name} title={name} onClick={() => onExpand(kind)}>
            <KindIcon kind={kind} />
            <span className="notebook-panel-strip__label" aria-hidden="true">{ITEM_LABELS[kind].plural}</span>
            <span className="notebook-panel-strip__count" aria-hidden="true">{counts[kind]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default NotebookContextPanel;
