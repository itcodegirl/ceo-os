import { useCallback, useState } from 'react';
import SectionCard from '../ui/SectionCard';
import ConfirmModal from '../ui/ConfirmModal';
import WeeklyTextList from './WeeklyTextList';
import WeeklyEditorModal from './WeeklyEditorModal';
import { useWeeklySectionEditor } from '../../hooks/useWeeklySectionEditor';

const PRIORITY_STATUS_DOT_CLASS = {
  'In Progress': 'weekly-list__dot--success',
  Planned: '',
  Blocked: 'weekly-list__dot--warning',
};

function PrioritiesSection({ items, setItems, defaultItems }) {
  const priorityItems = Array.isArray(items) ? items : defaultItems;
  const [impactMessage, setImpactMessage] = useState('');
  const setPriorityItems = useCallback((nextValue) => {
    setItems(nextValue);
    setImpactMessage('This will influence your Focus Home recommendations.');
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
    type: 'priority',
    defaultItems,
    setItems: setPriorityItems,
  });

  return (
    <>
      <SectionCard
        title="This week's priorities"
        iconName="weekly"
        actionText="Add Priority"
        onAction={openCreateEditor}
        actionLabel="Add weekly priority"
      >
        {priorityItems.length ? (
          <WeeklyTextList
            items={priorityItems}
            itemTypeLabel="priority"
            getDotClassName={(item) => PRIORITY_STATUS_DOT_CLASS[item.status] || ''}
            getPrimaryText={(item) => item.title}
            getSecondaryText={(item) => `${item.owner ? `Owner: ${item.owner}. ` : ''}Status: ${item.status}`}
            onEditItem={openEditEditor}
            onDeleteItem={requestDelete}
          />
        ) : (
          <p className="helper-text">Nothing here yet. What are the 3&ndash;5 things this week is really about?</p>
        )}
        {impactMessage ? <p className="helper-text weekly-impact-copy" role="status">{impactMessage}</p> : null}
      </SectionCard>

      <WeeklyEditorModal
        isOpen={isEditorOpen}
        title={editorTitle}
        editorType="priority"
        formValues={formValues}
        formError={formError}
        isEditing={isEditing}
        onClose={closeEditor}
        onSubmit={handleEditorSubmit}
        onFormChange={handleFormChange}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Delete Priority"
        message={deletePrompt}
        onCancel={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        cancelAriaLabel="Cancel priority delete"
        confirmAriaLabel="Confirm priority delete"
      />
    </>
  );
}

export default PrioritiesSection;
