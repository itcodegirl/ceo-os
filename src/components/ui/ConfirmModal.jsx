import Modal from './Modal';
import Button from './Button';

function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message,
  error,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  isConfirming = false,
  confirmAriaLabel = 'Confirm action',
  cancelAriaLabel = 'Cancel action',
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      {message ? <p className="helper-text">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isConfirming} aria-label={cancelAriaLabel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          aria-label={confirmAriaLabel}
          icon={{ name: 'check', size: 14 }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
