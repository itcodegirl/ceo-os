import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { contentStatusTone } from '../../lib/statusMaps';
import { formatPublishDate } from '../../lib/contentFormatting';

function DetailRow({ label, children }) {
  return (
    <p className="helper-text content-modal-detail">
      <span className="content-modal-detail__label">{label}</span>
      <span className="content-modal-detail__value">{children}</span>
    </p>
  );
}

function ContentItemModal({
  selectedItem,
  isDeleting = false,
  onClose,
  onEdit,
  onDelete,
}) {
  const publishLabel = selectedItem ? formatPublishDate(selectedItem.scheduledFor) : '';

  return (
    <Modal
      isOpen={Boolean(selectedItem)}
      title={selectedItem ? selectedItem.title : ''}
      onClose={onClose}
    >
      {selectedItem ? (
        <div className="content-modal-content">
          <DetailRow label="Stage">
            <Badge label={selectedItem.status} tone={contentStatusTone[selectedItem.status] || 'default'} />
          </DetailRow>
          <DetailRow label="Type">{selectedItem.contentType || 'Post'}</DetailRow>
          <DetailRow label="Platform">{selectedItem.platform || 'Not set'}</DetailRow>
          <DetailRow label="Publish date">
            {publishLabel || (selectedItem.status === 'Published' ? 'Already published' : 'Not scheduled')}
          </DetailRow>
          {selectedItem.purpose ? <DetailRow label="Purpose">{selectedItem.purpose}</DetailRow> : null}
          {selectedItem.notes ? <DetailRow label="Repurposing & notes">{selectedItem.notes}</DetailRow> : null}

          <div className="content-modal-actions">
            <Button
              type="button"
              onClick={onEdit}
              aria-label="Edit selected content item"
              icon={{ name: 'edit', size: 14 }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label="Delete selected content item"
              icon={{ name: 'delete', size: 14 }}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default ContentItemModal;
