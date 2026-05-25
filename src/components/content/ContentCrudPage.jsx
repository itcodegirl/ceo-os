import { useMemo, useState } from 'react';
import CrudPageTemplate from '../crud/CrudPageTemplate';
import ContentBoard from './ContentBoard';
import ContentItemModal from './ContentItemModal';
import ContentFormModal from './ContentFormModal';
import ContentDeleteConfirmModal from './ContentDeleteConfirmModal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import SummaryCards from '../ui/SummaryCards';
import { CrudCardGridLoadingSkeleton } from '../crud/CrudLoadingSkeletons';
import {
  CONTENT_ITEMS_UPDATED_EVENT,
  createContentItem,
  deleteContentItem,
  getContentSource,
  listContentItems,
  updateContentItem,
} from '../../lib/contentRepository';
import {
  DEFAULT_CONTENT_STATUS,
  DEFAULT_CONTENT_TYPE,
} from '../../lib/contentPayloadSchema';
import { findNextScheduledItem, formatPublishDate } from '../../lib/contentFormatting';
import { buildContentSignature } from '../../lib/recordIdentity';
import { buildSourceNotice } from '../../lib/uiCopy';
import { parseContentPayload } from '../../lib/contentPayloadSchema';
import { useCrudPage } from '../../hooks/useCrudPage';
import '../../styles/forms.css';
import '../../styles/crm-table.css';
import '../../styles/content.css';

const DEFAULT_FORM = {
  title: '',
  platform: '',
  contentType: DEFAULT_CONTENT_TYPE,
  status: DEFAULT_CONTENT_STATUS,
  purpose: '',
  scheduledFor: '',
  notes: '',
};

