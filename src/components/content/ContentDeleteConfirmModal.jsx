import DeleteConfirmModal from '../ui/DeleteConfirmModal';

function ContentDeleteConfirmModal({
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
      title="Delete Content Item"
      message={message}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
      isDeleting={isDeleting}
    />
  );
}

export default ContentDeleteConfirmModal;
