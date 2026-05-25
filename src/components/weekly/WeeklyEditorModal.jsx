import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import {
  BLOCKER_NEEDS,
  PRIORITY_STATUS_OPTIONS,
  WIN_CATEGORY_OPTIONS,
} from '../../lib/weeklyBriefEditor';

function WeeklyEditorModal({
  isOpen,
  title,
  editorType,
  formValues,
  formError,
  isEditing,
  onClose,
  onSubmit,
  onFormChange,
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <form className="weekly-form" onSubmit={onSubmit}>
        {editorType === 'priority' ? (
          <>
            <Input
              id="weekly-priority-title"
              label="Priority"
              className="form-field"
              value={formValues.title || ''}
              onChange={(event) => onFormChange('title', event.target.value)}
              placeholder="e.g. Send the partnership proposal and book the follow-up"
              required
            />

            <Input
              id="weekly-priority-owner"
              label="Owner (optional)"
              className="form-field"
              value={formValues.owner || ''}
              onChange={(event) => onFormChange('owner', event.target.value)}
              placeholder="You, unless you're handing it off"
            />

            <Select
              id="weekly-priority-status"
              label="Where it stands"
              className="form-field"
              labelClassName="form-field__label"
              controlClassName="form-input"
              value={formValues.status || 'Planned'}
              onChange={(event) => onFormChange('status', event.target.value)}
            >
              {PRIORITY_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {editorType === 'win' ? (
          <>
            <Textarea
              id="weekly-win-text"
              label="Win"
              className="form-field weekly-form__textarea-field"
              value={formValues.text || ''}
              onChange={(event) => onFormChange('text', event.target.value)}
              rows={3}
              placeholder="What went well — shipped, decided, learned, or survived. Small counts."
              required
            />

            <Select
              id="weekly-win-category"
              label="Category"
              className="form-field"
              labelClassName="form-field__label"
              controlClassName="form-input"
              value={formValues.category || 'Product'}
              onChange={(event) => onFormChange('category', event.target.value)}
            >
              {WIN_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {editorType === 'blocker' ? (
          <>
            <Textarea
              id="weekly-blocker-text"
              label="Blocker"
              className="form-field weekly-form__textarea-field"
              value={formValues.text || ''}
              onChange={(event) => onFormChange('text', event.target.value)}
              rows={3}
              placeholder="What's stuck, and briefly why."
              required
            />

            <Select
              id="weekly-blocker-severity"
              label="What it needs"
              className="form-field"
              labelClassName="form-field__label"
              controlClassName="form-input"
              value={formValues.severity || BLOCKER_NEEDS[0].value}
              onChange={(event) => onFormChange('severity', event.target.value)}
            >
              {BLOCKER_NEEDS.map((need) => (
                <option key={need.value} value={need.value}>
                  {need.label}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {formError ? (
          <p className="helper-text weekly-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="weekly-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={{ name: 'check', size: 14 }}>
            {isEditing ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default WeeklyEditorModal;
