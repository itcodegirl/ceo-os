import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  DEFAULT_CONTENT_STATUS,
  DEFAULT_CONTENT_TYPE,
} from '../../lib/contentPayloadSchema';

const EMPTY_VALUES = {
  title: '',
  platform: '',
  contentType: DEFAULT_CONTENT_TYPE,
  status: DEFAULT_CONTENT_STATUS,
  purpose: '',
  scheduledFor: '',
  notes: '',
};

function ContentFormModal({
  isOpen,
  selectedItem,
  isSaving = false,
  formValues,
  formError,
  onClose,
  onChange,
  onSubmit,
}) {
  const values = { ...EMPTY_VALUES, ...(formValues || {}) };

  return (
    <Modal
      isOpen={isOpen}
      title={selectedItem ? 'Edit Content Item' : 'Add Content Item'}
      onClose={onClose}
    >
      <form className="content-form" onSubmit={onSubmit}>
        <Input
          id="content-title"
          label="Title"
          className="form-field"
          value={values.title}
          onChange={(event) => onChange('title', event.target.value)}
          required
          disabled={isSaving}
        />

        <Input
          id="content-platform"
          label="Platform"
          className="form-field"
          placeholder="LinkedIn, Newsletter, Blog, YouTube…"
          value={values.platform}
          onChange={(event) => onChange('platform', event.target.value)}
          required
          disabled={isSaving}
        />

        <div className="content-form__row">
          <Select
            id="content-type"
            label="Content type"
            className="form-field"
            value={values.contentType}
            onChange={(event) => onChange('contentType', event.target.value)}
            disabled={isSaving}
          >
            {CONTENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>

          <Select
            id="content-status"
            label="Status"
            className="form-field"
            value={values.status}
            onChange={(event) => onChange('status', event.target.value)}
            disabled={isSaving}
          >
            {CONTENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <Input
          id="content-scheduled-for"
          type="date"
          label="Target publish date"
          className="form-field"
          value={values.scheduledFor}
          onChange={(event) => onChange('scheduledFor', event.target.value)}
          disabled={isSaving}
        />

        <Input
          id="content-purpose"
          label="Purpose"
          className="form-field"
          placeholder="Which priority or audience does this serve?"
          value={values.purpose}
          onChange={(event) => onChange('purpose', event.target.value)}
          disabled={isSaving}
        />

        <Textarea
          id="content-notes"
          label="Repurposing & notes"
          className="form-field content-form__textarea-field"
          placeholder="Angles, source material, where this could be reused…"
          value={values.notes}
          onChange={(event) => onChange('notes', event.target.value)}
          disabled={isSaving}
          rows={3}
        />

        {formError ? (
          <p className="helper-text content-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="content-modal-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cancel content form"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            aria-label={selectedItem ? 'Save content changes' : 'Create content item'}
            icon={{ name: 'check', size: 14 }}
          >
            {isSaving ? 'Saving…' : selectedItem ? 'Save Changes' : 'Add to Pipeline'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ContentFormModal;
