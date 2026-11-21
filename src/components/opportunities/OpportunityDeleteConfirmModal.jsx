import DeleteConfirmModal from '../ui/DeleteConfirmModal';

function OpportunityDeleteConfirmModal({
  isOpen,
  message,
  error,
  isDeleting = false,
  onCancel,
  onConfirm,
}) {
  return (
    <DeleteConfirmModal
      isOpen={isOpen}
      title="Delete Opportunity"
      message={message}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
      isDeleting={isDeleting}
    />
  );
}

export default OpportunityDeleteConfirmModal;
