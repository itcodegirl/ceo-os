import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import EmptyState from '../ui/EmptyState';
import SourceStatusNotice from '../ui/SourceStatusNotice';

function CrudPageTemplate({
  pageClassName,
  header = {},
  status = {},
  slots = {},
}) {
  const {
    title: pageTitle,
    description: pageDescription,
  } = header;

  const {
    source,
    sourceNote,
    sourceNoteClassName,
    loadError,
    loadErrorClassName,
    loadingAnnouncement,
    isLoading = false,
  } = status;

  const summarySlot = slots.summary || {};
  const sectionSlot = slots.section || {};
  const modalsSlot = slots.modals || {};

  const {
    loadingContent: summaryLoadingContent,
    content: summaryContent,
  } = summarySlot;

  const {
    title: sectionTitle,
    iconName: sectionIconName,
    actionText: sectionActionText,
    actionIconName: sectionActionIconName,
    onAction: onSectionAction,
    actionLabel: sectionActionLabel,
    loadingContent: sectionLoadingContent,
    isEmpty = false,
    emptyState = {},
    content: sectionContent,
  } = sectionSlot;

  const {
    icon: emptyStateIcon,
    title: emptyStateTitle,
    description: emptyStateDescription,
    action: emptyStateAction,
  } = emptyState;

  const {
    item: itemModal,
    form: formModal,
    deleteConfirm: deleteConfirmModal,
  } = modalsSlot;

  return (
    <section className={pageClassName}>
      <PageHeader title={pageTitle} description={pageDescription} />

      {source ? (
        <SourceStatusNotice
          source={source}
          supabaseText={source === 'supabase' && sourceNote ? sourceNote : undefined}
          localText={source !== 'supabase' && sourceNote ? sourceNote : undefined}
          className={sourceNoteClassName}
          loadError={loadError}
          errorClassName={loadErrorClassName}
        />
      ) : sourceNote ? (
        <p className={`helper-text ${sourceNoteClassName || ''}`.trim()}>
          {sourceNote}
        </p>
      ) : null}

      {!source && loadError ? (
        <p className={`helper-text ${loadErrorClassName || ''}`.trim()} role="alert">
          {loadError}
        </p>
      ) : null}

      {isLoading && loadingAnnouncement ? <p className="sr-only" role="status" aria-live="polite">{loadingAnnouncement}</p> : null}

      {isLoading ? summaryLoadingContent : summaryContent}

      <SectionCard
        title={sectionTitle}
        iconName={sectionIconName}
        actionText={sectionActionText}
        actionIconName={sectionActionIconName}
        onAction={onSectionAction}
        actionLabel={sectionActionLabel}
      >
        {isLoading ? sectionLoadingContent : isEmpty ? (
          <EmptyState
            icon={emptyStateIcon}
            title={emptyStateTitle}
            description={emptyStateDescription}
            action={emptyStateAction}
          />
        ) : (
          sectionContent
        )}
      </SectionCard>

      {itemModal}
      {formModal}
      {deleteConfirmModal}
    </section>
  );
}

export default CrudPageTemplate;