function mapContentItemToFormValues(item) {
  return {
    title: item.title || '',
    platform: item.platform || '',
    contentType: item.contentType || DEFAULT_CONTENT_TYPE,
    status: item.status || DEFAULT_CONTENT_STATUS,
    purpose: item.purpose || '',
    scheduledFor: item.scheduledFor || '',
    notes: item.notes || '',
  };
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function buildScheduledDescription(items, readyAndScheduledCount) {
  const next = findNextScheduledItem(items);
  if (next) {
    const dateLabel = formatPublishDate(next.scheduledFor) || 'date TBD';
    return `Next: ${dateLabel} — ${truncate(next.title, 30)}`;
  }
  if (readyAndScheduledCount > 0) {
    return 'Pick a publish date to queue it';
  }
  return 'Nothing queued yet';
}

function hasDuplicateContentPayload(payload, items = [], selectedItem = null) {
  const nextSignature = buildContentSignature(payload);
  if (!nextSignature) {
    return false;
  }

  return items.some((item) => {
    if (selectedItem?.id && String(item.id) === String(selectedItem.id)) {
      return false;
    }

    return buildContentSignature(item) === nextSignature;
  });
}

function validateContentPayload(payload, context = {}) {
  if (hasDuplicateContentPayload(payload, context.items, context.selectedItem)) {
    return 'This content item already exists for that platform.';
  }

  return '';
}

function ContentCrudPage() {
  const {
    isLoading,
    items: contentRows,
    selectedItem,
    setSelectedItem,
    isFormOpen,
    isDeleteConfirmOpen,
    isSaving,
    isDeleting,
    formValues,
    formError,
    loadError,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseFormModal,
    handleFormChange,
    handleFormSubmit,
    handleOpenDeleteConfirm,
    handleCloseDeleteConfirm,
    handleConfirmDeleteSelected,
    deletePrompt,
  } = useCrudPage({
    defaultFormValues: DEFAULT_FORM,
    listItems: listContentItems,
    createItem: createContentItem,
    updateItem: updateContentItem,
    deleteItem: deleteContentItem,
    updatedEventName: CONTENT_ITEMS_UPDATED_EVENT,
    mapItemToFormValues: mapContentItemToFormValues,
    parsePayload: parseContentPayload,
    validate: validateContentPayload,
    getDeleteLabel: (item) => item.title,
    messages: {
      load: 'Unable to load content items right now.',
      save: 'Unable to save content item right now. Refresh and try again if this record changed elsewhere.',
      delete: 'Unable to delete content item right now. Refresh and try again if this record changed elsewhere.',
      createSuccess: 'Content item added to the workflow.',
      updateSuccess: 'Content item updated.',
      deleteSuccess: 'Content item deleted.',
    },
    logPrefix: 'content items',
  });

  // Source is a runtime config check that doesn't change during a session.
  // Reading it from a useState initializer avoids hitting the resolver on
  // every render (modal open, form keystroke, list refresh, etc.).
  const [source] = useState(() => getContentSource());

  const statusCounts = useMemo(
    () =>
      contentRows.reduce(
        (counts, item) => {
          if (counts[item.status] !== undefined) {
            counts[item.status] += 1;
          }
          return counts;
        },
        { Idea: 0, Drafting: 0, Editing: 0, Ready: 0, Scheduled: 0, Published: 0 },
      ),
    [contentRows],
  );

  const summaryCards = useMemo(() => {
    const inProgress = statusCounts.Drafting + statusCounts.Editing;
    const readyAndScheduled = statusCounts.Ready + statusCounts.Scheduled;
    return [
      {
        id: 'content-ideas',
        label: 'Ideas',
        value: statusCounts.Idea,
        description: 'Captured, not started',
      },
      {
        id: 'content-in-progress',
        label: 'In progress',
        value: inProgress,
        description: 'Drafting or in review',
      },
      {
        id: 'content-ready-scheduled',
        label: 'Ready & scheduled',
        value: readyAndScheduled,
        description: buildScheduledDescription(contentRows, readyAndScheduled),
      },
      {
        id: 'content-published',
        label: 'Published',
        value: statusCounts.Published,
        description: 'Shipped — a record of what went out',
      },
    ];
  }, [contentRows, statusCounts]);

  return (
    <CrudPageTemplate
      pageClassName="content-page"
      header={{
        title: 'Content OS',
        description: 'Move founder content from idea to published — capture ideas, draft, review, schedule, and keep a record of what shipped.',
      }}
      status={{
        source,
        sourceNote: buildSourceNotice(source, { supabasePrefix: '' }),
        sourceNoteClassName: 'content-source-note',
        loadError,
        loadErrorClassName: 'content-error',
        loadingAnnouncement: 'Loading content board data.',
        isLoading,
      }}
      slots={{
        summary: {
          loadingContent: (
            <SummaryCards
              className="content-summary"
              isLoading
              loadingCount={4}
              loadingKeyPrefix="content-summary"
            />
          ),
          content: (
            <SummaryCards
              className="content-summary"
              cards={summaryCards}
            />
          ),
        },
        section: {
          title: 'Publishing Pipeline',
          iconName: 'content',
          actionText: 'New Content',
          onAction: handleOpenCreateModal,
          actionLabel: 'Add a content idea or draft',
          loadingContent: (
            <CrudCardGridLoadingSkeleton
              className="content-board"
              ariaLabel="Publishing pipeline cards"
              loadingMessage="Loading content cards."
              cards={3}
            />
          ),
          isEmpty: contentRows.length === 0,
          emptyState: {
            icon: <Icon name="content" size={20} />,
            title: 'No content in motion',
            description: 'Add one piece you want to ship — even just a working title — and follow it from drafting to scheduled.',
            action: (
              <Button onClick={handleOpenCreateModal} icon={{ name: 'add', size: 14 }}>
                Capture your first idea
              </Button>
            ),
          },
          content: <ContentBoard items={contentRows} onOpenItem={setSelectedItem} />,
        },
        modals: {
          item: (
            <ContentItemModal
              selectedItem={selectedItem}
              isDeleting={isDeleting}
              onClose={() => setSelectedItem(null)}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteConfirm}
            />
          ),
          form: (
            <ContentFormModal
              isOpen={isFormOpen}
              selectedItem={selectedItem}
              isSaving={isSaving}
              formValues={formValues}
              formError={formError}
              onClose={handleCloseFormModal}
              onChange={handleFormChange}
              onSubmit={handleFormSubmit}
            />
          ),
          deleteConfirm: (
            <ContentDeleteConfirmModal
              isOpen={isDeleteConfirmOpen}
              message={deletePrompt}
              onCancel={handleCloseDeleteConfirm}
              onConfirm={handleConfirmDeleteSelected}
              isDeleting={isDeleting}
            />
          ),
        },
      }}
    />
  );
}

export default ContentCrudPage;
