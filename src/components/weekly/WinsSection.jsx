import { useCallback, useState } from 'react';
import SectionCard from '../ui/SectionCard';
import ConfirmModal from '../ui/ConfirmModal';
import EmptyHint from '../ui/EmptyHint';
import WeeklyTextList from './WeeklyTextList';
import WeeklyEditorModal from './WeeklyEditorModal';
import { useWeeklySectionEditor } from '../../hooks/useWeeklySectionEditor';

function WinsSection({ items, setItems, defaultItems }) {
  const winItems = Array.isArray(items) ? items : defaultItems;
  // Mirror the Priorities/Blockers impact-message pattern so the user
  // sees that wins also feed Focus Home (quick-win and momentum signal).
  // The README narrates this cross-feature connection but only two of the
  // three Weekly Brief sections were communicating it back to the user.
  const [impactMessage, setImpactMessage] = useState('');
  const setWinItems = useCallback((nextValue) => {
    setItems(nextValue);
    setImpactMessage('This shows up as your Focus Home quick-win and momentum signal.');
  }, [setItems]);
  const {
    formValues,
    formError,
    isEditorOpen,
    isEditing,
    isDeleteConfirmOpen,
    editorTitle,
    deletePrompt,
    closeEditor,
    openCreateEditor,
    openEditEditor,
    handleFormChange,
    requestDelete,
    closeDeleteConfirm,
    handleConfirmDelete,
    handleEditorSubmit,
  } = useWeeklySectionEditor({
    type: 'win',
    defaultItems,
    setItems: setWinItems,
  });

  return (
    <>
      <SectionCard
        title="Wins worth keeping"
        iconName="weekly"
        actionText="Add Win"
        onAction={openCreateEditor}
        actionLabel="Add weekly win"
      >
        {winItems.length ? (
          <WeeklyTextList
            items={winItems}
            itemTypeLabel="win"
            getDotClassName={() => 'weekly-list__dot--success'}
            getPrimaryText={(item) => item.text}
            getSecondaryText={(item) => (item.category ? `Category: ${item.category}` : '')}
            onEditItem={openEditEditor}
            onDeleteItem={requestDelete}
          />
        ) : (
          <EmptyHint>
            No wins logged. Start with one &mdash; momentum compounds when you write it down.
          </EmptyHint>
        )}
        {impactMessage ? <p className="helper-text weekly-impact-copy" role="status">{impactMessage}</p> : null}
      </SectionCard>

      <WeeklyEditorModal
        isOpen={isEditorOpen}
        title={editorTitle}
        editorType="win"
        formValues={formValues}
        formError={formError}
        isEditing={isEditing}
        onClose={closeEditor}
        onSubmit={handleEditorSubmit}
        onFormChange={handleFormChange}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Delete Win"
        message={deletePrompt}
        onCancel={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        cancelAriaLabel="Cancel win delete"
        confirmAriaLabel="Confirm win delete"
      />
    </>
  );
}

export default WinsSection;
